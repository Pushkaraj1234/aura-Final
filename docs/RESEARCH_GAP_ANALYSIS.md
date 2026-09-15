# AURA — Research Positioning & Gap Analysis

Audit of the shipped codebase against the seven-point critique (validated
assessment, emotion-AI dependence, human-support workflow, outcome tracking,
multilingual/cultural layer, victim co-design, privacy architecture), against
the proposed "Dynamic Victim Well-being Profile" redesign, and against the
international literature — not only the Indian paper the critique cites.

Method: the live deployment could not be fetched from the build environment
(egress-blocked), so every "you have this" claim below is read off the source
that Vercel deploys, with the file named. Last run: 2026-09-15.

---

## Part 1 — Executive summary

**The critique is aimed at the proposal, not at the code.** Roughly 60% of
what it asks for is already built, and on two points the code is *stronger*
than the advice. Rebuilding those would waste the time you have.

| # | Critique asks for | Reality in the code | Verdict |
|---|---|---|---|
| 1 | Validated screening instruments | Zero. No PHQ, GAD, WHO-5, K10, IES-R, PCL-5 anywhere | **Real gap — biggest one** |
| 2 | Stop letting Emotion AI decide | Voice never touches the score. LLM capped at ±15 pts, evidence-scaled | **Already solved, better than asked** |
| 3 | Full human-support workflow | Alerts, escalation ladder, override-with-rationale, audit log exist. **No clocks** | **Partial — SLA layer missing** |
| 4 | Intervention outcome tracking | `InterventionFollowUp` with pre/post delta + outcome verdict exists | **Mostly there — re-measure instrument missing** |
| 5 | Indian multilingual + cultural layer | 23 languages, somatic-idiom items, narrative-exclusion from MT | **Strong — but unvalidated** |
| 6 | Victim/survivor co-design | Nothing in the repo | **Real gap — cheapest to fix** |
| 7 | Privacy & consent architecture | 5 granular consents, audit log, export, delete, RLS, AES-GCM offline | **Strong — governance docs missing** |
| — | Multidimensional well-being profile | Single scalar score only | **Real gap** |
| — | District / State dashboard | 4 hardcoded mock regions | **Real gap** |
| — | Multi-channel (IVRS/SMS/14566) | 14566 is a free-text field. No telephony | **Real gap — equity-critical** |

**The one-line answer to "why should we trust this score?"** is not more AI.
It is: *anchor the AURA score to a validated instrument and report the
correlation between them.* Everything else in this document is secondary to
that.

---

## Part 2 — What you already have (say this out loud to judges)

Read from source, with file references.

### 2.1 A fully transparent, auditable score

`src/services/riskEngine.ts` — `explainRawScore()` returns the arithmetic, not
just the number, and `ScoreFormulaCard` renders those exact terms. Screen and
source cannot drift apart. Weights: Safety 28, Stress 22, Emotional wellbeing
22, Sleep 17, Social connection 11 — summing to exactly 100, no normalisation.
`SCORE_VERSION = 2` is stored per check-in, so a scoring change never silently
rewrites history.

There is also a deliberate de-biasing decision already made: asking for support
used to add 10 points and no longer does, because it meant *"an identical person
who declined help scored ten points lower"* — penalising exactly the people
least likely to ask. That is a fairness fix you made before anyone told you to.
Judges should hear it.

### 2.2 Emotion AI is already subordinated — the critique's point 2 is done

This is worth being precise about, because the critique gets your own system
wrong and you can correct it from evidence:

- **Voice acoustics never enter the distress score.** Grepping
  `riskEngine.ts` and `recommendationEngine.ts` for `voiceTone`, `acoustic`,
  `pitchVar`, `toneVerdict` returns nothing. Pitch variability, pause ratio and
  the words-vs-delivery verdict feed only `concordanceEngine.ts`.
- **The LLM is capped.** `AI_SCORE_ADJUSTMENT_LIMIT = 15` points, and
  `aiAdjustmentCapFor()` scales that cap by how much the person actually wrote:
  nothing below 40 characters, full ±15 only past 400. The stated reason —
  *"a sentence moving the score by a sixth of the whole scale is not a reading
  of that sentence, it is the cap being spent on almost nothing"* — is the
  right instinct.
