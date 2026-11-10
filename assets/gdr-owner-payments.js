(function(){
"use strict";
const $=(id,root=document)=>root.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>"₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(Number(v||0));
const client=()=>window.__gdrSupabaseClient||window.supabaseClient||null;
const qrUrl=path=>String(path||"").indexOf("http")===0?path:client().storage.from("owner-payment-qr").getPublicUrl(path).data.publicUrl;
let root=null,owner=null,properties=[],occupancies=[],settings=[],payments=[],charges=[],activeProperty="all",filterStatus="all",search="",tab="overview",busy=false,chargeBusy=false,qrPreviewObjectUrl=null;
function injectButton(){
 // My Payments is already a command-centre tile. Remove the old second launcher.
 const duplicate=$("gdrPaymentsOpen");
 if(duplicate)duplicate.remove();
}
function styles(){
 if($("gdr-pay-style"))return;
 const l=document.createElement("link");l.id="gdr-pay-style";l.rel="stylesheet";l.href="/assets/gdr-owner-payments.css?v=20261107-paymentproof1";document.head.appendChild(l);
}
function fmtDate(v){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});}
function statusOf(p){return p.status==="paid"?"Paid":p.status==="rejected"?"Rejected":"Pending verification";}
function activeRows(){return payments.filter(p=>(activeProperty==="all"||p.property_id===activeProperty)&&(filterStatus==="all"||p.status===filterStatus)&&(!search||[p.renter_name,p.property_name,p.utr].join(" ").toLowerCase().includes(search.toLowerCase())));}
function settingFor(id){return settings.find(x=>x.property_id===id)||{};}
function propName(id){const p=properties.find(x=>x.id===id);return p?(p.title||p.name||"Property"):"Property";}
function ensurePage(){
 if(root)return;
 root=document.createElement("section");root.id="gdrPaymentsPage";root.setAttribute("aria-label","Owner payment management");
 root.innerHTML='<div class="gdr-pay-shell"><header class="gdr-pay-header gdr-pay-header--minimal"><div class="gdr-pay-brand-title"><span class="gdr-pay-eyebrow">OWNER WORKSPACE</span><h1>GDR PAYMENT</h1><p>Manage rent collection, payment activity and UPI settings.</p></div><button class="gdr-pay-close" id="gdrPayClose" type="button" aria-label="Close payments">← <span>Back to Dashboard</span></button></header><div id="gdrPayNotice" class="gdr-pay-notice" aria-live="polite"></div><div class="gdr-pay-tabs"><button data-tab="overview" class="active">Overview</button><button data-tab="records">Payment activity</button><button data-tab="settings">UPI settings</button></div><div id="gdrPayContent"><div class="gdr-pay-loading"><i></i><i></i><i></i><span>Loading payment workspace…</span></div></div><section class="gdr-pay-charge-modal" id="gdrPayChargeModal" hidden aria-label="Add additional rent charge"><div class="gdr-pay-charge-dialog" role="dialog" aria-modal="true" aria-labelledby="gdrPayChargeTitle"><header><div><span class="gdr-pay-eyebrow">RENTAL CHARGES</span><h2 id="gdrPayChargeTitle">Add additional charge</h2><p>Link this charge to one active renter and their property.</p></div><button type="button" id="gdrPayChargeCancel" class="gdr-pay-close">Cancel</button></header><form id="gdrPayChargeForm" class="gdr-pay-form"><label>Applicable renter / property<select name="occupancy_id" required></select></label><label>Charge name<input name="title" maxlength="100" required placeholder="e.g. Maintenance"></label><label>Description (optional)<textarea name="description" maxlength="500" rows="3" placeholder="What is this charge for?"></textarea></label><label>Amount (₹)<input name="amount" type="number" min="1" max="10000000" step="0.01" required></label><label>Billing frequency<select name="frequency"><option value="monthly">Every month</option><option value="one_time">One-time</option></select></label><label>Monthly due day (optional)<input name="due_day" type="number" min="1" max="28" placeholder="1–28"></label><div class="gdr-pay-charge-actions"><button type="button" id="gdrPayChargeCancelBottom" class="gdr-pay-secondary">Cancel</button><button type="submit" class="gdr-pay-primary">Save charge</button></div></form></div></section></div>';
 document.body.appendChild(root);$("gdrPayClose").addEventListener("click",close);
 root.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.tab;render();}));
}
function notice(msg,error=false){const n=$("gdrPayNotice");if(n){n.textContent=msg||"";n.className="gdr-pay-notice"+(error?" error":"");}}
async function load(){
 const c=client();if(!c)throw Error("Secure database connection is unavailable. Please refresh and sign in again.");
 const auth=await c.auth.getUser();if(auth.error||!auth.data?.user)throw Error("Please sign in again to access owner payments.");
 const u=auth.data.user;
 const own=await c.from("owners").select("id,name").eq("user_id",u.id).maybeSingle();
 if(own.error||!own.data)throw Error("Owner profile could not be found for this account.");
 owner=own.data;
 const [pr,oc,se,pa,ch]=await Promise.all([
  c.from("properties").select("id,title,name,address,rent,status").eq("owner_id",owner.id).order("created_at",{ascending:false}),
  c.from("property_occupancies").select("id,property_id,owner_id,renter_id,renter_name,renter_phone,occupied_at,released_at").eq("owner_id",owner.id).is("released_at",null).order("occupied_at",{ascending:false}),
  c.from("owner_payment_settings").select("*").eq("owner_id",owner.id),
  c.from("rent_payment_records").select("*").eq("owner_id",owner.id).order("created_at",{ascending:false}).limit(250),
  c.from("occupancy_charges").select("id,occupancy_id,owner_id,title,description,amount,frequency,due_day,is_active,created_at").eq("owner_id",owner.id).eq("is_active",true).order("created_at",{ascending:false})
 ]);
 for(const r of [pr,oc,se,pa,ch])if(r.error)throw Error(r.error.message||"Could not load payment and charge records.");
 properties=pr.data||[];occupancies=oc.data||[];settings=se.data||[];payments=pa.data||[];charges=ch.data||[];
 // Attach current renter and property labels without relying on optional PostgREST relationship names.
 payments=payments.map(p=>{const o=occupancies.find(x=>x.id===p.occupancy_id);return {...p,renter_name:o?.renter_name||"Renter",property_name:propName(p.property_id),renter_phone:o?.renter_phone||""};});
 // Payment-proof URLs are generated only when a signed-in owner opens an individual proof.
 charges=charges.filter(x=>occupancies.some(row=>row.id===x.occupancy_id)).map(x=>{const o=occupancies.find(row=>row.id===x.occupancy_id);return {...x,renter_name:o?.renter_name||"Renter",property_id:o?.property_id||null,property_name:propName(o?.property_id)};});
}
function stat(label,value,icon,sub){return '<article class="gdr-pay-stat"><span class="gdr-pay-stat-icon">'+icon+'</span><div><small>'+label+'</small><strong>'+value+'</strong><em>'+sub+'</em></div></article>';}
function render(){
 if(!root)return;
 revokeQrPreviewObjectUrl();
 root.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
 const content=$("gdrPayContent");if(!content)return;
 if(tab==="overview")content.innerHTML=overview();
 else if(tab==="records")content.innerHTML=recordsView();
 else content.innerHTML=settingsView();
 bindContent();
}
function overview(){
 const baseExpected=occupancies.reduce((n,o)=>n+Number(properties.find(p=>p.id===o.property_id)?.rent||0),0);
 const additionalExpected=charges.filter(x=>x.frequency==="monthly").reduce((n,x)=>n+Number(x.amount||0),0);
 const expected=baseExpected+additionalExpected;
 const received=payments.filter(p=>p.status==="paid").reduce((n,p)=>n+Number(p.total_amount||0),0);
 const pending=payments.filter(p=>p.status==="pending_verification").reduce((n,p)=>n+Number(p.total_amount||0),0);
 const rejected=payments.filter(p=>p.status==="rejected").length;
 const paid=payments.filter(p=>p.status==="paid").length;
 const unpaid=payments.filter(p=>p.status==="pending_verification").length;
 return '<div class="gdr-pay-stat-grid">'+stat("Base monthly rent",money(baseExpected),"⌂",occupancies.length+" active renters")+stat("Additional monthly charges",money(additionalExpected),"＋",charges.filter(x=>x.frequency==="monthly").length+" active charges")+stat("Total monthly payable",money(expected),"₹","Base rent + monthly charges")+stat("Rent received",money(received),"✓",paid+" verified payments")+stat("Awaiting verification",money(pending),"◷",unpaid+" submissions")+stat("Rejected submissions",String(rejected),"!", "Review renter resubmissions")+'</div>'+
 '<div class="gdr-pay-panel gdr-pay-panel-highlight"><div><span class="gdr-pay-eyebrow">PAYMENT CONTROL CENTRE</span><h2>Keep every rent record organised.</h2><p>Review renter UPI submissions, verify received payments and update the UPI details shown to your renters.</p></div><button class="gdr-pay-primary" data-go-tab="records">Review payment activity <span>→</span></button></div>'+
 '<div class="gdr-pay-panel"><div class="gdr-pay-panel-head"><div><span class="gdr-pay-eyebrow">YOUR PROPERTIES</span><h2>Payment setup by property</h2></div><span class="gdr-pay-count">'+properties.length+' properties</span></div>'+
 (properties.length?'<div class="gdr-pay-property-grid">'+properties.map(p=>{const s=settingFor(p.id);return '<article class="gdr-pay-property"><div class="gdr-pay-property-icon">⌂</div><div class="gdr-pay-property-main"><b>'+esc(p.title||p.name||"Property")+'</b><small>'+esc(p.address||"Address not set")+'</small><span>'+money(p.rent)+' / month · base rent</span></div><span class="gdr-pay-setup '+(s.upi_id||s.upi_qr_path?"ready":"missing")+'">'+(s.upi_id||s.upi_qr_path?"UPI configured":"Setup needed")+'</span><button type="button" data-edit-setting="'+esc(p.id)+'" class="gdr-pay-small">Edit details</button></article>';}).join("")+'</div>':'<p class="gdr-pay-empty">Add a property first to configure rent payments.</p>')+'</div>'+
 '<div class="gdr-pay-panel"><div class="gdr-pay-panel-head"><div><span class="gdr-pay-eyebrow">ADDITIONAL CHARGES</span><h2>Charges by Active Renters</h2><p>Every charge is linked to one active renter and property. Charges do not mark a payment as collected.</p></div><button type="button" class="gdr-pay-primary" id="gdrPayAddCharge" '+(occupancies.length?"":"disabled")+'>+ Add Charges</button></div>'+
 (charges.length?'<div class="gdr-pay-charge-list">'+charges.map(x=>'<article class="gdr-pay-charge-row"><div><b>'+esc(x.title)+'</b><small>'+esc(x.renter_name)+' · '+esc(x.property_name)+'</small>'+(x.description?'<p>'+esc(x.description)+'</p>':'')+'<small>'+(x.frequency==="monthly"?"Monthly recurring":"One-time")+(x.due_day?" · Due day "+x.due_day:"")+'</small></div><strong>'+money(x.amount)+'</strong></article>').join("")+'</div>':'<p class="gdr-pay-empty">'+(occupancies.length?"No additional charges have been added yet.":"Add an active renter before creating a renter-specific charge.")+'</p>')+'</div>';
}
function recordsView(){
 return '<div class="gdr-pay-panel"><div class="gdr-pay-panel-head"><div><span class="gdr-pay-eyebrow">RENTER SUBMISSIONS</span><h2>Payment activity</h2><p>Review UTR/reference details and verify payments received directly by you.</p></div><span class="gdr-pay-count">'+payments.length+' records</span></div><div class="gdr-pay-filters"><input id="gdrPaySearch" type="search" placeholder="Search renter, property or UTR…" value="'+esc(search)+'"><select id="gdrPayPropertyFilter"><option value="all">All properties</option>'+properties.map(p=>'<option value="'+esc(p.id)+'" '+(activeProperty===p.id?"selected":"")+'>'+esc(p.title||p.name||"Property")+'</option>').join("")+'</select><select id="gdrPayStatusFilter"><option value="all">All statuses</option><option value="pending_verification" '+(filterStatus==="pending_verification"?"selected":"")+'>Pending verification</option><option value="paid" '+(filterStatus==="paid"?"selected":"")+'>Paid</option><option value="rejected" '+(filterStatus==="rejected"?"selected":"")+'>Rejected</option></select></div>'+
 (activeRows().length?'<div class="gdr-pay-record-list">'+activeRows().map(p=>'<article class="gdr-pay-record"><div class="gdr-pay-record-top"><div><b>'+esc(p.renter_name)+'</b><small>'+esc(p.property_name)+' · '+fmtDate(p.billing_period)+'</small></div><span class="gdr-pay-status '+esc(p.status)+'">'+esc(statusOf(p))+'</span></div><div class="gdr-pay-record-grid"><div><small>Amount due</small><strong>'+money(p.total_amount)+'</strong></div><div><small>Payment reference</small><strong>'+esc(p.utr||"Not provided")+'</strong></div><div><small>Submitted</small><strong>'+fmtDate(p.created_at)+'</strong></div><div><small>Method</small><strong>'+esc((p.payment_method||"upi_qr").replace(/_/g," "))+'</strong></div></div>'+(p.payment_date?'<p class="gdr-pay-note">Payment date: '+fmtDate(p.payment_date)+'</p>':'')+(p.proof_path?'<a class="gdr-pay-proof-link" href="#" data-payment-proof="'+esc(p.proof_path)+'">View payment screenshot ↗</a>':'<p class="gdr-pay-note">No screenshot attached</p>')+(p.owner_note?'<p class="gdr-pay-note">Owner note: '+esc(p.owner_note)+'</p>':'')+(p.status==="pending_verification"?'<div class="gdr-pay-record-actions"><button class="gdr-pay-primary" data-verify="'+esc(p.id)+'" data-decision="paid">Confirm received</button><button class="gdr-pay-secondary" data-verify="'+esc(p.id)+'" data-decision="rejected">Reject submission</button></div>':'')+'</article>').join("")+'</div>':'<div class="gdr-pay-empty"><span>◷</span><b>No payment submissions found</b><small>Renter payment submissions will appear here after they submit a UTR and payment proof.</small></div>')+'</div>';
}
function settingsView(){
 const chosen=properties.find(p=>p.id===activeProperty)||properties[0];const s=chosen?settingFor(chosen.id):{};
 return '<div class="gdr-pay-settings-grid"><section class="gdr-pay-panel"><div class="gdr-pay-eyebrow">OWNER PAYMENT DETAILS</div><h2>UPI payment settings</h2><p>These details are shared with the active renter of the selected property.</p><button type="button" class="gdr-pay-secondary" id="gdrPayUseGdrDetails">USE GDR PAYMENT DETAILS</button>'+
 (properties.length?'<form id="gdrPaySettingsForm" class="gdr-pay-form"><label>Property<select name="property_id" id="gdrPaySettingsProperty">'+properties.map(p=>'<option value="'+esc(p.id)+'" '+(chosen?.id===p.id?"selected":"")+'>'+esc(p.title||p.name||"Property")+'</option>').join("")+'</select></label><label>UPI ID<input name="upi_id" maxlength="120" placeholder="name@bank" value="'+esc(s.upi_id||"")+'"></label><label>Payee name<input name="payee_name" maxlength="120" placeholder="Name shown in UPI app" value="'+esc(s.payee_name||owner?.name||"")+'"></label><label>Payment mobile number<input name="payment_mobile" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="16" placeholder="10-digit mobile number" value="'+esc(s.payment_mobile||"")+'"></label><label>Monthly due day<input name="due_day" type="number" min="1" max="28" value="'+esc(s.due_day||5)+'"></label><label>Late fee (₹)<input name="late_fee_amount" type="number" min="0" max="100000" step=".01" value="'+esc(s.late_fee_amount||0)+'"></label><label>Grace period (days)<input name="late_fee_grace_days" type="number" min="0" max="30" value="'+esc(s.late_fee_grace_days||0)+'"></label><label>Payment instructions<textarea name="instructions" rows="3" maxlength="500" placeholder="Add instructions for renters…">'+esc(s.instructions||"")+'</textarea></label><div class="gdr-pay-upload"><div><b>UPI QR code</b><small>PNG, JPG or WEBP · Maximum 5 MB</small></div><input type="file" name="qr" id="gdrPayQrFile" accept="image/png,image/jpeg,image/webp">'+(s.upi_qr_path?'<img class="gdr-pay-qr-preview" src="'+esc(qrUrl(s.upi_qr_path))+'" alt="Saved UPI QR code">':'<div class="gdr-pay-qr-empty">QR preview will appear here</div>')+'</div><button class="gdr-pay-primary" type="submit">Save payment details</button></form>':'<p class="gdr-pay-empty">No properties found.</p>')+'</section><aside class="gdr-pay-panel gdr-pay-help"><span class="gdr-pay-help-icon">🔒</span><h3>Safe payment handling</h3><p>QR scans and renter submissions are not proof of payment. Verify the UTR and confirm that the amount has reached your bank account before marking it received.</p><p>GharDekho does not collect or hold rent payments.</p></aside></div>';
}
function bindContent(){
 root.querySelectorAll("[data-go-tab]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.goTab;render();}));
 root.querySelectorAll("[data-edit-setting]").forEach(b=>b.addEventListener("click",()=>{activeProperty=b.dataset.editSetting;tab="settings";render();}));
 const searchBox=$("gdrPaySearch");if(searchBox)searchBox.addEventListener("input",e=>{search=e.target.value;const pos=e.target.selectionStart;render();const n=$("gdrPaySearch");n?.focus();n?.setSelectionRange(pos,pos);});
 const pf=$("gdrPayPropertyFilter");if(pf)pf.addEventListener("change",e=>{activeProperty=e.target.value;render();});
 const sf=$("gdrPayStatusFilter");if(sf)sf.addEventListener("change",e=>{filterStatus=e.target.value;render();});
 root.querySelectorAll("[data-verify]").forEach(b=>b.addEventListener("click",()=>verify(b.dataset.verify,b.dataset.decision)));
 const addChargeButton=$("gdrPayAddCharge");if(addChargeButton)addChargeButton.addEventListener("click",openChargeForm);
 ["gdrPayChargeCancel","gdrPayChargeCancelBottom"].forEach(id=>{const button=$(id);if(button&&button.dataset.gdrBound!=="1"){button.dataset.gdrBound="1";button.addEventListener("click",closeChargeForm);}});
 const chargeForm=$("gdrPayChargeForm");if(chargeForm&&chargeForm.dataset.gdrBound!=="1"){chargeForm.dataset.gdrBound="1";chargeForm.addEventListener("submit",saveCharge);}
 root.querySelectorAll("[data-payment-proof]").forEach(link=>link.addEventListener("click",event=>openPaymentProof(event,link.dataset.paymentProof)));
 $("gdrPayUseGdrDetails")?.addEventListener("click",applyGdrPaymentDetails);
 const f=$("gdrPaySettingsForm");if(f){f.elements.property_id.addEventListener("change",e=>{activeProperty=e.target.value;render();});f.addEventListener("submit",saveSettings);$("gdrPayQrFile")?.addEventListener("change",previewQr);}
}
async function openPaymentProof(event,path){
 event.preventDefault();
 if(!path)return;
 const popup=window.open("about:blank","_blank");
 if(!popup){notice("Allow pop-ups to view the payment screenshot.",true);return;}
 try{
  const result=await client().storage.from("rent-payment-proofs").createSignedUrl(path,3600);
  if(result.error||!result.data?.signedUrl)throw result.error||new Error("The payment screenshot could not be opened.");
  popup.opener=null;
  popup.location.replace(result.data.signedUrl);
 }catch(error){
  try{popup.close();}catch(e){}
  notice(error.message||"The payment screenshot could not be opened.",true);
 }
}
function applyGdrPaymentDetails(){
 const form=$("gdrPaySettingsForm");
 if(!form)return;
 const source=settings.slice().sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0))
  .find(item=>item.upi_id||item.upi_qr_path||item.payment_mobile||item.instructions||item.payee_name);
 if(!source){notice("Save GDR payment details on one property first, then reuse them here.",true);return;}
 form.elements.upi_id.value=source.upi_id||"";
 form.elements.payee_name.value=source.payee_name||owner?.name||"";
 form.elements.payment_mobile.value=source.payment_mobile||"";
 form.elements.instructions.value=source.instructions||"";
 form.elements.due_day.value=source.due_day||5;
 form.elements.late_fee_amount.value=source.late_fee_amount??0;
 form.elements.late_fee_grace_days.value=source.late_fee_grace_days??0;
 form.dataset.copiedQrPath=source.upi_qr_path||"";
 const box=form.querySelector(".gdr-pay-upload");
 if(box){
  revokeQrPreviewObjectUrl();
  box.querySelector(".gdr-pay-qr-preview,.gdr-pay-qr-empty")?.remove();
  if(source.upi_qr_path){
   const img=document.createElement("img");
   img.className="gdr-pay-qr-preview";img.alt="Saved GDR UPI QR code";img.loading="lazy";img.decoding="async";img.src=qrUrl(source.upi_qr_path);
   box.appendChild(img);
  }else{
   const empty=document.createElement("div");empty.className="gdr-pay-qr-empty";empty.textContent="QR preview will appear here";box.appendChild(empty);
  }
 }
 notice("Saved GDR payment details loaded. Review them and save for this property.");
}
function normalizePaymentMobile(value){
 let digits=String(value||"").replace(/\D/g,"");
 if(digits.length===12&&digits.startsWith("91"))digits=digits.slice(2);
 return /^[6-9]\d{9}$/.test(digits)?digits:"";
}
function revokeQrPreviewObjectUrl(){
 if(qrPreviewObjectUrl){URL.revokeObjectURL(qrPreviewObjectUrl);qrPreviewObjectUrl=null;}
}
function openChargeForm(){
 const modal=$("gdrPayChargeModal"),form=$("gdrPayChargeForm");if(!modal||!form)return;
 if(!occupancies.length){notice("Add an active renter before creating an additional charge.",true);return;}
 const select=form.elements.occupancy_id;
 select.innerHTML=occupancies.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.renter_name||"Renter")+' · '+esc(propName(o.property_id))+'</option>').join("");
 form.reset();modal.hidden=false;document.body.classList.add("gdr-pay-lock");
 form.elements.title.focus({preventScroll:true});
}
function closeChargeForm(){const modal=$("gdrPayChargeModal");if(modal)modal.hidden=true;}
async function saveCharge(event){
 event.preventDefault();if(chargeBusy)return;
 const form=event.currentTarget,c=client(),occupancy=occupancies.find(o=>String(o.id)===String(form.elements.occupancy_id.value));
 if(!c||!owner||!occupancy){notice("Select a valid active renter and property.",true);return;}
 const title=form.elements.title.value.trim(),description=form.elements.description.value.trim(),amount=Number(form.elements.amount.value),frequency=form.elements.frequency.value,due=form.elements.due_day.value?Number(form.elements.due_day.value):null;
 if(title.length<2||title.length>100||description.length>500||!Number.isFinite(amount)||amount<=0||amount>10000000||!["monthly","one_time"].includes(frequency)||due!==null&&(!Number.isInteger(due)||due<1||due>28)){notice("Check charge name, description, amount, frequency and due day.",true);return;}
 const button=form.querySelector('button[type="submit"]');chargeBusy=true;button.disabled=true;button.textContent="Saving…";
 try{
  const result=await c.from("occupancy_charges").insert({occupancy_id:occupancy.id,owner_id:owner.id,title,description:description||null,amount,frequency,due_day:frequency==="monthly"?due:null}).select("id").maybeSingle();
  if(result.error)throw result.error;if(!result.data?.id)throw new Error("The charge was not saved. Check that this tenancy is still active.");
  closeChargeForm();await load();render();notice("Additional charge saved for "+(occupancy.renter_name||"the selected renter")+".");
 }catch(error){console.error("[GharDekho] payment workspace charge save failed",error);notice(error.message||"Could not save the additional charge.",true);}
 finally{chargeBusy=false;button.disabled=false;button.textContent="Save charge";}
}
function previewQr(e){
 const file=e.target.files?.[0];if(!file)return;
 if(file.size>5*1024*1024){notice("QR image must be 5 MB or smaller.",true);e.target.value="";return;}
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)){notice("Choose a PNG, JPG or WEBP image.",true);e.target.value="";return;}
 revokeQrPreviewObjectUrl();
 const box=e.target.closest(".gdr-pay-upload");if(!box)return;
 const img=document.createElement("img");img.className="gdr-pay-qr-preview";img.alt="New QR preview";img.loading="lazy";img.decoding="async";
 qrPreviewObjectUrl=URL.createObjectURL(file);img.src=qrPreviewObjectUrl;
 box.querySelector(".gdr-pay-qr-preview,.gdr-pay-qr-empty")?.remove();box.appendChild(img);
}
async function saveSettings(e){
 e.preventDefault();if(busy)return;busy=true;const f=e.currentTarget,c=client(),id=f.elements.property_id.value;
 try{
  const rawMobile=f.elements.payment_mobile.value.trim();
  const paymentMobile=normalizePaymentMobile(rawMobile);
  if(rawMobile&&!paymentMobile)throw Error("Enter a valid 10-digit Indian mobile number (or +91 followed by 10 digits).");
  const payload={owner_id:owner.id,property_id:id,upi_id:f.elements.upi_id.value.trim()||null,payee_name:f.elements.payee_name.value.trim()||null,payment_mobile:paymentMobile||null,due_day:Number(f.elements.due_day.value),late_fee_amount:Number(f.elements.late_fee_amount.value||0),late_fee_grace_days:Number(f.elements.late_fee_grace_days.value||0),instructions:f.elements.instructions.value.trim()||null,updated_at:new Date().toISOString()};
  if(payload.due_day<1||payload.due_day>28||payload.late_fee_amount<0||payload.late_fee_grace_days<0||payload.late_fee_grace_days>30)throw Error("Check due day, late fee and grace period.");
  const file=f.elements.qr.files?.[0];if(file){const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";const path=owner.id+"/"+id+"/"+Date.now()+"."+ext;const up=await c.storage.from("owner-payment-qr").upload(path,file,{upsert:true,contentType:file.type});if(up.error)throw up.error;payload.upi_qr_path=path;}
  else if(f.dataset.copiedQrPath)payload.upi_qr_path=f.dataset.copiedQrPath;
  const r=await c.from("owner_payment_settings").upsert(payload,{onConflict:"property_id"});if(r.error)throw r.error;
  revokeQrPreviewObjectUrl();
  delete f.dataset.copiedQrPath;
  notice("Payment details saved successfully.");await load();render();
 }catch(err){notice(err.message||"Could not save payment details.",true);}finally{busy=false;}
}
async function verify(id,decision){
 if(busy)return;const p=payments.find(x=>x.id===id);if(!p)return;
 const verb=decision==="paid"?"confirm that this rent has reached your bank account":"reject this payment submission";
 if(!confirm("Are you sure you want to "+verb+"?"))return;
 let note=null;if(decision==="rejected"){note=prompt("Reason for rejection (required):");if(note===null)return;note=note.trim();if(!note){notice("Please enter a rejection reason.",true);return;}note=note.slice(0,500);}
 busy=true;try{const r=await client().rpc("owner_verify_rent_payment",{p_payment_id:id,p_decision:decision,p_note:decision==="paid"?"Payment verified by owner":note});if(r.error)throw r.error;notice(decision==="paid"?"Payment marked as received.":"Payment rejected with reason.");await load();render();}catch(e){notice(e.message||"Could not update payment status.",true);}finally{busy=false;}
}
async function open(){
 ensurePage();root.classList.add("open");document.body.classList.add("gdr-pay-lock");tab="overview";notice("");
 try{await load();render();}catch(e){$("gdrPayContent").innerHTML='<div class="gdr-pay-empty"><b>Payment dashboard could not load</b><small>'+esc(e.message)+'</small><button class="gdr-pay-primary" id="gdrPayRetry">Try again</button></div>';$("gdrPayRetry")?.addEventListener("click",open);}
}
function close(){if(root)root.classList.remove("open");revokeQrPreviewObjectUrl();document.body.classList.remove("gdr-pay-lock");}
function injectButton(){
 const dash=$("ownerDashboard");if(!dash)return;
 styles();
 let btn=$("gdrPaymentsOpen");
 if(!btn){
  btn=document.createElement("button");btn.id="gdrPaymentsOpen";btn.type="button";btn.className="gdr-pay-launch";
  btn.innerHTML='<span class="gdr-pay-launch-icon">₹</span><span class="gdr-pay-launch-copy"><b>My Payments</b><small>Rent collection · UPI settings · payment records</small></span><span class="gdr-pay-launch-arrow">↗</span>';
  const stats=dash.querySelector(".dashboard-stats-grid");
  if(stats)stats.insertAdjacentElement("afterend",btn);else dash.prepend(btn);
 }
 if(btn.dataset.gdrBound!=="1"){btn.dataset.gdrBound="1";btn.addEventListener("click",open);}
}
function boot(){
 const obsoletePage=$("gdrPaymentsPage");if(obsoletePage)obsoletePage.remove();
 document.body.classList.remove("gdr-pay-lock");
 injectButton();
 styles();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
window.GDRPayments={open,close};
})();