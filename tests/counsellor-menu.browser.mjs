/**
 * The chooser was reachable only from a card partway down the profile page, so
 * people looking for it in the account menu — where it belongs — could not find
 * it. This checks both menus actually open the directory.
 */
import { chromium } from '/home/user/aura-Final/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let pass=0, fail=0;
const check=(n,c,e='')=>{ if(c){pass++;console.log('PASS',n);} else {fail++;console.log('FAIL',n,e);} };

async function session(width){
  const page = await b.newPage({ viewport:{width,height:900} });
  await page.route('**supabase.co/**', r=>r.abort());
  await page.route('**/api/**', r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
  await page.goto('http://127.0.0.1:3000/', { waitUntil:'domcontentloaded' });
  await page.evaluate(()=>{
    localStorage.clear();
    localStorage.setItem('aura_storage_ver_v2','2.6');
    localStorage.setItem('aura_language','en');
    localStorage.setItem('aura_auth_token','t');
    const uid='11111111-1111-1111-1111-111111111111';
    localStorage.setItem('aura_participants_v2', JSON.stringify([{ id:uid, name:'Pushkaraj Narkhede',
      consentGiven:true, status:'Stable', language:'English', ageGroup:'25-34', notes:[], checkIns:[],
      createdAt:new Date().toISOString() }]));
    localStorage.setItem('aura_auth_session', JSON.stringify({ id:uid, email:'p@x.com',
      role:'participant', name:'Pushkaraj Narkhede', consentGiven:true, createdAt:new Date().toISOString() }));
  });
  await page.reload({ waitUntil:'domcontentloaded' });
  await page.waitForTimeout(2500);
  return page;
}

// --- desktop: the account dropdown the user actually opened ---
let page = await session(1440);
await page.evaluate(()=>{
  const el=[...document.querySelectorAll('button')].find(b=>/Pushkaraj Narkhede/i.test(b.textContent||''));
  el&&el.click();
});
await page.waitForTimeout(700);
let body = await page.evaluate(()=>document.body.innerText);
check('account menu lists My Counsellor', /My Counsellor/i.test(body), body.slice(0,200));

await page.evaluate(()=>{
  const el=[...document.querySelectorAll('button')].find(b=>/^\s*My Counsellor\s*$/i.test(b.textContent||''));
  el&&el.click();
});
await page.waitForTimeout(1800);
body = await page.evaluate(()=>document.body.innerText);
check('account menu opens the chooser', /Choose your counsellor/i.test(body), body.slice(0,200));
await page.close();

// --- phone width: the hamburger panel ---
page = await session(390);
await page.evaluate(()=>{
  const btns=[...document.querySelectorAll('header button')];
  const burger=btns[btns.length-1];
  burger&&burger.click();
});
await page.waitForTimeout(700);
body = await page.evaluate(()=>document.body.innerText);
check('mobile menu lists My Counsellor', /My Counsellor/i.test(body), body.slice(0,220));
await page.close();

console.log(`\ncounsellor-menu: ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
