import React, { useState, useRef, useEffect } from 'react';
import { Building2, TrendingUp, AlertCircle, MapPin, Calendar, FileText, Search, Upload, Loader2, CheckCircle, X, Plus, FileUp, File, Trash2, Shield, RefreshCw, ChevronDown, ChevronUp, FolderOpen, Edit3, MessageSquare, Check } from 'lucide-react';

const STORAGE_KEYS = {
  PROPERTIES: 'real_estate_properties',
  RISKS: 'real_estate_risks'
};

// Компонент индикатора риска
const RiskIndicator = ({ risk, loading, onRefresh, compact = false }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Оценка риска...</span>
      </div>
    );
  }
  
  if (!risk) {
    return (
      <button onClick={onRefresh} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition text-sm">
        <Shield className="w-4 h-4" />
        <span>Оценить риск</span>
      </button>
    );
  }
  
  const score = risk.overallRisk;
  
  const getColor = () => {
    if (score <= 35) return { bg: 'bg-green-500', text: 'text-green-400', label: 'Низкий' };
    if (score <= 60) return { bg: 'bg-yellow-500', text: 'text-yellow-400', label: 'Средний' };
    return { bg: 'bg-red-500', text: 'text-red-400', label: 'Высокий' };
  };
  
  const color = getColor();
  
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color.bg}`} />
        <span className={`text-xs font-bold ${color.text}`}>{score}%</span>
      </div>
    );
  }
  
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-400" />
          <span className="font-semibold">Risk Score</span>
        </div>
        <button onClick={onRefresh} className="p-1.5 hover:bg-white/10 rounded-lg transition" title="Пересчитать">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      
      <div className="mb-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex gap-1">
            <div className={`w-4 h-4 rounded-full ${score <= 35 ? 'bg-green-500' : 'bg-green-500/30'}`} />
            <div className={`w-4 h-4 rounded-full ${score > 35 && score <= 60 ? 'bg-yellow-500' : 'bg-yellow-500/30'}`} />
            <div className={`w-4 h-4 rounded-full ${score > 60 ? 'bg-red-500' : 'bg-red-500/30'}`} />
          </div>
          <span className={`text-2xl font-bold ${color.text}`}>{score}%</span>
          <span className={`text-sm ${color.text}`}>{color.label} риск</span>
        </div>
        
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              score <= 35 ? 'bg-gradient-to-r from-green-600 to-green-400' :
              score <= 60 ? 'bg-gradient-to-r from-yellow-600 to-yellow-400' :
              'bg-gradient-to-r from-red-600 to-red-400'
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>10% Безопасно</span>
          <span>100% Опасно</span>
        </div>
      </div>
      
      <p className="text-sm text-gray-300 mb-3">{risk.summary}</p>
      
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition">
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {expanded ? 'Скрыть детали' : 'Показать детали'}
      </button>
      
      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="space-y-2">
            {Object.entries(risk.factors).map(([key, factor]) => {
              const labels = {
                developer: '🏗️ Застройщик',
                timeline: '📅 Сроки',
                price: '💰 Цена',
                location: '📍 Локация',
                liquidity: '💧 Ликвидность'
              };
              
              const factorColor = factor.score <= 35 ? 'bg-green-500' : 
                                  factor.score <= 60 ? 'bg-yellow-500' : 'bg-red-500';
              
              return (
                <div key={key} className="bg-white/5 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs">{labels[key]}</span>
                    <span className="text-xs font-bold">{factor.score}%</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1">
                    <div className={`h-full rounded-full ${factorColor}`} style={{ width: `${factor.score}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{factor.reason}</p>
                </div>
              );
            })}
          </div>
          
          {risk.recommendations?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-400 mb-2">💡 Рекомендации:</p>
              <ul className="space-y-1">
                {risk.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="text-blue-400">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Компонент пустого состояния
const EmptyState = ({ onAddClick }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
      <FolderOpen className="w-10 h-10 text-gray-500" />
    </div>
    <h3 className="text-xl font-semibold mb-2">Портфолио пустое</h3>
    <p className="text-gray-400 mb-6 max-w-sm">
      Загрузите PDF документы о недвижимости — AI автоматически извлечёт данные и оценит риски
    </p>
    <button
      onClick={onAddClick}
      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 rounded-xl font-medium transition"
    >
      <Plus className="w-5 h-5" />
      <span>Добавить первый объект</span>
    </button>
  </div>
);

// Модалка уточнения данных
const CorrectionModal = ({ property, onClose, onCorrection, loading }) => {
  const [text, setText] = useState('');
  
  const examples = [
    "Срок сдачи на самом деле Q2 2026, а не Q4 2027",
    "Застройщик - Emaar Properties, известная компания",
    "Локация - Dubai Marina, не Palm Jumeirah",
    "Цена снижена до 18,500,000 AED",
    "Это 3-комнатная квартира с видом на море"
  ];
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-orange-400" />
            <h3 className="text-xl font-bold">Уточнить данные</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-gray-400 text-sm mb-4">
          Опишите, какие данные нужно исправить. AI проанализирует и обновит информацию об объекте.
        </p>
        
        {/* Текущие данные */}
        <div className="bg-white/5 rounded-lg p-3 mb-4 text-xs">
          <p className="text-gray-400 mb-2">Текущие данные:</p>
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-gray-500">Название:</span> <span className="text-white">{property.name}</span></div>
            <div><span className="text-gray-500">Локация:</span> <span className="text-white">{property.location}</span></div>
            <div><span className="text-gray-500">Сдача:</span> <span className="text-white">{property.completion}</span></div>
            <div><span className="text-gray-500">Застройщик:</span> <span className="text-white">{property.developer}</span></div>
            <div><span className="text-gray-500">Цена:</span> <span className="text-white">AED {(property.price / 1000000).toFixed(2)}M</span></div>
            <div><span className="text-gray-500">Площадь:</span> <span className="text-white">{property.size} SF</span></div>
          </div>
        </div>
        
        {/* Поле ввода */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: Срок сдачи на самом деле Q2 2026..."
          className="w-full h-24 px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-500 resize-none mb-3"
          disabled={loading}
        />
        
        {/* Примеры */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-2">Примеры уточнений:</p>
          <div className="flex flex-wrap gap-1">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => setText(ex)}
                className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-gray-400 hover:text-white transition"
              >
                {ex.length > 35 ? ex.slice(0, 35) + '...' : ex}
              </button>
            ))}
          </div>
        </div>
        
        {/* Кнопки */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition"
            disabled={loading}
          >
            Отмена
          </button>
          <button
            onClick={() => onCorrection(text)}
            disabled={loading || !text.trim()}
            className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /><span>Обработка...</span></>
            ) : (
              <><Check className="w-5 h-5" /><span>Применить</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Уведомление об успешном обновлении
const UpdateNotification = ({ message, onClose }) => (
  <div className="fixed bottom-4 right-4 bg-green-500/20 border border-green-500/30 rounded-xl p-4 max-w-sm z-50 animate-pulse">
    <div className="flex items-start gap-3">
      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm text-green-300">{message}</p>
      </div>
      <button onClick={onClose} className="text-green-400 hover:text-green-300">
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const RealEstateAgent = () => {
  const [properties, setProperties] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROPERTIES);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [risks, setRisks] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RISKS);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [riskLoading, setRiskLoading] = useState({});
  
  // Состояния для загрузки PDF
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileInputRef = useRef(null);
  
  // Состояния для уточнения данных
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Сохранение в localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.PROPERTIES, JSON.stringify(properties)); } catch {}
  }, [properties]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.RISKS, JSON.stringify(risks)); } catch {}
  }, [risks]);

  useEffect(() => {
    if (properties.length > 0 && !selectedProperty) {
      setSelectedProperty(properties[0]);
    }
  }, [properties, selectedProperty]);

  // Функция уточнения данных
  const handleCorrection = async (correctionText) => {
    if (!selectedProperty || !correctionText.trim()) return;
    
    setCorrectionLoading(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/correct-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          property: selectedProperty, 
          correction: correctionText 
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.correction) {
        const { updates, explanation, affectsRisk, fieldsChanged } = data.correction;
        
        if (Object.keys(updates).length > 0) {
          // Обновляем объект
          const updatedProperty = { 
            ...selectedProperty, 
            ...updates,
            lastCorrected: new Date().toISOString(),
            corrections: [
              ...(selectedProperty.corrections || []),
              { date: new Date().toISOString(), text: correctionText, fields: fieldsChanged }
            ]
          };
          
          setProperties(prev => prev.map(p => 
            p.id === selectedProperty.id ? updatedProperty : p
          ));
          setSelectedProperty(updatedProperty);
          
          // Показываем уведомление
          setNotification(explanation);
          setTimeout(() => setNotification(null), 5000);
          
          // Пересчитываем риск если нужно
          if (affectsRisk) {
            setTimeout(() => assessRisk(updatedProperty), 500);
          }
          
          setShowCorrectionModal(false);
        } else {
          setNotification(explanation);
          setTimeout(() => setNotification(null), 5000);
        }
      }
    } catch (err) {
      console.error('Correction error:', err);
      setNotification('Ошибка при обработке уточнения');
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setCorrectionLoading(false);
    }
  };

  const assessRisk = async (property) => {
    setRiskLoading(prev => ({ ...prev, [property.id]: true }));
    
    try {
      const response = await fetch('http://localhost:3001/api/assess-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property })
      });
      
      const data = await response.json();
      
      if (data.success && data.risk) {
        setRisks(prev => ({ ...prev, [property.id]: data.risk }));
      }
    } catch (err) {
      console.error('Risk assessment error:', err);
    } finally {
      setRiskLoading(prev => ({ ...prev, [property.id]: false }));
    }
  };

  const handleFilesSelected = (fileList) => {
    const newFiles = Array.from(fileList).filter(file => file.type === 'application/pdf');
    if (newFiles.length === 0) {
      setUploadError('Пожалуйста, загрузите PDF файлы');
      return;
    }
    setPendingFiles(prev => [...prev, ...newFiles]);
    setUploadError(null);
  };

  const removeFile = (index) => setPendingFiles(prev => prev.filter((_, i) => i !== index));

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });

  const handleUploadAll = async () => {
    if (pendingFiles.length === 0) return;

    setUploadLoading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const filesData = await Promise.all(
        pendingFiles.map(async (file) => ({
          pdfBase64: await fileToBase64(file),
          fileName: file.name
        }))
      );

      const response = await fetch('http://localhost:3001/api/parse-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesData })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      if (data.success && data.property) {
        const newProperty = {
          id: Date.now(),
          name: data.property.name || 'Новый объект',
          location: data.property.location || 'Не указано',
          type: data.property.type || 'Не указано',
          price: data.property.price || 0,
          size: data.property.size || 0,
          completion: data.property.completion || 'Не указано',
          developer: data.property.developer || 'Не указано',
          paymentPlan: data.property.paymentPlan,
          view: data.property.view,
          floor: data.property.floor,
          bedrooms: data.property.bedrooms,
          bathrooms: data.property.bathrooms,
          parking: data.property.parking,
          amenities: data.property.amenities,
          buyerName: data.property.buyerName,
          bookingDate: data.property.bookingDate,
          additionalInfo: data.property.additionalInfo,
          addedAt: new Date().toISOString(),
          corrections: []
        };

        setProperties(prev => [...prev, newProperty]);
        setSelectedProperty(newProperty);
        setUploadSuccess(`✅ Объект "${newProperty.name}" добавлен!`);
        setPendingFiles([]);
        
        setTimeout(() => assessRisk(newProperty), 500);
        
        setTimeout(() => {
          setShowUploadModal(false);
          setUploadSuccess(null);
        }, 2000);
      }

    } catch (err) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Ошибка при загрузке файлов');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); handleFilesSelected(e.dataTransfer.files); };
  const handleFileSelect = (e) => { if (e.target.files.length > 0) handleFilesSelected(e.target.files); e.target.value = ''; };

  const handleDeleteProperty = (id) => {
    setProperties(prev => prev.filter(p => p.id !== id));
    setRisks(prev => { const newRisks = { ...prev }; delete newRisks[id]; return newRisks; });
    if (selectedProperty?.id === id) {
      setSelectedProperty(properties.length > 1 ? properties.find(p => p.id !== id) : null);
    }
  };

  const closeModal = () => {
    setShowUploadModal(false);
    setUploadError(null);
    setUploadSuccess(null);
    setPendingFiles([]);
  };

  const analyzeWithClaude = async (prompt) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data.content);
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Ошибка при получении анализа');
      setAnalysis(null);
    }
    setLoading(false);
  };

  const runAnalysis = (type) => {
    const prop = selectedProperty || properties[0];
    if (!prop) return;
    
    const extraInfo = [];
    if (prop.paymentPlan) extraInfo.push(`План оплаты: ${prop.paymentPlan}`);
    if (prop.view) extraInfo.push(`Вид: ${prop.view}`);
    if (prop.bedrooms) extraInfo.push(`Спальни: ${prop.bedrooms}`);
    if (prop.amenities?.length) extraInfo.push(`Удобства: ${prop.amenities.join(', ')}`);
    const extraContext = extraInfo.length > 0 ? `\nДополнительно: ${extraInfo.join('; ')}` : '';
    
    // Добавляем историю уточнений
    const correctionsContext = prop.corrections?.length > 0 
      ? `\nВАЖНО - Уточнения пользователя: ${prop.corrections.map(c => c.text).join('; ')}`
      : '';
    
    const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    
    let prompt = '';
    switch(type) {
      case 'news':
        prompt = `Сегодня ${today}. Найди последние новости о районе ${prop.location} в Дубае и застройщике ${prop.developer}.${correctionsContext} Ответ на русском языке, максимум 500 слов.`;
        break;
      case 'growth':
        prompt = `Сегодня ${today}. Проанализируй потенциал роста стоимости недвижимости в районе ${prop.location}, Дубай. Цена: ${prop.price} AED, площадь: ${prop.size} кв.футов, сдача: ${prop.completion}.${extraContext}${correctionsContext} Прогноз на 3-5 лет. Ответ на русском.`;
        break;
      case 'risks':
        prompt = `Сегодня ${today}. Оцени риски инвестиции в ${prop.name} в ${prop.location}. Застройщик: ${prop.developer}. Сдача: ${prop.completion}.${extraContext}${correctionsContext} Ответ на русском.`;
        break;
      case 'comparison':
        prompt = `Сегодня ${today}. Сравни районы Дубая: Palm Jumeirah, Dubai Marina, Downtown Dubai, Dubai Hills Estate. Цены, рост, перспективы. Ответ на русском.`;
        break;
      case 'timeline':
        prompt = `Сегодня ${today}. Проанализируй сроки строительства в ${prop.location}. Проект ${prop.name} сдача ${prop.completion}. Застройщик: ${prop.developer}.${correctionsContext} Реалистичность сроков? Ответ на русском.`;
        break;
      default:
        prompt = `Сегодня ${today}. Обзор объекта: ${prop.name} в ${prop.location}. Тип: ${prop.type}, цена: ${prop.price} AED, площадь: ${prop.size} кв.футов, сдача: ${prop.completion}, застройщик: ${prop.developer}.${extraContext}${correctionsContext} Оценка по 10-балльной шкале. Ответ на русском.`;
    }
    
    analyzeWithClaude(prompt);
  };

  const handleCustomQuery = () => {
    if (!query.trim() || !selectedProperty) return;
    const prop = selectedProperty;
    const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const correctionsContext = prop.corrections?.length > 0 
      ? ` Уточнения: ${prop.corrections.map(c => c.text).join('; ')}`
      : '';
    const contextPrompt = `Сегодня ${today}. Контекст: "${prop.name}" в ${prop.location}. ${prop.type}, ${prop.size} кв.футов, ${prop.price} AED, сдача ${prop.completion}, застройщик ${prop.developer}.${correctionsContext}\n\nВопрос: ${query}\n\nОтвет на русском.`;
    analyzeWithClaude(contextPrompt);
    setQuery('');
  };

  const currentProperty = selectedProperty;
  const currentRisk = currentProperty ? risks[currentProperty.id] : null;
  const currentRiskLoading = currentProperty ? riskLoading[currentProperty.id] : false;
  const pricePerSqft = currentProperty?.size ? (currentProperty.price / currentProperty.size).toFixed(0) : 0;

  // Если нет объектов
  if (properties.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-white/10 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">Добавить объект</h3>
                <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-gray-400 text-sm mb-4">Загрузите PDF документы. AI извлечёт данные и оценит риск.</p>
              <div
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-white/20 hover:border-white/40'}`}
              >
                <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" />
                <FileUp className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-300">Перетащите PDF файлы</p>
                <p className="text-xs text-gray-500">или нажмите для выбора</p>
              </div>
              {pendingFiles.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-400 mb-2">Файлы ({pendingFiles.length}):</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {pendingFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <File className="w-4 h-4 text-blue-400" />
                          <span className="text-sm truncate">{file.name}</span>
                        </div>
                        <button onClick={() => removeFile(index)} className="p-1 hover:bg-red-500/20 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleUploadAll} disabled={uploadLoading} className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {uploadLoading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Анализ...</span></> : <><Upload className="w-5 h-5" /><span>Загрузить</span></>}
                  </button>
                </div>
              )}
              {uploadError && <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg"><p className="text-red-400 text-sm">❌ {uploadError}</p></div>}
              {uploadSuccess && <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg"><p className="text-green-400 text-sm">{uploadSuccess}</p></div>}
            </div>
          </div>
        )}
        <div className="bg-black/30 backdrop-blur-md border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold">AI Агент Недвижимости</h1>
                <p className="text-sm text-gray-400">Анализ инвестиций в Дубае</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-6 py-16">
          <EmptyState onAddClick={() => setShowUploadModal(true)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
      {/* Модалки */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Добавить объект</h3>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-gray-400 text-sm mb-4">Загрузите PDF документы. AI извлечёт данные и оценит риск.</p>
            <div
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-white/20 hover:border-white/40'}`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleFileSelect} className="hidden" />
              <FileUp className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-300">Перетащите PDF файлы</p>
              <p className="text-xs text-gray-500">или нажмите для выбора</p>
            </div>
            {pendingFiles.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">Файлы ({pendingFiles.length}):</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {pendingFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="w-4 h-4 text-blue-400" />
                        <span className="text-sm truncate">{file.name}</span>
                      </div>
                      <button onClick={() => removeFile(index)} className="p-1 hover:bg-red-500/20 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  ))}
                </div>
                <button onClick={handleUploadAll} disabled={uploadLoading} className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                  {uploadLoading ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Анализ...</span></> : <><Upload className="w-5 h-5" /><span>Загрузить</span></>}
                </button>
              </div>
            )}
            {uploadError && <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg"><p className="text-red-400 text-sm">❌ {uploadError}</p></div>}
            {uploadSuccess && <div className="mt-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg"><p className="text-green-400 text-sm">{uploadSuccess}</p></div>}
          </div>
        </div>
      )}

      {showCorrectionModal && currentProperty && (
        <CorrectionModal
          property={currentProperty}
          onClose={() => setShowCorrectionModal(false)}
          onCorrection={handleCorrection}
          loading={correctionLoading}
        />
      )}

      {notification && (
        <UpdateNotification message={notification} onClose={() => setNotification(null)} />
      )}

      {/* Header */}
      <div className="bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-400" />
              <div>
                <h1 className="text-2xl font-bold">AI Агент Недвижимости</h1>
                <p className="text-sm text-gray-400">Анализ инвестиций в Дубае</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg transition">
                <Plus className="w-5 h-5 text-blue-400" />
                <span className="text-sm font-medium">Добавить</span>
              </button>
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium">{properties.length} объект(ов)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Объекты</h2>
                <button onClick={() => setShowUploadModal(true)} className="p-2 hover:bg-white/10 rounded-lg transition">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {properties.map(prop => {
                  const propRisk = risks[prop.id];
                  const riskColor = propRisk ? (
                    propRisk.overallRisk <= 35 ? 'bg-green-500' :
                    propRisk.overallRisk <= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  ) : 'bg-gray-500';
                  const hasCorrections = prop.corrections?.length > 0;
                  
                  return (
                    <div 
                      key={prop.id}
                      onClick={() => setSelectedProperty(prop)}
                      className={`p-4 rounded-lg border cursor-pointer transition relative group ${
                        selectedProperty?.id === prop.id ? 'bg-blue-500/20 border-blue-500/50' : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteProperty(prop.id); }}
                        className="absolute top-2 right-2 p-1 bg-red-500/20 hover:bg-red-500/40 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-3 h-3 text-red-400" />
                      </button>
                      
                      <div className="flex items-start justify-between mb-2">
                        <div className="pr-6">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-sm">{prop.name}</h3>
                            {hasCorrections && (
                              <span className="text-xs text-orange-400" title="Есть уточнения">✏️</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPin className="w-3 h-3" />
                            <span>{prop.location}</span>
                          </div>
                        </div>
                        {propRisk && (
                          <div className="flex items-center gap-1">
                            <div className={`w-2.5 h-2.5 rounded-full ${riskColor}`} />
                            <span className="text-xs font-bold">{propRisk.overallRisk}%</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-gray-400">Цена:</span>
                          <p className="font-medium text-green-400">AED {(prop.price / 1000000).toFixed(1)}M</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Сдача:</span>
                          <p className="font-medium">{prop.completion}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Кнопка уточнения */}
            {currentProperty && (
              <button
                onClick={() => setShowCorrectionModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-xl transition"
              >
                <Edit3 className="w-5 h-5 text-orange-400" />
                <span className="font-medium text-orange-300">Уточнить данные</span>
              </button>
            )}

            {currentProperty && (
              <RiskIndicator
                risk={currentRisk}
                loading={currentRiskLoading}
                onRefresh={() => assessRisk(currentProperty)}
              />
            )}

            {currentProperty && (
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-lg rounded-xl p-4 border border-white/10">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Стоимость</span>
                    <span className="font-bold text-green-400">AED {(currentProperty.price / 1000000).toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Цена/кв.фут</span>
                    <span className="font-bold">AED {pricePerSqft}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Застройщик</span>
                    <span className="font-bold text-xs text-right max-w-[120px] truncate">{currentProperty.developer}</span>
                  </div>
                  {currentProperty.corrections?.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <span className="text-xs text-orange-400">✏️ {currentProperty.corrections.length} уточнение(ий)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold mb-4">Анализ</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <button onClick={() => runAnalysis('overview')} disabled={loading || !currentProperty} className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/20 hover:from-blue-500/30 hover:to-blue-600/30 rounded-lg border border-blue-500/30 transition flex flex-col items-center gap-2 disabled:opacity-50">
                  <FileText className="w-6 h-6 text-blue-400" />
                  <span className="text-sm font-medium">Обзор</span>
                </button>
                <button onClick={() => runAnalysis('news')} disabled={loading || !currentProperty} className="p-4 bg-gradient-to-br from-purple-500/20 to-purple-600/20 hover:from-purple-500/30 hover:to-purple-600/30 rounded-lg border border-purple-500/30 transition flex flex-col items-center gap-2 disabled:opacity-50">
                  <Search className="w-6 h-6 text-purple-400" />
                  <span className="text-sm font-medium">Новости</span>
                </button>
                <button onClick={() => runAnalysis('growth')} disabled={loading || !currentProperty} className="p-4 bg-gradient-to-br from-green-500/20 to-green-600/20 hover:from-green-500/30 hover:to-green-600/30 rounded-lg border border-green-500/30 transition flex flex-col items-center gap-2 disabled:opacity-50">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                  <span className="text-sm font-medium">Рост</span>
                </button>
                <button onClick={() => runAnalysis('risks')} disabled={loading || !currentProperty} className="p-4 bg-gradient-to-br from-red-500/20 to-red-600/20 hover:from-red-500/30 hover:to-red-600/30 rounded-lg border border-red-500/30 transition flex flex-col items-center gap-2 disabled:opacity-50">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                  <span className="text-sm font-medium">Риски</span>
                </button>
                <button onClick={() => runAnalysis('comparison')} disabled={loading || !currentProperty} className="p-4 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 hover:from-yellow-500/30 hover:to-yellow-600/30 rounded-lg border border-yellow-500/30 transition flex flex-col items-center gap-2 disabled:opacity-50">
                  <MapPin className="w-6 h-6 text-yellow-400" />
                  <span className="text-sm font-medium">Районы</span>
                </button>
                <button onClick={() => runAnalysis('timeline')} disabled={loading || !currentProperty} className="p-4 bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 hover:from-indigo-500/30 hover:to-indigo-600/30 rounded-lg border border-indigo-500/30 transition flex flex-col items-center gap-2 disabled:opacity-50">
                  <Calendar className="w-6 h-6 text-indigo-400" />
                  <span className="text-sm font-medium">Сроки</span>
                </button>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold mb-4">Свой вопрос</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCustomQuery()}
                  placeholder="Например: Стоит ли продать через 2 года?"
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                  disabled={loading || !currentProperty}
                />
                <button onClick={handleCustomQuery} disabled={loading || !query.trim() || !currentProperty} className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg font-medium disabled:opacity-50 flex items-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Результаты</h2>
                {loading && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /><span>Анализ...</span></div>}
              </div>
              
              {error && <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg mb-4"><p className="text-red-400">❌ {error}</p></div>}
              
              {!analysis && !loading && !error && (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                  <Building2 className="w-12 h-12 mb-3 opacity-50" />
                  <p>Выберите тип анализа</p>
                </div>
              )}
              
              {analysis && <div className="whitespace-pre-wrap text-gray-200 leading-relaxed">{analysis}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealEstateAgent;
