# API reference

Authentication routes live under `/api/auth`. Everything else under `/api`
requires a bearer token (the fallback authorization policy). Admin-only routes
add their own policy. A Scalar API explorer is served at `/scalar` on the api
port (default `6670`).

## Auth (`/api/auth`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/register` | create an account (first user becomes admin) |
| POST | `/login` | obtain a bearer token |
| GET | `/registration` | whether self-registration is currently open |
| GET | `/me` | current user info |
| POST | `/change-password` | change your own password |
| PATCH | `/language` | set your preferred UI language (persisted to your profile) |
| PATCH | `/registration` | toggle self-registration (admin) |
| GET | `/users` | list users (admin) |
| PATCH | `/users/{id}/active` | enable or disable an account (admin) |

## Application (`/api`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/documents?q=&status=&tag(s)=&docType=&language=&dateFrom=&dateTo=&categoryId=&sort=` | search and filters (FTS5 when `q`) |
| GET | `/documents/{id}` · `/markdown` · `/blocks` · `/pdf` · `/events` | detail, rendered MD, sync-scroll map, original PDF, timeline |
| POST | `/documents/upload` (multipart) | drag-and-drop upload |
| POST | `/documents/{id}/retry` · `/reenrich` · `/enrich {ids[]}` | requeue, single enrich, batch enrich |
| PATCH | `/documents/{id}/tags {tags[]}` | manual tag editing (replaces tags, syncs the FTS tags column) |
| DELETE / POST | `/documents/{id}` · `/documents/delete {ids[]}` | delete one / batch (removes the row, FTS entry, events, category links, markdown dir + images, blocks.json, archived PDF) |
| GET/POST/PATCH/DELETE | `/categories` (+ `/documents/{id}/categories`, `/auto`) | taxonomy CRUD, assign/unassign, LLM auto-categorize |
| GET/PATCH | `/settings` (+ `/settings/llm-test`, `/settings/llm-models`, `/settings/marker-test?url=`) | per-user live settings; `llm-test`/`llm-models` for the LLM provider, `marker-test` probes a marker server URL |
| GET/PUT/DELETE | `/secrets` (+ `/{key}/reveal`) | encrypted-at-rest secrets, masked list |
| GET/POST/DELETE | `/ollama/status` · `/models` · `/ps` · `/pull` · `/models/{name}` | Ollama management (pull streams progress over SignalR `ollamaPull`) |
| GET | `/folders/browse?sub=` | sandboxed host folder browser (under WATCH_ROOT) |
| GET | `/stats` · `/events` · `/facets` · `/health` · `/conversion/status` | dashboard widgets; `conversion/status` = active engine + live marker reachability |
| HUB | `/hub/live` | SignalR: `documentUpdated`, `ollamaPull` |
