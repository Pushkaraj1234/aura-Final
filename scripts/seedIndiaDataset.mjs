// scripts/seedIndiaDataset.mjs
//
// Comprehensive synthetic dataset generator for AURA, using @faker-js/faker
// with curated Indian name banks (Yash, Aryan, Shreyas, Arya, Aarohi,
// Manashree, Parth, Raj, ...). 100% fabricated — no real people, no real
// clinical data. Safe to run against the live Supabase project: it uses the
// official Admin Auth API (auth.admin.createUser), deterministic row ids, and
// upserts, so re-running it tops up / refreshes rather than duplicating.
//
// What it creates:
//   - 3 support workers (Indian names) + reuses any existing workers
//   - 30 survivor participants (Indian names) with participants.id === auth uid
//     so staff-facing UI shows their name, matching real sign-up shape
//   - 8-14 check-ins each over ~35 days, trending toward the case status
//   - risk_history + one latest risk_prediction per participant
//   - text reflections (sentiment + language signal) for ~60%
//   - alerts for every Needs-follow-up / Human-review / Urgent participant
//   - interventions + follow-ups (pre/post score delta) for ~40%
//   - one consents row per participant (a few with voice/analytics off, 1 revoked)
//   - support_notes for assigned participants
//   - assignment_history for assigned participants
//   - a spread of audit_logs
//   - a couple of seeded participant<->worker messages
//
// Usage (from project root, real .env in place):
//   node scripts/seedIndiaDataset.mjs
//   node scripts/seedIndiaDataset.mjs --count 40      (override participant count)
//   node scripts/seedIndiaDataset.mjs --wipe          (delete previously seeded
//                                                      demo.in rows first)
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env (same key the admin panel uses).

import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";
import dotenv from "dotenv";

dotenv.config();

faker.seed(20260907); // reproducible output

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wtkhcndftvsiaxstspsp.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set in .env. Add it (Supabase dashboard -> Project Settings -> API -> service_role key) and retry."
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const WIPE = args.includes("--wipe");
const countArg = args.indexOf("--count");
const PARTICIPANT_COUNT = countArg >= 0 ? Math.max(1, Number(args[countArg + 1]) || 30) : 30;
const EMAIL_DOMAIN = "aura-demo.in"; // marker domain — used for idempotency + --wipe

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Name banks — curated Indian given names (incl. the ones you listed) + a
// broad surname bank spanning several Indian regions.
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  "Yash", "Aryan", "Shreyas", "Arya", "Aarohi", "Manashree", "Parth", "Raj",
  "Ishaan", "Kabir", "Vivaan", "Advait", "Reyansh", "Vihaan", "Sai", "Neil",
  "Kian", "Om", "Arnav", "Dhruv", "Rudra", "Aarav", "Veer", "Krish",
  "Diya", "Ananya", "Saanvi", "Aadhya", "Kiara", "Myra", "Anaya", "Riya",
  "Tara", "Ira", "Vedika", "Sara", "Navya", "Pari", "Aditi", "Ishani",
  "Prisha", "Mahi", "Sneha", "Isha",
];
const LAST_NAMES = [
  "Sharma", "Patil", "Deshmukh", "Joshi", "Kulkarni", "Nair", "Iyer", "Reddy",
  "Gupta", "Mehta", "Chaudhari", "Bhosale", "Rao", "Pillai", "Shetty", "Naik",
  "Kale", "Jadhav", "Pawar", "Gokhale", "Chavan", "Sawant", "Kamble", "More",
  "Bhat", "Menon", "Verma", "Agarwal", "Sinha", "Bose",
];

const WORKERS = [
  { first: "Ananya", last: "Deshpande", specialization: "Trauma-focused CBT", languages: ["English", "हिन्दी", "मराठी"], prefix: "Dr. " },
  { first: "Rohan", last: "Kulkarni", specialization: "EMDR / grief & loss", languages: ["English", "हिन्दी"], prefix: "" },
  { first: "Shreyas", last: "Nair", specialization: "Psychosocial support / displacement", languages: ["English", "मराठी"], prefix: "" },
];

