import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import RealEstateAgent from './real_estate_agent';
import SharedReport from './SharedReport';
import { LanguageProvider } from './i18n/LanguageContext';

// Хеш — источник правды о том, что показывать: #app — приложение, #a/<id> — публичный
// отчёт по ссылке, всё остальное — лендинг. Без хеша сразу пускаем в приложение только
// залогиненных, иначе человек попадает на лендинг и всегда может туда вернуться
// («На сайт», кнопка «Назад» в браузере).
const readShareId = () => {
  const m = /^#a\/([A-Za-z0-9]{6,20})$/.exec(window.location.hash || '');
  return m ? m[1] : null;
};

const readView = () => {
  const hash = window.location.hash;
  if (hash === '#app') return 'app';
  if (hash === '#landing') return 'landing';
  // Ссылка сброса пароля (#reset/<token>) — тоже приложение: модалка сама подхватит токен
  if (hash.startsWith('#reset/')) return 'app';
  if (readShareId()) return 'share';
  // Якоря лендинга (#features, #pricing) не должны выбрасывать залогиненного в приложение
  if (/^#(features|how-it-works|pricing)$/.test(hash)) return 'landing';
  try {
    return localStorage.getItem('property_check_token') ? 'app' : 'landing';
  } catch { return 'landing'; }
};

function App() {
  const [view, setView] = useState(readView);
  const [shareId, setShareId] = useState(readShareId);

  useEffect(() => {
    const onHashChange = () => { setView(readView()); setShareId(readShareId()); };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const handleEnterApp = () => {
    try { localStorage.setItem('hasVisited', 'true'); } catch {}
    // присваивание хеша само вызовет hashchange; отдельный setView — на случай повторного клика
    if (window.location.hash === '#app') setView('app');
    else window.location.hash = '#app';
  };

  const handleBackToLanding = () => {
    if (window.location.hash === '#landing') setView('landing');
    else window.location.hash = '#landing';
  };

  const screen = view === 'app'
    ? <RealEstateAgent onBackToLanding={handleBackToLanding} />
    : view === 'share'
      ? <SharedReport shareId={shareId} onEnterApp={handleEnterApp} />
      : <LandingPage onEnterApp={handleEnterApp} />;

  // Язык один на все экраны: лендинг, приложение и публичный отчёт
  return <LanguageProvider>{screen}</LanguageProvider>;
}

export default App;

