(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
let observer=null;
let insightCache=null,insightCacheAt=0,insightLoading=null,insightOwnerId=null,insightMode="analytics";
const moduleMeta={
 properties:{eyebrow:"GDR PROPERTIES",title:"My Properties",subtitle:"Manage your listings, availability and property details."},
 visits:{eyebrow:"GDR VISITS",title:"Visit Requests",subtitle:"Review enquiries and manage property visits."},
 analytics:{eyebrow:"GDR ANALYTICS",title:"Owner Analytics",subtitle:"Verified property, tenancy, payment and enquiry figures from your account."},
 notifications:{eyebrow:"GDR NOTIFICATIONS",title:"Notifications",subtitle:"Account-specific updates derived from your latest property, visit and payment records."}
};
const insightClient=()=>window.__gdrSupabaseClient||window.supabaseClient||null;
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
function buildOwnerNotifications(data){
 const now=new Date(),recentCutoff=now.getTime()-30*86400000,items=[];
 const push=(id,type,title,detail,when,route)=>items.push({id,type,title,detail,when:when||null,route:route||"visits"});
 data.visits.filter(v=>v.status==="pending"&&new Date(v.created_at||0).getTime()>=recentCutoff).forEach(v=>push("visit:"+v.id,"visit","New visit request",[(v.name||"A renter")+" requested a property visit",v.visit_date?insightDate(v.visit_date):""].filter(Boolean).join(" · "),v.created_at,"visits"));
 data.payments.filter(p=>p.status==="pending_verification").forEach(p=>push("payment:"+p.id,"payment","Payment awaiting verification",[(p.renter_name||"Renter"),insightMoney(p.total_amount)].join(" · "),p.created_at,"payments"));
 data.properties.filter(p=>p.status==="pending"||p.verification_status==="pending").forEach(p=>push("property:"+p.id,"property","Property verification pending",p.title||p.name||"Your property listing",p.created_at,"properties"));
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate()),moveoutHorizon=new Date(today.getTime()+14*86400000);
 data.occupancies.filter(o=>!o.released_at&&o.expected_move_out_at).forEach(o=>{
  const due=new Date(o.expected_move_out_at+"T12:00:00");
  if(due>=today&&due<=moveoutHorizon)push("moveout:"+o.id,"renter","Upcoming renter move-out",(o.renter_name||"Renter")+" · "+insightDate(o.expected_move_out_at),o.expected_move_out_at,"renters");
 });
 const settingsByProperty=new Map(data.settings.map(s=>[s.property_id,s]));
 data.occupancies.filter(o=>!o.released_at).forEach(o=>{
  const setting=settingsByProperty.get(o.property_id);if(!setting||!setting.due_day)return;
  const due=nextDueDate(setting.due_day,now),days=Math.ceil((due.getTime()-today.getTime())/86400000);
  if(days>=0&&days<=7)push("rentdue:"+o.id+":"+due.toISOString().slice(0,10),"rent","Rent due date approaching",(o.renter_name||"Renter")+" · due "+insightDate(due.toISOString()),due.toISOString(),"payments");
 });
 return items.sort((a,b)=>new Date(b.when||0)-new Date(a.when||0)).slice(0,100);
}
async function fetchOwnerInsights(force){
 if(insightLoading)return insightLoading;
 insightLoading=(async()=>{
  const c=insightClient();if(!c)throw new Error("Secure database connection is unavailable. Refresh and sign in again.");
  const auth=await c.auth.getUser();if(auth.error||!auth.data?.user)throw new Error("Please sign in again to access Owner Analytics.");
  const owner=await c.from("owners").select("id").eq("user_id",auth.data.user.id).maybeSingle();
  if(owner.error||!owner.data)throw new Error("Owner profile could not be found.");
  if(insightOwnerId!==owner.data.id){insightOwnerId=owner.data.id;insightCache=null;insightCacheAt=0;}
  if(!force&&insightCache&&Date.now()-insightCacheAt<60000)return insightCache;
  const results=await Promise.all([
   c.from("properties").select("id,title,name,rent,status,verification_status,created_at,deleted_at").eq("owner_id",insightOwnerId).is("deleted_at",null).order("created_at",{ascending:false}).limit(200),
   c.from("property_occupancies").select("id,property_id,renter_name,occupied_at,released_at,expected_move_out_at").eq("owner_id",insightOwnerId).order("occupied_at",{ascending:false}).limit(200),
   c.from("visit_requests").select("id,property_id,name,visit_date,visit_time,status,created_at").eq("owner_id",insightOwnerId).order("created_at",{ascending:false}).limit(200),
   c.from("rent_payment_records").select("id,occupancy_id,property_id,renter_name,billing_period,total_amount,status,created_at,verified_at,payment_date").eq("owner_id",insightOwnerId).order("created_at",{ascending:false}).limit(300),
   c.from("owner_payment_settings").select("property_id,due_day,late_fee_amount,late_fee_grace_days").eq("owner_id",insightOwnerId).limit(200)
  ]);
  const errors=results.map((r,i)=>r.error?["properties","renters","visits","payments","settings"][i]+": "+r.error.message:null).filter(Boolean);
  const data={properties:results[0].data||[],occupancies:results[1].data||[],visits:results[2].data||[],payments:results[3].data||[],settings:results[4].data||[],errors};
  data.notifications=buildOwnerNotifications(data);
  insightCache=data;insightCacheAt=Date.now();return data;
 })().finally(()=>{insightLoading=null;});
 return insightLoading;
}
function analyticsMarkup(data){
 const properties=data.properties,active=data.occupancies.filter(o=>!o.released_at),byProperty=new Map(properties.map(p=>[p.id,p]));
 const verifiedAvailable=properties.filter(p=>p.status==="verified"&&p.verification_status==="verified"&&!active.some(o=>o.property_id===p.id)).length;
 const soonAvailable=properties.filter(p=>p.status==="soon_available").length,occupied=properties.filter(p=>p.status==="occupied").length;
 const monthlyExpected=active.reduce((sum,o)=>sum+Number(byProperty.get(o.property_id)?.rent||0),0);
 const now=new Date(),month=now.toISOString().slice(0,7);
 const paidThisMonth=data.payments.filter(p=>p.status==="paid"&&String(p.payment_date||p.verified_at||p.created_at||"").slice(0,7)===month);
 const received=paidThisMonth.reduce((sum,p)=>sum+Number(p.total_amount||0),0);
 const awaiting=data.payments.filter(p=>p.status==="pending_verification"),pendingAmount=awaiting.reduce((sum,p)=>sum+Number(p.total_amount||0),0);
 const newVisits=data.visits.filter(v=>v.status==="pending");
 const cards=[
  ["Total properties",properties.length,"All active listings"],
  ["Available now",verifiedAvailable,"Verified and vacant"],
  ["Occupied",occupied,"Currently occupied listings"],
  ["Soon available",soonAvailable,"Move-out workflow status"],
  ["Active renters",active.length,"Open occupancy records"],
  ["Expected monthly rent",insightMoney(monthlyExpected),"Base rent from active tenancies"],
  ["Received this month",insightMoney(received),paidThisMonth.length+" verified payment records"],
  ["Awaiting verification",insightMoney(pendingAmount),awaiting.length+" renter submissions"],
  ["Pending enquiries",newVisits.length,"Visit requests awaiting owner response"]
 ];
 return '<div class="gdr-insight-kpi-grid">'+cards.map(c=>'<article class="gdr-insight-kpi"><span>'+insightEsc(c[0])+'</span><strong>'+insightEsc(c[1])+'</strong><small>'+insightEsc(c[2])+'</small></article>').join("")+'</div>'+
 '<div class="gdr-insight-two-col"><section class="gdr-insight-card"><div class="gdr-insight-card-head"><div><span>PORTFOLIO</span><h3>Property status</h3></div><b>'+properties.length+'</b></div><div class="gdr-insight-bars">'+[['Verified available',verifiedAvailable],['Occupied',occupied],['Soon available',soonAvailable],['Pending verification',properties.filter(p=>p.verification_status==="pending"||p.status==="pending").length]].map(row=>'<div class="gdr-insight-bar-row"><span>'+row[0]+'</span><strong>'+row[1]+'</strong><i><em style="width:'+(properties.length?Math.min(100,Math.round(row[1]/properties.length*100)):0)+'%"></em></i></div>').join("")+'</div></section>'+
 '<section class="gdr-insight-card"><div class="gdr-insight-card-head"><div><span>PAYMENT ACTIVITY</span><h3>Latest payment records</h3></div><button type="button" data-insight-route="payments">Open payments</button></div>'+(data.payments.length?'<div class="gdr-insight-mini-list">'+data.payments.slice(0,5).map(p=>'<div><span><b>'+insightEsc(p.renter_name||"Renter")+'</b><small>'+insightEsc(p.billing_period||"Billing period unavailable")+'</small></span><strong>'+insightMoney(p.total_amount)+'</strong><em>'+insightEsc(p.status||"unknown")+'</em></div>').join("")+'</div>':'<p class="gdr-insight-empty">No payment records are available yet.</p>')+'</section></div>'+
 (data.errors.length?'<p class="gdr-insight-partial">Some account data could not be loaded: '+insightEsc(data.errors.join(" · "))+'</p>':'');
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
 const badge=$('[data-gdr-count="notifications"]',dash);if(badge)badge.textContent=String(unreadNotificationCount());
}

