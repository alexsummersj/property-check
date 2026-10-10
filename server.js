const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();
const path = require('path');
const app = express();
// PORT нужен не только для прода: drill-скрипт поднимает копию прод-данных на другом порту
const PORT = parseInt(process.env.PORT || '3001', 10);

// Middleware - ВАЖНО: увеличенный лимит для PDF файлов
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const crypto = require('crypto');

app.use(morgan('combined'));

// Сервер за nginx: доверяем X-Forwarded-For, чтобы req.ip и rate-limit видели реальные IP клиентов
app.set('trust proxy', 1);

// Модели через env — при смене моделей Anthropic достаточно обновить .env без деплоя
const MODELS = {
  MAIN: process.env.MODEL_MAIN || 'claude-opus-5-5',
  FAST: process.env.MODEL_FAST || 'claude-sonnet-5-5'
};

const FREE_ANALYSIS_LIMIT = parseInt(process.env.FREE_ANALYSIS_LIMIT || '3');

// Единый системный промпт для аналитических эндпоинтов.
// Без него Claude пишет «мои данные примерно до середины 2025» и отказывается
// давать актуальные цифры, а веб-поиск без явной инструкции не использует.
function analystSystem() {
  const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  return `You are a senior real-estate investment analyst advising a private investor.
Today is ${today}.

Research rules:
- If the web_search tool is available, USE IT for anything time-sensitive: prices, price per sq ft, transaction volumes, project and completion status, handover delays, supply pipeline, news, regulation, developer track record. Search more than once when needed.
- Never mention your training-data cutoff. Never write disclaimers like "my data goes up to mid-2025" and never apologize for lacking recent data — search for it instead.
- If a figure is genuinely unavailable, give a reasoned range and say in one short line what it is based on. Do not repeat this caveat more than once in the answer.
- When a number comes from a search result, name the source and its date in parentheses.
- Separate structural facts (which change slowly) from market numbers (which change fast).

Style: concrete and quantitative, no filler, no generic investment advice, no marketing tone. Answer in the language requested by the user.`;
}

// Сколько поисковых запросов разрешаем на один анализ
const WEB_SEARCH_MAX_USES = parseInt(process.env.WEB_SEARCH_MAX_USES || '5');

// Rate limiters — защита от абьюза и неконтролируемых затрат на API.
// Дешёвые эндпоинты держим щедро (120/мин): одна вкладка при загрузке делает несколько
// синхронизаций свойств и отчётов подряд. Деньги тратят только AI-ручки — им хватает 20/мин.
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, please slow down' } });
const aiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many AI requests, please wait a minute' } });
app.use('/api', apiLimiter);

// Проверка API ключа при старте
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY || API_KEY === 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
  console.error('');
  console.error('❌ ========================================');
  console.error('❌ ОШИБКА: API КЛЮЧ НЕ НАСТРОЕН!');
  console.error('❌ ========================================');
  console.error('');
  console.error('1. Создайте файл .env в корневой папке');
  console.error('2. Добавьте строку:');
  console.error('   ANTHROPIC_API_KEY=sk-ant-api03-ваш-настоящий-ключ');
  console.error('');
  console.error('Получить ключ: https://console.anthropic.com/');
  console.error('');
}

// Инициализация Anthropic клиента
const anthropic = new Anthropic({
  apiKey: API_KEY,
});

const jwt = require('jsonwebtoken');
// Собираем ВСЕ текстовые блоки ответа: у Claude 5.x перед текстом бывают thinking-блоки,
// а при web_search текст приходит в нескольких блоках между вызовами инструмента
const getText = (m) => ((m && m.content) || []).filter(x => x.type === 'text').map(x => x.text).join('\n\n');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'property-check-secret-key-change-in-production';
const USERS_FILE = './users.json';
const QUOTAS_FILE = './quotas.json';

// Атомарная запись: временный файл + rename (не оставляет битый JSON при падении)
const atomicWrite = (file, data) => {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};

const loadQuotas = () => {
  try {
    if (fs.existsSync(QUOTAS_FILE)) return JSON.parse(fs.readFileSync(QUOTAS_FILE, 'utf8'));
  } catch (e) {}
  return {};
};
const saveQuotas = (q) => atomicWrite(QUOTAS_FILE, JSON.stringify(q, null, 2));

const PROPERTIES_FILE = './properties.json';

const loadProperties = () => {
  try {
    if (fs.existsSync(PROPERTIES_FILE)) return JSON.parse(fs.readFileSync(PROPERTIES_FILE, 'utf8'));
  } catch (e) {}
  return {};
};
const saveProperties = (p) => atomicWrite(PROPERTIES_FILE, JSON.stringify(p));

// Возвращает пользователя по Bearer-токену (или null)
const getUserFromReq = (req) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(h.split(' ')[1], JWT_SECRET);
    const user = loadUsers().find(u => u.id === decoded.id) || null;
    if (!user) return null;
    // Смена пароля инвалидирует ранее выданные токены (у JWT нет отзыва): в токене
    // лежит отметка версии пароля pwdAt, она обязана совпадать с текущей
    if (user.passwordChangedAt && (decoded.pwdAt || 0) !== user.passwordChangedAt) return null;
    return user;
  } catch (e) {
    return null;
  }
};

