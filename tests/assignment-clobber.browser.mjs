/**
 * The bug: a participant's browser cached their old counsellor, and the
 * "re-assert this record exists" upsert sent that cached value back to the
 * server on every render. An admin could unassign someone and the next page
 * load silently restored the old assignment, leaving participants.assigned_worker
 * contradicting its own assignment_history.
 *
 * This asserts the negative directly: whatever the cache holds, no request the
 * client makes to the participants table may carry assigned_worker.
 */
import { chromium } from '/home/user/aura-Final/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let pass=0, fail=0;
const check=(n,c,e='')=>{ if(c){pass++;console.log('PASS',n);} else {fail++;console.log('FAIL',n,e);} };

const STALE = '99999999-9999-9999-9999-999999999999';
const page = await b.newPage({ viewport:{width:1280,height:900} });
const writes = [];

await page.route('**/rest/v1/participants**', async r => {
  const m = r.request().method();
  if (m === 'POST' || m === 'PATCH') {
    let body = {};
    try { body = JSON.parse(r.request().postData() || '{}'); } catch {}
    writes.push({ method: m, body });
    return r.fulfill({ status:201, contentType:'application/json', body:'[]' });
  }
  // Server says: nobody is assigned. That is the state the admin just set.
  return r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify([{
    id:'11111111-1111-1111-1111-111111111111', user_id:'11111111-1111-1111-1111-111111111111',
    consent_given:true, status:'Stable', assigned_worker:null, language:'English',
    age_group:'25-34', created_at:new Date().toISOString(), updated_at:new Date().toISOString() }]) });
});
await page.route('**supabase.co/**', r => r.abort());

await page.goto('http://127.0.0.1:3000/', { waitUntil:'domcontentloaded' });
await page.evaluate((stale) => {
  localStorage.clear();
  localStorage.setItem('aura_storage_ver_v2','2.6');
  localStorage.setItem('aura_language','en');
  localStorage.setItem('aura_auth_token','t');
  const uid='11111111-1111-1111-1111-111111111111';
  // A browser that still believes the old counsellor is assigned.
  localStorage.setItem('aura_participants_v2', JSON.stringify([{ id:uid, name:'P',
    consentGiven:true, status:'Stable', assignedWorker: stale, language:'English',
    ageGroup:'25-34', notes:[], checkIns:[], createdAt:new Date().toISOString() }]));
  localStorage.setItem('aura_auth_session', JSON.stringify({ id:uid, email:'p@x.com',
    role:'participant', name:'P', consentGiven:true, createdAt:new Date().toISOString() }));
}, STALE);
await page.reload({ waitUntil:'domcontentloaded' });
await page.waitForTimeout(4000);

check('the client did write to participants (test is exercising the path)', writes.length > 0, `${writes.length} writes`);
const leaked = writes.filter(w => 'assigned_worker' in (w.body || {}));
check('no client write carries assigned_worker', leaked.length === 0,
  JSON.stringify(leaked.slice(0,2)));
const restored = writes.filter(w => JSON.stringify(w.body||{}).includes(STALE));
check('the stale counsellor is never sent back to the server', restored.length === 0,
  JSON.stringify(restored.slice(0,2)));

console.log(`\nassignment-clobber: ${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail?1:0);
