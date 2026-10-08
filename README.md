# 🏠 Property Check — AI Real Estate Investment Analyzer

AI-powered platform for analyzing real estate investments worldwide. Upload property documents (SPA, booking forms, offer memos), and Claude extracts the data, assesses investment risk, and answers in 13 languages.

## 🌐 Live Demo
**[property-check.com](https://property-check.com)**

## ✨ Features
- 📄 **PDF parsing with AI** — upload one or several PDFs, get a structured property card (price, size, developer, payment plan, etc.)
- 🎯 **Intelligent risk assessment** (0–100%) with per-factor breakdown: developer, timeline, price, location, liquidity
- 🌍 **13 languages supported** for AI responses
- 💰 **Automatic currency detection**
- 📊 **Investment growth analysis**
- 🔐 JWT-based registration/login (30-day tokens)

## 🛠 Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | Node.js 22 + Express (port 3001) |
| AI | Anthropic Claude — `claude-opus-5-5` (analysis), `claude-sonnet-5-5` (validation) |
| Server | Ubuntu + Nginx + PM2, HTTPS via Let's Encrypt |
| Storage | Flat-file `users.json` (no database) |

## 📁 Project Structure
```
property-check/
├── server.js               # Express backend: API + Claude integration
├── package.json            # Backend dependencies
├── users.json              # Local user store (created at runtime)
├── docs/
│   └── API.md              # API reference
├── DEPLOY.md               # Production deployment runbook
├── frontend/               # React + Vite app
│   └── dist/               # Build output served by Nginx
└── real_estate_agent.jsx   # Early single-file prototype (legacy)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 20+ (22 LTS recommended)
- An Anthropic API key — <https://console.anthropic.com/>

### Setup
```bash
# 1. Backend
npm install
cp .env.example .env        # then fill in your keys

# 2. Run backend → http://localhost:3001
node server.js

# 3. Frontend (dev server)
cd frontend
npm install
npm run dev
```

### Environment Variables
| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ yes | Anthropic API key. Without it AI endpoints return 500 |
| `JWT_SECRET` | recommended | Token signing secret (insecure default exists) |

## 📡 API
Base URL: `https://property-check.com/api` · all bodies are JSON (limit 100 MB).

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check |
| `/register`, `/login` | POST | Auth, returns JWT + user |
| `/analyze` | POST | Free-form AI analysis |
| `/parse-property` | POST | Parse PDFs → structured property JSON |
| `/parse-text` | POST | Parse plain text → property JSON |
| `/assess-risk` | POST | Risk score 0–100 with factors |
| `/correct-property` | POST | Apply a user correction to a property |

Full request/response shapes: [docs/API.md](docs/API.md).

## 🏗 Production
Deployed at `/var/www/property-check` on the shared server, managed by PM2 (`pm2 restart property-check`). Full runbook: [DEPLOY.md](DEPLOY.md).

## ⚠️ Gotchas
- New Claude models (5th gen) prepend a `thinking` block to responses — always extract text via the `getText()` helper in `server.js`, never `content[0].text`.
- Model IDs are hardcoded in `server.js` (search for `model:`); when Anthropic retires a model the API returns `404 not_found_error`.
- No database: users live in `users.json` next to `server.js`. Back it up.

## 👤 Author
Created by Aleksandr Pantiulin

## 📄 License
MIT