function countText(id){const n=document.getElementById(id);return n?(n.textContent||"0").trim():"0";}
function renterCount(){const n=$$("#ownerOccupancyContainer .gd-current-renter-card-v2,#ownerOccupancyContainer .gd-current-renter-card");return String(n.length);}
function ensureHome(dash){
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
function updateCounts(dash){
 const p=countText("ownerPropertyCount"),v=countText("ownerPendingVisitCount");
 const pc=$('[data-gdr-count="properties"]',dash),rc=$('[data-gdr-count="renters"]',dash),vc=$('[data-gdr-count="visits"]',dash);
 // Avoid replacing an identical text node: this module observes dashboard mutations,
 // so unconditional textContent writes can retrigger its own MutationObserver forever.
 setTextIfChanged(pc,p);
 setTextIfChanged(rc,renterCount());
 setTextIfChanged(vc,v);
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
  const card=e.target.closest("[data-gdr-module]");
  if(card&&dash.contains(card)){
   e.preventDefault();const m=card.dataset.gdrModule;
   if(m==="properties"||m==="visits"||m==="analytics"||m==="notifications")setMode(dash,m);else openExternal(dash,m);
   return;
  }
  if(e.target.closest("[data-gdr-owner-home]")){e.preventDefault();setMode(dash,"home");}
 });
}
function styles(){
 const href="/assets/gdr-owner-command-center.css?v=20261109-profilevisibility2";
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
window.GDROwnerCommandCenter={refresh:init,showHome:function(){const d=$("#ownerDashboard");if(d)setMode(d,"home");}};
})();