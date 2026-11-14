const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"..","assets","gdr-owner-command-center-hotfix.js"),"utf8");

test("owner counter updates do not rewrite unchanged DOM text",()=>{
 const match=source.match(/function setTextIfChanged\(node,value\)\s*\{[\s\S]*?\n\}/);
 assert.ok(match,"guarded text update helper must exist");
 const helper=vm.runInNewContext(match[0]+"; setTextIfChanged",{});
 let writes=0,current="7";
 const node={get textContent(){return current;},set textContent(value){writes++;current=value;}};
 helper(node,"7");
 assert.equal(writes,0,"identical counter values must not mutate the DOM");
 helper(node,"8");
 assert.equal(writes,1,"a changed counter value should update the DOM once");
 helper(node,"8");
 assert.equal(writes,1,"repeated observer callbacks must not cause another write");
});

test("all owner dashboard counters use the guarded updater",()=>{
 const start=source.indexOf("function updateCounts(dash)");
 const end=source.indexOf("\nfunction openExternal",start);
 assert.notEqual(start,-1);assert.notEqual(end,-1);
 const body=source.slice(start,end);
 assert.match(body,/setTextIfChanged\(pc,p\)/);
 assert.match(body,/setTextIfChanged\(rc,renterCount\(\)\)/);
 assert.match(body,/setTextIfChanged\(vc,v\)/);
 assert.doesNotMatch(body,/\b(?:pc|rc|vc)\.textContent\s*=/);
});

test("renter count safely handles a missing occupancy list",()=>{
 const start=source.indexOf("function renterCount()");
 const end=source.indexOf("\n",start);
 assert.notEqual(start,-1,"renterCount helper must exist");
 const body=source.slice(start,end);
 assert.match(body,/document\.querySelectorAll\(/,"renterCount must count a collection safely");
 assert.doesNotMatch(body,/document\.querySelector\([^)]*\)\.length/,"renterCount must not read length from a single element");
});


test("owner dashboard observer batches only relevant mutations",()=>{
 assert.match(source,/function hasRelevantOwnerMutation\(records\)/);
 assert.match(source,/function scheduleOwnerCountRefresh\(\)/);
 assert.match(source,/if\(!hasRelevantOwnerMutation\(records\)\)return/);
 assert.match(source,/window\.requestAnimationFrame\(run\)/);
 assert.match(source,/observer\.observe\(dash,\{childList:true,subtree:true,characterData:true\}\)/);
});
test("empty-state messages do not rewrite identical text during observer refresh",()=>{
 assert.match(source,/empty\.textContent!==emptyMessage/);
 assert.match(source,/empty\.textContent!=="No pending visit requests right now\."/);
});