const REGIONS = [
  "Asia and Oceania", // matches regional_conflict_context
  "South Asia",
  "Northeast India",
  "Jammu & Kashmir",
  "Central India",
];
const LANGUAGES = ["English", "English", "हिन्दी", "मराठी"];
const AGE_GROUPS = ["18-24", "25-34", "35-44", "45+"];
const SUPPORT_PREFS = ["Human support worker", "Peer support circle", "Self-guided resources", "Not sure yet"];

// Case-status mix for the participant population.
function buildStatusPlan(n) {
  const plan = [];
  const mix = [
    ["Stable", 0.40],
    ["Improving", 0.20],
    ["Needs follow-up", 0.20],
    ["Human review pending", 0.13],
    ["Urgent safety signal", 0.07],
  ];
  for (const [status, frac] of mix) {
    for (let i = 0; i < Math.round(n * frac); i++) plan.push(status);
  }
  while (plan.length < n) plan.push("Stable");
  return faker.helpers.shuffle(plan.slice(0, n));
}

// ---------------------------------------------------------------------------
// Distress scoring — the transparent rule formula from README §3.
// ---------------------------------------------------------------------------
const SAFETY_PENALTY = { Yes: 0, Mostly: 8, Unsure: 18, No: 25 };

function distressScore({ stress, sleep, safety, connection, supportRequested }) {
  const s = ((stress - 1) / 4) * 25;
  const l = ((5 - sleep) / 4) * 25;
  const safe = SAFETY_PENALTY[safety] ?? 12;
  const c = ((5 - connection) / 4) * 15;
  const bonus = supportRequested ? 10 : 0;
  return Math.round(Math.max(0, Math.min(100, s + l + safe + c + bonus)));
}

function riskLevel(score) {
  if (score < 25) return "low";
  if (score < 45) return "moderate";
  if (score < 65) return "elevated";
  return "high";
}

// Target check-in "shape" per status; earlier check-ins drift toward neutral so
// trend lines actually move.
function targetForStatus(status) {
  switch (status) {
    case "Urgent safety signal":
      return { wellbeing: 1, stress: 5, sleep: 1, safety: "No", connection: 1, support: true };
    case "Human review pending":
      return { wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, support: true };
    case "Needs follow-up":
      return { wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, support: false };
    case "Improving":
      return { wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, support: false };
    default: // Stable — settled, but not a clinically implausible "perfect" 0
      return { wellbeing: 5, stress: 2, sleep: 5, safety: "Yes", connection: 5, support: false };
  }
}

const SAFETY_ORDER = ["No", "Unsure", "Mostly", "Yes"];
function easeSafety(target, t) {
  // t in [0,1]: 0 = earliest check-in (more neutral), 1 = latest (== target)
  const targetIdx = SAFETY_ORDER.indexOf(target);
  const neutralIdx = 2; // "Mostly"
  const idx = Math.round(neutralIdx + (targetIdx - neutralIdx) * t);
  return SAFETY_ORDER[Math.max(0, Math.min(3, idx))];
}
function easeNum(target, t, neutral = 3) {
  // Widened jitter so consecutive check-ins actually differ (a flat line looks
  // synthetic); still eases from a neutral baseline toward the status target.
  const v = neutral + (target - neutral) * t + faker.number.float({ min: -0.9, max: 0.9 });
  return Math.max(1, Math.min(5, Math.round(v)));
}

function daysAgoIso(days, jitterHours = 6) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - faker.number.int({ min: 0, max: jitterHours }));
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Reflection content banks (trauma-informed, non-graphic).
// ---------------------------------------------------------------------------
const REFLECTIONS = {
  stressed: [
    "The nights are the hardest. I keep replaying what happened and I can't slow my thoughts down.",
    "I jump at every loud sound near the camp. My chest feels tight most of the day.",
    "I haven't really slept properly in days. Every time I close my eyes the images come back.",
  ],
  overwhelmed: [
    "I don't know how to keep going some days. Everything feels like too much at once.",
    "I feel like a burden to the people around me. I don't want to talk to anyone.",
    "There is so much to sort out and I can't focus on any of it. I feel frozen.",
  ],
  neutral: [
    "Today was ordinary. Stood in line for rations, talked to a neighbour for a bit.",
    "Nothing much changed today. Tired but okay.",
    "Went for a short walk in the morning. The rest of the day was quiet.",
  ],
  positive: [
    "I slept a little better last night. Spoke to my sister on a borrowed phone, that helped.",
    "The counselling session yesterday made things feel less heavy. I want to keep going.",
    "I managed to eat properly today and sit with the group for a while. Small thing but it felt good.",
  ],
};
const LANGUAGE_SIGNAL = {
  stressed: "Stress-related language",
  overwhelmed: "Overwhelm / burden language",
  neutral: "Neutral / ordinary language",
  positive: "Positive / hopeful language",
};

