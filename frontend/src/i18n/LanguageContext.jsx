// Общий контекст языка. Раньше провайдер и переключатель жили внутри real_estate_agent.jsx,
// из-за чего лендинг и публичный отчёт не имели доступа к переводам. Провайдер подключается
// один раз в App.jsx и оборачивает все экраны, язык хранится в том же localStorage ключе,
// что использовало приложение, поэтому выбор языка на лендинге действует и внутри приложения.
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { languages, getTranslation, detectLanguage, LANGUAGE_STORAGE_KEY } from './index';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};

// t('risk.low') и t('footer.rights', { year: 2026 })
export const useT = () => {
  const { language } = useLanguage();
  return (path, params) => getTranslation(language, path, params);
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(detectLanguage);

  useEffect(() => {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch {}

    // RTL для арабского + актуальный lang у <html> (было захардкожено en)
    const current = languages.find((l) => l.code === language);
    document.documentElement.setAttribute('dir', current?.rtl ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

const FlagImg = ({ country, size = 20 }) => (
  <img
    src={`https://flagcdn.com/w${size}/${country}.png`}
    srcSet={`https://flagcdn.com/w${size * 2}/${country}.png 2x`}
    width={size}
    alt=""
    className="rounded-sm shadow-sm"
    style={{ minWidth: size }}
  />
);

// Выпадающий список языков с флагами — тот же, что в шапке приложения
export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const currentLang = languages.find(l => l.code === language) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition"
      >
        <FlagImg country={currentLang.country} size={20} />
        <span className="text-sm font-medium hidden sm:inline">{currentLang.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-white/20 rounded-xl shadow-xl z-[100] overflow-hidden max-h-[400px] overflow-y-auto">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition text-left ${
                language === lang.code ? 'bg-blue-500/20' : ''
              }`}
            >
              <FlagImg country={lang.country} size={24} />
              <span className="text-sm">{lang.name}</span>
              {language === lang.code && (
                <Check className="w-4 h-4 text-blue-400 ml-auto" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
