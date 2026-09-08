# AURA — Adaptive Distress Monitoring & Support Decision System
### AI-Powered Dynamic Mental Health Monitoring and Distress Prediction for Populations Affected by Atrocities

> **Smart India Hackathon (SIH) Prototype Submission**  
> *Core Principle: "AI-Assisted, Human-Decided • Distress Indicator ≠ Clinical Diagnosis"*

---

## 1. Executive Summary & Problem Statement

Victims of armed conflict, humanitarian crises, and atrocities face acute psychological trauma under conditions of displacement, resource scarcity, and destroyed social infrastructure. Traditional mental-health systems struggle with:
1. **Late Interventions**: Support is often requested only when acute crisis or severe decompensation has occurred.
2. **Counselor Burnout**: High caseloads prevent humanitarian workers from manually scanning multi-day trend fluctuations.
3. **Surveillance & Stigma**: Intrusive biometric or passive tracking breaches dignity and trust in vulnerable communities.

**AURA** solves this through a **trauma-informed, explainable, zero-surveillance decision-support platform** that detects subtle multi-day shifts in psychological distress before escalation, while strictly requiring human review and never issuing automated psychiatric diagnoses.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Voluntary Intake │ ──> │ Change Engine   │ ──> │ Trajectory XAI  │ ──> │ Counselor Review│
│ (Voice / Text)  │     │ (Multi-Day Δ)   │     │ (Factor Decomp) │     │ (Accept / Edit) │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
                                                                                 │
                                                                                 ▼
                                                                        ┌─────────────────┐
                                                                        │ Outcome Measure │
                                                                        │ (Pre/Post Δ)    │
                                                                        └─────────────────┘
