# 📡 Property Check API Reference

Base URL: `https://property-check.com/api` (local dev: `http://localhost:3001/api`)

- All POST bodies are JSON, global size limit **100 MB**.
- Errors are JSON: `{ "error": "...", "details": "..." }` with HTTP 4xx/5xx.
- AI endpoints internally call Claude: a cheap model validates the document, `claude-opus-5-5` extracts/analyzes. Expect 5–60 s response times.

---

## GET `/health`
```json
{ "status": "ok", "message": "Server is running" }
```

## POST `/register`
Request: `{ "email": "...", "password": "...", "name": "..." }`
Response: `{ "token": "<JWT, 30 days>", "user": { "id", "email", "name", "plan" } }`
Users are stored in `users.json` (passwords hashed with bcrypt).

## POST `/login`
Request: `{ "email": "...", "password": "..." }` → same response as `/register`.
`401` on wrong credentials.

## GET `/me`
Header: `Authorization: Bearer <token>` → `{ "user": { "id", "email", "name", "plan", "analysisCount" } }`, `401` if the token is unknown, expired or issued before a password change.

## POST `/forgot-password`
Request: `{ "email": "..." }` → always `200 { "success": true }`, so the answer cannot be used to check whether an email is registered.
There is no email provider on the beta yet, so the response also carries the link: `{ "success": true, "resetToken": "<64 hex>", "resetExpiresAt": "<ISO>" }`.
Set `RESET_TOKEN_IN_RESPONSE=0` in `.env` to hide it once emails are wired up.
Rate limit: 20 requests / 15 min per IP (counter is shared with `/reset-password`).

## POST `/reset-password`
Request: `{ "token": "<resetToken>", "password": "<6+ chars>" }` → `{ "success": true }`.
`400` if the token is unknown, older than 1 hour, already used, or the password is too short.
`users.json` stores only the SHA-256 of the token. Changing the password invalidates every JWT issued before it
(the `pwdAt` claim must equal `passwordChangedAt`), so other devices have to sign in again.
Frontend link format: `https://property-check.com/#reset/<resetToken>` — it opens the sign-in modal on the "new password" step.

## POST `/analyze`
Free-form AI analysis (investment questions, comparisons, market info).
Request: `{ "prompt": "Is Palm Jumeirah a good investment?", "webSearch": true }`
Response: `{ "content": "<AI answer text>" }`

`webSearch: true` (the frontend sends it for every analysis mode) enables Claude's
built-in `web_search` tool — up to `WEB_SEARCH_MAX_USES` searches (default 5) — so the
answer uses live prices/news instead of the model's training data. Both `/analyze` and
`/analyze/stream` send a shared analyst `system` prompt that fixes today's date, tells the
model to search for time-sensitive numbers and forbids "my data ends at <cutoff>" disclaimers.

## POST `/parse-property`
Main endpoint: parse **one or several PDFs** about the same property into one card.
Request:
```json
{ "files": [ { "pdfBase64": "<base64>", "fileName": "SPA.pdf" } ] }
```
Response:
```json
{ "success": true, "filesProcessed": 1,
  "property": {
    "name": "Olaia Residences Unit 917",
    "location": "Palm Jumeirah, Dubai",
    "type": "2BR Apartment",
    "price": 2171289,
    "size": 1150,
    "completion": "Q4 2027",
    "developer": "Danube",
    "paymentPlan": "60/40",
    "view": null, "floor": null,
    "bedrooms": 2, "bathrooms": null, "parking": null,
    "amenities": null,
    "buyerName": null, "bookingDate": null,
    "additionalInfo": "..."
  } }
```
`400` if the document is not real-estate related.

## POST `/parse-text`
Same property-card extraction but from plain text.
Request: `{ "text": "2BR apartment for sale in ..." }`
Response: `{ "success": true, "property": { ... } }`

## POST `/assess-risk`
Request: `{ "property": { ...property card... }, "language": "ru" }` (language optional, default `en`)
Response:
```json
{ "success": true, "risk": {
    "overallRisk": 42,
    "factors": {
      "developer": { "score": 30, "reason": "..." },
      "timeline":  { "score": 50, "reason": "..." },
      "price":     { "score": 45, "reason": "..." },
      "location":  { "score": 25, "reason": "..." },
      "liquidity": { "score": 60, "reason": "..." }
    },
    "summary": "...",
    "recommendations": ["...", "...", "..."]
} }
```

