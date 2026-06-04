# Configuration

All tunables are seeded from environment variables on first run and then editable
live from the UI (env seeds the DB; frontend edits win thereafter). Container-shape
values (watch root, vault dir, marker URL, ports) stay in compose.

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Purpose |
|----------|---------|---------|
| `WATCH_ROOT` | `${HOME}` | host root mounted into the api as `/host` |
| `WATCH_SUBDIR` | `Downloads` | initial watched subfolder (watched path = `/host/<WATCH_SUBDIR>`) |
| `VAULT_DIR` | `./vault` | Markdown, metadata, archived PDFs and the SQLite index |
| `WEB_PORT` | `16669` | the app (nginx) |
| `API_PORT` | `6670` | direct API + Scalar |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | host Ollama endpoint |
| `OLLAMA_MODEL` | `qwen2.5:7b-instruct` | default Ollama model |
| `DEBOUNCE_SECONDS` | `2` | size-stable wait before processing a new file |
| `MARKER_URL` | `http://marker-server:8000` | internal marker service (marker-host / pdfplumber) |
| `CONVERSION_ENGINE` | `off` | seed engine: `off` · `marker-host` · `marker-remote` · `pdfplumber` |
| `MARKER_REMOTE_URL` | (empty) | seed URL for the `marker-remote` engine (usually set in the UI) |
| `MARKER_CPUS` | `3.0` | hard CPU ceiling for the marker container (4-core VPS default) |
| `MARKER_THREADS` | `3` | torch/BLAS thread cap (`OMP/MKL/OPENBLAS_NUM_THREADS`) |
| `TORCH_DEVICE` | `cpu` | `cuda` for the AMD GPU (ROCm) — see the GPU gotcha |
| `JWT_KEY` | (vault keyfile) | JWT signing key — set a strong random value in production |
| `APP_SECRET_KEY` | (vault keyfile) | master key for at-rest secret encryption |

## Where settings live

Settings live in **SQLite**, per user; env vars only **seed** them on first run.
The precedence is: **env → DB → frontend edits**. After first boot, change
tunables (watched folder, conversion engine, LLM provider, prompts, debounce,
etc.) live from the UI — they take effect without a restart.

Container-shape values (watch root, vault dir, marker URL, ports) are *not* live
settings; they stay in the compose files / `.env`.
