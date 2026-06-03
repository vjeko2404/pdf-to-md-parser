"""
marker-server — a thin FastAPI wrapper around marker's PdfConverter.

Why custom instead of marker's stock server: we own the response contract.
"Sync-scroll from day one" requires every block to carry its PDF coordinates,
so /convert returns BLOCK-ANCHORED markdown plus a flat block list mapping
each anchor -> (page, bbox). The .NET side persists both; the React viewer
later uses the mapping to correlate the Markdown pane with the PDF pane.

Models are loaded ONCE at startup (create_model_dict) and kept warm; a fresh
(cheap) PdfConverter is built per request around those shared models.

NOTE: the block-tree traversal targets marker-pdf 1.x's JSON renderer schema.
If a marker upgrade changes block fields, _walk() is the one place to adjust.
"""
import os
import tempfile
import threading
from contextlib import asynccontextmanager

import pdfplumber
from fastapi import FastAPI, File, HTTPException, UploadFile
from markdownify import markdownify

from marker.config.parser import ConfigParser
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict

# Block types we keep whole (don't recurse into children) so tables/figures/
# equations render as one Markdown unit instead of being shredded into cells.
ATOMIC = {"Table", "Figure", "Picture", "Form", "Equation", "Code", "TableOfContents"}


def _page_of(block_id: str) -> int:
    """Block ids look like '/page/0/Text/1' — pull the page index out."""
    try:
        parts = block_id.strip("/").split("/")
        i = parts.index("page")
        return int(parts[i + 1])
    except Exception:
        return 0


def _bbox(block):
    bbox = getattr(block, "bbox", None)
    if bbox:
        return [float(x) for x in bbox]
    poly = getattr(block, "polygon", None)
    if poly:
        xs = [p[0] for p in poly]
        ys = [p[1] for p in poly]
        return [min(xs), min(ys), max(xs), max(ys)]
    return None


def _walk(block, blocks, parts, images):
    """Depth-first walk of the JSON block tree, emitting anchored markdown."""
    imgs = getattr(block, "images", None) or {}
    for name, b64 in imgs.items():
        if isinstance(b64, str):
            images[str(name)] = b64

    btype = getattr(block, "block_type", "") or ""
    children = getattr(block, "children", None)
    if children and btype not in ATOMIC:
        for child in children:
            _walk(child, blocks, parts, images)
        return

    html = getattr(block, "html", "") or ""
    md = markdownify(html, heading_style="ATX").strip() if html else ""
    if not md:
        return

    block_id = getattr(block, "id", "") or ""
    page = _page_of(block_id)
    # Invisible anchor the React viewer keys off for sync-scroll.
    anchor = f'<a class="blk" data-block="{block_id}" data-page="{page}"></a>'
    parts.append(f"{anchor}\n{md}")
    blocks.append({"id": block_id, "page": page, "bbox": _bbox(block), "type": btype})


def _transform(rendered):
    blocks, parts, images = [], [], {}
    pages = getattr(rendered, "children", None) or []
    for page in pages:
        _walk(page, blocks, parts, images)
    # NB: marker's rendered.metadata can contain dict-keyed-by-dict structures that
    # blow up FastAPI's JSON encoder (TypeError: unhashable type: 'dict'), and .NET
    # doesn't consume it — so we deliberately don't return it.
    return "\n\n".join(parts), blocks, images, len(pages)


# ── Lazy marker models ───────────────────────────────────────────────────────
# Loading the surya/datalab weights costs ~5GB RAM and is ONLY needed by /convert.
# We no longer load at startup: that let a default-OFF or pdfplumber-only deployment
# (and a tiny VPS) pay the whole cost for nothing, and the OOM-restart-loop it caused
# never let the container go healthy. Instead we load once, lazily, on the first
# /convert — guarded by a lock so concurrent requests don't double-load.
_models = None
_models_lock = threading.Lock()


def get_models():
    """Load (once) and return the shared marker model dict."""
    global _models
    if _models is None:
        with _models_lock:
            if _models is None:
                # Heavy: downloads weights to HF_HOME on first run, then cached on the volume.
                _models = create_model_dict()
    return _models


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    global _models
    _models = None


