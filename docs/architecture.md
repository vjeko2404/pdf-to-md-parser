# Architecture

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

The whole stack runs with a single `docker compose up -d` and is made of three
containers plus the host Ollama:

- **`marker-server`** (Python/FastAPI) — the ML "swamp": torch + marker + surya,
  sealed behind one HTTP endpoint. Internal only, never exposed to the host.
- **`api`** (.NET 10) — the control plane: the folder watcher, the SQLite ledger,
  the processing pipeline, REST + SignalR, JWT auth and multi-tenancy. The only
  container that talks to everything else.
- **`web`** (nginx) — serves the built SPA and proxies `/api` + `/hub` to the
  api. The single public entry point.
- **Ollama** — stays on the host (not containerized), reached via
  `host.docker.internal`.

## The pipeline

```
watch (or upload)
  -> size-stable debounce        (defeat half-written downloads)
  -> sha256 dedup                (never convert the same file twice)
  -> convert (selected engine)   (marker-host / marker-remote / pdfplumber)
  -> write md + images + blocks.json
  -> archive original
  -> commit (Done)
  -> [optional] enrich + auto-categorize
```

The conversion step dispatches to the user's selected engine, and **every engine
returns the same block-anchored contract**, so the rest of the pipeline (and the
sync-scroll viewer) is identical regardless of engine. When the engine is a
marker server that is currently unreachable, the document is not failed — it is
held `Queued`, re-checked on a short interval, and converts automatically once
the server returns (see [Conversion engines](conversion-engines.md)).

**Enrichment is decoupled from conversion:** a slow or broken LLM never blocks or
fails a conversion. A bad PDF is marked `Failed` and left in place (retryable),
and the worker never dies.

## Why the boundaries are where they are

The torch/ML dependencies are sealed inside `marker-server` — the .NET container
never imports torch. Ollama stays on the host, where its Vulkan setup already
works. The `web` nginx is the only public entry point. See
[Gotchas and design decisions](gotchas.md) for the reasoning behind each pin and
boundary.