## POST `/correct-property`
Apply a natural-language correction to a parsed property.
Request: `{ "property": { ... }, "correction": "the price is actually 2.4M" }`
Response:
```json
{ "success": true, "correction": {
    "updates": { "price": 2400000 },
    "explanation": "...",
    "affectsRisk": true,
    "fieldsChanged": ["price"]
} }
```

---

## Revision v2 (hardening)

- Rate limits: all `/api/*` — 60 req/min per IP; AI endpoints — 20 req/min per IP (`429` + JSON error).
- Server-side quota: anonymous users get `FREE_ANALYSIS_LIMIT` (default 3) analyses per IP on `/api/analyze`. Exceeded → `403 { quotaExceeded: true }`.
- Requests with `Authorization: Bearer <jwt>` bypass the quota; `analysisCount` is tracked server-side.
- `POST /api/analyze` accepts `webSearch: true` — enables Claude built-in web search (used for the "News" analysis; `max_tokens` raised to 4000).
- `POST /api/parse-property` now validates EVERY uploaded PDF (not just the first), rejects non-PDF magic bytes, files > ~15 MB and > 8 files per request.
- `parse-property` / `parse-text` responses include `property.sizeUnits` (`"sqft"` | `"m2"`).
- New `GET /api/quota` — `{ authenticated, used, limit }` for current IP or authenticated user.
- Env: `MODEL_MAIN`, `MODEL_FAST`, `FREE_ANALYSIS_LIMIT` (see `.env.example`) — model IDs no longer require a code change.
- Error mapping now uses Anthropic SDK `error.status` (401/402/429/529) instead of string matching.

---

## Revision v3 (server storage + streaming)

- `GET /api/properties` — server-side property list for the owner (JWT user → `user:<id>`, anonymous → `cid:<X-Client-Id>`). Returns `{ properties: null }` when nothing stored yet.
- `PUT /api/properties` — full-list sync from client (`{ properties: [...] }`, max 300 items, each must have `id`). Stored in `properties.json` (atomic writes; add to backups).
- `POST /api/analyze/stream` — same analysis as `/api/analyze` but Server-Sent Events: `data: {"delta":"..."}` chunks, then `data: {"done":true,...}`; errors arrive as `data: {"error":"..."}`. Rate limit + quota identical.
- Frontend: localStorage remains a cache; list is pulled on load/login and pushed with 1.2 s debounce. Anonymous browser data migrates to the server on first visit (keyed by generated `pc_client_id`).
- CI: GitHub Actions (`node --check` + frontend build) runs on every push to main.

---

## Revision v3.1 (live data in analyses)

- Every analysis mode (Overview / News / Growth / Risks / Areas / Timeline / custom question) now sends `webSearch: true`, so Claude runs its built-in `web_search` tool instead of answering from training weights.
- Shared `system` prompt (`analystSystem()` in `server.js`) is sent with both `/analyze` and `/analyze/stream`: pins today's date, instructs the model to search for time-sensitive numbers, forbids "my data goes up to mid-2025" style disclaimers, and requires source + date next to searched numbers.
- `max_uses` is configurable via `WEB_SEARCH_MAX_USES` (default 5, was hardcoded 3 and News-only); `max_tokens` with search raised to 6000 on both endpoints.
- Left-side panels (property card from PDF, Risk Score, corrections) are still non-streamed — they return structured JSON, not prose.
- Cost note: web search is billed by Anthropic separately (~$10 / 1000 searches) and adds a few seconds before the first streamed token; quota accounting is unchanged (quota is consumed only when the stream completes).

---

## Revision v3.2 (UX fixes + saved analyses)

Navigation and UI:
- Landing/app switching is hash based: app = `#app`, landing = `#landing`; browser Back/Forward works, logged-in users without a hash still land in the app. The app header has a "Back to site" button.
- Analysis can be cancelled while streaming ("Stop" button → `AbortController`; the server sees the closed connection and stops generating). Partially generated text is kept and saved.
- All modals (add property / auth / correction / legal) close by `Esc` and by clicking the backdrop. Landing: mobile menu closes on link click, footer Privacy/Terms open a real modal, Contact is a `mailto:` link.
- Missing translations fall back to English instead of rendering the key path.

