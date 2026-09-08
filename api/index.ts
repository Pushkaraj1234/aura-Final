import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import apiRouter from '../server/apiRouter';
import adminRouter from '../server/adminRouter';

// ---------------------------------------------------------------------------
// Vercel serverless entry point.
//
// Why this file lives at api/index.ts specifically: server.ts (the original
// dev/self-hosted entry) starts a long-running Node process with
// app.listen(...). Vercel does not run long-running processes — it only turns
// files inside the top-level `api/` directory into serverless functions.
// This file previously sat at the repository root, where Vercel never looked
// at it, so nothing under /api/* existed on the deployment: every
// fetch("/api/...") call (chat, AI analysis, ML predictions and the whole
// admin panel) fell through to static routing and 404'd.
//
// It mounts the exact same routers server.ts mounts, minus the dev-only Vite
// middleware and the production static-file serving (Vercel serves the built
// dist/ folder itself, and app.listen() is neither needed nor allowed here).
// vercel.json rewrites every /api/* request to this one function; Vercel
// hands the function the original request URL, so req.url still reads
// "/api/chat", "/api/admin/login", etc. — exactly what the routers below
// expect.
// ---------------------------------------------------------------------------

const app = express();

// Behind Vercel's proxy, so trust X-Forwarded-For. The admin login lockout in
// server/adminAuth.ts buckets failed attempts by client IP and reads that
// header — without this, Express would report the proxy's address instead.
app.set('trust proxy', true);

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    // Same-origin requests (the normal case: frontend and API on the same
    // Vercel domain) aren't subject to CORS at all. This only matters if
    // something calls the API from a different origin.
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  })
);
// The multipart route (POST /api/admin/applications) is parsed by multer, so
// these two only claim the bodies they actually understand and leave the
// upload stream alone.
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '4mb' }));

// Deployment self-check. Deliberately reports presence only — never a value —
// so a misconfigured deployment can be diagnosed from the browser without
// leaking a passcode, JWT secret or service-role key.
app.get('/api/config-status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'aura-api',
    runtime: 'vercel-serverless',
    configured: {
      ADMIN_PASSCODE: !!process.env.ADMIN_PASSCODE,
      ADMIN_JWT_SECRET: !!process.env.ADMIN_JWT_SECRET,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      GEMINI_API_KEY: !!(process.env.GEMINI_API_KEY || process.env.API_KEY),
      SMTP_HOST: !!process.env.SMTP_HOST,
    },
  });
});

app.use('/api', apiRouter);
app.use('/api/admin', adminRouter);

// Unknown /api/* path — answer with JSON, not Express's HTML error page, so
// the frontend's `await res.json()` never blows up on an HTML body.
app.use((req: Request, res: Response) => {
  res.status(404).json({ detail: `No API route matches ${req.method} ${req.path}.` });
});

// Same reasoning for thrown errors: multer rejections (wrong file type, file
// too large) and anything unexpected must still come back as JSON.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[AURA API] unhandled error:', err);
  const status = err?.status || err?.statusCode || (err?.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  res.status(status).json({ detail: err?.message || 'Unexpected server error.' });
});

export default app;
