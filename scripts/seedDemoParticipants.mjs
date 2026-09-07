// scripts/seedDemoParticipants.mjs
//
// One-off seed script: populates your Supabase project with 20 synthetic
// demo participants (fake, non-identifying names/emails only — no real
// personal data), so the Support Dashboard and Admin Panel have something
// to show instead of empty states.
//
// Derived from the gender/age/country columns of an uploaded
// speech_emotions.csv sample; the sentence-text column from that file is
// NOT used (it's unrelated filler text for a speech corpus, not wellbeing
// content, so importing it as "reflections" would misrepresent it).
//
// Uses the official Supabase Admin Auth API (auth.admin.createUser) — the
// same mechanism server/adminRouter.ts already uses to activate approved
// support workers — rather than touching the auth schema directly, so this
// is safe to run against your live project.
//
// Usage (from the project root, with your real .env in place):
//   node scripts/seedDemoParticipants.mjs
//
// Requires SUPABASE_SERVICE_ROLE_KEY in your .env (same one the admin panel
// uses). Safe to re-run: rows that already exist (matching email) are
// skipped rather than duplicated.

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wtkhcndftvsiaxstspsp.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set in your .env. Add it (Supabase dashboard -> Project Settings -> API -> service_role key) and try again."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Demographic rows lifted from the uploaded speech_emotions.csv (gender,
// age, country only — nothing identifying, it's a public TTS-script sample).
const ROWS = [
  { gender: "MALE", age: 29, country: "ZA" },
  { gender: "FEMALE", age: 42, country: "NG" },
  { gender: "FEMALE", age: 29, country: "VN" },
  { gender: "FEMALE", age: 20, country: "PK" },
  { gender: "MALE", age: 30, country: "PK" },
  { gender: "MALE", age: 18, country: "IN" },
  { gender: "MALE", age: 21, country: "MX" },
  { gender: "FEMALE", age: 20, country: "PK" },
  { gender: "MALE", age: 34, country: "NG" },
  { gender: "FEMALE", age: 31, country: "KE" },
  { gender: "FEMALE", age: 24, country: "KE" },
  { gender: "FEMALE", age: 22, country: "KE" },
  { gender: "MALE", age: 19, country: "MY" },
  { gender: "MALE", age: 21, country: "KE" },
  { gender: "FEMALE", age: 30, country: "KE" },
  { gender: "MALE", age: 20, country: "PK" },
  { gender: "FEMALE", age: 22, country: "KE" },
  { gender: "FEMALE", age: 31, country: "KE" },
  { gender: "MALE", age: 20, country: "PK" },
  { gender: "FEMALE", age: 22, country: "NG" },
];

// Fictional first/last name banks per country+gender. These are generic,
// non-identifying placeholder names — the same "100% synthetic data"
// approach the rest of this demo already uses.
const NAMES = {
  ZA: {
    MALE: { first: ["Thabo", "Sipho", "Lwazi", "Kagiso"], last: ["Nkosi", "Dlamini", "Mokoena", "Botha"] },
    FEMALE: { first: ["Nomvula", "Lerato", "Ayanda", "Zanele"], last: ["Nkosi", "Dlamini", "Mokoena", "Botha"] },
  },
  NG: {
    MALE: { first: ["Chinedu", "Emeka", "Tunde", "Ifeanyi"], last: ["Okafor", "Adeyemi", "Balogun", "Eze"] },
    FEMALE: { first: ["Ngozi", "Amara", "Folake", "Chiamaka"], last: ["Okafor", "Adeyemi", "Balogun", "Eze"] },
  },
  VN: {
    MALE: { first: ["Minh", "Khoa", "Hoang", "Duc"], last: ["Nguyen", "Tran", "Le", "Pham"] },
    FEMALE: { first: ["Linh", "Mai", "Huong", "Thao"], last: ["Nguyen", "Tran", "Le", "Pham"] },
  },
  PK: {
    MALE: { first: ["Ahmed", "Bilal", "Usman", "Hamza"], last: ["Khan", "Malik", "Siddiqui", "Raza"] },
    FEMALE: { first: ["Ayesha", "Sana", "Mahnoor", "Zara"], last: ["Khan", "Malik", "Siddiqui", "Raza"] },
  },
  IN: {
    MALE: { first: ["Arjun", "Rohan", "Vikram", "Aditya"], last: ["Sharma", "Verma", "Iyer", "Reddy"] },
    FEMALE: { first: ["Priya", "Anjali", "Neha", "Kavya"], last: ["Sharma", "Verma", "Iyer", "Reddy"] },
  },
  MX: {
    MALE: { first: ["Carlos", "Miguel", "Diego", "Alejandro"], last: ["Hernandez", "Garcia", "Lopez", "Martinez"] },
    FEMALE: { first: ["Sofia", "Valentina", "Camila", "Isabella"], last: ["Hernandez", "Garcia", "Lopez", "Martinez"] },
  },
  KE: {
    MALE: { first: ["Kevin", "Brian", "Dennis", "Peter"], last: ["Mwangi", "Otieno", "Kamau", "Wanjala"] },
    FEMALE: { first: ["Wanjiru", "Achieng", "Njeri", "Wambui"], last: ["Mwangi", "Otieno", "Kamau", "Wanjala"] },
  },
  MY: {
    MALE: { first: ["Aiman", "Farid", "Danial", "Haziq"], last: ["Rahman", "Yusof", "Ismail", "Hassan"] },
    FEMALE: { first: ["Nur", "Siti", "Aisyah", "Balqis"], last: ["Rahman", "Yusof", "Ismail", "Hassan"] },
  },
};