- **Safety escalation bypasses the model entirely** and pins to 100.

So the architecture the critique recommends — *self-report + text + voice +
behaviour + case events → combined assessment → human verification*, never
*voice sounds stressed → high risk* — is what is running. You do not need to
change this. You need to **document** it, because it is a defence against a
well-evidenced problem: the 2025 JMIR Mental Health systematic review of
speech-emotion recognition found the field's datasets are overwhelmingly
English or Mandarin, single-cultural-context, and that patient selection
carried a high risk of bias across the included studies.

### 2.3 The concordance engine — your actual research contribution

`src/services/concordanceEngine.ts` (355 lines) asks a second question the
score cannot: **does everything else we have agree with what this person
said?** Hours slept, meals, left-home/spoke-to-anyone, somatic symptoms, voice
delivery, reflection language and check-in rhythm are each marked *supports*,
*contradicts* or *neutral* against the stated wellbeing. Divergence routes to a
"Worth a second look" queue **regardless of how low the distress score is.**

Two design rules keep it defensible: it never overwrites the self-report, and
it is never shown to the participant as an accusation. And the treatment of
silence is correct — withdrawal from the check-in is the one signal allowed to
stand alone, *"because requiring corroboration would guarantee that whoever
goes quiet is exactly whoever never gets looked at."*

**This is a stronger and more original contribution than the multidimensional
profile the critique proposes.** Self-report validity in populations who cannot
safely disclose is an open, published problem, and almost nothing in the
digital-mental-health literature instruments it. Lead with this.

### 2.4 Cultural adaptation that is real, not claimed

- **Somatic idioms of distress.** `SomaticSymptom` (headaches, appetite change,
  unexplained pain, palpitations, exhaustion) exists because *"across much of
  South Asia distress is voiced through the body … by people who will sincerely
  rate their mood as fine."* That is a substantive cultural adaptation, not a
  language toggle.
- **Functional signals over mood self-report.** `FunctionalSignals` —
  *"someone who will not say 'I feel hopeless' will still say they slept three
  hours and have not left the house."*
- **Atrocity-specific intake.** Displacement, arbitrary detention/torture,
  identity-based persecution, family disappearance, livelihood and
  cultural-heritage destruction; and on the needs side: truth and legal
  accountability, safe shelter/asylum, somatic healing, livelihood restart,
  family tracing. No general-population mental-health app has these.
- **Reporting history including `fear_retaliation` and `dismissed`** — the
  legal-process dimension of the harm, captured at intake.

### 2.5 Language architecture

23 languages (Eighth Schedule + English) in `LanguageCode`; `en`/`hi`/`mr` as
hand-written dictionaries; the rest through Bhashini at runtime
(`translation.ts`, `domTranslator.ts`), with an LRU cache and RTL support.

The best decision in there: `data-no-translate` excludes survivor narratives
from machine translation, because *"sending a survivor's account of what
happened to them to a third-party translation service is not"* acceptable.
Scores, dates and IDs are also excluded so `"47 / 100"` is never mangled.

### 2.6 Human-in-the-loop, outcome tracking, privacy

- `escalationEngine.ts`: a four-level ladder (`none → watch → contact →
  urgent`) with monotonic raising and time windows.
- `InterventionFollowUp`: `originalScore`, `followUpScore`, `scoreDelta`,
  `outcome ∈ {improving, no_change, worsening, pending}` — the closed loop the
  critique asks for in point 4 already has a schema.
- `FlagReviewTab` computes precision/recall on flags. Most hackathon projects
  have no error analysis at all.
- Consent: five independent toggles (`wellbeingCheckIns`, `supportWorkerSharing`,
  `optionalFreeTextSharing`, `optionalVoiceFeature`, `communityAggregateAnalytics`),
  plus data export, reset, revocation, RLS, an immutable `audit_logs` trail, and
  AES-GCM encryption of the offline queue in IndexedDB.

---

## Part 3 — What is genuinely missing

### GAP 1 — No validated instrument anywhere *(critical)*

