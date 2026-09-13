import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AdminApp} from './admin/AdminApp.tsx';
import {GuardianForm} from './pages/GuardianForm.tsx';
import {PrivacyPolicy} from './pages/Legal/PrivacyPolicy.tsx';
import {TermsAndConditions} from './pages/Legal/TermsAndConditions.tsx';
import {LanguageProvider} from './context/LanguageContext.tsx';
import './index.css';

// Path-based bootstrap for the isolated Admin module (/admin). This is the
// only thing that decides between the two apps; App.tsx's own currentView
// state machine is completely untouched and never sees /admin.
const isAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

// The two legal documents live at real paths so a link to either one survives
// being copied into an email, a store listing or a compliance form. App.tsx
// navigates by view state, which cannot be linked to from outside, so they are
// bootstrapped here alongside /admin rather than added to that state machine.
const legalRoute = (() => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  if (path === '/privacy-policy') return 'privacy-policy' as const;
  if (path === '/terms') return 'terms' as const;
  return null;
})();

// A guardian arrives with a one-time link and has no account, so they must not
// meet the sign-in screen. The decision is made here rather than inside App
// because App runs hooks throughout its body — returning early from within it
// would change how many hooks run between renders and crash on the next one.
const guardianToken = (() => {
  if (typeof window === 'undefined') return null;
  const t = new URLSearchParams(window.location.search).get('guardian');
  // Long enough to be one of ours. Anything shorter is rejected by the API in
  // any case; this only avoids rendering a form for an obvious typo.
  return t && t.length >= 20 ? t : null;
})();

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
      {legalRoute === 'privacy-policy' ? (
        <PrivacyPolicy />
      ) : legalRoute === 'terms' ? (
        <TermsAndConditions />
      ) : guardianToken ? (
        <GuardianForm token={guardianToken} />
      ) : isAdminRoute ? (
        <AdminApp />
      ) : (
        <App />
      )}
    </LanguageProvider>
  </StrictMode>,
);
