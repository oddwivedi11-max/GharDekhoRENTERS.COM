(function () {
  "use strict";

  async function archiveOwnerProperty(propertyId) {
    const id = String(propertyId || "").trim();
    if (!id) return;
    if (!window.confirm("Remove this property from your inventory? It will disappear from renter search, maps, saved lists and comparisons. Rental and payment history will be preserved.")) return;

    const client = window.__gdrSupabaseClient;
    if (!client || typeof client.rpc !== "function") {
      window.alert("Your session is not ready. Please refresh the dashboard and try again.");
      return;
    }

    try {
      const { error } = await client.rpc("owner_archive_property", { p_property_id: id });
      if (error) throw error;
      window.alert("Property removed from active inventory. Related rental and payment history has been preserved.");
      // Reload all owner/renter inventory sources together so no stale map,
      // saved-property or compare cache can continue showing the archived row.
      window.location.reload();
    } catch (error) {
      console.error("GharDekho property archive failed:", error);
      const message = error && error.message ? error.message : "Could not remove this property. Please try again.";
      if (typeof window.showMessage === "function") {
        try { window.showMessage("backendMessage", message, "error"); } catch (_) { window.alert(message); }
      } else {
        window.alert(message);
      }
    }
  }

  function install() {
    // The existing owner cards call this global handler. Replacing only this
    // handler keeps the current confirmation button and card UI unchanged.
    window.deleteOwnerProperty = archiveOwnerProperty;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
  window.addEventListener("load", install, { once: true });
})();
