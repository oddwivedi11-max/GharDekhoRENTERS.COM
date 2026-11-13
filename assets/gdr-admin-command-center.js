(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const client = () => window.__gdrSupabaseClient || null;
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const when = value => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", {
      dateStyle: "medium", timeStyle: "short"
    });
  };
  const statusLabel = value => String(value || "open").replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
  const money = value => "₹" + Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const message = (node, text, type) => {
    if (!node) return;
    node.textContent = text || "";
    node.className = "gdr-cc-message" + (type ? " is-" + type : "");
  };

  async function rpc(name, args) {
    const supabase = client();
    if (!supabase) throw new Error("Secure application session is not ready. Refresh the page and sign in again.");
    const result = await supabase.rpc(name, args || {});
    if (result.error) throw result.error;
    return result.data;
  }

  let adminBound = false;
  let adminVerified = false;
  let activeTicket = null;
  let supportCache = [];
  let auditOffset = 0;
  let auditQueryTimer = null;
  let globalSearchTimer = null;
  let userSession = null;
  let userRoleCache = null;
  let authSubscription = null;
  const recentClientErrors = new Map();

  function adminDashboard() { return $("#adminDashboard"); }
  function isAdminVisible() {
    const dash = adminDashboard();
    return !!dash && dash.style.display !== "none" && !dash.hidden;
  }

  function addAdminTabsAndPanels() {
    const dash = adminDashboard();
    if (!dash || dash.dataset.gdrCommandCenterBuilt === "1") return;
    const nav = $(".gd-admin-tabs", dash);
    if (!nav) return;

    nav.insertAdjacentHTML("afterbegin",
      '<button type="button" class="gd-admin-tab active" data-admin-tab="overview">Overview</button>');
    nav.insertAdjacentHTML("beforeend",
      '<button type="button" class="gd-admin-tab" data-admin-tab="support">Support <span class="gdr-cc-tab-count" id="gdrCcOpenTicketCount">0</span></button>' +
      '<button type="button" class="gd-admin-tab" data-admin-tab="audit">Audit Trail</button>' +
      '<button type="button" class="gd-admin-tab" data-admin-tab="health">System Health</button>');

    const firstPanel = $("#adminPanelProperties", dash);
    if (firstPanel) firstPanel.insertAdjacentHTML("beforebegin",
      '<div id="adminPanelOverview" class="gd-admin-panel active dashboard-card">' +
        '<div class="gdr-cc-panel-head"><div><span class="gdr-cc-eyebrow">LIVE PLATFORM INTELLIGENCE</span><h3>Platform Overview</h3><p>Live counts from the GharDekho production database.</p></div><button type="button" class="gdr-cc-quiet-button" data-gdr-cc-refresh="overview">↻ Refresh</button></div>' +
        '<div id="gdrCcOverviewMetrics" class="gdr-cc-kpi-grid"><div class="gdr-cc-loading">Loading verified platform statistics…</div></div>' +
        '<div class="gdr-cc-overview-lower"><section class="gdr-cc-surface"><div class="gdr-cc-surface-head"><strong>Recent audited activity</strong><span>Latest database changes</span></div><div id="gdrCcRecentAudit" class="gdr-cc-recent-list"><p class="gdr-cc-muted">Loading activity…</p></div></section>' +
        '<section class="gdr-cc-surface"><div class="gdr-cc-surface-head"><strong>Operational pulse</strong><span>Current service indicators</span></div><div id="gdrCcPulse" class="gdr-cc-pulse"><p class="gdr-cc-muted">Checking services…</p></div></section></div>' +
        '<p class="gdr-cc-footnote">Counts use existing production records. Bookings are not shown as a separate metric because this database currently tracks visit requests rather than a distinct booking table.</p>' +
      '</div>');

    const activity = $("#adminPanelActivity", dash);
    if (activity) activity.insertAdjacentHTML("afterend",
      '<div id="adminPanelSupport" class="gd-admin-panel dashboard-card">' +
        '<div class="gdr-cc-panel-head"><div><span class="gdr-cc-eyebrow">OWNER & RENTER ASSISTANCE</span><h3>Support & Resolution Center</h3><p>Review genuine user-submitted issues, inspect linked records, and record verified fixes.</p></div><button type="button" class="gdr-cc-quiet-button" data-gdr-cc-refresh="support">↻ Refresh tickets</button></div>' +
        '<div class="gdr-cc-support-toolbar"><input id="gdrCcTicketSearch" class="gd-admin-search" type="search" placeholder="Search ticket, user, category or description…"><select id="gdrCcTicketStatus" aria-label="Filter tickets"><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_on_user">Waiting on user</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div>' +
        '<div class="gdr-cc-ticket-summary" id="gdrCcTicketSummary"></div>' +
        '<div class="gd-admin-table-wrap"><table class="gd-admin-table gdr-cc-table"><thead><tr><th>Ticket</th><th>User</th><th>Issue</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody id="gdrCcSupportBody"><tr><td colspan="6">Loading support tickets…</td></tr></tbody></table></div>' +
        '<p id="gdrCcSupportMessage" class="gdr-cc-message" aria-live="polite"></p>' +
      '</div>' +
      '<div id="adminPanelAudit" class="gd-admin-panel dashboard-card">' +
        '<div class="gdr-cc-panel-head"><div><span class="gdr-cc-eyebrow">APPEND-ONLY RECORD</span><h3>Audit Trail</h3><p>Server-recorded changes to owners, users, properties, visits, occupancies, payments and support tickets. Contact details are excluded from snapshots.</p></div><button type="button" class="gdr-cc-quiet-button" data-gdr-cc-refresh="audit">↻ Refresh</button></div>' +
        '<input id="gdrCcAuditSearch" class="gd-admin-search" type="search" placeholder="Search action, table, record ID or request ID…">' +
        '<div class="gd-admin-table-wrap"><table class="gd-admin-table gdr-cc-table"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Record</th><th>Changed values</th></tr></thead><tbody id="gdrCcAuditBody"><tr><td colspan="5">Loading audit records…</td></tr></tbody></table></div>' +
        '<div class="gdr-cc-table-footer"><span id="gdrCcAuditCount" class="gdr-cc-muted"></span><button type="button" class="gdr-cc-quiet-button" id="gdrCcAuditMore">Load older records</button></div>' +
        '<p class="gdr-cc-footnote">Audit records are written by database triggers and are not editable from the dashboard.</p>' +
      '</div>' +
      '<div id="adminPanelHealth" class="gd-admin-panel dashboard-card">' +
        '<div class="gdr-cc-panel-head"><div><span class="gdr-cc-eyebrow">PRODUCTION DIAGNOSTICS</span><h3>System Health</h3><p>Checks the authenticated admin session and live Supabase database, plus recent browser errors reported by signed-in users.</p></div><button type="button" class="gdr-cc-quiet-button" data-gdr-cc-refresh="health">↻ Run checks</button></div>' +
        '<div id="gdrCcHealthCards" class="gdr-cc-health-grid"><div class="gdr-cc-loading">Checking services…</div></div>' +
        '<section class="gdr-cc-surface gdr-cc-errors"><div class="gdr-cc-surface-head"><strong>Recent client-side errors</strong><span>Sanitized message only; no stack traces or credentials</span></div><div class="gd-admin-table-wrap"><table class="gd-admin-table gdr-cc-table"><thead><tr><th>When</th><th>Type</th><th>Message</th><th>Page</th></tr></thead><tbody id="gdrCcErrorsBody"><tr><td colspan="4">Loading diagnostics…</td></tr></tbody></table></div></section>' +
        '<p class="gdr-cc-footnote">This panel verifies the database and authenticated application session. It does not claim to monitor third-party providers or Cloudflare internals.</p>' +
      '</div>');

    const existingToolbar = $(".gd-admin-toolbar", dash);
    if (existingToolbar) existingToolbar.insertAdjacentHTML("afterend",
      '<div class="gdr-cc-global-search"><div><span class="gdr-cc-eyebrow">COMMAND SEARCH</span><strong>Find any platform record</strong><small>Owners · Renters · Properties · Visits · Support tickets</small></div><div class="gdr-cc-global-search-input"><input id="gdrCcGlobalSearch" type="search" autocomplete="off" placeholder="Search name, email, phone, PIN, ID or ticket…"><div id="gdrCcGlobalResults" class="gdr-cc-search-results" hidden></div></div></div>');

    const activityNote = $(".gd-admin-muted", activity);
    if (activityNote) activityNote.textContent =
      "Legacy relationship activity is shown here. For server-recorded field changes and admin operations, use the Audit Trail tab.";

    // Overview is the first landing panel; existing property and people tabs remain unchanged.
    $$(".gd-admin-tab", nav).forEach(button => button.classList.toggle("active", button.dataset.adminTab === "overview"));
    $$(".gd-admin-panel", dash).forEach(panel => panel.classList.toggle("active", panel.id === "adminPanelOverview"));
    dash.dataset.gdrCommandCenterBuilt = "1";

    dash.addEventListener("click", event => {
      const tab = event.target.closest(".gd-admin-tab");
      if (tab && dash.contains(tab) && ["overview", "support", "audit", "health"].includes(tab.dataset.adminTab)) {
        window.setTimeout(() => {
          const panel = tab.dataset.adminTab;
          if (panel === "overview") loadOverview();
          if (panel === "support") loadSupportTickets();
          if (panel === "audit") { auditOffset = 0; loadAudit(false); }
          if (panel === "health") loadHealth();
        }, 0);
      }

      const refresh = event.target.closest("[data-gdr-cc-refresh]");
      if (refresh) {
        const kind = refresh.dataset.gdrCcRefresh;
        if (kind === "overview") loadOverview();
        if (kind === "support") loadSupportTickets();
        if (kind === "audit") { auditOffset = 0; loadAudit(false); }
        if (kind === "health") loadHealth();
      }

      const review = event.target.closest("[data-gdr-cc-review-ticket]");
      if (review) openAdminTicket(review.dataset.gdrCcReviewTicket);

      if (event.target.closest("#gdrCcAuditMore")) loadAudit(true);

      const open = event.target.closest("[data-gdr-cc-open-entity]");
      if (open) openGlobalResult({
        entity_type: open.dataset.gdrCcOpenEntity,
        entity_id: open.dataset.gdrCcEntityId,
        title: open.dataset.gdrCcTitle || ""
      });
    });

    const ticketSearch = $("#gdrCcTicketSearch", dash);
    if (ticketSearch) ticketSearch.addEventListener("input", renderSupportTickets);
    const ticketStatus = $("#gdrCcTicketStatus", dash);
    if (ticketStatus) ticketStatus.addEventListener("change", loadSupportTickets);
    const auditSearch = $("#gdrCcAuditSearch", dash);
    if (auditSearch) auditSearch.addEventListener("input", () => {
      window.clearTimeout(auditQueryTimer);
      auditQueryTimer = window.setTimeout(() => { auditOffset = 0; loadAudit(false); }, 280);
    });

    const globalSearch = $("#gdrCcGlobalSearch", dash);
    if (globalSearch) globalSearch.addEventListener("input", () => {
      window.clearTimeout(globalSearchTimer);
      globalSearchTimer = window.setTimeout(() => runGlobalSearch(globalSearch.value), 260);
    });

    adminBound = true;
  }

  function metricCard(label, value, note, tone) {
    return '<article class="gdr-cc-kpi ' + esc(tone || "") + '"><span>' + esc(label) +
      '</span><strong>' + esc(value == null ? "—" : value) + '</strong><small>' + esc(note || "") + '</small></article>';
  }

  async function loadOverview() {
    const box = $("#gdrCcOverviewMetrics");
    if (!box) return;
    box.innerHTML = '<div class="gdr-cc-loading">Refreshing live statistics…</div>';
    try {
      const stats = await rpc("admin_get_command_center_stats");
      const oldProperty = $("#adminPropertyCount");
      const oldOwner = $("#adminOwnerCount");
      const oldRenter = $("#adminRenterCount");
      const oldVisit = $("#adminVisitCount");
      if (oldProperty) oldProperty.textContent = stats.properties_total + " properties";
      if (oldOwner) oldOwner.textContent = String(stats.owners_total);
      if (oldRenter) oldRenter.textContent = String(stats.renters_total);
      if (oldVisit) oldVisit.textContent = String(stats.visits_total);

      box.innerHTML =
        metricCard("Registered users", stats.registered_users, "Owner and renter accounts", "gdr-cc-kpi-forest") +
        metricCard("Active listings", stats.active_properties, "Verified and visible properties", "gdr-cc-kpi-green") +
        metricCard("Vacant listings", stats.vacant_properties, "Verified with no active occupancy", "gdr-cc-kpi-sand") +
        metricCard("Currently rented", stats.rented_properties, "Properties with active occupancy", "gdr-cc-kpi-blue") +
        metricCard("Open support issues", stats.open_tickets, "Open, in progress or waiting", "gdr-cc-kpi-amber") +
        metricCard("Resolved issues", stats.resolved_tickets, "Resolved or closed tickets", "gdr-cc-kpi-green") +
        metricCard("Audit events · 24h", stats.audit_events_24h, "Server-recorded data changes", "gdr-cc-kpi-slate") +
        metricCard("Client errors · 24h", stats.client_errors_24h, "Reported by signed-in users", "gdr-cc-kpi-rose");

      const recent = await rpc("admin_get_audit_logs", { p_limit: 8, p_offset: 0, p_query: null });
      const recentBox = $("#gdrCcRecentAudit");
      if (recentBox) recentBox.innerHTML = recent.length ? recent.map(row =>
        '<article class="gdr-cc-recent-item"><span class="gdr-cc-recent-mark"></span><div><strong>' +
        esc(row.action.toUpperCase() + " · " + row.entity_type) + '</strong><small>' +
        esc(row.entity_id || "Record") + " · " + esc(when(row.created_at)) +
        '</small></div><span class="gdr-cc-actor">' + esc(row.actor_scope) + '</span></article>'
      ).join("") : '<p class="gdr-cc-muted">No audited changes recorded yet. New owner, renter, property, visit, occupancy, payment and ticket changes will appear here.</p>';

      const pulse = $("#gdrCcPulse");
      if (pulse) pulse.innerHTML =
        '<div class="gdr-cc-pulse-row"><span class="gdr-cc-pulse-dot is-good"></span><div><strong>Database records</strong><small>' + esc(stats.properties_total) + ' active database property records</small></div><b>Available</b></div>' +
        '<div class="gdr-cc-pulse-row"><span class="gdr-cc-pulse-dot is-good"></span><div><strong>Owner / renter records</strong><small>' + esc(stats.owners_total) + ' owner profiles · ' + esc(stats.renters_total) + ' renter accounts</small></div><b>Synced</b></div>' +
        '<div class="gdr-cc-pulse-row"><span class="gdr-cc-pulse-dot ' + (Number(stats.open_tickets) ? "is-warn" : "is-good") + '"></span><div><strong>Support queue</strong><small>' + esc(stats.open_tickets) + ' unresolved reports</small></div><b>' + (Number(stats.open_tickets) ? "Needs review" : "Clear") + '</b></div>';
    } catch (error) {
      box.innerHTML = '<p class="gdr-cc-error">Platform statistics could not be loaded: ' + esc(error.message || "Admin RPC unavailable") + '</p>';
    }
  }

  async function loadSupportTickets() {
    const body = $("#gdrCcSupportBody");
    if (!body) return;
    body.innerHTML = '<tr><td colspan="6">Loading support tickets…</td></tr>';
    try {
      const status = $("#gdrCcTicketStatus")?.value || null;
      supportCache = await rpc("admin_list_support_tickets", { p_status: status });
      renderSupportTickets();
    } catch (error) {
      body.innerHTML = '<tr><td colspan="6">Unable to load tickets. ' + esc(error.message || "") + '</td></tr>';
      message($("#gdrCcSupportMessage"), "The support queue could not be loaded.", "error");
    }
  }

  function renderSupportTickets() {
    const body = $("#gdrCcSupportBody");
    if (!body) return;
    const query = ($("#gdrCcTicketSearch")?.value || "").trim().toLowerCase();
    const rows = supportCache.filter(row => !query || [
      row.ticket_code, row.user_name, row.user_email, row.user_phone, row.user_role,
      row.category, row.description, row.status
    ].filter(Boolean).join(" ").toLowerCase().includes(query));
    const openCount = supportCache.filter(row => ["open", "in_progress", "waiting_on_user"].includes(row.status)).length;
    const badge = $("#gdrCcOpenTicketCount");
    if (badge) badge.textContent = String(openCount);
    const summary = $("#gdrCcTicketSummary");
    if (summary) summary.innerHTML =
      '<span><strong>' + esc(openCount) + '</strong> unresolved</span><span><strong>' + esc(supportCache.length) + '</strong> in this view</span>';
    body.innerHTML = rows.length ? rows.map(row =>
      '<tr><td><strong>' + esc(row.ticket_code) + '</strong><br><small>' + esc(when(row.created_at)) + '</small></td>' +
      '<td><strong>' + esc(row.user_name || "User") + '</strong><br><small>' + esc(row.user_role) + ' · ' + esc(row.user_email || "Email not available") + '</small><br><small>' + esc(row.user_phone || "") + '</small></td>' +
      '<td><strong>' + esc(statusLabel(row.category)) + '</strong><br><small>' + esc(row.description.slice(0, 135)) + (row.description.length > 135 ? "…" : "") + '</small></td>' +
      '<td><span class="gdr-cc-status is-' + esc(row.status) + '">' + esc(statusLabel(row.status)) + '</span></td>' +
      '<td>' + esc(when(row.updated_at)) + '</td>' +
      '<td><button type="button" class="gdr-cc-small-button" data-gdr-cc-review-ticket="' + esc(row.id) + '">Review</button></td></tr>'
    ).join("") : '<tr><td colspan="6">No support tickets match this filter. User reports will appear here when submitted.</td></tr>';
  }

  async function openAdminTicket(ticketId) {
    const ticket = supportCache.find(row => String(row.id) === String(ticketId));
    if (!ticket) {
      await loadSupportTickets();
      return openAdminTicket(ticketId);
    }
    activeTicket = ticket;
    const modal = ensureTicketModal();
    const historyBox = $("#gdrCcAdminTicketHistory", modal);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    $("#gdrCcTicketCode", modal).textContent = ticket.ticket_code;
    $("#gdrCcTicketMeta", modal).textContent = ticket.user_name + " · " + ticket.user_role + " · " + (ticket.user_email || "Email unavailable");
    $("#gdrCcTicketDesc", modal).textContent = ticket.description;
    $("#gdrCcTicketPage", modal).textContent = ticket.page_url || "Not supplied";
    $("#gdrCcTicketStatusEdit", modal).value = ticket.status;
    $("#gdrCcTicketAdminNotes", modal).value = ticket.admin_notes || "";
    $("#gdrCcTicketUserMessage", modal).value = "";
    const phone = $("#gdrCcTicketPhone", modal);
    if (phone) phone.textContent = ticket.user_phone || "Phone unavailable";
    const shot = $("#gdrCcTicketScreenshot", modal);
    if (shot) {
      shot.textContent = ticket.screenshot_path ? "Preparing secure screenshot link…" : "No screenshot attached";
      shot.removeAttribute("href");
      shot.hidden = !ticket.screenshot_path;
      if (ticket.screenshot_path) {
        const result = await client().storage.from("support-attachments").createSignedUrl(ticket.screenshot_path, 600);
        if (result.error) shot.textContent = "Screenshot is not available to this admin session";
        else { shot.href = result.data.signedUrl; shot.textContent = "Open private screenshot (10-minute link)"; }
      }
    }
    historyBox.innerHTML = '<p class="gdr-cc-muted">Loading resolution history…</p>';
    try {
      const events = await rpc("admin_get_support_ticket_events", { p_ticket_id: ticket.id });
      historyBox.innerHTML = events.length ? events.map(event =>
        '<article class="gdr-cc-history-item ' + (event.is_internal ? "is-internal" : "") + '"><div><strong>' +
        esc(statusLabel(event.event_type)) + (event.is_internal ? " · Internal" : " · User visible") +
        '</strong><small>' + esc(when(event.created_at)) + '</small></div><p>' + esc(event.message || "") + '</p></article>'
      ).join("") : '<p class="gdr-cc-muted">No additional ticket events.</p>';
    } catch (error) {
      historyBox.innerHTML = '<p class="gdr-cc-error">Unable to load ticket history: ' + esc(error.message || "") + '</p>';
    }
  }

  function ensureTicketModal() {
    let modal = $("#gdrCcAdminTicketModal");
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend",
      '<div id="gdrCcAdminTicketModal" class="gdr-cc-overlay" hidden aria-hidden="true">' +
        '<section class="gdr-cc-dialog" role="dialog" aria-modal="true" aria-labelledby="gdrCcTicketCode">' +
          '<header class="gdr-cc-dialog-head"><div><span class="gdr-cc-eyebrow">SUPPORT CASE</span><h3 id="gdrCcTicketCode">Ticket</h3><p id="gdrCcTicketMeta"></p></div><button type="button" class="gdr-cc-icon-close" data-gdr-cc-close-ticket aria-label="Close">×</button></header>' +
          '<div class="gdr-cc-ticket-facts"><div><small>USER PHONE</small><strong id="gdrCcTicketPhone"></strong></div><div><small>REPORTED PAGE</small><strong id="gdrCcTicketPage"></strong></div></div>' +
          '<div class="gdr-cc-ticket-description" id="gdrCcTicketDesc"></div><a id="gdrCcTicketScreenshot" class="gdr-cc-screenshot-link" target="_blank" rel="noopener noreferrer" hidden></a>' +
          '<form id="gdrCcTicketUpdateForm" class="gdr-cc-ticket-form"><label>Status<select id="gdrCcTicketStatusEdit" required><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_on_user">Waiting on user</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label>' +
          '<label>Internal admin notes<textarea id="gdrCcTicketAdminNotes" maxlength="5000" rows="3" placeholder="Private investigation notes (not visible to the user)"></textarea></label>' +
          '<label>Update for the user<textarea id="gdrCcTicketUserMessage" maxlength="1500" rows="3" placeholder="What the user should know about the fix or next step"></textarea></label>' +
          '<div class="gdr-cc-dialog-actions"><button type="button" class="gdr-cc-quiet-button" data-gdr-cc-close-ticket>Close</button><button type="submit" class="gdr-cc-primary-button" id="gdrCcTicketSave">Save resolution update</button></div><p id="gdrCcTicketUpdateMessage" class="gdr-cc-message" aria-live="polite"></p></form>' +
          '<section class="gdr-cc-history"><div class="gdr-cc-surface-head"><strong>Resolution history</strong><span>Internal notes are marked private</span></div><div id="gdrCcAdminTicketHistory"></div></section>' +
        '</section></div>');
    modal = $("#gdrCcAdminTicketModal");
    modal.addEventListener("click", event => {
      if (event.target === modal || event.target.closest("[data-gdr-cc-close-ticket]")) closeModal(modal);
    });
    $("#gdrCcTicketUpdateForm", modal).addEventListener("submit", async event => {
      event.preventDefault();
      if (!activeTicket) return;
      const save = $("#gdrCcTicketSave", modal);
      save.disabled = true;
      save.textContent = "Saving…";
      message($("#gdrCcTicketUpdateMessage", modal), "", "");
      try {
        const result = await rpc("admin_update_support_ticket", {
          p_ticket_id: activeTicket.id,
          p_status: $("#gdrCcTicketStatusEdit", modal).value,
          p_admin_notes: $("#gdrCcTicketAdminNotes", modal).value,
          p_user_message: $("#gdrCcTicketUserMessage", modal).value
        });
        message($("#gdrCcTicketUpdateMessage", modal), result.ticket_code + " updated successfully. The user-visible update is saved in their support history.", "success");
        await loadSupportTickets();
        const refreshed = supportCache.find(row => String(row.id) === String(activeTicket.id));
        if (refreshed) activeTicket = refreshed;
        await openAdminTicket(activeTicket.id);
      } catch (error) {
        message($("#gdrCcTicketUpdateMessage", modal), error.message || "Could not update this ticket.", "error");
      } finally {
        save.disabled = false;
        save.textContent = "Save resolution update";
      }
    });
    return modal;
  }

  async function loadAudit(append) {
    const body = $("#gdrCcAuditBody");
    if (!body) return;
    if (!append) {
      auditOffset = 0;
      body.innerHTML = '<tr><td colspan="5">Loading audit records…</td></tr>';
    }
    try {
      const query = $("#gdrCcAuditSearch")?.value?.trim() || null;
      const rows = await rpc("admin_get_audit_logs", { p_limit: 50, p_offset: auditOffset, p_query: query });
      if (!append) body.innerHTML = "";
      body.insertAdjacentHTML("beforeend", rows.map(row => {
        const before = row.before_data ? JSON.stringify(row.before_data, null, 2) : "—";
        const after = row.after_data ? JSON.stringify(row.after_data, null, 2) : "—";
        return '<tr><td>' + esc(when(row.created_at)) + '</td><td><strong>' + esc(row.actor_scope) +
          '</strong><br><small>' + esc(row.actor_id || "System") + '</small></td><td>' + esc(row.action) +
          '</td><td><strong>' + esc(row.entity_type) + '</strong><br><small>' + esc(row.entity_id || "—") +
          '</small></td><td><details class="gdr-cc-audit-details"><summary>View field snapshot</summary><div><b>Before</b><pre>' +
          esc(before) + '</pre><b>After</b><pre>' + esc(after) + '</pre></div></details></td></tr>';
      }).join(""));
      if (!rows.length && !append) body.innerHTML = '<tr><td colspan="5">No matching audit records yet.</td></tr>';
      auditOffset += rows.length;
      const count = $("#gdrCcAuditCount");
      if (count) count.textContent = auditOffset + " records loaded";
      const more = $("#gdrCcAuditMore");
      if (more) more.disabled = rows.length < 50;
    } catch (error) {
      body.innerHTML = '<tr><td colspan="5">Audit records could not be loaded: ' + esc(error.message || "") + '</td></tr>';
    }
  }

  async function loadHealth() {
    const cards = $("#gdrCcHealthCards");
    const errorsBody = $("#gdrCcErrorsBody");
    if (!cards) return;
    cards.innerHTML = '<div class="gdr-cc-loading">Running production checks…</div>';
    try {
      const health = await rpc("admin_health_check");
      cards.innerHTML =
        '<article class="gdr-cc-health-card"><span class="gdr-cc-health-dot is-good"></span><div><strong>Supabase database</strong><small>Authenticated admin query completed in ' + esc(health.query_latency_ms) + ' ms</small></div><b>Healthy</b></article>' +
        '<article class="gdr-cc-health-card"><span class="gdr-cc-health-dot is-good"></span><div><strong>Admin authorization</strong><small>Server-side admin membership check</small></div><b>Verified</b></article>' +
        '<article class="gdr-cc-health-card"><span class="gdr-cc-health-dot is-good"></span><div><strong>Database records</strong><small>' + esc(health.properties_visible) + ' property records responded to the health query</small></div><b>Reachable</b></article>' +
        '<article class="gdr-cc-health-card"><span class="gdr-cc-health-dot is-good"></span><div><strong>Last server check</strong><small>' + esc(when(health.server_time)) + '</small></div><b>Live</b></article>';
      const errors = await rpc("admin_get_client_errors", { p_limit: 50 });
      if (errorsBody) errorsBody.innerHTML = errors.length ? errors.map(row =>
        '<tr><td>' + esc(when(row.created_at)) + '</td><td>' + esc(row.error_type) +
        '</td><td>' + esc(row.message) + '</td><td><small>' + esc(row.page_url || "—") + '</small></td></tr>'
      ).join("") : '<tr><td colspan="4">No client errors have been reported in the monitored period.</td></tr>';
    } catch (error) {
      cards.innerHTML = '<article class="gdr-cc-health-card is-error"><span class="gdr-cc-health-dot is-bad"></span><div><strong>Health check failed</strong><small>' + esc(error.message || "") + '</small></div><b>Attention</b></article>';
      if (errorsBody) errorsBody.innerHTML = '<tr><td colspan="4">Diagnostics unavailable until the admin connection is restored.</td></tr>';
    }
  }

  async function runGlobalSearch(query) {
    const box = $("#gdrCcGlobalResults");
    if (!box) return;
    const term = String(query || "").trim();
    if (term.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = '<div class="gdr-cc-search-hint">Searching live records…</div>';
    try {
      const rows = await rpc("admin_global_search", { p_query: term });
      box.innerHTML = rows.length ? rows.map(row =>
        '<button type="button" class="gdr-cc-search-result" data-gdr-cc-open-entity="' + esc(row.entity_type) +
        '" data-gdr-cc-entity-id="' + esc(row.entity_id) + '" data-gdr-cc-title="' + esc(row.title) + '">' +
        '<span class="gdr-cc-search-type">' + esc(statusLabel(row.entity_type)) + '</span><span><strong>' +
        esc(row.title) + '</strong><small>' + esc(row.detail || "") + '</small></span><em>' + esc(row.status || "") + '</em></button>'
      ).join("") : '<div class="gdr-cc-search-hint">No matching records found.</div>';
    } catch (error) {
      box.innerHTML = '<div class="gdr-cc-search-hint is-error">' + esc(error.message || "Search unavailable") + '</div>';
    }
  }

  function switchAdminTab(name) {
    const dash = adminDashboard();
    if (!dash) return;
    $$(".gd-admin-tab", dash).forEach(button => button.classList.toggle("active", button.dataset.adminTab === name));
    $$(".gd-admin-panel", dash).forEach(panel => panel.classList.toggle("active", panel.id === "adminPanel" + name[0].toUpperCase() + name.slice(1)));
  }

  function openGlobalResult(row) {
    const id = row.entity_id;
    if (row.entity_type === "support_ticket") {
      switchAdminTab("support");
      loadSupportTickets().then(() => openAdminTicket(id));
      $("#gdrCcGlobalResults").hidden = true;
      return;
    }
    const tabMap = { owner: "owners", renter: "renters", property: "properties", visit: "visits" };
    const target = tabMap[row.entity_type];
    if (!target) return;
    switchAdminTab(target);
    const searchId = {
      owner: "adminOwnerSearch", renter: "adminRenterSearch",
      property: "adminPropertySearch", visit: "adminVisitSearch"
    }[row.entity_type];
    const input = $("#" + searchId);
    if (input) {
      input.value = row.title || id;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      window.setTimeout(() => { if (input.value) input.value = id; input.dispatchEvent(new Event("input", { bubbles: true })); }, 120);
    }
    if (row.entity_type === "property" && typeof window.openAdminPropertyEditor === "function") {
      window.openAdminPropertyEditor(id);
    }
    if (row.entity_type === "owner" && typeof window.openAdminOwnerEditor === "function") {
      window.openAdminOwnerEditor(id);
    }
    $("#gdrCcGlobalResults").hidden = true;
  }

  async function verifyAdminAndLoad() {
    if (!isAdminVisible() || !client()) return;
    try {
      const health = await rpc("admin_health_check");
      adminVerified = !!health.authenticated_admin;
      if (!adminVerified) return;
      addAdminTabsAndPanels();
      await loadOverview();
    } catch (error) {
      adminVerified = false;
      console.warn("GharDekho command center could not verify admin access:", error.message || error);
    }
  }

  function observeAdminDashboard() {
    const dash = adminDashboard();
    if (!dash || dash.dataset.gdrCcObserver === "1") return;
    dash.dataset.gdrCcObserver = "1";
    const observer = new MutationObserver(() => {
      if (isAdminVisible() && !adminBound) verifyAdminAndLoad();
    });
    observer.observe(dash, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
    if (isAdminVisible()) verifyAdminAndLoad();
  }

  function ensureUserSupportModal() {
    let modal = $("#gdrUserSupportModal");
    if (modal) return modal;
    document.body.insertAdjacentHTML("beforeend",
      '<div id="gdrUserSupportModal" class="gdr-cc-overlay" hidden aria-hidden="true">' +
        '<section class="gdr-cc-dialog gdr-cc-user-dialog" role="dialog" aria-modal="true" aria-labelledby="gdrUserSupportTitle">' +
          '<header class="gdr-cc-dialog-head"><div><span class="gdr-cc-eyebrow">GHARDEKHO SUPPORT</span><h3 id="gdrUserSupportTitle">Report a problem</h3><p>Tell our support team what went wrong. Your account and the current page will be attached to the report.</p></div><button type="button" class="gdr-cc-icon-close" data-gdr-user-support-close aria-label="Close">×</button></header>' +
          '<div class="gdr-cc-user-toolbar"><span id="gdrUserSupportRole" class="gdr-cc-role-pill">Account</span><button type="button" class="gdr-cc-quiet-button" id="gdrUserShowTickets">My previous reports</button></div>' +
          '<form id="gdrUserSupportForm" class="gdr-cc-ticket-form"><label>Issue category<select id="gdrUserSupportCategory" required>' +
            '<option value="login_registration">Login or registration</option><option value="profile">Profile editing</option><option value="property_listing">Property listing</option><option value="property_editing">Property editing</option><option value="image_upload">Image upload</option><option value="map_location">Map or location</option><option value="search_filter">Search or filters</option><option value="booking_visit">Booking or visit request</option><option value="payment">Payment related</option><option value="dashboard_loading">Dashboard loading</option><option value="broken_button">Broken button or control</option><option value="missing_record">Missing record</option><option value="incorrect_information">Incorrect information</option><option value="other">Other</option>' +
          '</select></label><label>Describe the problem<textarea id="gdrUserSupportDescription" required minlength="10" maxlength="5000" rows="5" placeholder="What did you do, what happened, and what did you expect?"></textarea></label>' +
          '<label>Screenshot (optional)<input id="gdrUserSupportScreenshot" type="file" accept="image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP · maximum 3 MB. Do not upload passwords, OTPs or payment credentials.</small></label>' +
          '<div class="gdr-cc-dialog-actions"><button type="button" class="gdr-cc-quiet-button" data-gdr-user-support-close>Close</button><button type="submit" id="gdrUserSupportSubmit" class="gdr-cc-primary-button">Submit support request</button></div><p id="gdrUserSupportMessage" class="gdr-cc-message" aria-live="polite"></p></form>' +
          '<section class="gdr-cc-history"><div class="gdr-cc-surface-head"><strong>My support reports</strong><span>Private to your signed-in account</span></div><div id="gdrMySupportTickets"><p class="gdr-cc-muted">Loading your reports…</p></div></section>' +
        '</section></div>');
    modal = $("#gdrUserSupportModal");
    modal.addEventListener("click", event => {
      if (event.target === modal || event.target.closest("[data-gdr-user-support-close]")) closeModal(modal);
    });
    $("#gdrUserShowTickets", modal).addEventListener("click", loadMySupportTickets);
    $("#gdrUserSupportForm", modal).addEventListener("submit", submitUserSupportTicket);
    return modal;
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  async function resolveUserRole(user) {
    if (userRoleCache && userRoleCache.userId === user.id) return userRoleCache.role;
    const supabase = client();
    const [ownerResult, userResult] = await Promise.all([
      supabase.from("owners").select("id").eq("user_id", user.id).limit(1),
      supabase.from("users").select("role,roles").eq("id", user.id).maybeSingle()
    ]);
    if (ownerResult.error) throw ownerResult.error;
    if (userResult.error) throw userResult.error;
    const isOwner = (ownerResult.data || []).length > 0;
    const profile = userResult.data || {};
    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    const isRenter = ["tenant", "renter"].includes(String(profile.role || "").toLowerCase()) ||
      roles.includes("tenant") || roles.includes("renter");
    const active = sessionStorage.getItem("gd_active_role");
    const role = active === "owner" && isOwner ? "owner" :
      active === "renter" && isRenter ? "renter" :
      isOwner ? "owner" : isRenter ? "renter" : null;
    if (!role) throw new Error("This account does not have an active Owner or Renter profile.");
    userRoleCache = { userId: user.id, role };
    return role;
  }

  async function openUserSupport() {
    const supabase = client();
    if (!supabase) return;
    const result = await supabase.auth.getUser();
    if (result.error || !result.data.user) {
      window.alert("Please sign in again before submitting a support request.");
      return;
    }
    userSession = result.data.user;
    const modal = ensureUserSupportModal();
    $("#gdrUserSupportMessage", modal).textContent = "";
    try {
      const role = await resolveUserRole(userSession);
      $("#gdrUserSupportRole", modal).textContent = role === "owner" ? "Owner account" : "Renter account";
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
      await loadMySupportTickets();
    } catch (error) {
      message($("#gdrUserSupportMessage", modal), error.message || "Could not verify your account role.", "error");
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
    }
  }

  async function submitUserSupportTicket(event) {
    event.preventDefault();
    const submit = $("#gdrUserSupportSubmit");
    const output = $("#gdrUserSupportMessage");
    if (!userSession) return message(output, "Please reopen Support and sign in again.", "error");
    const description = $("#gdrUserSupportDescription").value.trim();
    if (description.length < 10) return message(output, "Please describe the problem in at least 10 characters.", "error");
    const file = $("#gdrUserSupportScreenshot").files[0] || null;
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024)) {
      return message(output, "Choose a JPG, PNG or WebP screenshot under 3 MB.", "error");
    }

    submit.disabled = true;
    submit.textContent = "Submitting…";
    message(output, "Creating your support request…", "");
    let uploadedPath = null;
    const ticketId = window.crypto && typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, ch => {
          const r = Math.random() * 16 | 0;
          return (ch === "x" ? r : (r & 3 | 8)).toString(16);
        });

    try {
      const role = await resolveUserRole(userSession);
      if (file) {
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-80) || "screenshot";
        uploadedPath = userSession.id + "/" + ticketId + "/" + Date.now() + "-" + safeName;
        const upload = await client().storage.from("support-attachments").upload(uploadedPath, file, {
          upsert: false, contentType: file.type, cacheControl: "3600"
        });
        if (upload.error) throw upload.error;
      }
      const result = await rpc("create_support_ticket", {
        p_ticket_id: ticketId,
        p_user_role: role,
        p_category: $("#gdrUserSupportCategory").value,
        p_description: description,
        p_page_url: window.location.pathname,
        p_screenshot_path: uploadedPath
      });
      message(output, "Request submitted: " + result.ticket_code + ". You can follow its status below.", "success");
      $("#gdrUserSupportDescription").value = "";
      $("#gdrUserSupportScreenshot").value = "";
      await loadMySupportTickets();
    } catch (error) {
      if (uploadedPath) {
        try { await client().storage.from("support-attachments").remove([uploadedPath]); } catch (_) {}
      }
      message(output, error.message || "Support request could not be submitted. Please try again.", "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Submit support request";
    }
  }

  async function loadMySupportTickets() {
    const box = $("#gdrMySupportTickets");
    if (!box) return;
    box.innerHTML = '<p class="gdr-cc-muted">Loading your reports…</p>';
    try {
      const rows = await rpc("my_support_tickets");
      box.innerHTML = rows.length ? rows.map(row =>
        '<article class="gdr-cc-user-ticket"><div><strong>' + esc(row.ticket_code) + '</strong><span class="gdr-cc-status is-' + esc(row.status) + '">' + esc(statusLabel(row.status)) +
        '</span></div><p>' + esc(statusLabel(row.category)) + ' · ' + esc(row.description.slice(0, 180)) + (row.description.length > 180 ? "…" : "") +
        '</p><small>Updated ' + esc(when(row.updated_at)) + '</small>' +
        (row.last_user_message ? '<p class="gdr-cc-user-update"><strong>Latest update:</strong> ' + esc(row.last_user_message) + '</p>' : '') +
        '<button type="button" class="gdr-cc-text-button" data-gdr-user-ticket-events="' + esc(row.id) + '">View updates</button><div class="gdr-cc-user-events" id="gdrUserEvents-' + esc(row.id) + '" hidden></div></article>'
      ).join("") : '<p class="gdr-cc-muted">You have not submitted a support report yet.</p>';
    } catch (error) {
      box.innerHTML = '<p class="gdr-cc-error">Your support history could not be loaded: ' + esc(error.message || "") + '</p>';
    }
  }

  async function loadUserTicketEvents(ticketId) {
    const box = $("#gdrUserEvents-" + CSS.escape(ticketId));
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<p class="gdr-cc-muted">Loading updates…</p>';
    try {
      const rows = await rpc("my_support_ticket_events", { p_ticket_id: ticketId });
      box.innerHTML = rows.length ? rows.map(row =>
        '<article><strong>' + esc(statusLabel(row.event_type)) + '</strong><small>' + esc(when(row.created_at)) +
        '</small><p>' + esc(row.message || "") + '</p></article>'
      ).join("") : '<p class="gdr-cc-muted">No user-visible updates yet.</p>';
    } catch (error) {
      box.innerHTML = '<p class="gdr-cc-error">' + esc(error.message || "Could not load ticket updates") + '</p>';
    }
  }

  function addSupportLaunchers() {
    // The Owner Dashboard must not expose the retired Report a Problem action.
    // Remove any already-rendered copy before handling renter support.
    const ownerDashboard = $("#ownerDashboard");
    if (ownerDashboard) {
      ownerDashboard
        .querySelectorAll("[data-gdr-user-support-launch],.gdr-cc-support-launch")
        .forEach(button => button.remove());
    }

    // Keep the dedicated support entry point for renters only.
    const dash = $("#renterDashboard");
    if (!dash || $("[data-gdr-user-support-launch]", dash)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gdr-cc-support-launch";
    button.setAttribute("data-gdr-user-support-launch", "1");
    button.innerHTML = '<span aria-hidden="true">?</span><span><strong>Report a problem</strong><small>Contact GharDekho support</small></span>';
    button.addEventListener("click", openUserSupport);
    const heading = $(".dashboard-heading", dash) || dash.firstElementChild;
    if (heading) heading.insertAdjacentElement("afterend", button);
    else dash.prepend(button);
  }

  function sanitizeError(value) {
    return String(value || "Unknown client error")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/\b[6-9]\d{9}\b/g, "[phone]")
      .replace(/\b(?:bearer|token|password|authorization|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, "[redacted]")
      .replace(/[\r\n\t]+/g, " ")
      .slice(0, 450);
  }

  async function reportClientError(type, rawMessage) {
    const supabase = client();
    if (!supabase) return;
    const sanitized = sanitizeError(rawMessage);
    const stamp = type + ":" + sanitized;
    const now = Date.now();
    if (recentClientErrors.has(stamp) && now - recentClientErrors.get(stamp) < 60000) return;
    recentClientErrors.set(stamp, now);
    if (recentClientErrors.size > 30) recentClientErrors.clear();
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session || session.data.session.user.id !== userSession?.id) {
        userSession = session.data.session?.user || null;
      }
      if (!userSession) return;
      await supabase.rpc("report_client_error", {
        p_error_type: type,
        p_message: sanitized,
        p_page_url: window.location.pathname,
        p_user_agent: navigator.userAgent.slice(0, 300)
      });
    } catch (_) {
      // Diagnostics are best-effort and must never interrupt the application.
    }
  }

  function bindClientDiagnostics() {
    if (window.__gdrClientDiagnosticsBound) return;
    window.__gdrClientDiagnosticsBound = true;
    window.addEventListener("error", event => {
      reportClientError("javascript_error", event.message || "Uncaught browser error");
    });
    window.addEventListener("unhandledrejection", event => {
      const reason = event.reason;
      reportClientError("unhandled_rejection", reason && reason.message ? reason.message : reason || "Unhandled promise rejection");
    });
  }

  function bindAuth() {
    const supabase = client();
    if (!supabase || authSubscription) return;
    const result = supabase.auth.onAuthStateChange((event, session) => {
      userSession = session?.user || null;
      userRoleCache = null;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") addSupportLaunchers();
    });
    authSubscription = result.data?.subscription || true;
    supabase.auth.getUser().then(result => {
      userSession = result.data?.user || null;
      if (userSession) addSupportLaunchers();
    }).catch(() => {});
  }

  document.addEventListener("click", event => {
    const history = event.target.closest("[data-gdr-user-ticket-events]");
    if (history) loadUserTicketEvents(history.dataset.gdrUserTicketEvents);
  });

  function init() {
    bindAuth();
    bindClientDiagnostics();
    addSupportLaunchers();
    observeAdminDashboard();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  window.addEventListener("pageshow", init);
  window.GDRAdminCommandCenter = {
    refresh: verifyAdminAndLoad,
    loadSupportTickets,
    loadAudit,
    loadHealth
  };
})();