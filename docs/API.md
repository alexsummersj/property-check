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
