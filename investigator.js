/* Transparent investigation rules. No model calls, network requests or automatic outreach. */
(function(root){
'use strict';
const P=typeof module!=='undefined'?require('./model.js'):root.Pulse;
function investigate(data,id,config=P.DEFAULTS,context=[]){
 const account=data.accounts.find(a=>a.customer_id===id);if(!account)throw Error('Account not found');
 const r=P.evaluate(account,data.activity,data.asOf,config),closed=r.closed;
 const fieldNames={silence:'last_activity_date / cadence_days',delivery:'on_time_pct',critical:'critical_issues',payment:'overdue_days',renewal:'renewal_date'};
 const source=(field)=>`Customer record ${id} · ${fieldNames[field]||field} · updated ${account.updated_at||'unknown'}`;
 const facts=r.evidence.map((x,i)=>({...x,id:`account-${x.kind}-${i}`,source:['activity','service'].includes(x.kind)?`Activity records ${id} · ${P.previousMonth(closed,3)}–${closed}`:source(x.kind),fresh:r.status!=='Review data'}));
 const serviceMap=new Map();for(const x of data.activity.filter(a=>a.customer_id===id)){if(!serviceMap.has(x.service))serviceMap.set(x.service,{});serviceMap.get(x.service)[x.month]=x.units;}
 for(const [service,months] of serviceMap){const history=[1,2,3].map(n=>months[P.previousMonth(closed,n)]);if(history.some(x=>x===undefined)||months[closed]===undefined)continue;const base=P.sum(history)/3,change=base>0?(months[closed]/base-1)*100:null;if(base>=config.minBaseline&&P.declines(months[closed],base,config.decline)&&!facts.some(f=>f.kind==='service'&&f.service===service))facts.push({id:`service-${service}`,kind:'service',label:`${service} activity fell`,detail:`${months[closed]} vs ${Math.round(base*10)/10} average ${config.unit.toLowerCase()} (${Math.round(change)}%) in ${closed}.`,source:`Activity records ${id} / ${service} · ${P.previousMonth(closed,3)}–${closed}`,fresh:r.status!=='Review data'});}
 const contexts=(Array.isArray(context)?context:[]).filter(x=>x&&P.dateValue(x.date)&&x.date<=data.asOf&&['customer report','observation','hypothesis'].includes(x.kind)&&typeof x.source==='string'&&x.source.trim()&&typeof x.text==='string'&&x.text.trim()),has=k=>facts.some(f=>f.kind===k),hypotheses=[],tasks=[];
 const add=(key,title,role,days,success,trigger,reason)=>tasks.push({id:key,title,owner:role,due:new Date(Date.parse(data.asOf)+days*86400000).toISOString().slice(0,10),success,trigger,reason,status:'Proposed'});
 if(r.lifecycle==='paused'){add('restart','Confirm the agreed restart date and conditions',r.owner||'CSM',3,'Customer confirms the restart milestone.','Agreed restart milestone passes without activity.','Paused lifecycle');}
 else if(r.lifecycle==='onboarding'){add('activate','Agree the first value milestone and remove activation blockers',r.owner||'CSM',2,'Customer completes the agreed first value event.','Activation deadline is missed.','Onboarding lifecycle');}
 else{
 if(r.missing.length)add('data','Resolve missing or stale source records before classifying risk',r.owner||'CSM',1,'Required dates and four completed service-month records are verified.','Source remains incomplete after one day.',r.missing.join('; '));
 if(has('critical'))add('critical','Assign a resolution owner and deadline to every critical issue','Support lead',0,'All critical issues resolved with customer confirmation.','Any committed resolution deadline is missed.','Unresolved critical issue');
 if(has('delivery')){hypotheses.push({text:'Delivery reliability may be reducing customer confidence.',evidence:facts.filter(f=>['delivery','activity','service'].includes(f.kind)).map(f=>f.id),question:'Which missed commitments affected your work, and what recovery would restore confidence?'});add('delivery','Review delivery misses and agree a dated recovery plan','Delivery lead',1,`On-time performance reaches ${config.sla}% or the customer-agreed target.`,`Delivery remains below the agreed target at the next review.`,'Delivery below target');}
 if(!r.missing.length&&(has('activity')||has('service')||has('silence'))){hypotheses.push({text:'Lower demand, seasonality, a planned pause or a supplier shift could explain reduced activity.',evidence:facts.filter(f=>['activity','service','silence'].includes(f.kind)).map(f=>f.id),question:'Has your total demand changed, or has the share of work placed with us changed?'});add('diagnose','Validate the activity decline and agree the next order or usage milestone',r.owner||'CSM',1,'Customer confirms the cause and a dated next activity milestone.','Customer confirms a supplier shift or misses the agreed milestone.','Activity decline or inactivity');}
 if(has('payment'))add('payment','Confirm invoice accuracy, disputes and a payment resolution date','Finance + CSM',2,'Dispute resolved and payment plan or receipt confirmed.','Payment agreement is missed.','Payment overdue');
 if(r.renewal!==null&&r.renewal<=30)add('renewal',r.renewal<0?'Verify renewal outcome and update the contract record':'Confirm renewal decision-makers, criteria and decision date',r.owner||'Account owner',1,r.renewal<0?'Renewal outcome is confirmed with the decision-maker and the contract record is updated.':'Decision-maker confirms renewal requirements and next meeting.',r.renewal<0?'Renewal outcome remains unverified at the next review.':'No access to decision-maker before the agreed decision date.',r.renewal<0?'Recorded renewal date has passed; outcome unknown':'Renewal within 30 days');
 if(!tasks.length)add('milestone','Confirm the next success outcome and relationship check-in',r.owner||'CSM',7,'Customer agrees the next measurable outcome.','Customer reports a new blocker.','No currently flagged signals');
 }
 const unverified=contexts.filter(x=>x.kind!=='observation');
 const confidence=r.missing.length?'Limited':contexts.length?'Structured data + user notes':'Structured data only';
 return {account:r,facts,hypotheses,tasks,context:contexts,confidence,unknowns:[...r.missing,'Customer intent and root cause are not established by activity alone.',...(!contexts.length?['No meeting notes or customer feedback supplied.']:[]),...(unverified.length?['Reported explanations require validation; notes do not change the numeric risk score.']:[])],baseline:{snapshot:data.asOf,closed,latest:r.latest,baseline:r.baseline,score:r.score,on_time_pct:r.on_time_pct,critical_issues:r.critical_issues,overdue_days:r.overdue_days}};
}
function review(plan,brief){
 const b=plan.baseline,r=brief.account;
 if(brief.baseline.snapshot<=b.snapshot)return {status:'Awaiting newer data',text:'Import a later snapshot before measuring recovery. Completing tasks alone does not establish account recovery.'};
 if(r.lifecycle!=='active')return {status:'Lifecycle changed',text:'Review the lifecycle and agree the next milestone; no recovery conclusion is inferred.'};
 if(r.missing.length)return {status:'Data check required',text:'Resolve missing or stale signals before comparing recovery.'};
 const newerMonth=brief.baseline.closed>b.closed,checks=[];
 if(b.latest!==null&&r.latest!==null&&newerMonth)checks.push(`Completed-month activity: ${b.latest} → ${r.latest}.`);
 if(b.on_time_pct!==null&&r.on_time_pct!==null)checks.push(`On-time delivery: ${b.on_time_pct}% → ${r.on_time_pct}%.`);
 if(b.critical_issues!==null&&r.critical_issues!==null)checks.push(`Critical issues: ${b.critical_issues} → ${r.critical_issues}.`);
 if(b.overdue_days!==null&&r.overdue_days!==null)checks.push(`Overdue invoice days: ${b.overdue_days} → ${r.overdue_days}.`);
 return {status:'Review the evidence',text:(checks.join(' ')||'No comparable outcome metrics available.')+(!newerMonth?' A newer completed month is not available yet.':'')+' Confirm agreed targets with the customer before marking recovery.'};
}
const api={investigate,review};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PulseInvestigator=api;
})(typeof window!=='undefined'?window:globalThis);
