(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = v => "₹" + new Intl.NumberFormat("en-IN",{maximumFractionDigits:2}).format(Number(v||0));
  const withTimeout=(promise,ms,label)=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(label||"Request timed out. Please retry.")),ms);
    Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
  });
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
      body.gdr-owner-renter-profile-open> :not(#gdrOwnerRenterPage),body.gdr-owner-renter-profile-open> :not(#gdrOwnerRenterPage) *{visibility:hidden!important;pointer-events:none!important}
      #gdrOwnerRenterPage{z-index:2147483000!important;isolation:isolate}
      #gdrOwnerRenterPage{position:fixed;inset:0;z-index:100000;overflow:auto;color:var(--gdr-pink-ink);font-family:inherit;background:radial-gradient(ellipse at 8% 0%,#fceaf1 0,transparent 36%),radial-gradient(ellipse at 94% 12%,#f8e8ef 0,transparent 32%),linear-gradient(180deg,#fffafd 0%,#fff7fa 48%,#fbf1f5 100%)}
      #gdrOwnerRenterPage *{box-sizing:border-box}
      .gdr-rp-shell{width:min(100%,1120px);margin:0 auto;padding:24px 22px 48px}
      #gdrOwnerRenterPage{pointer-events:auto!important;overscroll-behavior:contain}
      #gdrOwnerRenterPage button,#gdrOwnerRenterPage input,#gdrOwnerRenterPage select,#gdrOwnerRenterPage textarea{pointer-events:auto!important;position:relative;z-index:2}
      #gdrOwnerRenterPage .gdr-rp-card{min-width:0;overflow:visible}
      #gdrOwnerRenterPage .gdr-rp-form[hidden]{display:none!important}
      #gdrOwnerRenterPage .gdr-rp-actions{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:9px}
      #gdrOwnerRenterPage .gdr-rp-btn{min-height:44px;cursor:pointer;touch-action:manipulation}
      #gdrOwnerRenterPage .gdr-rp-btn:disabled{opacity:.55;cursor:not-allowed}
      #gdrOwnerRenterPage .gdr-rp-message{min-height:22px;overflow-wrap:anywhere}

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
      /* Forest-green workspace layout and form safety overrides. */
      :root{--gdr-pink-ink:#203629;--gdr-pink-muted:#687b6d;--gdr-pink-line:#d9e5db;--gdr-pink-soft:#f5f9f5;--gdr-pink-main:#4d8656;--gdr-pink-deep:#245c37}
      #gdrOwnerRenterPage{z-index:100300!important;overscroll-behavior:contain;background:radial-gradient(ellipse at 8% 0%,#e8f4e8 0,transparent 36%),linear-gradient(180deg,#f8fbf7 0%,#f1f7f0 100%)}
      #gdrOwnerRenterPage .gdr-rp-shell{width:min(1120px,100%);min-height:100%;padding:clamp(12px,2.4vw,26px);box-sizing:border-box}
      #gdrOwnerRenterPage .gdr-rp-grid{align-items:start}
      #gdrOwnerRenterPage .gdr-rp-card{min-width:0;overflow:visible}
      #gdrOwnerRenterPage .gdr-rp-form{position:relative;z-index:2;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      #gdrOwnerRenterPage .gdr-rp-form[hidden]{display:none!important}
      #gdrOwnerRenterPage .gdr-rp-form label{min-width:0}
      #gdrOwnerRenterPage .gdr-rp-form label.gdr-rp-full{grid-column:1/-1}
      #gdrOwnerRenterPage .gdr-rp-form input,#gdrOwnerRenterPage .gdr-rp-form select,#gdrOwnerRenterPage .gdr-rp-form textarea{width:100%;max-width:100%;box-sizing:border-box}
      #gdrOwnerRenterPage .gdr-rp-form textarea{min-height:76px;resize:vertical}
      #gdrOwnerRenterPage .gdr-rp-actions{display:flex;flex-wrap:wrap;gap:9px;align-items:center}
      #gdrOwnerRenterPage .gdr-rp-btn{min-height:44px;touch-action:manipulation;cursor:pointer}
      #gdrOwnerRenterPage .gdr-rp-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
      #gdrOwnerRenterPage .gdr-rp-charge{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0}
      #gdrOwnerRenterPage .gdr-rp-charge>div{min-width:0;overflow-wrap:anywhere}
      #gdrOwnerRenterPage .gdr-rp-charge small{display:block;white-space:normal;overflow-wrap:anywhere}
      #gdrOwnerRenterPage .gdr-rp-back{border-color:#b9d5bd;background:#f7fcf6;color:#255a36}
      #gdrOwnerRenterPage .gdr-rp-avatar{background:linear-gradient(145deg,#8ebc69,#356d43);box-shadow:0 7px 0 #245c37,0 12px 22px rgba(36,92,55,.19)}
      #gdrOwnerRenterPage .gdr-rp-hero{border-color:#c9ddcb;background:linear-gradient(115deg,#fff 0%,#f5faf3 58%,#e5f2e1 100%)}
      #gdrOwnerRenterPage .gdr-rp-hero h1{color:#203b2a}
      #gdrOwnerRenterPage .gdr-rp-hero>div:nth-child(2){position:relative;z-index:2;min-width:0;flex:1 1 240px;overflow-wrap:anywhere}
      #gdrOwnerRenterPage .gdr-rp-hero>div:nth-child(2) p{overflow-wrap:anywhere;word-break:normal}
      #gdrOwnerRenterPage .gdr-rp-status{z-index:3;flex:0 0 auto}
      #gdrOwnerRenterPage .gdr-rp-btn{border-color:#c6dbc9;color:#285d38;background:#fff}
      #gdrOwnerRenterPage .gdr-rp-btn.primary{border-color:#3c7548;background:linear-gradient(180deg,#c8ed83,#8fca53);color:#173b26;box-shadow:0 4px 0 #4c853b}
      #gdrOwnerRenterPage .gdr-rp-form{border-color:#d6e5d7;background:linear-gradient(145deg,#fbfef9,#f0f7ee)}
      #gdrOwnerRenterPage .gdr-rp-form label{color:#3e6248}
      #gdrOwnerRenterPage .gdr-rp-form input,#gdrOwnerRenterPage .gdr-rp-form select,#gdrOwnerRenterPage .gdr-rp-form textarea{border-color:#cbdccc;color:#243a2b}
      @media(max-width:640px){#gdrOwnerRenterPage .gdr-rp-shell{padding:12px}#gdrOwnerRenterPage .gdr-rp-form{grid-template-columns:1fr}#gdrOwnerRenterPage .gdr-rp-form label.gdr-rp-full{grid-column:1}#gdrOwnerRenterPage .gdr-rp-charge{flex-direction:column}#gdrOwnerRenterPage .gdr-rp-actions .gdr-rp-btn{flex:1 1 100%}}
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
          <form class="gdr-rp-form" id="gdrRpChargeForm" hidden><label>Charge name<input name="title" maxlength="100" placeholder="e.g. Maintenance" required></label><label>Amount (₹)<input name="amount" type="number" min="1" max="10000000" step="0.01" required></label><label>Frequency<select name="frequency"><option value="monthly">Every month</option><option value="one_time">One-time</option></select></label><label>Monthly due day (optional)<input name="due_day" type="number" min="1" max="28" placeholder="1–28"></label><label class="gdr-rp-full">Description (optional)<textarea name="description" maxlength="500" rows="2" placeholder="What is this charge for?"></textarea></label><div class="gdr-rp-actions"><button class="gdr-rp-btn primary" type="submit">Save charge</button><button class="gdr-rp-btn" type="button" data-cancel-form>Cancel</button></div></form>
          <p class="gdr-rp-note">Additional charges are shown separately from base rent. This page does not collect payments or mark invoices as paid.</p>
        </section>
      </div><p class="gdr-rp-message" id="gdrRpMessage" aria-live="polite"></p>
      <div class="gdr-rp-actions"><button class="gdr-rp-btn danger" id="gdrRpRelease" type="button">Release renter</button></div>
    </div>`;
    page.querySelector("[data-rp-back]").addEventListener("click",back);
    page.querySelectorAll("[data-cancel-form]").forEach(b=>b.addEventListener("click",()=>{const f=b.closest("form");if(f)f.hidden=true;}));
    // Bind the three primary renter-management actions once at the page root.
    // Delegation survives profile re-renders and prevents stale element handlers.
    if(page.dataset.gdrPrimaryActionsBound!=="1"){
      page.addEventListener("click",event=>{
        const button=event.target.closest("#gdrRpEditDates,#gdrRpEditContact,#gdrRpAddCharge");
        if(!button||!page.contains(button))return;
        event.preventDefault();
        const reveal=(formId,focusSelector)=>{
          const form=$(formId);if(!form)return;
          form.hidden=false;button.setAttribute("aria-expanded","true");
          form.scrollIntoView({behavior:"smooth",block:"nearest"});
          form.querySelector(focusSelector||"input,select,textarea")?.focus({preventScroll:true});
          message("");
        };
        if(button.id==="gdrRpEditDates"){reveal("gdrRpDatesForm",'input[name="moveout"]');return;}
        if(button.id==="gdrRpEditContact"){reveal("gdrRpContactForm",'input[name="name"]');return;}
        const form=$("gdrRpChargeForm");
        if(editingChargeId){
          editingChargeId=null;form.reset();form.hidden=true;
          form.querySelector('[type="submit"]').textContent="Save charge";
          button.textContent="+ Add charge";button.setAttribute("aria-expanded","false");
          return;
        }
        reveal("gdrRpChargeForm",'input[name="title"]');
      },true);
      page.dataset.gdrPrimaryActionsBound="1";
    }
    $("gdrRpDatesForm").addEventListener("submit",e=>saveMoveOut(e,row));
    $("gdrRpContactForm").addEventListener("submit",e=>saveContact(e,row));
    $("gdrRpChargeForm").addEventListener("submit",e=>saveCharge(e,row));
    $("gdrRpCharges").addEventListener("click",e=>{
      const edit=e.target.closest("[data-charge-edit]");
      const disable=e.target.closest("[data-charge-disable]");
      if(edit){const charge=(window.__gdrRenterCharges||[]).find(x=>String(x.id)===edit.dataset.chargeEdit);if(!charge)return;editingChargeId=charge.id;const f=$("gdrRpChargeForm");f.elements.title.value=charge.title;f.elements.amount.value=charge.amount;f.elements.frequency.value=charge.frequency;f.elements.due_day.value=charge.due_day||"";f.elements.description.value=charge.description||"";f.hidden=false;f.querySelector('[type="submit"]').textContent="Save changes";$("gdrRpAddCharge").textContent="Cancel edit";}
      if(disable)deactivateCharge(disable.dataset.chargeDisable,row);
    });
    $("gdrRpRelease").addEventListener("click",()=>release(row));
    document.title="Renter profile | GharDekho";
    loadMoveOut(row);loadCharges(row);
  }
  function duration(start){const now=new Date();let m=(now.getFullYear()-start.getFullYear())*12+now.getMonth()-start.getMonth();if(now.getDate()<start.getDate())m--;return m>0?m+" month"+(m===1?"":"s"):Math.max(0,Math.floor((now-start)/86400000))+" days";}
  function message(t){const n=$("gdrRpMessage");if(n)n.textContent=t||"";}
  async function loadMoveOut(row){
    const value=$("gdrRpMoveOut"),form=$("gdrRpDatesForm"),edit=$("gdrRpEditDates");
    if(!value||!form||!edit)return;
    value.textContent="Loading…";
    try{
      const c=client();if(!c)throw new Error("Account service is unavailable.");
      const r=await withTimeout(c.from("property_occupancies").select("expected_move_out_at").eq("id",row.id).maybeSingle(),12000,"Move-out date request timed out. Please refresh and retry.");
      if(r.error)throw r.error;
      value.textContent=dateText(r.data?.expected_move_out_at);
      form.elements.moveout.value=r.data?.expected_move_out_at||"";
      form.querySelector("button[type=submit]").disabled=false;edit.disabled=false;
    }catch(error){
      console.error("[GharDekho] expected move-out lookup failed",error);
      value.textContent="Unavailable";
      form.querySelector("button[type=submit]").disabled=true;edit.disabled=true;
    }
  }
  async function saveMoveOut(e,row){
    e.preventDefault();const c=client(),form=e.currentTarget,button=form.querySelector("button[type=submit]");
    if(!c){message("Account service is unavailable. Refresh and try again.");return;}
    const value=form.elements.moveout.value||null;
    if(value&&Number.isNaN(new Date(value+"T00:00:00").getTime())){message("Choose a valid move-out date.");return;}
    button.disabled=true;button.textContent="Saving…";
    try{
      const r=await c.from("property_occupancies").update({expected_move_out_at:value}).eq("id",row.id).is("released_at",null).select("id").maybeSingle();
      if(r.error)throw r.error;
      if(!r.data?.id)throw new Error("No active rental record was updated. Refresh the renter profile and try again.");
      row.expected_move_out_at=value;
      $("gdrRpMoveOut").textContent=dateText(value);form.hidden=true;message("Move-out date saved successfully.");
    }catch(error){console.error("[GharDekho] move-out update failed",error);message(error.message||"Could not save the expected move-out date.");}
    finally{button.disabled=false;button.textContent="Save date";}
  }
  async function saveContact(e,row){
    e.preventDefault();const c=client(),f=e.currentTarget,name=f.elements.name.value.trim(),phone=f.elements.phone.value.trim();
    if(!c){message("Account service is unavailable. Refresh and try again.");return;}
    if(!name||phone&&!/^[6-9][0-9]{9}$/.test(phone)){message("Enter a valid name and 10-digit Indian mobile number.");return;}
    const button=f.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Saving…";
    try{
      const r=await c.rpc("update_my_current_renter_contact",{p_occupancy_id:row.id,p_renter_name:name,p_renter_phone:phone||null});
      if(r.error)throw r.error;
      row.renter_name=name;row.renter_phone=phone||null;f.hidden=true;mount(row);message("Renter details updated successfully.");
    }catch(error){console.error("[GharDekho] renter contact update failed",error);message(error.message||"Could not update renter details.");}
    finally{button.disabled=false;button.textContent="Save renter details";}
  }
  async function loadCharges(row){
    const c=client(),target=$("gdrRpCharges"),add=$("gdrRpAddCharge");
    if(!target)return;
    target.innerHTML='<p class="gdr-rp-note">Loading additional charges…</p>';
    window.__gdrRenterCharges=[];
    if(!c){target.innerHTML='<p class="gdr-rp-note">Additional charges are unavailable because the account service is not connected.</p>';if(add)add.disabled=true;return;}
    if(add)add.disabled=false;
    try{
      const r=await withTimeout(c.from("occupancy_charges").select("id,title,description,amount,frequency,due_day,is_active").eq("occupancy_id",row.id).eq("is_active",true).order("created_at",{ascending:false}),12000,"Additional charges request timed out. Please refresh and retry.");
      if(r.error)throw r.error;
      window.__gdrRenterCharges=Array.isArray(r.data)?r.data:[];
      if(!window.__gdrRenterCharges.length){target.innerHTML='<p class="gdr-rp-note">No additional charges have been added yet.</p>';return;}
      target.innerHTML=window.__gdrRenterCharges.map(x=>'<div class="gdr-rp-charge"><div><strong>'+esc(x.title)+'</strong>'+(x.description?'<small>'+esc(x.description)+'</small>':'')+'<small>'+(x.frequency==="monthly"?"Monthly":"One-time")+(x.due_day?" · Due day "+x.due_day:"")+'</small></div><div style="text-align:right"><strong>'+money(x.amount)+'</strong><div class="gdr-rp-actions"><button class="gdr-rp-btn" type="button" data-charge-edit="'+esc(x.id)+'">Edit</button><button class="gdr-rp-btn danger" type="button" data-charge-disable="'+esc(x.id)+'">Remove</button></div></div></div>').join("");
    }catch(error){
      console.error("[GharDekho] additional charges lookup failed",error);
      target.innerHTML='<p class="gdr-rp-note">Additional charges could not be loaded. '+esc(error.message||"Please refresh and try again.")+'</p>';
    }
  }
  let chargeSaving=false;
  async function saveCharge(e,row){
    e.preventDefault();const c=client(),f=e.currentTarget;
    if(chargeSaving)return;
    if(!c){message("Account service is unavailable. Refresh and try again.");return;}
    const title=f.elements.title.value.trim(),description=f.elements.description.value.trim(),amount=Number(f.elements.amount.value),frequency=f.elements.frequency.value,due=f.elements.due_day.value?Number(f.elements.due_day.value):null;
    if(title.length<2||title.length>100||!Number.isFinite(amount)||amount<=0||amount>10000000||!["monthly","one_time"].includes(frequency)||due!==null&&(!Number.isInteger(due)||due<1||due>28)){message("Check the charge name, amount, frequency and due day.");return;}
    chargeSaving=true;const button=f.querySelector('button[type="submit"]');button.disabled=true;button.textContent="Saving…";
    try{
      let r;
      if(editingChargeId){
        r=await c.from("occupancy_charges").update({title,description:description||null,amount,frequency,due_day:frequency==="monthly"?due:null,updated_at:new Date().toISOString()}).eq("id",editingChargeId).eq("occupancy_id",row.id).select("id").maybeSingle();
      }else{
        const ownerLookup=await c.from("property_occupancies").select("owner_id").eq("id",row.id).is("released_at",null).maybeSingle();
        if(ownerLookup.error||!ownerLookup.data?.owner_id)throw new Error("Could not verify the active property owner for this renter.");
        r=await c.from("occupancy_charges").insert({occupancy_id:row.id,owner_id:ownerLookup.data.owner_id,title,description:description||null,amount,frequency,due_day:frequency==="monthly"?due:null}).select("id").maybeSingle();
      }
      if(r.error)throw r.error;
      if(!r.data?.id)throw new Error("No charge was saved. Check that this renter is still active.");
      editingChargeId=null;f.reset();f.hidden=true;f.querySelector('[type="submit"]').textContent="Save charge";$("gdrRpAddCharge").textContent="+ Add charge";
      await loadCharges(row);message("Additional charge saved successfully.");
    }catch(error){console.error("[GharDekho] charge save failed",error);message(error.message||"Could not save the additional charge.");}
    finally{chargeSaving=false;button.disabled=false;button.textContent="Save charge";}
  }
  async function deactivateCharge(id,row){
    if(!confirm("Remove this additional charge from future monthly totals?"))return;
    try{
      const c=client();if(!c)throw new Error("Account service is unavailable.");
      const r=await c.from("occupancy_charges").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",id).eq("occupancy_id",row.id).select("id").maybeSingle();
      if(r.error)throw r.error;if(!r.data?.id)throw new Error("This charge was not updated. Refresh and try again.");
      await loadCharges(row);message("Charge removed from future active totals.");
    }catch(error){console.error("[GharDekho] charge removal failed",error);message(error.message||"Could not remove this charge.");}
  }
  async function release(row){
    if(!confirm("Release this renter and mark the property available again?"))return;
    try{
      const c=client();if(!c)throw new Error("Account service is unavailable.");
      const r=await c.rpc("release_property_occupancy",{p_property_id:row.property_id});
      if(r.error)throw r.error;
      back();await Promise.allSettled([window.loadOwnerProperties?.(),window.loadOwnerVisits?.()]);
    }catch(error){console.error("[GharDekho] renter release failed",error);message(error.message||"Unable to release this renter.");}
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
