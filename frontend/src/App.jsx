import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import RealEstateAgent from './real_estate_agent';

function App() {
  const [showApp, setShowApp] = useState(() => {
    // Проверяем, был ли пользователь уже в приложении
    return localStorage.getItem('hasVisited') === 'true';
  });

  const handleEnterApp = () => {
    localStorage.setItem('hasVisited', 'true');
    setShowApp(true);
  };

  const handleBackToLanding = () => {
    setShowApp(false);
  };

  if (showApp) {
    return <RealEstateAgent onBackToLanding={handleBackToLanding} />;
  }

  return <LandingPage onEnterApp={handleEnterApp} />;
}

export default App;