const NOTE_TEMPLATES = [
  "Checked in by phone. {name} reports disrupted sleep; agreed to a grounding routine before bed.",
  "Short session held. Discussed safety planning and local resources. {name} engaged well.",
  "Follow-up call. {name} sounded steadier than last week; will keep weekly cadence.",
  "{name} missed the scheduled slot; left a message and a resource list. Will retry in two days.",
  "Reviewed recent check-ins with {name}. Stress trending down, connection improving.",
];

const INTERVENTION_TYPES = [
  "1-on-1 counselling session",
  "Sleep stabilisation plan",
  "Peer support circle referral",
  "Safety planning session",
  "Psychoeducation on trauma responses",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function loadEmailToId() {
  const map = new Map();
  let page = 1;
  // paginate through all auth users
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const u of data.users) map.set((u.email || "").toLowerCase(), u.id);
    if (data.users.length < 1000) break;
    page++;
  }
  return map;
}

async function ensureUser(emailToId, email, meta) {
  const existing = emailToId.get(email.toLowerCase());
  if (existing) return { id: existing, created: false };
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: faker.internet.password({ length: 16 }) + "Aa1!",
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message || "")) {
      const refreshed = await loadEmailToId();
      return { id: refreshed.get(email.toLowerCase()), created: false };
    }
    throw error;
  }
  emailToId.set(email.toLowerCase(), data.user.id);
  return { id: data.user.id, created: true };
}

async function up(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
}

const counts = {};
const bump = (k, n = 1) => (counts[k] = (counts[k] || 0) + n);

