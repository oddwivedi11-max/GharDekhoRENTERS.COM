/* GharDekho renter location autocomplete — relevant India-first suggestions.
 * Uses the existing Photon geocoder; selection fills the existing search field only.
 * Does not fabricate locations or change property inventory/filter semantics.
 */
(function () {
  "use strict";
  const INPUT_ID = "renterSearchLocation";
  let timer = null;
  let controller = null;
  let inputRef = null;
  let activeIndex = -1;

  function labelFor(p) {
    const parts = [
      p.name,
      p.street && p.street !== p.name ? p.street : "",
      p.locality,
      p.district,
      p.city,
      p.state,
      p.postcode,
      p.country
    ].map(v => String(v || "").trim()).filter(Boolean);
    return parts.filter((v, i) => parts.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i).join(", ");
  }

  function getUI(input) {
    let list = document.getElementById("gdrRenterLocationSuggestions");
    if (!list) {
      list = document.createElement("div");
      list.id = "gdrRenterLocationSuggestions";
      list.setAttribute("role", "listbox");
      list.hidden = true;
      input.insertAdjacentElement("afterend", list);
    }
    let status = document.getElementById("gdrRenterLocationSuggestionStatus");
    if (!status) {
      status = document.createElement("div");
      status.id = "gdrRenterLocationSuggestionStatus";
      status.setAttribute("aria-live", "polite");
      list.insertAdjacentElement("afterend", status);
    }
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", list.id);
    return { list, status };
  }

  function close(ui) {
    ui.list.hidden = true;
    activeIndex = -1;
    inputRef?.setAttribute("aria-expanded", "false");
  }

  function select(input, ui, item) {
    input.value = item.label;
    input.dataset.gdrLocationSelected = "1";
    close(ui);
    ui.status.textContent = "Location selected. Press Find homes to apply this location.";
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function search(input, query, ui) {
    if (controller) controller.abort();
    controller = new AbortController();
    ui.list.replaceChildren();
    ui.list.hidden = false;
    ui.status.textContent = "Finding matching Indian locations…";
    try {
      const url = "https://photon.komoot.io/api/?limit=12&lang=en&osm_tag=place:city&osm_tag=place:town&osm_tag=place:suburb&osm_tag=place:neighbourhood&osm_tag=place:village&countrycode=in&q=" + encodeURIComponent(query);
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Location service returned " + response.status);
      const data = await response.json();
      const features = (Array.isArray(data.features) ? data.features : [])
        .filter(f => f?.properties && f?.geometry?.coordinates?.length >= 2)
        .map(f => {
          const p = f.properties;
          return { label: labelFor(p), country: String(p.countrycode || "").toLowerCase(), p };
        })
        .filter(x => x.label && (!x.country || x.country === "in"))
        .sort((a, b) => {
          const q = query.toLowerCase();
          const aName = String(a.p.name || "").toLowerCase();
          const bName = String(b.p.name || "").toLowerCase();
          const score = x => x.label.toLowerCase() === q ? 0 : x.label.toLowerCase().startsWith(q) ? 1 : x.p.name && String(x.p.name).toLowerCase().startsWith(q) ? 2 : 3;
          return score(a) - score(b) || a.label.localeCompare(b.label);
        });
      const seen = new Set();
      const unique = features.filter(x => {
        const key = x.label.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 8);
      if (!unique.length) {
        close(ui);
        ui.status.textContent = "No matching Indian location found. Try adding the city or PIN code.";
        return;
      }
      unique.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", "false");
        button.dataset.index = String(index);
        const title = document.createElement("strong");
        title.textContent = item.label;
        const subtitle = document.createElement("small");
        subtitle.textContent = [item.p.city, item.p.state, item.p.postcode].filter(Boolean).join(" · ") || "India";
        button.append(title, subtitle);
        button.addEventListener("click", () => select(input, ui, item));
        ui.list.appendChild(button);
      });
      ui.list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      ui.status.textContent = "Choose a suggestion, or keep typing to refine your search.";
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("GharDekho renter location suggestions unavailable:", error);
      close(ui);
      ui.status.textContent = "Location suggestions are temporarily unavailable. You can still enter the area, city or PIN code manually.";
    }
  }

  function bind() {
    const input = document.getElementById(INPUT_ID);
    if (!input || input === inputRef) return;
    inputRef = input;
    const ui = getUI(input);
    input.addEventListener("input", () => {
      delete input.dataset.gdrLocationSelected;
      if (timer) clearTimeout(timer);
      const query = input.value.trim();
      if (query.length < 3) {
        close(ui);
        ui.status.textContent = query ? "Type at least 3 characters for suggestions." : "";
        return;
      }
      timer = setTimeout(() => search(input, query, ui), 300);
    });
    input.addEventListener("keydown", event => {
      const options = Array.from(ui.list.querySelectorAll('button[role="option"]'));
      if (ui.list.hidden || !options.length) {
        if (event.key === "Escape") close(ui);
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
        options.forEach((option, i) => {
          option.setAttribute("aria-selected", String(i === activeIndex));
          if (i === activeIndex) option.scrollIntoView({ block: "nearest" });
        });
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        options[activeIndex].click();
      } else if (event.key === "Escape") close(ui);
    });
    input.addEventListener("focus", () => {
      if (ui.list.childElementCount && input.value.trim().length >= 3) {
        ui.list.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }
    });
    document.addEventListener("click", event => {
      if (event.target !== input && !ui.list.contains(event.target)) close(ui);
    });
    input.closest("form")?.addEventListener("submit", () => close(ui));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
  window.addEventListener("load", bind);
})();
