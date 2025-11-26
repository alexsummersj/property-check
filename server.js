const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();
const path = require('path');
const app = express();
const PORT = 3001;

// Middleware - ВАЖНО: увеличенный лимит для PDF файлов
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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
const bcrypt = require('bcryptjs');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'property-check-secret-key-change-in-production';
const USERS_FILE = './users.json';

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
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Регистрация
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const users = loadUsers();
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now(),
      email,
      name: name || email.split('@')[0],
      password: hashedPassword,
      plan: 'free',
      analysisCount: 0,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);
    
    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '30d' });
    
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
    
    const users = loadUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    
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
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = loadUsers();
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    res.json({ 
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan, analysisCount: user.analysisCount }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// API endpoint для анализа
app.post('/api/analyze', async (req, res) => {
  try {
    if (!API_KEY || API_KEY === 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
      return res.status(500).json({ 
        error: '🔑 API ключ не настроен! Откройте файл .env и добавьте ваш ключ от console.anthropic.com'
      });
    }

    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log('📤 Отправляю запрос в Claude API...');
    
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    console.log('✅ Ответ получен!');

    if (!message || !message.content || !message.content[0] || !message.content[0].text) {
      console.error('⚠️ Неожиданный формат ответа:', JSON.stringify(message, null, 2));
      return res.status(500).json({ 
        error: 'Неожиданный формат ответа от API',
        details: JSON.stringify(message)
      });
    }

    res.json({ 
      content: message.content[0].text 
    });
    
  } catch (error) {
    console.error('❌ Ошибка API:', error.message);
    
    let errorMessage = 'Ошибка при получении анализа';
    
    if (error.message.includes('401') || error.message.includes('authentication')) {
      errorMessage = '🔑 Неверный API ключ! Проверьте ключ в файле .env';
    } else if (error.message.includes('429')) {
      errorMessage = '⏳ Превышен лимит запросов. Подождите минуту и попробуйте снова';
    } else if (error.message.includes('insufficient')) {
      errorMessage = '💳 Недостаточно средств на балансе Anthropic. Пополните баланс на console.anthropic.com';
    } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
      errorMessage = '🌐 Нет подключения к интернету';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Parse property from text input
app.post('/api/parse-text', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim().length < 10) {
      return res.status(400).json({ error: 'Please provide property details' });
    }

    // Шаг 1: Валидация - это вообще про недвижимость?
    const validationResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Is this text about real estate property (apartment, house, villa, land, commercial property for sale/rent/investment)? Answer only "YES" or "NO".

Text: "${text.substring(0, 500)}"`
      }]
    });

    const isValid = validationResponse.content[0].text.trim().toUpperCase().includes('YES');
    
    if (!isValid) {
      return res.status(400).json({ 
        error: 'This doesn\'t appear to be real estate information. Please provide details about a property (apartment, house, villa, etc.)' 
      });
    }

    // Шаг 2: Парсинг данных
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
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
  "size": <number in sq.ft or sq.m>,
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

    const content = message.content[0].text;
    
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
app.post('/api/parse-property', async (req, res) => {
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
  "size": площадь в кв.футах как число (например: 4306.32),
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

// Валидация: это вообще про недвижимость?
    const validationResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: [
          contentParts[0],
          {
            type: 'text',
            text: 'Is this document about real estate property (apartment, house, villa, land, commercial property for sale/rent/investment)? Answer only "YES" or "NO".'
          }
        ]
      }]
    });

    const isValidPdf = validationResponse.content[0].text.trim().toUpperCase().includes('YES');
    
    if (!isValidPdf) {
      console.log('❌ PDF не про недвижимость');
      return res.status(400).json({ 
        error: 'This document doesn\'t appear to be about real estate. Please upload a property brochure, listing, or sales document.' 
      });
    }
    
    console.log('✅ PDF валидация пройдена');
    
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: contentParts
      }]
    });

    console.log('✅ PDF файлы распарсены!');
    
    let responseText = message.content[0].text;
    
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
    
    let errorMessage = 'Ошибка при парсинге PDF';
    if (error.message.includes('401')) {
      errorMessage = '🔑 Неверный API ключ!';
    } else if (error.message.includes('Could not process')) {
      errorMessage = '📄 Не удалось прочитать PDF. Попробуйте другой файл.';
    } else if (error.message.includes('too large')) {
      errorMessage = '📄 Файлы слишком большие. Попробуйте загрузить меньше файлов.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: error.message 
    });
  }
});

// Endpoint для оценки риска объекта

app.post('/api/assess-risk', async (req, res) => {
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
      model: 'claude-opus-4-5-20251101',
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
- Size: ${property.size} sq.ft
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
    
    let responseText = message.content[0].text;
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
    res.status(500).json({ error: 'Ошибка при оценке риска', details: error.message });
  }
});

// Endpoint для уточнения/корректировки данных объекта
app.post('/api/correct-property', async (req, res) => {
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
      model: 'claude-opus-4-5-20251101',
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
    
    let responseText = message.content[0].text;
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
    res.status(500).json({ 
      error: 'Ошибка при обработке уточнения',
      details: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
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