const REGION_BY_COUNTRY = {
  ZA: "Southern Africa",
  NG: "West Africa",
  VN: "Southeast Asia",
  PK: "South Asia",
  IN: "South Asia",
  MX: "Central America",
  KE: "East Africa",
  MY: "Southeast Asia",
};

// A realistic spread of case statuses so the Admin Oversight Dashboard and
// Support Dashboard have something in every bucket, not just "Stable".
const STATUS_CYCLE = [
  "Stable",
  "Stable",
  "Improving",
  "Stable",
  "Needs follow-up",
  "Stable",
  "Improving",
  "Stable",
  "Stable",
  "Human review pending",
  "Stable",
  "Improving",
  "Stable",
  "Stable",
  "Urgent safety signal",
  "Stable",
  "Improving",
  "Stable",
  "Needs follow-up",
  "Stable",
];

function ageGroup(age) {
  if (age < 25) return "18-24";
  if (age < 35) return "25-34";
  if (age < 45) return "35-44";
  return "45+";
}

function checkInProfileForStatus(status) {
  switch (status) {
    case "Urgent safety signal":
      return { wellbeing: 1, stress: 5, sleep: 1, safety: "No", connection: 1, supportRequested: true, score: 82 };
    case "Human review pending":
      return { wellbeing: 2, stress: 4, sleep: 2, safety: "Unsure", connection: 2, supportRequested: true, score: 58 };
    case "Needs follow-up":
      return { wellbeing: 3, stress: 3, sleep: 3, safety: "Mostly", connection: 3, supportRequested: false, score: 36 };
    case "Improving":
      return { wellbeing: 4, stress: 2, sleep: 4, safety: "Yes", connection: 4, supportRequested: false, score: 18 };
    default: // Stable
      return { wellbeing: 5, stress: 1, sleep: 5, safety: "Yes", connection: 5, supportRequested: false, score: 9 };
  }
}

function pick(list, i) {
  return list[i % list.length];
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function run() {
  console.log(`Seeding ${ROWS.length} demo participants into ${SUPABASE_URL} ...\n`);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < ROWS.length; i++) {
    const row = ROWS[i];
    const bank = NAMES[row.country][row.gender];
    const firstName = pick(bank.first, i);
    const lastName = pick(bank.last, i + 2);
    const name = `${firstName} ${lastName}`;
    const email = `demo.participant${i + 1}@auraapp.dev`;
    const password = crypto.randomBytes(12).toString("base64").replace(/[+/=]/g, "").slice(0, 14) + "Aa1!";
    const status = STATUS_CYCLE[i];
    const region = REGION_BY_COUNTRY[row.country];
    const group = ageGroup(row.age);

    try {
      const { data: created_user, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: "participant", ageRange: group, language: "English" },
      });

      if (createErr) {
        if (/already registered|already exists/i.test(createErr.message || "")) {
          console.log(`- ${name} (${email}) already exists, skipping.`);
          skipped++;
          continue;
        }
        throw createErr;
      }

      const userId = created_user.user.id;
      const participantId = `demo-participant-${i + 1}`;

      const { error: participantErr } = await supabase.from("participants").upsert({
        id: participantId,
        user_id: userId,
        consent_given: true,
        status,
        preferred_support: "Human support worker",
        language: "English",
        age_group: group,
        assigned_worker: null,
        region,
      });
      if (participantErr) throw participantErr;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ participant_id: participantId })
        .eq("id", userId);
      if (profileErr) throw profileErr;

      // Two check-ins (a week ago, and two days ago) so trend charts have
      // something to draw instead of a single flat point.
      const base = checkInProfileForStatus(status);
      const checkIns = [
        { ...base, occurred_at: daysAgoIso(7) },
        { ...base, occurred_at: daysAgoIso(2) },
      ];
      for (const [idx, ci] of checkIns.entries()) {
        const { error: ciErr } = await supabase.from("check_ins").insert({
          id: `${participantId}-ci-${idx + 1}`,
          participant_id: participantId,
          wellbeing: ci.wellbeing,
          stress: ci.stress,
          sleep: ci.sleep,
          safety: ci.safety,
          connection: ci.connection,
          support_requested: ci.supportRequested,
          immediate_safety_concern: status === "Urgent safety signal",
          calculated_score: ci.score,
          occurred_at: ci.occurred_at,
        });
        if (ciErr) throw ciErr;
      }

      console.log(`+ Created ${name} <${email}> — ${status}, region: ${region}`);
      created++;
    } catch (err) {
      console.error(`! Failed on row ${i + 1} (${email}):`, err.message || err);
      failed++;
    }
  }

  console.log(`\nDone. Created: ${created}, skipped (already existed): ${skipped}, failed: ${failed}.`);
  if (created > 0) {
    console.log(
      "Refresh your Support Dashboard and Admin Panel (Oversight Dashboard / User Assignments) to see the new demo data."
    );
  }
}

run();
