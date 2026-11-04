(function(){
 "use strict";
 function removeOwnerSavedProperties(){
  var root=document.querySelector("#ownerDashboard");
  if(!root)return;
  root.querySelectorAll("#ownerSavedPropertiesBtn,#gdrOwnerSavedPropertiesToggle,[data-owner-saved-properties]").forEach(function(el){el.remove()});
  var headings=Array.from(root.querySelectorAll("h1,h2,h3,h4,[role=heading]"));
  headings.forEach(function(h){
   if((h.textContent||"").trim().replace(/\\s+/g," ").toLowerCase()!=="saved properties")return;
   var node=h;
   for(var i=0;i<7&&node&&node!==root;i++,node=node.parentElement){
    var sig=((node.id||"")+" "+(typeof node.className==="string"?node.className:"")).toLowerCase();
    if(node.tagName==="SECTION"||/saved|favorite|favourite/.test(sig)){
     node.remove();return;
    }
   }
   if(h.parentElement)h.parentElement.remove();
  });
 }
 var queued=false;
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;removeOwnerSavedProperties()})}
 function boot(){
  removeOwnerSavedProperties();
  if(document.body)new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();