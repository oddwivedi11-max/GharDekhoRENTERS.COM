(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
let observer=null;
let insightCache=null,insightCacheAt=0,insightLoading=null,insightOwnerId=null,insightMode="analytics",insightRange="monthly";
const moduleMeta={
 properties:{eyebrow:"GDR PROPERTIES",title:"My Properties",subtitle:"Manage your listings, availability and property details."},
 visits:{eyebrow:"GDR VISITS",title:"Visit Requests",subtitle:"Review enquiries and manage property visits."},
 analytics:{eyebrow:"GDR ANALYTICS",title:"Owner Analytics",subtitle:"Verified property, tenancy, payment and enquiry figures from your account."},
 notifications:{eyebrow:"GDR NOTIFICATIONS",title:"Notifications",subtitle:"Account-specific updates derived from your latest property, visit and payment records."}
};
const insightClient=()=>window.__gdrSupabaseClient||window.supabaseClient||null;
const INSIGHT_PAGE_SIZE=500,INSIGHT_MAX_ROWS=10000;
async function readAllInsightRows(queryFactory,label){
 const rows=[];
 for(let offset=0;offset<=INSIGHT_MAX_ROWS;offset+=INSIGHT_PAGE_SIZE){
  const result=await queryFactory().range(offset,offset+INSIGHT_PAGE_SIZE-1);
  if(result.error)throw new Error(result.error.message||("Could not load "+label+"."));
  const page=Array.isArray(result.data)?result.data:[];
  rows.push(...page);
  if(rows.length>INSIGHT_MAX_ROWS)throw new Error(label+" exceeds 10,000 records. Narrow the data range or contact support.");
  if(page.length<INSIGHT_PAGE_SIZE)return rows;
 }
 throw new Error(label+" exceeds the supported 10,000-record analytics window.");
}
async function loadInsightRows(queryFactory,label){
 try{return {data:await readAllInsightRows(queryFactory,label),error:null};}
 catch(error){return {data:null,error:{message:error.message||String(error)}};}
}
const insightEsc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const insightMoney=value=>"₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:0});
const insightDate=value=>{const d=value?new Date(value):null;return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"Date unavailable";};
function notificationStore(){
 const key="gdr_owner_notice_state_v1:"+String(insightOwnerId||"unknown");
 try{const value=JSON.parse(localStorage.getItem(key)||"{}");return {read:Array.isArray(value.read)?value.read:[],dismissed:Array.isArray(value.dismissed)?value.dismissed:[]};}
 catch(e){return {read:[],dismissed:[]};}
}
function saveNotificationStore(store){
 if(!insightOwnerId)return;
 try{localStorage.setItem("gdr_owner_notice_state_v1:"+String(insightOwnerId),JSON.stringify({read:(store.read||[]).slice(-150),dismissed:(store.dismissed||[]).slice(-150)}));}
 catch(e){console.warn("Could not save owner notification preferences",e);}
}
function unreadNotificationCount(){
 if(!insightCache||!insightCache.notifications)return 0;
 const store=notificationStore();
 return insightCache.notifications.filter(n=>!store.dismissed.includes(n.id)&&!store.read.includes(n.id)).length;
}
function nextDueDate(day,now){
 const dueDay=Math.max(1,Math.min(28,Number(day)||5));
 let result=new Date(now.getFullYear(),now.getMonth(),dueDay,12,0,0,0);
 if(result<new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0))result=new Date(now.getFullYear(),now.getMonth()+1,dueDay,12,0,0,0);
 return result;
}
async function fetchOwnerInsights(force){
 if(insightLoading)return insightLoading;
 insightLoading=(async()=>{
  const client=insightClient();
  if(!client)throw new Error("Secure database connection is unavailable. Refresh and sign in again.");
  const auth=await client.auth.getUser();
  if(auth.error||!auth.data?.user)throw new Error("Please sign in again to access Owner Analytics.");
  const ownerResult=await client.from("owners").select("id").eq("user_id",auth.data.user.id).maybeSingle();
  if(ownerResult.error||!ownerResult.data)throw new Error("Owner profile could not be found for this account.");
  insightOwnerId=ownerResult.data.id;
  if(!force&&insightCache&&Date.now()-insightCacheAt<60000)return insightCache;
  const results=await Promise.all([
   loadInsightRows(()=>client.from("properties").select("id,title,name,rent,status,verification_status,created_at,deleted_at").eq("owner_id",insightOwnerId).is("deleted_at",null).order("created_at",{ascending:false}).order("id",{ascending:false}),"properties"),
   loadInsightRows(()=>client.from("property_occupancies").select("id,property_id,renter_name,occupied_at,released_at,expected_move_out_at").eq("owner_id",insightOwnerId).order("occupied_at",{ascending:false}).order("id",{ascending:false}),"occupancies"),
   loadInsightRows(()=>client.from("visit_requests").select("id,property_id,name,visit_date,visit_time,status,created_at").eq("owner_id",insightOwnerId).order("created_at",{ascending:false}).order("id",{ascending:false}),"visits"),
   loadInsightRows(()=>client.from("rent_payment_records").select("id,occupancy_id,property_id,billing_period,total_amount,status,created_at,verified_at,payment_date").eq("owner_id",insightOwnerId).order("created_at",{ascending:false}).order("id",{ascending:false}),"payments"),
   loadInsightRows(()=>client.from("owner_payment_settings").select("property_id,due_day,late_fee_amount,late_fee_grace_days").eq("owner_id",insightOwnerId).order("property_id",{ascending:true}),"payment settings"),
   loadInsightRows(()=>client.from("occupancy_charges").select("id,occupancy_id,amount,frequency,is_active,created_at").eq("owner_id",insightOwnerId).eq("is_active",true).order("created_at",{ascending:false}).order("id",{ascending:false}),"charges")
  ]);
  const names=["properties","occupancies","visits","payments","payment settings","charges"];
  const errors=results.map((result,index)=>result.error?names[index]+": "+result.error.message:null).filter(Boolean);
  const data={
   properties:results[0].data||[],
   occupancies:results[1].data||[],
   visits:results[2].data||[],
   payments:results[3].data||[],
   settings:results[4].data||[],
   charges:results[5].data||[],
   errors:[]
  };
  data.notifications=buildOwnerNotifications(data);
  data.errors=errors;
  insightCache=data;insightCacheAt=Date.now();
  return data;
 })().finally(()=>{insightLoading=null;});
 return insightLoading;
}
function buildOwnerNotifications(data){
 const now=new Date(),recentCutoff=now.getTime()-30*86400000,items=[];
 const push=(id,type,title,detail,when,route)=>items.push({id,type,title,detail,when:when||null,route:route||"visits"});
 const renterForPayment=payment=>data.occupancies.find(row=>row.id===payment.occupancy_id)?.renter_name||"Renter";
 data.visits.filter(v=>v.status==="pending"&&new Date(v.created_at||0).getTime()>=recentCutoff).forEach(v=>push("visit:"+v.id,"visit","New visit request",[(v.name||"A renter")+" requested a property visit",v.visit_date?insightDate(v.visit_date):""].filter(Boolean).join(" · "),v.created_at,"visits"));
 data.payments.filter(p=>p.status==="pending_verification").forEach(p=>push("payment:"+p.id,"payment","Payment awaiting verification",[renterForPayment(p),insightMoney(p.total_amount)].join(" · "),p.created_at,"payments"));
 data.properties.filter(p=>p.status==="pending"||p.verification_status==="pending").forEach(p=>push("property:"+p.id,"property","Property verification pending",p.title||p.name||"Your property listing",p.created_at,"properties"));
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),moveoutHorizon=new Date(today.getTime()+14*86400000);
 data.occupancies.filter(o=>!o.released_at&&o.expected_move_out_at).forEach(o=>{
  const due=new Date(o.expected_move_out_at+"T12:00:00");
  if(due>=today&&due<=moveoutHorizon)push("moveout:"+o.id,"renter","Upcoming renter move-out",(o.renter_name||"Renter")+" · "+insightDate(o.expected_move_out_at),o.expected_move_out_at,"renters");
 });
 const settingsByProperty=new Map(data.settings.map(setting=>[setting.property_id,setting]));
 const currentPeriod=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
 data.occupancies.filter(o=>!o.released_at).forEach(o=>{
  const setting=settingsByProperty.get(o.property_id);if(!setting||!setting.due_day)return;
  const due=nextDueDate(setting.due_day,now),days=Math.ceil((due.getTime()-today.getTime())/86400000);
  const paidThisPeriod=data.payments.some(payment=>payment.occupancy_id===o.id&&payment.status==="paid"&&String(payment.billing_period||payment.payment_date||"").slice(0,7)===currentPeriod);
  if(!paidThisPeriod&&days>=0&&days<=7)push("rentdue:"+o.id+":"+due.toISOString().slice(0,10),"rent","Rent due date approaching",(o.renter_name||"Renter")+" · due "+insightDate(due.toISOString()),due.toISOString(),"payments");
 });
 return items.sort((a,b)=>new Date(b.when||0)-new Date(a.when||0)).slice(0,100);
}

