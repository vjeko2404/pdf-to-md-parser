# User guide — how to use the app

A friendly, click-by-click walkthrough of everyday use. For setup and
configuration, see the [README](../README.md) and the other docs; this page is
about *using* the running app.

> Open the app at **http://localhost:16669** (or your domain if deployed behind
> a reverse proxy).

---

## 1. Create your account

The very first time the app runs, the login screen offers **Register**.

1. Pick the language in the top-right selector if you don't want English.
2. Register a username and password. The password needs at least **8
   characters**, with an uppercase letter, a digit and a symbol — a strength
   meter guides you.
3. **The first account becomes the administrator.** After that, you (as admin)
   can turn self-registration off so nobody else can sign up. See
   [Authentication](authentication.md).

Log in and you land on the **Library**.

---

## 2. Turn on a conversion engine (one-time)

Out of the box the app converts **nothing** — this is deliberate, so a fresh
install never downloads marker's multi-gigabyte models before you ask it to.

Go to **Settings → Conversion engine** and pick one:

- **pdfplumber** — instant, lightweight, no downloads. Great for normal
  "born-digital" PDFs (anything you can already select text in). No OCR.
- **Marker — on this server** — best quality (OCR, tables, layout, equations),
  but downloads several GB of models on first use and is CPU-heavy.
- **Marker — off this server** — use a marker running on another machine.

If you're not sure, start with **pdfplumber** — it works immediately. You can
switch any time. Full comparison: [Conversion engines](conversion-engines.md).

---

## 3. Get PDFs into the app

There are two ways, and you can mix them freely:

**A) Drag-and-drop.** On the **Library** page, drag PDF files anywhere onto the
window (or use the upload button). They upload and start converting right away.

**B) Watched folder.** The app watches one folder on your computer and picks up
any PDF that lands there automatically — for example, your browser's
**Downloads** folder. Whenever you save a PDF there, it gets converted without
you lifting a finger.

- Choose which folder to watch in **Folders** (or **Settings → Watched
  folder**). It's a live setting — change it whenever you like.
- The app waits a couple of seconds for the file to finish writing (so a
  half-downloaded `.crdownload` isn't grabbed early), then converts it.

---

## 4. Watch it process

Each document moves through a few states, updating **live** (no refresh needed):

| State | Meaning |
|-------|---------|
| **Queued** | Waiting its turn (or waiting for an off-server marker to come back online). |
| **Processing** | Being converted to Markdown right now. |
| **Done** | Converted. Click it to open. |
| **Failed** | Something went wrong (e.g. a corrupt PDF). The original is kept — hit **Retry**. |

Duplicate files (same content) are detected automatically and not converted twice.

---

## 5. Read a document (the sync-scroll viewer)

Click any **Done** document to open the detail view. You get the **original PDF
on one side and the clean Markdown on the other**, and they **scroll together** —
scroll the PDF and the Markdown follows to the matching place, and vice versa.
This is the heart of the app: read the nice Markdown while keeping the original
page in view.

From here you can also:

- **Edit tags** by hand.
- **View the timeline** of everything that happened to the document.
- **Download** the original PDF.

---

## 6. Organise with categories

Open **Categories** to build your own taxonomy (e.g. *Invoices*, *Manuals*,
*Receipts*). You can:

- Create, rename and delete categories.
- Assign documents to categories yourself, **or**
- Let the LLM **auto-categorize** them (needs an LLM provider configured —
  see step 8).

Back on the **Library**, filter by category, status, tag, type, language or date,
and use the search box for full-text search across all your Markdown.

---

## 7. Find things (search & filter)

The **Library** search box does **full-text search** over the converted Markdown
and tags. Combine it with the filter chips (status, category, tags, document
type, language, date range) to narrow down. Switch between **grid** and **table**
views with the toggle, and select several documents at once for batch actions
(e.g. enrich or delete).

---

## 8. Optional: AI enrichment

If you connect a language model, the app can **summarize**, **tag** and
**auto-categorize** documents automatically after conversion.

Two ways to provide a model (**Settings → LLM provider**):

- **Ollama** — a local model running on your own machine. Free and private.
  Needs Ollama installed and reachable (see [Gotchas](gotchas.md)). Manage
  models from the **AI** page (pull/list/remove, with live progress).
- **OpenAI-compatible API** — OpenRouter, Gemini, or any service speaking the
  OpenAI chat protocol. Paste your API key (stored **encrypted**) and pick a
  model.

Use the **Test** button to confirm the provider responds. Enrichment runs in the
background and never blocks or breaks a conversion — if the model is slow or
offline, the document still converts fine and can be enriched later. Tune the
prompts and toggles (auto-enrich, auto-categorize) in **Settings**. Details:
[LLM providers](llm-providers.md).

---

## 9. Settings, language and account

- **Settings** — conversion engine, LLM provider, watched folder, prompts,
  debounce, and (for admins) the registration toggle and user management.
- **Settings → Language** — switch the UI between **English, German and
  Croatian**; your choice is saved to your account and follows you everywhere.
- **Logs** — a live activity feed, handy when something looks stuck.

---

## Quick troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| "Pick an engine" message, nothing converts | Conversion is still **Off** — choose an engine in **Settings → Conversion engine**. |
| Uploads rejected with a 409 | Same as above — engine is Off. |
| Document stuck in **Queued** | Using *Marker — off this server* and that server is unreachable; it auto-resumes when the server is back. |
| Scanned PDF comes out empty | You're on **pdfplumber** (text-layer only). Switch to a **marker** engine for OCR. |
| Enrichment/summaries do nothing | No LLM provider configured, or Ollama is offline — see [LLM providers](llm-providers.md) and [Gotchas](gotchas.md). |
| First marker conversion takes ages | It's downloading several GB of models once; later conversions are fast. |
