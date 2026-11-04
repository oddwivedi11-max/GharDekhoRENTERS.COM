(function(){
"use strict";
const $=id=>document.getElementById(id), esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>"₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(Number(v||0));
const db=()=>window.__gdrSupabaseClient||window.supabaseClient||null;
let active=null,busy=false;
function style(){
 if($("gdr-renter-ledger-css"))return;
 const s=document.createElement("style");s.id="gdr-renter-ledger-css";
 s.textContent=".gdr-ledger-card{grid-column:1/-1;padding:20px;border:1px solid #e0e9e5;border-radius:19px;background:#fff;box-shadow:0 8px 24px #183b3508;min-width:0}.gdr-ledger-card h2{margin:0 0 6px;font-size:17px;color:#183b35}.gdr-ledger-sub{font-size:12px;color:#72827c;margin:0 0 14px}.gdr-ledger-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}.gdr-ledger-stat{padding:13px;border:1px solid #e6eee9;border-radius:13px;background:#f8fbf9}.gdr-ledger-stat small{display:block;color:#73827c;font-size:11px}.gdr-ledger-stat strong{display:block;margin-top:5px;font-size:19px;color:#183b35}.gdr-ledger-month{padding:13px 0;border-top:1px solid #edf1ef}.gdr-ledger-month header{display:flex;justify-content:space-between;gap:10px}.gdr-ledger-month header b{font-size:14px}.gdr-ledger-due{font-weight:900;color:#b45a34}.gdr-ledger-paid{font-weight:900;color:#18734d}.gdr-ledger-break{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:9px 0}.gdr-ledger-break span{padding:8px;border-radius:9px;background:#f7faf8;color:#71817a;font-size:10px}.gdr-ledger-break strong{display:block;color:#25463e;font-size:12px;margin-top:3px}.gdr-ledger-entry{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;margin-top:5px;background:#f3f8f5;border-radius:9px;font-size:12px}.gdr-ledger-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px;border-radius:14px;background:#f7faf8;margin-top:12px}.gdr-ledger-form label{display:grid;gap:5px;font-size:11px;font-weight:800;color:#50685f}.gdr-ledger-form input,.gdr-ledger-form select,.gdr-ledger-form textarea{width:100%;min-height:42px;padding:9px 11px;border:1px solid #cfddd7;border-radius:10px;background:white;color:#173b35}.gdr-ledger-full{grid-column:1/-1}.gdr-ledger-btn{min-height:42px;padding:0 14px;border:1px solid #176b5e;border-radius:11px;background:#176b5e;color:white;font-weight:850}.gdr-ledger-note{font-size:11px;color:#7b8983;line-height:1.5;margin:9px 0 0}@media(max-width:650px){.gdr-ledger-card{padding:15px}.gdr-ledger-stats{grid-template-columns:1fr 1fr}.gdr-ledger-break{grid-template-columns:1fr 1fr}.gdr-ledger-form{grid-template-columns:1fr}.gdr-ledger-full{grid-column:auto}}";
 document.head.appendChild(s);
}
function rowFor(id){return (window.__gdCurrentRenters||[]).find(x=>String(x.id)===String(id));}
function key(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01";}
function label(k){return new Date(k+"T00:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"});}
function build(row,settings,charges,records,entries){
 const now=new Date(),start=row.occupied_at?new Date(row.occupied_at):new Date(now.getFullYear(),now.getMonth(),1),months=[];
 let cur=new Date(start.getFullYear(),start.getMonth(),1),end=new Date(now.getFullYear(),now.getMonth(),1);
 while(cur<=end&&months.length<36){months.push(new Date(cur));cur.setMonth(cur.getMonth()+1);}
 months.reverse();
 const rent=Number(row.property&&row.property.rent||0),day=Number(settings.due_day||5),grace=Number(settings.late_fee_grace_days||0),fee=Number(settings.late_fee_amount||0);
 const rows=months.map(d=>{
  const k=key(d),m=k.slice(0,7),monthly=charges.filter(x=>x.is_active&&x.frequency==="monthly").reduce((a,x)=>a+Number(x.amount||0),0),once=charges.filter(x=>x.is_active&&x.frequency==="one_time"&&String(x.created_at||"").slice(0,7)===m).reduce((a,x)=>a+Number(x.amount||0),0);
  const paidA=records.filter(x=>x.billing_period===k&&x.status==="paid").reduce((a,x)=>a+Number(x.total_amount||0),0),paidB=entries.filter(x=>x.billing_period===k).reduce((a,x)=>a+Number(x.amount||0),0),paid=paidA+paidB,base=rent+monthly+once;
  const due=new Date(d.getFullYear(),d.getMonth(),Math.min(day,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()));due.setDate(due.getDate()+grace);
  const late=fee&&now>due&&paid<base?fee:0,total=base+late,balance=Math.max(0,total-paid);
  return {k:k,label:label(k),rent:rent,extra:monthly+once,late:late,paid:paid,balance:balance,entries:entries.filter(x=>x.billing_period===k),submissions:records.filter(x=>x.billing_period===k)};
 });
 const received=rows.reduce((a,x)=>a+x.paid,0),outstanding=rows.reduce((a,x)=>a+x.balance,0),current=rows[0]||{balance:0};
 let html='<section class="gdr-ledger-card" id="gdrRenterLedger"><div class="gdr-rp-eyebrow">RENT COLLECTION</div><h2>Monthly rent ledger</h2><p class="gdr-ledger-sub">Month-wise rent, partial receipts and outstanding balance for this tenancy</p><div class="gdr-ledger-stats"><div class="gdr-ledger-stat"><small>Outstanding balance</small><strong>'+money(outstanding)+'</strong></div><div class="gdr-ledger-stat"><small>Total received</small><strong>'+money(received)+'</strong></div><div class="gdr-ledger-stat"><small>Current month due</small><strong>'+money(current.balance)+'</strong></div></div><h2>Monthly statement</h2>';
 rows.forEach(x=>{
  html+='<article class="gdr-ledger-month"><header><b>'+esc(x.label)+'</b><span class="'+(x.balance>0?"gdr-ledger-due":"gdr-ledger-paid")+'">'+(x.balance>0?money(x.balance)+" due":"Settled")+'</span></header><div class="gdr-ledger-break"><span>Base rent<strong>'+money(x.rent)+'</strong></span><span>Extra charges<strong>'+money(x.extra)+'</strong></span><span>Late fee<strong>'+money(x.late)+'</strong></span><span>Received<strong>'+money(x.paid)+'</strong></span></div>';
  x.entries.forEach(e=>{html+='<div class="gdr-ledger-entry"><span>'+esc(e.payment_method)+' · '+new Date(e.received_at||e.created_at).toLocaleDateString("en-IN")+(e.reference?" · "+esc(e.reference):"")+'</span><b>'+money(e.amount)+'</b></div>';});
  x.submissions.filter(p=>p.status!=="paid").forEach(p=>{html+='<div class="gdr-ledger-entry"><span>Renter submission · '+(p.status==="pending_verification"?"Awaiting verification":"Rejected")+'</span><b>'+money(p.total_amount)+'</b></div>';});
  html+='</article>';
 });
 html+='<h2 style="margin-top:20px">Record rent received</h2><p class="gdr-ledger-sub">Add full or partial receipts paid directly to you</p><form id="gdrLedgerReceiptForm" class="gdr-ledger-form"><label>Billing month<select name="period">'+rows.map(x=>'<option value="'+x.k+'">'+esc(x.label)+'</option>').join("")+'</select></label><label>Amount received (₹)<input name="amount" type="number" min="1" max="10000000" step=".01" required placeholder="e.g. 5000"></label><label>Payment method<select name="method"><option value="upi">UPI</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></label><label>Reference / transaction ID<input name="reference" maxlength="100" placeholder="Optional"></label><label class="gdr-ledger-full">Note<textarea name="note" maxlength="300" rows="2" placeholder="Optional note"></textarea></label><div class="gdr-ledger-full"><button class="gdr-ledger-btn" type="submit">+ Save payment receipt</button></div></form><p class="gdr-ledger-note">Receipts are append-only audit records. Repeated requests are blocked by a unique request key. Verified renter UPI submissions are also included.</p></section>';
 html+='<section class="gdr-ledger-card"><div class="gdr-rp-eyebrow">RENT RULES</div><h2>Due date & late-fee policy</h2><p class="gdr-ledger-sub">Configure the monthly due day, grace period and late fee for this property</p><form id="gdrLedgerSettingsForm" class="gdr-ledger-form"><label>Due day (1–28)<input name="due_day" type="number" min="1" max="28" value="'+Number(settings.due_day||5)+'"></label><label>Late fee (₹)<input name="late_fee_amount" type="number" min="0" max="100000" step=".01" value="'+Number(settings.late_fee_amount||0)+'"></label><label>Grace days<input name="late_fee_grace_days" type="number" min="0" max="30" value="'+Number(settings.late_fee_grace_days||0)+'"></label><div class="gdr-ledger-full"><button class="gdr-ledger-btn" type="submit">Save rent rules</button></div></form><p class="gdr-ledger-note">Late fees are calculated after the due date plus grace days, while a balance remains. This is a recordkeeping aid, not legal advice.</p></section>';
 return html;
}
async function load(row){
 const c=db();if(!c)return;
 const result=await Promise.all([
  c.from("occupancy_charges").select("id,amount,frequency,is_active,created_at").eq("occupancy_id",row.id),
  c.from("owner_payment_settings").select("id,owner_id,property_id,due_day,late_fee_amount,late_fee_grace_days").eq("property_id",row.property_id).maybeSingle(),
  c.from("rent_payment_records").select("id,billing_period,total_amount,status").eq("occupancy_id",row.id),
  c.from("owner_rent_ledger_entries").select("id,billing_period,amount,payment_method,reference,received_at,created_at").eq("occupancy_id",row.id).order("received_at",{ascending:false})
 ]);
 result.forEach(x=>{if(x.error)throw x.error;});
 const charges=result[0].data||[],settings=result[1].data||{},records=result[2].data||[],entries=result[3].data||[];
 const host=$("gdrOwnerRenterPage"),grid=host&&host.querySelector(".gdr-rp-grid");if(!grid||active!==String(row.id))return;
 host.querySelectorAll(".gdr-ledger-card").forEach(x=>x.remove());grid.insertAdjacentHTML("beforeend",build(row,settings,charges,records,entries));
 $("gdrLedgerReceiptForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(busy)return;const f=e.currentTarget,amount=Number(f.elements.amount.value);if(!Number.isFinite(amount)||amount<=0)return;
  busy=true;const b=f.querySelector("button");b.disabled=true;b.textContent="Saving…";
  try{const r=await c.rpc("owner_add_rent_ledger_payment",{p_occupancy_id:row.id,p_billing_period:f.elements.period.value,p_amount:amount,p_payment_method:f.elements.method.value,p_reference:f.elements.reference.value.trim()||null,p_note:f.elements.note.value.trim()||null,p_idempotency_key:crypto.randomUUID()});if(r.error)throw r.error;await load(row);const n=$("gdrRpMessage");if(n)n.textContent="Payment receipt saved.";}
  catch(err){const n=$("gdrRpMessage");if(n)n.textContent=err.message||"Could not save receipt.";}finally{busy=false;}
 });
 $("gdrLedgerSettingsForm")?.addEventListener("submit",async e=>{
  e.preventDefault();if(busy)return;const f=e.currentTarget,due=Number(f.elements.due_day.value),fee=Number(f.elements.late_fee_amount.value),grace=Number(f.elements.late_fee_grace_days.value);
  if(!Number.isInteger(due)||due<1||due>28||!Number.isFinite(fee)||fee<0||!Number.isInteger(grace)||grace<0||grace>30){const n=$("gdrRpMessage");if(n)n.textContent="Check due day, fee and grace period.";return;}
  busy=true;try{const a=await c.auth.getUser();if(a.error||!a.data.user)throw Error("Please sign in again.");const o=await c.from("owners").select("id").eq("user_id",a.data.user.id).maybeSingle();if(o.error||!o.data)throw Error("Owner profile not found.");const r=await c.from("owner_payment_settings").upsert({owner_id:o.data.id,property_id:row.property_id,due_day:due,late_fee_amount:fee,late_fee_grace_days:grace,updated_at:new Date().toISOString()},{onConflict:"property_id"});if(r.error)throw r.error;await load(row);const n=$("gdrRpMessage");if(n)n.textContent="Rent rules updated.";}
  catch(err){const n=$("gdrRpMessage");if(n)n.textContent=err.message||"Could not save rent rules.";}finally{busy=false;}
 });
}
function mount(){const id=new URL(location.href).searchParams.get("ownerRenter");if(!id){active=null;return;}if(id===active&&$("gdrRenterLedger"))return;const row=rowFor(id),host=$("gdrOwnerRenterPage");if(!row||!host)return;active=String(id);style();load(row).catch(e=>{const n=$("gdrRpMessage");if(n)n.textContent="Rent ledger unavailable: "+(e.message||"database access error");});}
const observer=new MutationObserver(mount);
function start(){if(document.body)observer.observe(document.body,{childList:true,subtree:true});mount();}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();