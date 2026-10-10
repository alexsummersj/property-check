# 🚀 Deployment Runbook — property-check.com

## Production topology (since Oct 2026)

| Item | Value |
|---|---|
| Server | Shared Ubuntu droplet `167.71.49.80` (also hosts `orbits`, `folio`) |
| App directory | `/var/www/property-check` |
| Backend | PM2 process **`property-check`** → `node server.js` on `127.0.0.1:3001` |
| Frontend | Static `frontend/dist/` (Vite build), served by Nginx |
| Nginx vhost | `/etc/nginx/sites-available/property-check.conf` |
| Domains | `property-check.com`, `www.property-check.com` (DNS A/CNAME → `167.71.49.80`) |
| TLS | Let's Encrypt via certbot, HTTP→HTTPS redirect |
| Secrets | `/var/www/property-check/.env` (`ANTHROPIC_API_KEY`, `JWT_SECRET`) |
| Data | `/var/www/property-check/users.json`, `quotas.json`, `properties.json`, `analyzes.json`, `shares.json` — backed up daily |

> Note: production was migrated from the old DigitalOcean droplet `174.138.28.202`
> (Oct 2026). Access to the old droplet is lost and it is considered abandoned —
> the current `users.json` is the only source of truth for accounts.

## Nginx essentials
The vhost must allow big uploads and slow AI calls:
```nginx
client_max_body_size 100m;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
proxy_pass http://127.0.0.1:3001;
```

## Deploying an update
```bash
ssh root@167.71.49.80
cd /var/www/property-check
git pull
cd frontend && npm ci && npm run build && cd ..
pm2 restart property-check
curl -s http://127.0.0.1:3001/api/health   # {"status":"ok",...}
```

## Logs & status
```bash
pm2 ls
pm2 logs property-check --lines 50
tail -f /root/.pm2/logs/property-check-error.log
```

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| `404 not_found_error — model: <id>` in logs | Anthropic retired a hardcoded model ID | Update `model:` entries in `server.js`, restart PM2 |
| `Cannot read properties of undefined (reading 'replace')` | Response starts with a `thinking` block | Extract text via `getText(message)`, not `content[0].text` |
| `413 Request Entity Too Large` | Nginx body limit | Raise `client_max_body_size` |
| `504 Gateway Timeout` | Claude call longer than proxy timeout | Raise `proxy_read_timeout` |
| `🔑 API ключ не настроен` | Missing `.env` / placeholder key | Fix `.env`, `pm2 restart property-check` |
| `401` from Anthropic | Bad/disabled API key or zero balance | Check console.anthropic.com billing |

## First-time server setup (what was installed)
1. Node.js 22 LTS + PM2
2. `git clone` into `/var/www/property-check`, `npm install` in root and `frontend/`
3. `npm run build` in `frontend/`
4. Nginx vhost + certbot certificate
5. `pm2 start server.js --name property-check && pm2 save`

## Rollback

Backend-only change:
```bash
cd /var/www/property-check
git log --oneline -5          # pick the previous good commit
git reset --hard <commit>
npm install                   # if package.json changed
pm2 restart property-check
curl -s localhost:3001/api/health
```
Frontend also changed → additionally `cd frontend && npm run build`.

Checkpoints: `380ba8b` = raw prod state before the v2 hardening revision;
`8e8d4d8` = deployed v2 (rollback target for the v3 series).

## Deploy v2 note

`npm install` is required once (new deps: `express-rate-limit`, `morgan`). Anonymous quota is stored in `quotas.json` (add to backups together with `users.json`).

## Deploy v3 note (server storage + streaming + CI)

No new npm deps. New endpoints: `GET/PUT /api/properties`, `POST /api/analyze/stream` (SSE; nginx buffering is disabled via the `X-Accel-Buffering: no` response header). Keep `package-lock.json` in sync with `package.json` — GitHub Actions CI runs `npm ci` and fails on drift. Backup cron now runs `/usr/local/bin/pc-backup.sh` (includes `properties.json`, 14-day retention).

