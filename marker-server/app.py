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
from contextlib import asynccontextmanager

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Heavy: downloads weights to HF_HOME on first run, then cached on the volume.
    app.state.models = create_model_dict()
    yield
    app.state.models = None


app = FastAPI(title="marker-server", lifespan=lifespan)


@app.get("/health")
def health():
    ready = getattr(app.state, "models", None) is not None
    return {"status": "ok" if ready else "loading", "device": os.environ.get("TORCH_DEVICE", "cpu")}


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
            artifact_dict=app.state.models,
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
