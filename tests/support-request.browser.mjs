import { chromium } from '/home/user/aura-Final/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let pass=0, fail=0;
const check=(n,c,e='')=>{ if(c){pass++;console.log('PASS',n);} else {fail++;console.log('FAIL',n,e);} };

async function openResults(assignedWorker){
  const page = await b.newPage({ viewport:{width:1440,height:1200} });
  // Let the message insert succeed so a genuine send can be distinguished from
  // a failed one; everything else on supabase stays blocked.
  await page.route('**/rest/v1/messages**', r => {
    if (r.request().method() === 'POST') {
      return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        id:'msg-1', participant_id:'11111111-1111-1111-1111-111111111111',
        sender_id:'11111111-1111-1111-1111-111111111111', sender_role:'participant',
        body:'x', read:false, created_at:new Date().toISOString() }) });
    }
    return r.fulfill({ status:200, contentType:'application/json', body:'[]' });
  });
  await page.route('**supabase.co/**', r=>r.abort());
  await page.route('**/api/**', r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('http://127.0.0.1:3000/', { waitUntil:'domcontentloaded' });
  await page.evaluate((aw)=>{
    localStorage.clear();
    localStorage.setItem('aura_storage_ver_v2','2.6');
    localStorage.setItem('aura_language','en');
    localStorage.setItem('aura_auth_token','t');
    const uid='11111111-1111-1111-1111-111111111111';
    localStorage.setItem('aura_participants_v2', JSON.stringify([{
      id: uid, name:'Pushkaraj', consentGiven:true, createdAt:new Date().toISOString(),
      preferredSupport:'Human counselor', language:'English', ageGroup:'25-34',
      status:'Stable', notes:[], assignedWorker: aw,
      checkIns:[{ id:'ci-1', participantId: uid, timestamp:new Date().toISOString(),
        wellbeing:2, stress:4, sleep:2, safety:'Unsure', connection:2,
        supportRequested:false, immediateSafetyConcern:false }],
    }]));
    localStorage.setItem('aura_auth_session', JSON.stringify({ id: uid, email:'p@x.com',
      role:'participant', name:'Pushkaraj', consentGiven:true, supportPreference:'Human counselor',
      createdAt:new Date().toISOString() }));
  }, assignedWorker);
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(2500);
  const btn = page.getByRole('button', { name:/View AI Analysis|View Full Results/i }).first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(2800); }
  return page;
}

// ---------- unassigned: the reported bug ----------
let page = await openResults(null);
let body = await page.evaluate(()=>document.body.innerText);
check('results screen opened', /What you can do now/i.test(body), body.slice(0,150));
check('offers Choose a Counselor when unassigned', /Choose a Counselor/i.test(body));
check('does NOT offer Talk to a Counselor when unassigned', !/Talk to a Counselor/i.test(body));
check('explains why there is nobody to arrange it', /don't have a counsellor yet/i.test(body));

// clicking must NOT produce a false confirmation; it must route to the chooser
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>/Choose a Counselor/i.test(e.textContent||'')); b&&b.click(); });
await page.waitForTimeout(1800);
body = await page.evaluate(()=>document.body.innerText);
check('Choose a Counselor navigates to the directory', /Choose your counsellor/i.test(body), body.slice(0,150));
check('no false "Request Received" anywhere', !/Request Received/i.test(body));
await page.close();

// ---------- assigned ----------
page = await openResults('22222222-2222-2222-2222-222222222222');
body = await page.evaluate(()=>document.body.innerText);
check('offers Talk to a Counselor when assigned', /Talk to a Counselor/i.test(body), body.slice(0,150));
check('no unassigned notice when assigned', !/don't have a counsellor yet/i.test(body));
check('no confirmation before clicking', !/has been told you/i.test(body));

await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>/Talk to a Counselor/i.test(e.textContent||'')); b&&b.click(); });
await page.waitForTimeout(2000);
body = await page.evaluate(()=>document.body.innerText);
check('confirmation appears only after a real send', /has been told you|Request Sent/i.test(body), body.slice(0,200));
await page.close();


// ---------- assigned, but the send fails ----------
// The original bug was a confirmation that did not depend on anything actually
// happening. A rejected send must therefore surface an error, never a tick.
page = await openResults('22222222-2222-2222-2222-222222222222');
await page.unroute('**/rest/v1/messages**');
await page.route('**/rest/v1/messages**', r => r.abort());
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>/Talk to a Counselor/i.test(e.textContent||'')); b&&b.click(); });
await page.waitForTimeout(2500);
body = await page.evaluate(()=>document.body.innerText);
check('failed send shows an error', /could not send/i.test(body), body.slice(0,250));
check('failed send shows NO confirmation', !/Request Sent|has been told you/i.test(body));
await page.close();

console.log(`\nresults-fix: ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