Backups: cron (03:15 UTC) archives `users.json`, `quotas.json`, `properties.json`, `.env` into `/root/backups/pc-data-<date>.tar.gz`, kept 14 days.

## Deploy v3.1 note (live data in analyses)

Frontend + backend change: every analysis mode now passes `webSearch: true`, and both analyze endpoints send an analyst `system` prompt (`analystSystem()` in `server.js`). Rollback = `git reset --hard 564f830` + rebuild + restart.
Optional env knob: `WEB_SEARCH_MAX_USES` (default 5) — Anthropic bills web search separately (~$10 / 1000 searches), lower it if the bill grows. Left-side panels (PDF parse, Risk Score) are still non-streamed JSON.

## Deploy v3.2 note (UX fixes + saved analyses)

New data file: `analyzes.json` (saved analysis per property + mode). New endpoints `GET/PUT /api/analyzes`, `DELETE /api/analyzes/<propertyId>`. No new npm deps.

```bash
cd /var/www/property-check
git pull --ff-only
cd frontend && npm run build && cd ..
pm2 restart property-check --update-env   # server.js changed (assess-risk moved to MODEL_FAST)
curl -s localhost:3001/api/health
```

Update the backup script once so the new file is archived (`tar` skips files that do not exist yet). Upload with LF endings — a CRLF shebang makes cron fail with `cannot execute: required file not found`:

```bash
scp /tmp/pc-backup.sh root@SERVER:/usr/local/bin/pc-backup.sh
ssh root@SERVER "tr -d '\r' < /usr/local/bin/pc-backup.sh > /tmp/pb && mv /tmp/pb /usr/local/bin/pc-backup.sh && chmod +x /usr/local/bin/pc-backup.sh && /usr/local/bin/pc-backup.sh && tar tzf /root/backups/pc-data-*.tar.gz"
```

Rollback: `git reset --hard b02a36c` (before saved analyses) + rebuild + restart. `analyzes.json` is additive — old builds simply ignore it.

## Deploy v3.3 note (password reset)

No new npm deps and no new data files. New endpoints `POST /api/forgot-password` and `POST /api/reset-password`
(one-hour single-use token, stored as SHA-256 on the user record).

* `users.json` gains optional fields: `resetToken` (hash), `resetExpires`, `passwordChangedAt`.
* JWTs gain a `pwdAt` claim; after a password change every previously issued token stops working, so the user
  signs in again on other devices.
* `RESET_TOKEN_IN_RESPONSE=0` in `.env` stops returning the link in the `/forgot-password` response — switch it on
  when an email provider replaces the in-app link.
* Rate limit: 20 reset requests / 15 min per IP, shared by both endpoints.

```bash
cd /var/www/property-check
git pull --ff-only
cd frontend && npm run build && cd ..
pm2 restart property-check --update-env
curl -s localhost:3001/api/health
```

Smoke test: `SMOKE_DATA_DIR=/var/www/property-check node tests/smoke.mjs` (see the «Tests & backup drill» section
below) — it registers a throwaway account, resets the password through the token and asserts that the old password
and the old session stop working, that the token is single-use and that `users.json` keeps no raw token.

Rollback: `git reset --hard 6c510c2` (before password reset) + rebuild + restart. Old builds ignore the new user
fields; anyone who reset their password after this deploy simply signs in again.

## Tests & backup drill (v3.4)

**i18n check** — `cd frontend && npm run i18n:check` (`scripts/check-i18n.mjs`) compares every dictionary with
`en.json` and fails on a missing or extra key; it runs in CI before the frontend build. Add new UI strings to
`en.json` **and** to all 13 files in `frontend/src/i18n/`, otherwise the check stops the build.

