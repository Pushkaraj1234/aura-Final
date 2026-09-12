import { chromium } from '/home/user/aura-Final/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let pass=0, fail=0;
const check=(name,cond,extra='')=>{ if(cond){pass++;console.log('PASS',name);} else {fail++;console.log('FAIL',name,extra);} };

async function session(assignedWorker) {
  const page = await b.newPage({ viewport:{width:1440,height:1000} });
  await page.route('**supabase.co/**', r => r.abort());
  await page.route('**/api/**', r => r.fulfill({status:200, contentType:'application/json', body:'{}'}));
  await page.goto('http://127.0.0.1:3000/', { waitUntil:'domcontentloaded' });
  await page.evaluate((aw) => {
    localStorage.clear();
    localStorage.setItem('aura_storage_ver_v2','2.6');
    localStorage.setItem('aura_language','en');
    localStorage.setItem('aura_auth_token','t');
    localStorage.setItem('aura_auth_session', JSON.stringify({ id:'11111111-1111-1111-1111-111111111111',
      email:'pushkaraj@x.com', role:'participant', name:'Pushkaraj', consentGiven:true,
      supportPreference:'Human counselor', createdAt:new Date().toISOString() }));
    const p = { id:'11111111-1111-1111-1111-111111111111', userId:'11111111-1111-1111-1111-111111111111',
      consentGiven:true, status:'Stable', assignedWorker: aw, checkIns:[], createdAt:new Date().toISOString() };
    localStorage.setItem('aura_participants_v2', JSON.stringify([p]));
  }, assignedWorker);
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(2500);
  return page;
}

// ---- unassigned: the reported bug ----
let page = await session(null);
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button,a')].find(e=>/messages/i.test(e.textContent||'')); b&&b.click(); });
await page.waitForTimeout(1500);
let body = await page.evaluate(()=>document.body.innerText);
check('unassigned Messages offers the chooser', /Choose my counsellor/i.test(body), body.slice(0,200));
check('unassigned Messages still offers emergency help', /Emergency Resources/i.test(body));

// click it and confirm we land on the directory
await page.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(e=>/Choose my counsellor/i.test(e.textContent||'')); b&&b.click(); });
await page.waitForTimeout(1800);
body = await page.evaluate(()=>document.body.innerText);
check('chooser page opens from Messages', /Choose your counsellor/i.test(body), body.slice(0,200));
check('chooser offers the skippable quiz', /browse all counsellors|Browse all instead|narrow this down/i.test(body));
await page.close();

// ---- the profile entry point ----
page = await session(null);
body = await page.evaluate(()=>document.body.innerText);
check('profile offers choosing when unassigned', /Choose a counsellor/i.test(body), body.slice(0,300));
await page.close();

// ---- assigned: the change-counsellor path ----
page = await session('22222222-2222-2222-2222-222222222222');
body = await page.evaluate(()=>document.body.innerText);
check('profile offers changing when assigned', /Change my counsellor/i.test(body), body.slice(0,300));
await page.close();

console.log(`\nassign-ui: ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
