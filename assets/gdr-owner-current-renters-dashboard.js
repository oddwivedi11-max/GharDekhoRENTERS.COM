(function () {
  "use strict";
  const $ = (id, root = document) => root.getElementById(id);
  const money = value => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value || 0));
  const db = () => window.__gdrSupabaseClient || window.supabaseClient || null;
  let page = null, occupancySection = null, originalParent = null, originalNext = null, returnScroll = 0, busy = false;

  function styles() {
    if ($("gdr-owner-renters-dashboard-style")) return;
    const style = document.createElement("style");
    style.id = "gdr-owner-renters-dashboard-style";
    style.textContent = `
      .gdr-owner-entry-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:stretch}
      .gdr-owner-entry-card{min-height:184px!important;justify-content:space-between!important;padding:24px!important;border-radius:22px!important}
      .gdr-current-renters-entry{background:linear-gradient(145deg,#fbf4eb,#f1e4d6)!important;border:1px solid #dfc9b3!important;box-shadow:0 12px 28px rgba(93,62,39,.10),inset 0 1px 0 rgba(255,255,255,.9)!important}
      .gdr-current-renters-entry h3{color:#493326!important}
      .gdr-current-renters-entry .dashboard-muted{color:#806b5b!important}
      .gdr-current-renters-open{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:52px;padding:0 17px;border:1px solid #79553d;border-radius:14px;background:linear-gradient(180deg,#8d674c,#765039);color:#fff;font:850 14px/1.2 inherit;box-shadow:0 7px 0 #5b3d2b,0 12px 22px rgba(70,43,26,.18);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
      .gdr-current-renters-open:hover{transform:translateY(-2px);filter:brightness(1.04);box-shadow:0 9px 0 #5b3d2b,0 16px 26px rgba(70,43,26,.2)}
      .gdr-current-renters-open:active{transform:translateY(4px);box-shadow:0 3px 0 #5b3d2b,0 7px 12px rgba(70,43,26,.16)}
      .gdr-current-renters-open-icon{display:grid;place-items:center;width:29px;height:29px;border-radius:9px;background:rgba(255,255,255,.16);font-size:19px}
      .gdr-current-renters-open-arrow{margin-left:auto;font-size:20px}
      body.gdr-current-renters-open>header,body.gdr-current-renters-open header{display:none!important;visibility:hidden!important;pointer-events:none!important}
      #gdrOwnerCurrentRentersPage{position:fixed;inset:0;z-index:85000;overflow:auto;background:#f8f5f0;color:#30251e;padding:clamp(14px,3vw,32px)}
      #gdrOwnerCurrentRentersPage *{box-sizing:border-box}
      .gdr-ocr-shell{width:min(1220px,100%);min-height:calc(100vh - 64px);margin:0 auto;display:flex;flex-direction:column;gap:18px}
      .gdr-ocr-brandbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border:1px solid #e5d7c9;border-radius:20px;background:linear-gradient(115deg,#fffdfa 0%,#f1e5d9 100%);box-shadow:0 12px 30px rgba(76,51,34,.07)}
      .gdr-ocr-brand{display:flex;align-items:center;gap:13px;min-width:0}
      .gdr-ocr-brandmark{display:grid;place-items:center;width:48px;height:48px;flex:0 0 48px;border-radius:14px;background:#4b3427;color:#fff;font:950 15px/1 "Arial Black","Orbitron",monospace;letter-spacing:-.08em;box-shadow:0 5px 0 #302117,0 10px 18px rgba(48,33,23,.18)}
      .gdr-ocr-brandname{margin:0;color:#38271d;font-family:"Arial Black","Orbitron",monospace;font-size:clamp(21px,3vw,30px);font-weight:1000;letter-spacing:.075em;line-height:1;text-transform:uppercase;text-shadow:1px 1px 0 #d7c0aa,2px 2px 0 rgba(88,58,38,.12)}
      .gdr-ocr-brandtag{margin:6px 0 0;color:#8b6b53;font-size:10px;font-weight:900;letter-spacing:.19em;text-transform:uppercase}
      .gdr-ocr-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 0;padding:0 2px}
      .gdr-ocr-head .gdr-ocr-title{font-size:clamp(24px,3vw,32px)}
      .gdr-ocr-stats{margin-bottom:0}
      .gdr-ocr-content{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(250px,.8fr);gap:16px;align-items:stretch;flex:1}
      .gdr-ocr-list{min-width:0;height:100%}
      .gdr-ocr-side{display:flex;flex-direction:column;gap:14px}
      .gdr-ocr-sidecard{padding:20px;border:1px solid #e7dacf;border-radius:20px;background:linear-gradient(150deg,#fffdfa,#f7eee5);box-shadow:0 12px 28px rgba(76,51,34,.06)}
      .gdr-ocr-sidecard h2{margin:0 0 8px;color:#493326;font-size:16px}
      .gdr-ocr-sidecard p{margin:0;color:#806f63;font-size:13px;line-height:1.65}
      .gdr-ocr-side-kicker{margin:0 0 8px;color:#9a775d;font-size:10px;font-weight:950;letter-spacing:.17em}
      .gdr-ocr-side-number{display:block;margin:10px 0 4px;color:#493326;font-size:29px;font-weight:950;letter-spacing:-.04em}
      .gdr-ocr-building{position:relative;min-height:115px;overflow:hidden;margin-top:auto;border:1px solid #e2d1c0;border-radius:20px;background:linear-gradient(135deg,#ead9c8,#f8eee4)}
      .gdr-ocr-building:before{content:"";position:absolute;left:13%;bottom:-18px;width:35%;height:105px;border:5px solid #87664d;border-bottom:0;border-radius:8px 8px 0 0;background:repeating-linear-gradient(90deg,transparent 0 18px,#9b795f 18px 22px),repeating-linear-gradient(0deg,#f9f1e9 0 19px,#b99577 19px 23px)}
      .gdr-ocr-building:after{content:"";position:absolute;right:13%;bottom:-20px;width:28%;height:80px;border:5px solid #76543c;border-bottom:0;border-radius:8px 8px 0 0;background:repeating-linear-gradient(90deg,#f9f1e9 0 17px,#a9876c 17px 21px),repeating-linear-gradient(0deg,transparent 0 18px,#a9876c 18px 22px)}
      .gdr-ocr-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 3px 0;border-top:1px solid #e7dacf;color:#9a8878;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
      .gdr-ocr-back{min-height:44px;padding:0 15px;border:1px solid #dfd2c5;border-radius:12px;background:#fff;color:#674a36;font-weight:850;cursor:pointer}
      .gdr-ocr-home{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:0 19px;border:1px solid #176b5e;border-radius:13px;background:linear-gradient(180deg,#238474 0%,#176b5e 100%);color:#fff;font:850 14px/1 inherit;text-decoration:none;white-space:nowrap;box-shadow:0 5px 0 #105447,0 10px 20px rgba(23,107,94,.17);cursor:pointer;transition:transform .18s ease,box-shadow .18s ease,filter .18s ease}
      .gdr-ocr-home:hover{transform:translateY(-2px);filter:brightness(1.05);box-shadow:0 7px 0 #105447,0 14px 24px rgba(23,107,94,.21)}
      .gdr-ocr-home:active{transform:translateY(3px);box-shadow:0 2px 0 #105447,0 5px 12px rgba(23,107,94,.16)}
      .gdr-ocr-home-icon{font-size:17px;line-height:1}
      @media(max-width:700px){.gdr-ocr-brandbar{align-items:flex-start;flex-wrap:wrap}.gdr-ocr-home{min-height:42px;padding:0 13px;font-size:12px}.gdr-ocr-brandbar>.gdr-ocr-home{width:100%}}
      .gdr-ocr-kicker{margin:0 0 6px;color:#8b6b53;font-size:11px;font-weight:950;letter-spacing:.16em}
      .gdr-ocr-title{margin:0;color:#35261d;font-size:clamp(27px,4vw,38px);letter-spacing:-.045em;line-height:1.05}
      .gdr-ocr-subtitle{margin:8px 0 0;color:#806f63;font-size:14px}
      .gdr-ocr-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 18px}
      .gdr-ocr-stat{padding:18px;border:1px solid #e8ddd2;border-radius:17px;background:linear-gradient(145deg,#fff,#fbf6f0);box-shadow:0 8px 22px rgba(76,51,34,.055)}
      .gdr-ocr-stat small{display:block;color:#907763;font-size:11px;font-weight:800}
      .gdr-ocr-stat strong{display:block;margin-top:8px;color:#493326;font-size:clamp(20px,3vw,27px);letter-spacing:-.03em}
      .gdr-ocr-stat em{display:block;margin-top:4px;color:#9b897b;font-size:11px;font-style:normal}
      .gdr-ocr-list{padding:clamp(15px,2.5vw,25px);border:1px solid #e7dacf;border-radius:21px;background:#fffdfa;box-shadow:0 14px 34px rgba(76,51,34,.07)}
      .gdr-ocr-list .owner-occupancy-card{display:block!important;width:100%!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
      .gdr-ocr-list .premium-section-heading{margin-bottom:12px}
      .gdr-ocr-list .premium-section-heading .dashboard-mini-badge{display:none}
      .gdr-ocr-list #ownerOccupancyContainer{margin-top:12px}
      .gdr-ocr-list .gd-current-renter-card{margin:10px 0!important}
      @media(max-width:850px){.gdr-ocr-content{grid-template-columns:1fr}.gdr-ocr-side{display:grid;grid-template-columns:1fr 1fr}.gdr-ocr-building{min-height:100px;margin-top:0}}
      @media(max-width:700px){
        .gdr-owner-entry-grid{grid-template-columns:1fr!important;gap:12px!important}
        .gdr-owner-entry-card{min-height:150px!important;padding:19px!important}
        #gdrOwnerCurrentRentersPage{padding:12px}
        .gdr-ocr-shell{min-height:calc(100vh - 24px);gap:12px}
        .gdr-ocr-brandbar{padding:13px 14px;border-radius:16px}
        .gdr-ocr-brandmark{width:41px;height:41px;flex-basis:41px}
        .gdr-ocr-brandname{font-size:21px}
        .gdr-ocr-brandtag{font-size:8px;letter-spacing:.13em}
        .gdr-ocr-head{align-items:flex-start}
        .gdr-ocr-head .gdr-ocr-title{font-size:25px}
        .gdr-ocr-back{min-height:40px;padding:0 11px;font-size:12px}
        .gdr-ocr-stats{grid-template-columns:1fr 1fr;gap:8px}
        .gdr-ocr-stat{padding:13px}
        .gdr-ocr-stat:last-child{grid-column:1/-1}
        .gdr-ocr-content{grid-template-columns:1fr;gap:11px}
        .gdr-ocr-list{padding:12px}
        .gdr-ocr-list .gd-current-renter-card{grid-template-columns:42px minmax(0,1fr) auto!important;gap:10px!important;padding:13px!important}
        .gdr-ocr-side{grid-template-columns:1fr}
        .gdr-ocr-sidecard{padding:15px}
        .gdr-ocr-building{min-height:85px}
        .gdr-ocr-footer{font-size:8px;letter-spacing:.07em}
      }
    `;
    document.head.appendChild(style);
  }

  function addEntryCard() {
    const grid = document.querySelector("#ownerDashboard .owner-dashboard-quick-grid");
    if (!grid || $("ownerCurrentRentersBtn")) return;
    // The deployment patch creates the button in the HTML. This fallback keeps
    // the entry point available if a cached or older dashboard shell is loaded.
    const card = document.createElement("article");
    card.className = "dashboard-card owner-quick-card gdr-owner-entry-card gdr-current-renters-entry";
    card.innerHTML = '<div><span class="dashboard-section-kicker">TENANCY MANAGEMENT</span><h3>Current Renters</h3><p class="dashboard-muted">Manage active tenants, rental details and monthly rent records.</p></div><button type="button" class="gdr-current-renters-open" id="ownerCurrentRentersBtn"><span class="gdr-current-renters-open-icon" aria-hidden="true">♙</span><span>Current Renters</span><span class="gdr-current-renters-open-arrow" aria-hidden="true">→</span></button>';
    grid.appendChild(card);
    bindButton();
  }

  async function stats() {
    const renters = Array.isArray(window.__gdCurrentRenters) ? window.__gdCurrentRenters : [];
    const expected = renters.reduce((sum, row) => sum + Number(row.property?.rent || 0), 0);
    let received = null;
    const client = db();
    try {
      if (client) {
        const auth = await client.auth.getUser();
        const userId = auth.data?.user?.id;
        if (userId) {
          const owner = await client.from("owners").select("id").eq("user_id", userId).maybeSingle();
          if (!owner.error && owner.data?.id) {
            const now = new Date();
            const period = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-01";
            const payments = await client.from("owner_rent_ledger_entries").select("amount,received_at,payment_method").eq("owner_id", owner.data.id).eq("billing_period", period).order("received_at", { ascending: false });
            if (!payments.error) {
              const rows = payments.data || [];
              received = rows.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
              window.__gdrCurrentMonthReceipts = rows;
            }
          }
        }
      }
    } catch (error) {
      console.warn("[GharDekho] Could not load current-month renter receipts", error);
    }
    return { renters: renters.length, expected, received };
  }

  async function open() {
    if (busy) return;
    const section = document.querySelector("#ownerDashboard .owner-occupancy-card");
    if (!section) return;
    busy = true;
    styles();
    returnScroll = window.scrollY;
    if (!page) {
      page = document.createElement("section");
      page.id = "gdrOwnerCurrentRentersPage";
      page.setAttribute("aria-label", "Current Renters dashboard");
      page.innerHTML = '<div class="gdr-ocr-shell"><div class="gdr-ocr-brandbar"><div class="gdr-ocr-brand"><span class="gdr-ocr-brandmark">GDR</span><div><p class="gdr-ocr-brandname">GDR RENTERS</p><p class="gdr-ocr-brandtag">Rental operations / owner console</p></div></div><button type="button" class="gdr-ocr-home" id="gdrOcrHome"><span class="gdr-ocr-home-icon" aria-hidden="true">⌂</span><span>Back to Home</span></button></div><header class="gdr-ocr-head"><div><p class="gdr-ocr-kicker">OWNER WORKSPACE / TENANCY</p><h1 class="gdr-ocr-title">Current Renters</h1><p class="gdr-ocr-subtitle">Your active tenants, rental details and monthly rent overview.</p></div></header><div class="gdr-ocr-stats" id="gdrOcrStats"><article class="gdr-ocr-stat"><small>ACTIVE RENTERS</small><strong>—</strong><em>Loading live records</em></article><article class="gdr-ocr-stat"><small>MONTHLY RENT EXPECTED</small><strong>—</strong><em>Based on active tenancies</em></article><article class="gdr-ocr-stat"><small>RENT RECEIVED THIS MONTH</small><strong>—</strong><em>Owner-recorded receipts only</em></article></div><div class="gdr-ocr-content"><div class="gdr-ocr-list" id="gdrOcrList"></div><aside class="gdr-ocr-side"><section class="gdr-ocr-sidecard"><p class="gdr-ocr-side-kicker">TENANCY SNAPSHOT</p><h2>Portfolio at a glance</h2><strong class="gdr-ocr-side-number" id="gdrOcrSideRenters">—</strong><p>Active rental relationships linked to your owner account.</p><strong class="gdr-ocr-side-number" id="gdrOcrSideExpected">—</strong><p>Combined monthly base rent from active properties.</p></section><section class="gdr-ocr-sidecard"><p class="gdr-ocr-side-kicker">QUICK GUIDE</p><h2>Manage with clarity</h2><p>Open any renter card to view their profile, update contact details, manage additional charges, record partial or full rent receipts, and configure due dates and late-fee rules.</p></section><div class="gdr-ocr-building" aria-hidden="true"></div></aside></div><footer class="gdr-ocr-footer"><span>GDR RENTERS · GHARDEKHO</span><span>OWNER MANAGEMENT SPACE</span></footer></div>';
      document.body.appendChild(page);
      $("gdrOcrHome").addEventListener("click", close);
    }
    occupancySection = section;
    originalParent = section.parentNode;
    originalNext = section.nextSibling;
    const list = $("gdrOcrList");
    list.appendChild(section);
    page.hidden = false;
    document.body.classList.add("gdr-current-renters-open");
    document.body.style.overflow = "hidden";
    const data = await stats();
    if ($("gdrOcrStats")) {
      $("gdrOcrStats").innerHTML =
        '<article class="gdr-ocr-stat"><small>ACTIVE RENTERS</small><strong>' + data.renters + '</strong><em>Live occupancy records</em></article>' +
        '<article class="gdr-ocr-stat"><small>MONTHLY RENT EXPECTED</small><strong>' + money(data.expected) + '</strong><em>Combined base rent for active renters</em></article>' +
        '<article class="gdr-ocr-stat"><small>RENT RECEIVED THIS MONTH</small><strong>' + (data.received === null ? "—" : money(data.received)) + '</strong><em>' + (data.received === null ? "Receipt summary unavailable" : "Owner-recorded ledger receipts") + '</em></article>';
      $("gdrOcrSideRenters").textContent = data.renters;
      $("gdrOcrSideExpected").textContent = money(data.expected);
    }
    busy = false;
  }

  function close() {
    if (occupancySection && originalParent) {
      if (originalNext && originalNext.parentNode === originalParent) originalParent.insertBefore(occupancySection, originalNext);
      else originalParent.appendChild(occupancySection);
    }
    if (page) page.hidden = true;
    document.body.classList.remove("gdr-current-renters-open");
    document.body.style.overflow = "";
    window.scrollTo({ top: returnScroll, behavior: "smooth" });
    occupancySection = null;
    originalParent = null;
    originalNext = null;
  }

  function bindButton() {
    const button = $("ownerCurrentRentersBtn");
    if (!button || button.dataset.gdrBound === "1") return;
    button.dataset.gdrBound = "1";
    button.addEventListener("click", open);
  }

  function boot() {
    styles();
    addEntryCard();
    bindButton();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  new MutationObserver(() => { addEntryCard(); bindButton(); }).observe(document.body, { childList: true, subtree: true });
  window.GDROwnerCurrentRenters = { open, close };
})();