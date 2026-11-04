(function(){
 "use strict";
 const $=s=>document.querySelector(s);
 let section=null,button=null,observer=null;
 function findSection(){
  const root=$("#ownerDashboard");if(!root)return null;
  const headings=[...root.querySelectorAll("h1,h2,h3,h4,[role=heading]")];
  const heading=headings.find(el=>(el.textContent||"").trim().replace(/\\s+/g," ").toLowerCase()==="saved properties");
  if(!heading)return null;
  let node=heading;
  for(let depth=0;node&&node!==root&&depth<7;depth++,node=node.parentElement){
   const signature=((node.id||"")+" "+(typeof node.className==="string"?node.className:"")).toLowerCase();
   if(/saved|favorite|favourite/.test(signature)&&node!==heading.parentElement)return node;
  }
  return heading.closest("section")||heading.parentElement?.parentElement?.parentElement||null;
 }
 function ensure(){
  const root=$("#ownerDashboard");if(!root)return;
  const found=findSection();if(!found)return;
  if(section!==found){section=found;section.hidden=true;section.setAttribute("aria-hidden","true");}
  if(!button||!button.isConnected){
   button=document.createElement("button");
   button.type="button";button.id="gdrOwnerSavedPropertiesToggle";
   button.className="dashboard-secondary-action gdr-owner-saved-toggle";
   button.textContent="♡ Saved Properties";
   button.setAttribute("aria-controls","gdrOwnerSavedPropertiesPanel");
   button.setAttribute("aria-expanded","false");
   section.id="gdrOwnerSavedPropertiesPanel";
   button.addEventListener("click",function(){
    const opening=section.hidden;
    section.hidden=!opening;section.setAttribute("aria-hidden",String(!opening));
    button.setAttribute("aria-expanded",String(opening));
    button.textContent=opening?"× Hide Saved Properties":"♡ Saved Properties";
    if(opening)section.scrollIntoView({behavior:"smooth",block:"start"});
   });
   const anchor=root.querySelector(".owner-dashboard-quick-grid")||section;
   if(anchor===section)section.parentNode.insertBefore(button,section);
   else anchor.insertAdjacentElement("afterend",button);
  }
 }
 document.addEventListener("click",function(event){
  if(!section||section.hidden)return;
  if(section.contains(event.target)||event.target.closest("#gdrOwnerSavedPropertiesToggle"))return;
  const action=event.target.closest("button,a,[role=button],[data-dashboard-action]");
  if(!action)return;
  section.hidden=true;section.setAttribute("aria-hidden","true");
  if(button){button.setAttribute("aria-expanded","false");button.textContent="♡ Saved Properties";}
 },true);
 function boot(){ensure();if(!observer){observer=new MutationObserver(ensure);observer.observe(document.body,{childList:true,subtree:true});}}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();