**Smoke suite** — `tests/smoke.mjs` (npm script `test:smoke`), ~35 checks over health, auth, quota, properties,
saved analyses and password reset. It never calls Claude unless `SMOKE_AI=1`, and it only touches a throwaway
account plus its own ids, so it is safe against production:

```bash
SMOKE_DATA_DIR=/var/www/property-check node tests/smoke.mjs   # на сервере: тест удалит свой тестовый аккаунт
SMOKE_BASE_URL=https://property-check.com node tests/smoke.mjs # извне: без чистки users.json
SMOKE_AI=1 node tests/smoke.mjs                                # дополнительно один платный вызов Claude
```
Output ends with `N passed, N failed, N skipped` and `SMOKE_OK` / `SMOKE_FAILED` (exit code 1 on any FAIL).

CI (`.github/workflows/ci.yml`) installs backend and frontend, then starts `node server.js` with a dummy
`ANTHROPIC_API_KEY` on `PORT=3101` and runs the suite against it — AI checks are skipped there by design.

The suite waits and retries on `429`: `/api` is limited to 60 requests/min per IP and the suite is close to that
budget, so back-to-back runs from the same IP (127.0.0.1 on the server) would otherwise fail. The reset endpoints
have their own 15-min limiter — those checks turn into `SKIP` instead of `FAIL`.

**Backup restore drill** — `pc-drill.sh` (installed as `/usr/local/bin/pc-drill.sh`). A backup nobody has restored
is a hope, not a plan, so the script takes the newest `/root/backups/pc-data-*.tar.gz`, unpacks it into `/tmp`,
checks every JSON parses, boots the current `/var/www/property-check/server.js` against the restored data on
**port 3999** (production on 3001 stays untouched) and runs the smoke suite against that instance. Ends with
`DRILL_OK`; the temp directory and the temporary server are removed on exit.

```bash
scp pc-drill.sh root@SERVER:/usr/local/bin/pc-drill.sh
ssh root@SERVER "tr -d '\r' < /usr/local/bin/pc-drill.sh > /tmp/pd && mv /tmp/pd /usr/local/bin/pc-drill.sh && chmod +x /usr/local/bin/pc-drill.sh"
ssh root@SERVER /usr/local/bin/pc-drill.sh
```
Suggested cron (once a week, Sunday 04:40 UTC): `40 4 * * 0 root /usr/local/bin/pc-drill.sh > /var/log/pc-drill.log 2>&1`.
`PORT` became an environment variable (`process.env.PORT || 3001`) exactly so this drill can run next to production.

## Deploy v3.5 note (public share links)

New data file `shares.json` and new endpoints `POST /api/share`, `GET /api/share/<id>`, `DELETE /api/share/<id>`.
No new npm deps. `PORT` is read from the environment (`process.env.PORT || 3001`); PM2 has no `PORT` set, so the
service keeps answering on 3001. The global `/api` limiter went from 60 to 120 requests/min per IP.

```bash
cd /var/www/property-check
git pull --ff-only
cd frontend && npm run build && cd ..
pm2 restart property-check --update-env
curl -s localhost:3001/api/health
SMOKE_DATA_DIR=/var/www/property-check node tests/smoke.mjs
```

Update the backup script once so `shares.json` is archived (it already skips files that are not there yet),
uploading with LF endings:

```bash
scp pc-backup.sh root@SERVER:/usr/local/bin/pc-backup.sh
ssh root@SERVER "tr -d '\r' < /usr/local/bin/pc-backup.sh > /tmp/pb && mv /tmp/pb /usr/local/bin/pc-backup.sh && chmod +x /usr/local/bin/pc-backup.sh && /usr/local/bin/pc-backup.sh && tar tzf /root/backups/pc-data-$(date +%F).tar.gz"
```

Rollback: `git reset --hard a2a188e` (before share links) + rebuild + restart. `shares.json` is additive — old builds
ignore it, and already sent links answer 404 until the code is back.
