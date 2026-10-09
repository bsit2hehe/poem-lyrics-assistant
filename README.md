# Verse — AI Poem & Lyrics Assistant

Static frontend (`public/`) + one Netlify Function (`netlify/functions/generate.js`)
that calls the **Google Gemini API** (free tier, no credit card). The API key stays
server-side as a Netlify environment variable.

## Run locally (VS Code)
1. Get a free key at https://aistudio.google.com/apikey
2. `cp .env.example .env` and paste your key into `GEMINI_API_KEY`
3. `npx netlify-cli dev` → open http://localhost:8888

## Deploy
1. Push to GitHub.
2. Netlify → Add new site → Import from Git → pick the repo (settings are read from `netlify.toml`).
3. Site configuration → Environment variables → add `GEMINI_API_KEY`.
4. Trigger a redeploy.

## Notes
- Model list lives in `generate.js`; it tries `gemini-flash-latest` first and falls back if a name is retired. Override with `GEMINI_MODEL`.
- Free-tier quotas are per project and can change; check https://aistudio.google.com/rate-limit.
