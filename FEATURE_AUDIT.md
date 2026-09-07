# AURA — Feature Specification Cross-Verification

Audit of the codebase against the full feature specification
("AI-Powered Dynamic Mental Health Monitoring and Distress Prediction System
for Victims of Atrocities"). Last run: 2026-09-07.

Legend: ✅ present · 🟡 partial · ❌ missing · ⚪ deliberately out of scope

---

## A. USER (Survivor)

### 1. Onboarding & Identity
| Feature | Status | Where / Note |
|---|---|---|
| Sign-up / login (email, phone, or anonymous) | 🟡 | Email + password (`ParticipantSignUp.tsx`, Supabase Auth). Pseudonym field supported. No phone-only or true anonymous session. |
| Multi-language selection at first login | 🟡 | Check-in flow fully localized **en / hi / mr** (`i18n.ts`). Sign-up dropdown lists more languages than are implemented. |
| Consent flow (plain-language, who sees data, confidentiality limits) | ✅ | 3-item consent at sign-up + consent gate in check-in + `PrivacyArchitecture.tsx`. Explicit "duty to warn" clause not spelled out. |
| Emergency contact (optional, skippable) | ✅ **added** | Optional field at sign-up + editable/removable on `ParticipantProfile.tsx`; stored in Supabase Auth metadata. |

### 2. Monitoring & Self-Expression
| Feature | Status | Where / Note |
|---|---|---|
| Periodic mood check-ins (sliders/emoji) | ✅ | 12-step trauma-informed check-in, 1–5 scales, full skip. |
| Optional validated scale (PHQ-9 / GAD-7 / PCL-5) | ❌ | No standardized instrument. Custom trauma-informed items only. |
| Free-text or voice journaling | ✅ | Text + voice; on-device acoustic delivery analysis + LLM tone reasoning. |
| Mark entry private vs shared (exclude from AI) | ✅ | `shareWithWorker` toggle; AI screening skipped when not shared. |
| Passive signal opt-ins (typing cadence, sleep/activity) | ⚪ | Intentionally excluded — "Zero Passive Surveillance" design principle (README §4). |

### 3. AI Distress Prediction (user-facing)
| Feature | Status | Where / Note |
|---|---|---|
| Personal trend dashboard (plain language) | ✅ | `ParticipantProfile.tsx` trajectory chart, latest signal, tailored recommendations. |
| Gentle in-app nudges when distress rises | 🟡 | Recommendations shown, but no proactive "would you like to talk today?" prompt. |
| Transparency: why the system flagged something | ✅ | `CheckInResults.tsx` factor %, `ExplainableAISignal`, `ReflectionAnalysis`. |

### 4. Support & Safety
| Feature | Status | Where / Note |
|---|---|---|
| Secure messaging with assigned worker | ✅ | `Messages.tsx`, RLS-restricted to the assigned participant↔worker pair. |
| Session request / booking calendar | ❌ | Worker can log a "scheduled follow-up" note; no participant-facing booking. |
| SOS / crisis button + regional helplines | ✅ | `EmergencyModal.tsx`, navbar button, region filter, audit-logged. |
| Resource library + offline content | 🟡 | `SupportResources.tsx` with region/language/type filters. Library itself not cached for offline. |
| Community / peer support space (moderated) | ❌ | `CommunityInsights` is NGO-facing aggregate analytics, not a peer space. |

### 5. Privacy & Control
| Feature | Status | Where / Note |
|---|---|---|
| View / download / delete own data | ✅ **added** | "Download My Data" (JSON export) + existing "Reset My Check-in Data" + consent withdrawal. |
| Granular consent toggles | ✅ | `ConsentManagement.tsx` — 5 toggles persisted to `consents` table. |
| Notification preferences (discreet mode) | 🟡 | Preference types + `NotificationsPage`; no explicit silent/discreet mode. |

---

## B. SUPPORT WORKER (Counselor)

### 1. Onboarding
| Feature | Status | Where / Note |
|---|---|---|
| Registration with credential upload | ✅ | `SupportWorkerSignUp.tsx` → Supabase Storage. |
| Status tracker Pending → Approved → Active | ✅ | Admin verification queue; approval provisions the account. |
| Profile: specialization, languages, availability, max caseload | 🟡 | Specialization stored; no worker-facing profile editor for languages/availability. |

### 2. Caseload Dashboard
| Feature | Status | Where / Note |
|---|---|---|
| List of assigned users only | 🟡 | `SupportDashboard.tsx` shows the whole roster, not filtered to the signed-in worker's caseload. |
| Per-user distress trend, shared journals, risk-flag history | ✅ | `ParticipantDetail.tsx` — trend chart, XAI, forecast, intervention timeline. |
| Risk queue sorted by severity | ✅ | "Prioritized Signal Queue" + sortable table. |
| Explainability panel per alert | ✅ | `ExplainableAISignal`, trigger/explainability column. |

### 3. Communication & Care
| Feature | Status | Where / Note |
|---|---|---|
| Secure chat per assigned user | ✅ | `Messages.tsx`. |
| Session scheduling + private clinical notes | 🟡 | Private case notes with action tags ✅; no real scheduler/calendar. |
| Status tagging (stable / monitoring / high-risk / escalate) | ✅ | Case-disposition dropdown on `ParticipantDetail.tsx`. |
| Escalation button → notifies admin/crisis team | 🟡 | "Emergency Protocols" + status change; admin sees it via the new platform escalation feed rather than a direct ping. |

### 4. Reporting & Collaboration
| Feature | Status | Where / Note |
|---|---|---|
| Session summary logs | 🟡 | Case notes serve this role; no structured session-summary object/export. |
| Referral export (PDF / print) for handoff | ❌ | Not implemented. |
| Peer supervision / case-discussion space | ❌ | Not implemented. |

### 5. Wellbeing
| Feature | Status | Where / Note |
|---|---|---|
| Support-worker burnout / wellbeing self-check | ✅ **added** | `WorkerWellbeingCheck.tsx` on the dashboard — private 4-item vicarious-trauma self-check, local history, strain index + guidance. |

---

## C. ADMIN

### 1. Access & Oversight
| Feature | Status | Where / Note |
|---|---|---|
| Gated numeric-passcode entry | ✅ | Passcode `6279`, bcrypt-hashed at boot, IP rate-limited, short-lived JWT. |
| Dashboard: totals, pending approvals, active high-risk alerts, system health | ✅ **extended** | Counts + regional context + **new platform-wide "Active Escalations" feed**. "System health" is just the health endpoint. |

### 2. Support Worker Management
| Feature | Status | Where / Note |
|---|---|---|
| Review applications + view uploaded credentials | ✅ | `PendingQueueTab.tsx` (signed credential-doc URLs). |
| Approve / reject with reason | ✅ | Reason field, emailed to applicant. |
| On approval: auto-generate credentials + welcome email | ✅ | Email, or on-screen password fallback if SMTP unset. |
| Suspend / deactivate + auto-reassign caseload | 🟡 | Suspend/reactivate via native Supabase ban ✅; caseload is **not** auto-reassigned on suspension. |

### 3. Assignment Engine
| Feature | Status | Where / Note |
|---|---|---|
| Assign manually or by rule (caseload / language / specialization) | 🟡 | Manual assign + bulk auto-assign by lowest caseload ✅; no language/specialization matching. |
| Set max users per support worker | ✅ | `SettingsTab.tsx` (`app_settings.max_caseload_default`). |
| Rebalance / reassign on demand | ✅ | Reassign + bulk auto-distribute. |

### 4. Platform-Wide Safety Oversight
| Feature | Status | Where / Note |
|---|---|---|
| Live feed of high-risk / escalated cases platform-wide | ✅ **added** | `GET /api/admin/escalations` + "Active Escalations" card on the Overview tab. |
| Audit log of every admin action | ✅ | `AuditLogTab.tsx` + `audit_logs` (approvals, assignments, suspensions, resets). |
| Alert-threshold configuration (sensitivity tuning) | ❌ | `alertConfig.ts` thresholds are hardcoded, not admin-tunable. |
| False-positive / false-negative review queue | ❌ | Not implemented (Gap 3 / Gap 7). |

### 5. Content & Configuration
| Feature | Status | Where / Note |
|---|---|---|
| Manage resource-library content | 🟡 | CRUD UI exists (`SupportResources.tsx`) for signed-in staff; not surfaced in the admin panel. |
| Manage email / notification templates | ❌ | Templates hardcoded in `mailService.ts`. |
| Manage supported languages + regional crisis-line directory | 🟡 | Crisis lines live in `support_resources` (staff-editable); `EmergencyModal` directory is hardcoded; no language management. |
| Basic analytics (aggregate trends, response times, active users) | 🟡 | Overview counts + `CommunityInsights` aggregate trends + `WorkerTrendsModal`; no response-time metric. |

---

## Cross-Cutting

| Feature | Status | Where / Note |
|---|---|---|
| End-to-end encryption for messages & journal entries | 🟡 | Offline check-in queue is AES-GCM encrypted in IndexedDB (`offlineStorage.ts`). Messages/journals at rest are RLS-protected, not E2E encrypted. |
| Explainable-AI layer (human-readable reason per flag) | ✅ | Factor %, rationale, confidence, XAI components throughout. |
| Human-in-the-loop safeguard (no silent auto-escalation) | ✅ | Core design; AI never dispatches services; worker override requires written rationale. |
| Bias / fairness note (training population + limitations) | 🟡 | `ResponsibleAIBadges` + README §"Note". No trained model, so no training-population doc. |
| Offline / low-bandwidth mode | 🟡 | Check-in works offline with an encrypted opportunistic-sync queue. Resource content not cached. |
| Multilingual & culturally adapted content | 🟡 | Check-in flow fully en/hi/mr; the rest of the app is English-only. |
| Data minimization & right to delete | ✅ | Age range (not DOB), pseudonym, reset data, consent revoke, data download. |
| Audit trail for sensitive-data access | ✅ | `audit_logs` records participant reviews, emergency-resource access, and every admin action. |
| Crisis-protocol documentation enforced in UX | 🟡 | Described in `PrivacyArchitecture` + README pipeline; not a followable in-product runbook. |

---

## Added in this pass (all `tsc` / build clean, verified in-browser)

1. **Participant — Download My Data** (`ParticipantProfile.tsx`): one-click JSON export of the participant's own account, check-ins, reflections, consent settings, follow-ups, and latest analysis.
2. **Participant — Emergency / Trusted Contact** (`ParticipantSignUp.tsx`, `ParticipantProfile.tsx`, `authService.ts`, `types/index.ts`): optional, always-skippable, editable and removable; stored in Supabase Auth metadata.
3. **Support worker — Wellbeing / burnout self-check** (`components/WorkerWellbeingCheck.tsx` on `SupportDashboard.tsx`): private 4-item vicarious-trauma self-check, local trend history, strain index with non-prescriptive guidance. Never shared.
4. **Admin — Platform-wide escalation feed** (`server/adminRouter.ts` `GET /escalations`, `adminApiService.ts`, `admin/tabs/OverviewTab.tsx`): every open high-severity or escalated alert across all participants, with participant name, assigned worker, status, and score.

---

## Backlog — remaining gaps, by priority

Prioritised against the research gaps the project is positioned to address directly
(**Gap 1** population-specific, **Gap 4** access barriers, **Gap 6** detection→human loop).

| # | Gap | Effort | Ties to | Status |
|---|---|---|---|---|
| 1 | Admin alert-threshold / sensitivity config, wired into the rule engine | M | Gap 3, 7 | ✅ `SettingsTab.tsx` + `/config/alert-thresholds` + `alertConfig.ts` overrides |
| 2 | False-positive / false-negative review queue for admin/clinical lead | M–L | Gap 3, 7 | ✅ `FlagReviewTab.tsx` + `/flag-reviews` (precision/recall) |
| 3 | Caseload dashboard filtered to the signed-in worker's assigned users | S | Gap 6 | ✅ My-caseload/All toggle + data-layer scoping on dashboard, alerts, outcomes, audit |
| 4 | Direct worker→admin escalation ping (not just the shared feed) | S | Gap 6 | ✅ `ParticipantDetail.tsx` `handleEscalate` → notification + escalation feed + audit |
| 5 | Referral / session-summary export for handoff to psychiatrists, NGOs, legal bodies | M | Gap 1 (atrocity/legal context) | ✅ `handleExportReferral` (printable self-contained doc) |
| 6 | Proactive in-app nudge to the participant when distress rises | S | Gap 6 | ✅ `ParticipantProfile.tsx` nudge card (rising / elevated / support-requested) |
| 7 | Optional validated ultra-brief screen (PHQ-2 / GAD-2) as a skippable check-in step | M | Gap 2 | ⏳ deferred |
| 8 | Offline caching of the resource library + grounding content | M | Gap 4 | ⏳ deferred |
| 9 | Full-app localisation beyond the check-in flow (dashboards, profile, admin) | L | Gap 4, 5 | ⏳ deferred |
| 10 | Moderated peer-support space for participants (new table + RLS + moderation) | L | Gap 5 | ⏳ deferred |
| 11 | Peer-supervision / case-discussion space for workers | M–L | — | ⏳ deferred |
| 12 | Worker profile editor (languages, availability, max caseload) + language/specialisation-aware assignment | M | — | 🟡 profile editor done (`WorkerProfileCard.tsx` + `authService.updateWorkerProfile`); assignment matching still uses lowest-caseload only |
| 13 | Auto-reassign a suspended worker's caseload | S | — | ✅ `/workers/:id/suspend` redistributes by lowest caseload (unassigns if no capacity) + `assignment_history` + audit; `WorkersTab.tsx` surfaces the result |
| 14 | Admin management of email/notification templates, crisis-line directory, languages | M | Gap 5 | ⏳ deferred |
| 15 | Participant-facing session request / booking | M | — | 🟡 lightweight request done (`ParticipantProfile.tsx` → message + notification to the assigned counsellor); no calendar/slot booking |
| 16 | Message / journal encryption at rest (beyond RLS) | L | Gap 3 | ⏳ deferred |
| 17 | Session-summary structured object + response-time analytics | M | Gap 7 | ⏳ deferred |

S ≈ hours · M ≈ 1–2 days · L ≈ multi-day / needs schema + RLS + review.

Deferred items each need a new table + RLS policy, offline infra, or full-app i18n
scaffolding — out of scope for a safe pass on a live demo build.