// ---------------------------------------------------------------------------
// Optional wipe of previously seeded rows
// ---------------------------------------------------------------------------
async function wipe(emailToId) {
  console.log("--wipe: removing previously seeded aura-demo.in rows ...");
  const ids = [];
  for (const [email, id] of emailToId) if (email.endsWith(`@${EMAIL_DOMAIN}`)) ids.push(id);
  if (!ids.length) {
    console.log("  nothing to wipe.");
    return;
  }
  // child tables first (FK order), then participants, then auth users
  for (const t of [
    "reflections", "risk_predictions", "risk_history", "follow_ups", "interventions",
    "alerts", "notifications", "support_notes", "consents", "assignment_history",
    "messages", "audit_logs", "check_ins",
  ]) {
    const { error } = await supabase.from(t).delete().in("participant_id", ids);
    if (error && !/does not exist/i.test(error.message)) console.warn(`  ${t}: ${error.message}`);
  }
  await supabase.from("participants").delete().in("id", ids);
  for (const id of ids) {
    await supabase.auth.admin.deleteUser(id).catch(() => {});
    emailToId.delete([...emailToId].find(([, v]) => v === id)?.[0] || "");
  }
  console.log(`  wiped ${ids.length} seeded users + their rows.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  console.log(`Seeding AURA dataset into ${SUPABASE_URL}`);
  console.log(`Participants: ${PARTICIPANT_COUNT} · marker domain: @${EMAIL_DOMAIN}\n`);

  let emailToId = await loadEmailToId();
  if (WIPE) {
    await wipe(emailToId);
    emailToId = await loadEmailToId();
  }

  // ---- Support workers -----------------------------------------------------
  const workerPool = []; // { id, name }
  for (const w of WORKERS) {
    const name = `${w.prefix}${w.first} ${w.last}`;
    const email = `${w.first}.${w.last}`.toLowerCase() + `@${EMAIL_DOMAIN}`;
    const { id, created } = await ensureUser(emailToId, email, {
      name,
      role: "support_worker",
      language: w.languages[0],
    });
    if (!id) {
      console.warn(`! could not resolve worker ${name}, skipping`);
      continue;
    }
    await supabase.from("profiles").update({
      role: "support_worker",
      name,
      support_preference: w.specialization,
    }).eq("id", id);
    workerPool.push({ id, name });
    bump(created ? "workers_created" : "workers_existing");
    console.log(`${created ? "+" : "="} worker ${name} <${email}>`);
  }

  // Also fold in any pre-existing support workers so assignments spread wider.
  const { data: existingWorkers } = await supabase
    .from("profiles").select("id, name").eq("role", "support_worker");
  for (const p of existingWorkers || []) {
    if (!workerPool.find((w) => w.id === p.id)) workerPool.push({ id: p.id, name: p.name });
  }
  if (!workerPool.length) {
    console.error("No support workers available — cannot continue.");
    process.exit(1);
  }

  // ---- Participants ------------------------------------------------------
  const statusPlan = buildStatusPlan(PARTICIPANT_COUNT);
  const usedNames = new Set();

  for (let i = 0; i < PARTICIPANT_COUNT; i++) {
    const status = statusPlan[i];
    let first, last, name;
    do {
      first = faker.helpers.arrayElement(FIRST_NAMES);
      last = faker.helpers.arrayElement(LAST_NAMES);
      name = `${first} ${last}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const email = `${first}.${last}.${i + 1}`.toLowerCase() + `@${EMAIL_DOMAIN}`;
    const language = faker.helpers.arrayElement(LANGUAGES);
    const ageGroup = faker.helpers.arrayElement(AGE_GROUPS);
    const region = faker.helpers.arrayElement(REGIONS);

    const { id: pid, created } = await ensureUser(emailToId, email, {
      name, role: "participant", ageRange: ageGroup, language,
    });
    if (!pid) {
      console.warn(`! could not resolve participant ${name}, skipping`);
      continue;
    }

    // ~72% assigned, round-robin across the worker pool
    const assigned = faker.number.int({ min: 1, max: 100 }) <= 72;
    const worker = assigned ? workerPool[i % workerPool.length] : null;

    await supabase.from("profiles").update({ role: "participant", name, participant_id: pid }).eq("id", pid);

    await up("participants", [{
      id: pid,
      user_id: pid,
      consent_given: true,
      status,
      preferred_support: faker.helpers.arrayElement(SUPPORT_PREFS),
      language,
      age_group: ageGroup,
      assigned_worker: worker ? worker.id : null,
      last_review_date: assigned && status !== "Stable" ? daysAgoIso(faker.number.int({ min: 1, max: 9 })) : null,
      region,
    }]);
    bump(created ? "participants_created" : "participants_existing");

    // ---- Check-ins + risk history ------------------------------------
    const target = targetForStatus(status);
    const nCheckins = faker.number.int({ min: 8, max: 14 });
    const spanDays = 35;
    const checkIns = [];
    const riskHist = [];
    let latestScore = 50;
    let prevScore = null;

    for (let k = 0; k < nCheckins; k++) {
      const t = nCheckins === 1 ? 1 : k / (nCheckins - 1); // 0..1 oldest..newest
      const daysAgo = Math.round(spanDays * (1 - t));
      const wellbeing = easeNum(target.wellbeing, t);
      const stress = easeNum(target.stress, t);
      const sleep = easeNum(target.sleep, t);
      const connection = easeNum(target.connection, t);
      const safety = easeSafety(target.safety, t);
      const supportRequested = target.support && t > 0.5 && faker.datatype.boolean(0.6);
      const immediate = status === "Urgent safety signal" && k === nCheckins - 1;
      // Baseline day-to-day life stress so no one sits at a literal 0/100.
      const baseline = faker.number.int({ min: 2, max: 9 });
      const score = Math.min(
        status === "Urgent safety signal" ? 99 : 96,
        distressScore({ stress, sleep, safety, connection, supportRequested }) + baseline
      );
      const ciId = `${pid}-ci-${k + 1}`;
      const occurredAt = daysAgoIso(daysAgo);

      checkIns.push({
        id: ciId,
        participant_id: pid,
        wellbeing, stress, sleep, safety, connection,
        support_requested: supportRequested,
        immediate_safety_concern: immediate,
        calculated_score: score,
        notes: "",
        optional_note: "",
        share_note_with_worker: true,
        voice_input_used: faker.datatype.boolean(0.25),
        occurred_at: occurredAt,
      });
      riskHist.push({
        id: `${pid}-rh-${k + 1}`,
        participant_id: pid,
        score,
        level: riskLevel(score),
        source: "seed",
        recorded_at: occurredAt,
      });
      if (k === nCheckins - 1) latestScore = score;
      if (k === nCheckins - 2) prevScore = score;
    }
    await up("check_ins", checkIns);
    await up("risk_history", riskHist);
    bump("check_ins", checkIns.length);

    // ---- Latest risk prediction ------------------------------------
    const trajectory =
      status === "Improving" ? "Recovering After Support"
      : status === "Urgent safety signal" ? "Rapid Change"
      : status === "Human review pending" ? "Gradually Increasing"
      : status === "Needs follow-up" ? "Fluctuating"
      : "Stable";
    const delta = prevScore == null ? 0 : latestScore - prevScore;
    await up("risk_predictions", [{
      id: `${pid}-pred-latest`,
      participant_id: pid,
      check_in_id: `${pid}-ci-${nCheckins}`,
      model_version_id: "rule-engine-v1",
      distress_score: latestScore,
      risk_level: riskLevel(latestScore),
      trajectory,
      confidence: faker.number.float({ min: 0.55, max: 0.9, fractionDigits: 2 }),
      change_delta: delta,
      contributing_factors: buildFactors(target),
      factor_breakdown: {
        stress: 0.35, sleep: 0.25, safety: 0.2, socialConnection: 0.2,
      },
      explanation: `Rule-engine distress score ${latestScore}/100 (${riskLevel(latestScore)}). ${
        delta > 3 ? "Trending upward" : delta < -3 ? "Trending downward" : "Roughly stable"
      } over the last two check-ins.`,
      explanation_points: [
        `Sleep rated ${target.sleep}/5 across recent check-ins`,
        `Stress rated ${target.stress}/5 across recent check-ins`,
        `Environmental safety reported as "${target.safety}"`,
      ],
      requires_human_review: latestScore >= 45,
      is_explicit_safety_concern: status === "Urgent safety signal",
      prediction_metadata: { source: "seedIndiaDataset", model: "transparent-rule-engine" },
    }]);
    bump("risk_predictions");

    // ---- Reflections (~60%) -------------------------------------------
    if (faker.datatype.boolean(0.6)) {
      const moodKey =
        status === "Urgent safety signal" || status === "Human review pending" ? "overwhelmed"
        : status === "Needs follow-up" ? "stressed"
        : status === "Improving" ? "positive"
        : faker.helpers.arrayElement(["neutral", "neutral", "positive"]);
      const nRef = faker.number.int({ min: 1, max: 3 });
      const refs = [];
      for (let r = 0; r < nRef; r++) {
        const key = r === 0 ? moodKey : faker.helpers.arrayElement(["neutral", moodKey]);
        const ciIndex = faker.number.int({ min: Math.max(1, nCheckins - 4), max: nCheckins });
        refs.push({
          id: `${pid}-ref-${r + 1}`,
          check_in_id: `${pid}-ci-${ciIndex}`,
          participant_id: pid,
          type: faker.datatype.boolean(0.3) ? "voice" : "text",
          transcript: faker.helpers.arrayElement(REFLECTIONS[key]),
          audio_recorded: false,
          share_with_worker: faker.datatype.boolean(0.8),
          sentiment: key === "positive" ? "positive" : key === "neutral" ? "neutral" : key,
          language_signal: LANGUAGE_SIGNAL[key],
          contributing_patterns: key === "positive" ? ["Improved sleep", "Social contact"] : ["Sleep disruption", "Hyperarousal"],
          keywords: key === "positive" ? ["slept", "helped", "session"] : ["nights", "sound", "images"],
          factors: key === "positive" ? ["sleep", "socialConnection"] : ["sleep", "stress", "safety"],
          explanation: `Language screened as "${LANGUAGE_SIGNAL[key]}" — assistive signal only, not a diagnosis.`,
          has_urgent_safety_mention: false,
          submitted_at: daysAgoIso(faker.number.int({ min: 1, max: 20 })),
        });
      }
      await up("reflections", refs);
      bump("reflections", refs.length);
    }

    // ---- Consent row -------------------------------------------------
    const consentRevoked = faker.datatype.boolean(0.05);
    await up("consents", [{
      id: `${pid}-consent`,
      participant_id: pid,
      user_id: pid,
      wellbeing_check_ins: true,
      support_worker_sharing: !faker.datatype.boolean(0.08),
      optional_free_text_sharing: !faker.datatype.boolean(0.15),
      optional_voice_feature: !faker.datatype.boolean(0.25),
      community_aggregate_analytics: faker.datatype.boolean(0.5),
      status: consentRevoked ? "revoked" : "active",
      version: "1.0",
      revocation_reason: consentRevoked ? "Participant opted out of monitoring" : null,
      revoked_at: consentRevoked ? daysAgoIso(faker.number.int({ min: 1, max: 15 })) : null,
    }]);
    bump("consents");

    // ---- Alerts (for elevated statuses) ----------------------------
    const needsAlert = ["Needs follow-up", "Human review pending", "Urgent safety signal"].includes(status);
    if (needsAlert) {
      const severity =
        status === "Urgent safety signal" ? "RED"
        : status === "Human review pending" ? "ORANGE" : "YELLOW";
      const category =
        status === "Urgent safety signal" ? "SAFETY_CONCERN"
        : status === "Human review pending" ? "PERSISTENT_INCREASE" : "FOLLOW_UP_DUE";
      const resolvedOlder = faker.datatype.boolean(0.4);
      const alerts = [{
        id: `${pid}-alert-1`,
        participant_id: pid,
        category,
        severity,
        title:
          status === "Urgent safety signal" ? "Immediate safety signal reported"
          : status === "Human review pending" ? "Sustained distress increase"
          : "Follow-up window due",
        reason:
          status === "Urgent safety signal"
            ? "Participant reported an immediate safety concern on their latest check-in."
            : `Distress score ${latestScore}/100 with ${delta >= 0 ? "an upward" : "a fluctuating"} trend over recent check-ins.`,
        description: "Auto-generated from the transparent rule engine. Requires human review before any action.",
        recommended_action:
          status === "Urgent safety signal"
            ? "Contact participant now; share 24/7 helpline; escalate to crisis team."
            : "Reach out within 48 hours to check in and review the support plan.",
        status: status === "Urgent safety signal" ? "NEW" : faker.helpers.arrayElement(["NEW", "ACKNOWLEDGED", "IN_REVIEW"]),
        score: latestScore,
        change_delta: delta,
        assigned_to: worker ? worker.id : null,
        contributing_factors: buildFactors(target),
        trajectory,
        requires_human_review: true,
        created_at: daysAgoIso(faker.number.int({ min: 0, max: 4 })),
      }];
      if (resolvedOlder) {
        const oldScore = Math.min(100, latestScore + faker.number.int({ min: 6, max: 18 }));
        alerts.push({
          id: `${pid}-alert-0`,
          participant_id: pid,
          category: "PERSISTENT_INCREASE",
          severity: "YELLOW",
          title: "Earlier distress increase",
          reason: `Distress score reached ${oldScore}/100 earlier in the monitoring window.`,
          description: "Reviewed by the assigned support worker.",
          recommended_action: "Continue monitoring; follow-up scheduled.",
          status: "RESOLVED",
          score: oldScore,
          change_delta: 8,
          assigned_to: worker ? worker.id : null,
          contributing_factors: ["sleep", "stress"],
          trajectory: "Fluctuating",
          requires_human_review: false,
          human_decision: "continue_monitoring",
          decision_notes: "Follow-up call completed; participant stable enough for weekly cadence.",
          reviewed_by: worker ? worker.name : "Support worker",
          reviewed_at: daysAgoIso(faker.number.int({ min: 10, max: 20 })),
          created_at: daysAgoIso(faker.number.int({ min: 21, max: 30 })),
        });
      }
      await up("alerts", alerts);
      bump("alerts", alerts.length);

      // Worker notification for the live one (broadcast row: user_id null)
      await up("notifications", [{
        id: `${pid}-notif-1`,
        user_id: null,
        participant_id: pid,
        category,
        filter_category: "priority",
        severity: severity === "RED" ? "RED" : severity === "ORANGE" ? "ORANGE" : "YELLOW",
        title: status === "Urgent safety signal" ? "Urgent: safety signal" : "Priority: review needed",
        message: `${name} — ${status.toLowerCase()} (distress ${latestScore}/100).`,
        read: faker.datatype.boolean(0.3),
        action_label: "Open profile",
        action_view: "detail",
        action_participant_id: pid,
        metadata_json: { score: latestScore, change: delta, trajectory },
        created_at: daysAgoIso(faker.number.int({ min: 0, max: 3 })),
      }]);
      bump("notifications");
    }

    // ---- Interventions + follow-ups (~40%, mostly for assigned) -----
    if (assigned && faker.datatype.boolean(status === "Stable" ? 0.15 : 0.6)) {
      const iType = faker.helpers.arrayElement(INTERVENTION_TYPES);
      // Clamp to a valid 0–100 indicator so cards never show e.g. "112 /100".
      const originalScore = Math.min(100, latestScore + faker.number.int({ min: 8, max: 22 }));
      const followUpScore = Math.max(5, Math.min(100, latestScore - faker.number.int({ min: -4, max: 10 })));
      const scoreDelta = followUpScore - originalScore;
      const outcome = scoreDelta <= -8 ? "improving" : scoreDelta >= 6 ? "worsening" : "no_change";
      const intvDate = daysAgoIso(faker.number.int({ min: 8, max: 16 }));
      const fupDate = daysAgoIso(faker.number.int({ min: 1, max: 6 }));

      await up("interventions", [{
        id: `${pid}-intv-1`,
        participant_id: pid,
        alert_id: needsAlert ? `${pid}-alert-1` : null,
        intervention_type: iType,
        assigned_worker: worker ? worker.name : null,
        intervention_date: intvDate,
        outcome,
        notes: `${iType} completed with ${name}. Plan reviewed and next steps agreed.`,
        previous_risk: originalScore,
        follow_up_risk: followUpScore,
        follow_up_date: fupDate,
      }]);
      bump("interventions");

      await up("follow_ups", [{
        id: `${pid}-fup-1`,
        participant_id: pid,
        intervention_id: `${pid}-intv-1`,
        alert_id: needsAlert ? `${pid}-alert-1` : null,
        original_score: originalScore,
        intervention_type: iType,
        intervention_date: intvDate,
        worker_name: worker ? worker.name : "Support worker",
        follow_up_score: followUpScore,
        follow_up_date: fupDate,
        score_delta: scoreDelta,
        outcome: outcome === "improving" ? "improving" : outcome === "worsening" ? "worsening" : "no_change",
        outcome_label:
          outcome === "improving" ? "Improving after support"
          : outcome === "worsening" ? "Worsening — re-escalated" : "No significant change",
        notes: `Pre-intervention ${originalScore} → follow-up ${followUpScore} (${scoreDelta >= 0 ? "+" : ""}${scoreDelta}).`,
      }]);
      bump("follow_ups");
    }

    // ---- Support notes (assigned only) -----------------------------
    if (worker) {
      const nNotes = faker.number.int({ min: 1, max: 3 });
      const notes = [];
      for (let n = 0; n < nNotes; n++) {
        notes.push({
          id: `${pid}-note-${n + 1}`,
          participant_id: pid,
          author: worker.name,
          occurred_at: daysAgoIso(faker.number.int({ min: 1, max: 28 })),
          text: faker.helpers.arrayElement(NOTE_TEMPLATES).replace("{name}", first),
          action_taken: faker.helpers.arrayElement([
            "Scheduled follow-up", "Shared resource list", "Continued monitoring", "Escalated to crisis team",
          ]),
        });
      }
      await up("support_notes", notes);
      bump("support_notes", notes.length);

      // assignment history
      await up("assignment_history", [{
        id: `${pid}-asg-1`,
        participant_id: pid,
        previous_worker_id: null,
        new_worker_id: isUuid(worker.id) ? worker.id : null,
        assigned_by: "admin",
        reason: "Initial assignment (language + caseload match)",
        created_at: daysAgoIso(faker.number.int({ min: 15, max: 34 })),
      }]);
      bump("assignment_history");

      // a seeded 2-message thread for a subset
      if (faker.datatype.boolean(0.4) && isUuid(worker.id)) {
        await up("messages", [
          {
            id: `${pid}-msg-1`,
            participant_id: pid,
            sender_id: worker.id,
            sender_role: "support_worker",
            body: `Hi ${first}, checking in after our last conversation. How have the nights been this week?`,
            read: true,
            created_at: daysAgoIso(faker.number.int({ min: 3, max: 6 })),
          },
          {
            id: `${pid}-msg-2`,
            participant_id: pid,
            sender_id: pid,
            sender_role: "participant",
            body: faker.helpers.arrayElement([
              "A little better than last week, thank you for asking.",
              "Still hard, but the breathing exercise helped a couple of times.",
              "Not great. Could we talk sometime this week?",
            ]),
            read: faker.datatype.boolean(0.5),
            created_at: daysAgoIso(faker.number.int({ min: 1, max: 3 })),
          },
        ]);
        bump("messages", 2);
      }
    }

    // ---- Audit log entries ---------------------------------------
    const audit = [
      {
        id: `${pid}-aud-1`,
        actor_id: pid,
        actor_role: "PARTICIPANT",
        actor_name: name,
        action: "CHECK_IN_SUBMITTED",
        category: "CHECK_IN",
        participant_id: pid,
        description: `${name} submitted a wellbeing check-in.`,
        severity: "INFO",
        occurred_at: daysAgoIso(faker.number.int({ min: 0, max: 2 })),
      },
      {
        id: `${pid}-aud-2`,
        actor_id: "system",
        actor_role: "SYSTEM",
        actor_name: "AURA rule engine",
        action: "RISK_SCORED",
        category: "ANALYSIS",
        participant_id: pid,
        description: `Distress score ${latestScore}/100 (${riskLevel(latestScore)}) computed for ${name}.`,
        severity: latestScore >= 65 ? "HIGH" : latestScore >= 45 ? "WARNING" : "INFO",
        occurred_at: daysAgoIso(faker.number.int({ min: 0, max: 2 })),
      },
    ];
    if (worker) {
      audit.push({
        id: `${pid}-aud-3`,
        actor_id: worker.id,
        actor_role: "SUPPORT_WORKER",
        actor_name: worker.name,
        action: "PARTICIPANT_REVIEWED",
        category: "SUPPORT",
        participant_id: pid,
        description: `${worker.name} reviewed ${name}'s recent trend.`,
        severity: "INFO",
        occurred_at: daysAgoIso(faker.number.int({ min: 1, max: 7 })),
      });
    }
    await up("audit_logs", audit);
    bump("audit_logs", audit.length);

    console.log(
      `${created ? "+" : "="} ${name.padEnd(26)} ${status.padEnd(22)} ${
        worker ? "→ " + worker.name : "→ (unassigned)"
      }  [${nCheckins} check-ins, latest ${latestScore}]`
    );
  }

  console.log("\n──────── summary ────────");
  for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${k.padEnd(24)} ${v}`);
  console.log(
    "\nDone. Open the Support Dashboard, Alerts, Follow-ups, Community Insights, and the Admin panel\n" +
    "(Oversight Dashboard / User Assignments / Audit Log) to see the data.\n" +
    `Re-run safely any time. Use "node scripts/seedIndiaDataset.mjs --wipe" to clear it.`
  );
}

function buildFactors(target) {
  const f = [];
  if (target.sleep <= 3) f.push("sleep");
  if (target.stress >= 3) f.push("stress");
  if (target.safety !== "Yes") f.push("safety");
  if (target.connection <= 3) f.push("socialConnection");
  return f.length ? f : ["routine"];
}

function isUuid(id) {
  return !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

run().catch((err) => {
  console.error("\nSeed failed:", err.message || err);
  process.exit(1);
});
