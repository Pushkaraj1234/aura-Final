# AURA — Backend & AI Rebuild: Final Report

This replaces the previous `FINAL_REPORT.md`, which described a Firebase/Firestore
migration. That migration never happened — there are no Firebase packages, files,
or config anywhere in this repository. This report describes what was actually
built in this session, against the real codebase.

## 1. What changed, in one paragraph

The app's storage layer moved from a single generic `items` JSON blob (and, before
that, a flat JSON file on disk) to a real Supabase Postgres schema with Row Level
Security. The AI layer was rebuilt around a trauma-informed screening taxonomy
(adapted from the `distress_pipeline.py` reference you provided) using Google
Gemini structured-output calls — not keyword matching. A new voice-tone feature
was added: when you record a voice reflection, the browser measures how it was
spoken (pitch variability, pace, pauses, loudness) entirely on-device, and sends
those numbers together with the transcript to Gemini, which reasons about your
emotional tone from both — including flagging when your words and your tone
disagree. Several real functional gaps (not just cosmetic ones) were found and
fixed along the way; see §5.

## 2. On the dataset — please read this

**There is no real clinical or training dataset in this project, and there
still isn't one after this work.** `distress_pipeline.py`'s `SAMPLE_ENTRIES` are
five illustrative demo strings, not training data — nowhere near enough to train
a model, and not intended to be. Two consequences follow:

- The **distress/risk scoring and 7-day trajectory model** (`server/predictiveModel.ts`,
  `src/services/participantStore.ts` analysis functions) is a transparent,
  hand-authored **rule engine** (weighted formula over stress/sleep/safety/connection
  deltas — see the README §3 for the exact formula). It is not a trained ML model,
  because there is no labeled dataset to train one on.
- The **trauma-informed screening and voice-tone signals** are produced by
  prompting an LLM (Gemini) with a fixed taxonomy and structured-output schema —
  this is genuinely LLM-based reasoning, not keyword matching, but it is also not
  a model fine-tuned on your own labeled data, because none exists.

If real, labeled data becomes available later (e.g. clinician-annotated
transcripts with risk outcomes), that would be the basis for training or
fine-tuning an actual predictive model. Until then, both the rule engine and the
LLM prompts are designed to be transparent and human-reviewed rather than to
claim clinical accuracy they can't have.

## 3. Backend: Supabase

Project: **Aura** (`wtkhcndftvsiaxstspsp`). Three migrations were applied:

- `aura_core_schema` — replaced the old catch-all `items` table with 14 real
  tables: `profiles`, `participants`, `check_ins`, `reflections`, `risk_predictions`,
  `risk_history`, `alerts`, `notifications`, `interventions`, `follow_ups`,
  `consents`, `support_notes`, `support_resources`, `audit_logs`. `reflections`
  includes dedicated columns for the new signals: `acoustic_pitch_variability`,
  `acoustic_speaking_rate`, `acoustic_pause_ratio`, `acoustic_energy`,
  `llm_emotional_tone`, `llm_tone_confidence`, `llm_trauma_indicators`,
  `llm_distress_signals`, `llm_risk_band`, `llm_crisis_flag`, `llm_rationale`,
  `llm_confidence`, `llm_suggested_action`.
- `aura_rls_and_triggers` — Row Level Security on all 14 tables (a participant
  sees only their own rows; a support worker/admin, checked via `profiles`, sees
  everything), using `SECURITY DEFINER` helper functions (`is_staff()`,
  `user_participant_id()`) to avoid recursive policy checks, plus a trigger that
  auto-creates a `profiles` row on sign-up.
- `aura_seed_data` — 3 demo participants, 1 demo check-in, 5 support resources,
  so the app has something to show immediately.

`mcp__Supabase__get_advisors` was run after applying these — no real issues, only
benign `SECURITY DEFINER` notices and an unrelated "leaked password protection
disabled" auth setting you may want to turn on in the Supabase dashboard.

**Express's role is now minimal by design**: it only proxies calls that need the
Gemini API key kept off the browser, plus the deterministic ML trend endpoint.
Every other read/write (participants, check-ins, alerts, notifications,
interventions, follow-ups, consents, support notes/resources, audit logs) goes
directly from the browser to Supabase Postgres, protected by RLS using the
signed-in user's real session — see `src/services/supabaseService.ts` and the
thin facade in `src/services/apiService.ts`.

## 4. AI: Gemini trauma-informed screening + voice tone

`server/aiService.ts` was rebuilt around the taxonomy in your reference file:

- **Trauma indicators**: physical_violence, sexual_violence, death_or_loss,
  forced_displacement, torture, witnessing_atrocity, psychological_abuse,
  none_detected.
- **Distress signals**: intrusive_memories, hypervigilance, emotional_numbing,
  dissociation, hopelessness, sleep_disturbance, survivor_guilt,
  social_withdrawal, none_detected.
- **Risk band**: low / moderate / elevated / high, plus a **crisis flag** that is
  never trusted from the LLM alone — a deterministic keyword-based safety check
  (`checkUrgentSafety`) can force the flag on even if the model misses it.

All of this runs through Gemini (`gemini-2.5-flash`) with `responseSchema`
structured JSON output, so the model can't return malformed or off-taxonomy data.

