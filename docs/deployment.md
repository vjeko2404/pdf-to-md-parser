# Deployment

The application is built for `docker compose up -d` on a single host. The same
compose stack runs unchanged on a VPS; the differences are all about exposure,
secrets and persistence.

> **Tested on Arch Linux.** Development and testing were done on Arch Linux with
> an AMD GPU. Deployment on **Windows** and **macOS** is expected to work via
> Docker Desktop but has had less testing — see the
> [README testing note](../README.md#tested-on--needs-more-testing).

## 1. Set the security keys

Never run a publicly reachable instance on the generated vault keyfiles. In the
server's `.env`, set both:

```bash
JWT_KEY=$(openssl rand -base64 48)
APP_SECRET_KEY=$(openssl rand -base64 48)
```

`JWT_KEY` signs login tokens (anyone who knows it can mint valid tokens);
`APP_SECRET_KEY` encrypts the at-rest LLM API keys. Keep `.env` out of git (it is
already gitignored). See [Authentication and secrets](authentication.md).

## 2. Put TLS in front of the web container

Only the `web` container needs to be reachable. It listens on port 80 inside the
container, published to `WEB_PORT` (default 16669) on the host. Terminate TLS in
front of it with one of:

- **A reverse proxy** (Caddy, nginx, Traefik) on the host, proxying
  `https://your-domain` to `127.0.0.1:16669`. Forward WebSocket upgrades so
  SignalR (`/hub/`) keeps working.
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

## 3. Bootstrap the admin, then close registration

The first account to register becomes the administrator. Register it immediately
after the stack is up, then turn off self-registration from **Settings → Admin**
(or `PATCH /api/auth/registration {"enabled": false}`) so the instance is not
open to the public. The admin can re-enable it or disable individual accounts
later. See [Authentication](authentication.md).

## 4. Persist the vault and model cache

- **`VAULT_DIR`** (default `./vault`) holds the SQLite index, Markdown output,
  archived PDFs, and the generated keyfiles when `JWT_KEY` / `APP_SECRET_KEY` are
  unset. Back it up; losing it loses all documents and user accounts. If you rely
  on a generated `vault/.jwtkey`, wiping the vault invalidates every issued token
  — another reason to set the keys explicitly.
- The **`model-cache`** named volume holds the marker/surya weights (several GB).
  Keep it to avoid re-downloading on every rebuild.

## 5. The watched folder on a server

`WATCH_ROOT` defaults to the host `$HOME` and the watched path is
`/host/<WATCH_SUBDIR>`. On a headless server there may be no "Downloads" folder
to watch; either point `WATCH_SUBDIR` at a real ingestion directory or rely on
drag-and-drop uploads through the dashboard. The `api` container runs as the host
UID/GID (`make up` injects them) so written files stay owned by the deploying user.

## 6. Pick a conversion engine (and size marker)

Conversion is **OFF** until you choose an engine in **Settings → Conversion
engine** (or seed it with `CONVERSION_ENGINE`). On a small server you have three
realistic options:

- **pdfplumber** — light and instant, no models. Fine if your PDFs are
  born-digital (have a real text layer).
- **marker — off this server** — keep the VPS light and run marker on a beefier
  machine; see [Conversion engines](conversion-engines.md). This is the
  recommended setup for a constrained VPS.
- **marker — on this server** — only if the box has the headroom. The committed
  `docker-compose.yml` caps the marker container at `MARKER_CPUS` cores /
  `MARKER_THREADS` threads (defaults suit a 4-core VPS); a roomy workstation can
  run `docker-compose.dev.yml` (no caps) instead.

> **Swap matters for on-server marker.** Loading the surya models spikes to
> several GB. On a small VPS with little or no swap the kernel can OOM-kill
> marker mid-load (exit 137). Add swap (e.g. an 8 GB swapfile) if you run marker
> on the server. Lazy loading means it's only paid on the first conversion, but
> the spike is real. Offloading marker (option two) sidesteps this entirely.
