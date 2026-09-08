import React, { useEffect, useState } from "react";
import { adminApiService, ADMIN_SESSION_EXPIRED_EVENT } from "../services/adminApiService";
import { AdminLogin } from "./AdminLogin";
import { AdminDashboard } from "./AdminDashboard";

/**
 * Root of the isolated Admin experience. Deliberately not part of App.tsx's
 * currentView state machine — it is bootstrapped separately in main.tsx
 * based on the URL path (/admin), so the existing participant/counselor
 * app is completely untouched when this module isn't in use.
 */
export const AdminApp: React.FC = () => {
  const [authed, setAuthed] = useState(() => adminApiService.isAuthenticated());

  // The admin JWT expires after 2h. When any request comes back 401 the API
  // client clears the token and fires this event; without reacting to it the
  // dashboard stayed mounted with a dead session, showing a red error banner
  // on every tab and no obvious way to sign back in.
  useEffect(() => {
    const handleExpiry = () => setAuthed(false);
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleExpiry);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleExpiry);
  }, []);

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return <AdminDashboard onLogout={() => setAuthed(false)} />;
};
