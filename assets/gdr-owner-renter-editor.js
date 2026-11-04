(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function currentRow(id){return (window.__gdCurrentRenters||[]).find(row=>String(row.id)===String(id));}
function attachEditAction(modal){
 if(!modal||!modal.classList.contains("active"))return;
 const dialog=modal.querySelector(".gd-current-renter-dialog");
 if(!dialog||dialog.dataset.gdrEditReady==="1")return;
 dialog.dataset.gdrEditReady="1";
 const actions=dialog.querySelector(".gd-renter-modal-actions");
 if(!actions)return;
 const edit=document.createElement("button");edit.type="button";edit.className="secondary-button gd-edit-current-renter-btn";edit.textContent="Edit renter details";
 actions.insertBefore(edit,actions.firstChild);
 edit.addEventListener("click",()=>{
  const id=dialog.querySelector(".gd-release-renter-btn")?.dataset.propertyId;
  const row=(window.__gdCurrentRenters||[]).find(item=>String(item.property_id)===String(id)&&String(item.id));
  // Use the active row represented by the modal heading, not an arbitrary property lookup.
  const heading=dialog.querySelector(".gd-renter-modal-head h3")?.textContent||"";
  const selected=(window.__gdCurrentRenters||[]).find(item=>String(item.renter_name||"Renter")===heading&&String(item.property_id)===String(id))||row;
  if(!selected){status("Could not identify this active renter. Close and reopen the details.");return;}
  renderEditor(dialog,selected);
 });
}
function status(message,good){
 const node=$("gdRenterEditStatus");if(node){node.textContent=message;node.className=good?"gd-renter-edit-status success":"gd-renter-edit-status";}
}
function renderEditor(dialog,row){
 const form=document.createElement("form");form.className="gd-renter-edit-form";
 form.innerHTML='<div class="gd-renter-edit-title"><strong>Edit current renter</strong><span>Changes apply only to this active rental record.</span></div>'+
 '<label>Renter name<input name="name" type="text" maxlength="120" required autocomplete="off"></label>'+
 '<label>Phone number <small>Indian mobile number, 10 digits</small><input name="phone" type="tel" inputmode="numeric" maxlength="10" pattern="[6-9][0-9]{9}" autocomplete="off"></label>'+
 '<p id="gdRenterEditStatus" class="gd-renter-edit-status" aria-live="polite"></p>'+
 '<div class="gd-renter-edit-actions"><button type="button" class="secondary-button" data-cancel-renter-edit>Cancel</button><button type="submit" class="dashboard-primary-action">Save renter details</button></div>';
 form.elements.name.value=row.renter_name||"";
 form.elements.phone.value=String(row.renter_phone||"").replace(/^\+91\s*/,"");
 const grid=dialog.querySelector(".gd-renter-detail-grid");if(grid)grid.hidden=true;
 const note=dialog.querySelector(".gd-renter-modal-note");if(note)note.hidden=true;
 const old=dialog.querySelector(".gd-renter-edit-form");if(old)old.remove();
 dialog.querySelector(".gd-renter-modal-actions")?.setAttribute("hidden","hidden");
 dialog.appendChild(form);
 form.querySelector("[data-cancel-renter-edit]").addEventListener("click",()=>{form.remove();if(grid)grid.hidden=false;if(note)note.hidden=false;dialog.querySelector(".gd-renter-modal-actions")?.removeAttribute("hidden");});
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  const name=form.elements.name.value.trim(),phone=form.elements.phone.value.trim();
  if(!name){status("Enter the renter name.");return;}
  if(phone&&!/^[6-9][0-9]{9}$/.test(phone)){status("Enter a valid 10-digit Indian mobile number.");return;}
  const save=form.querySelector('[type="submit"]');save.disabled=true;save.textContent="Saving…";
  try{
   const client=window.__gdrSupabaseClient;
   if(!client)throw new Error("Account service is not ready. Refresh and try again.");
   const result=await client.rpc("update_my_current_renter_contact",{p_occupancy_id:row.id,p_renter_name:name,p_renter_phone:phone||null});
   if(result.error)throw result.error;
   row.renter_name=name;row.renter_phone=phone||null;
   status("Renter details saved successfully.",true);
   if(typeof window.loadOwnerProperties==="function")await window.loadOwnerProperties();
   else if(typeof window.refreshOwnerDashboard==="function")await window.refreshOwnerDashboard();
   else setTimeout(()=>{if(typeof window.openCurrentRenterDetails==="function")window.openCurrentRenterDetails(row.id);},250);
   setTimeout(()=>{if(typeof window.openCurrentRenterDetails==="function")window.openCurrentRenterDetails(row.id);},250);
  }catch(error){status(error?.message||"Could not save renter details. Please try again.");save.disabled=false;save.textContent="Save renter details";}
 });
}
const style=document.createElement("style");style.textContent='.gd-renter-edit-form{display:grid;gap:13px;margin-top:16px}.gd-renter-edit-title{display:grid;gap:4px}.gd-renter-edit-title strong{font-size:16px;color:#173b35}.gd-renter-edit-title span,.gd-renter-edit-form label small{font-size:11px;color:#71817b}.gd-renter-edit-form label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#38544e}.gd-renter-edit-form input{width:100%;min-height:46px;padding:11px 13px;border:1px solid #d4e2dd;border-radius:12px;background:#fff;color:#173b35;font:inherit}.gd-renter-edit-status{min-height:18px;margin:0;font-size:12px;color:#b45309}.gd-renter-edit-status.success{color:#16804b}.gd-renter-edit-actions{display:flex;gap:9px;flex-wrap:wrap}.gd-renter-edit-actions button{min-height:44px}@media(max-width:600px){.gd-renter-edit-actions{display:grid;grid-template-columns:1fr}.gd-renter-edit-actions button{width:100%}}';
document.head.appendChild(style);
const observer=new MutationObserver(()=>{const modal=$("gdCurrentRenterModal");if(modal&&modal.classList.contains("active"))attachEditAction(modal);});
observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
document.addEventListener("click",event=>{if(event.target.closest(".gd-current-renter-card")){const timer=setInterval(()=>{const modal=$("gdCurrentRenterModal");if(modal&&modal.classList.contains("active")){attachEditAction(modal);clearInterval(timer);}},50);setTimeout(()=>clearInterval(timer),3000);}});
})();