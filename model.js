/* Pure data and risk rules. No network access or browser dependencies. */
(function (root) {
  'use strict';
  const DEFAULTS = {preset:'general', currency:'USD', customerLabel:'Customer', unit:'Orders', serviceLabel:'Service', valueLabel:'Monthly value', decline:20, minBaseline:10, sla:90, staleDays:7};
  const PRESETS = {
    general:{customerLabel:'Customer', unit:'Orders', serviceLabel:'Service', valueLabel:'Monthly value'},
    services:{customerLabel:'Client', unit:'Projects', serviceLabel:'Service', valueLabel:'Monthly service value'},
    saas:{customerLabel:'Account', unit:'Active users', serviceLabel:'Product', valueLabel:'Monthly recurring revenue'},
    commerce:{customerLabel:'Customer', unit:'Orders', serviceLabel:'Product category', valueLabel:'Monthly sales value'}
  };
  const STATUS = ['Critical','At risk','Watch','Review data','Onboarding','Stable','Paused'];
  const STATUS_CLASS = {'Critical':'critical','At risk':'risk','Watch':'watch','Review data':'unknown','Onboarding':'onboarding','Stable':'healthy','Paused':'paused'};
  const ACCOUNT_FIELDS = ['customer_id','name','owner','segment','lifecycle','monthly_value','renewal_date','last_activity_date','cadence_days','on_time_pct','critical_issues','overdue_days','last_contact_date','updated_at'];
  const ACTIVITY_FIELDS = ['customer_id','service','month','units'];
  const dateValue = x => /^\d{4}-\d{2}-\d{2}$/.test(x||'') && !isNaN(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
  const days = (from,to) => from && to ? Math.round((Date.parse(to)-Date.parse(from))/86400000) : null;
  const previousMonth = (month,offset=1) => {const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-offset);return d.toISOString().slice(0,7);};
  const sum = xs => xs.reduce((s,n)=>s+n,0);
  const isUrgent = r => ['Critical','At risk'].includes(r.status);
  function demo() {
    const asOf='2026-09-21';
    const specs=[
      ['Q7M','A1','Enterprise',18000,12,74,2,0,'2026-10-03',.47],
      ['R4K','B2','Mid-market',9400,17,84,1,12,'2026-10-12',.58],
      ['T9V','A1','Enterprise',24000,3,96,0,0,'2026-10-19',.63],
      ['N2X','C3','Mid-market',7200,2,97,0,0,'2026-12-12',1.12],
      ['P8J','C3','Small business',3800,24,82,1,41,'2026-10-01',.35],
      ['W3F','B2','Mid-market',11500,2,98,0,0,'2026-11-09',1.08],
      ['B6Z','A1','Enterprise',21000,4,92,0,0,'2027-01-05',1.03],
      ['H5Q','B2','Small business',2600,6,86,0,0,'',.93],
      ['L1Y','C3','Mid-market',6500,3,96,0,0,'2026-10-25',1.04],
      ['D0R','A1','Small business',1800,2,95,0,0,'',1.2],
      ['F4C','B2','Small business',3100,38,90,0,0,'',.1],
      ['K8S','C3','Mid-market',8200,3,null,null,null,'2026-11-03',.98]
    ];
    const ago=n=>new Date(Date.parse(asOf)-n*86400000).toISOString().slice(0,10);
    const accounts=specs.map((s,i)=>({customer_id:'DEMO-'+s[0],name:'Demo Client '+s[0],owner:'Demo CSM '+s[1],segment:s[2],lifecycle:i===9?'onboarding':i===10?'paused':'active',monthly_value:s[3],renewal_date:s[8],last_activity_date:ago(s[4]),cadence_days:i===4?5:4,on_time_pct:s[5],critical_issues:s[6],overdue_days:s[7],last_contact_date:ago(i<3?13+i*3:5+i),updated_at:ago(i===8?18:0)}));
    const activity=[];
    specs.forEach((s,i)=>['Core service','Advisory','Support'].slice(0,i%3===0?3:2).forEach((service,j)=>{
      const base=28+i*5+j*13;
      for(let m=1;m<=9;m++){
        if(i===9&&m<8)continue;
        let units=Math.round(base*(.88+m*.025)*(m===8?s[9]:m===9?s[9]*.62:1));
        activity.push({customer_id:accounts[i].customer_id,service,month:`2026-${String(m).padStart(2,'0')}`,units});
      }
    }));
    return {accounts,activity,asOf,source:'demo'};
  }
  function aggregate(activity,id) {
    const map={};for(const row of activity)if(!id||row.customer_id===id)map[row.month]=(map[row.month]||0)+row.units;return map;
  }
  function evaluate(account, activity, asOf, config=DEFAULTS, indexedMonths=null, indexedServices=null) {
    const months=indexedMonths||aggregate(activity,account.customer_id),closed=previousMonth(asOf.slice(0,7));
    const history=[1,2,3].map(n=>months[previousMonth(closed,n)]);
    const hasBaseline=history.every(n=>n!==undefined),baseline=hasBaseline?sum(history)/3:null;
    const latest=months[closed]??null,change=baseline>0&&latest!==null?(latest/baseline-1)*100:null;
    const silence=days(account.last_activity_date,asOf),freshness=days(account.updated_at,asOf),renewal=days(asOf,account.renewal_date);
    const missing=[];if(!account.updated_at)missing.push('Missing source update date');else if(freshness>config.staleDays)missing.push(`Data is ${freshness} days old`);
    if(!hasBaseline||latest===null)missing.push('Need four completed months of activity');
    const serviceMonths=indexedServices||activity.filter(r=>r.customer_id===account.customer_id).reduce((map,r)=>{(map[r.service]??=new Set()).add(r.month);return map;},Object.create(null));
    if(hasBaseline&&latest!==null&&Object.values(serviceMonths).some(set=>[0,1,2,3].some(n=>!set.has(previousMonth(closed,n)))))missing.push('Incomplete service-month coverage');
    if([account.on_time_pct,account.critical_issues,account.overdue_days].every(n=>n===null))missing.push('No operational risk fields supplied');
    if(!account.last_activity_date||!account.cadence_days)missing.push('Missing activity date or normal cadence');
    const evidence=[];
    if(change!==null&&baseline>=config.minBaseline&&change<=-config.decline)evidence.push({label:'Activity declined',detail:`${Math.round(change)}% in the latest completed month vs the preceding 3-month average`,points:change<=-config.decline*2?40:25,kind:'activity'});
    if(silence!==null&&account.cadence_days&&silence>account.cadence_days*2)evidence.push({label:'Ordering or usage gap',detail:`${silence} days since activity; normal interval is ${account.cadence_days} days`,points:20,kind:'silence'});
    if(account.on_time_pct!==null&&account.on_time_pct<config.sla)evidence.push({label:'Delivery below target',detail:`${account.on_time_pct}% on time vs ${config.sla}% target`,points:15,kind:'delivery'});
    if(account.critical_issues>0)evidence.push({label:'Unresolved critical issue',detail:`${account.critical_issues} critical issue${account.critical_issues===1?'':'s'} require a resolution owner`,points:20,kind:'critical'});
    if(account.overdue_days>30)evidence.push({label:'Payment is overdue',detail:`Oldest overdue invoice: ${account.overdue_days} days; confirm whether there is a dispute`,points:15,kind:'payment'});
    if(renewal!==null&&renewal>=0&&renewal<=30&&evidence.length)evidence.push({label:'Renewal is approaching',detail:`${renewal} days to renewal, with other active risk signals`,points:10,kind:'renewal'});
    const score=Math.min(100,sum(evidence.map(e=>e.points)));
    let status=score>=60?'Critical':score>=35?'At risk':score>=15?'Watch':'Stable';
    if(account.lifecycle==='paused')status='Paused';else if(account.lifecycle==='onboarding')status='Onboarding';else if(missing.length)status='Review data';
    let action=missing.length?'Verify the source data before classifying risk.':score===0?'Confirm the next success milestone.':'Validate the cause of declining activity with the customer.';
    if(evidence.some(e=>e.kind==='critical')&&!missing.length)action='Agree a critical-issue owner and a customer update today.';
    else if(evidence.some(e=>e.kind==='silence')&&!missing.length)action='Confirm whether the activity pause is expected.';
    else if(evidence.some(e=>e.kind==='delivery')&&!missing.length)action='Review delivery misses and agree a recovery date.';
    if(status==='Paused')action='Confirm the agreed restart date; exclude from churn outreach.';
    if(status==='Onboarding')action='Confirm activation milestones and the first value event.';
    const coverage=[account.on_time_pct,account.critical_issues,account.overdue_days].filter(n=>n!==null).length+(!missing.length?3:0);
    return {...account,months,closed,baseline,latest,change,silence,freshness,renewal,evidence,score,status,missing,action,coverage};
  }
  function ranked(data,config) {
    const months=Object.create(null),services=Object.create(null);
    for(const r of data.activity){const m=months[r.customer_id]??={};m[r.month]=(m[r.month]||0)+r.units;const s=services[r.customer_id]??=Object.create(null);(s[r.service]??=new Set()).add(r.month);}
    return data.accounts.map(a=>evaluate(a,data.activity,data.asOf,config,months[a.customer_id]||{},services[a.customer_id]||{})).sort((a,b)=>STATUS.indexOf(a.status)-STATUS.indexOf(b.status)||b.score-a.score||b.monthly_value-a.monthly_value);
  }
  function validateImport(accounts,activity,asOf){
    const errors=[];if(!dateValue(asOf))return {errors:['Choose a valid snapshot date.']};
    if(!accounts.length||accounts.length>500)errors.push('Provide 1–500 customer rows.');
    if(!activity.length||activity.length>20000)errors.push('Provide 1–20,000 activity rows.');
    const ids=new Set(),cleanAccounts=[],cleanActivity=[];
    const numeric=['monthly_value','cadence_days','on_time_pct','critical_issues','overdue_days'];
    for(const [i,row] of accounts.entries()){
      const a={};for(const field of ACCOUNT_FIELDS)a[field]=String(row[field]??'').trim();
      const fail=message=>errors.push(`Customer row ${i+2}: ${message}`);
      if(!/^[A-Za-z0-9_-]{1,64}$/.test(a.customer_id)||ids.has(a.customer_id))fail('customer_id must be unique, using letters, numbers, _ or -.');
      ids.add(a.customer_id);
      if(!a.name||a.name.length>100||a.owner.length>80||a.segment.length>80)fail('name is required (max 100 characters); owner and segment max 80.');
      if(!['active','onboarding','paused'].includes(a.lifecycle))fail('lifecycle must be active, onboarding or paused.');
      for(const field of numeric){a[field]=a[field]===''?null:Number(a[field]);if(a[field]!==null&&(!Number.isFinite(a[field])||a[field]<0||a[field]>1e12))fail(`${field} must be a nonnegative number.`);}
      if(a.monthly_value===null)fail('monthly_value is required; use 0 if there is no current value.');
      if(a.cadence_days!==null&&(a.cadence_days<1||!Number.isInteger(a.cadence_days)))fail('cadence_days must be a positive whole number.');
      if(a.on_time_pct>100)fail('on_time_pct cannot exceed 100.');
      for(const field of ['critical_issues','overdue_days'])if(a[field]!==null&&!Number.isInteger(a[field]))fail(`${field} must be a whole number.`);
      for(const field of ['renewal_date','last_activity_date','last_contact_date','updated_at'])if(a[field]&&(!dateValue(a[field])||(field!=='renewal_date'&&a[field]>asOf)))fail(`${field} must be YYYY-MM-DD${field==='renewal_date'?'':' and not after the snapshot'}.`);
      cleanAccounts.push(a);
    }
    const seen=new Set();
    for(const [i,row] of activity.entries()){
      const r={customer_id:String(row.customer_id??'').trim(),service:String(row.service??'').trim(),month:String(row.month??'').trim(),units:String(row.units??'').trim()===''?NaN:Number(row.units)};
      const key=JSON.stringify([r.customer_id,r.service,r.month]);
      if(!ids.has(r.customer_id)||!r.service||r.service.length>80||!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.month)||r.month>asOf.slice(0,7)||!Number.isFinite(r.units)||r.units<0||r.units>1e12||seen.has(key))errors.push(`Activity row ${i+2}: invalid customer, service, month or units; duplicate customer/service/month rows are not allowed.`);
      seen.add(key);cleanActivity.push(r);
    }
    const distinctMonths=new Set(cleanActivity.map(r=>r.month));if(distinctMonths.size>24)errors.push('Use at most 24 distinct months per import.');
    return {errors:errors.slice(0,12),data:{accounts:cleanAccounts,activity:cleanActivity,asOf,source:'import'}};
  }
  const api={DEFAULTS,PRESETS,STATUS,STATUS_CLASS,ACCOUNT_FIELDS,ACTIVITY_FIELDS,demo,evaluate,ranked,aggregate,validateImport,days,previousMonth,sum,isUrgent,dateValue};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Pulse=api;
})(typeof window!=='undefined'?window:globalThis);
