/**
 * Generates published counsellor directory profiles.
 *
 * Two groups:
 *   1. The counsellors already in the system get a hand-written profile each,
 *      because they are real accounts belonging to real people — their details
 *      should suit them rather than be invented.
 *   2. Additional counsellors are generated with faker so that every tag in
 *      support_tags is covered by someone, since a directory where half the
 *      quiz answers return nothing does not demonstrate anything.
 *
 * Generated accounts are all @seed.aura.demo so they can be found and removed
 * in one statement. They have no auth.users row, so they cannot sign in — see
 * the note printed at the end.
 *
 * Output is SQL on stdout. Deterministic: same seed, same people.
 */
import { fakerEN_IN as faker } from '@faker-js/faker';

faker.seed(20260912);

const TAGS = ['anxiety','stress','sleep','grief','relationships','family',
  'academic_pressure','work_pressure','addiction','discrimination',
  'legal_stress','financial_stress','displacement'];

const LANGS = ['Hindi','Marathi','Bengali','Tamil','Telugu','Kannada',
  'Malayalam','Gujarati','Punjabi','Odia','Assamese','Urdu'];

const FORMATS = ['video','audio','chat'];
const GENDERS = ['woman','man','non_binary'];

const sql = (v) => v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const arr = (xs) => `array[${xs.map(sql).join(',')}]::text[]`;
const pick = (xs, n) => faker.helpers.arrayElements(xs, n);

/** Bios are composed from what the counsellor actually offers, so they read as
 *  a person describing their own practice rather than filler text. */
const LABEL = {
  anxiety:'anxiety', stress:'stress and burnout', sleep:'sleep difficulties',
  grief:'grief and bereavement', relationships:'relationship difficulties',
  family:'family conflict', academic_pressure:'academic pressure',
  work_pressure:'workplace pressure', addiction:'addiction and recovery',
  discrimination:'caste- and community-based discrimination',
  legal_stress:'the strain of an ongoing legal case',
  financial_stress:'financial hardship', displacement:'displacement and housing loss',
};

function bio(specialties, years, langs) {
  const focus = specialties.slice(0, 2).map((t) => LABEL[t]).join(' and ');
  const openers = [
    `I have spent ${years} years working with people living through ${focus}.`,
    `Most of my ${years} years of practice has been with people facing ${focus}.`,
    `I work mainly with ${focus}, and have done for ${years} years.`,
  ];
  const middles = [
    'I work at the pace you set. Nothing you say here has to be repeated anywhere you do not want it repeated.',
    'Sessions are yours to direct — we can talk about what happened, or about getting through this week, whichever is more useful.',
    'I will not push you to revisit anything before you are ready. We can start wherever feels manageable.',
    'I try to be practical as well as a listener: often what helps first is sorting out sleep, or one thing that feels unmanageable.',
  ];
  const closers = [
    `I can work in ${langs.join(' or ')}.`,
    `Sessions can be in ${langs.join(' or ')}, whichever you are most comfortable in.`,
  ];
  return [faker.helpers.arrayElement(openers), faker.helpers.arrayElement(middles),
          faker.helpers.arrayElement(closers)].join(' ');
}

// --- 1. The counsellors already in the system --------------------------------
const EXISTING = [
  { id:'49f9aec9-f92c-460c-9846-a9835d1271d9', name:'Dr. Ananya Deshpande',
    specialties:['anxiety','stress','sleep'], languages:['English','Marathi','Hindi'],
    formats:['video','audio','chat'], years:14, gender:'woman', max:18 },
  { id:'12e6d61d-9dbb-447f-9d38-6b67db904d1c', name:'Kedar Mirashi',
    specialties:['academic_pressure','stress','anxiety'], languages:['English','Marathi','Hindi'],
    formats:['video','chat'], years:6, gender:'man', max:14 },
  { id:'62f54307-dba3-4335-bc4a-77582c9aaac7', name:'Rohan Kulkarni',
    specialties:['addiction','family','work_pressure'], languages:['English','Hindi','Marathi'],
    formats:['video','audio'], years:9, gender:'man', max:12 },
  { id:'f4074783-f887-45cc-826a-774a7b9cc460', name:'Sarah Jenkins, MSW',
    specialties:['discrimination','legal_stress','grief'], languages:['English','Hindi'],
    formats:['video','audio','chat'], years:11, gender:'woman', max:15 },
  { id:'8d32b78a-cb7e-4fdf-a9af-09d50957f0b7', name:'Shreyas M',
    specialties:['relationships','family','stress'], languages:['English','Kannada','Hindi'],
    formats:['chat','video'], years:5, gender:'man', max:12 },
  { id:'d0d919ae-cbbb-457b-8181-d3711b14f6e6', name:'Shreyas Nair',
    specialties:['displacement','financial_stress','legal_stress'], languages:['English','Malayalam','Hindi'],
    formats:['video','audio','chat'], years:8, gender:'man', max:16 },
];

