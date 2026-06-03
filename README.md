# PDF → Markdown Parser

A local "product" that watches a folder for new PDFs, converts them to clean
Markdown with [marker](https://github.com/datalab-to/marker) +
[surya](https://github.com/datalab-to/surya), enriches them with tags/summaries
via your local **Ollama** (Vulkan), archives the originals, and serves a
searchable dashboard with **PDF ↔ Markdown side-by-side** view.

Runs at **http://localhost:6669** (*zlo i naopako*).

## Architecture

```
HOST          Ollama (Vulkan, gfx1201)              :11434  ← already on your box
              $WATCH_DIR + vault/                   (bind-mounted)

CONTAINER 1   marker-server   Python/FastAPI, the torch/ML "swamp"   (internal)
CONTAINER 2   pdfparser-api   .NET 10 — watcher, SQLite(FTS5) ledger,
                              Ollama client, REST + SignalR, serves the SPA  :6669
CONTAINER 3   dashboard       React (added after the backend) — served by #2
```

The ML mess is sealed inside `marker-server`; the .NET container never imports
torch. See the design notes below for *why* each boundary sits where it does.

### Pipeline

`watch → debounce (size-stable) → sha256 dedup → marker /convert →
write md+images+blocks → Ollama enrich → archive original → commit + FTS index`

Failures are caught, marked `Failed`, dead-lettered to `vault/failed/`, and the
worker keeps going.

## The stack pins that matter

- **marker-pdf 1.x** deliberately uses the *classic* `surya-ocr 0.17.x` (plain
  torch models) — **not** the new vLLM-based VLM, which has no RDNA4 kernels.
- **`transformers==4.57.3`** — 5.x removed `SuryaDecoderConfig.pad_token_id`
  (surya #484). This is Bubba's `pip install "transformers<5.0"`, made exact.
- **Python 3.12** in the container (host is 3.14, which torch doesn't ship for).

## The one host tweak

The bridged `api` container reaches host Ollama via
`host.docker.internal:host-gateway`, but Ollama binds `127.0.0.1` by default.
Let it listen on the bridge:

```bash
sudo systemctl edit ollama          # (or your user unit)
# add:
#   [Service]
#   Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo systemctl restart ollama
```

(Tighter alternative: bind to the docker bridge `172.17.0.1` instead of `0.0.0.0`.)

## Run it

```bash
cp .env.example .env          # adjust WATCH_DIR etc.
docker compose up --build     # first run downloads marker model weights (~GBs)
```

Then open **http://localhost:6669** → Scalar API explorer (dashboard lands later).
Drop a PDF into `$WATCH_DIR` and watch it flow through `/api/events`.

### Backend dev loop (no Docker)

Host has .NET 10, so you can iterate on the API directly:

```bash
cd PdfParser.Api
dotnet run                    # uses appsettings.Development.json (local paths)
```

(`marker-server` still needs to be reachable — run it via compose, or point
`App__MarkerUrl` at a local instance.)

## API surface (v1, backend-first)

| Method | Route | Purpose |
|---|---|---|
| GET  | `/api/documents?q=&status=&tag=` | search / filter (FTS5) |
| GET  | `/api/documents/{id}` | document + metadata |
| GET  | `/api/documents/{id}/markdown` | rendered MD (block-anchored) |
| GET  | `/api/documents/{id}/blocks` | block→(page,bbox) map for sync-scroll |
| GET  | `/api/documents/{id}/pdf` | stream archived original |
| GET  | `/api/documents/{id}/events` | per-doc timeline |
| POST | `/api/documents/{id}/retry` | requeue |
| POST | `/api/documents/{id}/reenrich` | re-run Ollama enrichment |
| GET  | `/api/stats` · `/api/events` · `/api/health` | dashboard widgets |
| HUB  | `/hub/live` | SignalR live status + log |

## GPU later (optional)

Default is CPU (rock-solid on the 9950X3D). To try marker on the RX 9070 XT,
swap `marker-server`'s base image for `rocm/pytorch` and pass
`--device=/dev/kfd --device=/dev/dri`. ROCm-in-a-container is disposable, so a
bad MIOpen day never touches the host.