`grep -rniE "phq|gad-?7|pcl-?5|who-?5|k10|ies-r" src/ server/ supabase/` returns
**nothing**.

Your five scored items are hand-authored and the weights (28/22/22/17/11) are
asserted, not derived. That is the honest answer to *"how is this calculated and
why should we trust it?"* — right now, the arithmetic is fully auditable and the
**weights are not justified by anything.** Transparency is not validity. A judge
who knows psychometrics will separate those two immediately.

One near-miss worth knowing: check-in steps 4–7 already use the **exact WHO-5
response scale** (*All of the time / Most of the time / Some of the time /
Rarely / At no time*), but the item wording is your own and nothing is scored as
WHO-5. You are one careful edit away from a real instrument.

### GAP 2 — The score is one number, not a profile

There is no dimension model. `CaseEventType` covers `hearing | threat |
intimidation | police_contact | other`, and the intake asks about livelihood,
legal accountability, shelter and family tracing — but these are **one-off
intake tags, not tracked dimensions with their own status and trend.** A victim
who is psychologically stable but physically unsafe and financially destitute
produces one mid-range number.

### GAP 3 — The workflow has no clocks

`FEATURE_AUDIT.md` confirms: *"no response-time metric."* Nothing in
`alertEngine.ts` or `FollowUps.tsx` implements a due time, an acknowledgement
timestamp, an overdue state, or a breach view. So the workflow answers *who
receives the alert* and *what they did*, but not **how quickly they must
respond** or **whether they did** — which is precisely the accountability the
critique's point 3 is about, and precisely what a District Officer will ask for.

### GAP 4 — District/State dashboard is mock data

`CommunityInsights.tsx` renders `MOCK_REGIONS` — four hardcoded rows
(`reg-a`…`reg-d`, "Region A, northern district housing"). There is no
district/state/national hierarchy, no real aggregation query, and **no
small-cell suppression**, which is a live re-identification risk the moment
real caseloads are aggregated by district.

### GAP 5 — No multi-channel access

No IVRS, no SMS, no missed-call, no WhatsApp, no telephony integration at all.
`14566` appears only as a free-text `caseReference` field and a comment saying
*"AURA does not talk to the helpline's systems."*

This is the most consequential equity gap. The MITHRA pilot in rural Karnataka
found illiteracy and *phone-sharing as a family resource* to be direct barriers
to mobile mental-health adoption — and phone-sharing is a **safety** problem for
an atrocity survivor, not just an access one. Meanwhile IVR is well-evidenced:
a review of 17 randomised trials with >26,000 patients found depression symptom
reports collected by IVR at least as reliable as standard methods.

A browser-only AURA reaches the survivors who need it least.

### GAP 6 — No co-design evidence

Nothing in the repo records survivor, counsellor, social-worker, legal-aid,
police, rehabilitation-officer or clinician involvement. No advisory group, no
consultation log, no "what we changed because of it". This is the **cheapest
gap to close** and it is heavily weighted in the current literature: PPIE is
described as *"a key element of research best practice"* while co-design of
digital health interventions *"remains under-reported"*, and a 2025 scoping
review found *"a lack of using the evidence-based framework of a
trauma-informed approach in digital design."*

### GAP 7 — No evaluation protocol or fairness audit

`FlagReviewTab`'s precision/recall is a good start and a dead end without a
denominator. There is no documented validation plan, no fairness slice by
language/gender/district/age, no external-validation intent. The literature is
blunt here: in a 2025 systematic review of self-harm and suicide prediction
models, **all development studies and all but two external validations were at
high risk of bias**, driven by incomplete performance evaluation (92%),
insufficient sample size (77%) and mishandled missing data (66%). "We didn't
evaluate it" is the default failure, not the exception.

### GAP 8 — Translated instruments are not validated instruments

Bhashini runtime MT is the right engineering choice for *interface* text. It is
the wrong mechanism for *clinical items*. Machine-translating a PHQ-9 item
destroys its psychometric properties. Any instrument you add must ship with the
**official licensed translation** for each language, or not ship in that
language.

### GAP 9 — Governance documents