```

---

## 2. 7-Stage Intelligence & Humanitarian Pipeline

1. **Monitor (Voluntary Intake)**: 1-question-per-screen trauma-informed check-ins with full skip options, optional voice or text reflections — voice recordings are transcribed in-browser and their vocal delivery (pitch, pace, pauses, loudness) is measured on-device and reasoned about by an LLM alongside the words — and multilingual support (English, हिन्दी, मराठी).
2. **Detect Change**: Dynamic rolling-window delta engine computes changes in Sleep, Stress, Environmental Safety, and Social Connection.
3. **Predict Trajectory**: 7-day predictive simulator models trajectory slopes (*Rapid Escalation, Gradual Drift, Volatile Fluctuation, Stable Routine, Post-Support Recovery*) with confidence intervals.
4. **Explain (Transparent XAI)**: Breaks down distress scores into percentage factor contributions (e.g. 35% Sleep Disruption, 30% Stress, 20% Safety Uncertainty, 15% Social Isolation).
5. **Recommend Support**: Suggests evidence-based humanitarian protocols (*1-on-1 counseling, peer circle, sleep stabilization, emergency safety transfer*).
6. **Human Review**: Counselors review, adjust, or override AI recommendations, logging every decision in an immutable Audit Log.
7. **Measure Outcome**: Pre- and post-intervention outcome tracking verifies whether scheduled follow-ups successfully resolved distress.

---

## 3. Mathematical Methodology & Distress Scoring

### A. Raw Distress Score Formula
$$\text{Distress Score} = w_{\text{stress}} \cdot S + w_{\text{sleep}} \cdot (6 - L) + w_{\text{safety}} \cdot \text{SafePenalty} + w_{\text{connection}} \cdot (6 - C) + \text{Bonus}_{\text{support}}$$

- $\text{Stress } (S \in [1, 5])$: Linear contribution ($0 - 25$ pts)
- $\text{Sleep } (L \in [1, 5])$: Inverted scale, $1 = \text{Severe Disruption}$ ($0 - 25$ pts)
- $\text{Environmental Safety}$: Yes ($0$), Mostly ($8$), Unsure ($18$), No ($25$)
- $\text{Social Connection } (C \in [1, 5])$: Inverted scale ($0 - 15$ pts)
- $\text{Support Request Flag}$: $+10$ pts

### B. Dynamic Delta & Trajectory Slope
$$\Delta_{\text{distress}} = \text{Score}_t - \text{Score}_{t-1}$$
$$\text{Slope} = \frac{\sum (t_i - \bar{t})(y_i - \bar{y})}{\sum (t_i - \bar{t})^2}$$

- **Rapid Spike**: $\Delta > +25$ pts within $\le 48$ hours.
- **Gradual Rise**: $\text{Slope} \ge +5.0$ pts/day over 3+ check-ins.
- **Improving/Recovery**: $\Delta \le -20$ pts post-support.

---

## 4. Responsible AI, Ethics & Data Dignity Guardrails

- **Non-Diagnostic Mandate**: Explicitly prohibits DSM/ICD psychiatric labels (e.g., PTSD, Depression, Psychosis). Outputs only assistive distress indicators.
- **Zero Passive Surveillance**: No camera scanning, keystroke telemetry, or location tracking.
- **Immediate Crisis Bypass**: Acute safety self-reports bypass scoring algorithms and trigger direct 24/7 humanitarian hotlines.
- **Granular Consent Management**: Participants can revoke check-in tracking, audio features, or counselor sharing anytime.
- **Immutable Worker Audit Trail**: Every AI suggestion review, status change, and note is logged with timestamps and reviewer IDs.

---

## 5. Offline-First & Mesh Architecture

Designed for disaster zones and transit camps:
- **Client-Side Scoring**: Rule engine executes directly in browser memory without external API dependencies.
- **Encrypted Local Storage**: Encrypted IndexedDB/LocalCache stores responses offline.
- **Batch Opportunistic Sync**: Automatically syncs signed payloads when workers enter cell connectivity.

---

## 6. Live Presentation & Hackathon Demonstration Guide

Click **"Presentation Mode"** (top navbar) to trigger the interactive **14-step Smart India Hackathon walkthrough**:
- Step 1: Crisis context & non-diagnostic framing
- Step 2: Trauma-informed intake & voice simulation
- Step 3: Change detection & trajectory early warnings
- Step 4: Explainable AI factor breakdown
- Step 5: Support plan generation & counselor review
- Step 6: Follow-up outcome tracking & community analytics
- Step 7: Fairness auditing & field-sync resilience

---

## 7. Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4, Lucide Icons, Recharts, Motion
- **Backend**: Express (Node/TypeScript) — hides the Gemini API key from the browser and runs the deterministic trend/ML model; every other read/write goes directly from the browser to Supabase Postgres under Row Level Security
- **Database & Auth**: Supabase Postgres (participants, check-ins, reflections, alerts, notifications, interventions, follow-ups, consents, support notes/resources, audit logs, risk predictions/history) with RLS policies scoped to each signed-in user; Supabase Auth for sign-up/sign-in
- **AI / LLM**: Google Gemini (`gemini-2.5-flash`) via structured JSON output for trauma-informed screening of reflections, comprehensive check-in analysis, and voice-tone reasoning (transcript + measured vocal-delivery features together — not keyword matching)
- **Voice**: Web Speech API for in-browser transcription; Web Audio API (`AnalyserNode`) for on-device pitch/pace/pause/loudness measurement, sent to the LLM alongside the transcript
- **Offline resilience**: Client-side rule engine + LocalStorage/IndexedDB queue with opportunistic background sync to Supabase when connectivity returns
- **Localization**: English, हिन्दी (Hindi), मराठी (Marathi)

> Note: the check-in scoring/trend engine is a transparent, hand-authored rule model (see §3) — it was not trained on a labeled clinical dataset, because no such dataset exists in this project. The trauma-informed screening and voice-tone signals are produced by prompting an LLM (Gemini) with a fixed taxonomy, not by a model trained in-house.

---

## 8. Deployment (Vercel)

The deployment has two halves and `vercel.json` is what connects them:

| Request | Handled by |
| --- | --- |
| `/assets/*`, `/favicon`, any real file | The static `vite build` output in `dist/` |
| `/api/*` | The serverless function at `api/index.ts` (mounts the same Express routers as `server.ts`) |
| Everything else (`/`, `/admin`, …) | Rewritten to `/index.html` so the SPA boots and reads the path itself |

That last rule matters: routing is client-side. `src/main.tsx` decides between the
participant/counselor app and the isolated admin app by reading
`window.location.pathname`, and `/admin` is reached through a plain `<a href="/admin">`
(a full page load, not an in-app transition). Without the SPA fallback rewrite,
Vercel looks for a file called `admin` in `dist/`, finds nothing, and serves its own
`404: NOT_FOUND` page before any JavaScript runs.

Likewise, `api/index.ts` only becomes a serverless function because it sits in the
top-level `api/` directory — Vercel does not look anywhere else, and never runs
`server.ts` (that entry calls `app.listen()`, which is for local dev and
self-hosting only).

### Required environment variables

Set these in **Vercel → Project → Settings → Environment Variables**, then redeploy
(env-var changes only take effect on a new build). See `.env.example` for the full
annotated list.

| Variable | Needed for |
| --- | --- |
| `ADMIN_PASSCODE` | Admin login — the passcode typed at `/admin` |
| `ADMIN_JWT_SECRET` | Signing the 2-hour admin session token |
| `SUPABASE_SERVICE_ROLE_KEY` | Every authenticated admin action (dashboard, queue, counselors, assignments, audit log) |
| `GEMINI_API_KEY` | The `/api/ai/*` and `/api/chat` routes |
| `SMTP_*` | Optional — counselor approval/rejection emails |

### Checking a deployment

`GET /api/config-status` reports which of the above are present. It returns booleans
only, never a value:

```json
{
  "status": "ok",
  "runtime": "vercel-serverless",
  "configured": { "ADMIN_PASSCODE": true, "ADMIN_JWT_SECRET": true, "SUPABASE_SERVICE_ROLE_KEY": false, ... }
}
```

If `/admin` shows Vercel's `404: NOT_FOUND`, the rewrites aren't live. If it loads but
login fails, read the message on the login form — it names the missing variable.

---
*Developed for Smart India Hackathon (SIH) • Humanitarian Mental Health & Disaster Response Innovation*