app = FastAPI(title="marker-server", lifespan=lifespan)


@app.get("/health")
def health():
    # Liveness, NOT readiness: a 200 means the server is up and can accept work. Marker
    # models load lazily on first /convert, and /extract (pdfplumber) needs none — so the
    # container is "healthy" immediately and the api never waits minutes for weights.
    return {
        "status": "ok",
        "modelsLoaded": _models is not None,
        "device": os.environ.get("TORCH_DEVICE", "cpu"),
    }


@app.post("/convert")
async def convert(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(data)
        path = tmp.name

    try:
        config_parser = ConfigParser({"output_format": "json"})
        converter = PdfConverter(
            config=config_parser.generate_config_dict(),
            artifact_dict=get_models(),  # lazy: loads weights on first call, warm after
            processor_list=config_parser.get_processors(),
            renderer=config_parser.get_renderer(),
        )
        rendered = converter(path)
        markdown, blocks, images, page_count = _transform(rendered)
        return {
            "markdown": markdown,
            "blocks": blocks,            # [{id, page, bbox, type}] — sync-scroll map
            "images": images,            # {name: base64}
            "page_count": page_count,
        }
    except Exception as exc:  # surfaced to .NET as a failed document + reason
        raise HTTPException(status_code=500, detail=f"conversion failed: {exc}") from exc
    finally:
        os.remove(path)


# ── Lightweight engine: pdfplumber /extract ──────────────────────────────────
# For born-digital PDFs (a real text layer) marker is wild overkill. pdfplumber reads
# the embedded text + line bboxes in milliseconds with no ML models. We emit the SAME
# block-anchored contract as /convert so the .NET side and the sync-scroll viewer are
# none the wiser about which engine produced the document.

# A new paragraph starts when the vertical gap to the previous line exceeds this multiple
# of the line height — a simple heuristic that keeps wrapped prose together.
_PARA_GAP = 0.75


def _extract_page(page, page_index, blocks, parts):
    """Group a page's text lines into paragraph blocks with union bboxes."""
    try:
        lines = page.extract_text_lines(layout=False)
    except Exception:
        lines = []

    para = None  # {"texts", "x0", "top", "x1", "bottom"}

    def flush():
        nonlocal para
        if not para:
            return
        text = "\n".join(para["texts"]).strip()
        if text:
            idx = len(blocks)
            block_id = f"/page/{page_index}/Text/{idx}"
            anchor = f'<a class="blk" data-block="{block_id}" data-page="{page_index}"></a>'
            parts.append(f"{anchor}\n{text}")
            blocks.append({
                "id": block_id,
                "page": page_index,
                "bbox": [para["x0"], para["top"], para["x1"], para["bottom"]],
                "type": "Text",
            })
        para = None

    for ln in lines:
        text = (ln.get("text") or "").strip()
        if not text:
            flush()
            continue
        top, bottom = float(ln["top"]), float(ln["bottom"])
        x0, x1 = float(ln["x0"]), float(ln["x1"])
        height = max(1.0, bottom - top)
        if para and (top - para["bottom"]) > height * _PARA_GAP:
            flush()
        if para is None:
            para = {"texts": [text], "x0": x0, "top": top, "x1": x1, "bottom": bottom}
        else:
            para["texts"].append(text)
            para["x0"] = min(para["x0"], x0)
            para["x1"] = max(para["x1"], x1)
            para["bottom"] = bottom
    flush()


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(data)
        path = tmp.name

    try:
        blocks, parts = [], []
        with pdfplumber.open(path) as pdf:
            page_count = len(pdf.pages)
            for i, page in enumerate(pdf.pages):
                _extract_page(page, i, blocks, parts)
        return {
            "markdown": "\n\n".join(parts),
            "blocks": blocks,            # [{id, page, bbox, type}] — sync-scroll map
            "images": {},                # pdfplumber text-only path (no image extraction)
            "page_count": page_count,
        }
    except Exception as exc:  # surfaced to .NET as a failed document + reason
        raise HTTPException(status_code=500, detail=f"extraction failed: {exc}") from exc
    finally:
        os.remove(path)
