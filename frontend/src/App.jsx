import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import RealEstateAgent from './real_estate_agent';
import SharedReport from './SharedReport';

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

  if (view === 'app') {
    return <RealEstateAgent onBackToLanding={handleBackToLanding} />;
  }

  if (view === 'share') {
    return <SharedReport shareId={shareId} onEnterApp={handleEnterApp} />;
  }

  return <LandingPage onEnterApp={handleEnterApp} />;
}

export default App;

