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
- Price: ${property.price} (use this EXACT price in your analysis)
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
    "price": {"score": <0-100>, "reason": "<explanation using the EXACT price ${property.price}>"},
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
