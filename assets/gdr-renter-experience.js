(function(){
"use strict";
if(window.GDRRenterExperience)return;
const $=id=>document.getElementById(id),esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={compare:[],parsed:null,recognition:null,lang:"hi-IN"};
function toast(s){let n=$("gdrxToast");if(!n){n=document.createElement("div");n.id="gdrxToast";n.className="gdrx-toast";document.body.appendChild(n)}n.textContent=s;n.classList.add("on");clearTimeout(n.t);n.t=setTimeout(()=>n.classList.remove("on"),2600)}
function openFind(){const f=$("renterFindHomeSection"),d=$("dashboardSection");if(!f)return;document.body.classList.add("gd-renter-explore-mode");f.hidden=false;f.style.display="block";if(d)d.style.display="none";f.scrollIntoView({behavior:"smooth",block:"start"})}
function closeFind(){const f=$("renterFindHomeSection"),d=$("dashboardSection");if(f){f.hidden=true;f.style.display="none"}document.body.classList.remove("gd-renter-explore-mode");if(d){d.style.display="block";d.scrollIntoView({behavior:"smooth",block:"start"})}}
function addSupport(){const root=$("renterDashboard"),actions=root?.querySelector(".renter-dashboard-actions");if(!root||!actions||$("gdrxSupport"))return;const b=document.createElement("button");b.type="button";b.id="gdrxSupport";b.className="renter-dashboard-action gdrx-support";b.innerHTML='<span class="renter-action-icon">✉</span><span><strong>Support</strong><small>Get help with your account or rental</small></span><span class="renter-action-arrow">↗</span>';b.onclick=()=>location.href="/contact.html";actions.appendChild(b)}
function parseRequest(raw){
 const n=String(raw||"").toLowerCase(),p={raw:String(raw||""),location:"",minBudget:"",maxBudget:"",stayType:"",bhk:"",furnishing:"",nearby:""};
 const b=n.match(/\b([1-5])\s*(?:bhk|bed(?:room)?s?)\b/);if(b)p.bhk=b[1];
 const radius=n.match(/(?:within|radius|around)\s*(\d+(?:\.\d+)?)\s*(?:km|kilomet(?:er|re)s?)\b/i);if(radius)p.radiusKm=Math.max(.5,Math.min(10,Number(radius[1])));
 if(/\b(pg|paying guest)\b/.test(n))p.stayType="pg";else if(/\b(hostel)\b/.test(n))p.stayType="hostel";else if(/\b(flat|apartment|house|home|villa|room)\b/.test(n))p.stayType="home";
 if(/\b(semi[\s-]?furnished)\b/.test(n))p.furnishing="Semi-Furnished";else if(/\b(unfurnished)\b/.test(n))p.furnishing="Unfurnished";else if(/\b(furnished)\b/.test(n))p.furnishing="Furnished";
 const max=n.match(/(?:under|below|upto|up to|maximum|max|budget|around|within|₹|rs\.?|rupees?|रुपये)\s*(?:₹|rs\.?)?\s*([\d,]{3,8})/i)||n.match(/([\d,]{3,8})\s*(?:rupees?|rs\.?|रुपये)/i);if(max)p.maxBudget=max[1].replace(/,/g,"");
 const min=n.match(/(?:above|minimum|min|at least)\s*(?:₹|rs\.?)?\s*([\d,]{3,8})/i);if(min)p.minBudget=min[1].replace(/,/g,"");
 if(/\b(college|university|कॉलेज)\b/.test(n))p.nearby="college";else if(/\b(hospital|clinic|अस्पताल)\b/.test(n))p.nearby="hospital";else if(/\b(market|bazaar|बाजार)\b/.test(n))p.nearby="market";
 const regs=[/\b(?:in|at|near|around)\b\s+(.+?)(?=\s+(?:under|below|upto|up to|budget|₹|rs\.?|rupees?|furnished|unfurnished|semi|[1-5]\s*(?:bhk|bed|bedroom)|pg|hostel|flat|apartment|house|villa|college|hospital|market)\b|$)/i,/^(.+?)\s+(?:mein|me|में)(?=\s+(?:[1-5]\s*(?:bhk|bed)|furnished|unfurnished|pg|hostel|flat|apartment|house|villa|budget|under|₹|rs\.?))/i,/(?:location|locality|area)\s*[:\-]?\s*(.+?)(?=\s+(?:budget|₹|rs\.?|furnished|unfurnished|[1-5]\s*bhk)\b|$)/i];
 for(const re of regs){const m=String(raw||"").match(re);if(m){p.location=m[1].replace(/^(?:mujhe|mujhko|i need|i want|find me|show me|please)\s+/i,"").replace(/[.,!?]+$/,"").trim();break}}
 return p
}
function setValue(id,v){const el=$(id);if(!el||v==null||v==="")return;el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}
function applyToForm(p){
 setValue("renterSearchLocation",p.location);setValue("renterStayType",p.stayType);setValue("renterSearchBhk",p.bhk);setValue("renterSearchFurnishing",p.furnishing);
 if(p.minBudget){setValue("renterMinBudgetPreset","custom");setValue("renterMinBudgetCustom",p.minBudget);setValue("renterMinBudget",p.minBudget)}
 if(p.maxBudget){setValue("renterMaxBudgetPreset","custom");setValue("renterMaxBudgetCustom",p.maxBudget);setValue("renterMaxBudget",p.maxBudget)}
}
function review(raw){
 const p=parseRequest(raw);if(!p.location&&!p.maxBudget&&!p.bhk&&!p.stayType&&!p.furnishing){$("gdrxStatus").textContent="Add a locality, budget, BHK or property type and try again.";return}
 state.parsed=p;applyToForm(p);
 const vals=[["Location",p.location||"Not detected"],["Property type",p.stayType||"Any"],["BHK",p.bhk?p.bhk+" BHK":"Any"],["Maximum rent",p.maxBudget?"₹"+Number(p.maxBudget).toLocaleString("en-IN"):"No limit"],["Minimum rent",p.minBudget?"₹"+Number(p.minBudget).toLocaleString("en-IN"):"No minimum"],["Furnishing",p.furnishing||"Any"]];
 const note=p.nearby?"Nearby preference noted: "+p.nearby+". The current property records do not store verified nearby-facility distances, so this is not used to claim a match.":"";
 const box=$("gdrxReview");box.hidden=false;box.innerHTML='<div class="gdrx-review-title"><b>Here is what I understood</b><span>✓ REVIEW</span></div><div class="gdrx-review-grid">'+vals.map(x=>'<div><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join("")+'</div>'+(note?'<p class="gdrx-note">'+esc(note)+'</p>':"")+'<div class="gdrx-review-actions"><button type="button" id="gdrxEdit">Edit preferences</button><button type="button" id="gdrxFind">Find matching homes →</button></div>';
 $("gdrxStatus").textContent="Extracted with a local parser. You can edit any field before searching.";
 $("gdrxEdit").onclick=()=>$("renterFindHomeForm").scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxFind").onclick=()=>$("renterFindHomeForm").requestSubmit()
}
function startVoice(target,lang){
 const mapMode=target==="gdrxMapPrompt";
 const micId=mapMode?"gdrxMapMic":"gdrxMic";
 const statusId=mapMode?"gdrxMapStatus":"gdrxStatus";
 const status=$(statusId),mic=$(micId);
 const API=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!API){if(status)status.textContent="Speech recognition is not supported in this browser. Type your request instead.";return}
 try{
  state.recognition?.stop();
  const r=new API();state.recognition=r;r.lang=lang||state.lang;r.interimResults=false;r.maxAlternatives=1;
  mic?.classList.add("listening");
  if(status)status.textContent="Listening… speak your home requirements.";
  r.onresult=e=>{
   const transcript=e.results?.[0]?.[0]?.transcript||"";
   const field=$(target);if(field){field.value=transcript;field.dispatchEvent(new Event("input",{bubbles:true}));}
   if(mapMode)runMapSearch();else review(transcript);
  };
  r.onerror=e=>{
   if(!status)return;
   status.textContent=(e.error==="not-allowed"||e.error==="service-not-allowed")
    ?"Microphone access was blocked. Allow microphone access for ghardekhorenters.com in Chrome site settings, then retry. You can still type."
    :e.error==="no-speech"?"No speech detected. Tap the microphone and try again."
    :"Voice input unavailable. Please type your request.";
  };
  r.onend=()=>{mic?.classList.remove("listening");if(state.recognition===r)state.recognition=null};
  r.start();
 }catch(error){
  mic?.classList.remove("listening");
  if(status)status.textContent="Could not start the microphone. Check browser microphone permission or use text search.";
 }
}
function mountFinder(){
 const sec=$("renterFindHomeSection"),form=$("renterFindHomeForm");if(!sec||!form||$("gdrxFinder"))return;
 const box=document.createElement("section");box.id="gdrxFinder";box.className="gdrx-finder";
 box.innerHTML='<div class="gdrx-finder-heading"><span>GHARDEKHO SMART FINDER</span><h3>Tell GDR what home you are looking for.</h3><p>Talk naturally or type your requirements. Review the details, then search actual GharDekho listings.</p></div><div class="gdrx-choices"><button type="button" id="gdrxTalk"><i>✦</i><span><b>Find your home with GDR Assistant</b><small>Voice or text · Hindi, English & Hinglish</small></span><em>01</em></button><button type="button" id="gdrxManual"><i>⌕</i><span><b>Search yourself</b><small>Use the manual filters below</small></span><em>02</em></button></div><div class="gdrx-assistant" id="gdrxAssistant"><div class="gdrx-assistant-head"><div><span>● GDR ASSISTANT</span><h4>Tell GDR What Home You are Looking For</h4><p>Speak naturally. We will find homes that match your needs.</p></div><div class="gdrx-orb">⌂</div></div><label for="gdrxPrompt">DESCRIBE YOUR IDEAL HOME</label><textarea id="gdrxPrompt" rows="3" placeholder="Mujhe Patel Nagar Bhopal mein 2 BHK furnished flat chahiye. Budget 8000 rupees hai."></textarea><div class="gdrx-tools"><select id="gdrxLang" aria-label="Speech language"><option value="hi-IN">Hindi / Hinglish</option><option value="en-IN">English (India)</option><option value="en-US">English (US)</option></select><button type="button" id="gdrxMic">● FIND MY HOME BY SPEAKING</button><button type="button" id="gdrxUnderstand">Understand my request →</button></div><p id="gdrxStatus" role="status">Voice input is available in supported browsers. Text search always works.</p><div id="gdrxReview" hidden></div></div>';
 form.parentNode.insertBefore(box,form);
 $("gdrxTalk").onclick=()=>$("gdrxAssistant").scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxManual").onclick=()=>form.scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxUnderstand").onclick=()=>review($("gdrxPrompt").value);
 $("gdrxLang").onchange=e=>state.lang=e.target.value;
 $("gdrxMic").onclick=()=>startVoice("gdrxPrompt",state.lang)
}
function mountMapVoice(){
 const panel=$("gdrExploreMapPanel"),toolbar=panel?.querySelector(".gdr-map-toolbar");if(!panel||!toolbar||$("gdrxMapVoice"))return;
 const w=document.createElement("div");w.id="gdrxMapVoice";w.className="gdrx-map-voice";
 w.innerHTML='<label for="gdrxMapPrompt">TALK TO GDR · MAP SEARCH</label><div><input id="gdrxMapPrompt" autocomplete="off" aria-label="Describe the home you want on the map" placeholder="2 BHK under ₹8,000 near Patel Nagar"><button type="button" id="gdrxMapMic" aria-label="Search by voice" title="Search by voice">🎙 Speak</button><button type="button" id="gdrxMapGo">Search map</button></div><p id="gdrxMapStatus" role="status" aria-live="polite">Type or speak your requirements. GDR will search real listings in the selected area.</p>';
 toolbar.appendChild(w);
 $("gdrxMapGo").onclick=runMapSearch;
 $("gdrxMapMic").onclick=()=>startVoice("gdrxMapPrompt",state.lang);
 $("gdrxMapPrompt").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();runMapSearch()}}
}
async function runMapSearch(){
 const prompt=$("gdrxMapPrompt"),status=$("gdrxMapStatus"),go=$("gdrxMapGo");
 if(!prompt||!status||!go)return;
 const p=parseRequest(prompt.value),api=window.GDRMapExperience;
 if(!p.location){status.textContent="Include a city, locality or PIN code (for example, Patel Nagar Bhopal) to locate your map search.";return}
 if(!api||typeof api.searchTypedMapLocation!=="function"){status.textContent="The map is still loading. Close and reopen Explore Map, then try again.";return}
 try{
  go.disabled=true;status.textContent="Locating "+p.location+" and searching real GharDekho listings…";
  const locationInput=$("gdrMapPlaceSearch");if(locationInput)locationInput.value=p.location;
  if(p.radiusKm&&typeof api.setRenterRadius==="function")api.setRenterRadius(p.radiusKm,true);
  const searchResult=await api.searchTypedMapLocation();
  if(searchResult===false)throw new Error("We could not search that location. Check the locality name or try a nearby PIN code.");
  if(api.applyRenterFilters)api.applyRenterFilters(p);
  status.textContent="Map updated with matching GharDekho listings."+(p.nearby?" Nearby "+p.nearby+" preference is noted; distance matching is shown only where verified facility data exists.":"");
 }catch(error){status.textContent=error.message||"Map search failed. Try another locality."}
 finally{go.disabled=false}
}
function mountCompare(){
 if($("gdrxCompare"))return;const d=document.createElement("section");d.id="gdrxCompare";d.className="gdrx-compare";d.hidden=true;
 d.innerHTML='<div class="gdrx-compare-head"><div><span>SHORTLIST SIDE BY SIDE</span><h3>Compare homes <small id="gdrxCompareCount">0 / 3</small></h3></div><button id="gdrxCompareClose" aria-label="Close comparison">×</button></div><div id="gdrxCompareGrid"></div><div class="gdrx-compare-foot">Estimated monthly total = rent + recorded monthly maintenance. Refundable deposits remain separate.<button id="gdrxCompareClear">Clear</button></div>';
 document.body.appendChild(d);$("gdrxCompareClose").onclick=()=>d.hidden=true;$("gdrxCompareClear").onclick=()=>{state.compare=[];renderCompare()}
}
function toggleCompare(p){if(!p?.id)return;const i=state.compare.findIndex(x=>String(x.id)===String(p.id));if(i>=0){state.compare.splice(i,1);toast("Removed from comparison")}else if(state.compare.length>=3){toast("Compare up to three homes at a time.");return}else{state.compare.push(p);toast("Added to comparison")}renderCompare()}
function renderCompare(){
 const d=$("gdrxCompare"),grid=$("gdrxCompareGrid");if(!d||!grid)return;d.hidden=!state.compare.length;$("gdrxCompareCount").textContent=state.compare.length+" / 3";grid.replaceChildren();
 const fields=[["Monthly rent",p=>"₹"+Number(p.rent||0).toLocaleString("en-IN")],["Security deposit",p=>p.security_deposit==null?"Not listed":"₹"+Number(p.security_deposit).toLocaleString("en-IN")],["Configuration",p=>p.bhk?p.bhk+" BHK":p.room_type||p.listing_type||"Not listed"],["Furnishing",p=>p.furnishing||"Not listed"],["Distance",p=>Number.isFinite(Number(p.gdrDistanceKm))?Number(p.gdrDistanceKm).toFixed(1)+" km":"Not available"],["Availability",p=>p.status==="occupied"?"Occupied":p.status==="soon_available"?"Vacating soon":p.status==="pending"?"Pending verification":"Available"],["Owner verification",p=>p.owner_verified===true?"Verified":p.owner_verified===false?"Not verified":"Not available"],["Monthly maintenance",p=>p.monthly_maintenance==null?"Not listed":"₹"+Number(p.monthly_maintenance).toLocaleString("en-IN")],["Estimated monthly total",p=>p.monthly_maintenance==null?"Rent only; maintenance not listed":"₹"+(Number(p.rent||0)+Number(p.monthly_maintenance||0)).toLocaleString("en-IN")]];
 state.compare.forEach(p=>{const c=document.createElement("article");c.className="gdrx-compare-card";const im=document.createElement("img");im.src=p.image_url||"";im.alt="Property photo";im.onerror=()=>im.hidden=true;const h=document.createElement("h4");h.textContent=p.title||p.name||"Rental property";const loc=document.createElement("p");loc.textContent=p.location||p.address||"Location not listed";c.append(im,h,loc);fields.forEach(f=>{const row=document.createElement("div");row.className="gdrx-row";const a=document.createElement("small"),b=document.createElement("strong");a.textContent=f[0];b.textContent=f[1](p);row.append(a,b);c.append(row)});const rm=document.createElement("button");rm.textContent="Remove";rm.onclick=()=>{state.compare=state.compare.filter(x=>String(x.id)!==String(p.id));renderCompare()};c.append(rm);grid.append(c)})
}
function applyManualScores(){
 const root=$("propertiesContainer"),p=state.parsed;if(!root||!p)return;
 const cards=Array.from(root.querySelectorAll(".property-card[data-property-id]"));
 const scored=cards.map(card=>{const text=(card.innerText||"").toLowerCase(),checks=[];
  if(p.location)checks.push(text.includes(p.location.toLowerCase()));if(p.bhk)checks.push(text.includes(p.bhk+" bhk"));if(p.furnishing)checks.push(text.includes(p.furnishing.toLowerCase()));if(p.stayType)checks.push(text.includes(p.stayType));
  const rent=Number((card.querySelector(".property-rent")?.textContent||"").replace(/[^0-9.]/g,""));if(p.maxBudget)checks.push(Number.isFinite(rent)&&rent<=Number(p.maxBudget));if(p.minBudget)checks.push(Number.isFinite(rent)&&rent>=Number(p.minBudget));
  const score=checks.length?Math.round(checks.filter(Boolean).length/checks.length*100):null;let badge=card.querySelector(".gdrx-match-pill");
  if(score!==null){if(!badge){badge=document.createElement("span");badge.className="gdrx-match-pill";card.querySelector(".property-card-body")?.prepend(badge)}if(badge)badge.textContent=score+"% preference match"}return {card,score:score===null?0:score}});
 const ordered=scored.slice().sort((x,y)=>y.score-x.score).map(x=>x.card);if(ordered.some((el,i)=>cards[i]!==el))ordered.forEach(el=>root.appendChild(el));
}
function bind(){
 addSupport();mountFinder();mountCompare();$("renterDashboard")?.classList.add("gdrx-premium");
 const results=$("propertiesContainer");if(results&&!results.dataset.gdrxScoreObserver){results.dataset.gdrxScoreObserver="1";new MutationObserver(()=>applyManualScores()).observe(results,{childList:true,subtree:true})}
 const form=$("renterFindHomeForm");if(form&&!form.dataset.gdrxScoreCapture){form.dataset.gdrxScoreCapture="1";form.addEventListener("submit",()=>{state.parsed={location:$("renterSearchLocation")?.value||"",bhk:$("renterSearchBhk")?.value||"",furnishing:$("renterSearchFurnishing")?.value||"",stayType:$("renterStayType")?.value||"",minBudget:$("renterMinBudget")?.value||"",maxBudget:$("renterMaxBudget")?.value||""};setTimeout(applyManualScores,1000)})}
 const fbtn=$("renterFindHomeBtn");if(fbtn&&!fbtn.dataset.gdrx){fbtn.dataset.gdrx="1";fbtn.addEventListener("click",openFind)}
 ["renterFindHomeBackBtn","renterFindHomeCancelBtn"].forEach(id=>{const b=$(id);if(b&&!b.dataset.gdrx){b.dataset.gdrx="1";b.addEventListener("click",closeFind)}})
 const map=$("gdrExploreMapPanel");if(map&&!map.dataset.gdrx){map.dataset.gdrx="1";new MutationObserver(()=>{if(!map.hidden)mountMapVoice()}).observe(map,{attributes:true,attributeFilter:["hidden","class"]})}
 const mapBtn=$("renterExploreMapBtn");if(mapBtn&&!mapBtn.dataset.gdrx){mapBtn.dataset.gdrx="1";mapBtn.addEventListener("click",()=>setTimeout(mountMapVoice,150))}
}
window.GDRRenterExperience={toggleCompare,parseRequest,openFindHome:openFind,closeFindHome:closeFind};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();window.addEventListener("load",bind);
new MutationObserver(bind).observe(document.body,{childList:true,subtree:true});
})();