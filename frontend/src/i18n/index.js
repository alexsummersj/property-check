import en from './en.json';
import ru from './ru.json';
import ar from './ar.json';
import zh from './zh.json';
import fr from './fr.json';
import es from './es.json';
import de from './de.json';
import it from './it.json';
import ja from './ja.json';
import th from './th.json';
import cs from './cs.json';
import kk from './kk.json';
import ka from './ka.json';

export const translations = { en, ru, ar, zh, fr, es, de, it, ja, th, cs, kk, ka };

// Тот же ключ, что использовало приложение, — выбор языка на лендинге действует и внутри него
export const LANGUAGE_STORAGE_KEY = 'real_estate_language';

export const languages = [
  { code: 'en', name: 'English', country: 'gb' },
  { code: 'ru', name: 'Русский', country: 'ru' },
  { code: 'ar', name: 'العربية', country: 'ae', rtl: true },
  { code: 'zh', name: '中文', country: 'cn' },
  { code: 'fr', name: 'Français', country: 'fr' },
  { code: 'es', name: 'Español', country: 'es' },
  { code: 'de', name: 'Deutsch', country: 'de' },
  { code: 'it', name: 'Italiano', country: 'it' },
  { code: 'ja', name: '日本語', country: 'jp' },
  { code: 'th', name: 'ไทย', country: 'th' },
  { code: 'cs', name: 'Čeština', country: 'cz' },
  { code: 'kk', name: 'Қазақша', country: 'kz' },
  { code: 'ka', name: 'ქართული', country: 'ge' }
];

// Язык по умолчанию: сохранённый выбор, иначе язык браузера (ru-RU → ru), иначе английский
export const detectLanguage = () => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && translations[stored]) return stored;
  } catch {}
  const nav = (typeof navigator !== 'undefined' && (navigator.language || '')) || '';
  const code = nav.toLowerCase().split(/[-_]/)[0];
  return translations[code] ? code : 'en';
};

export const getTranslation = (lang, path, params) => {
  const keys = path.split('.');
  const dig = (obj) => keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  let result = dig(translations[lang] || translations['en']);
  // недостающий перевод берём из английского, а не показываем путь вроде "header.backToSite"
  if (result == null) result = dig(translations['en']);
  if (params && typeof result === 'string') {
    for (const [key, value] of Object.entries(params)) {
      result = result.split(`{${key}}`).join(value);
    }
  }
  return result || path;
};