const lines = [];
lines.push('-- Directory profiles for the counsellors already in the system.');
lines.push('-- Published so they appear in the chooser; each keeps their real profiles row.');
for (const c of EXISTING) {
  lines.push(`insert into public.counsellor_profiles
  (worker_id, display_name, bio, specialties, languages, session_formats,
   years_experience, gender, accepting_new_clients, max_caseload, published)
values (${sql(c.id)}, ${sql(c.name)}, ${sql(bio(c.specialties, c.years, c.languages))},
  ${arr(c.specialties)}, ${arr(c.languages)}, ${arr(c.formats)},
  ${c.years}, ${sql(c.gender)}, true, ${c.max}, true)
on conflict (worker_id) do update set
  display_name=excluded.display_name, bio=excluded.bio, specialties=excluded.specialties,
  languages=excluded.languages, session_formats=excluded.session_formats,
  years_experience=excluded.years_experience, gender=excluded.gender,
  accepting_new_clients=excluded.accepting_new_clients, max_caseload=excluded.max_caseload,
  published=excluded.published, updated_at=now();`);
}

// --- 2. Generated counsellors, covering every tag ----------------------------
// Each tag gets a dedicated specialist first, so no quiz answer comes back
// empty; the extra specialties on each give the ranking something to separate.
const covered = new Set();
const generated = [];

// Every tag gets its own specialist, even one the existing counsellors already
// cover: a directory where each quiz answer returns a single forced match does
// not show ranking doing anything.
for (const tag of TAGS) {
  const extra = pick(TAGS.filter((t) => t !== tag), faker.number.int({ min: 1, max: 2 }));
  const specialties = [tag, ...extra];
  specialties.forEach((t) => covered.add(t));

  const gender = faker.helpers.arrayElement(GENDERS);
  const sex = gender === 'woman' ? 'female' : gender === 'man' ? 'male' : undefined;
  const first = faker.person.firstName(sex);
  const last = faker.person.lastName();
  const years = faker.number.int({ min: 3, max: 22 });
  const languages = ['English', ...pick(LANGS, faker.number.int({ min: 1, max: 2 }))];
  const formats = pick(FORMATS, faker.number.int({ min: 2, max: 3 }));
  // A few at capacity, so the availability filter has something to exclude.
  const accepting = faker.datatype.boolean({ probability: 0.8 });

  generated.push({
    id: faker.string.uuid(),
    name: `${years >= 12 ? 'Dr. ' : ''}${first} ${last}`,
    email: `${first}.${last}`.toLowerCase().replace(/[^a-z.]/g, '') + '@seed.aura.demo',
    specialties, languages, formats, years, gender, accepting,
    max: faker.number.int({ min: 10, max: 20 }),
  });
}

lines.push('');
lines.push('-- Generated counsellors. Every support tag is covered by at least one.');
lines.push("-- All @seed.aura.demo: delete from public.profiles where email like '%@seed.aura.demo';");
for (const c of generated) {
  lines.push(`insert into public.profiles (id, role, name, email, language, consent_given)
values (${sql(c.id)}, 'support_worker', ${sql(c.name)}, ${sql(c.email)}, 'English', true)
on conflict (id) do nothing;`);
  lines.push(`insert into public.counsellor_profiles
  (worker_id, display_name, bio, specialties, languages, session_formats,
   years_experience, gender, accepting_new_clients, max_caseload, published)
values (${sql(c.id)}, ${sql(c.name)}, ${sql(bio(c.specialties, c.years, c.languages))},
  ${arr(c.specialties)}, ${arr(c.languages)}, ${arr(c.formats)},
  ${c.years}, ${sql(c.gender)}, ${c.accepting}, ${c.max}, true)
on conflict (worker_id) do update set published=true, updated_at=now();`);
}

// --json emits the same people in counsellor_directory shape, so the matching
// engine can be exercised against the real roster without a database round trip.
if (process.argv.includes('--json')) {
  const rows = [
    ...EXISTING.map((c) => ({ workerId:c.id, displayName:c.name, specialties:c.specialties,
      languages:c.languages, sessionFormats:c.formats, gender:c.gender,
      acceptingNewClients:true, ratingAvg:null, ratingCount:null })),
    ...generated.map((c) => ({ workerId:c.id, displayName:c.name, specialties:c.specialties,
      languages:c.languages, sessionFormats:c.formats, gender:c.gender,
      acceptingNewClients:c.accepting, ratingAvg:null, ratingCount:null })),
  ];
  console.log(JSON.stringify(rows, null, 1));
} else {
  console.log(lines.join('\n'));
}
console.error(`generated ${generated.length} counsellors; tags covered: ${covered.size}/${TAGS.length}`);
