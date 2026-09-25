const assert=require('node:assert/strict'),fs=require('node:fs'),{performance}=require('node:perf_hooks'),P=require('./model.js'),I=require('./investigator.js');
let seed=930517;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32),results=[];
const data={asOf:'2026-09-21',source:'synthetic-test',accounts:[],activity:[]};
for(let i=0;i<500;i++){
const decrease=[0,10,20,35,40,70][Math.floor(rand()*6)],delivery=rand()<.4,critical=rand()<.25,payment=rand()<.3,gap=rand()<.3,renewal=rand()<.4,stale=rand()<.12,lifecycle=rand()<.1?'paused':rand()<.1?'onboarding':'active';
const id=`COMBO-${i}`,a={customer_id:id,name:`Synthetic ${i}`,owner:`Synthetic CSM ${i%5}`,segment:'Synthetic',lifecycle,monthly_value:1000+i,renewal_date:renewal?'2026-10-01':'',last_activity_date:gap?'2026-09-01':'2026-09-20',cadence_days:4,on_time_pct:delivery?80:98,critical_issues:critical?1:0,overdue_days:payment?45:0,last_contact_date:'2026-09-20',updated_at:stale?'2026-08-01':'2026-09-21'};
data.accounts.push(a);for(let j=0;j<10;j++)for(let m=5;m<=8;m++)data.activity.push({customer_id:id,service:`Synthetic service ${j}`,month:`2026-0${m}`,units:m===8?100-decrease:100});
const expected=[];if(lifecycle==='paused')expected.push('restart');else if(lifecycle==='onboarding')expected.push('activate');else{if(stale)expected.push('data');if(critical)expected.push('critical');if(delivery)expected.push('delivery');if(!stale&&(decrease>=20||gap))expected.push('diagnose');if(payment)expected.push('payment');if(renewal)expected.push('renewal');if(!expected.length)expected.push('milestone');}
results.push({id,expected});}
assert.equal(data.activity.length,20000);assert.deepEqual(P.validateImport(data.accounts,data.activity,data.asOf).errors,[]);
const start=performance.now(),rank=P.ranked(data,P.DEFAULTS),rankMs=performance.now()-start;
let passed=0;const failures=[],t=performance.now();for(const {id,expected}of results){const b=I.investigate(data,id),actual=b.tasks.map(x=>x.id);if(JSON.stringify(actual)===JSON.stringify(expected)&&new Set(b.facts.map(f=>f.id)).size===b.facts.length)passed++;else failures.push({id,expected,actual});}
const timing=performance.now()-t;
const invalid=[['duplicate customer',[...data.accounts,data.accounts[0]],data.activity],['duplicate activity',data.accounts,[...data.activity,data.activity[0]]],['negative activity',data.accounts,[{...data.activity[0],units:-1}]],['infinite activity',data.accounts,[{...data.activity[0],units:Infinity}]],['unknown customer',data.accounts,[{...data.activity[0],customer_id:'UNKNOWN'}]],['future date',[{...data.accounts[0],updated_at:'2027-01-01'}],data.activity.slice(0,40)],['over capacity',Array.from({length:501},(_,i)=>({...data.accounts[0],customer_id:'LIMIT-'+i})),data.activity]];
for(const [name,a,b]of invalid)assert(P.validateImport(a,b,data.asOf).errors.length,name);
const out={seed:930517,passed,total:500,percent:passed/5,failures,capacity:{clients:500,activityRows:20000,rankMs,investigateAllMs:timing},invalidImportsRejected:invalid.length};fs.writeFileSync('stress-combinations.json',JSON.stringify(out,null,2));console.log(out);assert.equal(passed,500);
