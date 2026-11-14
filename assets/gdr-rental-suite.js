(function(){
"use strict";
var $=function(id){return document.getElementById(id)},c=function(){return window.__gdrSupabaseClient||window.supabaseClient||null};
var esc=function(v){return String(v==null?"":v).replace(/[&<>"']/g,function(x){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]})};
var money=function(v){return "₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(Number(v||0))};
var date=function(v){return v?new Date(String(v).slice(0,10)+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—"};
var owner=null,props=[],settings=null,rental=null;

/* Keep the Saved Properties panel contextual: it stays open while the renter
   interacts with its contents, but closes as soon as another action is chosen. */
function dismissSavedPropertiesOnOtherAction(event){
 var panel=$("renterSavedPropertiesSection");
 if(!panel||panel.hidden||!panel.isConnected)return;
 var target=event.target&&event.target.closest?event.target:null;
 if(!target)return;
 var savedToggle=target.closest("#renterSavedPropertiesBtn,[data-open-saved-properties]");
 if(savedToggle)return;
 if(panel.contains(target))return;
 var action=target.closest("button,a,[role='button'],input[type='submit'],input[type='button'],[data-dashboard-action]");
 if(!action)return;
 panel.hidden=true;
 var toggle=$("renterSavedPropertiesBtn");
 if(toggle)toggle.setAttribute("aria-expanded","false");
}
document.addEventListener("click",dismissSavedPropertiesOnOtherAction,true);

function toast(msg,bad){var n=$("gdrRentalToast");if(!n){n=document.createElement("div");n.id="gdrRentalToast";n.className="gdr-rental-toast";document.body.appendChild(n)}n.textContent=msg;n.dataset.error=bad?"1":"0";n.classList.add("show");setTimeout(function(){n.classList.remove("show")},3500)}
function row(k,v){return '<div class="gdr-rental-data-row"><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>'}
function addRenter(){
 var root=$("renterDashboard"),actions=root&&root.querySelector(".renter-dashboard-actions");if(!root||!actions||$("gdrRenterHomeAction"))return;
 actions.insertAdjacentHTML("beforeend",'<button type="button" class="renter-dashboard-action" id="gdrRenterHomeAction"><span class="renter-action-icon">⌂</span><span><strong>My Home</strong><small>Your home and owner details</small></span><span class="renter-action-arrow">→</span></button><button type="button" class="renter-dashboard-action" id="gdrRenterPaymentsAction"><span class="renter-action-icon">₹</span><span><strong>My Payments</strong><small>Rent, charges and payment history</small></span><span class="renter-action-arrow">→</span></button>');
 root.insertAdjacentHTML("beforeend",'<section class="gdr-rental-panel renter-dashboard-panel" id="gdrRenterHomePanel" hidden><div class="gdr-rental-panel-head"><div><span class="gdr-rental-kicker">YOUR CURRENT TENANCY</span><h3>My Home</h3><p>Everything about the home you currently live in.</p></div><button class="gdr-rental-close" data-rental-close>Back to dashboard</button></div><div id="gdrRenterHomeContent">Loading your home…</div></section><section class="gdr-rental-panel renter-dashboard-panel" id="gdrRenterPaymentsPanel" hidden><div class="gdr-rental-panel-head"><div><span class="gdr-rental-kicker">RENT & BILLING</span><h3>My Payments</h3><p>Understand every charge before you pay.</p></div><button class="gdr-rental-close" data-rental-close>Back to dashboard</button></div><div id="gdrRenterPaymentsContent">Loading payments…</div></section>');
 $("gdrRenterHomeAction").onclick=function(){openRenter("home")};$("gdrRenterPaymentsAction").onclick=function(){openRenter("payments")};
 root.querySelectorAll("[data-rental-close]").forEach(function(b){b.onclick=closeRenter});
}
function openRenter(which){$("gdrRenterHomePanel").hidden=which!=="home";$("gdrRenterPaymentsPanel").hidden=which!=="payments";if($("renterSavedPropertiesSection"))$("renterSavedPropertiesSection").hidden=true;if($("renterLiveNearbyPanel"))$("renterLiveNearbyPanel").hidden=true;var toggle=$("renterSavedPropertiesBtn");if(toggle)toggle.setAttribute("aria-expanded","false");if(which==="home")loadHome();else loadPayments();$("gdrRenter"+(which==="home"?"Home":"Payments")+"Panel").scrollIntoView({behavior:"smooth",block:"start"})}
function closeRenter(){["gdrRenterHomePanel","gdrRenterPaymentsPanel"].forEach(function(id){if($(id))$(id).hidden=true});if($("renterSavedPropertiesSection"))$("renterSavedPropertiesSection").hidden=false}
async function getRental(){var r=await c().rpc("get_my_current_rental_details");if(r.error)throw r.error;return Array.isArray(r.data)?r.data[0]:r.data}
async function loadHome(){
 var t=$("gdrRenterHomeContent");
 try{
  rental=await getRental();
  if(!rental){t.innerHTML='<div class="gdr-rental-empty"><h4>No active home yet</h4><p>Your home details will appear after an owner confirms your tenancy.</p></div>';return;}
  var photo=rental.image_url?'<img src="'+esc(rental.image_url)+'" alt="Your property">':'<div class="gdr-home-placeholder">⌂</div>';
  var localNow=new Date();localNow.setMinutes(localNow.getMinutes()-localNow.getTimezoneOffset());
  var today=localNow.toISOString().slice(0,10);
  var noticeExists=!!rental.expected_move_out_at;
  var noticeText=noticeExists
   ?"Your move-out notice is recorded. The property will show Vacating Soon until the owner confirms the move-out."
   :"Tell your owner when you plan to move out. Your tenancy stays active until the owner confirms your move-out.";
  var noticeCard='<section class="gdr-rental-card gdr-moveout-notice"><div class="gdr-moveout-heading"><div><span class="gdr-moveout-kicker">TENANCY UPDATE</span><h4>Move-out notice</h4></div><span class="gdr-moveout-badge">'+(noticeExists?'Notice submitted':'Active tenancy')+'</span></div>'+
   '<p id="gdrRenterMoveoutHelp">'+esc(noticeText)+'</p>'+
   '<form id="gdrRenterMoveoutForm" class="gdr-moveout-form"><label>Expected move-out date<input type="date" name="moveout" min="'+today+'" value="'+esc(rental.expected_move_out_at||"")+'" required></label>'+
   '<div class="gdr-moveout-actions"><button type="submit" class="gdr-rental-primary">'+(noticeExists?'Update notice':'Submit move-out notice')+'</button>'+
   (noticeExists?'<button type="button" class="gdr-rental-secondary" id="gdrRenterWithdrawMoveout">Withdraw notice</button>':'')+
   '</div></form><p id="gdrRenterMoveoutMessage" class="gdr-moveout-message" aria-live="polite"></p></section>';
  t.innerHTML='<div class="gdr-home-hero"><div class="gdr-home-photo">'+photo+'</div><div><span class="gdr-rental-status">● Active tenancy</span><h4>'+esc(rental.title||rental.name||"Your home")+'</h4><p>'+esc(rental.address||rental.location||"Address not available")+'</p><div class="gdr-home-tags"><span>'+esc(rental.listing_type||"Home")+'</span>'+(rental.bhk?'<span>'+esc(rental.bhk)+' BHK</span>':"")+(rental.furnishing?'<span>'+esc(rental.furnishing)+'</span>':"")+'</div></div></div>'+
   '<div class="gdr-rental-metrics"><article><small>Monthly base rent</small><strong>'+money(rental.rent)+'</strong></article><article><small>Move-in date</small><strong>'+date(rental.occupied_at)+'</strong></article><article><small>Expected move-out</small><strong id="gdrRenterExpectedMoveOut">'+date(rental.expected_move_out_at)+'</strong></article></div>'+
   '<div class="gdr-rental-two-col"><section class="gdr-rental-card"><h4>Property details</h4>'+row("Property type",rental.listing_type||"Home")+row("Room type",rental.room_type||"—")+row("BHK",rental.bhk||"—")+row("Furnishing",rental.furnishing||"—")+row("Address",rental.address||rental.location||"—")+'</section>'+
   '<section class="gdr-rental-card"><h4>Your owner</h4><div class="gdr-owner-contact"><span class="gdr-owner-avatar">'+esc((rental.owner_name||"O").slice(0,1).toUpperCase())+'</span><div><strong>'+esc(rental.owner_name||"Property owner")+'</strong><small>Owner / property manager</small></div></div>'+row("Contact",rental.owner_phone||"Not shared")+(rental.owner_phone?'<a class="gdr-rental-secondary" href="tel:'+esc(rental.owner_phone)+'">Call owner</a>':"")+'</section></div>'+noticeCard;
  var form=$("gdrRenterMoveoutForm"),messageEl=$("gdrRenterMoveoutMessage");
  if(form)form.addEventListener("submit",async function(e){
   e.preventDefault();var button=form.querySelector('button[type="submit"]'),value=form.elements.moveout.value||null;
   if(!value){if(messageEl)messageEl.textContent="Choose the date you expect to move out.";return;}
   if(value<today){if(messageEl)messageEl.textContent="Choose today or a future date.";return;}
   button.disabled=true;button.textContent="Submitting…";
   try{
    var result=await c().rpc("renter_submit_move_out_notice",{p_occupancy_id:rental.occupancy_id,p_expected_move_out_at:value});
    if(result.error)throw result.error;
    rental.expected_move_out_at=value;
    var dateEl=$("gdrRenterExpectedMoveOut");if(dateEl)dateEl.textContent=date(value);
    var help=$("gdrRenterMoveoutHelp");if(help)help.textContent="Your move-out notice is recorded. The property will show Vacating Soon until the owner confirms the move-out.";
    var badge=document.querySelector(".gdr-moveout-badge");if(badge)badge.textContent="Notice submitted";
    button.textContent="Update notice";
    if(!$("gdrRenterWithdrawMoveout")){
     var withdraw=document.createElement("button");withdraw.type="button";withdraw.id="gdrRenterWithdrawMoveout";withdraw.className="gdr-rental-secondary";withdraw.textContent="Withdraw notice";form.querySelector(".gdr-moveout-actions").appendChild(withdraw);bindWithdraw();
    }
    if(messageEl)messageEl.textContent="Move-out notice sent to your owner. Your tenancy remains active until the owner confirms the move-out.";
   }catch(error){if(messageEl)messageEl.textContent=error.message||"Could not submit the move-out notice. Please try again.";}
   finally{button.disabled=false;}
  });
  function bindWithdraw(){
   var withdraw=$("gdrRenterWithdrawMoveout");if(!withdraw||withdraw.dataset.bound==="1")return;withdraw.dataset.bound="1";
   withdraw.addEventListener("click",async function(){
    if(!confirm("Withdraw your move-out notice? Your tenancy will remain active until the owner confirms the move-out."))return;
    withdraw.disabled=true;
    try{
     var result=await c().rpc("renter_submit_move_out_notice",{p_occupancy_id:rental.occupancy_id,p_expected_move_out_at:null});
     if(result.error)throw result.error;
     rental.expected_move_out_at=null;
     var dateEl=$("gdrRenterExpectedMoveOut");if(dateEl)dateEl.textContent="Not set";
     var help=$("gdrRenterMoveoutHelp");if(help)help.textContent="Your move-out notice was withdrawn. Your tenancy remains active until the owner confirms the move-out.";
     var badge=document.querySelector(".gdr-moveout-badge");if(badge)badge.textContent="Active tenancy";
     withdraw.remove();var submit=form.querySelector('button[type="submit"]');if(submit)submit.textContent="Submit move-out notice";
     if(messageEl)messageEl.textContent="Move-out notice withdrawn.";
    }catch(error){if(messageEl)messageEl.textContent=error.message||"Could not withdraw the move-out notice.";}
    finally{withdraw.disabled=false;}
   });
  }
  bindWithdraw();
 }catch(e){
  t.innerHTML='<div class="gdr-rental-empty"><h4>Could not load your home</h4><p>'+esc(e.message||"Please try again.")+'</p><button class="gdr-rental-secondary" id="gdrRetryHome">Try again</button></div>';
  $("gdrRetryHome").onclick=loadHome;
 }
}
function qrUrl(path){return c().storage.from("owner-payment-qr").getPublicUrl(path).data.publicUrl}
async function loadPayments(){
 var t=$("gdrRenterPaymentsContent");try{
 rental=await getRental();if(!rental){t.innerHTML='<div class="gdr-rental-empty">No active tenancy found.</div>';return}
 var results=await Promise.all([c().from("occupancy_charges").select("id,title,amount,frequency,due_day").eq("occupancy_id",rental.occupancy_id).eq("is_active",true),c().from("owner_payment_settings").select("*").eq("property_id",rental.property_id).maybeSingle(),c().from("rent_payment_records").select("id,billing_period,total_amount,status,utr,created_at,owner_note").eq("occupancy_id",rental.occupancy_id).order("created_at",{ascending:false}).limit(20)]);
 results.forEach(function(x){if(x.error)throw x.error});var charges=results[0].data||[],s=results[1].data||{},payments=results[2].data||[],extra=charges.filter(function(x){return x.frequency==="monthly"}).reduce(function(a,x){return a+Number(x.amount||0)},0);
 var now=new Date(),due=new Date(now.getFullYear(),now.getMonth(),Number(s.due_day||5)),late=now>due?Number(s.late_fee_amount||0):0,total=Number(rental.rent||0)+extra+late,period=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);
 var paid=payments.some(function(x){return x.status==="paid"&&String(x.billing_period).slice(0,7)===period.slice(0,7)}),pending=payments.some(function(x){return x.status==="pending_verification"&&String(x.billing_period).slice(0,7)===period.slice(0,7)});
 t.innerHTML='<div class="gdr-rental-metrics gdr-payment-metrics"><article><small>Base rent</small><strong>'+money(rental.rent)+'</strong></article><article><small>Monthly charges</small><strong>'+money(extra)+'</strong></article><article><small>Late fee</small><strong>'+money(late)+'</strong></article><article class="gdr-payment-total"><small>Total payable</small><strong>'+money(total)+'</strong></article></div><div class="gdr-rental-two-col"><section class="gdr-rental-card"><h4>Current bill · '+now.toLocaleDateString("en-IN",{month:"long",year:"numeric"})+'</h4>'+row("Base rent",money(rental.rent))+charges.filter(function(x){return x.frequency==="monthly"}).map(function(x){return row(x.title,money(x.amount))}).join("")+(late?row("Late fee",money(late)):"")+'<div class="gdr-rental-grand-total">'+row("Total payable",money(total))+'</div><p class="gdr-rental-help">Due date: '+date(due.toISOString().slice(0,10))+'. One-time charges are excluded from recurring monthly total.</p>'+(paid?'<span class="gdr-payment-badge paid">Paid this month</span>':pending?'<span class="gdr-payment-badge pending">Pending owner verification</span>':'<button class="gdr-rental-primary" id="gdrPayNow">Pay this month · '+money(total)+'</button>')+'</section><section class="gdr-rental-card"><h4>Owner payment details</h4>'+(s.upi_qr_path?'<img class="gdr-owner-qr" src="'+esc(qrUrl(s.upi_qr_path))+'" alt="Owner UPI QR">':'<div class="gdr-qr-empty">Owner has not uploaded a QR yet.</div>')+row("Payee",s.payee_name||"Not provided")+row("UPI ID",s.upi_id||"Not provided")+'<p class="gdr-rental-help">'+esc(s.instructions||"Scan with another UPI app and enter the exact payable amount.")+'</p></section></div><section class="gdr-rental-card"><h4>Payment history</h4>'+(payments.length?payments.map(function(p){return '<article class="gdr-payment-history-row"><div><strong>'+date(p.billing_period)+'</strong><small>'+date(p.created_at)+(p.utr?" · UTR "+esc(p.utr):"")+'</small></div><strong>'+money(p.total_amount)+'</strong><span class="gdr-payment-badge '+(p.status==="paid"?"paid":p.status==="rejected"?"rejected":"pending")+'">'+esc(p.status.replaceAll("_"," "))+'</span>'+(p.owner_note?'<p>'+esc(p.owner_note)+'</p>':"")+'</article>'}).join(""):'<p class="gdr-rental-help">No payment submissions yet.</p>')+'</section><section class="gdr-rental-card gdr-payment-submit" id="gdrPaymentSubmit" hidden><h4>Submit payment details</h4><p>After paying in your UPI app, submit the UTR/reference number. The owner must verify receipt.</p><form id="gdrPaymentForm" class="gdr-rental-form"><label>UPI transaction / UTR<input name="utr" required minlength="6" maxlength="30" placeholder="Enter transaction reference"></label><label>Proof image (optional)<input name="proof" type="file" accept="image/png,image/jpeg,image/webp"></label><button class="gdr-rental-primary" type="submit">Submit for verification</button></form></section>';
 $("gdrPayNow")&&($("gdrPayNow").onclick=function(){$("gdrPaymentSubmit").hidden=false;$("gdrPaymentSubmit").scrollIntoView({behavior:"smooth"})});
 $("gdrPaymentForm")&&($("gdrPaymentForm").onsubmit=submitPayment);
 }catch(e){t.innerHTML='<div class="gdr-rental-empty"><h4>Payment details unavailable</h4><p>'+esc(e.message||"Please try again.")+'</p><button class="gdr-rental-secondary" id="gdrRetryPayments">Try again</button></div>';$("gdrRetryPayments").onclick=loadPayments}
}
async function submitPayment(e){
 e.preventDefault();var f=e.currentTarget,btn=f.querySelector("button"),utr=f.elements.utr.value.trim().toUpperCase(),file=f.elements.proof.files[0],proof=null;btn.disabled=true;btn.textContent="Submitting…";
 try{if(!/^[A-Z0-9-]{6,30}$/.test(utr))throw new Error("Enter a valid UTR/reference number.");
 if(file){if(["image/png","image/jpeg","image/webp"].indexOf(file.type)<0||file.size>5242880)throw new Error("Use PNG/JPG/WEBP up to 5 MB.");proof=rental.occupancy_id+"/"+crypto.randomUUID()+"."+(file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg");var up=await c().storage.from("rent-payment-proofs").upload(proof,file);if(up.error)throw up.error}
 var d=new Date();d.setDate(1);var r=await c().rpc("create_rent_payment_submission",{p_occupancy_id:rental.occupancy_id,p_billing_period:d.toISOString().slice(0,10),p_utr:utr,p_proof_path:proof});if(r.error)throw r.error;toast("Payment submitted for owner verification.");loadPayments();
 }catch(err){toast(err.message||"Submission failed.",true)}finally{btn.disabled=false;btn.textContent="Submit for verification"}
}
function addOwner(){
 var root=$("ownerDashboard");if(!root||$("gdrOwnerPaymentsCard"))return;var before=root.querySelector(".owner-inventory-card"),card=document.createElement("section");card.className="dashboard-card gdr-rental-panel";card.id="gdrOwnerPaymentsCard";
 card.innerHTML='<div class="gdr-rental-panel-head"><div><span class="gdr-rental-kicker">RENT COLLECTION</span><h3>My Payments</h3><p>Configure your UPI QR and review renter payment submissions.</p></div><span class="gdr-rental-secure">Owner workspace</span></div><div class="gdr-owner-payment-grid"><section class="gdr-rental-card"><h4>Payment settings</h4><div id="gdrOwnerPaymentSettings">Loading properties…</div></section><section class="gdr-rental-card"><h4>Payment activity</h4><div id="gdrOwnerPaymentActivity">Loading activity…</div></section></div>';
 if(before)root.insertBefore(card,before);else root.appendChild(card)
}
async function loadOwnerPayments(){
 var target=$("gdrOwnerPaymentSettings");if(!target||!c())return;var activity=$("gdrOwnerPaymentActivity");
 try{var auth=await c().auth.getUser();if(!auth.data.user)throw new Error("Sign in again.");var o=await c().from("owners").select("id").eq("user_id",auth.data.user.id).maybeSingle();if(o.error)throw o.error;if(!o.data)throw new Error("Owner profile not found.");owner=o.data;
 var p=await c().from("properties").select("id,title,name,rent").eq("owner_id",owner.id);if(p.error)throw p.error;props=p.data||[];if(!props.length){target.textContent="Add a property to configure rent collection.";return}
 target.innerHTML='<form id="gdrOwnerPaymentForm" class="gdr-rental-form"><label>Property<select name="property">'+props.map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.title||x.name||"Property")+' · '+money(x.rent)+'</option>'}).join("")+'</select></label><div id="gdrOwnerQrPreview" class="gdr-owner-qr-preview"></div><label>Upload UPI QR<input type="file" name="qr" accept="image/png,image/jpeg,image/webp"></label><label>UPI ID (optional)<input name="upi" maxlength="120" placeholder="name@upi"></label><label>Payee name<input name="payee" maxlength="120"></label><label>Payment instructions<textarea name="instructions" rows="3" maxlength="500"></textarea></label><div class="gdr-rental-field-grid"><label>Due day<input name="due" type="number" min="1" max="28" value="5"></label><label>Late fee ₹<input name="late" type="number" min="0" max="100000" step=".01" value="0"></label><label>Grace days<input name="grace" type="number" min="0" max="30" value="0"></label></div><button class="gdr-rental-primary" type="submit">Save payment settings</button><p class="gdr-rental-help">Static QR payments remain pending until you confirm receipt.</p></form>';
 async function loadSettings(){var f=$("gdrOwnerPaymentForm"),id=f.elements.property.value,s=await c().from("owner_payment_settings").select("*").eq("property_id",id).maybeSingle();if(s.error)throw s.error;settings=s.data||null;f.elements.upi.value=settings?.upi_id||"";f.elements.payee.value=settings?.payee_name||"";f.elements.instructions.value=settings?.instructions||"";f.elements.due.value=settings?.due_day||5;f.elements.late.value=settings?.late_fee_amount||0;f.elements.grace.value=settings?.late_fee_grace_days||0;$("gdrOwnerQrPreview").innerHTML=settings?.upi_qr_path?'<img src="'+esc(qrUrl(settings.upi_qr_path))+'" alt="Saved QR"><button type="button" class="gdr-rental-secondary" id="gdrRemoveOwnerQr">Remove QR</button>':"No QR uploaded yet";var remove=$("gdrRemoveOwnerQr");if(remove)remove.onclick=async function(){var d=await c().from("owner_payment_settings").update({upi_qr_path:null}).eq("property_id",id);if(d.error){toast(d.error.message,true);return}settings={...settings,upi_qr_path:null};await loadSettings();toast("QR removed.")}}
 $("gdrOwnerPaymentForm").elements.property.onchange=loadSettings;await loadSettings();$("gdrOwnerPaymentForm").onsubmit=saveSettings;
 var q=await c().from("rent_payment_records").select("id,billing_period,total_amount,status,utr,created_at,occupancy_id,property_occupancies(renter_name,properties(title,name))").eq("owner_id",owner.id).order("created_at",{ascending:false}).limit(30);if(q.error)throw q.error;
 activity.innerHTML=q.data.length?q.data.map(function(p){return '<article class="gdr-owner-payment-row"><div><strong>'+esc(p.property_occupancies?.renter_name||"Renter")+"</strong><small>"+esc(p.property_occupancies?.properties?.title||p.property_occupancies?.properties?.name||"Property")+" · "+date(p.billing_period)+" · "+esc(p.utr)+'</small></div><strong>'+money(p.total_amount)+'</strong><span class="gdr-payment-badge '+(p.status==="paid"?"paid":p.status==="rejected"?"rejected":"pending")+'">'+esc(p.status.replaceAll("_"," "))+'</span>'+(p.status==="pending_verification"?'<div class="gdr-owner-payment-actions"><button class="gdr-rental-primary" data-verify="'+esc(p.id)+'">Confirm received</button><button class="gdr-rental-secondary" data-reject="'+esc(p.id)+'">Reject</button></div>':"")+'</article>'}).join(""):'<p class="gdr-rental-help">No renter payment submissions yet.</p>';
 activity.querySelectorAll("[data-verify]").forEach(function(b){b.onclick=function(){verify(b.dataset.verify,"paid")}});
 activity.querySelectorAll("[data-reject]").forEach(function(b){b.onclick=function(){var n=prompt("Reason for rejection (optional):");if(n!==null)verify(b.dataset.reject,"rejected",n)}});
 }catch(e){target.innerHTML='<p class="gdr-rental-help">'+esc(e.message||"Unable to load payment settings.")+'</p>';if(activity)activity.innerHTML=""}
}
async function saveSettings(e){
 e.preventDefault();var f=e.currentTarget,btn=f.querySelector("button"),id=f.elements.property.value,qr=settings?.upi_qr_path||null,file=f.elements.qr.files[0];btn.disabled=true;btn.textContent="Saving…";
 try{if(file){if(["image/png","image/jpeg","image/webp"].indexOf(file.type)<0||file.size>5242880)throw new Error("Use PNG/JPG/WEBP up to 5 MB.");var ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";qr=owner.id+"/"+id+"/upi-qr."+ext;var up=await c().storage.from("owner-payment-qr").upload(qr,file,{upsert:true,contentType:file.type});if(up.error)throw up.error}
 var payload={owner_id:owner.id,property_id:id,upi_qr_path:qr,upi_id:f.elements.upi.value.trim()||null,payee_name:f.elements.payee.value.trim()||null,instructions:f.elements.instructions.value.trim()||null,due_day:Number(f.elements.due.value||5),late_fee_amount:Number(f.elements.late.value||0),late_fee_grace_days:Number(f.elements.grace.value||0)};
 var s=await c().from("owner_payment_settings").upsert(payload,{onConflict:"property_id"});if(s.error)throw s.error;toast("Payment settings saved.");loadOwnerPayments()
 }catch(e){toast(e.message||"Could not save settings.",true)}finally{btn.disabled=false;btn.textContent="Save payment settings"}
}
async function verify(id,decision,note){var r=await c().rpc("owner_verify_rent_payment",{p_payment_id:id,p_decision:decision,p_note:note||null});if(r.error){toast(r.error.message,true);return}toast(decision==="paid"?"Payment confirmed.":"Payment rejected.");loadOwnerPayments()}
function addOwnerNearbyAction(){
 var root=$("ownerDashboard");if(!root||root.querySelector(".gdr-owner-nearby-entry")||$("gdrOwnerNearbyCard"))return;
 var card=document.createElement("section");card.id="gdrOwnerNearbyCard";card.className="dashboard-card gdr-owner-nearby-launch";
 card.innerHTML='<div class="gdr-owner-nearby-launch-copy"><span class="gdr-owner-nearby-launch-icon">⌂</span><span><b>Nearby Properties</b><small>Explore available rental homes within 5 KM of your property.</small></span></div><button type="button" id="gdrOwnerNearbyOpen">Open nearby map →</button>';
 var before=root.querySelector(".owner-inventory-card")||root.firstElementChild;
 if(before)root.insertBefore(card,before);else root.appendChild(card);
 $("gdrOwnerNearbyOpen").addEventListener("click",function(){
  function launch(){
   var api=window.GDRMapExperience;
   if(!api||typeof api.openOwnerNearbyMap!=="function")throw new Error("Nearby map module is unavailable.");
   return api.openOwnerNearbyMap();
  }
  try{
   if(window.GDRMapExperience&&typeof window.GDRMapExperience.openOwnerNearbyMap==="function"){
    Promise.resolve(launch()).catch(function(error){console.error("Owner nearby map failed:",error);toast(error&&error.message||"Nearby map could not be opened.",true);});
    return;
   }
   if(!window.__gdrMapExperienceLoadPromise){
    window.__gdrMapExperienceLoadPromise=new Promise(function(resolve,reject){
     var script=document.createElement("script");
     script.src="/assets/gdr-map-experience.js?owner-nearby-retry=1";
     script.async=true;
     script.onload=resolve;
     script.onerror=function(){reject(new Error("Nearby map module failed to load."));};
     document.head.appendChild(script);
    });
   }
   window.__gdrMapExperienceLoadPromise.then(function(){return launch();}).catch(function(error){console.error("Owner nearby map failed:",error);toast(error&&error.message||"Nearby map could not be opened.",true);});
  }catch(error){console.error("Owner nearby map failed:",error);toast(error&&error.message||"Nearby map could not be opened.",true);}
 });
}
function boot(){addRenter();addOwnerNearbyAction();var obsoleteOwnerPayments=$("gdrOwnerPaymentsCard");if(obsoleteOwnerPayments)obsoleteOwnerPayments.remove();}
document.addEventListener("click",function(event){
 var target=event.target&&event.target.closest?event.target.closest("#ownerDashboard button,#ownerDashboard a,#ownerDashboard [role='button']"):null;
 if(!target||target.id==="gdrOwnerNearbyOpen")return;
 if(!/nearby\s+properties|near\s+by\s+properties/i.test(String(target.innerText||target.textContent||"")))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(window.GDRMapExperience&&typeof window.GDRMapExperience.openOwnerNearbyMap==="function")window.GDRMapExperience.openOwnerNearbyMap();
 else toast("Nearby map is loading. Please try again in a moment.",true);
},true);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
// The v2 rental suite owns dashboard mutation handling. Avoid a second page-wide observer.
})();
// Cache release: renter move-out notice v3.
