# LLM providers (enrichment, summaries, auto-categorize)

Enrichment, summarization and auto-categorization route through a single
`LlmService` that selects a provider per the live `llmProvider` setting:

- **Ollama** — local models over the host Ollama instance (Vulkan on gfx1201).
  Free and private; needs Ollama installed and reachable from the container
  (see [Gotchas](gotchas.md)).
- **OpenAI-compatible API** — OpenRouter, Gemini, and any other endpoint that
  speaks the OpenAI chat-completions protocol. The API key is read by name from
  the encrypted per-user secrets store.

Switching providers is instant and takes effect on the next request. The
Settings page can test the active provider (`/settings/llm-test`) and list its
available models (`/settings/llm-models`).

## What enrichment does

After a document converts (and only optionally — it's decoupled and can be
turned off), the configured model can:

- **Summarize** the document.
- **Generate tags**.
- **Auto-categorize** it into your taxonomy (see
  [the user guide](user-guide.md) and the **Categories** page).

The prompts (`enrichPrompt`, `summaryPrompt`) and toggles (`autoEnrich`,
`enrichmentEnabled`, `autoCategorize`) are all live settings, editable per user.

## Managing Ollama models

The **AI** page (route `/ai`) is a front-end for the host Ollama: check status,
list running and installed models, pull a new model (progress streams live over
SignalR), and remove models. The default model is seeded from `OLLAMA_MODEL`
(`qwen2.5:7b-instruct`) and editable in Settings.

> If the host Ollama is unavailable, switch the provider to an OpenAI-compatible
> API to keep enrichment, summaries and auto-categorization working. See the
> Ollama gotcha in [Gotchas](gotchas.md).

## Secrets

Per-user LLM API keys are stored **encrypted at rest** (AES-GCM) and never
returned in plaintext by the listing endpoint (masked). The OpenAI-compatible
provider reads its key by name (`openaiApiKeyName`, default `LLM_API_KEY`). See
[Authentication and secrets](authentication.md).
