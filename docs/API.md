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
Request: `{ "prompt": "Is Palm Jumeirah a good investment?" }`
Response: `{ "content": "<AI answer text>" }`

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
