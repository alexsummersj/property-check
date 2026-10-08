import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import RealEstateAgent from './real_estate_agent';

// Хеш — источник правды о том, что показывать: #app — приложение, всё остальное — лендинг.
// Без хеша сразу пускаем в приложение только залогиненных, иначе человек попадает на лендинг
// и всегда может туда вернуться («На сайт», кнопка «Назад» в браузере).
const readView = () => {
  const hash = window.location.hash;
  if (hash === '#app') return 'app';
  if (hash === '#landing') return 'landing';
  try {
    return localStorage.getItem('property_check_token') ? 'app' : 'landing';
  } catch { return 'landing'; }
};

function App() {
  const [view, setView] = useState(readView);

  useEffect(() => {
    const onHashChange = () => setView(readView());
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

  return <LandingPage onEnterApp={handleEnterApp} />;
}

export default App;