Strong technical privacy, no paperwork: no retention/deletion schedule, no
role-based access matrix, no DPIA, no mapping to India's DPDP Act 2023, no
statement of the duty-to-warn boundary (`FEATURE_AUDIT.md` already flags that
last one). Note also that under the EU AI Act, clinical decision support and
patient triage are classified **high-risk**, with Article 13 transparency and
human-oversight obligations applying in full from **August 2026** — a useful
external yardstick even though you deploy in India.

---

## Part 4 — The plan

Ordered by *judge-value per hour of work*. P0 is the difference between "nice
prototype" and "defensible research contribution."

### P0.1 — Validated instrument layer *(the single highest-value change)*

**Build:** a `src/services/instruments/` module with each instrument as a
declarative spec — items, response options, scoring function, published
cut-offs, licence, and per-language official translation status.

Recommended set, all free to use:

| Instrument | Items | Why | Cadence |
|---|---|---|---|
| **WHO-5 Well-Being Index** | 5 | Non-pathologising, positively worded, safe for survivors, official translations in most Indian languages, and **your steps 4–7 already use its exact response scale** | Every check-in |
| **PHQ-2 → PHQ-9** | 2 → 9 | Ultra-brief gate; escalate to full 9 only on a positive PHQ-2 | PHQ-2 weekly, PHQ-9 on trigger |
| **GAD-2 → GAD-7** | 2 → 7 | Same pattern for anxiety | As above |
| **PC-PTSD-5 → PCL-5** | 5 → 20 | Trauma-specific and the right axis for atrocity survivors; PCL-5 is public domain (US VA) | Intake + quarterly |

**Three architectural rules that make this credible:**

1. **Never blend the instrument score into the AURA score.** Show them side by
   side. The instrument is the *anchor*; the AURA score is the *between-visit
   trend detector*. Blending them destroys the only thing that makes either
   interpretable.
2. **Store raw item responses**, not just totals — you cannot do psychometrics
   later without them.
3. **Version every instrument administration** the way `SCORE_VERSION` already
   versions the check-in.

**Then do the one study you can actually run:** administer WHO-5 alongside the
AURA check-in to ~40 pilot users and report the **concurrent-validity
correlation** between AURA score and WHO-5. One scatter plot with an *r* value
is a complete, honest answer to "why should we trust this score?" — and it is
achievable in a hackathon timeframe. Report it whatever it comes out as; a
weak correlation you found yourself is a stronger result than a strong one you
asserted.

**State the limitation on the same slide:** PHQ-9 and GAD-7 have low specificity
and high false-positive rates and are *"recommended only as an initial screening
tool"*. Saying this before a judge says it to you is worth more than the
instrument itself.

*Effort: 2–3 days. Touches: new `instruments/` module, `ParticipantCheckin.tsx`,
a new `instrument_administrations` table + RLS, `CheckInResults.tsx`,
`ParticipantDetail.tsx`.*

### P0.2 — Dynamic Well-being Profile (six dimensions)

Replace the single headline number with a profile. Keep the distress score —
demote it to *one dimension of six*.

| Dimension | Fed by |
|---|---|
| Psychological well-being | WHO-5 / PHQ / GAD + the existing distress score |
| Safety & intimidation | Safety item + `threat`/`intimidation`/`police_contact` case events |
| Legal process | `hearing` proximity (`HEARING_LEAD_DAYS`/`TAIL_DAYS` already exist), reporting-history answers |
| Financial / livelihood | New items; the `livelihood_destruction` and `livelihood_education` intake tags already exist |
| Rehabilitation & medical | Existing physical/medical intake items |
| Social support | Existing social-connection item + `spokeToAnyone`/`leftHome` |

Each dimension gets a status (🟢/🟠/🔴), a trend arrow, and a *reason string*.
An **Overall Support Priority** derives from the profile by an explicit,
published rule — e.g. any red ⇒ HIGH — not by averaging. Averaging six
dimensions reintroduces exactly the single-number problem you are fixing.

Rename the headline concept to **Dynamic Well-being Profile**. Note that this
is a schema change, not a relabel; do it properly or not at all.

*Effort: 2–3 days. Much of the input data already exists.*

### P0.3 — Response-time / SLA layer

Give the workflow clocks. For each escalation level define: **who** is
notified, **response due within**, and what **breach** does.

