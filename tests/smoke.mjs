// Smoke-тесты API property-check.
//   node tests/smoke.mjs                                        # локальный сервер на 3001
//   SMOKE_BASE_URL=https://property-check.com node tests/smoke.mjs
//   SMOKE_BASE_URL=http://127.0.0.1:3999 SMOKE_DATA_DIR=/tmp/pc-drill node tests/smoke.mjs
// Claude не дёргается (AI-проверка только с SMOKE_AI=1); все данные — одноразовый аккаунт
// и свои id, поэтому набор можно гонять по проду. Если передан SMOKE_DATA_DIR с users.json
// (запуск на сервере), тестовый аккаунт удаляется после прогона.
import fs from 'node:fs';

const BASE = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3001').replace(/\/+$/, '');
const DATA_DIR = process.env.SMOKE_DATA_DIR || '';
const EMAIL = `smoke-${Date.now()}@example.test`;
const PASSWORD = 'smokepass1';
const PASSWORD2 = 'smokepass2';
const PROP = 'smoke-' + Date.now();
const CID = 'smoke' + Date.now();

const pass = [], fail = [], skipped = [];
const check = (name, cond, extra = '') => (cond ? pass : fail).push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const note = (name, why) => skipped.push(`SKIP ${name} — ${why}`);

const req = async (path, { method = 'GET', body, token, clientId, retryOn429 = true } = {}) => {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(BASE + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...(clientId ? { 'X-Client-Id': clientId } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const parsed = await r.json().catch(() => ({}));
    // На /api висит общий лимит 120 запросов/мин на IP, а набор делает ~50 запросов подряд:
    // при повторном прогоне можно упереться в него и получить ложный FAIL, поэтому подождать и повторить
    if (r.status === 429 && retryOn429 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 12000));
      continue;
    }
    return { status: r.status, body: parsed };
  }
};

const dropTestUser = () => {
  if (!DATA_DIR) return;
  try {
    const file = `${DATA_DIR}/users.json`;
    const users = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify(users.filter(u => u.email !== EMAIL), null, 2));
  } catch (e) {
    console.log(`note: could not remove ${EMAIL} from ${DATA_DIR}/users.json: ${e.message}`);
  }
};

