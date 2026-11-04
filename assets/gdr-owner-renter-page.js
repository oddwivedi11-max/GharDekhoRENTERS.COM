(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = v => "₹" + new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(Number(v||0));
  const dateText = v => { if(!v) return "Not set"; const d=new Date(v+"T00:00:00"); return Number.isNaN(d.getTime())?"Not set":d.toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"}); };
  let currentId = null, page = null, priorTitle = document.title, loading = false, editingChargeId = null;
  const client = () => window.__gdrSupabaseClient || window.supabaseClient || null;
  const rowFor = id => (window.__gdCurrentRenters||[]).find(r=>String(r.id)===String(id));
  function ensureStyles(){
    if($("gdr-renter-page-style")) return;
    const style=document.createElement("style");style.id="gdr-renter-page-style";
    style.textContent=`
      :root{--gdr-pink-ink:#49303a;--gdr-pink-muted:#8d727d;--gdr-pink-line:#f0dce4;--gdr-pink-soft:#fff7fa;--gdr-pink-main:#c66d91;--gdr-pink-deep:#9f4d72}
      body.gdr-owner-renter-profile-open>header{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #gdrOwnerRenterPage{position:fixed;inset:0;z-index:100000;overflow:auto;color:var(--gdr-pink-ink);font-family:inherit;background:radial-gradient(ellipse at 8% 0%,#fceaf1 0,transparent 36%),radial-gradient(ellipse at 94% 12%,#f8e8ef 0,transparent 32%),linear-gradient(180deg,#fffafd 0%,#fff7fa 48%,#fbf1f5 100%)}
      #gdrOwnerRenterPage *{box-sizing:border-box}
      .gdr-rp-shell{width:min(100%,1120px);margin:0 auto;padding:24px 22px 48px}
      .gdr-rp-top{display:flex;align-items:center;gap:16px;padding:4px 0 20px}
      .gdr-rp-back{min-height:46px;padding:0 17px;border:1px solid #e9cbd8;border-radius:14px;background:rgba(255,255,255,.88);color:#87445f;font-weight:850;box-shadow:0 5px 15px rgba(133,68,95,.06);cursor:pointer;transition:transform .2s,box-shadow .2s}
      .gdr-rp-back:hover{transform:translateY(-2px);box-shadow:0 9px 20px rgba(133,68,95,.12)}
      .gdr-rp-eyebrow{font-size:10px;font-weight:950;letter-spacing:.17em;color:#a96b84;text-transform:uppercase}
      .gdr-rp-top>div:last-child{font-weight:900;color:#4d303d;font-size:16px}
      .gdr-rp-hero{position:relative;display:flex;align-items:center;gap:19px;overflow:hidden;padding:25px 27px;border:1px solid #ebd3dd;border-radius:23px;background:linear-gradient(115deg,#fff 0%,#fff6fa 58%,#f9e8ef 100%);box-shadow:0 14px 34px rgba(116,64,85,.09),inset 0 1px 0 #fff}
      .gdr-rp-hero:after{content:"";position:absolute;right:-45px;top:-82px;width:210px;height:210px;border-radius:50%;background:rgba(226,169,191,.13);pointer-events:none}
      .gdr-rp-avatar{position:relative;z-index:1;width:68px;height:68px;display:grid;place-items:center;flex:0 0 68px;border-radius:21px;background:linear-gradient(145deg,#d98eaa,#b65d82);color:white;font-size:27px;font-weight:950;box-shadow:0 7px 0 #984d6c,0 12px 22px rgba(152,77,108,.19)}
      .gdr-rp-hero h1{margin:4px 0 7px;color:#452b37;font-size:clamp(25px,4vw,36px);font-weight:950;letter-spacing:-.045em;line-height:1.08}
      .gdr-rp-hero p{margin:0;color:#886e79;font-size:13px;line-height:1.6}
      .gdr-rp-status{position:relative;z-index:1;margin-left:auto;align-self:flex-start;padding:8px 12px;border:1px solid #cce9d9;border-radius:99px;background:#edfaf2;color:#18754c;font-size:11px;font-weight:950;white-space:nowrap}
      .gdr-rp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:17px;align-items:stretch}
      .gdr-rp-card{min-width:0;padding:22px;border:1px solid #efdce4;border-radius:20px;background:rgba(255,255,255,.94);box-shadow:0 9px 25px rgba(116,64,85,.055);transition:transform .2s ease,box-shadow .2s ease}
      .gdr-rp-card:hover{box-shadow:0 13px 30px rgba(116,64,85,.09)}
      .gdr-rp-card h2{display:flex;align-items:center;gap:9px;margin:0 0 15px;color:#573848;font-size:16px;font-weight:900;letter-spacing:-.02em}
      .gdr-rp-card h2:before{content:"";width:4px;height:18px;border-radius:8px;background:#d38aa6}
      .gdr-rp-stat{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:12px 0;border-top:1px solid #f5e9ee;font-size:13px}
      .gdr-rp-stat span{color:#987d89}.gdr-rp-stat strong{text-align:right;color:#49303a;font-weight:850;overflow-wrap:anywhere}
      .gdr-rp-wide{grid-column:1/-1}
      .gdr-rp-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:17px}
      .gdr-rp-btn{min-height:43px;padding:0 16px;border:1px solid #e8cad6;border-radius:12px;background:#fff;color:#884862;font-weight:850;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}
      .gdr-rp-btn:hover{transform:translateY(-1px);background:#fff6fa;box-shadow:0 6px 15px rgba(153,77,109,.09)}
      .gdr-rp-btn.primary{border-color:#b65d82;background:linear-gradient(180deg,#d68ba8,#b65d82);color:#fff;box-shadow:0 4px 0 #984d6c}
      .gdr-rp-btn.primary:hover{background:linear-gradient(180deg,#df9ab4,#bd678b)}
      .gdr-rp-btn.danger{border-color:#f0cbd0;background:#fff8f8;color:#a64e5d}
      .gdr-rp-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:15px;padding:17px;border:1px solid #f0dce4;border-radius:16px;background:linear-gradient(145deg,#fff8fb,#fff1f6)}
      .gdr-rp-form[hidden]{display:none!important}
      .gdr-rp-form label{display:grid;gap:7px;color:#765565;font-size:12px;font-weight:850}
      .gdr-rp-form input,.gdr-rp-form select{width:100%;min-height:45px;padding:10px 12px;border:1px solid #e8cbd7;border-radius:11px;background:#fff;color:#49303a;outline:none;transition:border .18s,box-shadow .18s}
      .gdr-rp-form input:focus,.gdr-rp-form select:focus{border-color:#c66d91;box-shadow:0 0 0 3px rgba(198,109,145,.13)}
      .gdr-rp-form .gdr-rp-actions{grid-column:1/-1;margin-top:2px}
      .gdr-rp-charge{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 0;border-top:1px solid #f5e9ee}
      .gdr-rp-charge small{display:block;color:#987d89;margin-top:4px}
      .gdr-rp-note{margin:12px 0 0;padding:12px 14px;border-radius:12px;background:#fff6fa;color:#967887;font-size:12px;line-height:1.6}
      .gdr-rp-message{min-height:20px;margin:12px 2px;color:#a34d70;font-size:12px;font-weight:750}
      #gdrRpRelease{margin-top:4px}
      @media(max-width:760px){.gdr-rp-shell{padding:15px 13px 34px}.gdr-rp-top{align-items:flex-start;flex-wrap:wrap;gap:10px;padding-bottom:14px}.gdr-rp-hero{align-items:flex-start;flex-wrap:wrap;padding:18px}.gdr-rp-status{margin-left:0}.gdr-rp-grid{grid-template-columns:1fr;gap:12px}.gdr-rp-wide{grid-column:auto}.gdr-rp-card{padding:17px}.gdr-rp-form{grid-template-columns:1fr}.gdr-rp-form .gdr-rp-actions{grid-column:auto}.gdr-rp-actions{gap:8px}.gdr-rp-btn{min-height:44px}}
      @media(max-width:420px){.gdr-rp-shell{padding-inline:10px}.gdr-rp-back{width:100%}.gdr-rp-hero{gap:13px}.gdr-rp-avatar{width:55px;height:55px;flex-basis:55px;border-radius:17px}.gdr-rp-status{font-size:10px}.gdr-rp-stat{font-size:12px}.gdr-rp-card{padding:15px}}
    `;
    document.head.appendChild(style);
  }
  function mount(row){
    ensureStyles(); currentId=String(row.id); priorTitle=document.title;
    document.body.classList.add("gdr-owner-renter-profile-open");
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
    $("gdrRpAddCharge").addEventListener("click",()=>{const f=$("gdrRpChargeForm");if(editingChargeId){editingChargeId=null;f.reset();f.hidden=true;f.querySelector('[type="submit"]').textContent="Save charge";$("gdrRpAddCharge").textContent="+ Add charge";}else f.hidden=false;});
    $("gdrRpDatesForm").addEventListener("submit",e=>saveMoveOut(e,row));
    $("gdrRpContactForm").addEventListener("submit",e=>saveContact(e,row));
    $("gdrRpChargeForm").addEventListener("submit",e=>saveCharge(e,row));
    $("gdrRpCharges").addEventListener("click",e=>{
      const edit=e.target.closest("[data-charge-edit]");
      const disable=e.target.closest("[data-charge-disable]");
      if(edit){const charge=(window.__gdrRenterCharges||[]).find(x=>String(x.id)===edit.dataset.chargeEdit);if(!charge)return;editingChargeId=charge.id;const f=$("gdrRpChargeForm");f.elements.title.value=charge.title;f.elements.amount.value=charge.amount;f.elements.frequency.value=charge.frequency;f.elements.due_day.value=charge.due_day||"";f.hidden=false;f.querySelector('[type="submit"]').textContent="Save changes";$("gdrRpAddCharge").textContent="Cancel edit";}
      if(disable)deactivateCharge(disable.dataset.chargeDisable,row);
    });
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
    window.__gdrRenterCharges=Array.isArray(r.data)?r.data:[];
    if(!r.data?.length){target.innerHTML='<p class="gdr-rp-note">No additional charges have been added.</p>';return;}
    target.innerHTML=r.data.map(x=>'<div class="gdr-rp-charge"><div><strong>'+esc(x.title)+'</strong><small>'+(x.frequency==="monthly"?"Monthly":"One-time")+(x.due_day?" · Due day "+x.due_day:"")+'</small></div><div style="text-align:right"><strong>'+money(x.amount)+'</strong><div class="gdr-rp-actions"><button class="gdr-rp-btn" type="button" data-charge-edit="'+esc(x.id)+'">Edit</button><button class="gdr-rp-btn danger" type="button" data-charge-disable="'+esc(x.id)+'">Remove</button></div></div></div>').join("");
  }
  async function saveCharge(e,row){
    e.preventDefault();const c=client(),f=e.currentTarget;
    const title=f.elements.title.value.trim(),amount=Number(f.elements.amount.value),frequency=f.elements.frequency.value,due=f.elements.due_day.value?Number(f.elements.due_day.value):null;
    if(title.length<2||!Number.isFinite(amount)||amount<=0||due!==null&&(!Number.isInteger(due)||due<1||due>28)){message("Check the charge name, amount and due day.");return;}
    let r;
    if(editingChargeId){
      r=await c.from("occupancy_charges").update({title,amount,frequency,due_day:frequency==="monthly"?due:null}).eq("id",editingChargeId).eq("occupancy_id",row.id);
    }else{
      const ownerLookup=await c.from("property_occupancies").select("owner_id").eq("id",row.id).maybeSingle();if(ownerLookup.error||!ownerLookup.data?.owner_id){message("Could not verify the property owner for this renter.");return;}
      r=await c.from("occupancy_charges").insert({occupancy_id:row.id,owner_id:ownerLookup.data.owner_id,title,amount,frequency,due_day:frequency==="monthly"?due:null});
    }
    if(r.error){message("Could not save charge. Confirm the database migration has been applied.");return;}
    editingChargeId=null;f.reset();f.hidden=true;f.querySelector('[type="submit"]').textContent="Save charge";$("gdrRpAddCharge").textContent="+ Add charge";await loadCharges(row);message("Charge saved.");
  }
  async function deactivateCharge(id,row){
    if(!confirm("Remove this additional charge from future monthly totals?"))return;
    const r=await client().from("occupancy_charges").update({is_active:false}).eq("id",id).eq("occupancy_id",row.id);
    if(r.error){message("Could not remove this charge.");return;}
    await loadCharges(row);message("Charge removed from active charges.");
  }
  async function release(row){
    if(!confirm("Release this renter and mark the property available again?"))return;
    const c=client();const r=await c.rpc("release_property_occupancy",{p_property_id:row.property_id});
    if(r.error){message(r.error.message||"Unable to release this renter.");return;}
    back();await Promise.allSettled([window.loadOwnerProperties?.(),window.loadOwnerVisits?.()]);
  }
  function back(){if(page)page.remove();page=null;document.body.classList.remove("gdr-owner-renter-profile-open");document.title=priorTitle;currentId=null;if(new URL(location.href).searchParams.has("ownerRenter")){const u=new URL(location.href);u.searchParams.delete("ownerRenter");history.replaceState({}, "",u);}}
  async function resolveRenterRow(id){
    let row=rowFor(id);
    if(row)return row;
    const c=client();
    if(!c||!id)return null;
    const result=await c.from("property_occupancies")
      .select("id,property_id,renter_id,renter_name,renter_phone,occupied_at,released_at,expected_move_out_at")
      .eq("id",id).maybeSingle();
    if(result.error||!result.data)return null;
    const occupancy=result.data;
    const propertyResult=await c.from("properties")
      .select("id,title,name,address,location,rent,listing_type")
      .eq("id",occupancy.property_id).maybeSingle();
    row={...occupancy,property:propertyResult.data||{}};
    window.__gdCurrentRenters=Array.isArray(window.__gdCurrentRenters)?window.__gdCurrentRenters:[];
    const existing=window.__gdCurrentRenters.findIndex(x=>String(x.id)===String(id));
    if(existing>=0)window.__gdCurrentRenters[existing]=row;else window.__gdCurrentRenters.push(row);
    return row;
  }
  async function open(id,push){
    if(!id){message("Renter record ID is missing. Refresh the owner dashboard and try again.");return;}
    let row=rowFor(id);
    if(!row){
      try{row=await resolveRenterRow(id);}catch(error){console.error("[GharDekho] renter profile load failed",error);}
    }
    if(!row){message("Could not load this renter. Please refresh the owner dashboard and try again.");return;}
    if(push){const u=new URL(location.href);u.searchParams.set("ownerRenter",String(id));history.pushState({ownerRenter:id},"",u);}
    mount(row);
  }
  document.addEventListener("click",e=>{
    const card=e.target.closest(".gd-current-renter-card,[data-occupancy-id],[data-renter-occupancy-id]");
    if(!card)return;
    const id=card.dataset.occupancyId||card.dataset.renterOccupancyId||card.getAttribute("data-occupancy-id");
    if(!id)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open(id,true);
  },true);
  window.addEventListener("popstate",()=>{if(page)back();});
  function restoreDirectRoute(){
    const id=new URL(location.href).searchParams.get("ownerRenter");if(!id||loading)return;
    loading=true;let attempts=0;const timer=setInterval(()=>{attempts++;if(rowFor(id)){clearInterval(timer);loading=false;open(id,false);}else if(attempts>80){clearInterval(timer);loading=false;history.replaceState({},"",location.pathname+location.hash);}},250);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",restoreDirectRoute);else restoreDirectRoute();
  const observer=new MutationObserver(()=>{if(new URL(location.href).searchParams.has("ownerRenter")&&!page)restoreDirectRoute();});
  observer.observe(document.body,{childList:true,subtree:true});
  const ledgerScript=document.createElement("script"); ledgerScript.src="/assets/gdr-owner-renter-ledger.js"; ledgerScript.defer=true; document.head.appendChild(ledgerScript);
})();