function analyticsMarkup(data){
 const properties=Array.isArray(data.properties)?data.properties:[];
 const occupancies=Array.isArray(data.occupancies)?data.occupancies:[];
 const payments=Array.isArray(data.payments)?data.payments:[];
 const visits=Array.isArray(data.visits)?data.visits:[];
 const active=occupancies.filter(o=>!o.released_at);
 const byProperty=new Map(properties.map(p=>[String(p.id),p]));
 const occupancyById=new Map(occupancies.map(o=>[String(o.id),o]));
 const activeByProperty=new Map();
 active.forEach(o=>{const key=String(o.property_id);if(!activeByProperty.has(key))activeByProperty.set(key,o);});
 const verifiedAvailable=properties.filter(p=>p.status==="verified"&&p.verification_status==="verified"&&!activeByProperty.has(String(p.id))).length;
 const soonAvailable=properties.filter(p=>p.status==="soon_available").length;
 const occupied=properties.filter(p=>p.status==="occupied").length;
 const pendingProperties=properties.filter(p=>p.verification_status==="pending"||p.status==="pending").length;
 const activeOccupancyIds=new Set(active.map(o=>String(o.id)));
 const monthlyBaseRent=active.reduce((sum,o)=>sum+Number(byProperty.get(String(o.property_id))?.rent||0),0);
 const chargesUnavailable=(data.errors||[]).some(error=>String(error).startsWith("charges:"));
 const monthlyCharges=chargesUnavailable?0:(data.charges||[]).filter(charge=>charge.is_active!==false&&charge.frequency==="monthly"&&activeOccupancyIds.has(String(charge.occupancy_id))).reduce((sum,charge)=>sum+Number(charge.amount||0),0);
 const monthlyExpected=monthlyBaseRent+monthlyCharges;
 const now=new Date(),month=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
 const paidRows=payments.filter(p=>String(p.status||"").toLowerCase()==="paid");
 const paidThisMonth=paidRows.filter(p=>String(p.payment_date||p.verified_at||p.created_at||"").slice(0,7)===month);
 const received=paidThisMonth.reduce((sum,p)=>sum+Number(p.total_amount||0),0);
 const awaiting=payments.filter(p=>String(p.status||"").toLowerCase()==="pending_verification");
 const pendingAmount=awaiting.reduce((sum,p)=>sum+Number(p.total_amount||0),0);
 const newVisits=visits.filter(v=>String(v.status||"").toLowerCase()==="pending");
 const cards=[
  ["Total properties",properties.length,"All active listings"],
  ["Available now",verifiedAvailable,"Verified and vacant"],
  ["Occupied",occupied,"Currently occupied listings"],
  ["Soon available",soonAvailable,"Move-out workflow status"],
  ["Active renters",active.length,"Open occupancy records"],
  ["Expected monthly rent",insightMoney(monthlyExpected),chargesUnavailable?"Base rent only; recurring charges unavailable":"Base rent + active recurring charges"],
  ["Received this month",insightMoney(received),paidThisMonth.length+" verified payment records"],
  ["Awaiting verification",insightMoney(pendingAmount),awaiting.length+" renter submissions"]
 ];
 const range=["monthly","quarterly","yearly"].includes(insightRange)?insightRange:"monthly";
 const periodCount=range==="yearly"?5:(range==="quarterly"?4:6);
 const periodKey=date=>{
  const year=date.getFullYear();
  if(range==="yearly")return String(year);
  if(range==="quarterly")return year+"-Q"+(Math.floor(date.getMonth()/3)+1);
  return year+"-"+String(date.getMonth()+1).padStart(2,"0");
 };
 const periodLabel=date=>{
  const year=String(date.getFullYear()).slice(-2);
  if(range==="yearly")return String(date.getFullYear());
  if(range==="quarterly")return "Q"+(Math.floor(date.getMonth()/3)+1)+" '"+year;
  return new Intl.DateTimeFormat("en-IN",{month:"short"}).format(date)+" '"+year;
 };
 const periods=Array.from({length:periodCount},(_,index)=>{
  let date;
  if(range==="yearly")date=new Date(now.getFullYear()-(periodCount-1-index),0,1);
  else if(range==="quarterly")date=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3-(periodCount-1-index)*3,1);
  else date=new Date(now.getFullYear(),now.getMonth()-(periodCount-1-index),1);
  return {key:periodKey(date),label:periodLabel(date),date,value:0};
 });
 const periodMap=new Map(periods.map(period=>[period.key,period]));
 paidRows.forEach(payment=>{
  const raw=payment.payment_date||payment.verified_at||payment.created_at;
  const date=raw?new Date(raw):null,amount=Number(payment.total_amount||0);
  if(!date||!Number.isFinite(date.getTime())||!Number.isFinite(amount)||amount<0)return;
  const bucket=periodMap.get(periodKey(date));
  if(bucket)bucket.value+=amount;
 });
 const revenueTotal=periods.reduce((sum,period)=>sum+period.value,0);
 const paymentsUnavailable=(data.errors||[]).some(error=>String(error).startsWith("payments:"));
 const maxRevenue=Math.max(1,...periods.map(period=>period.value));
 const points=periods.map((period,index)=>{
  const x=36+(index*(568/Math.max(1,periods.length-1)));
  const y=162-(period.value/maxRevenue)*126;
  return {x,y,period};
 });
 const pointString=points.map(point=>point.x.toFixed(1)+","+point.y.toFixed(1)).join(" ");
 const grid=[36,78,120,162].map(y=>'<line x1="28" x2="612" y1="'+y+'" y2="'+y+'" stroke="#e8f0eb" stroke-width="1"/>').join("");
 const dots=points.map(point=>'<circle cx="'+point.x.toFixed(1)+'" cy="'+point.y.toFixed(1)+'" r="5" fill="#a6cb72" stroke="#1c684d" stroke-width="2"><title>'+insightEsc(point.period.label)+': '+insightEsc(insightMoney(point.period.value))+'</title></circle>').join("");
 const chartLabel=range==="yearly"?"year":(range==="quarterly"?"quarter":"month");
 const revenueChart=paymentsUnavailable
  ? '<div class="gdr-insight-empty">Verified payment history is unavailable for this account right now.</div>'
  : (revenueTotal>0
    ? '<svg class="gdr-insight-revenue-plot" viewBox="0 0 640 190" role="img" aria-label="Verified rent received by '+chartLabel+'"><g>'+grid+'</g><polyline points="'+pointString+'" fill="none" stroke="#276e55" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+dots+'</svg><div class="gdr-insight-revenue-labels">'+periods.map(period=>'<span>'+insightEsc(period.label)+'</span>').join("")+'</div>'
    : '<div class="gdr-insight-empty">No verified payment records are available for this period yet.</div>');
 const statusRows=[
  {label:"Occupied",value:occupied,color:"#236a50"},
  {label:"Available",value:verifiedAvailable,color:"#a7c97d"},
  {label:"Soon available",value:soonAvailable,color:"#e2b56b"},
  {label:"Pending review",value:pendingProperties,color:"#9baeb0"}
 ];
 const knownStatusCount=statusRows.reduce((sum,row)=>sum+row.value,0);
 const otherStatusCount=Math.max(0,properties.length-knownStatusCount);
 if(otherStatusCount)statusRows.push({label:"Other / unclassified",value:otherStatusCount,color:"#d8e1dc"});
 const statusTotal=statusRows.reduce((sum,row)=>sum+row.value,0);
 let stopAt=0;
 const stops=statusRows.map(row=>{
  const from=stopAt;
  stopAt+=statusTotal?(row.value/statusTotal)*100:0;
  return row.color+" "+from.toFixed(2)+"% "+stopAt.toFixed(2)+"%";
 }).join(",");
 const donutStyle=statusTotal?"conic-gradient("+stops+")":"#edf3ef";
 const donutMarkup=properties.length&&statusTotal
  ? '<div class="gdr-insight-donut-layout"><div class="gdr-insight-donut" style="background:'+donutStyle+'"><span><b>'+insightEsc(statusTotal)+'</b><small>classified</small></span></div><ul class="gdr-insight-legend">'+statusRows.map(row=>'<li><i style="background:'+row.color+'"></i><span>'+insightEsc(row.label)+'</span><b>'+row.value+'</b></li>').join("")+'</ul></div>'
  : '<div class="gdr-insight-empty">Property status data will appear after listings are added.</div>';
 const periodKeys=new Set(periods.map(period=>period.key));
 const paidByProperty=new Map();
 paidRows.forEach(payment=>{
  const raw=payment.payment_date||payment.verified_at||payment.created_at;
  const date=raw?new Date(raw):null;
  if(!date||!Number.isFinite(date.getTime())||!periodKeys.has(periodKey(date)))return;
  const occupancy=occupancyById.get(String(payment.occupancy_id));
  const key=String(payment.property_id||occupancy?.property_id||"");
  if(!key)return;
  paidByProperty.set(key,(paidByProperty.get(key)||0)+Number(payment.total_amount||0));
 });
 const propertyRows=properties.slice(0,8).map(property=>{
  const key=String(property.id),occupancy=activeByProperty.get(key);
  const status=property.status||property.verification_status||"Not specified";
  return '<div class="gdr-insight-property-row"><span><b>'+insightEsc(property.title||property.name||"Rental property")+'</b><small>'+insightEsc(status)+(occupancy&&occupancy.renter_name?" · "+insightEsc(occupancy.renter_name):" · No active renter")+'</small></span><span><b>'+insightMoney(property.rent)+'</b><small>Listed monthly rent</small></span><strong>'+insightMoney(paidByProperty.get(key)||0)+'<small>Received in selected period</small></strong></div>';
 }).join("");
 const rentalScale=Math.max(1,monthlyExpected,received,pendingAmount);
 const rentalBars=[
  ["Expected monthly rent",monthlyExpected],
  ["Received this month",received],
  ["Awaiting verification",pendingAmount]
 ].map(row=>'<div class="gdr-insight-bar-row"><span>'+row[0]+'</span><strong>'+insightMoney(row[1])+'</strong><i><em style="width:'+Math.min(100,Math.round(row[1]/rentalScale*100))+'%"></em></i></div>').join("");
 const activeRenterRows=active.slice(0,5).map(occupancy=>{
  const property=byProperty.get(String(occupancy.property_id));
  const moveOut=occupancy.expected_move_out_at?new Date(occupancy.expected_move_out_at):null;
  const moveOutLabel=moveOut&&Number.isFinite(moveOut.getTime())?" · expected out "+moveOut.toLocaleDateString("en-IN",{day:"numeric",month:"short"}):"";
  return '<div><span><b>'+insightEsc(occupancy.renter_name||"Active renter")+'</b><small>Active tenancy'+insightEsc(moveOutLabel)+'</small></span><strong>'+insightEsc(property?.title||property?.name||"Property")+'</strong></div>';
 }).join("");
 const visitRows=visits.slice(0,5).map(visit=>{
  const raw=visit.visit_date||visit.created_at,parsed=raw?new Date(raw):null;
  const when=parsed&&Number.isFinite(parsed.getTime())?parsed.toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"}):"Date not provided";
  const property=byProperty.get(String(visit.property_id));
  return '<div><span><b>'+insightEsc(visit.name||"Renter enquiry")+'</b><small>'+insightEsc(visit.status||"Status unavailable")+' · '+insightEsc(when)+'</small></span><strong>'+insightEsc(property?.title||property?.name||"Property enquiry")+'</strong></div>';
 }).join("");
 const rangeButtons=[["monthly","Monthly"],["quarterly","Quarterly"],["yearly","Yearly"]].map(row=>'<button type="button" data-insight-range="'+row[0]+'" aria-pressed="'+String(range===row[0])+'">'+row[1]+'</button>').join("");
 return '<div class="gdr-insight-kpi-grid">'+cards.map(card=>'<article class="gdr-insight-kpi"><span>'+insightEsc(card[0])+'</span><strong>'+insightEsc(card[1])+'</strong><small>'+insightEsc(card[2])+'</small></article>').join("")+'</div>'+
 '<div class="gdr-insight-two-col"><section class="gdr-insight-card"><div class="gdr-insight-card-head"><div><span>PORTFOLIO</span><h3>Property occupancy</h3></div><b>'+properties.length+'</b></div>'+donutMarkup+'</section>'+
 '<section class="gdr-insight-card"><div class="gdr-insight-card-head gdr-insight-revenue-head"><div><span>VERIFIED COLLECTIONS</span><h3>Revenue trend</h3></div><div class="gdr-insight-range-switch" role="group" aria-label="Revenue date range">'+rangeButtons+'</div></div><p class="gdr-insight-chart-summary">'+(paymentsUnavailable?"Payment history unavailable":insightMoney(revenueTotal)+" verified in selected period")+'</p>'+revenueChart+'</section></div>'+
 '<div class="gdr-insight-two-col"><section class="gdr-insight-card"><div class="gdr-insight-card-head"><div><span>RENTAL PERFORMANCE</span><h3>Expected and received</h3></div><b>₹</b></div>'+rentalBars+'</section>'+
 '<section class="gdr-insight-card"><div class="gdr-insight-card-head"><div><span>RENTERS & ENQUIRIES</span><h3>Account activity</h3></div><b>'+active.length+'</b></div><div class="gdr-insight-mini-list">'+(activeRenterRows||'<div class="gdr-insight-empty">No active renter records yet.</div>')+'</div><div class="gdr-insight-card-divider"></div><div class="gdr-insight-card-head"><div><span>VISIT REQUESTS</span><h3>Latest enquiries</h3></div><b>'+newVisits.length+'</b></div>'+(visitRows?'<div class="gdr-insight-mini-list">'+visitRows+'</div>':'<p class="gdr-insight-empty">No visit requests have been recorded yet.</p>')+'</section></div>'+
 '<section class="gdr-insight-card gdr-insight-full-card"><div class="gdr-insight-card-head"><div><span>LISTING BREAKDOWN</span><h3>Property-wise performance</h3></div><button type="button" data-insight-route="properties">Manage properties</button></div>'+(propertyRows?'<div class="gdr-insight-property-list">'+propertyRows+'</div>':'<p class="gdr-insight-empty">No property records are available yet.</p>')+'</section>'+
 ((data.errors||[]).length?'<p class="gdr-insight-partial">Some account data could not be loaded: '+insightEsc(data.errors.join(" · "))+'</p>':"");
}