Analysis output and storage:
- The Results panel renders the model's markdown (`MarkdownLite.jsx`, no new dependencies): headings, bold/italic/inline code, nested lists, tables, blockquotes, rules, fenced code.
- `/api/assess-risk` runs on `MODEL_FAST` (it only returns one JSON object; response time dropped to ~9 s).
- `GET /api/analyzes` — all saved reports of the owner, `{ analyzes: { "<propertyId>": { "<mode>": { text, question, language, createdAt } } } | null }`. Owner resolution is the same as for properties (JWT → `user:<id>`, anonymous → `cid:<X-Client-Id>`).
- `PUT /api/analyzes` — upsert one report: `{ propertyId, mode, text, question?, language?, createdAt? }`. `mode` matches `^[A-Za-z][A-Za-z0-9_-]{0,19}$` (overview / news / growth / risks / comparison / timeline / custom), `text` ≤ 120 000 chars, max 12 modes per property (oldest dropped). Stored in `analyzes.json` (atomic writes, included in the daily backup).
- `DELETE /api/analyzes/<propertyId>` — drops all reports of a property (called when the property is deleted).
- The client saves a report after a successful stream (or after the user presses Stop), keeps a localStorage copy (`real_estate_analyzes`), and restores the newest saved report of the selected property — previously one global `analysis` state leaked the text of the previously selected property and was lost on reload.
- Results header shows the mode, the saved date and the custom question, plus "Copy" and "Markdown" (download `.md`) buttons.
- Mode buttons (Overview / News / Growth / Risks / Regions / Timeline) no longer hit Claude on every click: if the report of that property and mode is already saved, the button opens it instantly (green dot + saved date on the button, "Saved report" chip in the results header). Regeneration is explicit — the "Regenerate" button next to the results is the only control that spends an analysis for an already generated mode. Switching between modes keeps every report, they are stored per property + mode.

## Revision v3.4 (API smoke tests)

- `tests/smoke.mjs` (npm `test:smoke`) covers health, auth, quota, properties, saved analyses, share links and password reset — ~50 checks, no Claude calls. CI starts `node server.js` with a dummy key on `PORT=3101` and runs the suite against it; it can also be run against production (`SMOKE_DATA_DIR=/var/www/property-check node tests/smoke.mjs`).
- Global `/api` limiter raised from 60 to **120 requests/min per IP** (one page load performs several syncs); AI endpoints keep their own 20/min, because those are the ones that cost money.

## Revision v3.5 (public share links)

A saved report can be published as a link a broker sends to a client — opening it needs no account.

- `POST /api/share` — `{ propertyId, mode }` for the current owner (JWT → `user:<id>`, anonymous → `cid:<X-Client-Id>`). It snapshots the **saved** report: `404` when nothing is saved for that property + mode, `400` on a missing owner or bad mode. Returns `{ success, id, hash: "#a/<id>", reused }`. Calling it again for the same property + mode returns the same `id` with a fresh snapshot, so an already sent link starts showing the new text. Max 100 links per owner.
- `GET /api/share/<id>` — public, no auth: `{ share: { id, title, location, mode, language, question, text, savedAt, views } }`. `title` and `location` come from the property card at snapshot time; `views` increments on every read; unknown or malformed ids give `404`.
- `DELETE /api/share/<id>` — revoke. Only the owner may do it (`403` for anyone else, including another anonymous client); unknown ids are idempotent.
- `DELETE /api/analyzes/<propertyId>` also revokes the links of that property and answers `{ success, revokedShares }`.
- Storage: `shares.json` (atomic writes, included in the daily backup) keeps a **snapshot** of the text, not a pointer — the link survives report regeneration, and nothing but name and location of the property card leaks.
- Frontend: the "Share" button in the results header creates the link and shows it ready to copy. The public page `https://property-check.com/#a/<id>` (`SharedReport.jsx`) renders the report with the property header, mode chip, saved date, view counter and an "Analyze my property" call to action. Its language follows the report (`language` stored with the analysis), otherwise the browser language; untranslated keys fall back to English.

## Revision v3.6 (auth modal i18n, all 13 languages)

- The auth modal (sign in / sign up / forgot / reset / sent), the app header title and the "Sign In" button no longer contain hard-coded English — everything goes through `t()` (`auth.*`, `header.*`).
- `auth.*` (38 keys), `shared.*`, `analysis.share*`, `analysis.savedOn/refresh/copy/copied/download/stop` and `header.backToSite` are now present in **all 13** dictionaries in `frontend/src/i18n/`. `cs/kk/ka` follow the existing convention of this repo — Latin transliteration rather than native script. Translations are machine made and worth a proofread by native speakers.
- `frontend/scripts/check-i18n.mjs` (npm `i18n:check`) compares every dictionary with `en.json` and exits non-zero on a missing or extra key; CI runs it before `npm run build`. This is what caught `header.backToSite` and `analysis.stop`, which had silently fallen back to English in 11 languages since v3.2.
- Production bundle grew from 318 kB to 350 kB (98.9 kB → 109.7 kB gzipped) because the previously missing translations are now inlined.