const main = async () => {
  let r = await req('/api/health');
  check('GET /api/health', r.status === 200 && r.body.status === 'ok');

  // ---- регистрация и вход ----
  r = await req('/api/register', { method: 'POST', body: { email: EMAIL.toUpperCase(), password: PASSWORD, name: 'Smoke' } });
  check('POST /api/register normalises the email', r.status === 200 && !!r.body.token);
  const token = r.body.token;
  if (!token) throw new Error('register failed — stopping here');

  r = await req('/api/register', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  check('duplicate register rejected', r.status === 400);
  r = await req('/api/register', { method: 'POST', body: { password: PASSWORD } });
  check('register without email rejected', r.status === 400);
  r = await req('/api/login', { method: 'POST', body: { email: EMAIL, password: 'nope12345' } });
  check('login with wrong password rejected', r.status === 401);

  r = await req('/api/me', { token });
  check('GET /api/me returns the user', r.status === 200 && r.body.user && r.body.user.email === EMAIL);
  r = await req('/api/me');
  check('GET /api/me without token is 401', r.status === 401);
  r = await req('/api/me', { token: 'not.a.jwt' });
  check('GET /api/me with a garbage token is 401', r.status === 401);

  r = await req('/api/quota', { token });
  check('GET /api/quota: signed-in user has no limit', r.status === 200 && r.body.authenticated === true && r.body.limit === null);

  // ---- объекты недвижимости ----
  r = await req('/api/properties', { token });
  check('GET /api/properties is null for a fresh account', r.status === 200 && r.body.properties === null);
  r = await req('/api/properties', { method: 'PUT', token, body: { properties: [{ id: PROP, name: 'Smoke Tower', price: 1000000 }] } });
  check('PUT /api/properties', r.status === 200 && r.body.count === 1);
  r = await req('/api/properties', { token });
  check('properties round-trip', Array.isArray(r.body.properties) && r.body.properties[0] && r.body.properties[0].id === PROP);
  r = await req('/api/properties', { method: 'PUT', token, body: { properties: 'nope' } });
  check('PUT /api/properties rejects a non-array', r.status === 400);
  r = await req('/api/properties', { method: 'PUT', token, body: { properties: [{ name: 'no id' }] } });
  check('PUT /api/properties rejects a property without id', r.status === 400);
  r = await req('/api/properties', { method: 'PUT', body: { properties: [] } });
  check('anonymous PUT /api/properties requires X-Client-Id', r.status === 400);
  r = await req('/api/properties', { method: 'PUT', clientId: CID, body: { properties: [{ id: 'anon-1' }] } });
  check('anonymous sync works with X-Client-Id', r.status === 200 && r.body.count === 1);
  r = await req('/api/properties', { clientId: CID });
  check('anonymous properties are stored per client id', r.status === 200 && Array.isArray(r.body.properties));

  // ---- сохранённые анализы ----
  r = await req('/api/analyzes', { token });
  check('GET /api/analyzes is null for a fresh account', r.status === 200 && r.body.analyzes === null);
  r = await req('/api/analyzes', { method: 'PUT', token, body: { propertyId: PROP, mode: 'overview', text: 'Smoke report', language: 'en' } });
  check('PUT /api/analyzes saves a report', r.status === 200 && r.body.modes === 1);
  r = await req('/api/analyzes', { token });
  const saved = r.body.analyzes && r.body.analyzes[PROP] && r.body.analyzes[PROP].overview;
  check('analyzes round-trip keeps text and createdAt', !!(saved && saved.text === 'Smoke report' && saved.createdAt));
  r = await req('/api/analyzes', { method: 'PUT', token, body: { propertyId: PROP, mode: 'bad mode!', text: 'x' } });
  check('PUT /api/analyzes rejects an invalid mode', r.status === 400);
  r = await req('/api/analyzes', { method: 'PUT', token, body: { mode: 'overview', text: 'x' } });
  check('PUT /api/analyzes requires propertyId', r.status === 400);
  r = await req('/api/analyzes', { method: 'PUT', token, body: { propertyId: PROP, mode: 'overview', text: '   ' } });
  check('PUT /api/analyzes rejects blank text', r.status === 400);
  r = await req('/api/analyzes', { method: 'PUT', token, body: { propertyId: PROP, mode: 'overview', text: 'x'.repeat(120001) } });
  check('PUT /api/analyzes rejects oversized text', r.status === 400);
  r = await req('/api/analyzes', { method: 'PUT', token, body: { propertyId: PROP, mode: 'risks', text: 'second mode report' } });
  check('a second mode is stored next to the first', r.status === 200 && r.body.modes === 2);
  r = await req('/api/analyzes/' + PROP, { method: 'DELETE', token });
  check('DELETE /api/analyzes/:propertyId', r.status === 200);
  r = await req('/api/analyzes', { token });
  check('deleting a property removes its reports', r.status === 200 && (!r.body.analyzes || r.body.analyzes[PROP] === undefined));

  // ---- публичные ссылки на отчёт ----
  r = await req('/api/analyzes', { method: 'PUT', token, body: { propertyId: PROP, mode: 'overview', text: 'Shared report body', language: 'en' } });
  check('saved a report before sharing', r.status === 200);

  r = await req('/api/share', { method: 'POST', body: { propertyId: PROP, mode: 'overview' } });
  check('POST /api/share needs an owner', r.status === 400);
  r = await req('/api/share', { method: 'POST', token, body: { propertyId: PROP, mode: 'wrong mode' } });
  check('POST /api/share rejects an invalid mode', r.status === 400);
  r = await req('/api/share', { method: 'POST', token, body: { propertyId: 'nope-' + Date.now(), mode: 'overview' } });
  check('POST /api/share rejects a property with no saved report', r.status === 404);

  r = await req('/api/share', { method: 'POST', token, body: { propertyId: PROP, mode: 'overview' } });
  check('POST /api/share creates a link', r.status === 200 && /^[A-Za-z0-9]{10}$/.test(r.body.id || ''));
  const shareId = r.body.id;

  r = await req('/api/share', { method: 'POST', token, body: { propertyId: PROP, mode: 'overview' } });
  check('sharing the same report again reuses the link', r.status === 200 && r.body.id === shareId && r.body.reused === true);

  r = await req('/api/share/' + shareId);
  const shared = r.body.share;
  check('GET /api/share/:id works without auth', r.status === 200 && !!shared && shared.text === 'Shared report body' && shared.mode === 'overview');
  check('shared report counts views', typeof (shared && shared.views) === 'number' && shared.views >= 1);
  r = await req('/api/share/zzzzzzzzzz');
  check('unknown share id is 404', r.status === 404);
  r = await req('/api/share/bad--id');
  check('malformed share id is 404', r.status === 404);
  r = await req('/api/share/' + shareId, { method: 'DELETE', clientId: 'other' + Date.now() });
  check('a stranger cannot revoke the link', r.status === 403);
  r = await req('/api/share/' + shareId, { method: 'DELETE', token });
  check('the owner can revoke the link', r.status === 200 && r.body.removed === 1);
  r = await req('/api/share/' + shareId);
  check('a revoked link stops working', r.status === 404);

  r = await req('/api/share', { method: 'POST', token, body: { propertyId: PROP, mode: 'overview' } });
  const secondShareId = r.body.id;
  r = await req('/api/analyzes/' + PROP, { method: 'DELETE', token });
  check('deleting the property revokes its links', r.status === 200 && r.body.revokedShares === 1);
  r = await req('/api/share/' + secondShareId);
  check('link of a deleted property is gone', r.status === 404);

  // ---- сброс пароля ----
  // лимит на сброс считается 15 минутами, ждать его бессмысленно — сразу SKIP
  r = await req('/api/forgot-password', { method: 'POST', body: { email: 'nobody-' + Date.now() + '@example.test' }, retryOn429: false });
  if (r.status === 429) note('forgot for an unknown email', 'rate limited (20 requests / 15 min per IP)');
  else check('forgot for an unknown email does not leak it', r.status === 200 && r.body.success === true && !r.body.resetToken);

  r = await req('/api/forgot-password', { method: 'POST', body: { email: EMAIL }, retryOn429: false });
  const resetToken = r.body.resetToken;
  if (r.status === 429) {
    note('password reset flow', 'rate limited (20 requests / 15 min per IP)');
  } else if (!resetToken) {
    note('password reset flow', 'no token in response — RESET_TOKEN_IN_RESPONSE=0, email delivery expected');
  } else {
    let s = await req('/api/reset-password', { method: 'POST', body: { token: resetToken, password: '123' } });
    check('reset rejects a too short password', s.status === 400);
    s = await req('/api/reset-password', { method: 'POST', body: { token: 'f'.repeat(64), password: PASSWORD2 } });
    check('reset rejects an unknown token', s.status === 400);
    s = await req('/api/reset-password', { method: 'POST', body: { token: resetToken, password: PASSWORD2 } });
    check('reset with a valid token', s.status === 200 && s.body.success === true);
    s = await req('/api/reset-password', { method: 'POST', body: { token: resetToken, password: 'smokepass3' } });
    check('reset token is single-use', s.status === 400);
    s = await req('/api/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
    check('the old password stops working', s.status === 401);
    s = await req('/api/me', { token });
    check('a session issued before the reset is invalidated', s.status === 401);
    s = await req('/api/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD2 } });
    check('the new password works', s.status === 200 && !!s.body.token);
  }

  // ---- Claude (платно, по умолчанию выключено) ----
  if (process.env.SMOKE_AI === '1') {
    r = await req('/api/analyze', { method: 'POST', body: { prompt: 'Reply with the single word OK', webSearch: false } });
    check('POST /api/analyze answers', r.status === 200 && typeof r.body.content === 'string' && r.body.content.length > 0);
  } else {
    note('POST /api/analyze', 'set SMOKE_AI=1 to spend one Claude call');
  }

  await req('/api/properties', { method: 'PUT', token, body: { properties: [] } });
};

try {
  await main();
} catch (e) {
  fail.push(`FAIL smoke run aborted — ${e.message}`);
} finally {
  dropTestUser();
}

console.log(`smoke against ${BASE} as ${EMAIL}`);
console.log([...pass, ...fail, ...skipped].join('\n'));
console.log(`${pass.length} passed, ${fail.length} failed, ${skipped.length} skipped`);
console.log(fail.length ? 'SMOKE_FAILED' : 'SMOKE_OK');
process.exit(fail.length ? 1 : 0);