function notificationsMarkup(data){
 const store=notificationStore(),visible=data.notifications.filter(n=>!store.dismissed.includes(n.id)),unread=visible.filter(n=>!store.read.includes(n.id));
 return '<div class="gdr-insight-notification-toolbar"><div><strong>'+unread.length+' unread</strong><span>Updates are derived from existing owner records. Read/dismiss choices stay on this signed-in browser.</span></div><button type="button" data-insight-action="read-all" '+(unread.length?"":"disabled")+'>Mark all read</button></div>'+
 (visible.length?'<div class="gdr-insight-notification-list">'+visible.map(n=>{const read=store.read.includes(n.id);return '<article class="gdr-insight-notification '+(read?"is-read":"is-unread")+'"><span class="gdr-insight-notification-icon">'+({visit:"▣",payment:"₹",property:"⌂",renter:"♙",rent:"◷"}[n.type]||"•")+'</span><div class="gdr-insight-notification-copy"><b>'+insightEsc(n.title)+'</b><p>'+insightEsc(n.detail)+'</p><small>'+insightEsc(insightDate(n.when))+'</small></div><div class="gdr-insight-notification-actions">'+(!read?'<button type="button" data-insight-read="'+insightEsc(n.id)+'">Mark read</button>':'<span>Read</span>')+'<button type="button" data-insight-dismiss="'+insightEsc(n.id)+'" aria-label="Dismiss notification">Dismiss</button><button type="button" data-insight-route="'+insightEsc(n.route)+'">Open</button></div></article>';}).join("")+'</div>':'<div class="gdr-insight-empty"><strong>You\'re all caught up.</strong><p>New visit requests, payment submissions, property verification updates and upcoming renter dates will appear here when present in your records.</p></div>')+
 (data.errors.length?'<p class="gdr-insight-partial">Some account data could not be loaded: '+insightEsc(data.errors.join(" · "))+'</p>':'');
}
function ensureInsightsPanel(dash){
 let panel=$("#gdrOwnerInsightsPanel",dash);
 if(!panel){panel=document.createElement("section");panel.id="gdrOwnerInsightsPanel";panel.hidden=true;panel.innerHTML='<div class="gdr-insight-panel-toolbar"><span id="gdrInsightFreshness">Live account data</span><button type="button" data-insight-action="refresh">↻ Refresh</button></div><div id="gdrOwnerInsightsContent"><p class="gdr-insight-loading">Loading owner data…</p></div>';const header=$("#gdrOwnerModuleHeader",dash);if(header)header.insertAdjacentElement("afterend",panel);else dash.appendChild(panel);}
 if(panel.dataset.gdrBound!=="1"){panel.dataset.gdrBound="1";panel.addEventListener("click",async event=>{
  const rangeButton=event.target.closest("[data-insight-range]");
  if(rangeButton){
   const nextRange=rangeButton.dataset.insightRange;
   if(["monthly","quarterly","yearly"].includes(nextRange)&&nextRange!==insightRange){insightRange=nextRange;renderInsightsPanel();}
   return;
  }
  const action=event.target.closest("[data-insight-action]"),read=event.target.closest("[data-insight-read]"),dismiss=event.target.closest("[data-insight-dismiss]"),route=event.target.closest("[data-insight-route]");
  if(action){const kind=action.dataset.insightAction;if(kind==="refresh"){await loadInsights(insightMode,true);}else if(kind==="read-all"){const store=notificationStore();store.read=(insightCache?.notifications||[]).map(n=>n.id);saveNotificationStore(store);renderInsightsPanel();}return;}
  if(read){const store=notificationStore();if(!store.read.includes(read.dataset.insightRead))store.read.push(read.dataset.insightRead);saveNotificationStore(store);renderInsightsPanel();return;}
  if(dismiss){const store=notificationStore();if(!store.dismissed.includes(dismiss.dataset.insightDismiss))store.dismissed.push(dismiss.dataset.insightDismiss);saveNotificationStore(store);renderInsightsPanel();return;}
  if(route){const mode=route.dataset.insightRoute;if(mode==="payments"||mode==="renters")openExternal($("#ownerDashboard"),mode);else setMode($("#ownerDashboard"),mode==="properties"?"properties":"visits");}
 });}
 return panel;
}
function renderInsightsPanel(){
 const dash=$("#ownerDashboard");if(!dash)return;
 const panel=ensureInsightsPanel(dash),content=$("#gdrOwnerInsightsContent",panel);
 if(!content)return;
 if(!insightCache){content.innerHTML='<p class="gdr-insight-loading">Loading verified account records…</p>';return;}
 content.innerHTML=insightMode==="notifications"?notificationsMarkup(insightCache):analyticsMarkup(insightCache);
 const badge=$('[data-gdr-count="notifications"]',dash);if(badge)badge.textContent=String(unreadNotificationCount());
 const freshness=$("#gdrInsightFreshness",panel);if(freshness)freshness.textContent="Updated "+new Date(insightCacheAt).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
}
async function loadInsights(mode,force){
 insightMode=mode||insightMode;renderInsightsPanel();
 try{await fetchOwnerInsights(!!force);renderInsightsPanel();}
 catch(error){const content=$("#gdrOwnerInsightsContent");if(content)content.innerHTML='<div class="gdr-insight-empty"><strong>Owner data could not be loaded</strong><p>'+insightEsc(error.message||"Please refresh and try again.")+'</p><button type="button" data-insight-action="refresh">Try again</button></div>';console.warn("Owner analytics/notifications unavailable",error);}
}
function refreshNotificationBadge(){
 const dash=$("#ownerDashboard");if(!dash)return;
 const badge=$('[data-gdr-count="notifications"]',dash),count=String(unreadNotificationCount());
 // This controller observes dashboard mutations. Guard identical writes to avoid
 // retriggering its MutationObserver indefinitely.
 if(badge&&badge.textContent!==count)badge.textContent=count;
}

