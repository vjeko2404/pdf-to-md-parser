# Conversion engines

How PDFs become Markdown is a per-user, live setting (**Settings → Conversion
engine**), seeded by `CONVERSION_ENGINE` on first run. It dispatches in
`PipelineWorker`; every option produces the same block-anchored output that
powers the sync-scroll viewer.

> **Conversion is OFF by default.** A fresh install does not convert anything
> until you pick an engine — so it never pays marker's multi-gigabyte model load
> before you've chosen to use it. While OFF, uploads return `409` and watched
> files are ignored, both with a clear "pick an engine" prompt in the UI.

| Engine | What it is | When to use |
|--------|-----------|-------------|
| **Off** (default) | No conversion. Uploads return `409` and watched files are ignored. | Fresh installs, or to pause ingestion. |
| **Marker — on this server** | Full marker + surya in the local `marker-server` container. Highest quality (OCR, layout, tables, equations), but heavy — loads several GB of models and is CPU-intensive. | A machine with RAM and cores (or a working GPU) to spare. |
| **Marker — off this server** | The same marker quality, served by a `marker-server` on **another machine** (set its URL, with a Test button). Health-gated: while that server is unreachable, documents wait and auto-resume when it returns — nothing fails. | A small VPS that offloads the heavy lifting to a beefier box (e.g. over a Tailscale tailnet). |
| **pdfplumber** | A lightweight, near-instant text extractor (`/extract`) with no ML models. Reads the embedded text layer only — no OCR, tables or images. | Born-digital PDFs on a small box; scanned/image-only PDFs come out empty. |

The marker engines are health-gated by `MarkerHealthMonitor` (a short-TTL probe
of the target's `/health`). `GET /api/conversion/status` reports the active
engine and live reachability; the Settings panel shows it and can test a remote
URL before saving.

## Offloading marker to another machine

For a constrained host (a small VPS) you can run marker on a powerful machine and
point the VPS at it. The repo ships standalone compose files that run **only**
`marker-server`, published on port `8000`:

```bash
# On the powerful machine (CPU):
docker compose -f docker-compose.marker.yml up -d --build
tailscale ip -4    # the address to enter on the VPS as http://<ip>:8000
```

Then on the VPS: **Settings → Conversion engine → "Marker — off this server"**,
enter `http://<that-ip>:8000`, Test, Save. A Tailscale tailnet between the two
machines gives a private, zero-config link with no inbound ports opened.

See [Gotchas](gotchas.md) for the GPU (ROCm) variant of the standalone marker.
