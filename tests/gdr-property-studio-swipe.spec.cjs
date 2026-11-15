const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "assets/gdr-property-studio.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/gdr-property-studio.css"), "utf8");
const start = source.indexOf("function initStepSwipe(root){");
const end = source.indexOf("\nasync function getOwner(){", start);
if (start < 0 || end <= start) throw new Error("Could not extract the Property Studio swipe controller.");
const swipeFunction = source.slice(start, end);

test("Property Studio finger gestures work in both directions on common mobile widths", async ({ page }) => {
  for (const width of [320, 360, 375, 390, 414, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.setContent("<!doctype html><html><head><style>"+css+"</style></head><body><div id='gdrPropertyStudio'><main id='root'><div id='gdrStudioPanelStage' class='gdr-studio-panel-stage'></div></main></div></body></html>");
    const result = await page.evaluate(({ swipeFunction }) => {
      const root = document.querySelector("#root");
      const stage = document.querySelector("#gdrStudioPanelStage");
      const state = { step: 0, transitions: [], invalidStep: -1 };
      for (let i = 0; i < 5; i++) {
        const panel = document.createElement("section");
        panel.className = "gdr-studio-panel";
        panel.dataset.gdrStudioPanel = String(i);
        panel.hidden = i !== 0;
        panel.style.minHeight = "500px";
        panel.innerHTML = "<div>Step "+(i+1)+"</div>";
        if (i === 0) panel.innerHTML += "<button class='gdr-studio-choice' id='choice'>Apartment</button>";
        if (i === 1) panel.innerHTML += "<input id='rent' inputmode='numeric'>";
        if (i === 2) panel.innerHTML += "<div class='leaflet-container' id='map'></div>";
        stage.appendChild(panel);
      }
      const $ = (selector, scope = document) => scope.querySelector(selector);
      const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
      const goToStep = (requested, source, offset) => {
        const target = Math.min(4, Math.max(0, Math.trunc(requested)));
        if (target === state.step || (target > state.step && state.invalidStep === state.step)) return false;
        const from = state.step;
        state.step = target;
        state.transitions.push({ from, target, source, offset });
        $$("#gdrStudioPanelStage [data-gdr-studio-panel]").forEach(panel => {
          panel.hidden = Number(panel.dataset.gdrStudioPanel) !== target;
        });
        return true;
      };
      const create = new Function(
        "window","document","$","$$","studio","state","goToStep","STUDIO_SWIPE_THRESHOLD",
        "let swipeGesture=null,swipeSnapTimer=null,swipeChoiceClickGuard=null,swipeChoiceClickTimer=null;\n"+
        swipeFunction+"\nreturn initStepSwipe;"
      );
      const init = create(window,document,$,$$,()=>root,state,goToStep,72);
      init(root);

      function touch(type, target, x, y, id = 1) {
        const event = new Event(type, { bubbles: true, cancelable: true });
        const item = { identifier: id, clientX: x, clientY: y };
        Object.defineProperty(event, "touches", { value: type === "touchend" || type === "touchcancel" ? [] : [item] });
        Object.defineProperty(event, "changedTouches", { value: [item] });
        target.dispatchEvent(event);
        return event.defaultPrevented;
      }
      const panel0 = stage.querySelector('[data-gdr-studio-panel="0"]');
      const startShort = touch("touchstart", panel0, 260, 200);
      touch("touchmove", panel0, 225, 204);
      touch("touchend", panel0, 225, 204);
      const shortStayed = state.step === 0;

      const verticalStart = touch("touchstart", panel0, 180, 180);
      const verticalMovePrevented = touch("touchmove", panel0, 184, 280);
      touch("touchend", panel0, 184, 280);
      const verticalStayed = state.step === 0 && !verticalMovePrevented;

      const leftStart = touch("touchstart", panel0, 300, 180);
      touch("touchmove", panel0, 190, 182);
      touch("touchend", panel0, 190, 182);
      const leftAdvanced = state.step === 1 && state.transitions.at(-1).source === "swipe";

      const input = stage.querySelector("#rent");
      const inputBefore = state.step;
      touch("touchstart", input, 300, 180);
      touch("touchmove", input, 180, 181);
      touch("touchend", input, 180, 181);
      const inputProtected = state.step === inputBefore;

      const rightStart = touch("touchstart", stage.querySelector('[data-gdr-studio-panel="1"]'), 180, 180);
      touch("touchmove", stage.querySelector('[data-gdr-studio-panel="1"]'), 290, 182);
      touch("touchend", stage.querySelector('[data-gdr-studio-panel="1"]'), 290, 182);
      const rightReturned = state.step === 0;

      state.invalidStep = 0;
      touch("touchstart", panel0, 300, 180);
      touch("touchmove", panel0, 190, 182);
      touch("touchend", panel0, 190, 182);
      const validationBlocked = state.step === 0;
      state.invalidStep = -1;

      return {
        width: window.innerWidth,
        shortStayed,verticalStayed,leftAdvanced,inputProtected,rightReturned,validationBlocked,
        transitions: state.transitions,
        scrollWidth: document.documentElement.scrollWidth
      };
    }, { swipeFunction });

    expect(result.shortStayed, "short movement must not change steps at "+width+"px").toBe(true);
    expect(result.verticalStayed, "vertical scroll must not change steps at "+width+"px").toBe(true);
    expect(result.leftAdvanced, "left swipe must advance at "+width+"px").toBe(true);
    expect(result.inputProtected, "input must retain native touch at "+width+"px").toBe(true);
    expect(result.rightReturned, "right swipe must return at "+width+"px").toBe(true);
    expect(result.validationBlocked, "validation must block an invalid forward swipe at "+width+"px").toBe(true);
    expect(result.scrollWidth).toBeLessThanOrEqual(width+1);
  }
});
