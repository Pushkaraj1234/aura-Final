import { rankCounsellors, shortlistWasWidened, SHORTLIST_MAX } from '../dist-test/counsellorMatching.js';
let pass=0, fail=0;
const t=(name,fn)=>{try{fn();pass++;}catch(e){fail++;console.log('FAIL:',name,'-',e.message);}};
const eq=(a,b,m)=>{const A=JSON.stringify(a),B=JSON.stringify(b);if(A!==B)throw new Error(`${m||''} got ${A} want ${B}`);};
const ok=(c,m)=>{if(!c)throw new Error(m||'expected true');};

const c=(id,over={})=>({workerId:id,displayName:id,specialties:[],languages:[],sessionFormats:[],
  acceptingNewClients:true,ratingAvg:null,ratingCount:null,gender:null,...over});
const prefs=(o={})=>({lookingFor:[],preferredLanguages:[],genderPreference:'no_preference',
  preferredFormats:[],startUrgency:'no_rush',...o});

t('specialty overlap ranks above language match',()=>{
  const list=[c('lang',{languages:['hi']}), c('spec',{specialties:['anxiety']})];
  const r=rankCounsellors(list,prefs({lookingFor:['anxiety'],preferredLanguages:['hi']}));
  eq(r[0].counsellor.workerId,'spec');
});

t('more shared specialties outranks fewer',()=>{
  const list=[c('one',{specialties:['anxiety']}), c('two',{specialties:['anxiety','sleep']})];
  const r=rankCounsellors(list,prefs({lookingFor:['anxiety','sleep']}));
  eq(r[0].counsellor.workerId,'two');
});

t('gender preference is a hard filter when stated',()=>{
  const list=[c('a',{gender:'man',specialties:['anxiety']}),c('b',{gender:'woman',specialties:['anxiety']}),
              c('c',{gender:'woman',specialties:['anxiety']}),c('d',{gender:'woman',specialties:['anxiety']})];
  const r=rankCounsellors(list,prefs({lookingFor:['anxiety'],genderPreference:'woman'}));
  ok(r.every(m=>m.counsellor.gender==='woman'),'a man was returned despite a stated preference');
});

t('urgent start excludes counsellors who are full',()=>{
  const list=[c('full',{acceptingNewClients:false,specialties:['anxiety']}),
              c('a',{specialties:['anxiety']}),c('b',{specialties:['anxiety']}),c('x',{specialties:['anxiety']})];
  const r=rankCounsellors(list,prefs({lookingFor:['anxiety'],startUrgency:'asap'}));
  ok(!r.some(m=>m.counsellor.workerId==='full'),'a full counsellor was offered for an asap start');
});

t('hard filters relax rather than return a list of one',()=>{
  const list=[c('a',{gender:'man',specialties:['anxiety']}),c('b',{gender:'man',specialties:['anxiety']}),
              c('w',{gender:'woman',specialties:['anxiety']})];
  const r=rankCounsellors(list,prefs({lookingFor:['anxiety'],genderPreference:'woman'}));
  ok(r.length>=3,'shortlist collapsed to '+r.length+' instead of widening');
  ok(shortlistWasWidened(list,prefs({lookingFor:['anxiety'],genderPreference:'woman'})),'widening not reported');
});

t('zero-overlap counsellors are excluded entirely',()=>{
  const r=rankCounsellors([c('none',{specialties:['grief'],acceptingNewClients:false})],
                          prefs({lookingFor:['anxiety']}));
  eq(r.length,0);
});

t('shortlist is capped',()=>{
  const list=Array.from({length:20},(_,i)=>c('w'+i,{specialties:['anxiety']}));
  eq(rankCounsellors(list,prefs({lookingFor:['anxiety']})).length,SHORTLIST_MAX);
});

t('ordering is deterministic across identical inputs',()=>{
  const list=[c('zeta',{specialties:['anxiety']}),c('alpha',{specialties:['anxiety']})];
  const a=rankCounsellors(list,prefs({lookingFor:['anxiety']})).map(m=>m.counsellor.workerId);
  const b=rankCounsellors([...list].reverse(),prefs({lookingFor:['anxiety']})).map(m=>m.counsellor.workerId);
  eq(a,b,'same answers produced a different order');
  eq(a[0],'alpha');
});

t('every match states at least one reason',()=>{
  const r=rankCounsellors([c('a',{specialties:['anxiety'],languages:['hi']})],
                          prefs({lookingFor:['anxiety'],preferredLanguages:['hi']}));
  ok(r[0].reasons.length>0,'a match was returned with no stated reason');
});

t('published rating breaks a score tie, unrated is not penalised into last',()=>{
  const list=[c('unrated',{specialties:['anxiety']}),c('rated',{specialties:['anxiety'],ratingAvg:4.8,ratingCount:7})];
  const r=rankCounsellors(list,prefs({lookingFor:['anxiety']}));
  eq(r[0].counsellor.workerId,'rated');
});

console.log(`matching: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
