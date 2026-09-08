import express from 'express';
import cors from 'cors';
import apiRouter from '../server/apiRouter';
import adminRouter from '../server/adminRouter';

// ---------------------------------------------------------------------------
// Vercel serverless entry point.
//
// Why this file exists: server.ts (the original dev/self-hosted entry) starts
// a long-running Node process with app.listen(...). Vercel does not run
// long-running processes — it only invokes files under /api as short-lived
// serverless functions, one request at a time. Without a file here, nothing
// under /api/* ever ran on Vercel at all: the deployment only contained the
// static frontend build, so every fetch("/api/...") call (chat, AI analysis,
// ML predictions, the admin panel) fell through to Vercel's static routing
// and never reached this Express code.
//
// This file mounts the exact same routers server.ts mounts, minus the
// dev-only Vite middleware and the production static-file serving (Vercel
// already serves the built dist/ folder on its own, and app.listen() is
// neither needed nor allowed here). vercel.json rewrites every /api/*
// request to this one function, and Express's own routing below dispatches
// it from there — so req.url still looks like "/api/chat", "/api/admin/...",
// etc., matching what apiRouter/adminRouter already expect.
// ---------------------------------------------------------------------------

const app = express();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);
app.use('/api/admin', adminRouter);

export default app;
