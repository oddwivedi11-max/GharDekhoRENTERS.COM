const {test,expect}=require("@playwright/test");
async function openStudio(page){
 await page.goto("/",{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>window.GDRPropertyStudio&&typeof window.GDRPropertyStudio.open==="function");
 await page.waitForFunction(()=>document.getElementById("gdrPropertyStudio"));
 await page.evaluate(()=>{
  const shell=document.getElementById("dashboardSection");
  if(shell){shell.hidden=false;shell.style.display="block";shell.setAttribute("aria-hidden","false");}
  const dashboard=document.getElementById("ownerDashboard");
  if(dashboard){dashboard.hidden=false;dashboard.classList.add("active");dashboard.style.display="block";dashboard.setAttribute("aria-hidden","true");}
  window.__gdrSupabaseClient={
   auth:{getUser:async()=>({data:{user:{id:"gdr-studio-swipe-test-user"}},error:null})},
   from:table=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==="owners"?{id:"gdr-studio-swipe-test-owner",name:"Swipe QA Owner"}:null,error:null})})
  };
 });
 await page.locator("#gdrListPropertyStart").click();
 await expect(page.locator("#gdrPropertyStudio")).toBeVisible();
 await expect(page.locator("#gdrStudioPanelStage")).toBeVisible();
}
async function dispatchTouchSwipe(page,selector,deltaX,deltaY=0){
 await page.locator(selector).evaluate((target,{deltaX,deltaY})=>{
  const stage=target.closest("#gdrStudioPanelStage");
  if(!stage)throw new Error("Swipe target is not inside the Property Studio step stage.");
  const rect=target.getBoundingClientRect(),x=rect.left+Math.min(18,Math.max(6,rect.width*.12)),y=rect.top+Math.min(14,Math.max(6,rect.height*.5));
  const makeTouch=(clientX,clientY)=>new Touch({identifier:71,target,clientX,clientY,screenX:clientX,screenY:clientY,pageX:clientX,pageY:clientY,radiusX:4,radiusY:4,rotationAngle:0,force:.5});
  const start=makeTouch(x,y);
  target.dispatchEvent(new TouchEvent("touchstart",{touches:[start],targetTouches:[start],changedTouches:[start],bubbles:true,cancelable:true}));
  const moved=makeTouch(x+deltaX,y+deltaY);
  stage.dispatchEvent(new TouchEvent("touchmove",{touches:[moved],targetTouches:[moved],changedTouches:[moved],bubbles:true,cancelable:true}));
  const end=makeTouch(x+deltaX,y+deltaY);
  stage.dispatchEvent(new TouchEvent("touchend",{touches:[],targetTouches:[],changedTouches:[end],bubbles:true,cancelable:true}));
 },{deltaX,deltaY});
}
async function waitForStepAnimation(page){await expect(page.locator("#gdrStudioPanelStage")).not.toHaveClass(/is-transitioning/);}
test.describe("Property Studio horizontal swipe navigation",()=>{
 test("left advances, right returns, validation is respected and entered data is retained",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openStudio(page);
  const propertyTitle='[data-gdr-studio-panel="0"] > h2.gdr-studio-panel-title';
  await dispatchTouchSwipe(page,propertyTitle,-110);
  await expect(page.locator('[data-gdr-studio-panel="0"]')).toBeVisible();
  await expect(page.locator("#gdrStudioMessage")).toContainText("Please choose your property type");
  const room=page.locator('[data-gdr-property-type="room"]');
  await room.click();
  await expect(room).toHaveAttribute("aria-pressed","true");
  await dispatchTouchSwipe(page,'[data-gdr-property-type="room"]',-118);
  await expect(page.locator('[data-gdr-studio-panel="1"]')).toBeVisible();
  await waitForStepAnimation(page);
  await expect(page.locator("#gdrStudioNavStep")).toHaveText("2");
  await dispatchTouchSwipe(page,'[data-gdr-studio-panel="1"] > h2.gdr-studio-panel-title',112);
  await expect(page.locator('[data-gdr-studio-panel="0"]')).toBeVisible();
  await waitForStepAnimation(page);
  await expect(page.locator('[data-gdr-property-type="room"]')).toHaveAttribute("aria-pressed","true");
  await page.locator("#gdrStudioFormNext").click();
  await expect(page.locator('[data-gdr-studio-panel="1"]')).toBeVisible();
  await waitForStepAnimation(page);
  await dispatchTouchSwipe(page,"#gdrStudioRent",-120);
  await expect(page.locator('[data-gdr-studio-panel="1"]')).toBeVisible();
  await expect(page.locator('[data-gdr-studio-panel="2"]')).toBeHidden();
  await page.locator("#gdrStudioRent").fill("8000");
  await dispatchTouchSwipe(page,'[data-gdr-studio-panel="1"] > h2.gdr-studio-panel-title',-120);
  await expect(page.locator('[data-gdr-studio-panel="2"]')).toBeVisible();
  await waitForStepAnimation(page);
  await expect(page.locator("#gdrStudioNavStep")).toHaveText("3");
 });
 test("vertical gestures do not navigate and phone widths have no horizontal overflow",async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await openStudio(page);
  await page.locator('[data-gdr-property-type="room"]').click();
  await dispatchTouchSwipe(page,'[data-gdr-studio-panel="0"] > h2.gdr-studio-panel-title',7,125);
  await expect(page.locator('[data-gdr-studio-panel="0"]')).toBeVisible();
  await expect(page.locator("#gdrStudioNavStep")).toHaveText("1");
  for(const width of [320,360,375,390,414,430]){
   await page.setViewportSize({width,height:812});
   const sizes=await page.evaluate(()=>({viewport:window.innerWidth,document:document.documentElement.scrollWidth,studio:document.querySelector("#gdrPropertyStudio").scrollWidth,stage:document.querySelector("#gdrStudioPanelStage").scrollWidth,stageClient:document.querySelector("#gdrStudioPanelStage").clientWidth}));
   expect(sizes.document).toBeLessThanOrEqual(sizes.viewport+1);
   expect(sizes.studio).toBeLessThanOrEqual(sizes.viewport+1);
   expect(sizes.stage).toBeLessThanOrEqual(sizes.stageClient+1);
  }
 });
 test("desktop mouse drag uses the same horizontal navigation",async({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await openStudio(page);
  await page.locator('[data-gdr-property-type="room"]').click();
  const title=page.locator('[data-gdr-studio-panel="0"] > h2.gdr-studio-panel-title');
  const box=await title.boundingBox(),x=box.x+12,y=box.y+box.height/2;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-115,y,{steps:5});await page.mouse.up();
  await expect(page.locator('[data-gdr-studio-panel="1"]')).toBeVisible();
  await waitForStepAnimation(page);
 });
});
