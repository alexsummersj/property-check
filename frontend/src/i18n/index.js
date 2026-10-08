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

export const getTranslation = (lang, path) => {
  const keys = path.split('.');
  const dig = (obj) => keys.reduce((o, k) => (o == null ? undefined : o[k]), obj);
  let result = dig(translations[lang] || translations['en']);
  // недостающий перевод берём из английского, а не показываем путь вроде "header.backToSite"
  if (result == null) result = dig(translations['en']);
  return result || path;
};
