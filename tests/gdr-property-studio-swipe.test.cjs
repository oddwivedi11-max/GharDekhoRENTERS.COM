const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const studio = read("assets/gdr-property-studio.js");
const markup = read("assets/gdr-property-studio.txt");
const css = read("assets/gdr-property-studio.css");

test("Property Studio has five swipeable steps and a single guarded gesture controller", () => {
  const steps = Array.from(markup.matchAll(/data-gdr-studio-panel="([0-4])"/g)).map(match => Number(match[1]));
  assert.deepEqual(steps, [0, 1, 2, 3, 4]);
  assert.match(studio, /const STUDIO_SWIPE_THRESHOLD=56/);
  assert.match(studio, /function initStepSwipe\(root\)/);
  assert.match(studio, /stage\.dataset\.gdrSwipeBound==="1"/);
  assert.match(studio, /initStepSwipe\(root\);/);
});

test("Swipe direction follows the user's finger and both panels track together", () => {
  assert.match(studio, /const direction=dx<0\?"next":"previous"/);
  assert.match(studio, /const targetStep=state\.step\+\(direction==="next"\?1:-1\)/);
  assert.match(studio, /gesture\.panel\.style\.transform="translate3d\("\+activeOffset\+"px,0,0\)"/);
  assert.match(studio, /const incomingOffset=\(direction==="next"\?width:-width\)\+travel/);
  assert.match(studio, /candidate\.style\.transform="translate3d\("\+incomingOffset\+"px,0,0\)"/);
  assert.match(studio, /goToStep\(state\.step\+\(gesture\.deltaX<0\?1:-1\),"swipe",gesture\.deltaX\)/);
  assert.match(css, /--gdr-step-swipe-end-x/);
  assert.match(css, /--gdr-step-enter-start-x/);
});

test("Swipe forward uses existing step validation and cannot publish from the final step", () => {
  assert.match(studio, /if\(target>state\.step&&!validateStep\(state\.step\)\)return false/);
  assert.match(studio, /const target=Math\.min\(4,Math\.max\(0,Math\.trunc\(requested\)\)\)/);
  assert.match(studio, /if\(target===state\.step\)return false/);
  assert.match(studio, /if\(publish\)publish\.hidden=state\.step!==4/);
});

test("Vertical scrolling, native controls, maps, uploads and horizontal galleries are not intercepted", () => {
  const controllerStart = studio.indexOf("function initStepSwipe(root){");
  const controllerEnd = studio.indexOf("\nasync function getOwner(){", controllerStart);
  const controller = studio.slice(controllerStart, controllerEnd);
  for (const selector of [
    '"input"', '"textarea"', '"select"', '"button:not(.gdr-studio-choice)"',
    '"#gdrStudioMapHost"', '".leaflet-container"', '".leaflet-control-container"',
    '".gdr-studio-photo-categories"', '"[data-gdr-studio-photo-upload]"',
    '"[data-gdr-studio-photo-camera]"', '"[data-native-horizontal-scroll]"'
  ]) assert.ok(controller.includes(selector), selector);
  assert.match(controller, /if\(event&&event\.cancelable&&typeof event\.preventDefault==="function"\)event\.preventDefault\(\)/);
  assert.match(controller, /if\(gesture\.axis!=="horizontal"\)return/);
  assert.doesNotMatch(controller, /"label"/);
  assert.match(controller, /if\(Math\.abs\(dx\)>Math\.abs\(dy\)\*1\.15\)/);
  assert.match(controller, /else if\(Math\.abs\(dy\)>Math\.abs\(dx\)\*1\.15\)/);
  assert.match(controller, /if\(!event\.touches\|\|event\.touches\.length!==1\)/);
  assert.match(css, /touch-action:auto/);
});

test("Swipe cancellation restores panels and motion respects reduced-motion preferences", () => {
  assert.match(studio, /function springBack\(panel,preview,direction,width\)/);
  assert.match(studio, /function cancel\(\)/);
  assert.match(studio, /stage\.addEventListener\("touchcancel"/);
  assert.match(studio, /stage\.addEventListener\("pointercancel"/);
  assert.match(studio, /lostpointercapture/);
  assert.ok(studio.includes("(prefers-reduced-motion: reduce)"));
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("The swipe transition clips horizontal motion and does not create page overflow", () => {
  assert.match(css, /\.gdr-studio-panel-stage\.is-transitioning\{clip-path:inset\(0\)\}/);
  assert.match(css, /\.gdr-studio-panel-stage\.is-swipe-dragging\{clip-path:inset\(0\)\}/);
  assert.match(css, /overflow-wrap:anywhere/);
});
