/* GharDekho PIN-code search resolver.
 * Converts a six-digit Indian PIN into a real India Post locality before the
 * existing renter search runs. Does not invent listings or alter inventory.
 */
(function () {
  "use strict";
  const INPUT_ID = "renterSearchLocation";
  const PIN_RE = /^\\d{6}$/;
  let resolving = false;

  function statusNode(input) {
    let node = document.getElementById("gdrPinSearchStatus");
    if (!node) {
      node = document.createElement("p");
      node.id = "gdrPinSearchStatus";
      node.setAttribute("role", "status");
      node.setAttribute("aria-live", "polite");
      node.style.cssText = "font-size:.85rem;margin:6px 0;color:#176b63";
      input.insertAdjacentElement("afterend", node);
    }
    return node;
  }

  function bind() {
    const input = document.getElementById(INPUT_ID);
    if (!input || input.dataset.gdrPinResolverBound === "1") return;
    input.dataset.gdrPinResolverBound = "1";
    const form = input.closest("form");
    if (!form) return;
    const status = statusNode(input);

    form.addEventListener("submit", async function (event) {
      const query = input.value.trim();
      if (!PIN_RE.test(query) || resolving) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      resolving = true;
      status.textContent = "PIN code verify kar rahe hain…";
      try {
        const response = await fetch("https://api.postalpincode.in/pincode/" + encodeURIComponent(query), {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Postal lookup failed");
        const payload = await response.json();
        const record = Array.isArray(payload) ? payload[0] : null;
        const offices = record && record.Status === "Success" && Array.isArray(record.PostOffice) ? record.PostOffice : [];
        if (!offices.length) {
          status.textContent = "Is PIN code ka area nahi mila. PIN code check karein ya area/city type karein.";
          return;
        }
        // Use a real locality from the postal response; existing search will
        // match it against property area/address/location fields.
        const office = offices.find(x => x && x.Name) || offices[0];
        const locality = String(office.Name || "").trim();
        if (!locality) throw new Error("No locality in postal response");
        input.value = locality;
        input.dataset.gdrResolvedPin = query;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        status.textContent = "PIN " + query + " ka area " + locality + " mila (" + [office.District, office.State].filter(Boolean).join(", ") + "). Ab area ke available homes dikha rahe hain.";
        // Re-run the normal form submit once the PIN has been resolved.
        resolving = false;
        form.requestSubmit();
      } catch (error) {
        console.warn("GharDekho PIN lookup unavailable:", error);
        status.textContent = "PIN lookup abhi unavailable hai. Area ya city ka naam type karke search karein.";
      } finally {
        resolving = false;
      }
    }, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
  window.addEventListener("load", bind);
})();