**Voice tone** (`analyzeVoiceTone`, wired end-to-end in
`src/components/VoiceRecorder.tsx` and `src/services/voiceRecording.ts`): while
you record, the Web Audio API samples the microphone locally to measure pitch
variability, speaking pace, pause ratio, and loudness — no audio ever leaves your
device. When you stop recording, the transcript plus those four numbers are sent
to Gemini, which returns an emotional-tone label, a confidence level, and —
notably — a **content-vs-delivery alignment** judgment: it explicitly flags cases
like saying "I'm fine" in a flat, quiet, halting voice as "mismatched," which is
itself surfaced as a signal rather than resolved away. This is the feature you
asked for: tone is inferred from measured delivery + words reasoned about
together by an LLM, not from scanning the transcript for keywords.

## 5. Real bugs found and fixed (not just the requested features)

While wiring the voice-tone feature end-to-end and auditing the rest of the app,
a few genuine functional gaps surfaced:

- **`VoiceRecorder.tsx` used `<ConfirmDialog>` without importing it.** This would
  have been a hard TypeScript/build failure the first time anyone tried to build
  the project. Fixed by adding the import.
- **Voice/text reflections were never persisted to the database.** The
  `reflections` table existed in the schema, and `apiService.reflections.create`
  existed, but nothing ever called it — the check-in save path silently dropped
  the entire reflection object (transcript, sentiment analysis, and now the new
  Gemini/voice-tone results) before sending the check-in to Supabase. Fixed in
  two places: `participantStore.ts` now includes `reflection` and
  `aiComprehensiveAnalysis` in the payload handed to the sync engine, and
  `supabaseService.ts`'s `checkIns.create` now fans the embedded reflection out
  into its own `reflections` row (mapping acoustic features and LLM output into
  the dedicated columns) immediately after the check-in row is created.
- **Notifications and consent preferences had zero persistence** (found and
  fixed earlier in this session, before the summary point this report picks up
  from): both were pure client-side state with no backend calls at all.
- **Dead risk-prediction endpoints**: `apiService.risk.*` called Express routes
  that didn't exist in the old router, failing silently. These now have real
  Supabase-backed implementations.

A repo-wide grep for stubbed handlers (`onClick={() => {}}`, dead `href="#"`
links, `TODO`/`FIXME`, alert()-only handlers) found nothing else obviously broken.

## 6. What I could NOT verify — please run this yourself

**I was not able to run `npm install`, `npm run lint` (TypeScript check), or
`npm run build` in this session.** The cloud workspace's network policy blocks
direct access to `registry.npmjs.org` (every request returns `403
host_not_allowed`, even though it's normally an allowed host — this looks like a
policy restriction specific to this session, not something I should work around).
Your linked computer doesn't currently expose a shell either (only file
staging/commit), so I couldn't run the install there instead.

Before you deploy or demo this, please run locally, in order:

```
npm install
npm run lint        # tsc --noEmit — will catch any TypeScript issues
npm run build        # vite build + esbuild bundle of server.ts
```

I've cross-checked types and call signatures by hand across every file I
touched or that touches Supabase/Gemini (matching `apiService` methods against
`supabaseService`'s implementations, matching the Gemini response schemas
against the TypeScript types that consume them, etc.), and fixed the
`ConfirmDialog` import bug that a build would have caught immediately — but a
real compiler run is the only way to be fully sure nothing else was missed, and
I couldn't do that here.

## 7. Environment variables

`.env.example` was updated to match what the code actually reads (it previously
listed `FIREBASE_API_KEY`, `DATABASE_URL`, and `JWT_SECRET`, none of which the
code uses anymore):

```
GEMINI_API_KEY=            # server-side only, never sent to the browser
BACKEND_PORT=8787          # optional, defaults to 3000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
CORS_ORIGINS=              # optional, comma-separated, production only
```

(`server.ts` was updated to actually read `BACKEND_PORT`/`CORS_ORIGINS` — they
were previously unused, dead config.)

## 8. Cleanup you may want to do by hand

I don't have file-delete access on your computer in this session, so these are
left in place — you can safely delete them:

- `server/db.ts` and `data/aura_database.json` — the old JSON-file backend,
  fully replaced by Supabase. Nothing imports either file anymore.
- `add_comprehensive_ai.cjs`, `fix_buttons.cjs`, `fix_ids.cjs`, `fix_ids2.cjs`,
  `fix_supabase.cjs`, `update_checkin.cjs`, `update_detail_render.cjs`,
  `update_detail_types.cjs`, `update_engine.cjs`, `update_server_ai.sh`,
  `update_types.cjs`, `update_voicerecorder.cjs` — one-off patch scripts from
  earlier development sessions, left over in the project root. None are
  referenced by `package.json` or imported anywhere; they're not part of the
  running app.

## 9. Files touched in this session

**New**: `server/supabaseServer.ts`.

**Rewritten**: `server/aiService.ts`, `server/apiRouter.ts`,
`src/services/supabaseService.ts`, `src/services/apiService.ts`,
`src/services/voiceRecording.ts`.

**Edited**: `server.ts`, `src/services/participantStore.ts`,
`src/services/authService.ts`, `src/services/notificationService.ts`,
`src/pages/ConsentManagement.tsx`, `src/types/index.ts`,
`src/components/ReflectionAnalysis.tsx`, `src/components/VoiceRecorder.tsx`,
`.env.example`, `README.md`.

**Deleted** (in the cloud workspace only — see §8 for your local copy):
`server/db.ts`, `data/aura_database.json`.

**Database**: 3 Supabase migrations applied directly to project `wtkhcndftvsiaxstspsp`
(see §3) — there is nothing to "run" locally for these; they're already live.