| Level | Notified | Due within | On breach |
|---|---|---|---|
| `urgent` | Assigned counsellor + district supervisor | 1 hour | Auto-escalate to supervisor, log |
| `contact` | Assigned counsellor | 24 hours | Surface in supervisor queue |
| `watch` | Assigned counsellor | 7 days | Ages into `contact` |

Add to the alert record: `acknowledgedAt`, `contactAttemptedAt`,
`contactSucceededAt`, `supportProvided[]`, `outcomeRecordedAt` — and an
**Overdue** view on the dashboard. Median acknowledgement time and breach rate
then become your first real operational metrics, and the district dashboard has
something worth showing.

*Effort: 1–2 days. Extends the existing alert/escalation tables.*

### P1.1 — Close the loop with the *same* instrument

You have `InterventionFollowUp` with a pre/post delta. Upgrade it so the
follow-up at day 7 and day 30 **re-administers the same instrument** that
triggered the intervention. Pre/post on a validated instrument is
measurement-based care; pre/post on a bespoke score is not comparable to
anything. MBC is *"the systematic use of standardized outcome measures at every
stage of treatment"* and is specifically effective at *"rapidly detecting
patients with deteriorating symptoms"* — which is your entire thesis.

Add an outcome analytics view: % improving / stable / worsening by intervention
type. That single chart is what turns "monitoring app" into "closed-loop
system."

*Effort: 1 day.*

### P1.2 — Real district / state dashboard

Kill `MOCK_REGIONS`. Add `district` and `state` to the participant record, and
build genuine aggregation: active cases, cases needing follow-up,
increasing-risk count, pending interventions, **median response time**, breach
rate, support-type gaps, rehabilitation status.

**Non-negotiable: small-cell suppression.** Any cell with n < 5 shows "<5", not
a number. Without it, "1 increasing-risk case in this block" identifies a
person. Officials get counts and rates; never names, never free text.

*Effort: 2 days.*

### P1.3 — Evaluation & fairness protocol

Write `docs/EVALUATION_PROTOCOL.md` covering: the concurrent-validity study
above; sensitivity/specificity of the alert threshold against counsellor
judgement as reference standard (`FlagReviewTab` already collects the
adjudications); **fairness slices by language, gender, age band and district**
with the metric stated in advance (equal false-negative rate is the right
target — a missed survivor is the costly error); and a pre-registered
external-validation intent for a second district.

Then add a **Model Card** page in-app: what it does, what it does not do,
population it was built on, known failure modes, and a plain statement that it
is not validated for diagnosis. You already have `ResponsibleAIBadges`; make it
link here.

*Effort: 1 day of writing, ~half a day of UI. Very high credibility-per-hour.*

### P2.1 — Multi-channel access

Highest real-world impact, largest build. Sequence it:

1. **SMS check-in** (Exotel/Gupshup/Twilio webhook → the same scoring pipeline).
   A 3-question SMS check-in reaches a feature phone.
2. **IVRS**: DTMF-keypad responses to spoken questions in the person's language,
   using the existing Bhashini TTS path. Evidence-backed for low-literacy
   populations.
3. **Missed-call callback** — zero-cost for the survivor and, crucially, leaves
   no app on a shared phone.
4. **Document the 14566 contract** even if you cannot integrate: the fields you
   would consume, consent basis, and who holds what.

If the build is out of reach, ship **one** working channel end-to-end and
specify the rest. A working SMS demo beats four described channels.

*Effort: 3–5 days for SMS + IVRS.*

### P2.2 — Co-design record *(cheapest credibility in this document)*

Create `docs/CO_DESIGN.md`:

- Advisory panel composition: survivors, counsellors, social workers, legal-aid
  providers, protection officers, rehabilitation officers, mental-health
  professionals.
- A consultation log: date, participants (de-identified), what was asked.
- **A "what changed because of it" table** — this is the part that convinces.
  You can honestly seed it *today* from decisions already in the code: the
  somatic-symptoms items, the `fear_retaliation` reporting option, dropping the
  10-point penalty for asking for support, `data-no-translate` on narratives,
  and never showing concordance to the participant as an accusation. Those are
  real design decisions with real justifications; write them down.
