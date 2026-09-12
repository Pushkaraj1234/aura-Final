import express from 'express';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import apiRouter from './server/apiRouter.js';
import adminRouter from './server/adminRouter.js';
import reviewModerationRouter from './server/reviewModerationRouter.js';
import guardianRouter from './server/guardianRouter.js';

const app = express();
const PORT = 3000;
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

async function startServer() {
  // Middleware
  // Restrict CORS for security. In production, same-origin requests (the
  // built frontend served by this same Express app) don't need CORS at all;
  // CORS_ORIGINS only matters if the frontend is deployed separately.
  app.use(cors({
    origin: process.env.NODE_ENV === 'production'
      ? (allowedOrigins.length > 0 ? allowedOrigins : false)
      : '*',
    credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Mount API Router directly.
  // NOTE: This server only proxies the Gemini LLM calls (so the API key never
  // reaches the browser) and the deterministic ML trend model. All domain data
  // (participants, check-ins, alerts, etc.) is read/written directly from the
  // frontend against Supabase Postgres, protected by row-level security.
  app.use('/api', apiRouter);

  // Admin module — fully additive, isolated passcode/JWT auth (see
  // server/adminAuth.ts), never touches the participant/support-worker auth
  // flows above. Mounted on its own path so it can't collide with any
  // existing /api route.
  // Review moderation — a new route group, mounted ahead of the admin router
  // so its path wins. Nothing in the existing admin surface changes.
  // Guardian questionnaire — unauthenticated, token-gated.
  app.use('/api/guardian', guardianRouter);

  app.use('/api/admin/reviews', reviewModerationRouter);

  app.use('/api/admin', adminRouter);

  // Interactive API documentation endpoint
  app.get('/docs', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>AURA Mental Health & Distress Prediction API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>
window.onload = function() {
  SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis],
  });
};
</script>
</body>
</html>`);
  });

  app.get('/openapi.json', (_req, res) => {
    res.json({
      openapi: '3.0.2',
      info: {
        title: 'AURA Mental Health & Distress Prediction System API',
        description: 'AI-Powered Dynamic Mental Health Monitoring and Distress Prediction System for Victims of Atrocities',
        version: '1.0.0'
      },
      paths: {
        '/api/health': { get: { summary: 'Health Check', responses: { '200': { description: 'Healthy' } } } },
        '/api/ai/comprehensive-analysis': { post: { summary: 'LLM analysis of a full structured check-in + optional reflection' } },
        '/api/ai/analyze-reflection': { post: { summary: 'LLM trauma-informed screening of a text reflection' } },
        '/api/ai/analyze-voice-tone': { post: { summary: 'LLM emotional-tone reasoning over a voice transcript + measured vocal delivery features' } },
        '/api/ai/summarize-case': { post: { summary: 'LLM case summary for an authorized support worker' } },
        '/api/chat': { post: { summary: 'Conversational AI assistant' } },
        '/api/ml/predict/:participantId': { get: { summary: 'Deterministic 7-day risk trajectory prediction' } }
      },
      note: 'Domain data (participants, check-ins, alerts, notifications, interventions, follow-ups, consents, audit logs, support resources) is served directly from Supabase Postgres via the client SDK, protected by row-level security — see src/services/supabaseService.ts.'
    });
  });

  // Development: Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    // Bound to 0.0.0.0 (all interfaces), but that's not a browsable address —
    // point the developer at localhost, which is what actually works in a browser.
    console.log(`AURA Unified API & Client Server running on http://localhost:${PORT}`);
  });

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});