function countText(id){const n=document.getElementById(id);return n?(n.textContent||"0").trim():"0";}
function renterCount(){return String($("#ownerOccupancyContainer .gd-current-renter-card-v2,#ownerOccupancyContainer .gd-current-renter-card").length);}
function ensureOwnerDashboardStatActions(dash){
 const stats=dash&&dash.querySelector(".dashboard-stats-grid.owner-stats-grid");
 if(!stats)return;
 const definitions=[
  ["ownerPropertyCount","properties","Open all of your properties"],
  ["ownerAvailableCount","available","Show available properties"],
  ["ownerOccupiedCount","occupied","Show occupied properties"],
  ["ownerPendingVisitCount","pending-visits","Show pending visit requests"]
 ];
 definitions.forEach(([counterId,action,label])=>{
  const counter=document.getElementById(counterId);
  const card=counter&&counter.closest(".dashboard-stat-card");
  if(!card||!stats.contains(card))return;
  card.dataset.gdrOwnerStatAction=action;
  card.setAttribute("role","button");
  card.setAttribute("tabindex","0");
  card.setAttribute("aria-label",label);
  card.setAttribute("aria-controls",action==="pending-visits"?"ownerVisitsContainer":"ownerPropertiesContainer");
 });
}
function ensureHome(dash){
 ensureOwnerDashboardStatActions(dash);
 let home=$("#gdrOwnerCommandCenterHome",dash);
 if(!home){
  home=document.createElement("section");home.id="gdrOwnerCommandCenterHome";home.setAttribute("aria-label","Owner dashboard shortcuts");
  home.innerHTML='<div class="gdr-occ-intro"><div><span class="gdr-occ-eyebrow">OWNER CONTROL CENTRE</span><h2>Your property workspace</h2><p>Choose what you want to manage. Each section opens separately.</p></div><span class="gdr-occ-live"><i></i> Your workspace</span></div><div class="gdr-occ-grid">'+
  '<button type="button" class="gdr-occ-card gdr-occ-pink" data-gdr-module="properties"><span class="gdr-occ-icon" aria-hidden="true">⌂</span><span class="gdr-occ-copy"><b>My Properties</b><small>Manage listings and availability</small><em><strong data-gdr-count="properties">0</strong> listed properties</em></span><span class="gdr-occ-arrow" aria-hidden="true">↗</span></button>'+
  '<button type="button" class="gdr-occ-card gdr-occ-rose" data-gdr-module="renters"><span class="gdr-occ-icon" aria-hidden="true">♙</span><span class="gdr-occ-copy"><b>Current Renters</b><small>Manage active tenants and tenancy</small><em><strong data-gdr-count="renters">0</strong> active renters</em></span><span class="gdr-occ-arrow" aria-hidden="true">↗</span></button>'+
  '<button type="button" class="gdr-occ-card gdr-occ-blue" data-gdr-module="payments"><span class="gdr-occ-icon" aria-hidden="true">₹</span><span class="gdr-occ-copy"><b>My Payments</b><small>Rent collection and UPI records</small><em>Payment management</em></span><span class="gdr-occ-arrow" aria-hidden="true">↗</span></button>'+
  '<button type="button" class="gdr-occ-card gdr-occ-orange" data-gdr-module="visits"><span class="gdr-occ-icon" aria-hidden="true">▣</span><span class="gdr-occ-copy"><b>Visit Requests</b><small>Review and respond to enquiries</small><em><strong data-gdr-count="visits">0</strong> pending requests</em></span><span class="gdr-occ-arrow" aria-hidden="true">↗</span></button>'+
  '<button type="button" class="gdr-occ-card gdr-occ-teal" data-gdr-module="analytics"><span class="gdr-occ-icon" aria-hidden="true">▤</span><span class="gdr-occ-copy"><b>Owner Analytics</b><small>Portfolio, occupancy and income</small><em>Live account statistics</em></span><span class="gdr-occ-arrow" aria-hidden="true">↗</span></button>'+
  '<button type="button" class="gdr-occ-card gdr-occ-teal gdr-occ-notifications" data-gdr-module="notifications"><span class="gdr-occ-icon" aria-hidden="true">♢</span><span class="gdr-occ-copy"><b>Notifications</b><small>Enquiries, payments and due dates</small><em><strong data-gdr-count="notifications">0</strong> unread updates</em></span><span class="gdr-occ-arrow" aria-hidden="true">↗</span></button>'+
  '</div>';
  const stats=$(".dashboard-stats-grid",dash);
  if(stats)stats.insertAdjacentElement("afterend",home);else dash.prepend(home);
 }
 let header=$("#gdrOwnerModuleHeader",dash);
 if(!header){
  header=document.createElement("section");header.id="gdrOwnerModuleHeader";
  header.innerHTML='<div class="gdr-occ-module-copy"><span class="gdr-occ-eyebrow" id="gdrOccModuleEyebrow"></span><h2 id="gdrOccModuleTitle"></h2><p id="gdrOccModuleSubtitle"></p></div><button type="button" class="gdr-occ-back" data-gdr-owner-home>← Back to Dashboard</button>';
  home.insertAdjacentElement("afterend",header);
 }
 ensureInsightsPanel(dash);
 const back=$("[data-gdr-owner-home]",header);
 if(back && back.dataset.gdrBackBound!=="1"){
  back.dataset.gdrBackBound="1";
  back.addEventListener("click",function(event){event.preventDefault();event.stopPropagation();setMode(dash,"home");});
 }
 return {home,header};
}
function setMode(dash,mode){
 if(mode==="home"||mode==="visits")dash.dataset.gdrOwnerVisitFilter="all";
 const {home,header}=ensureHome(dash);
 dash.classList.remove("gdr-owner-mode-home","gdr-owner-mode-properties","gdr-owner-mode-visits","gdr-owner-mode-analytics","gdr-owner-mode-notifications");
 dash.classList.add("gdr-owner-mode-"+mode);
 home.hidden=mode!=="home";header.hidden=mode==="home";
 const insightPanel=ensureInsightsPanel(dash);
 insightPanel.hidden=mode!=="analytics"&&mode!=="notifications";
 if(mode!=="home"&&moduleMeta[mode]){
  const m=moduleMeta[mode];
  $("#gdrOccModuleEyebrow",header).textContent=m.eyebrow;
  $("#gdrOccModuleTitle",header).textContent=m.title;
  $("#gdrOccModuleSubtitle",header).textContent=m.subtitle;
 }
 if(mode==="home"){
  updateCounts(dash);refreshNotificationBadge();
  requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"smooth"}));
 }else{
  requestAnimationFrame(()=>header.scrollIntoView({behavior:"smooth",block:"start"}));
  if(mode==="analytics"||mode==="notifications")loadInsights(mode,false);
 }
}
function setTextIfChanged(node,value){
 if(node && node.textContent!==value)node.textContent=value;
}
function ensureOwnerPropertyFilters(dash){
 const card=dash&&dash.querySelector(".owner-inventory-card");
 const heading=card&&card.querySelector(".premium-section-heading");
 if(!heading)return null;
 let root=heading.querySelector(".gdr-owner-property-filters");
 if(!root){
  root=document.createElement("div");root.className="gdr-owner-property-filters";
  root.setAttribute("role","group");root.setAttribute("aria-label","Filter my properties by availability");
  root.innerHTML='<button type="button" data-gdr-owner-property-filter="all" aria-pressed="true" class="is-active">My Properties <span data-filter-count="all">0</span></button><button type="button" data-gdr-owner-property-filter="available" aria-pressed="false">Available <span data-filter-count="available">0</span></button><button type="button" data-gdr-owner-property-filter="occupied" aria-pressed="false">Occupied <span data-filter-count="occupied">0</span></button>';
  heading.appendChild(root);
 }
 if(root.dataset.gdrBound!=="1"){
  root.dataset.gdrBound="1";
  root.addEventListener("click",event=>{
   const button=event.target&&event.target.closest?event.target.closest("[data-gdr-owner-property-filter]"):null;
   if(!button||!root.contains(button))return;
   event.preventDefault();
   dash.dataset.gdrOwnerPropertyFilter=button.dataset.gdrOwnerPropertyFilter||"all";
   refreshOwnerPropertyFilter(dash);
  });
 }
 return root;
}
function refreshOwnerPropertyFilter(dash){
 const root=ensureOwnerPropertyFilters(dash);
 if(!root)return;
 const container=dash.querySelector("#ownerPropertiesContainer");
 if(!container)return;
 const cards=Array.from(container.querySelectorAll(".owner-property-premium-card"));
 const statusOf=card=>card.querySelector(".owner-property-photo-badge");
 const counts={
  all:cards.length,
  available:cards.filter(card=>statusOf(card)?.classList.contains("available")).length,
  occupied:cards.filter(card=>statusOf(card)?.classList.contains("occupied")).length
 };
 const selected=["all","available","occupied"].includes(dash.dataset.gdrOwnerPropertyFilter)?dash.dataset.gdrOwnerPropertyFilter:"all";
 dash.dataset.gdrOwnerPropertyFilter=selected;
 root.querySelectorAll("[data-gdr-owner-property-filter]").forEach(button=>{
  const active=button.dataset.gdrOwnerPropertyFilter===selected;
  button.classList.toggle("is-active",active);
  button.setAttribute("aria-pressed",active?"true":"false");
  const count=button.querySelector("[data-filter-count]");
  setTextIfChanged(count,String(counts[button.dataset.gdrOwnerPropertyFilter]||0));
 });
 let visible=0;
 cards.forEach(card=>{
  const badge=statusOf(card);
  const match=selected==="all"||(selected==="available"&&badge?.classList.contains("available"))||(selected==="occupied"&&badge?.classList.contains("occupied"));
  card.hidden=!match;
  card.setAttribute("aria-hidden",match?"false":"true");
  if(match)visible++;
 });
 let empty=container.querySelector("[data-gdr-filter-empty]");
 if(!empty){empty=document.createElement("p");empty.className="dashboard-empty gdr-owner-filter-empty";empty.dataset.gdrFilterEmpty="1";empty.hidden=true;container.appendChild(empty);}
 empty.hidden=!(selected!=="all"&&visible===0);
 if(!empty.hidden)empty.textContent=selected==="available"?"No available properties right now.":"No occupied properties right now.";
}
function refreshOwnerVisitFilter(dash){
 const container=dash&&dash.querySelector("#ownerVisitsContainer");
 if(!container)return;
 const selected=dash.dataset.gdrOwnerVisitFilter==="pending"?"pending":"all";
 const cards=Array.from(container.querySelectorAll(".premium-visit-card"));
 let visible=0;
 cards.forEach(card=>{
  const status=card.querySelector(".premium-visit-status");
  const match=selected==="all"||status?.classList.contains("pending");
  card.hidden=!match;
  card.setAttribute("aria-hidden",match?"false":"true");
  if(match)visible++;
 });
 let empty=container.querySelector("[data-gdr-visit-filter-empty]");
 if(!empty){
  empty=document.createElement("p");
  empty.className="dashboard-empty gdr-owner-visit-filter-empty";
  empty.dataset.gdrVisitFilterEmpty="1";
  empty.setAttribute("role","status");
  empty.hidden=true;
  container.appendChild(empty);
 }
 const noRequests=Array.from(container.children).find(child=>child.tagName==="P"&&/no visit requests yet/i.test(child.textContent||""));
 const loadIssue=cards.length===0&&/unable to load|unable to verify|could not load|failed/i.test(container.textContent||"");
 const showEmpty=selected==="pending"&&visible===0&&!loadIssue;
 if(noRequests)noRequests.hidden=showEmpty;
 empty.hidden=!showEmpty;
 if(showEmpty)empty.textContent="No pending visit requests right now.";
}
function applyOwnerDashboardStatAction(dash,action){
 if(!dash)return;
 if(action==="properties"||action==="available"||action==="occupied"){
  dash.dataset.gdrOwnerPropertyFilter=action==="properties"?"all":action;
  setMode(dash,"properties");
  refreshOwnerPropertyFilter(dash);
  return;
 }
 if(action==="pending-visits"){
  setMode(dash,"visits");
  dash.dataset.gdrOwnerVisitFilter="pending";
  refreshOwnerVisitFilter(dash);
 }
}
function updateCounts(dash){
 const p=countText("ownerPropertyCount"),v=countText("ownerPendingVisitCount");
 const pc=$('[data-gdr-count="properties"]',dash),rc=$('[data-gdr-count="renters"]',dash),vc=$('[data-gdr-count="visits"]',dash);
 // Avoid replacing an identical text node: this module observes dashboard mutations,
 // so unconditional textContent writes can retrigger its own MutationObserver forever.
 setTextIfChanged(pc,p);
 setTextIfChanged(rc,renterCount());
 setTextIfChanged(vc,v);
 refreshOwnerPropertyFilter(dash);
 refreshOwnerVisitFilter(dash);
 refreshNotificationBadge();
}
function openExternal(dash,module){
 setMode(dash,"home");
 if(module==="renters"){
  if(window.GDROwnerCurrentRenters&&typeof window.GDROwnerCurrentRenters.open==="function")window.GDROwnerCurrentRenters.open();
  else {const b=$("#ownerCurrentRentersBtn");if(b)b.click();}
 }else if(module==="payments"){
  if(window.GDRPayments&&typeof window.GDRPayments.open==="function")window.GDRPayments.open();
  else {const b=$("#gdrPaymentsOpen");if(b)b.click();}
 }else if(module==="nearby"){
  const api=window.GDRMapExperience;
  if(api&&typeof api.openOwnerNearbyMap==="function"){
   try{Promise.resolve(api.openOwnerNearbyMap()).catch(error=>console.error("Owner nearby map failed to open:",error));}
   catch(error){console.error("Owner nearby map failed to open:",error);}
  }else{
   const b=$("#gdrOwnerNearbyOpen")||$("#ownerExploreNearbyBtn");
   if(b)b.click();else console.warn("Owner nearby map launcher is not available yet.");
  }
 }
}
function bindLogout(){
 const button=$("#dashboardLogoutBtn");
 if(!button||button.dataset.gdrLogoutBound==="1")return;
 if(typeof window.logoutUser!=="function" && typeof logoutUser==="function")window.logoutUser=logoutUser;
 button.dataset.gdrLogoutBound="1";
 button.removeAttribute("onclick");
 button.addEventListener("click",async function(event){
  event.preventDefault();event.stopPropagation();
  if(button.disabled)return;
  button.disabled=true;
  const label=button.querySelector("span:last-child");
  if(label)label.textContent="Logging out…";
  try{
   if(typeof window.logoutUser==="function")await window.logoutUser();
   else{
    const client=window.__gdrSupabaseClient||window.supabaseClient;
    if(!client?.auth?.signOut)throw new Error("Logout service is unavailable. Refresh and try again.");
    const result=await client.auth.signOut();
    if(result.error)throw result.error;
    window.location.assign("/login");
   }
  }catch(error){
   console.error("[GharDekho] dashboard logout failed",error);
   const status=$("#backendMessage");
   if(status){status.textContent=error.message||"Logout failed. Please try again.";status.className="backend-message error";}
  }finally{
   button.disabled=false;
   if(label)label.textContent="Log out";
  }
 });
}
function bind(dash){
 if(dash.dataset.gdrCommandBound==="1")return;
 dash.dataset.gdrCommandBound="1";
 dash.addEventListener("click",function(e){
  const stat=e.target&&e.target.closest?e.target.closest("[data-gdr-owner-stat-action]"):null;
  if(stat&&dash.contains(stat)&&stat.closest(".dashboard-stats-grid.owner-stats-grid")){
   e.preventDefault();
   applyOwnerDashboardStatAction(dash,stat.dataset.gdrOwnerStatAction);
   return;
  }
  const card=e.target.closest("[data-gdr-module]");
  if(card&&dash.contains(card)){
   e.preventDefault();const m=card.dataset.gdrModule;
   if(m==="properties"||m==="visits"||m==="analytics"||m==="notifications")setMode(dash,m);else openExternal(dash,m);
   return;
  }
  if(e.target.closest("[data-gdr-owner-home]")){e.preventDefault();setMode(dash,"home");}
 });
 dash.addEventListener("keydown",function(e){
  if(e.key!=="Enter"&&e.key!==" ")return;
  const stat=e.target&&e.target.closest?e.target.closest("[data-gdr-owner-stat-action]"):null;
  if(!stat||!dash.contains(stat))return;
  e.preventDefault();
  applyOwnerDashboardStatAction(dash,stat.dataset.gdrOwnerStatAction);
 });
}
function styles(){
 const href="/assets/gdr-owner-command-center.css?v=20261113-owner-dashboard-stat-actions1";
 let link=$("#gdrOwnerCommandCenterStyle");
 if(!link){
  link=document.querySelector('link[rel="stylesheet"][href*="gdr-owner-command-center.css"]');
 }
 if(!link){
  link=document.createElement("link");
  link.id="gdrOwnerCommandCenterStyle";
  link.rel="stylesheet";
  document.head.appendChild(link);
 }
 link.id="gdrOwnerCommandCenterStyle";
 if(link.getAttribute("href")!==href)link.setAttribute("href",href);
 link.media="all";
}
function init(){
 styles();
 bindLogout();
 const dash=$("#ownerDashboard");if(!dash)return;
 ensureHome(dash);bind(dash);setMode(dash,"home");updateCounts(dash);
 if(observer)observer.disconnect();
 observer=new MutationObserver(()=>{const current=$("#ownerDashboard");if(!current)return;ensureHome(current);updateCounts(current);});
 observer.observe(dash,{childList:true,subtree:true,characterData:true});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
window.addEventListener("click",function(event){
 const target=event.target;
 const back=target&&target.closest?target.closest("#gdrOwnerModuleHeader [data-gdr-owner-home]"):null;
 if(!back)return;
 const dash=$("#ownerDashboard");
 if(!dash)return;
 event.preventDefault();
 event.stopPropagation();
 event.stopImmediatePropagation();
 setMode(dash,"home");
},true);
window.GDROwnerCommandCenter={refresh:init,showHome:function(){const d=$("#ownerDashboard");if(d)setMode(d,"home");},showProperties:function(filter){const d=$("#ownerDashboard");if(!d)return;d.dataset.gdrOwnerPropertyFilter=["all","available","occupied"].includes(filter)?filter:"all";setMode(d,"properties");refreshOwnerPropertyFilter(d);},showPendingVisits:function(){const d=$("#ownerDashboard");if(!d)return;setMode(d,"visits");d.dataset.gdrOwnerVisitFilter="pending";refreshOwnerVisitFilter(d);}};
})();