- Safeguarding protocol for consultations, per trauma-informed principles.

*Effort: half a day. Do this even if you do nothing else in P2.*

### P2.3 — Governance pack

`docs/GOVERNANCE.md`: retention schedule per data class, deletion procedure,
RBAC matrix (participant / counsellor / supervisor / district / state / admin ×
each data class), DPIA, DPDP Act 2023 mapping, breach procedure, and an
explicit **duty-to-warn boundary** — the one thing consent currently does not
spell out. Then add the duty-to-warn clause to the consent screen itself, in
plain language, before deployment.

*Effort: 1 day.*

---

## Part 5 — Review: the honest critique

**Reposition the pitch.** The critique is right that *"we use AI to detect
mental distress"* invites *"this already exists."* But the strongest framing is
not the multidimensional profile either — it is what you have that is actually
rare:

> Existing digital mental-health systems assume the person will tell you they
> are unwell. AURA is built for a population that often cannot: survivors of
> atrocities who are afraid of retaliation, who describe distress somatically
> rather than emotionally, and whose well-being depends as much on legal
> protection, livelihood and rehabilitation as on mood. AURA measures
> well-being with validated instruments where they exist, cross-checks the
> self-report against behaviour, function and engagement where they do not, and
> routes every judgement to an accountable human within a defined time.

That claim is specific, testable, and — unusually — mostly already true of your
code.

**Three things to stop doing:**

1. **Stop calling the distress score validated.** It is *transparent*, which is
   a different and lesser property. Until P0.1 lands, say "an auditable
   composite indicator, anchored against WHO-5 in a pilot of n=…".
2. **Stop shipping mock data on a live demo.** `MOCK_REGIONS` in
   `CommunityInsights` is the first thing a technical judge will find, and it
   discredits the real work around it. Either wire it to a query or label it
   "illustrative" on-screen.
3. **Stop listing 23 languages as a feature.** Three are hand-written; twenty
   are runtime MT of interface strings, with no clinical-content validation.
   Say exactly that. *"3 languages validated, 20 machine-translated, official
   instrument translations for N"* is more impressive than an unqualified 23,
   because it shows you know what validation costs.

**One thing the critique gets wrong about you:** it warns against depending on
Emotion AI. You already don't — voice never reaches the score, and the LLM is
capped at ±15 points scaled by evidence length. You should say so with the
constant names on screen. Do not weaken this to satisfy a critique aimed at a
system you no longer have.

**One risk nobody has raised:** the concordance engine flags people whose
self-report disagrees with their behaviour. That is your best idea, and it is
also, in the wrong hands, a lie detector pointed at trauma survivors. The code
already knows this — it never overwrites the self-report and never shows the
flag to the participant. Make that a **written, enforced policy** with a test,
not a convention, before this touches a real person. If a district officer ever
sees "this victim's account may be inconsistent," the project has caused harm.

**Suggested demo order:** distress → *"here is the arithmetic"* → *"here is
WHO-5 beside it, and here is the correlation"* → *"here is the person whose
score says fine and whose behaviour says otherwise"* → *"here is the counsellor
who got 1 hour to respond, and did"* → *"here is day 7 on the same instrument"*
→ *"here is the district view, with cells under 5 suppressed."*

---

## Sources

Peer-reviewed and regulatory sources consulted, beyond the Indian paper in the
brief.

