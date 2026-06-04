# Internationalization (i18n)

The UI ships in **English, German and Croatian**, switchable live. Translations
use [i18next](https://www.i18next.com/) + react-i18next, with one JSON file per
domain (namespace) under `frontend/src/locales/<lang>/` and an index barrel per
language. `en` is the canonical base, and any missing key falls back to it.

- **Per-user default.** The chosen language is saved to the user's profile
  (`users.DefaultLanguage`, default `en`) via `PATCH /api/auth/language`, so it
  follows the account across logins and devices. Set it in **Settings →
  Language**.
- **Pre-auth switch.** The login and register screens carry a top-right language
  selector that persists to `localStorage` only (no account needed yet).
- **Plurals.** Count-based strings use CLDR plural rules — Croatian gets the full
  one/few/other forms; English and German use one/other.

## Adding a language

1. Copy `frontend/src/locales/en/` to `frontend/src/locales/<code>/`.
2. Translate the values (the keys stay identical).
3. Register the folder in `locales/resources.ts`.
4. Add the code to `SUPPORTED` in `locales/languages.ts`.

## Known limitation

API error messages are currently returned in English. The frontend has a
codes-to-keys scaffold (`api/apiErrors.ts` plus an `apiErrors` namespace) ready
to localize them once the backend attaches stable error codes — that backend
work is the only i18n piece remaining.
