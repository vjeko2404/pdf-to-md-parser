# PDF to Markdown Parser

A self-hosted application that watches a folder for new PDFs (or accepts
drag-and-drop uploads), converts them to clean Markdown with
[marker](https://github.com/datalab-to/marker) +
[surya](https://github.com/datalab-to/surya), optionally enriches them with
tags, summaries and categories via an LLM (local Ollama or any
OpenAI-compatible API), archives the originals, and serves a searchable
dashboard with a **PDF to Markdown sync-scroll** viewer.

The whole stack runs with a single `docker compose up -d`. It supports multiple
users with per-user data isolation and JWT authentication, so it can run on
localhost for personal use or behind a reverse proxy on a VPS.

---

## Quick start

```bash
cp .env.example .env          # adjust WATCH_ROOT / WATCH_SUBDIR if needed
make up                       # docker compose up -d --build, injecting UID/GID/WATCH_ROOT
# open http://localhost:16669
```

The first account to register becomes the administrator. Registration of
further accounts is controlled by an admin toggle (open by default until the
first user exists).

- **`make up`** is the canonical run command. It injects `id -u`/`id -g`/`$HOME`
  so generated files stay owned by the host user and the watched folder lives
  under your home directory. Plain `docker compose up -d` also works, but pins
  the UID to 1000 and only resolves `WATCH_ROOT` to `$HOME` if it is exported.
- **Frontend dev loop:** `cd frontend && npm run dev` serves the SPA at
  http://localhost:5173 and proxies `/api` and `/hub` to the api at `:6670`.
  Requires the backend running (`make up`, or just the `api` service).
- **Backend dev loop:** the host has .NET 10 — `cd PdfParser.Api && dotnet run`
  uses `appsettings.Development.json` with host paths. `marker-server` must be
  reachable (run it via compose).

### Ports

| Port | Service | Purpose |
|------|---------|---------|
| **16669** | `web` (nginx) | The application. Serves the SPA and proxies `/api` and `/hub` to the api. This is the entry point to open. Port 6669 is deliberately avoided: it is an IRC port that browsers block as unsafe (`ERR_UNSAFE_PORT`). |
| 6670 | `api` (.NET) | Direct REST API plus the Scalar API explorer at `/scalar`. The SPA does not need it. |
| (internal) | `marker-server` | Python/FastAPI conversion service, never exposed to the host. |
| 11434 | Ollama | Runs on the host (not containerized). See the gotchas below. |

---

## Architecture

```
HOST
  Ollama (Vulkan, gfx1201)  :11434          already present on the machine
  $WATCH_ROOT (= ~/) and vault/             bind-mounted into the api

  marker-server            api                       web
  Python/FastAPI           .NET 10 Minimal API        nginx
  marker + surya     <---  watcher, SQLite ledger,  <- serves the SPA,
  POST /convert            REST + SignalR, pipeline,    proxies /api and /hub
  (internal)               JWT auth, multi-tenancy      :16669
                           :6670
                              |
                              +--> host Ollama via host.docker.internal
```

**Pipeline:** `watch (or upload) -> size-stable debounce -> sha256 dedup ->
marker /convert -> write md + images + blocks.json -> archive original ->
commit (Done) -> [optional] enrich + auto-categorize`.

Enrichment is decoupled from conversion: a slow or broken LLM never blocks or
fails a conversion. A bad PDF is marked `Failed` and left in place (retryable),
and the worker never dies.

**Why the boundaries are where they are:** the torch/ML dependencies are sealed
inside `marker-server` (the .NET container never imports torch). Ollama stays on
the host, where its Vulkan setup already works. The `web` nginx is the only
public entry point.

---

## Authentication and multi-tenancy

- **JWT bearer authentication.** Login and registration issue a 7-day token. The
  signing key is `App:JwtKey` (set `JWT_KEY` in production) or a generated vault
  keyfile (`vault/.jwtkey`) for local development. The same key resolution is
  used for issuance and validation, so both always agree.
- **Per-user isolation.** Each user owns their own documents, settings, secrets,
  categories and watched folder. The data model is multi-tenant end to end.
- **Roles.** The first user to register becomes the administrator and claims any
  pre-auth orphan data. The admin's only extra privilege is toggling
  self-registration and enabling or disabling other accounts.
- **Password policy.** At least 8 characters, with an uppercase letter, a digit
  and a symbol. Enforced on the backend and mirrored by a strength meter in the UI.
- **At-rest secrets.** Per-user LLM API keys are encrypted with AES-GCM. The
  master key is `App:SecretKey` (set `APP_SECRET_KEY` in production) or a vault
  keyfile (`vault/.secretkey`).

Set strong random values for `JWT_KEY` and `APP_SECRET_KEY` on any publicly
reachable deployment:

```bash
openssl rand -base64 48
```

---

## LLM providers

Enrichment, summarization and auto-categorization route through a single
`LlmService` that selects a provider per the live `llmProvider` setting:

- **Ollama** — local models over the host Ollama instance (Vulkan on gfx1201).
- **OpenAI-compatible API** — OpenRouter, Gemini, and any other endpoint that
  speaks the OpenAI chat-completions protocol. The API key is read by name from
  the encrypted per-user secrets store.

Switching providers is instant and takes effect on the next request. The
Settings page can test the active provider and list its available models.

---

## Stack

### Backend — `PdfParser.Api/` (.NET 10, C#)
- **Minimal API** plus **BackgroundService** workers and **SignalR** (`/hub/live`).
- **Dapper + SQLite** (`vault/index.sqlite`) with **FTS5** full-text search. No EF Core.
- Status is stored as TEXT (always `Status.ToString()`); enums are serialized as
  strings in JSON via `JsonStringEnumConverter`.
- JWT authentication, role-based authorization, AES-GCM at-rest secrets.
- Key packages: `Dapper`, `Microsoft.Data.Sqlite`,
  `Microsoft.AspNetCore.Authentication.JwtBearer`,
  `Microsoft.AspNetCore.OpenApi`, `Scalar.AspNetCore`.

### marker-server — `marker-server/` (Python 3.12, FastAPI)
- A thin wrapper around marker's `PdfConverter`; models are loaded once at
  startup and kept warm.
- `/convert` returns a block-anchored contract: Markdown where each block is
  preceded by `<a class="blk" data-block="..." data-page="N"></a>`, plus a flat
  `blocks[]` list of `{id, page, bbox, type}`. This powers the PDF to Markdown
  sync-scroll. It does not return marker's raw `metadata`, which crashes
  FastAPI's JSON encoder.
- **Version pins (see gotchas):** `marker-pdf==1.10.2`, `transformers==4.57.3`.

### Frontend — `frontend/` (Vite 8 + React 19 + TypeScript 6)
- **Tailwind v4** (`@tailwindcss/vite`, CSS-first) with shadcn-style design
  tokens in `src/index.css` (purple accent; dark mode via a `.dark` class
  toggled by `ThemeProvider`).
- **Base UI** (`@base-ui/react`) plus `cva`, `lucide-react`, and
  `@radix-ui/react-slot`.
- **@tanstack/react-query** (data), **@microsoft/signalr** (live updates),
  **react-router 7** (routing), **sonner** (toasts),
  **react-pdf + react-markdown + remark-gfm + rehype-raw** (document viewer).
- Authenticated SPA: login and register pages, an `AuthProvider`, route guards,
  a user menu, password change, and an admin panel.
- `@/` alias maps to `src`. `cn` lives in `@/lib/utils`. Shared primitives live
  in `src/components/common/`.
- Run with `npm run dev`; `npm run build` runs a full `tsc -b` and passes.

---

## Project layout

```
docker-compose.yml          marker-server + api + web (+ model-cache volume)
Makefile                    make up/down/rebuild/logs/ps (injects UID/GID/HOME)
.env.example                WATCH_ROOT, WATCH_SUBDIR, WEB_PORT, API_PORT,
                            OLLAMA_*, JWT_KEY, APP_SECRET_KEY, etc.

marker-server/              app.py (block-anchored /convert), Dockerfile, requirements.txt

PdfParser.Api/
  Program.cs                DI wiring, endpoint mapping, JWT auth, schema + settings init
  Config/AppOptions.cs      env-bound options (seed defaults for the settings table)
  Auth/                     ClaimsPrincipal extensions (user id / role helpers)
  Pipeline/                 DownloadWatcher, ProcessingQueue (Channel), PipelineWorker
  Clients/                  MarkerClient, OllamaClient, OllamaAdmin, OpenAiClient
  Data/                     Database (schema + FTS5 + multi-tenant migration),
                            DocumentRepository, CategoryRepository, UserRepository,
                            SettingsService (per-user, env-seeded),
                            SecretsService (AES-GCM), SearchQuery
  Services/                 AuthService, PasswordHasher, LlmService,
                            EnrichmentService, CategorizationService
  Endpoints/                Auth, Documents, Categories, Settings, Secrets,
                            Folders, Ollama, Stats
  Hubs/LiveHub.cs           SignalR push (documentUpdated, ollamaPull)
  Models/                   Document, Category, User, Contracts (marker/LLM DTOs)

frontend/src/
  api/                      typed client per domain over client.ts (auth-aware fetch)
  providers/                ThemeProvider, AuthProvider
  hooks/                    react-query + useSignalR, useIsMobile, useViewMode, useSyncScroll
  components/{auth,layout,library,ollama,settings,doc,common,ui}/
  pages/                    Login, Register, Library, Document (sync-scroll),
                            AI, Settings, Folders, Categories, Logs
  index.css                Tailwind import + design tokens + .prose-doc markdown styles
```

---

## API surface

Authentication routes live under `/api/auth`. Everything else under `/api`
requires a bearer token (the fallback authorization policy). Admin-only routes
add their own policy.

### Auth (`/api/auth`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/register` | create an account (first user becomes admin) |
| POST | `/login` | obtain a bearer token |
| GET | `/registration` | whether self-registration is currently open |
| GET | `/me` | current user info |
| POST | `/change-password` | change your own password |
| PATCH | `/registration` | toggle self-registration (admin) |
| GET | `/users` | list users (admin) |
| PATCH | `/users/{id}/active` | enable or disable an account (admin) |

### Application (`/api`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/documents?q=&status=&tag(s)=&docType=&language=&dateFrom=&dateTo=&categoryId=&sort=` | search and filters (FTS5 when `q`) |
| GET | `/documents/{id}` · `/markdown` · `/blocks` · `/pdf` · `/events` | detail, rendered MD, sync-scroll map, original PDF, timeline |
| POST | `/documents/upload` (multipart) | drag-and-drop upload |
| POST | `/documents/{id}/retry` · `/reenrich` · `/enrich {ids[]}` | requeue, single enrich, batch enrich |
| PATCH | `/documents/{id}/tags {tags[]}` | manual tag editing (replaces tags, syncs the FTS tags column) |
| DELETE / POST | `/documents/{id}` · `/documents/delete {ids[]}` | delete one / batch (removes the row, FTS entry, events, category links, markdown dir + images, blocks.json, archived PDF) |
| GET/POST/PATCH/DELETE | `/categories` (+ `/documents/{id}/categories`, `/auto`) | taxonomy CRUD, assign/unassign, LLM auto-categorize |
| GET/PATCH | `/settings` (+ `/settings/llm-test`, `/settings/llm-models`) | per-user live settings; `llm-test` pings the active provider, `llm-models` lists its model ids |
| GET/PUT/DELETE | `/secrets` (+ `/{key}/reveal`) | encrypted-at-rest secrets, masked list |
| GET/POST/DELETE | `/ollama/status` · `/models` · `/ps` · `/pull` · `/models/{name}` | Ollama management (pull streams progress over SignalR `ollamaPull`) |
| GET | `/folders/browse?sub=` | sandboxed host folder browser (under WATCH_ROOT) |
| GET | `/stats` · `/events` · `/facets` · `/health` | dashboard widgets |
| HUB | `/hub/live` | SignalR: `documentUpdated`, `ollamaPull` |

---

## Configuration

All tunables are seeded from environment variables on first run and then editable
live from the UI (env seeds the DB; frontend edits win thereafter). Container-shape
values (watch root, vault dir, marker URL, ports) stay in compose.

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
| `MARKER_URL` | `http://marker-server:8000` | internal marker service |
| `TORCH_DEVICE` | `cpu` | set to `cuda` only after ROCm is proven on gfx1201 |
| `JWT_KEY` | (vault keyfile) | JWT signing key — set a strong random value in production |
| `APP_SECRET_KEY` | (vault keyfile) | master key for at-rest secret encryption |

---

## Deployment

The application is built for `docker compose up -d` on a single host. The same
compose stack runs unchanged on a VPS; the differences are all about exposure,
secrets and persistence.

### 1. Set the security keys

Never run a publicly reachable instance on the generated vault keyfiles. In the
server's `.env`, set both:

```bash
JWT_KEY=$(openssl rand -base64 48)
APP_SECRET_KEY=$(openssl rand -base64 48)
```

`JWT_KEY` signs login tokens (anyone who knows it can mint valid tokens);
`APP_SECRET_KEY` encrypts the at-rest LLM API keys. Keep `.env` out of git (it is
already gitignored).

### 2. Put TLS in front of the web container

Only the `web` container needs to be reachable. It listens on port 80 inside the
container, published to `WEB_PORT` (default 16669) on the host. Terminate TLS in
front of it with one of:

- **A reverse proxy** (Caddy, nginx, Traefik) on the host, proxying `https://your-domain`
  to `127.0.0.1:16669`. Forward WebSocket upgrades so SignalR (`/hub/`) keeps working.
- **A Cloudflare Tunnel** (`cloudflared`) pointing at `http://localhost:16669`,
  which needs no inbound ports open at all.

Bind the published port to localhost so it is not directly exposed:

```yaml
# docker-compose.override.yml
services:
  web:
    ports:
      - "127.0.0.1:16669:80"
  api:
    ports: !reset []          # do not publish the direct API / Scalar in production
```

The bundled nginx already proxies `/api` and `/hub` to the api and allows uploads
up to 100 MB (`client_max_body_size 100m`). Raise that limit there if you expect
larger PDFs.

### 3. Bootstrap the admin, then close registration

The first account to register becomes the administrator. Register it immediately
after the stack is up, then turn off self-registration from
**Settings -> Admin** (or `PATCH /api/auth/registration {"enabled": false}`) so the
instance is not open to the public. The admin can re-enable it or disable
individual accounts later.

### 4. Persist the vault and model cache

- **`VAULT_DIR`** (default `./vault`) holds the SQLite index, Markdown output,
  archived PDFs, and the generated keyfiles when `JWT_KEY` / `APP_SECRET_KEY` are
  unset. Back it up; losing it loses all documents and user accounts. If you rely
  on a generated `vault/.jwtkey`, wiping the vault invalidates every issued token —
  another reason to set the keys explicitly.
- The **`model-cache`** named volume holds the marker/surya weights (several GB).
  Keep it to avoid re-downloading on every rebuild.

### 5. The watched folder on a server

`WATCH_ROOT` defaults to the host `$HOME` and the watched path is
`/host/<WATCH_SUBDIR>`. On a headless server there may be no "Downloads" folder
to watch; either point `WATCH_SUBDIR` at a real ingestion directory or rely on
drag-and-drop uploads through the dashboard. The `api` container runs as the host
UID/GID (`make up` injects them) so written files stay owned by the deploying user.

---

## Gotchas and design decisions

1. **marker/surya version pins (do not bump blindly).** `marker-pdf 1.x` uses the
   classic surya (`surya-ocr 0.17.x` — separate plain-torch detection, recognition
   and layout models), not the newer Surya 2 VLM, which requires vLLM. vLLM has no
   RDNA4/gfx1201 kernels, so it would run CPU-only on this AMD card.
   `transformers==4.57.3` is required: 5.x removed `SuryaDecoderConfig.pad_token_id`
   (surya #484). Python 3.12 runs in the container (torch/transformers have no 3.14
   wheels).

2. **Ollama runs on the host, not in a container.** It uses Vulkan
   (`ollama-vulkan`), which works on gfx1201 where ROCm for LLM inference was
   unreliable. The api reaches it via `host.docker.internal:host-gateway`, so
   Ollama must listen beyond `127.0.0.1`. A systemd drop-in sets
   `OLLAMA_HOST=0.0.0.0`:

   ```bash
   sudo systemctl edit ollama
   # [Service]
   # Environment="OLLAMA_HOST=0.0.0.0:11434"
   sudo systemctl restart ollama
   ```

   If the host Ollama is unavailable, switch the LLM provider in Settings to an
   OpenAI-compatible API to keep enrichment, summaries and auto-categorization
   working.

3. **GPU for marker is opt-in; CPU is the default.** CPU conversion is reliable on
   the host hardware. To try marker on the GPU, swap `marker-server`'s base image
   for `rocm/pytorch` and pass `/dev/kfd` and `/dev/dri`. ROCm in a container is
   disposable and untested here.

4. **Files stay user-owned.** The `api` container runs as
   `${DOCKER_UID:-1000}:${DOCKER_GID:-1000}`. The whole `$HOME` is bind-mounted to
   `/host`; the watched directory is `/host/<watchSubdir>`, switchable live from
   the UI.

5. **Settings live in SQLite; env seeds them on first run** (env -> DB -> frontend
   edits). Container-shape values (watch root, vault dir, marker URL, ports) stay
   in compose; tunables live in the database, per user.

6. **Rebuilding a single service:** use
   `docker compose up -d --build --no-deps api`. A plain `--build api` can fail
   while evaluating other build contexts.

---

## Verification

- Backend: `dotnet build PdfParser.Api -c Release`, redeploy with
  `docker compose up -d --build --no-deps api`.
- Frontend: `npm run build` (full typecheck).
- End to end through the proxy: `curl localhost:16669/api/...` (production) or
  `localhost:5173/api/...` (dev). Authenticated routes require a bearer token from
  `/api/auth/login`.