**Validated instruments and their limits**
- [What do the PHQ-9, the GAD-7 and their variants miss in assessing young people presenting to youth mental health services?](https://www.sciencedirect.com/science/article/abs/pii/S0165032725016301) — Journal of Affective Disorders, 2025
- [Validation of the PHQ-9 and GAD-7 in a Lithuanian student sample](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0263027) — PLOS ONE (low specificity; screening only)
- [Improving recognition of common mental health disorders in Cambodia: validation of the PHQ-9 and GAD-7](https://journals.plos.org/mentalhealth/article?id=10.1371%2Fjournal.pmen.0000228) — PLOS Mental Health
- [The WHO-5 well-being index — validation based on item response theory and measurement invariance across 35 countries](https://www.sciencedirect.com/science/article/pii/S2666915320300202) — Journal of Affective Disorders Reports
- [Psychometric validation of the WHO-5 and WHO-4 in school-aged children](https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1662332/full) — Frontiers in Public Health, 2025

**Emotion AI / speech and cross-cultural validity**
- [Speech Emotion Recognition in Mental Health: Systematic Review of Voice-Based Applications](https://mental.jmir.org/2025/1/e74260) — JMIR Mental Health, 2025
- [Cross-cultural adaptation and validation of the Cognitive Emotion Regulation Questionnaire: a systematic review](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11961981/)

**Prediction-model bias and external validation**
- [Prediction models for self-harm and suicide: a systematic review and critical appraisal](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12513157/)
- [Evaluating model generalizability for suicide attempt risk prediction](https://www.nature.com/articles/s44184-026-00209-2) — npj Mental Health Research
- [Machine learning and the prediction of suicide in psychiatric populations: a systematic review](https://www.nature.com/articles/s41398-024-02852-9) — Translational Psychiatry

**Measurement-based care and closed-loop outcomes**
- [Resource Document on Implementation of Measurement-Based Care](https://www.psychiatry.org/getattachment/3d9484a0-4b8e-4234-bd0d-c35843541fce/Resource-Document-on-Implementation-of-Measurement-Based-Care.pdf) — American Psychiatric Association
- [How are ICTs supporting routine outcome monitoring and measurement-based care in psychotherapy? A systematic review](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7246636/)
- [Understanding engagement with digital mental health technology in mental health services: multicentre observational study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12421206/)

**Task-shifting and low-resource delivery**
- [Mental healthcare in primary and community-based settings: evidence beyond the WHO mhGAP Intervention Guide](https://pmc.ncbi.nlm.nih.gov/articles/PMC9811100/)
- [Task-shifting or problem-shifting? How lay counselling is redefining mental healthcare](https://journals.plos.org/mentalhealth/article?id=10.1371%2Fjournal.pmen.0000067) — PLOS Mental Health
- [A digital tool (Technology-Assisted Problem Management Plus) for lay health workers](https://formative.jmir.org/2025/1/e59414) — JMIR Formative Research, 2025
- [The legality and ethical issues of certifying laypersons as mental health counselors in India](https://doi.org/10.1177/02537176221074253)

**Multi-channel access, literacy and the digital divide**
- [Feasibility of an interactive voice response system for monitoring depressive symptoms in a lower-middle income country](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5034527/)
- [Bioethical considerations in deploying mobile mental health apps in LMIC settings: insights from the MITHRA pilot study in rural India](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2026.1634669/full)
- [Brief intervention for hazardous drinking delivered using text messaging: a pilot RCT from Goa, India](https://www.cambridge.org/core/journals/public-health-nutrition/article/brief-intervention-for-hazardous-drinking-delivered-using-text-messaging-a-pilot-randomised-controlled-trial-from-goa-india/D4199B4C11B9BD849319AF556B7E139B)

**Co-design, PPI and trauma-informed design**
- [Reporting on a partnership to co-design a digital health intervention with young people who have experienced technology-assisted sexual abuse](https://onlinelibrary.wiley.com/doi/10.1111/hex.70288) — Health Expectations, 2025
- [A scoping review of trauma-informed care principles applied in design and technology](https://doi.org/10.1177/20552076251360925) — Digital Health, 2025
- [Co-designing a digital app to support young people's patient and public involvement (VoiceIn)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11527391/)
- [Co-creation, translation and localization of a trauma-informed digital mental health intervention for frontline workers](https://pubmed.ncbi.nlm.nih.gov/42054948/)

**Regulation and governance**
- [EU AI Act — regulatory framework](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — European Commission
- [AI Act compliance within the MyHealth@EU framework: tutorial](https://www.jmir.org/2025/1/e81184) — JMIR, 2025
- [The EU AI Act: implications and compliance guidance for healthcare facilities](https://pmc.ncbi.nlm.nih.gov/articles/PMC13292296/)
- [Explainability in AI policies: a critical review of communications, reports, regulations and standards in the EU, US and UK](https://arxiv.org/pdf/2304.11218)
