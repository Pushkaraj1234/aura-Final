import React, { useState } from "react";
import { adminApiService } from "../services/adminApiService";
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

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return <AdminDashboard onLogout={() => setAuthed(false)} />;
};