// Маппинг ошибок Anthropic SDK: по error.status вместо хрупких проверок строк
const apiErrorStatus = (error) => [400, 401, 402, 403, 404, 429, 529].includes(error.status) ? error.status : 500;
const describeApiError = (error, fallback) => {
  const msg = error.message || '';
  if (error.status === 401) return '🔑 Ошибка ключа Anthropic API (401)';
  if (error.status === 402 || /insufficient balance/i.test(msg)) return '💳 Недостаточно средств на балансе Anthropic. Пополните баланс на console.anthropic.com';
  if (error.status === 429) return '⏳ Превышен лимит запросов Anthropic. Повторите через минуту';
  if (error.status === 529) return '🤖 Перегрузка серверов Anthropic. Повторите через минуту';
  if (/could not process/i.test(msg)) return '📄 Не удалось прочитать PDF. Попробуйте другой файл.';
  if (/too large|maximum of 32/i.test(msg)) return '📄 Файлы слишком большие (лимит Anthropic ~32MB / 100 страниц на PDF)';
  return fallback;
};

// Квота на бесплатные анализы для анонимных (лимит на IP); с JWT — безлимит и учёт analysisCount
const quotaLimiter = (req, res, next) => {
  try {
    const user = getUserFromReq(req);
    if (user) {
      const users = loadUsers();
      const u = users.find(x => x.id === user.id);
      if (u) { u.analysisCount = (u.analysisCount || 0) + 1; saveUsers(users); }
      req.anonymousQuota = null;
      return next();
    }
    const quotas = loadQuotas();
    const ip = req.ip || 'unknown';
    const q = quotas[ip] || { count: 0 };
    if ((q.count || 0) >= FREE_ANALYSIS_LIMIT) {
      return res.status(403).json({ error: 'Free analysis limit reached. Create a free account — analyses become unlimited during beta.', quotaExceeded: true });
    }
    req.anonymousQuota = { ip, used: q.count || 0, remaining: Math.max(0, FREE_ANALYSIS_LIMIT - (q.count || 0) - 1) };
    next();
  } catch (e) {
    next();
  }
};

const consumeQuota = (req) => {
  try {
    if (!req.anonymousQuota) return;
    const quotas = loadQuotas();
    const q = quotas[req.anonymousQuota.ip] || { count: 0 };
    q.count = (q.count || 0) + 1;
    quotas[req.anonymousQuota.ip] = q;
    saveQuotas(quotas);
  } catch (e) {}
};

// Загрузка/сохранение пользователей
const loadUsers = () => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {}
  return [];
};

const saveUsers = (users) => {
  atomicWrite(USERS_FILE, JSON.stringify(users, null, 2));
};

// Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const users = loadUsers();
    
    if (users.find(u => u.email === normalizedEmail)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name: name || email.split('@')[0],
      password: hashedPassword,
      plan: 'free',
      analysisCount: 0,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    const token = jwt.sign({ id: newUser.id, email: newUser.email, pwdAt: newUser.passwordChangedAt || 0 }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({ 
      success: true, 
      token,
      user: { id: newUser.id, email: newUser.email, name: newUser.name, plan: newUser.plan }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Вход
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    
    const users = loadUsers();
    const user = users.find(u => u.email === normalizedEmail);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, pwdAt: user.passwordChangedAt || 0 }, JWT_SECRET, { expiresIn: '30d' });
    
    res.json({ 
      success: true, 
      token,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Проверка токена
app.get('/api/me', (req, res) => {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Invalid token' });
  res.json({
    user: { id: user.id, email: user.email, name: user.name, plan: user.plan, analysisCount: user.analysisCount }
  });
});

// ===== Сброс пароля =====
// В users.json кладём не сам токен, а его sha256 — утечка файла не даёт право сброса.
// Почтового провайдера на бете нет, поэтому ссылка отдаётся в ответе и показывается
// пользователю (RESET_TOKEN_IN_RESPONSE=0 выключит это, когда включим отправку писем).
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 час
const hashResetToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const safeEqual = (a, b) => {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts, please try later' }
});

app.post('/api/forgot-password', forgotLimiter, (req, res) => {
  try {
    const normalizedEmail = String((req.body || {}).email || '').trim().toLowerCase();
    const users = loadUsers();
    const user = users.find(u => u.email === normalizedEmail);

    // Ответ всегда 200: по нему нельзя проверить, зарегистрирован ли email
    if (!user) return res.json({ success: true });

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = hashResetToken(token);
    user.resetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
    saveUsers(users);

    const payload = { success: true };
    if (process.env.RESET_TOKEN_IN_RESPONSE !== '0') {
      payload.resetToken = token;
      payload.resetExpiresAt = user.resetExpires;
    }
    return res.json(payload);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to start password reset' });
  }
});

app.post('/api/reset-password', forgotLimiter, async (req, res) => {
  try {
    const { token, password } = req.body || {};
    const pwd = String(password || '');
    if (!token) return res.status(400).json({ error: 'Reset link is required' });
    if (pwd.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const users = loadUsers();
    const tokenHash = hashResetToken(token);
    const user = users.find(u => u.resetToken && safeEqual(u.resetToken, tokenHash));

    if (!user || !user.resetExpires || new Date(user.resetExpires).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Reset link is invalid or expired — please request a new one' });
    }

    user.password = await bcrypt.hash(pwd, 10);
    delete user.resetToken;
    delete user.resetExpires;
    user.passwordChangedAt = Date.now(); // старые JWT считаются протухшими
    saveUsers(users);

    res.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// API endpoint для анализа
app.post('/api/analyze', aiLimiter, quotaLimiter, async (req, res) => {
  try {
    if (!API_KEY || API_KEY === 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      return res.status(500).json({ 
        error: '🔑 API ключ не настроен! Откройте файл .env и добавьте ваш ключ от console.anthropic.com'
      });
    }

    const { prompt, webSearch } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    if (String(prompt).length > 8000) {
      return res.status(400).json({ error: 'Prompt is too long (max 8000 characters)' });
    }

    console.log('📤 Отправляю запрос в Claude API...');
    
    const requestOptions = {
      model: MODELS.MAIN,
      max_tokens: webSearch ? 6000 : 2000,
      system: analystSystem(),
      messages: [{ role: 'user', content: prompt }]
    };
    // Веб-поиск Claude: свежие данные о проекте/районе/рынке вместо устаревших весов модели
    if (webSearch) {
      requestOptions.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }];
    }

    const message = await anthropic.messages.create(requestOptions);

    console.log('✅ Ответ получен!');

    if (!message || !message.content || !getText(message)) {
      console.error('⚠️ Неожиданный формат ответа:', JSON.stringify(message, null, 2));
      return res.status(500).json({ 
        error: 'Неожиданный формат ответа от API',
        details: JSON.stringify(message)
      });
    }

    consumeQuota(req);
    res.json({ 
      content: getText(message),
      remainingQuota: req.anonymousQuota ? req.anonymousQuota.remaining : null
    });
    
  } catch (error) {
    console.error('❌ Ошибка API:', error.message);
    
    let errorMessage;
    if (error.message.includes('401') || error.message.includes('authentication')) {
      errorMessage = '🔑 Неверный API ключ! Проверьте ключ в файле .env';
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      errorMessage = '🌐 Нет подключения к интернету';
    } else {
      errorMessage = describeApiError(error, 'Ошибка при получении анализа');
    }
    
    res.status(apiErrorStatus(error)).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Тот же анализ, но стримингом (SSE): текст появляется по мере генерации Claude
app.post('/api/analyze/stream', aiLimiter, quotaLimiter, async (req, res) => {
  try {
    const { prompt, webSearch } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    if (String(prompt).length > 8000) {
      return res.status(400).json({ error: 'Prompt is too long (max 8000 characters)' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx не буферизует ответ (проксирует молча)
    res.flushHeaders();

    const requestOptions = {
      model: MODELS.MAIN,
      max_tokens: webSearch ? 6000 : 2000,
      system: analystSystem(),
      messages: [{ role: 'user', content: prompt }]
    };
    if (webSearch) {
      requestOptions.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }];
    }

    console.log('📡 Стриминг запроса в Claude API...');
    const stream = anthropic.messages.stream(requestOptions);

    // Клиент закрыл вкладку — прерываем генерацию, чтобы не жечь токены
    req.on('close', () => { try { stream.abort(); } catch (e) {} });

    stream.on('text', (delta) => {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    });

    await stream.finalMessage();

    consumeQuota(req);
    res.write(`data: ${JSON.stringify({ done: true, remainingQuota: req.anonymousQuota ? req.anonymousQuota.remaining : null })}\n\n`);
    res.end();
    console.log('✅ Стрим завершён');
  } catch (error) {
    console.error('❌ Ошибка stream API:', error.message);
    const msg = (error.message.includes('network') || error.message.includes('ENOTFOUND'))
      ? '🌐 Нет подключения к интернету'
      : describeApiError(error, 'Ошибка при получении анализа');
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    } else {
      res.status(apiErrorStatus(error)).json({ error: msg, details: error.message });
    }
  }
});

// Parse property from text input
app.post('/api/parse-text', aiLimiter, async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide property details' });
    }

    // Шаг 1: Валидация - это вообще про недвижимость?
    const validationResponse = await anthropic.messages.create({
      model: MODELS.FAST,
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Is this text about real estate property (apartment, house, villa, land, commercial property for sale/rent/investment)? Answer only "YES" or "NO".

Text: "${text.substring(0, 500)}"`
      }]
    });

    const isValid = getText(validationResponse).trim().toUpperCase().includes('YES');
    
    if (!isValid) {
      return res.status(400).json({ 
        error: 'This doesn\'t appear to be real estate information. Please provide details about a property (apartment, house, villa, etc.)' 
      });
    }

    // Шаг 2: Парсинг данных
    const message = await anthropic.messages.create({
      model: MODELS.MAIN,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract property information from this text and return as JSON.

Text: "${text}"

Return ONLY valid JSON (no markdown, no backticks):
{
  "name": "Project/Building name",
  "location": "Full location/address",
  "type": "Apartment/Villa/Townhouse/Penthouse/Studio",
  "price": <number only, no currency>,
  "size": <number>,
  "sizeUnits": "sqft or m2 (units from the text)",
  "completion": "Q1 2025 or Ready or Under Construction",
  "developer": "Developer name",
  "bedrooms": <number or null>,
  "bathrooms": <number or null>,
  "paymentPlan": "Payment plan details or null",
  "view": "View description or null",
  "floor": <floor number or null>,
  "amenities": ["amenity1", "amenity2"] or null,
  "additionalInfo": "Any other relevant info"
}

If any field is not mentioned, make reasonable assumptions or use null.
Extract numbers from text like "2.25M" = 2250000, "850sft" = 850.`
      }]
    });

    const content = getText(message);
    
    let property;
    try {
      const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      property = JSON.parse(cleanJson);
    } catch (e) {
      console.error('JSON parse error:', e);
      return res.status(500).json({ error: 'Failed to parse property data' });
    }

    res.json({ success: true, property });

  } catch (error) {
    console.error('Parse text error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint для парсинга НЕСКОЛЬКИХ PDF файлов
app.post('/api/parse-property', aiLimiter, async (req, res) => {
  try {
    if (!API_KEY || API_KEY === 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      return res.status(500).json({ 
        error: '🔑 API ключ не настроен!'
      });
    }

    const { files } = req.body;  // Массив файлов [{pdfBase64, fileName}, ...]
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'PDF файлы не предоставлены' });
    }
    if (files.length > 8) {
      return res.status(400).json({ error: 'Too many files — max 8 PDFs at once' });
    }
    // Быстрые серверные проверки до обращения к API: это PDF? не гигантский?
    for (const f of files) {
      if (!f || typeof f.pdfBase64 !== 'string' || !f.pdfBase64.startsWith('JVBER')) {
        return res.status(400).json({ error: 'Not a valid PDF file: ' + ((f && f.fileName) || 'unnamed') });
      }
      if (f.pdfBase64.length > 20 * 1024 * 1024) {
        return res.status(400).json({ error: 'File too large (max ~15 MB): ' + (f.fileName || 'unnamed') });
      }
    }

    console.log(`📄 Парсинг ${files.length} PDF файлов:`);
    files.forEach((f, i) => console.log(`   ${i + 1}. ${f.fileName}`));
    
    // Создаём контент с несколькими документами
    const contentParts = [];
    
    // Добавляем каждый PDF как отдельный документ
    for (const file of files) {
      contentParts.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: file.pdfBase64
        }
      });
    }
    
    // Добавляем промпт для анализа
    contentParts.push({
      type: 'text',
      text: `Проанализируй ВСЕ загруженные документы о недвижимости (${files.length} файлов: ${files.map(f => f.fileName).join(', ')}).

Это документы об ОДНОМ объекте недвижимости. Извлеки и объедини данные из всех документов.

ВЕРНИ ТОЛЬКО JSON (без markdown, без \`\`\`, только чистый JSON):
{
  "name": "Название проекта и номер юнита (например: Olaia Residences Unit 917)",
  "location": "Район (например: Palm Jumeirah, Dubai Marina, Downtown Dubai)",
  "type": "Тип недвижимости (например: 2BR Apartment, 5BR Duplex, Villa)",
  "price": число в AED без запятых (например: 21712896),
  "size": площадь как число (например: 4306.32),
  "sizeUnits": "sqft или m2 — единица измерения площади из документа",
  "completion": "Срок сдачи (например: Q4 2027)",
  "developer": "Название застройщика",
  "paymentPlan": "План оплаты если есть (например: 50/50, 60/40)",
  "view": "Вид из окна если указан",
  "floor": "Этаж если указан",
  "bedrooms": число спален как число,
  "bathrooms": число ванных как число,
  "parking": число парковочных мест как число,
  "amenities": ["список", "удобств", "проекта"],
  "buyerName": "Имя покупателя если есть в booking form",
  "bookingDate": "Дата бронирования если есть",
  "additionalInfo": "Любая другая важная информация"
}

Если какое-то поле не найдено ни в одном документе, используй null.
Цену и площадь указывай как числа без валюты и запятых.
Объедини информацию из всех документов для максимально полной картины.`
    });

    // Валидация: проверяем КАЖДЫЙ файл дешёвой моделью, что это недвижимость
    for (let i = 0; i < files.length; i++) {
      const validationResponse = await anthropic.messages.create({
        model: MODELS.FAST,
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: files[i].pdfBase64 } },
            {
              type: 'text',
              text: 'Is this document about real estate property (apartment, house, villa, land, commercial property for sale/rent/investment)? Answer only "YES" or "NO".'
            }
          ]
        }]
      });

      if (!getText(validationResponse).trim().toUpperCase().includes('YES')) {
        console.log('❌ PDF не про недвижимость:', files[i].fileName);
        return res.status(400).json({ 
          error: '"' + (files[i].fileName || 'Uploaded file') + '\' does not appear to be about real estate. Please upload a property brochure, listing, or sales document.' 
        });
      }
    }
    
    console.log('✅ PDF валидация пройдена (' + files.length + ' files)');
    
    const message = await anthropic.messages.create({
      model: MODELS.MAIN,
      max_tokens:8000,
      messages: [{
        role: 'user',
        content: contentParts
      }]
    });

    console.log('✅ PDF файлы распарсены!');
    
    let responseText = getText(message);
    
    // Убираем возможные markdown обёртки
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const propertyData = JSON.parse(responseText);
      res.json({ 
        success: true,
        property: propertyData,
        filesProcessed: files.length
      });
    } catch (parseError) {
      console.error('⚠️ Ошибка парсинга JSON:', responseText);
      res.status(500).json({ 
        error: 'Не удалось распарсить ответ AI',
        rawResponse: responseText
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка парсинга PDF:', error.message);
    
    res.status(apiErrorStatus(error)).json({ 
      error: describeApiError(error, 'Ошибка при парсинге PDF'),
      details: error.message 
    });
  }
});

