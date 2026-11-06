(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
let observer=null;
const moduleMeta={
 properties:{eyebrow:"GDR PROPERTIES",title:"My Properties",subtitle:"Manage your listings, availability and property details."},
 visits:{eyebrow:"GDR VISITS",title:"Visit Requests",subtitle:"Review enquiries and manage property visits."}
};
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
 const back=$("[data-gdr-owner-home]",header);
 if(back && back.dataset.gdrBackBound!=="1"){
  back.dataset.gdrBackBound="1";
  back.addEventListener("click",function(event){event.preventDefault();event.stopPropagation();setMode(dash,"home");});
 }
 return {home,header};
}
function setMode(dash,mode){
 const {home,header}=ensureHome(dash);
 dash.classList.remove("gdr-owner-mode-home","gdr-owner-mode-properties","gdr-owner-mode-visits");
 dash.classList.add("gdr-owner-mode-"+mode);
 home.hidden=mode!=="home";header.hidden=mode==="home";
 if(mode==="properties"||mode==="visits"){
  const m=moduleMeta[mode];
  $("#gdrOccModuleEyebrow",header).textContent=m.eyebrow;
  $("#gdrOccModuleTitle",header).textContent=m.title;
  $("#gdrOccModuleSubtitle",header).textContent=m.subtitle;
 }
 if(mode==="home"){
  updateCounts(dash);
  requestAnimationFrame(()=>window.scrollTo({top:0,behavior:"smooth"}));
 }else{
  requestAnimationFrame(()=>header.scrollIntoView({behavior:"smooth",block:"start"}));
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
   if(m==="properties"||m==="visits")setMode(dash,m);else openExternal(dash,m);
   return;
  }
  if(e.target.closest("[data-gdr-owner-home]")){e.preventDefault();setMode(dash,"home");}
 });
}
function styles(){
 if($("#gdrOwnerCommandCenterStyle"))return;
 const link=document.createElement("link");link.id="gdrOwnerCommandCenterStyle";link.rel="stylesheet";link.href="/assets/gdr-owner-command-center.css?v=20261107-workspace4";document.head.appendChild(link);
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