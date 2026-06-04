# PDF → Markdown Parser

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Claude](https://img.shields.io/badge/built%20with-Claude%20Opus%204.8-8A63D2.svg)](https://claude.com/claude-code)
[![Donate](https://img.shields.io/badge/Donate-PayPal-00457C.svg?logo=paypal)](https://www.paypal.com/donate/?business=paypal@v-direkt.de)

> **Where this came from.** This whole project was sparked by a single post on
> the Croatian [pcekspert](https://forum.pcekspert.com) forum, by one brilliant
> (and pleasantly cocky 😄) member writing about self-hosted LLMs. That one post
> was all the inspiration I needed to build this. Thank you — credit where it's
> due: [the post that started it all](https://forum.pcekspert.com/threads/self-hosted-llm-ovi.325076/post-3854024).

A self-hosted app that **watches a folder for new PDFs** (or accepts
drag-and-drop uploads), converts them to **clean Markdown**, optionally enriches
them with **AI tags, summaries and categories**, archives the originals, and
serves a searchable dashboard with a **PDF ↔ Markdown sync-scroll viewer**.

The whole stack runs with a single `docker compose up -d`. It is multi-user
(per-user data isolation + JWT auth), so it works equally well on localhost for
personal use or behind a reverse proxy on a VPS. The interface is fully localized
in **English, German and Croatian**.

<!-- SCREENSHOT PLACEHOLDER — replace with your own shot (see docs/screenshots/) -->
![Screenshot of the app](docs/screenshots/app.png)

---

## Highlights

- 📂 **Folder watcher + drag-and-drop** — save a PDF to your Downloads folder and
  it converts automatically; or drop files onto the dashboard.
- 🔁 **Selectable conversion engine** — full [marker](https://github.com/datalab-to/marker)
  + [surya](https://github.com/datalab-to/surya) (locally, on a GPU, or on another
  machine), or a lightweight [pdfplumber](https://github.com/jsvine/pdfplumber)
  text extractor.
- 🪟 **PDF ↔ Markdown sync-scroll** — read the clean Markdown with the original
  page tracking alongside.
- 🤖 **Optional AI enrichment** — tags, summaries and auto-categorization via a
  local [Ollama](https://ollama.com) model or any OpenAI-compatible API.
- 🔎 **Full-text search + filters** — FTS5 search, categories, tags, type,
  language and date filters; grid and table views; batch actions.
- 🔐 **Multi-user** — JWT auth, per-user isolation, encrypted-at-rest API keys.
- 🌍 **Localized** — English, German and Croatian, switchable live.

---

## Quick start

```bash
cp .env.example .env          # adjust WATCH_ROOT / WATCH_SUBDIR if needed
make up                       # docker compose up -d --build, injecting UID/GID/WATCH_ROOT
# open http://localhost:16669
```

- The **first account to register becomes the administrator** and can then close
  self-registration.
- **Conversion is OFF by default** — pick an engine in **Settings → Conversion
  engine** before anything is converted (this avoids downloading marker's
  multi-gigabyte models until you actually want them). Start with **pdfplumber**
  for instant, no-download conversion of normal PDFs.

New to the app? Read the **[User guide](docs/user-guide.md)** — a friendly,
step-by-step walkthrough of everyday use.

### Ports

| Port | Service | Purpose |
|------|---------|---------|
| **16669** | `web` (nginx) | The application — open this. Serves the SPA and proxies `/api` + `/hub`. (Port 6669 is avoided: it's an IRC port browsers block as unsafe.) |
| 6670 | `api` (.NET) | Direct REST API + Scalar explorer at `/scalar`. The SPA doesn't need it. |
| (internal) | `marker-server` | Python/FastAPI conversion service, never exposed to the host. |
| 11434 | Ollama | Runs on the host (not containerized). |

---

## Documentation

| Doc | What's inside |
|-----|---------------|
| **[User guide](docs/user-guide.md)** | Friendly, click-by-click walkthrough of using the app |
| [Architecture](docs/architecture.md) | The three containers, the pipeline, and why the boundaries are where they are |
| [Conversion engines](docs/conversion-engines.md) | Off / marker-on / marker-off / pdfplumber, and offloading marker to another machine |
| [LLM providers](docs/llm-providers.md) | Ollama vs OpenAI-compatible APIs; enrichment, summaries, auto-categorize |
| [Authentication & secrets](docs/authentication.md) | JWT auth, multi-tenancy, roles, AES-GCM secrets |
| [Internationalization](docs/internationalization.md) | EN/DE/HR, per-user language, how to add a language |
| [Configuration](docs/configuration.md) | Every environment variable and where settings live |
| [Deployment](docs/deployment.md) | Running on a VPS: TLS, keys, persistence, sizing marker |
| [API reference](docs/api-reference.md) | Every REST route and the SignalR hub |
| [Development](docs/development.md) | Dev loops, stack, project layout, verification |
| [Gotchas & design decisions](docs/gotchas.md) | Version pins, host Ollama, AMD GPU/ROCm, lazy models |

---

## Tested on / needs more testing

This was developed and exercised on **Arch Linux** with an **AMD GPU**
(gfx1201 / RDNA4). The Dockerized stack is platform-independent in principle, but
two areas have had **less testing** and may need attention:

- **Ollama** — the local LLM path (host Ollama, model management on the **AI**
  page, enrichment/auto-categorize) was tested primarily through Vulkan on AMD.
  Behaviour with other Ollama backends, versions or GPUs may differ. The cloud
  **OpenAI-compatible** provider is the reliable fallback if Ollama misbehaves.
- **Windows / macOS** — development was on Linux. The stack should run under
  **Docker Desktop**, but host-folder bind mounts, file ownership and
  `host.docker.internal` → host-Ollama reachability haven't been verified there.
- **NVIDIA GPUs** — only an **AMD ROCm** GPU path is shipped (experimental, opt-in);
  CUDA/NVIDIA is untested. CPU conversion is the reliable default everywhere.

Feedback and PRs for these are very welcome.

---

## Acknowledgements

This project stands on excellent open-source work:

- **[marker](https://github.com/datalab-to/marker)** & **[surya](https://github.com/datalab-to/surya)**
  (Datalab) — the high-quality PDF→Markdown conversion and OCR/layout models at
  the core of the marker engines.
- **[pdfplumber](https://github.com/jsvine/pdfplumber)** (Jeremy Singer-Vine) —
  the lightweight text-layer extraction engine (pulls in `pdfminer.six` + Pillow).
- **[shadcn/ui](https://ui.shadcn.com)** — the design-token approach and the
  copied-and-owned `Button` component pattern.
- **[Base UI](https://base-ui.com)**, **[Radix](https://www.radix-ui.com)
  (`react-slot`)**, **[lucide](https://lucide.dev)** icons, and
  **[Tailwind CSS](https://tailwindcss.com)** — UI primitives and styling.
- **[i18next](https://www.i18next.com) / react-i18next** — internationalization.
- **[TanStack Query & Table](https://tanstack.com)**, **[react-router](https://reactrouter.com)**,
  **[react-pdf](https://github.com/wojtekmaj/react-pdf)**,
  **[react-markdown](https://github.com/remarkjs/react-markdown)** +
  **remark-gfm** / **rehype-raw**, **[sonner](https://sonner.emilkowal.ski)**,
  **[SignalR](https://github.com/dotnet/aspnetcore)** — the SPA's data, routing,
  document viewer and live updates.
- **[Dapper](https://github.com/DapperLib/Dapper)**,
  **[Scalar](https://github.com/scalar/scalar)**, and **SQLite/FTS5** — the
  backend data and API tooling.

Licenses for these remain with their respective authors.

> 🤖 This application was built with the help of **Claude Opus 4.8** (Anthropic).

---

## License

Released under the **[MIT License](LICENSE)**.

---

## Support / Donate

If this saved you time and you'd like to say thanks, you can send a small
donation via PayPal to **paypal@v-direkt.de**:

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-00457C.svg?logo=paypal)](https://www.paypal.com/donate/?business=paypal@v-direkt.de)

It's entirely optional and always appreciated. ❤️
