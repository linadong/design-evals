# Design Evals

A design research workbench for turning page evidence into proposals covering product, interaction, and visual design. Built by Lina Dong.

Live beta: https://linadong.design/lab/design-evals-beta

## Features

- Browse a screenshot-based LinkModel sample without an access code.
- Start research from a company URL; enter a test code when beginning real research.
- Collect public page text and draft company context for human correction.
- Upload screenshots and select up to three pages for design analysis.
- Review suggestions, edit proposals, and export HTML / Markdown or print to PDF.
- Request a test code by email; optional private Vercel Blob storage saves applications for manual review.
- Projects stay in browser localStorage. Back them up before clearing browser data.

## Run locally

Requires Node.js 24 or later.

```sh
npm ci
cp .env.example .env
npm run create-access
# Copy the generated configuration into .env, and add your own model key.
npm run dev
```

Open http://localhost:4317. The homepage and sample are public; research endpoints require a configured access code. Credentials belong only in `.env` or hosting environment variables. The generator prints new credentials locally; do not commit its output.

```sh
npm run check
npm run build
```

## Deploy on Vercel

Import this repository. The included `vercel.json` serves `public/` and routes research requests to a Node function. Set your own `AI_PROVIDER`, provider API key/model, `DESIGN_EVALS_BETA_CODES` (JSON containing IDs and SHA-256 hashes), and a random `DESIGN_EVALS_SESSION_SECRET` of at least 32 characters in Vercel environment settings. Use Node 24.

For email applications, connect a **private** Vercel Blob store and configure `BLOB_STORE_ID` with Vercel OIDC, or a server-only `BLOB_READ_WRITE_TOKEN`. Without storage configuration the request form reports a save failure. It does not send emails or automatically grant access. A code authorizes an eight-hour HttpOnly session; removing its hash revokes it.

## Source layout

- `public/`: frontend modules, styles, and public sample images.
- `backend/`: page collection, model adapters, screenshot integration.
- `server/`: code/session checks, email request persistence, HTTP adapter.
- `api/`: Vercel function entry.
- `tests/`: model, research, and access-control tests with fake credentials.

## Current limits

AI outputs are drafts requiring human review. Image analysis needs a vision-capable provider/model. Automatic screenshots need a separately configured screenshot service; manual upload is available. Rate limiting and task concurrency guards are process-local, not a distributed spending quota. Design theory citations and broader quality evaluation remain in development.

No production API keys, access codes, session secrets, deployment credentials, applicant emails, or private project exports are included. `.env.example` contains configuration names and empty placeholders only.
