(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = v => "₹" + new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(Number(v||0));
  const dateText = v => { if(!v) return "Not set"; const d=new Date(v+"T00:00:00"); return Number.isNaN(d.getTime())?"Not set":d.toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}); };
  let currentId = null, page = null, priorTitle = document.title, loading = false;
  const client = () => window.__gdrSupabaseClient || window.supabaseClient || null;
  const rowFor = id => (window.__gdCurrentRenters||[]).find(r=>String(r.id)===String(id));
  function ensureStyles(){
    if($("gdr-renter-page-style")) return;
    const style=document.createElement("style");style.id="gdr-renter-page-style";
    style.textContent=`
      #gdrOwnerRenterPage{position:fixed;inset:0;z-index:100000;background:#f5f8f6;overflow:auto;color:#183b35;font-family:inherit}
      #gdrOwnerRenterPage *{box-sizing:border-box}
      .gdr-rp-shell{width:min(100%,1000px);margin:0 auto;padding:20px 18px 56px}
      .gdr-rp-top{display:flex;align-items:center;gap:14px;padding:8px 0 22px}
      .gdr-rp-back{min-height:44px;padding:0 16px;border:1px solid #d6e4df;border-radius:13px;background:#fff;color:#174a43;font-weight:800}
      .gdr-rp-eyebrow{font-size:11px;font-weight:900;letter-spacing:.13em;color:#66817a}
      .gdr-rp-hero{display:flex;align-items:center;gap:18px;padding:25px;border:1px solid #dce9e4;border-radius:24px;background:linear-gradient(135deg,#fff,#edf7f3);box-shadow:0 16px 40px #173b3510}
      .gdr-rp-avatar{width:64px;height:64px;display:grid;place-items:center;flex:0 0 64px;border-radius:20px;background:#176b5e;color:white;font-size:26px;font-weight:900}
      .gdr-rp-hero h1{margin:3px 0 5px;font-size:clamp(24px,5vw,36px);letter-spacing:-.04em;line-height:1.08}
      .gdr-rp-hero p{margin:0;color:#657a74;font-size:14px}
      .gdr-rp-status{margin-left:auto;align-self:flex-start;padding:7px 11px;border-radius:99px;background:#e7f6ed;color:#167246;font-size:11px;font-weight:900;white-space:nowrap}
      .gdr-rp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}
      .gdr-rp-card{min-width:0;padding:20px;border:1px solid #e0e9e5;border-radius:19px;background:white;box-shadow:0 8px 24px #183b3508}
      .gdr-rp-card h2{margin:0 0 14px;font-size:16px;letter-spacing:-.02em}
      .gdr-rp-stat{display:flex;justify-content:space-between;gap:14px;padding:11px 0;border-top:1px solid #edf1ef;font-size:13px}
      .gdr-rp-stat span{color:#71827c}.gdr-rp-stat strong{text-align:right;overflow-wrap:anywhere}
      .gdr-rp-wide{grid-column:1/-1}
      .gdr-rp-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}
      .gdr-rp-btn{min-height:44px;padding:0 15px;border:1px solid #d5e3dd;border-radius:12px;background:#fff;color:#174a43;font-weight:850}
      .gdr-rp-btn.primary{background:#176b5e;border-color:#176b5e;color:white}
      .gdr-rp-btn.danger{border-color:#f1d2d2;color:#a33232}
      .gdr-rp-form{display:grid;gap:11px;margin-top:14px;padding:16px;border-radius:15px;background:#f7faf8}
      .gdr-rp-form label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#4c665f}
      .gdr-rp-form input,.gdr-rp-form select{width:100%;min-height:44px;padding:9px 12px;border:1px solid #cfddd7;border-radius:11px;background:white;color:#173b35}
      .gdr-rp-charge{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 0;border-top:1px solid #edf1ef}
      .gdr-rp-charge small{display:block;color:#788780;margin-top:3px}
      .gdr-rp-note{margin:12px 0 0;color:#74847e;font-size:12px;line-height:1.5}
      .gdr-rp-message{min-height:18px;margin:4px 0;color:#a04427;font-size:12px}
      @media(max-width:650px){.gdr-rp-shell{padding:12px 12px 36px}.gdr-rp-hero{align-items:flex-start;flex-wrap:wrap;padding:18px}.gdr-rp-status{margin-left:0}.gdr-rp-grid{grid-template-columns:1fr}.gdr-rp-wide{grid-column:auto}.gdr-rp-card{padding:16px}.gdr-rp-actions{display:grid;grid-template-columns:1fr}.gdr-rp-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }
  function mount(row){
    ensureStyles(); currentId=String(row.id); priorTitle=document.title;
    if(!page){page=document.createElement("section");page.id="gdrOwnerRenterPage";document.body.appendChild(page);}
    const p=row.property||{}, start=row.occupied_at?new Date(row.occupied_at):null;
    const startText=start&&!Number.isNaN(start.getTime())?start.toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}):"Not recorded";
    const rent=Number(p.rent||0);
    page.innerHTML=`<div class="gdr-rp-shell">
      <div class="gdr-rp-top"><button class="gdr-rp-back" type="button" data-rp-back>← Back to Current Renters</button><div><div class="gdr-rp-eyebrow">OWNER WORKSPACE</div><div style="font-weight:900">Renter profile</div></div></div>
      <header class="gdr-rp-hero"><div class="gdr-rp-avatar">${esc((row.renter_name||"R").trim().charAt(0).toUpperCase())}</div><div style="min-width:0;flex:1"><div class="gdr-rp-eyebrow">ACTIVE TENANCY</div><h1>${esc(row.renter_name||"Renter")}</h1><p>${esc(p.title||p.name||"Rental property")} · ${esc(p.address||p.location||"Address not available")}</p></div><span class="gdr-rp-status">● Active</span></header>
      <div class="gdr-rp-grid">
        <section class="gdr-rp-card"><h2>Rental timeline</h2>
          <div class="gdr-rp-stat"><span>Move-in date</span><strong>${esc(startText)}</strong></div>
          <div class="gdr-rp-stat"><span>Expected move-out</span><strong id="gdrRpMoveOut">Loading…</strong></div>
          <div class="gdr-rp-stat"><span>Time in property</span><strong>${esc(start?duration(start):"Not recorded")}</strong></div>
          <div class="gdr-rp-actions"><button class="gdr-rp-btn" type="button" id="gdrRpEditDates">Edit move-out date</button></div>
          <form class="gdr-rp-form" id="gdrRpDatesForm" hidden><label>Expected move-out date<input type="date" name="moveout"></label><div class="gdr-rp-actions"><button class="gdr-rp-btn primary" type="submit">Save date</button><button class="gdr-rp-btn" type="button" data-cancel-form>Cancel</button></div></form>
        </section>
        <section class="gdr-rp-card"><h2>Rental & contact</h2>
          <div class="gdr-rp-stat"><span>Monthly base rent</span><strong>${money(rent)}</strong></div>
          <div class="gdr-rp-stat"><span>Renter phone</span><strong>${esc(row.renter_phone||"Not provided")}</strong></div>
          <div class="gdr-rp-stat"><span>Property type</span><strong>${esc(p.listing_type||"Rental")}</strong></div>
          <div class="gdr-rp-actions"><button class="gdr-rp-btn" type="button" id="gdrRpEditContact">Edit renter details</button></div>
          <form class="gdr-rp-form" id="gdrRpContactForm" hidden><label>Renter name<input name="name" maxlength="120" required value="${esc(row.renter_name||"")}"></label><label>Phone number<input name="phone" inputmode="numeric" maxlength="10" pattern="[6-9][0-9]{9}" value="${esc(String(row.renter_phone||"").replace("+91","").trim())}"></label><div class="gdr-rp-actions"><button class="gdr-rp-btn primary" type="submit">Save renter details</button><button class="gdr-rp-btn" type="button" data-cancel-form>Cancel</button></div></form>
        </section>
        <section class="gdr-rp-card gdr-rp-wide"><h2>Monthly charges</h2><div class="gdr-rp-stat"><span>Base monthly rent</span><strong>${money(rent)}</strong></div><div id="gdrRpCharges"><p class="gdr-rp-note">Loading additional charges…</p></div>
          <div class="gdr-rp-actions"><button class="gdr-rp-btn primary" type="button" id="gdrRpAddCharge">+ Add charge</button></div>
          <form class="gdr-rp-form" id="gdrRpChargeForm" hidden><label>Charge name<input name="title" maxlength="100" placeholder="e.g. Maintenance" required></label><label>Amount (₹)<input name="amount" type="number" min="1" max="10000000" step="0.01" required></label><label>Frequency<select name="frequency"><option value="monthly">Every month</option><option value="one_time">One-time</option></select></label><label>Monthly due day (optional)<input name="due_day" type="number" min="1" max="28" placeholder="1–28"></label><div class="gdr-rp-actions"><button class="gdr-rp-btn primary" type="submit">Save charge</button><button class="gdr-rp-btn" type="button" data-cancel-form>Cancel</button></div></form>
          <p class="gdr-rp-note">Additional charges are shown separately from base rent. This page does not collect payments or mark invoices as paid.</p>
        </section>
      </div><p class="gdr-rp-message" id="gdrRpMessage" aria-live="polite"></p>
      <div class="gdr-rp-actions"><button class="gdr-rp-btn danger" id="gdrRpRelease" type="button">Release renter</button></div>
    </div>`;
    page.querySelector("[data-rp-back]").addEventListener("click",back);
    page.querySelectorAll("[data-cancel-form]").forEach(b=>b.addEventListener("click",()=>{const f=b.closest("form");if(f)f.hidden=true;}));
    $("gdrRpEditDates").addEventListener("click",()=>{$("gdrRpDatesForm").hidden=false;});
    $("gdrRpEditContact").addEventListener("click",()=>{$("gdrRpContactForm").hidden=false;});
    $("gdrRpAddCharge").addEventListener("click",()=>{$("gdrRpChargeForm").hidden=false;});
    $("gdrRpDatesForm").addEventListener("submit",e=>saveMoveOut(e,row));
    $("gdrRpContactForm").addEventListener("submit",e=>saveContact(e,row));
    $("gdrRpChargeForm").addEventListener("submit",e=>saveCharge(e,row));
    $("gdrRpRelease").addEventListener("click",()=>release(row));
    document.title="Renter profile | GharDekho";
    loadMoveOut(row);loadCharges(row);
  }
  function duration(start){const now=new Date();let m=(now.getFullYear()-start.getFullYear())*12+now.getMonth()-start.getMonth();if(now.getDate()<start.getDate())m--;return m>0?m+" month"+(m===1?"":"s"):Math.max(0,Math.floor((now-start)/86400000))+" days";}
  function message(t){const n=$("gdrRpMessage");if(n)n.textContent=t||"";}
  async function loadMoveOut(row){
    const c=client();if(!c){$("gdrRpMoveOut").textContent="Unavailable";return;}
    const r=await c.from("property_occupancies").select("expected_move_out_at").eq("id",row.id).maybeSingle();
    if(r.error){$("gdrRpMoveOut").textContent="Not set";$("gdrRpDatesForm").querySelector("button[type=submit]").disabled=true;$("gdrRpEditDates").disabled=true;return;}
    $("gdrRpMoveOut").textContent=dateText(r.data?.expected_move_out_at);
    $("gdrRpDatesForm").elements.moveout.value=r.data?.expected_move_out_at||"";
  }
  async function saveMoveOut(e,row){
    e.preventDefault();const c=client();if(!c)return;
    const value=e.currentTarget.elements.moveout.value||null;
    const r=await c.from("property_occupancies").update({expected_move_out_at:value}).eq("id",row.id).is("released_at",null);
    if(r.error){message("Could not save the expected move-out date. Apply the owner renter-management database migration first.");return;}
    $("gdrRpMoveOut").textContent=dateText(value);e.currentTarget.hidden=true;message("Move-out date saved.");
  }
  async function saveContact(e,row){
    e.preventDefault();const c=client();const f=e.currentTarget,name=f.elements.name.value.trim(),phone=f.elements.phone.value.trim();
    if(!name||phone&&!/^[6-9][0-9]{9}$/.test(phone)){message("Enter a valid name and 10-digit Indian mobile number.");return;}
    const r=await c.rpc("update_my_current_renter_contact",{p_occupancy_id:row.id,p_renter_name:name,p_renter_phone:phone||null});
    if(r.error){message(r.error.message||"Could not update renter details.");return;}
    row.renter_name=name;row.renter_phone=phone||null;f.hidden=true;mount(row);message("Renter details updated successfully.");
  }
  async function loadCharges(row){
    const c=client();if(!c)return;
    const r=await c.from("occupancy_charges").select("id,title,amount,frequency,due_day,is_active").eq("occupancy_id",row.id).eq("is_active",true).order("created_at",{ascending:false});
    const target=$("gdrRpCharges");if(!target)return;
    if(r.error){target.innerHTML='<p class="gdr-rp-note">Additional charge management will become available after the owner renter-management database migration is applied. Base rent remains available above.</p>';$("gdrRpAddCharge").disabled=true;return;}
    if(!r.data?.length){target.innerHTML='<p class="gdr-rp-note">No additional charges have been added.</p>';return;}
    target.innerHTML=r.data.map(x=>'<div class="gdr-rp-charge"><div><strong>'+esc(x.title)+'</strong><small>'+(x.frequency==="monthly"?"Monthly":"One-time")+(x.due_day?" · Due day "+x.due_day:"")+'</small></div><strong>'+money(x.amount)+'</strong></div>').join("");
  }
  async function saveCharge(e,row){
    e.preventDefault();const c=client(),f=e.currentTarget;
    const title=f.elements.title.value.trim(),amount=Number(f.elements.amount.value),frequency=f.elements.frequency.value,due=f.elements.due_day.value?Number(f.elements.due_day.value):null;
    if(title.length<2||!Number.isFinite(amount)||amount<=0||due!==null&&(!Number.isInteger(due)||due<1||due>28)){message("Check the charge name, amount and due day.");return;}
    const ownerLookup=await c.from("property_occupancies").select("owner_id").eq("id",row.id).maybeSingle();if(ownerLookup.error||!ownerLookup.data?.owner_id){message("Could not verify the property owner for this renter.");return;}
    const r=await c.from("occupancy_charges").insert({occupancy_id:row.id,owner_id:ownerLookup.data.owner_id,title,amount,frequency,due_day:frequency==="monthly"?due:null});
    if(r.error){message("Could not save charge. Confirm the database migration has been applied.");return;}
    f.reset();f.hidden=true;await loadCharges(row);message("Charge added.");
  }
  async function release(row){
    if(!confirm("Release this renter and mark the property available again?"))return;
    const c=client();const r=await c.rpc("release_property_occupancy",{p_property_id:row.property_id});
    if(r.error){message(r.error.message||"Unable to release this renter.");return;}
    back();await Promise.allSettled([window.loadOwnerProperties?.(),window.loadOwnerVisits?.()]);
  }
  function back(){if(page)page.remove();page=null;document.title=priorTitle;currentId=null;if(new URL(location.href).searchParams.has("ownerRenter")){const u=new URL(location.href);u.searchParams.delete("ownerRenter");history.replaceState({}, "",u);}}
  function open(id,push){
    const row=rowFor(id);if(!row){message("Renter details are not loaded yet.");return;}
    if(push){const u=new URL(location.href);u.searchParams.set("ownerRenter",String(id));history.pushState({ownerRenter:id},"",u);}
    mount(row);
  }
  document.addEventListener("click",e=>{
    const card=e.target.closest(".gd-current-renter-card");if(!card)return;
    e.preventDefault();e.stopImmediatePropagation();open(card.dataset.occupancyId,true);
  },true);
  window.addEventListener("popstate",()=>{if(page)back();});
  function restoreDirectRoute(){
    const id=new URL(location.href).searchParams.get("ownerRenter");if(!id||loading)return;
    loading=true;let attempts=0;const timer=setInterval(()=>{attempts++;if(rowFor(id)){clearInterval(timer);loading=false;open(id,false);}else if(attempts>80){clearInterval(timer);loading=false;history.replaceState({},"",location.pathname+location.hash);}},250);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",restoreDirectRoute);else restoreDirectRoute();
  const observer=new MutationObserver(()=>{if(new URL(location.href).searchParams.has("ownerRenter")&&!page)restoreDirectRoute();});
  observer.observe(document.body,{childList:true,subtree:true});
})();
