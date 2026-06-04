# Development

## Dev loops

- **Dockerized dev loop (recommended):**
  `docker compose -f docker-compose.dev.yml up --build` brings up the whole stack
  with **hot reload on both ends** — Vite (HMR) for the frontend and `dotnet
  watch` for the backend — and no resource caps. Open http://localhost:5173. The
  `./frontend` and `./PdfParser.Api` dirs are bind-mounted, so edits reload in
  place; **`npm install` run on the host** (in `frontend/`) is picked up live
  because `node_modules` is bind-mounted too. Run in the foreground (no `-d`) to
  follow logs.
- **Host-only frontend loop:** `cd frontend && npm run dev` serves the SPA at
  http://localhost:5173 and proxies `/api` and `/hub` to the api at `:6670`.
  Requires the backend running (`make up`, or just the `api` service).
- **Host-only backend loop:** with .NET 10 on the host, `cd PdfParser.Api &&
  dotnet run` uses `appsettings.Development.json` with host paths.
  `marker-server` must be reachable (run it via compose).

## Stack

### Backend — `PdfParser.Api/` (.NET 10, C#)
- **Minimal API** plus **BackgroundService** workers and **SignalR**
  (`/hub/live`).
- **Dapper + SQLite** (`vault/index.sqlite`) with **FTS5** full-text search. No
  EF Core.
- Status is stored as TEXT (always `Status.ToString()`); enums are serialized as
  strings in JSON via `JsonStringEnumConverter`.
- JWT authentication, role-based authorization, AES-GCM at-rest secrets.
- Key packages: `Dapper`, `Microsoft.Data.Sqlite`,
  `Microsoft.AspNetCore.Authentication.JwtBearer`,
  `Microsoft.AspNetCore.OpenApi`, `Scalar.AspNetCore`.

### marker-server — `marker-server/` (Python 3.12, FastAPI)
- A thin wrapper around marker's `PdfConverter`. Models load **lazily on the
  first `/convert`** (not at startup) and are kept warm afterwards, so a
  default-OFF or pdfplumber-only deployment never pays the multi-gigabyte load,
  and the container goes healthy immediately.
- `/health` is a liveness probe — it returns `200` as soon as the server is up
  and reports `modelsLoaded`.
- `/convert` returns a block-anchored contract: Markdown where each block is
  preceded by `<a class="blk" data-block="..." data-page="N"></a>`, plus a flat
  `blocks[]` list of `{id, page, bbox, type}`. This powers the PDF↔Markdown
  sync-scroll. It does not return marker's raw `metadata`, which crashes
  FastAPI's JSON encoder.
- `/extract` is the lightweight engine: pdfplumber groups a PDF's text lines into
  paragraph blocks with bounding boxes and emits the **same** contract as
  `/convert` — no ML models touched.
- **Version pins (see [Gotchas](gotchas.md)):** `marker-pdf==1.10.2`,
  `transformers==4.57.3`.

### Frontend — `frontend/` (Vite 8 + React 19 + TypeScript 6)
- **Tailwind v4** (`@tailwindcss/vite`, CSS-first) with shadcn-style design
  tokens in `src/index.css` (purple accent; dark mode via a `.dark` class toggled
  by `ThemeProvider`).
- **Base UI** (`@base-ui/react`) plus `cva`, `lucide-react`, and
  `@radix-ui/react-slot`.
- **@tanstack/react-query** (data), **@microsoft/signalr** (live updates),
  **react-router 7** (routing), **sonner** (toasts), **i18next + react-i18next**
  (internationalization), **react-pdf + react-markdown + remark-gfm + rehype-raw**
  (document viewer).
- Authenticated SPA: login and register pages, an `AuthProvider`, route guards, a
  user menu, password change, and an admin panel.
- `@/` alias maps to `src`. `cn` lives in `@/lib/utils`. Shared primitives live
  in `src/components/common/`.
- Run with `npm run dev`; `npm run build` runs a full `tsc -b` and passes.

## Project layout

```
docker-compose.yml          marker-server + api + web (+ model-cache volume); VPS-safe (CPU caps)
docker-compose.dev.yml      dev stack: Vite HMR + `dotnet watch` hot reload, no caps
docker-compose.marker.yml   standalone marker only (offload target; publishes :8000)
docker-compose.marker.gpu.yml  standalone marker on an AMD GPU via ROCm (experimental)
Makefile                    make up/down/rebuild/logs/ps (injects UID/GID/HOME)
.env.example                WATCH_ROOT, WATCH_SUBDIR, WEB_PORT, API_PORT, OLLAMA_*,
                            MARKER_CPUS/THREADS, CONVERSION_ENGINE, MARKER_REMOTE_URL,
                            JWT_KEY, APP_SECRET_KEY, etc.

marker-server/              app.py (lazy models, /convert + /extract), Dockerfile,
                            Dockerfile.rocm (experimental GPU), requirements.txt

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
                            EnrichmentService, CategorizationService, MarkerHealthMonitor
  Endpoints/                Auth, Documents, Categories, Settings, Secrets,
                            Folders, Ollama, Stats
  Hubs/LiveHub.cs           SignalR push (documentUpdated, ollamaPull)
  Models/                   Document, Category, User, Contracts (marker/LLM DTOs)

frontend/src/
  api/                      typed client per domain over client.ts (auth-aware fetch);
                            apiErrors.ts (error code -> i18n key scaffold)
  providers/                ThemeProvider, AuthProvider
  hooks/                    react-query + useSignalR, useIsMobile, useViewMode, useSyncScroll
  locales/                  i18next setup: i18n.ts, resources.ts, languages.ts +
                            en/ de/ hr/ (one JSON per namespace + index barrel)
  components/{auth,layout,library,ollama,settings,doc,common,ui}/
  pages/                    Login, Register, Library, Document (sync-scroll),
                            AI, Settings, Folders, Categories, Logs
  index.css                Tailwind import + design tokens + .prose-doc markdown styles
```

## Verification

- Backend: `dotnet build PdfParser.Api -c Release`, redeploy with
  `docker compose up -d --build --no-deps api`.
- Frontend: `npm run build` (full typecheck).
- End to end through the proxy: `curl localhost:16669/api/...` (production) or
  `localhost:5173/api/...` (dev). Authenticated routes require a bearer token
  from `/api/auth/login`.
- Conversion engine: `GET /api/conversion/status` reports the active engine and
  marker reachability. For a standalone/offload marker, confirm it from the api
  host with `curl http://<marker-host>:8000/health`.
- GPU marker: `docker compose -f docker-compose.marker.gpu.yml logs -f` during a
  convert — the surya steps run on the GPU and the "experimental attention"
  warnings disappear once `TORCH_ROCM_AOTRITON_ENABLE_EXPERIMENTAL=1` is active.

## Conventions

- **Backend:** Dapper + raw SQL, status as TEXT, endpoints thin (logic in
  Services/Repositories).
- **Frontend:** ~300-line files, Tailwind + `Button` + `components/common/`
  primitives, react-query hooks per domain, verify with `npm run build` (full
  typecheck).
