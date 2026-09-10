import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AdminApp} from './admin/AdminApp.tsx';
import {LanguageProvider} from './context/LanguageContext.tsx';
import './index.css';

// Path-based bootstrap for the isolated Admin module (/admin). This is the
// only thing that decides between the two apps; App.tsx's own currentView
// state machine is completely untouched and never sees /admin.
const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('WebSocket closed without opened')) {
    event.preventDefault();
  }
});


// The language choice wraps both apps so a participant's selection survives
// navigation and reloads. The admin console is English-only by design, but it
// costs nothing to keep one provider at the root rather than two call sites
// that can drift apart.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      {isAdminRoute ? <AdminApp /> : <App />}
    </LanguageProvider>
  </StrictMode>,
);
