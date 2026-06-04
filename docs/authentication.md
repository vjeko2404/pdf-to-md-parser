# Authentication, multi-tenancy and secrets

The app supports multiple users with **per-user data isolation** and **JWT
authentication**, so it can run on localhost for personal use or behind a reverse
proxy on a VPS.

## Authentication and roles

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

## At-rest secrets

Per-user LLM API keys are encrypted with **AES-GCM**. The master key is
`App:SecretKey` (set `APP_SECRET_KEY` in production) or a vault keyfile
(`vault/.secretkey`). The secrets listing endpoint returns masked values only.

## Production keys

Set strong random values for `JWT_KEY` and `APP_SECRET_KEY` on any publicly
reachable deployment — never run on the generated vault keyfiles in production:

```bash
JWT_KEY=$(openssl rand -base64 48)
APP_SECRET_KEY=$(openssl rand -base64 48)
```

`JWT_KEY` signs login tokens (anyone who knows it can mint valid tokens);
`APP_SECRET_KEY` encrypts the at-rest LLM API keys. Keep `.env` out of git (it is
already gitignored). See [Deployment](deployment.md) for the full checklist.

> **Authenticated PDF fetch.** The document viewer fetches the protected `/pdf`
> endpoint as an authenticated **blob** and renders it from an object URL — a
> bare URL can't carry the bearer token, so a plain PDF.js/iframe/download would
> otherwise hit `401`.
