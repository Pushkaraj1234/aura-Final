/**
 * The counsellor-authored test flow, end to end in the browser.
 *
 * The database enforces who can read and write what — that is covered by SQL
 * checks. What this asserts is that the screens actually render the two sides
 * of it: a participant with a test waiting sees it, and a participant with
 * nothing waiting is not shown an empty box.
 */
import { chromium } from '/home/user/aura-Final/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let pass=0, fail=0;
const check=(n,c,e='')=>{ if(c){pass++;console.log('PASS',n);} else {fail++;console.log('FAIL',n,e);} };

const UID='11111111-1111-1111-1111-111111111111';
const TEST = { id:'t-1', participant_id:UID, worker_id:'22222222-2222-2222-2222-222222222222',
  title:'Weekly review', instructions:'Take your time.', status:'assigned',
  questions:[
    {id:'q1',prompt:'How has this week been?',type:'choice',options:['Hard','Mixed','Better']},
    {id:'q2',prompt:'How well are you sleeping?',type:'scale'},
    {id:'q3',prompt:'Anything else?',type:'text'}],
  created_at:new Date().toISOString(), updated_at:new Date().toISOString() };

async function session({ tests = [], responses = [], reviews = [] }) {
  const page = await b.newPage({ viewport:{width:1440,height:1100} });
  await page.route('**/rest/v1/counsellor_tests**', r =>
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(tests)}));
  await page.route('**/rest/v1/counsellor_test_responses**', r =>
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(responses)}));
  await page.route('**/rest/v1/my_test_reviews**', r =>
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reviews)}));
  await page.route('**supabase.co/**', r=>r.abort());
  await page.goto('http://127.0.0.1:3000/', { waitUntil:'domcontentloaded' });
  await page.evaluate((uid)=>{
    localStorage.clear();
    localStorage.setItem('aura_storage_ver_v2','2.6');
    localStorage.setItem('aura_language','en');
    localStorage.setItem('aura_auth_token','t');
    localStorage.setItem('aura_participants_v2', JSON.stringify([{ id:uid, name:'Pushkaraj',
      consentGiven:true, status:'Stable', language:'English', ageGroup:'25-34', notes:[], checkIns:[],
      assignedWorker:'22222222-2222-2222-2222-222222222222', createdAt:new Date().toISOString() }]));
    localStorage.setItem('aura_auth_session', JSON.stringify({ id:uid, email:'p@x.com',
      role:'participant', name:'Pushkaraj', consentGiven:true, createdAt:new Date().toISOString() }));
  }, UID);
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(2800);
  return page;
}

// --- a test is waiting ---
let page = await session({ tests:[TEST] });
let body = await page.evaluate(()=>document.body.innerText);
check('an assigned test appears on the profile', /Weekly review/i.test(body), body.slice(0,200));
check('the section is labelled as coming from the counsellor', /From your counsellor/i.test(body));

await page.evaluate(()=>{ const el=[...document.querySelectorAll('button')].find(b=>/^\s*Start\s*$/i.test(b.textContent||'')); el&&el.click(); });
await page.waitForTimeout(900);
body = await page.evaluate(()=>document.body.innerText);
check('the counsellor\'s own question text is shown', /How has this week been/i.test(body), body.slice(0,200));
check('choice options are offered', /Hard/.test(body) && /Mixed/.test(body) && /Better/.test(body));
check('a 1-5 scale is offered', /How well are you sleeping/i.test(body));
const scaleButtons = await page.evaluate(()=>
  [...document.querySelectorAll('button')].filter(b=>/^[1-5]$/.test((b.textContent||'').trim())).length);
check('the scale renders five buttons', scaleButtons >= 5, `found ${scaleButtons}`);
const textareas = await page.evaluate(()=>document.querySelectorAll('textarea').length);
check('a free-text box is offered', textareas >= 1, `found ${textareas}`);
await page.close();

// --- already answered, and reviewed ---
page = await session({
  tests:[{...TEST, status:'reviewed'}],
  responses:[{ id:'r-1', test_id:'t-1', participant_id:UID, answers:[{questionId:'q1',value:'Mixed'}],
    submitted_at:new Date().toISOString(), mark:62, review_text:'You sounded steadier this week.',
    reviewed_at:new Date().toISOString() }],
  reviews:[{ test_id:'t-1', participant_id:UID, title:'Weekly review',
    answers:[{questionId:'q1',value:'Mixed'}], submitted_at:new Date().toISOString(),
    review_text:'You sounded steadier this week.', reviewed_at:new Date().toISOString() }],
});
body = await page.evaluate(()=>document.body.innerText);
check('the written advice is shown to the participant', /steadier this week/i.test(body), body.slice(0,250));
check('the mark is NOT shown to the participant', !/\b62\b\s*\/\s*100/.test(body) && !/62\/100/.test(body));
check('an answered test is not offered again', !/^\s*Start\s*$/m.test(body));
await page.close();

// --- nothing set ---
page = await session({});
body = await page.evaluate(()=>document.body.innerText);
check('no empty box when there is nothing to show', !/From your counsellor/i.test(body));
await page.close();

console.log(`\ncounsellor-tests: ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