// Endpoint для оценки риска объекта

app.post('/api/assess-risk', aiLimiter, async (req, res) => {
  try {
    if (!API_KEY || API_KEY === 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      return res.status(500).json({ error: '🔑 API ключ не настроен!' });
    }

    const { property, language = 'en' } = req.body;
    
    if (!property) {
      return res.status(400).json({ error: 'Данные объекта не предоставлены' });
    }

    console.log(`🎯 Оценка риска: ${property.name} (${language})`);

    const langInstruction = {
      'en': 'Respond in English.',
      'ru': 'Отвечай на русском языке.',
      'ar': 'أجب باللغة العربية.',
      'zh': '请用中文回答。',
      'fr': 'Réponds en français.',
      'es': 'Responde en español.',
      'de': 'Antworte auf Deutsch.',
      'it': 'Rispondi in italiano.',
      'ja': '日本語で回答してください。',
      'th': 'ตอบเป็นภาษาไทย',
      'cs': 'Odpověz v češtině.',
      'kk': 'Қазақ тілінде жауап беріңіз.',
      'ka': 'უპასუხე ქართულად.'
    }[language] || 'Respond in English.';

    // Вычисляем время до сдачи
    const now = new Date();
    let completionInfo = '';
    
    if (property.completion) {
      const completionStr = property.completion.toString();
      let completionDate = null;
      
      const quarterMatch = completionStr.match(/Q(\d)\s*(\d{4})/i);
      const yearMatch = completionStr.match(/(\d{4})/);
      const monthYearMatch = completionStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{4})/i);
      
      if (monthYearMatch) {
        const months = { 'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5, 'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11 };
        completionDate = new Date(parseInt(monthYearMatch[2]), months[monthYearMatch[1].toLowerCase()], 28);
      } else if (quarterMatch) {
        const quarter = parseInt(quarterMatch[1]);
        const year = parseInt(quarterMatch[2]);
        const quarterEndMonth = quarter * 3 - 1;
        completionDate = new Date(year, quarterEndMonth, 28);
      } else if (yearMatch) {
        completionDate = new Date(parseInt(yearMatch[1]), 11, 31);
      }
      
      if (completionDate && completionDate > now) {
        const monthsUntil = Math.round((completionDate - now) / (1000 * 60 * 60 * 24 * 30));
        const yearsUntil = Math.floor(monthsUntil / 12);
        const remainingMonths = monthsUntil % 12;
        completionInfo = `Time until completion: approximately ${yearsUntil} year(s) and ${remainingMonths} month(s) (${monthsUntil} months total).`;
      }
    }

// Определение валюты по локации
    const getCurrency = (loc) => {
      const l = (loc || '').toLowerCase();
      if (l.includes('dubai') || l.includes('uae') || l.includes('emirates') || l.includes('abu dhabi')) return 'AED';
      if (l.includes('russia') || l.includes('moscow') || l.includes('россия') || l.includes('москва')) return 'RUB (₽)';
      if (l.includes('london') || l.includes('uk') || l.includes('britain')) return 'GBP (£)';
      if (l.includes('europe') || l.includes('spain') || l.includes('france') || l.includes('germany') || l.includes('italy')) return 'EUR (€)';
      if (l.includes('turkey') || l.includes('istanbul')) return 'TRY (₺)';
      if (l.includes('georgia') || l.includes('tbilisi') || l.includes('batumi')) return 'GEL (₾)';
      if (l.includes('kazakhstan') || l.includes('astana') || l.includes('almaty')) return 'KZT (₸)';
      if (l.includes('thailand') || l.includes('bangkok') || l.includes('phuket')) return 'THB (฿)';
      return 'USD ($)';
    };
    const currency = getCurrency(property.location);

    const message = await anthropic.messages.create({
      // Левая панель ждёт только JSON с оценками — Sonnet справляется и в разы быстрее Opus
      model: MODELS.FAST,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Analyze investment risk for this property.

IMPORTANT: Use ONLY the data provided below. Do NOT substitute with market data or estimates.

Property Details:
- Name: ${property.name}
- Location: ${property.location}
- Type: ${property.type}
- Price: ${property.price} ${currency} (use this EXACT price and currency in your analysis)
- Size: ${property.size} ${property.sizeUnits || 'sqft'}
- Completion: ${property.completion}
- Developer: ${property.developer}
- Payment Plan: ${property.paymentPlan || 'Not specified'}
${completionInfo}

Evaluate risk factors (0-100 scale, where 100 is highest risk):
1. Developer risk (unknown developer = 70-100, established = 10-30)
2. Timeline risk (>30 months = 60-80, <12 months = 10-25)
3. Price risk - analyze if ${property.price} is reasonable for ${property.location}
4. Location risk (new area = 50-70, premium location = 10-25)
5. Liquidity risk (hard to sell = 50-70, high demand = 10-25)

${langInstruction}

Return ONLY valid JSON (no markdown, no \`\`\`):
{
  "overallRisk": <number 10-100>,
  "riskLevel": "<low|medium|high>",
  "factors": {
    "developer": {"score": <0-100>, "reason": "<explanation>"},
    "timeline": {"score": <0-100>, "reason": "<explanation>"},
    "price": {"score": <0-100>, "reason": "<explanation using the EXACT price ${property.price} ${currency}>"},
    "location": {"score": <0-100>, "reason": "<explanation>"},
    "liquidity": {"score": <0-100>, "reason": "<explanation>"}
  },
  "summary": "<2-3 sentence summary>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"]
}`
      }]
    });

    console.log('✅ Риск оценен!');
    
    let responseText = getText(message);
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const riskData = JSON.parse(responseText);
      res.json({ success: true, risk: riskData });
    } catch (parseError) {
      console.error('⚠️ Ошибка парсинга JSON:', responseText);
      res.status(500).json({ error: 'Не удалось обработать ответ', rawResponse: responseText });
    }
    
  } catch (error) {
    console.error('❌ Ошибка оценки риска:', error.message);
    res.status(apiErrorStatus(error)).json({ error: describeApiError(error, 'Ошибка при оценке риска'), details: error.message });
  }
});

