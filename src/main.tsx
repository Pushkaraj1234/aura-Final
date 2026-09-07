import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AdminApp} from './admin/AdminApp.tsx';
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


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? <AdminApp /> : <App />}
  </StrictMode>,
);