// Endpoint для уточнения/корректировки данных объекта
app.post('/api/correct-property', aiLimiter, async (req, res) => {
  try {
    if (!API_KEY || API_KEY === 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      return res.status(500).json({ 
        error: '🔑 API ключ не настроен!'
      });
    }

    const { property, correction } = req.body;
    
    if (!property || !correction) {
      return res.status(400).json({ error: 'Данные объекта и уточнение не предоставлены' });
    }

    console.log(`✏️ Уточнение данных: ${property.name}`);
    console.log(`   Заметка: ${correction}`);
    
    const message = await anthropic.messages.create({
      model: MODELS.MAIN,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Проанализируй уточнение пользователя и определи, какие поля объекта недвижимости нужно обновить.

ТЕКУЩИЕ ДАННЫЕ ОБЪЕКТА:
- name: "${property.name}"
- location: "${property.location}"
- type: "${property.type}"
- price: ${property.price} (число в AED)
- size: ${property.size} (число в кв.футах)
- completion: "${property.completion}"
- developer: "${property.developer}"
- paymentPlan: "${property.paymentPlan || 'не указано'}"
- view: "${property.view || 'не указано'}"
- floor: "${property.floor || 'не указано'}"
- bedrooms: ${property.bedrooms || 'не указано'}
- bathrooms: ${property.bathrooms || 'не указано'}

УТОЧНЕНИЕ ПОЛЬЗОВАТЕЛЯ:
"${correction}"

ЗАДАЧА:
1. Определи, какие поля нужно изменить на основе уточнения
2. Верни ТОЛЬКО изменённые поля с новыми значениями
3. Объясни, что было изменено

ВЕРНИ ТОЛЬКО JSON (без markdown, без \`\`\`):
{
  "updates": {
    // Только поля, которые нужно изменить. Примеры:
    // "location": "Dubai Marina",
    // "completion": "Q2 2026",
    // "price": 15000000,
    // "developer": "Emaar Properties"
  },
  "explanation": "Краткое объяснение на русском, что было изменено и почему",
  "affectsRisk": true или false (влияет ли изменение на оценку риска - true если изменены: developer, completion, location, price),
  "fieldsChanged": ["список", "изменённых", "полей"]
}

Если уточнение не содержит данных для изменения полей (например, просто комментарий), верни:
{
  "updates": {},
  "explanation": "Уточнение не содержит данных для изменения полей объекта",
  "affectsRisk": false,
  "fieldsChanged": []
}`
      }]
    });

    console.log('✅ Уточнение обработано!');
    
    let responseText = getText(message);
    responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const correctionData = JSON.parse(responseText);
      res.json({ 
        success: true,
        correction: correctionData 
      });
    } catch (parseError) {
      console.error('⚠️ Ошибка парсинга JSON:', responseText);
      res.status(500).json({ 
        error: 'Не удалось обработать уточнение',
        rawResponse: responseText
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка обработки уточнения:', error.message);
    res.status(apiErrorStatus(error)).json({ 
      error: describeApiError(error, 'Ошибка при обработке уточнения'),
      details: error.message 
    });
  }
});

// Статус бесплатной квоты — для отображения на фронте
app.get('/api/quota', (req, res) => {
  const user = getUserFromReq(req);
  const quotas = loadQuotas();
  const q = quotas[req.ip] || { count: 0 };
  res.json({
    authenticated: !!user,
    used: user ? (user.analysisCount || 0) : (q.count || 0),
    limit: user ? null : FREE_ANALYSIS_LIMIT
  });
});

// Владелец свойств: авторизованный → user:<id>, анонимный → cid:<X-Client-Id>
const ownerKey = (req) => {
  const user = getUserFromReq(req);
  if (user) return 'user:' + user.id;
  const cid = String(req.headers['x-client-id'] || '').trim();
  return /^[A-Za-z0-9_-]{6,64}$/.test(cid) ? 'cid:' + cid : null;
};

// Хранилище объектов недвижимости: null = на сервере ещё нет данных этого владельца
app.get('/api/properties', (req, res) => {
  try {
    const key = ownerKey(req);
    if (!key) return res.json({ properties: null });
    const all = loadProperties();
    res.json({ properties: all[key] || null });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load properties' });
  }
});

// Полная синхронизация массива свойств от клиента (сервер хранит снапс списка)
app.put('/api/properties', (req, res) => {
  try {
    const key = ownerKey(req);
    if (!key) return res.status(400).json({ error: 'X-Client-Id header is required for anonymous sync' });
    const { properties } = req.body || {};
    if (!Array.isArray(properties)) return res.status(400).json({ error: 'properties must be an array' });
    if (properties.length > 300) return res.status(400).json({ error: 'Too many properties (max 300)' });
    if (properties.some(p => !p || p.id === undefined || p.id === null)) {
      return res.status(400).json({ error: 'Each property must have an id' });
    }
    const all = loadProperties();
    all[key] = properties;
    saveProperties(all);
    res.json({ success: true, count: properties.length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save properties' });
  }
});

// ===== Сохранённые анализы =====
// Храним последний ответ Claude на каждый режим анализа, чтобы отчёт не терялся
// после перезагрузки страницы и не генерировался повторно за деньги.
// Структура: { ownerKey: { "<propertyId>": { "<mode>": { text, question, language, createdAt } } } }
const ANALYZES_FILE = './analyzes.json';

const loadAnalyzes = () => {
  try {
    if (fs.existsSync(ANALYZES_FILE)) return JSON.parse(fs.readFileSync(ANALYZES_FILE, 'utf8'));
  } catch (e) {}
  return {};
};
const saveAnalyzes = (a) => atomicWrite(ANALYZES_FILE, JSON.stringify(a));

const MAX_ANALYSIS_MODES = 12;      // страховка от разрастания файла
const MAX_ANALYSIS_TEXT = 120000;   // ~30k токенов — больше анализ не бывает

// Все сохранённые анализы владельца
app.get('/api/analyzes', (req, res) => {
  try {
    const key = ownerKey(req);
    if (!key) return res.json({ analyzes: null });
    const all = loadAnalyzes();
    res.json({ analyzes: all[key] || null });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load analyzes' });
  }
});

// Сохранить/обновить один анализ (propertyId + mode)
app.put('/api/analyzes', (req, res) => {
  try {
    const key = ownerKey(req);
    if (!key) return res.status(400).json({ error: 'X-Client-Id header is required for anonymous sync' });

    const { propertyId, mode, text, question, language, createdAt } = req.body || {};
    if (propertyId === undefined || propertyId === null || propertyId === '') {
      return res.status(400).json({ error: 'propertyId is required' });
    }
    const modeKey = String(mode || 'overview').slice(0, 20);
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,19}$/.test(modeKey)) return res.status(400).json({ error: 'Invalid mode' });
    if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text is required' });
    if (text.length > MAX_ANALYSIS_TEXT) return res.status(400).json({ error: 'Analysis text is too long' });

    const pid = String(propertyId).slice(0, 64);
    const all = loadAnalyzes();
    const owner = all[key] || {};
    const byMode = owner[pid] || {};
    byMode[modeKey] = {
      text,
      question: typeof question === 'string' ? question.slice(0, 500) : null,
      language: typeof language === 'string' ? language.slice(0, 8) : null,
      createdAt: typeof createdAt === 'string' ? createdAt.slice(0, 40) : new Date().toISOString()
    };

    // Если режимов стало больше разумного — выбрасываем самые старые
    const modes = Object.entries(byMode);
    if (modes.length > MAX_ANALYSIS_MODES) {
      modes.sort((a, b) => String(b[1]?.createdAt || '').localeCompare(String(a[1]?.createdAt || '')));
      owner[pid] = Object.fromEntries(modes.slice(0, MAX_ANALYSIS_MODES));
    } else {
      owner[pid] = byMode;
    }

    all[key] = owner;
    saveAnalyzes(all);
    res.json({ success: true, modes: Object.keys(owner[pid]).length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save analyze' });
  }
});

// Удалить все анализы объекта (вызывается при удалении объекта)
app.delete('/api/analyzes/:propertyId', (req, res) => {
  try {
    const key = ownerKey(req);
    if (!key) return res.json({ success: true, removed: 0 });
    const all = loadAnalyzes();
    const owner = all[key];
    if (owner && owner[req.params.propertyId]) {
      delete owner[req.params.propertyId];
      if (Object.keys(owner).length === 0) delete all[key];
      saveAnalyzes(all);
    }
    // Публичные ссылки этого объекта отзываем вместе с отчётом: удалённый объект не должен
    // продолжать жить по отправленной ссылке
    const shares = loadShares();
    let revokedShares = 0;
    for (const sid of Object.keys(shares)) {
      if (shares[sid].owner === key && shares[sid].propertyId === req.params.propertyId) { delete shares[sid]; revokedShares++; }
    }
    if (revokedShares) saveShares(shares);
    res.json({ success: true, revokedShares });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete analyzes' });
  }
});

// ===== Публичные ссылки на анализ =====
// Отчёт можно отправить клиенту ссылкой без регистрации. В shares.json кладём СНИМОК
// отчёта (текст + название объекта), а не ссылку на запись: так ссылка не ломается,
// когда отчёт пересоздают. Повторный запрос для той же пары объект+режим возвращает
// прежний id со свежим текстом — отправленная ранее ссылка просто обновится.
const SHARES_FILE = './shares.json';
const SHARE_ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих символов (0/O, 1/l)
const MAX_SHARES_PER_OWNER = 100;

const loadShares = () => {
  try {
    if (fs.existsSync(SHARES_FILE)) return JSON.parse(fs.readFileSync(SHARES_FILE, 'utf8'));
  } catch (e) {}
  return {};
};
const saveShares = (s) => atomicWrite(SHARES_FILE, JSON.stringify(s));

const newShareId = () => {
  let id = '';
  for (let i = 0; i < 10; i++) id += SHARE_ID_ALPHABET[crypto.randomInt(SHARE_ID_ALPHABET.length)];
  return id;
};

// Создать (или обновить) публичную ссылку на сохранённый отчёт
app.post('/api/share', (req, res) => {
  try {
    const key = ownerKey(req);
    if (!key) return res.status(400).json({ error: 'Sign in or send X-Client-Id to create a share link' });

    const { propertyId, mode } = req.body || {};
    const pid = String(propertyId === undefined || propertyId === null ? '' : propertyId).slice(0, 64);
    const modeKey = String(mode || 'overview').slice(0, 20);
    if (!pid) return res.status(400).json({ error: 'propertyId is required' });
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,19}$/.test(modeKey)) return res.status(400).json({ error: 'Invalid mode' });

    const analyzes = loadAnalyzes();
    const entry = analyzes[key] && analyzes[key][pid] && analyzes[key][pid][modeKey];
    if (!entry) return res.status(404).json({ error: 'Nothing is saved for this property and mode yet' });

    const list = (loadProperties() || {})[key] || [];
    const prop = list.find(p => String(p.id) === pid) || {};
    const title = String(prop.name || prop.title || '').slice(0, 160);
    const location = String(prop.location || '').slice(0, 160);

    const shares = loadShares();
    const existingId = Object.keys(shares).find(sid => shares[sid].owner === key && shares[sid].propertyId === pid && shares[sid].mode === modeKey);
    if (!existingId && Object.values(shares).filter(s => s.owner === key).length >= MAX_SHARES_PER_OWNER) {
      return res.status(400).json({ error: `Too many shared links (max ${MAX_SHARES_PER_OWNER})` });
    }

    const id = existingId || newShareId();
    const previous = shares[id] || {};
    shares[id] = {
      owner: key,
      propertyId: pid,
      mode: modeKey,
      title: title || null,
      location: location || null,
      language: entry.language || null,
      question: entry.question || null,
      text: entry.text,
      savedAt: entry.createdAt || null,
      createdAt: previous.createdAt || new Date().toISOString(),
      views: previous.views || 0
    };
    saveShares(shares);
    res.json({ success: true, id, hash: `#a/${id}`, reused: !!existingId });
  } catch (e) {
    console.error('Share create error:', e);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// Открыть отчёт по ссылке — без авторизации
app.get('/api/share/:id', (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!new RegExp(`^[${SHARE_ID_ALPHABET}]{6,20}$`).test(id)) return res.status(404).json({ error: 'Link not found' });
    const shares = loadShares();
    const s = shares[id];
    if (!s) return res.status(404).json({ error: 'Link not found' });

    s.views = (s.views || 0) + 1;
    saveShares(shares); // счётчик просмотров — полезная обратная связь для брокера

    res.json({
      share: {
        id,
        title: s.title,
        location: s.location,
        mode: s.mode,
        language: s.language,
        question: s.question,
        text: s.text,
        savedAt: s.savedAt,
        views: s.views
      }
    });
  } catch (e) {
    console.error('Share read error:', e);
    res.status(500).json({ error: 'Failed to load shared report' });
  }
});

// Отозвать ссылку (может только владелец)
app.delete('/api/share/:id', (req, res) => {
  try {
    const key = ownerKey(req);
    const id = String(req.params.id || '');
    const shares = loadShares();
    const s = shares[id];
    if (!s) return res.json({ success: true, removed: 0 });
    if (!key || s.owner !== key) return res.status(403).json({ error: 'Not your link' });
    delete shares[id];
    saveShares(shares);
    res.json({ success: true, removed: 1 });
  } catch (e) {
    console.error('Share delete error:', e);
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', version: require('./package.json').version, models: MODELS });
});

// Отдаём собранный фронтенд
app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📊 API endpoint: http://localhost:${PORT}/api/analyze`);
  console.log(`📄 PDF парсинг: http://localhost:${PORT}/api/parse-property`);
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ВНИМАНИЕ: ANTHROPIC_API_KEY не установлен!');
    console.warn('   Создайте файл .env с вашим API ключом');
  }
});
