(function(){
"use strict";
/* GDR_COMPARE_AUTOFILL_V2: seed the clicked home with up to two nearest visible real listings. */
if(window.GDRRenterExperience)return;
const $=id=>document.getElementById(id),esc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const state={compare:[],parsed:null,recognition:null,voiceSession:0,voiceActive:false,voiceDraft:"",lang:"hi-IN",lastMapSearch:null,mapReplyLanguage:"hi",assistantSearchId:0,assistantAbortController:null};
const publicInventoryCache={data:null,loadedAt:0,promise:null};
const PUBLIC_INVENTORY_TTL_MS=20000;
let comparePickerRows=[],comparePickerLoading=false,comparePickerError="",comparePickerQuery="",comparePickerBhk="",comparePickerFurnishing="";
function loadPublicInventory(){
 const now=Date.now();
 if(publicInventoryCache.data&&now-publicInventoryCache.loadedAt<PUBLIC_INVENTORY_TTL_MS)return Promise.resolve(publicInventoryCache.data);
 if(publicInventoryCache.promise)return publicInventoryCache.promise;
 const client=window.__gdrSupabaseClient;
 if(!client||typeof client.rpc!=="function")return Promise.reject(new Error("Property database is not ready. Please refresh and try again."));
 let timeoutId=0;
 publicInventoryCache.promise=Promise.race([
  client.rpc("search_public_properties_for_assistant",{p_search_text:null,p_min_rent:null,p_max_rent:null,p_bhk:null,p_listing_type:null,p_property_type:null,p_furnishing:null,p_limit:100,p_offset:0}),
  new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error("The property database is taking too long. Please try again.")),10000);})
 ]).then(response=>{
  if(response&&response.error)throw response.error;
  const payload=response&&response.data;
  if(!payload||!Array.isArray(payload.results))throw new Error("The property database returned an invalid response.");
  publicInventoryCache.data=payload.results;publicInventoryCache.loadedAt=Date.now();return publicInventoryCache.data;
 }).finally(()=>{if(timeoutId)clearTimeout(timeoutId);publicInventoryCache.promise=null;});
 return publicInventoryCache.promise;
}

function toast(s){let n=$("gdrxToast");if(!n){n=document.createElement("div");n.id="gdrxToast";n.className="gdrx-toast";document.body.appendChild(n)}n.textContent=s;n.classList.add("on");clearTimeout(n.t);n.t=setTimeout(()=>n.classList.remove("on"),2600)}
function openFind(){const f=$("renterFindHomeSection"),d=$("dashboardSection");if(!f)return;document.body.classList.add("gd-renter-explore-mode");f.hidden=false;f.style.display="block";if(d)d.style.display="none";f.scrollIntoView({behavior:"smooth",block:"start"})}
function closeFind(){const f=$("renterFindHomeSection"),d=$("dashboardSection");if(f){f.hidden=true;f.style.display="none"}document.body.classList.remove("gd-renter-explore-mode");if(d){d.style.display="block";d.scrollIntoView({behavior:"smooth",block:"start"})}}
function addSupport(){const root=$("renterDashboard"),actions=root?.querySelector(".renter-dashboard-actions");if(!root||!actions||$("gdrxSupport"))return;const b=document.createElement("button");b.type="button";b.id="gdrxSupport";b.className="renter-dashboard-action gdrx-support";b.innerHTML='<span class="renter-action-icon">✉</span><span><strong>Support</strong><small>We’re here to help with your rental journey</small></span><span class="renter-action-arrow">↗</span>';b.onclick=()=>location.href="/contact.html";actions.appendChild(b)}
function normalizeSearchText(value){
 const consonants={"क":"k","ख":"kh","ग":"g","घ":"gh","ङ":"ng","च":"ch","छ":"chh","ज":"j","झ":"jh","ञ":"ny","ट":"t","ठ":"th","ड":"d","ढ":"dh","ण":"n","त":"t","थ":"th","द":"d","ध":"dh","न":"n","प":"p","फ":"ph","ब":"b","भ":"bh","म":"m","य":"y","र":"r","ल":"l","व":"v","श":"sh","ष":"sh","स":"s","ह":"h","क़":"q","ख़":"kh","ग़":"g","ज़":"z","ड़":"r","ढ़":"rh","फ़":"f"};
 const vowels={"अ":"a","आ":"aa","इ":"i","ई":"ee","उ":"u","ऊ":"oo","ऋ":"ri","ए":"e","ऐ":"ai","ओ":"o","औ":"au"};
 const matras={"ा":"a","ि":"i","ी":"ee","ु":"u","ू":"oo","ृ":"ri","े":"e","ै":"ai","ो":"o","ौ":"au"};
 const transliterateWord=word=>{
  const chars=Array.from(word);let out="",endsInherent=false;
  for(let i=0;i<chars.length;i++){
   const ch=chars[i];
   if(consonants[ch]){
    out+=consonants[ch];endsInherent=true;
    const next=chars[i+1];
    if(matras[next]){out+=matras[next];i++;endsInherent=false;}
    else if(next==="्"){i++;endsInherent=false;}
    else if(next==="़"){i++;endsInherent=true;}
    else out+="a";
   }else if(vowels[ch]){out+=vowels[ch];endsInherent=false;}
   else if(ch==="ं"||ch==="ँ"){out+="n";endsInherent=false;}
   else if(ch==="ः"){out+="h";endsInherent=false;}
   else if(ch==="़"||ch==="्"){endsInherent=false;}
   else{out+=ch;endsInherent=false;}
  }
  if(endsInherent&&out.endsWith("a"))out=out.slice(0,-1);
  return out;
 };
 const raw=String(value||"").toLowerCase().normalize("NFKC");
 const aliases={"सिंगरौली":"singrauli","इंदौर":"indore","रीवा":"rewa","भोपाल":"bhopal","जबलपुर":"jabalpur","ग्वालियर":"gwalior","उज्जैन":"ujjain","सतना":"satna","देवास":"dewas","सीधी":"sidhi","बड़े":"bade","बड़ा":"bada","बड़ा":"bada","नगर":"nagar","पटेल":"patel","वैढ़न":"waidhan","विंध्यनगर":"vindhyanagar","मध्य":"madhya","प्रदेश":"pradesh"};
 const latin=raw.replace(/[\u0900-\u097F]+/gu,word=>aliases[word]||transliterateWord(word));
 const normalized=latin.replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
 return normalized;
}


function normalizedPropertyBhk(row){
 const configuration=normalizeSearchText(row&&row.configuration||"");
 if(/\b\d+\s*rk\b/.test(configuration))return null;
 const configured=configuration.match(/\b([1-5])\s*(?:\+\s*)?bhk\b/);
 if(configured)return Number(configured[1]);
 const value=row&&row.bhk;
 if(value===null||value===undefined||String(value).trim()==="")return null;
 const numeric=Number(value);
 return Number.isInteger(numeric)&&numeric>=1&&numeric<=20?numeric:null;
}

function filterAssistantListings(rows,prefs){
 const p=prefs||{},query=normalizeSearchText(p.location||""),tokens=query.split(" ").filter(Boolean);
 const groups={
  bhopal:{center:[23.2599,77.4126],radiusKm:55,cities:["bhopal"],areas:["patel nagar","indrapuri","chhatrasal nagar","huzur tahsil"],postalPrefixes:["462"]},
  singrauli:{center:[24.0724946,82.6246537],radiusKm:120,cities:["singrauli","singruali"],areas:["waidhan","vindhyanagar","vindhya nagar","rajmata chun kumari stadium","dav road","d a v road"],postalPrefixes:["486"]}
 };
 const phrase=(text,value)=>(" "+String(text||"")+" ").includes(" "+String(value||"")+" ");
 const selected=Object.values(groups).find(g=>g.cities.some(x=>tokens.includes(x))||g.areas.some(x=>phrase(query,x)));
 const locality=selected?selected.areas.find(x=>phrase(query,x))||"":"";
 const distance=(a,b)=>{const r=v=>v*Math.PI/180,la=r(a[0]),lb=r(b[0]),d1=r(b[0]-a[0]),d2=r(b[1]-a[1]),h=Math.sin(d1/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(d2/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};
 const num=v=>v==null||v===""?null:Number(v),unique=new Map();
 (Array.isArray(rows)?rows:[]).forEach(x=>{if(x&&x.id&&!unique.has(String(x.id)))unique.set(String(x.id),x);});
 return Array.from(unique.values()).filter(row=>{
  const status=String(row.status||"").toLowerCase(),verification=String(row.verification_status||"").toLowerCase();
  const unavailable=["occupied","rejected","removed","deleted","unavailable","released"].includes(status)||!!row.released_at;
  const allowed=!unavailable&&((verification==="verified"&&row.owner_verified===true)||(verification==="pending"&&status==="pending"));
  if(!allowed)return false;
  const type=String(row.listing_type||"home").toLowerCase();
  if((type==="pg"||type==="hostel")&&(num(row.available_beds)===null||num(row.available_beds)<=0))return false;
  const postalCode=String(row.pincode||"").replace(/\D/g,"");
  const postalMatch=!!(selected&&Array.isArray(selected.postalPrefixes)&&selected.postalPrefixes.some(prefix=>postalCode.startsWith(prefix)));
  const hay=normalizeSearchText([row.location,row.address,postalCode].filter(Boolean).join(" ")),words=hay.split(" ");
  if(selected){
   const hasCoord=row.latitude!=null&&row.longitude!=null&&row.latitude!==""&&row.longitude!=="";
   const lat=Number(row.latitude),lng=Number(row.longitude),valid=hasCoord&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
   const nearby=valid&&distance(selected.center,[lat,lng])<=selected.radiusKm;
   if(valid&&!nearby&&!postalMatch)return false;
   if(locality&&!phrase(hay,locality))return false;
   if(!locality&&!nearby&&!postalMatch&&!selected.cities.some(x=>phrase(hay,x))&&!selected.areas.some(x=>phrase(hay,x)))return false;
   const ignored=new Set(["madhya","pradesh","india","mp","state","district",...selected.cities]);
   const extra=tokens.filter(x=>!ignored.has(x)&&!selected.areas.some(y=>y.split(" ").includes(x)));
   if(extra.some(x=>!words.includes(x)))return false;
  }else if(tokens.length&&!tokens.every(x=>words.includes(x)))return false;
  const rent=num(row.rent),min=num(p.minBudget),max=num(p.maxBudget);
  if(min!==null&&(rent===null||rent<min))return false;
  if(max!==null&&(rent===null||rent>max))return false;
  if(p.bhk&&normalizedPropertyBhk(row)!==Number(p.bhk))return false;
  if(p.furnishing&&String(row.furnishing||"").trim().toLowerCase()!==String(p.furnishing).trim().toLowerCase())return false;
  if(p.stayType&&type!==String(p.stayType).toLowerCase())return false;
  if(p.propertyType&&String(row.property_type||"").toLowerCase()!==String(p.propertyType).toLowerCase())return false;
  return true;
 }).sort((a,b)=>(num(a.rent)??Infinity)-(num(b.rent)??Infinity));
}

async function searchAssistantListings(prefs,raw,target){
 const searchId=++state.assistantSearchId;
 if(state.assistantAbortController){try{state.assistantAbortController.abort();}catch(_){}state.assistantAbortController=null;}
 const language=detectReplyLanguage(raw||""),location=String(prefs&&prefs.location||"").trim();
 const section=$("propertiesSection"),container=$("propertiesContainer");
 const setStatus=message=>{
  if(target){target.replaceChildren();const summary=document.createElement("p");summary.className="gdr-map-voice-result-summary";summary.textContent=message;target.append(summary);}
  const status=$("gdrxStatus");if(status)status.textContent=message;
 };
 const setInventorySummary=message=>{
  if(!section||!container)return;
  let node=$("gdrVoiceInventorySummary");
  if(!node){node=document.createElement("p");node.id="gdrVoiceInventorySummary";node.className="small-text";const subtitle=section.querySelector(":scope > .small-text");if(subtitle)subtitle.insertAdjacentElement("afterend",node);else section.insertBefore(node,container);}
  node.textContent=message;
 };
 const setAssistantAnalytics=(rows,count)=>{
  if(!section||!container)return;
  let panel=$("gdrxAssistantAnalytics");
  if(!panel){panel=document.createElement("section");panel.id="gdrxAssistantAnalytics";panel.className="gdrx-assistant-analytics";panel.setAttribute("aria-live","polite");container.insertAdjacentElement("beforebegin",panel);}
  const records=Array.isArray(rows)?rows:[];
  if(!records.length){panel.hidden=true;panel.replaceChildren();return;}
  panel.hidden=false;
  const verified=records.filter(row=>String(row.status||"").toLowerCase()==="verified"&&String(row.verification_status||"").toLowerCase()==="verified").length;
  const pending=records.filter(row=>String(row.status||"").toLowerCase()==="pending"||String(row.verification_status||"").toLowerCase()==="pending").length;
  const ownersVerified=records.filter(row=>row.owner_verified===true).length;
  const homes=records.filter(row=>!row.listing_type||String(row.listing_type).toLowerCase()==="home").length;
  const pgHostel=records.length-homes;
  const mapped=records.filter(row=>Number.isFinite(Number(row.latitude))&&Number.isFinite(Number(row.longitude))&&row.latitude!==null&&row.longitude!==null&&row.latitude!==""&&row.longitude!=="").length;
  const photos=records.filter(row=>Boolean(row.image_url)||(Array.isArray(row.photo_urls)&&row.photo_urls.length>0)).length;
  const rents=records.map(row=>Number(row.rent)).filter(value=>Number.isFinite(value)&&value>=0).sort((a,b)=>a-b);
  const median=rents.length?(rents.length%2?rents[(rents.length-1)/2]:(rents[rents.length/2-1]+rents[rents.length/2])/2):null;
  const money=value=>"₹"+Number(value).toLocaleString("en-IN",{maximumFractionDigits:0});
  const metric=(label,value)=>'<div class="gdrx-analytics-metric"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';
  const headline='<div class="gdrx-analytics-heading"><div><span>LIVE INVENTORY ANALYSIS</span><strong>'+esc(location||"Your search")+'</strong></div><small>'+esc(String(records.length))+' loaded of '+esc(String(Number(count)||records.length))+'</small></div>';
  const cards='<div class="gdrx-analytics-grid">'+
   metric("Total matching",String(Number(count)||records.length))+
   metric("Homes",String(homes))+
   metric("PG / Hostel",String(pgHostel))+
   metric("Map-ready",mapped+" / "+records.length)+
   '</div>';
  const pricing=rents.length?'<p class="gdrx-analytics-line"><b>Listed rent range:</b> '+esc(money(rents[0]))+' – '+esc(money(rents[rents.length-1]))+(median!==null?' <span>· Median '+esc(money(median))+'</span>':'')+'</p>':'';
  const verification='<p class="gdrx-analytics-line"><b>Property verification:</b> '+esc(String(verified))+' verified · '+esc(String(pending))+' pending <span>· Owner verified: '+esc(String(ownersVerified))+' / '+esc(String(records.length))+'</span></p>';
  const completeness='<p class="gdrx-analytics-line"><b>Listing data:</b> '+esc(String(photos))+' with photos · '+esc(String(mapped))+' with map coordinates</p>';
  const note=Number(count)>records.length?'<p class="gdrx-analytics-note">Showing '+esc(String(records.length))+' of '+esc(String(Number(count)))+' matching listings. Use Load More to fetch the rest.</p>':'<p class="gdrx-analytics-note">All matching records returned by this search are loaded below. Pending verification is labelled on each property card.</p>';
  panel.innerHTML=headline+cards+pricing+verification+completeness+note;
 };
 if(!section||!container||typeof window.renderVoicePropertyResults!=="function"){setStatus("The existing Available Rental Properties section is not ready. Please refresh and try again.");return [];}
 const client=window.__gdrSupabaseClient;
 if(!client||typeof client.rpc!=="function"){setStatus("Property database is not ready. Please refresh and try again.");return [];}
 const pageSize=100;let loadedRows=[],totalCount=0,loadingMore=false;
 const getPagination=()=>{let node=$("propertyPagination");if(!node){node=document.createElement("div");node.id="propertyPagination";node.className="property-pagination";container.insertAdjacentElement("afterend",node);}return node;};
 const requestPage=async offset=>{
  const controller=typeof AbortController!=="undefined"?new AbortController():null;state.assistantAbortController=controller;let timeoutId=0;
  try{
   const rpc=client.rpc("search_public_properties_for_assistant",{
    p_search_text:normalizeSearchText(location),
    p_min_rent:prefs&&prefs.minBudget?Number(prefs.minBudget):null,
    p_max_rent:prefs&&prefs.maxBudget?Number(prefs.maxBudget):null,
    p_bhk:prefs&&prefs.bhk?Number(prefs.bhk):null,
    p_listing_type:prefs&&prefs.stayType?prefs.stayType:null,
    p_property_type:prefs&&prefs.propertyType?prefs.propertyType:null,
    p_furnishing:prefs&&prefs.furnishing?prefs.furnishing:null,
    p_limit:pageSize,p_offset:offset
   });
   const request=controller&&rpc&&typeof rpc.abortSignal==="function"?rpc.abortSignal(controller.signal):rpc;
   const response=await Promise.race([Promise.resolve(request),new Promise((_,reject)=>{timeoutId=setTimeout(()=>{if(controller)controller.abort();reject(new Error("Property search timed out after 12 seconds. Please retry your search."));},12000);})]);
   if(searchId!==state.assistantSearchId)return {rows:[],totalCount:0};
   if(response&&response.error)throw response.error;
   const payload=response&&response.data;if(!payload||!Array.isArray(payload.results))throw new Error("The property search returned an invalid response. Please retry.");
   return {rows:payload.results,totalCount:Number(payload.total_count)||0};
  }finally{if(timeoutId)clearTimeout(timeoutId);if(state.assistantAbortController===controller)state.assistantAbortController=null;}
 };
 const updatePagination=()=>{
  const pagination=getPagination();pagination.replaceChildren();if(loadedRows.length>=totalCount)return;
  const remaining=totalCount-loadedRows.length,button=document.createElement("button");
  button.type="button";button.className="gdrx-assistant-load-more";
  button.textContent=language==="hi"?"और "+remaining+" properties दिखाएँ":"Load "+remaining+" more properties";
  button.style.cssText="display:block;margin:16px auto;padding:11px 18px;border:1px solid #d8c7a6;border-radius:10px;background:#fff9ef;color:#173f35;font:inherit;font-weight:600;cursor:pointer";
  button.addEventListener("click",()=>loadMore(button));pagination.append(button);
 };
 const renderLoadedRows=()=>{
  loadedRows.totalCount=totalCount;
  window.renderVoicePropertyResults(loadedRows);
  setAssistantAnalytics(loadedRows,totalCount);
  if(!target){
   const mapApi=window.GDRMapExperience;
   if(mapApi&&typeof mapApi.showVoiceSearchResults==="function"){
    try{mapApi.showVoiceSearchResults(loadedRows,null,location||"Assistant search");}
    catch(error){console.warn("GDR assistant list results are ready; map rendering was skipped:",error);}
   }
  }
  updatePagination();
 };
 const describeCount=()=>language==="hi"?(location?location+" में ":"")+"कुल "+totalCount+" matching properties मिली हैं। अभी "+loadedRows.length+" दिखाई जा रही हैं.":"Found "+totalCount+" matching properties"+(location?" in "+location:"")+". Showing "+loadedRows.length+" so far.";
 async function loadMore(button){
  if(loadingMore||loadedRows.length>=totalCount||searchId!==state.assistantSearchId)return;
  loadingMore=true;if(button)button.disabled=true;setStatus(language==="hi"?"बाकी matching properties load कर रहा हूँ…":"Loading the remaining matching properties…");
  try{
   const page=await requestPage(loadedRows.length);if(searchId!==state.assistantSearchId)return;
   const known=new Set(loadedRows.map(row=>String(row.id)));
   page.rows.forEach(row=>{if(row&&row.id&&!known.has(String(row.id))){known.add(String(row.id));loadedRows.push(row);}});
   totalCount=page.totalCount;renderLoadedRows();const message=describeCount();
   setInventorySummary(message+" Available Rental Properties section में असली listings दिखाई गई हैं।");setStatus(message);
  }catch(error){if(searchId!==state.assistantSearchId)return;setStatus(String(error&&error.message||"More properties could not be loaded. Please retry."));if(button)button.disabled=false;console.error("GDR assistant pagination failed:",error);}
  finally{loadingMore=false;}
 }
 setInventorySummary(language==="hi"?"आपकी शर्तों के अनुसार database में उपलब्ध properties खोजी जा रही हैं…":"Searching available properties on the server…");
 container.innerHTML='<div class="loading-text">Searching matching rental properties…</div>';
 const pagination=$("propertyPagination");if(pagination)pagination.replaceChildren();
 setStatus(language==="hi"?"आपकी शर्तों के अनुसार database में घर खोज रहा हूँ…":"Searching the live property database for your exact requirements…");
 try{
  const page=await requestPage(0);if(searchId!==state.assistantSearchId)return [];
  loadedRows=page.rows.filter(row=>row&&row.id);totalCount=page.totalCount;renderLoadedRows();
  const message=describeCount();setInventorySummary(message+" Available Rental Properties section में वास्तविक matching listings दिखाई गई हैं।");setStatus(message);
  if(!target)speakAssistantReply(message,language);
  requestAnimationFrame(()=>{if(searchId!==state.assistantSearchId)return;section.scrollIntoView({behavior:window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});});
  return loadedRows;
 }catch(error){
  if(searchId!==state.assistantSearchId)return [];
  const message=String(error&&error.message||"The property search could not be completed. Please try again.");
  window.renderVoicePropertyResults([],message);setAssistantAnalytics([],0);setInventorySummary("Property search failed. No successful results were returned.");setStatus(message);
  console.error("GDR database voice search failed:",error);if(target)throw error;return [];
 }
}


function parseRequest(raw){
 const original=String(raw||"").trim(),n=original.toLowerCase().normalize("NFKC");
  const clean=original.replace(/^(?:show|find)\s+me\b\s*/i,"").replace(/^i\s+(?:need|want)\b\s*/i,"").replace(/^please\s+/i,"").replace(/^(?:mujhe(?:\s+ek)?|mujhko|mere\s+mobile|meri\s+mobile|my\s+mobile|मेरे\s+मोबाइल|मेरी\s+मोबाइल|मुझे|मुझको)\s*/i,"").replace(/^(?:ab|now|then|also|aur|और|अब|तो|फिर|अच्छा|ठीक है)\s*/i,"").replace(/^(?:a|an)\s+/i,"").replace(/\s+(?:मुझे|मुझको|मेरे लिए|मेरी लिए|please|plz)$/i,"").trim();
 const p={raw:original,location:"",minBudget:"",maxBudget:"",stayType:"",bhk:"",furnishing:"",nearby:"",propertyType:"",radiusKm:null,useMyLocation:false,familyFriendly:false};
 const allListingsIntent=/(?:\b(?:all|every|any)\b[\s\S]{0,60}\b(?:properties?|listings?)\b)|(?:(?:जितने|जितनी|जितना)\s*भी[\s\S]{0,60}(?:प्रॉपर्टी|प्रॉपर्टीज़?|प्रॉपर्टीज|लिस्टिंग|properties?|listings?))|(?:\b(?:jitne|jitni|jitna)\s+bhi[\s\S]{0,60}\b(?:properties?|listings?)\b)|(?:(?:सब|सभी|सारे|सारी)[\s\S]{0,45}(?:प्रॉपर्टी|प्रॉपर्टीज़?|प्रॉपर्टीज|लिस्टिंग|properties?|listings?))|(?:\b(?:sab|sabhi|saare|saari|sare|sari)\b[\s\S]{0,45}\b(?:properties?|listings?)\b)|(?:(?:प्रॉपर्टी|प्रॉपर्टीज़?|प्रॉपर्टीज|लिस्टिंग|properties?|listings?)[\s\S]{0,45}(?:सब|सभी|सारे|सारी))|(?:\b(?:properties?|listings?)\b[\s\S]{0,45}\b(?:sab|sabhi|saare|saari|sare|sari)\b)/i.test(original);
 p.allListings=allListingsIntent;
 const numericBhk=n.match(/(?:^|\s)([1-5])\s*(?:bhk|bed(?:room)?s?|bed\s*room|बीएचके|बेडरूम|बेड\s*रूम|कमरे|कमरा)(?=\s|$|[^a-z0-9])/i);
 const wordBhk=n.match(/(?:^|\s)(one|two|three|four|five|एक|दो|तीन|चार|पाँच|पांच)\s*(?:bhk|bed(?:room)?s?|bed\s*room|बीएचके|बेडरूम|बेड\s*रूम)?(?=\s|$|[,.!?])/i);
 const bhkWords={one:"1",two:"2",three:"3",four:"4",five:"5","एक":"1","दो":"2","तीन":"3","चार":"4","पाँच":"5","पांच":"5"};
 if(numericBhk)p.bhk=numericBhk[1];else if(wordBhk)p.bhk=bhkWords[wordBhk[1]]||"";
 const radius=n.match(/(?:within|radius(?: of)?|around|के अंदर|तक)\s*(\d+(?:\.\d+)?)\s*(?:km|kms|kilomet(?:er|re)s?|किलोमीटर|कि\.?मी\.?)\b/i)||n.match(/\b(\d+(?:\.\d+)?)\s*(?:km|kms|kilomet(?:er|re)s?|किलोमीटर)\s*(?:के अंदर|तक|radius)?/i);
 if(radius)p.radiusKm=Math.max(.5,Math.min(10,Number(radius[1])));
 if(/\b(pg|paying guest)\b|पीजी/.test(n))p.stayType="pg";
 else if(/\b(hostel)\b|हॉस्टल/.test(n))p.stayType="hostel";
 else if(/\b(flat|apartment|independent house|villa|room|home|house|houses|homes)\b|फ्लैट|अपार्टमेंट|स्वतंत्र मकान|विला|कमरा|घर|मकान/.test(n))p.stayType="home";
 // Only explicit all-properties requests clear the home/PG/hostel type filter.
 if(allListingsIntent){p.stayType="";p.propertyType="";}
 if(/\b(semi[\s-]?furnished)\b|सेमी फर्निश/.test(n))p.furnishing="Semi-Furnished";
 else if(/\b(unfurnished)\b|अनफर्निश/.test(n))p.furnishing="Unfurnished";
 else if(/\b(furnished)\b|फर्निश/.test(n))p.furnishing="Furnished";
 if(/\b(independent house)\b|स्वतंत्र मकान/.test(n))p.propertyType="independent_house";
 else if(/\b(villa)\b/.test(n))p.propertyType="villa";
 else if(/\b(apartment|flat)\b|अपार्टमेंट|फ्लैट/.test(n))p.propertyType="apartment";
 else if(/\b(single\s+)?room\b|कमरा|कमरे/.test(n))p.propertyType="room";
 const range=n.match(/(?:between|from|budget)?\s*(?:₹|rs\.?\s*)?([\d,]{3,8})\s*(?:to|and|-)\s*(?:₹|rs\.?\s*)?([\d,]{3,8})/i);
 if(range){p.minBudget=range[1].replace(/,/g,"");p.maxBudget=range[2].replace(/,/g,"");}
 else{
  const min=n.match(/(?:at least|minimum|min|above|more than|greater than|कम से कम|से ज्यादा|से अधिक)\s*(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})/i);
  if(min)p.minBudget=min[1].replace(/,/g,"");
  const max=n.match(/(?:under|below|up to|upto|maximum|max|budget|not more than|less than|ke kam|se kam|ke neeche|se neeche|के कम|से कम|के नीचे|से नीचे|तक)\s*(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})/i)
   ||n.match(/(?:₹|rs\.?\s*|rupees?\s*|रुपये\s*)?([\d,]{3,8})\s*(?:(?:rupees?|rs\.?|रुपये|रु\.?)\s*)?(?:ke kam|se kam|ke neeche|se neeche|के कम|से कम|के नीचे|से नीचे|तक)/i);
  if(max)p.maxBudget=max[1].replace(/,/g,"");
  if(!p.maxBudget){const amount=n.match(/([\d,]{3,8})\s*(?:rupees?|rs\.?|रुपये|रु\.?)/i);if(amount)p.maxBudget=amount[1].replace(/,/g,"");}
  if(!p.maxBudget){const compact=n.match(/(?:under|below|upto|up to)\s*(\d+(?:\.\d+)?)\s*k|(\d+(?:\.\d+)?)\s*k\s*(?:ke kam|se kam|ke neeche|se neeche|के कम|से कम|के नीचे|से नीचे)/i);if(compact)p.maxBudget=String(Math.round(Number(compact[1]||compact[2])*1000));}
  if(!p.maxBudget&&/दस\s*हजार/.test(n)&&/(से कम|के कम|से नीचे|के नीचे)/.test(n))p.maxBudget="10000";
 }
 if(/\b(my|current) location\b|मेरी लोकेशन|मेरी जगह|मेरे पास/.test(n))p.useMyLocation=true;
 if(/\b(college|university)\b|कॉलेज|विश्वविद्यालय/.test(n))p.nearby="college";
 else if(/\b(hospital|clinic)\b|अस्पताल/.test(n))p.nearby="hospital";
 else if(/\b(market|bazaar)\b|बाजार|मार्केट/.test(n))p.nearby="market";
 else if(/\b(railway station|train station)\b|रेलवे स्टेशन|स्टेशन/.test(n))p.nearby="railway station";
 if(/family[ -]?friendly|for family|परिवार के लिए|फैमिली/.test(n))p.familyFriendly=true;
 const stop="under|below|upto|up to|budget|maximum|max|minimum|min|above|at least|more than|₹|rs\.?|rupees?|रुपये|रु\.?|furnished|unfurnished|semi|[1-5]\s*(?:bhk|bed|bedroom)|pg|hostel|flat|apartment|house|villa|room|within|radius|around|college|hospital|market|railway|family";
 let m=clean.match(/\b(?:near|around|in|at)\b\s+(.+?)(?=\s+(?:under|below|upto|up to|budget|maximum|max|minimum|min|above|at least|more than|furnished|unfurnished|semi|[1-5]\s*(?:bhk|bed|bedroom)|pg|hostel|flat|apartment|house|villa|room|within|radius|around|college|hospital|market|railway|family)\b|$)/i);
 if(m)p.location=m[1].replace(/[.,!?]+$/,"").trim();
 if(!p.location){
  const hindiCityLead=clean.match(/^(.+?)\s+(?:में|mein|me)\s+(.+)$/i);
  if(hindiCityLead){
   const cityPart=hindiCityLead[1].replace(/[.,!?]+$/,"").trim();
   let localityPart=hindiCityLead[2].trim();
   const stop=localityPart.search(/(?:^|\s)(?:(?:के|की|का)\s+)?(?:सब|सभी|सारे|सारी|sab|sari|saari|sare|जितनी\s+भी|जितने\s+भी|जितना\s+भी|jitni\s+bhi|jitne\s+bhi|जितनी|जितने|जितना|jitni|sabhi|saare|saari|jitne|jitna|sirf|only|[1-5]\s*(?:bhk|bed(?:room)?s?|बीएचके|बेडरूम|बेड\s*रूम|कमरे)|प्रॉपर्टीज़?|properties|listings|घर|मकान|फ्लैट|अपार्टमेंट|दिखाओ|दिखा|बताओ|dikhao|dikha|batao|show|find|available|rent|किराये|रेंट|under|below|upto|budget|से कम|के कम|से नीचे|के नीचे|में|mein|me|rental|rent|houses?|homes?|properties?|\d[\d,]*(?:\.\d+)?\s*(?:k|rupees?|rs\.?|रुपये|रु\.?)?|दस\s*हजार)(?=\s|$)/i);
   if(stop>=0)localityPart=localityPart.slice(0,stop).trim();
   localityPart=localityPart.replace(/\s+(?:के|की|का)$/i,"").trim();
   const cityKey=normalizeSearchText(cityPart);
   const knownCities=[["bhopal","Bhopal"],["singrauli","Singrauli"],["indore","Indore"],["jabalpur","Jabalpur"],["gwalior","Gwalior"],["ujjain","Ujjain"],["rewa","Rewa"],["satna","Satna"],["dewas","Dewas"],["sidhi","Sidhi"]];
   const city=knownCities.find(([key])=>new RegExp("(?:^| )"+key+"(?: |$)").test(cityKey));
   const cityTokens=cityKey.split(/\s+/).filter(Boolean);
   const cityIndex=city?cityTokens.indexOf(city[0]):-1;
   const stateTokens=new Set(["madhya","pradesh","mp","ke","the","india","district"]);
   const fillerTokens=new Set(["aaj","hee","hi","ajay","ye","yeh","yeah","achha","accha","okay","ok","haan","han","ji","ab","abhi","toh","please","plz","today"]);
   const localityTokens=city?cityTokens.filter((token,index)=>index!==cityIndex&&!stateTokens.has(token)&&!fillerTokens.has(token)):[];
   const localityFromCity=localityTokens.join(" ");
   const resolvedCity=city?city[1]:cityPart;
   const cityPartWithoutState=cityPart.replace(/\s+(?:madhya\s+pradesh|m\s*p|mp|india|district)\b.*$/i,"").trim();
   const hindiCityLabels={bhopal:"भोपाल",singrauli:"सिंगरौली",indore:"इंदौर",jabalpur:"जबलपुर",gwalior:"ग्वालियर",ujjain:"उज्जैन",rewa:"रीवा",satna:"सतना",dewas:"देवास",sidhi:"सीधी"};
   if(localityPart&&/[\u0900-\u097F]/.test(localityPart)){
    p.location=localityPart+", "+(city?hindiCityLabels[city[0]]||city[1]:resolvedCity);
   }else if(/[a-z]/i.test(cityPart)&&localityTokens.length){
    p.location=cityPartWithoutState;
   }else{
    const resolvedLocality=localityPart||localityFromCity;
    p.location=resolvedLocality?resolvedLocality+", "+resolvedCity:resolvedCity;
   }
  }
 }
 if(!p.location){
  m=clean.match(/^(.+?)\s+(?:ke paas|ke pass|के पास)(?=\s|$)/i);
  if(m)p.location=m[1].replace(/[.,!?]+$/,"").trim();
 }
 if(!p.location){
  const cityToken=normalizeSearchText(clean);
  const cities=[["bhopal","Bhopal"],["singrauli","Singrauli"],["indore","Indore"],["jabalpur","Jabalpur"],["gwalior","Gwalior"],["ujjain","Ujjain"],["rewa","Rewa"],["satna","Satna"],["dewas","Dewas"],["sidhi","Sidhi"]];
  const city=cities.find(([key])=>new RegExp("(?:^| )"+key+"(?: |$)").test(cityToken));
  if(city)p.location=city[1];
 }
 {
  const localityIntent=clean.match(/^(.+?)\s+(?:की|का|के|ki|ka|ke)\s+(?:(?:जितने\s+भी|जितनी\s+भी|जितना\s+भी|jitne\s+bhi|jitni\s+bhi|jitna\s+bhi|सब|सभी|सारे|सारी|sab|sabhi|saare|saari|sari|all|every)\s+)?(?:(?:उपलब्ध|available)\s+)?(?:(?:रेंटल|rental)\s+)?(?:प्रॉपर्टी|प्रॉपर्टीज़?|properties|listings|homes?|houses?|घर|मकान)(?=\s|$)/i);
  if(localityIntent){
   const localityCandidate=localityIntent[1].replace(/[.,!?]+$/,"").trim();
   if(!/(?:\s+में\s+|\s+mein\s+|\s+in\s+)/i.test(localityCandidate))p.location=localityCandidate;
  }
 }
 if(/^(?:my|current) location$/i.test(p.location))p.location="";
 // Resolve common Madhya Pradesh state-plus-city phrases to the actual requested city.
 const locationKey=normalizeSearchText(p.location);
 const knownCities=[
  ["indore","Indore"],["bhopal","Bhopal"],["singrauli","Singrauli"],["jabalpur","Jabalpur"],
  ["gwalior","Gwalior"],["ujjain","Ujjain"],["rewa","Rewa"],["satna","Satna"],["dewas","Dewas"],["sidhi","Sidhi"]
 ];
 const matchedCity=knownCities.find(([key])=>new RegExp("(?:^| )"+key+"(?: |$)").test(locationKey));
 if(matchedCity&&/(madhya pradesh|m p|mp|मध्य प्रदेश)/i.test(original)){
  const withoutState=String(p.location||"").replace(/मध्य\s*प्रदेश|madhya\s+pradesh|\bmp\b/ig," ").replace(/\bke\b|के/ig," ").replace(/\s+/g," ").trim();
  p.location=normalizeSearchText(withoutState)===matchedCity[0]?matchedCity[1]:(withoutState||matchedCity[1]);
 }else if(!p.location&&matchedCity){
  p.location=matchedCity[1];
 }
 // Explicit locality-only "all properties" phrasing must retain the complete locality.
 const localityOnlyRequest=original.match(/^(?:मुझे\s+|mujhe\s+)?(.+?)\s+(?:की|का|के|ki|ka|ke)\s+(?:(?:जितने\s+भी|जितनी\s+भी|जितना\s+भी|jitne\s+bhi|jitni\s+bhi|jitna\s+bhi|सब|सभी|सारे|सारी|sab|sabhi|saare|saari|sari|all|every)\s+)?(?:(?:उपलब्ध|available)\s+)?(?:(?:रेंटल|rental)\s+)?(?:प्रॉपर्टी|प्रॉपर्टीज़?|properties|listings|homes?|houses?|घर|मकान)(?:\s+(?:दिखाओ|दिखा|बताओ|dikhao|dikha|batao|show|find))?\s*[.!?]?$/i);
 if(localityOnlyRequest){
  const requestedLocality=localityOnlyRequest[1].replace(/[.,!?]+$/,"").trim();
  if(requestedLocality){
   const requestedKey=normalizeSearchText(requestedLocality);
   const requestedCity=[["bhopal","Bhopal"],["singrauli","Singrauli"],["indore","Indore"],["jabalpur","Jabalpur"],["gwalior","Gwalior"],["ujjain","Ujjain"],["rewa","Rewa"],["satna","Satna"],["dewas","Dewas"],["sidhi","Sidhi"]].find(([key])=>requestedKey===key);
   p.location=requestedCity?requestedCity[1]:requestedLocality;
  }
 }
 return p;
}

 
function detectReplyLanguage(raw){
 const value=String(raw||"");
 if(/[\u0900-\u097F]/.test(value))return "hi";
 if(/\b(mujhe|mujhko|mein|me|dikhao|ghar|makaan|chahiye|kiraye|khali|wala|wali|wale|ab|sirf|batao|karo)\b/i.test(value))return "hinglish";
 return "en";
}
function assistantReply(language,count,location,error){
 const place=String(location||"").trim();
 if(error){
  if(language==="hi")return "माफ़ कीजिए, अभी "+(place||"इस जगह")+" की प्रॉपर्टी खोज पूरी नहीं हो सकी। "+error;
  if(language==="hinglish")return "Sorry, abhi "+(place||"is location")+" ki property search complete nahi ho saki. "+error;
  return "Sorry, I couldn't complete the property search for "+(place||"that location")+". "+error;
 }
 if(count>0){
  if(language==="hi")return "बिल्कुल! "+(place?place+" में ":"")+"मुझे "+count+" उपलब्ध रेंटल प्रॉपर्टीज़ मिली हैं। मैंने उन्हें मैप और लिस्ट में दिखा दिया है। आप अगली शर्त भी बोल सकते हैं।";
  if(language==="hinglish")return "Bilkul! "+(place?place+" mein ":"")+"mujhe "+count+" available rental properties mili hain. Maine unhe map aur list mein dikha diya hai. Aap next filter bol sakte hain.";
  return "Absolutely! I found "+count+" available rental propert"+(count===1?"y":"ies")+" "+(place?"in "+place+" ":"")+"and displayed "+(count===1?"it":"them")+" on the map and list. You can tell me another filter.";
 }
 if(language==="hi")return (place?place+" में ":"")+"अभी कोई उपलब्ध रेंटल प्रॉपर्टी नहीं मिली। क्या आप आसपास के इलाके में भी खोज करना चाहेंगे?";
 if(language==="hinglish")return (place?place+" mein ":"")+"abhi koi available rental property nahi mili. Kya main aas-paas ke area mein bhi search karun?";
 return "I couldn't find any available rental properties"+(place?" in "+place:"")+". Would you like me to search nearby areas?";
}
function speakAssistantReply(message,language){
 if(!message||!window.speechSynthesis||typeof SpeechSynthesisUtterance==="undefined")return;
 try{
  window.speechSynthesis.cancel();
  const utterance=new SpeechSynthesisUtterance(message);
  utterance.lang=language==="hi"||language==="hinglish"?"hi-IN":"en-IN";
  const voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
  const prefix=utterance.lang.toLowerCase().split("-")[0];
  const voice=voices.find(v=>String(v.lang||"").toLowerCase().startsWith(prefix));
  if(voice)utterance.voice=voice;
  utterance.rate=1;utterance.pitch=1;window.speechSynthesis.speak(utterance);
 }catch(error){console.info("GDR spoken response is unavailable in this browser.",error);}
}

function setValue(id,v,allowEmpty){const el=$(id);if(!el||v==null||(v===""&&!allowEmpty))return;el.value=String(v);el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))}
function applyToForm(p,options){
 if(options&&options.voiceSearch)setValue("renterSearchLocation","",true);
 else setValue("renterSearchLocation",p.location);
 setValue("renterStayType",p.stayType,true);setValue("renterSearchPropertyType",p.propertyType,true);setValue("renterSearchBhk",p.bhk,true);setValue("renterSearchFurnishing",p.furnishing,true);
 setValue("renterMinBudget",p.minBudget||"",true);setValue("renterMaxBudget",p.maxBudget||"",true);
 if(p.minBudget){setValue("renterMinBudgetPreset","custom");setValue("renterMinBudgetCustom",p.minBudget)}
 if(p.maxBudget){setValue("renterMaxBudgetPreset","custom");setValue("renterMaxBudgetCustom",p.maxBudget)}
}
function review(raw,options){
 const extracted=parseRequest(raw),previous=state.parsed||{};
 const p={...previous,...extracted,raw:String(raw||"")};
 const requestText=String(raw||"");
 const broadAllListings=!!extracted.allListings||/(?:\b(?:all|every|any)\b[\s\S]{0,60}\b(?:properties?|listings?)\b)|(?:(?:जितने|जितनी|जितना)\s*भी[\s\S]{0,60}(?:प्रॉपर्टी|प्रॉपर्टीज़?|प्रॉपर्टीज|लिस्टिंग|properties?|listings?))|(?:\b(?:jitne|jitni|jitna)\s+bhi[\s\S]{0,60}\b(?:properties?|listings?)\b)|(?:(?:सब|सभी|सारे|सारी)[\s\S]{0,45}(?:प्रॉपर्टी|प्रॉपर्टीज़?|प्रॉपर्टीज|लिस्टिंग|properties?|listings?))|(?:\b(?:sab|sabhi|saare|saari|sare|sari)\b[\s\S]{0,45}\b(?:properties?|listings?)\b)|(?:(?:प्रॉपर्टी|प्रॉपर्टीज़?|प्रॉपर्टीज|लिस्टिंग|properties?|listings?)[\s\S]{0,45}(?:सब|सभी|सारे|सारी))|(?:\b(?:properties?|listings?)\b[\s\S]{0,45}\b(?:sab|sabhi|saare|saari|sare|sari)\b)/i.test(requestText);
 const broadHomes=/(?:all|every|any)\s+(?:available\s+)?(?:rental\s+)?(?:homes?|houses?)|(?:jitne\s+bhi|sabhi|saare|saari)\s+(?:available\s+)?(?:ghar|makaan|homes?|houses?)|(?:जितने\s+भी|सभी|सारे|सारी)\s+(?:उपलब्ध\s+)?(?:घर|मकान)/i.test(requestText);
 const resetListingType=broadAllListings||broadHomes;
 if(resetListingType){p.stayType=broadAllListings?"":"home";p.propertyType="";}
 const locationChanged=!!(extracted.location&&normalizeSearchText(extracted.location)!==normalizeSearchText(previous.location||""));
 const locationOnlyRequest=!!extracted.location&&!extracted.minBudget&&!extracted.maxBudget&&!extracted.bhk&&!extracted.furnishing&&!extracted.stayType&&!extracted.propertyType&&!extracted.nearby;
 const resetLocationFilters=locationChanged||locationOnlyRequest;
 const resetKeys=broadAllListings?["minBudget","maxBudget","stayType","bhk","furnishing","nearby","propertyType"]:resetLocationFilters?["minBudget","maxBudget","stayType","bhk","furnishing","nearby","propertyType"]:resetListingType?["stayType","propertyType"]:[];
 ["location","minBudget","maxBudget","stayType","bhk","furnishing","nearby","propertyType"].forEach(key=>{
  if(!extracted[key]&&!resetKeys.includes(key))p[key]=previous[key]||"";
  else if(resetKeys.includes(key)&&!extracted[key])p[key]="";
 });
 p.radiusKm=(broadAllListings||resetLocationFilters)?(extracted.radiusKm??null):(extracted.radiusKm==null?(previous.radiusKm??null):extracted.radiusKm);
 p.useMyLocation=(broadAllListings||locationChanged)?!!extracted.useMyLocation:!!(extracted.useMyLocation||previous.useMyLocation);
 p.familyFriendly=(broadAllListings||locationChanged)?!!extracted.familyFriendly:!!(extracted.familyFriendly||previous.familyFriendly);
 if(/\\b(reset|clear|start over|new search)\\b|फिल्टर हटाओ|नई खोज/i.test(String(raw||""))){
  state.parsed=null;
  ["location","minBudget","maxBudget","stayType","bhk","furnishing","nearby","propertyType"].forEach(key=>{if(!extracted[key])p[key]="";});
  p.radiusKm=extracted.radiusKm??null;p.useMyLocation=!!extracted.useMyLocation;p.familyFriendly=!!extracted.familyFriendly;
 }
 if(!p.location&&!p.maxBudget&&!p.bhk&&!p.stayType&&!p.furnishing){
  $("gdrxStatus").textContent="I couldn't identify a location or filter. Please add a city, area, budget, BHK or property type.";
  return false;
 }
 state.parsed=p;applyToForm(p,{voiceSearch:!!(options&&options.autoSearch)});
 const vals=[["Location",p.location||"Not detected"],["Stay type",p.stayType||"Any"],["Property type",p.propertyType||"Any"],["BHK",p.bhk?p.bhk+" BHK":"Any"],["Maximum rent",p.maxBudget?"₹"+Number(p.maxBudget).toLocaleString("en-IN"):"No limit"],["Minimum rent",p.minBudget?"₹"+Number(p.minBudget).toLocaleString("en-IN"):"No minimum"],["Furnishing",p.furnishing||"Any"]];
 const note=p.nearby?"Nearby preference noted: "+p.nearby+". The current property records do not store verified nearby-facility distances, so this is not used to claim a match.":"";
 const box=$("gdrxReview");box.hidden=false;box.innerHTML='<div class="gdrx-review-title"><b>Here is what I understood</b><span>✓ REVIEW</span></div><div class="gdrx-review-grid">'+vals.map(x=>'<div><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join("")+'</div>'+(note?'<p class="gdrx-note">'+esc(note)+'</p>':"")+(options&&options.autoSearch?'<div class="gdrx-review-actions"><span role="status" aria-live="polite">Searching matching homes now… Results will open automatically below.</span></div>':'<div class="gdrx-review-actions"><button type="button" id="gdrxEdit">Edit preferences</button><button type="button" id="gdrxFind">Find matching homes →</button></div>');
 const status=$("gdrxStatus");
 if(options&&options.autoSearch){
  if(!p.location&&!p.useMyLocation){status.textContent="I understood the filters, but I still need a city or locality before searching. Please add one below.";return false;}
  status.textContent="Voice request understood. Applying your filters and searching actual GharDekho listings…";
  const replyLanguage=detectReplyLanguage(raw),spokenReply=replyLanguage==="hi"
   ?"समझ गया। मैं "+(p.location||"आपकी चुनी हुई location")+" में उपलब्ध rental homes खोज रहा हूँ।"
   :"Got it. I'm searching available rental homes in "+(p.location||"your selected location")+".";
  speakAssistantReply(spokenReply,replyLanguage);
 }else status.textContent="Extracted with a local parser. You can edit any field before searching.";
 const editButton=$("gdrxEdit");
 if(editButton)editButton.onclick=()=>$("renterFindHomeForm")?.scrollIntoView({behavior:"smooth",block:"start"});
 const findButton=$("gdrxFind");
 if(findButton)findButton.onclick=()=>searchAssistantListings(p,raw);
 if(options&&options.autoSearch)void searchAssistantListings(p,raw);
 return true;
}
function setRenterMicState(mic,listening){
 if(!mic)return;
 mic.classList.toggle("listening",!!listening);
 mic.setAttribute("aria-pressed",listening?"true":"false");
 mic.setAttribute("aria-label",listening?"Stop voice search":"Find a home by speaking");
 mic.innerHTML=(listening?'<span class="gdrx-mic-visual is-listening" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"></rect><path d="M5.5 10.5v1.2a6.5 6.5 0 0 0 13 0v-1.2M12 18.2v3.3m-4 0h8"></path><path d="M3 8v5m18-5v5"></path></svg></span><span>Stop Listening</span>':'<span class="gdrx-mic-visual" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"></rect><path d="M5.5 10.5v1.2a6.5 6.5 0 0 0 13 0v-1.2M12 18.2v3.3m-4 0h8"></path><path d="M3 8v5m18-5v5"></path></svg></span><span>Find a Home by Speaking</span>');
}
function finishRenterVoice(target,mapMode,session,transcript){
 if(session!==state.voiceSession)return;
 const status=$(mapMode?"gdrxMapStatus":"gdrxStatus"),field=$(target),mic=$(mapMode?"gdrxMapMic":"gdrxMic");
 state.recognition=null;state.voiceActive=false;
 setRenterMicState(mic,false);
 const finalText=String(transcript||"").trim();
 if(!finalText){
  if(status&&status.dataset.voiceError!=="1")status.textContent="No clear speech was captured. Tap the microphone and try again, or type your request.";
  return;
 }
 if(field){field.value=finalText;field.dispatchEvent(new Event("input",{bubbles:true}));}
 if(mapMode){
  state.mapReplyLanguage=detectReplyLanguage(finalText);
  if(status)status.textContent="Speech captured. Review or edit the text, then tap Search map.";
 }else{
  review(finalText,{autoSearch:true});
 }
}
function stopRenterVoice(target,mapMode,processCaptured){
 const session=state.voiceSession,r=state.recognition;
 state.voiceSession++;state.voiceActive=false;state.recognition=null;
 const mic=$(mapMode?"gdrxMapMic":"gdrxMic"),status=$(mapMode?"gdrxMapStatus":"gdrxStatus");
 if(r){try{r.abort?r.abort():r.stop();}catch(_){}}
 setRenterMicState(mic,false);
 const transcript=state.voiceDraft.trim();state.voiceDraft="";
 if(processCaptured&&transcript){
  if($(target))$(target).value=transcript;
  if(mapMode){state.mapReplyLanguage=detectReplyLanguage(transcript);if(status)status.textContent="Speech stopped. Review your transcript and tap Search map.";}
  else review(transcript,{autoSearch:true});
 }else if(status)status.textContent="Microphone stopped. Tap the microphone when you want to speak again.";
}
function startVoice(target,lang){
 const mapMode=target==="gdrxMapPrompt",micId=mapMode?"gdrxMapMic":"gdrxMic",statusId=mapMode?"gdrxMapStatus":"gdrxStatus";
 const status=$(statusId),mic=$(micId),API=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(state.voiceActive&&state.recognition){stopRenterVoice(target,mapMode,true);return;}
 if(!API){
  if(status){status.dataset.voiceError="1";status.textContent="Voice recognition is not available in this browser session. Check Chrome is up to date and use HTTPS; you can still type your request.";}
  return;
 }
 if(!window.isSecureContext){
  if(status)status.textContent="Microphone access requires a secure HTTPS page. You can still type your request.";
  return;
 }
 if(state.recognition){try{state.recognition.abort?state.recognition.abort():state.recognition.stop();}catch(_){}}
 state.voiceSession++;const session=state.voiceSession;
 state.voiceActive=true;state.voiceDraft="";
 const chosen=mapMode?($("gdrxMapLang")?.value||state.lang):(lang||state.lang);
 const r=new API();state.recognition=r;r.lang=chosen;r.continuous=false;r.interimResults=true;r.maxAlternatives=1;
 let finalTranscript="",interimTranscript="",finished=false;
 setRenterMicState(mic,true);
 if(status){status.dataset.voiceError="0";status.textContent="Listening… बोलिए / I'm listening. Press Stop to end the microphone session.";}
 r.onstart=()=>{if(session!==state.voiceSession)return;setRenterMicState(mic,true);};
 r.onresult=e=>{
  if(session!==state.voiceSession||finished)return;
  for(let i=e.resultIndex||0;i<e.results.length;i++){
   const item=e.results[i],value=item&&item[0]&&item[0].transcript||"";
   if(item.isFinal&&value.trim())finalTranscript+=(finalTranscript?" ":"")+value.trim();
   else if(value.trim())interimTranscript=value.trim();
  }
  state.voiceDraft=finalTranscript.trim();
  const field=$(target);if(field){field.value=state.voiceDraft;field.dispatchEvent(new Event("input",{bubbles:true}));}
 };
 r.onerror=e=>{
  if(session!==state.voiceSession||finished)return;
  finished=true;state.voiceActive=false;state.recognition=null;state.voiceSession++;
  setRenterMicState(mic,false);
  if(status){
   status.dataset.voiceError="1";
   const messages={
    "not-allowed":"Microphone permission is blocked. Allow microphone access for ghardekhorenters.com in Chrome site settings, then try again.",
    "service-not-allowed":"Chrome speech recognition service is blocked. Check browser permissions and network access.",
    "no-speech":"No speech was detected. Tap the microphone and speak a little closer to it.",
    "audio-capture":"No microphone input device is available. Check your Windows input device and Chrome microphone permission.",
    "network":"Chrome speech recognition could not reach its speech service. Check your internet connection; typed search remains available.",
    "language-not-supported":"This speech language is not supported by the browser. Select another language or type your request.",
    "aborted":"Microphone session was stopped."
   };
   status.textContent=messages[e.error]||("Voice recognition failed ("+String(e.error||"unknown error")+"). You can type your request instead.");
  }
 };
 r.onend=()=>{
  if(session!==state.voiceSession||finished)return;
  finished=true;
  const transcript=finalTranscript.trim();
  state.voiceDraft=transcript;
  finishRenterVoice(target,mapMode,session,transcript);
 };
 try{r.start();}
 catch(error){
  finished=true;state.voiceActive=false;state.recognition=null;state.voiceSession++;
  setRenterMicState(mic,false);
  if(status)status.textContent="Could not start microphone ("+(error&&error.name||"unknown error")+"). Check Chrome microphone permission or type your request.";
 }
}
function hideUpperAvailableRentalPanel(){
 // One bounded pass is enough: observing the entire document here caused repeated
 // full-page heading scans while property cards and dashboard panels were updating.
 const headings=document.querySelectorAll("h1,h2,h3,h4,h5,[role=heading]");
 for(const heading of headings){
  if(String(heading.textContent||"").replace(/\\s+/g," ").trim().toLowerCase()!=="available rental properties")continue;
  let node=heading;
  for(let depth=0;depth<7&&node&&node!==document.body;depth++,node=node.parentElement){
   const text=String(node.textContent||"").replace(/\\s+/g," ").trim();
   if(/available rental properties/i.test(text)&&/loading properties/i.test(text)){
    node.hidden=true;node.setAttribute("aria-hidden","true");node.setAttribute("data-gdr-hidden-duplicate-rentals","true");node.style.setProperty("display","none","important");
    break;
   }
  }
 }
}
function mountFinder(){
 hideUpperAvailableRentalPanel();
 const sec=$("renterFindHomeSection"),form=$("renterFindHomeForm");if(!sec||!form||$("gdrxFinder"))return;
 const box=document.createElement("section");box.id="gdrxFinder";box.className="gdrx-finder";
 box.innerHTML='<div class="gdrx-finder-heading"><span>GHARDEKHO SMART FINDER</span><h3>Tell GDR what home you are looking for.</h3><p>Talk naturally or type your requirements. GDR will search actual GharDekho listings and show matching homes automatically.</p></div><div class="gdrx-choices"><button type="button" id="gdrxTalk"><i>✦</i><span><b>Find your home with GDR Assistant</b><small>Voice or text · Hindi, English & Hinglish</small></span><em>01</em></button><button type="button" id="gdrxManual"><i>⌕</i><span><b>Search yourself</b><small>Use the manual filters below</small></span><em>02</em></button></div><div class="gdrx-assistant" id="gdrxAssistant"><div class="gdrx-assistant-head"><div><span>● GDR ASSISTANT</span><h4>Tell GDR What Home You are Looking For</h4><p>Speak naturally. We will find homes that match your needs.</p></div><div class="gdrx-orb">⌂</div></div><div class="gdrx-assistant-greeting" id="gdrxWelcome" role="status">Hello! मैं GDR Assistant हूँ — GharDekho का आपका personal assistant. बताइए, आपको किस शहर या locality में घर चाहिए? मैं आपके लिए available rental homes खोज दूँगा।</div><label for="gdrxPrompt">DESCRIBE YOUR IDEAL HOME</label><textarea id="gdrxPrompt" rows="3" placeholder="Mujhe Patel Nagar Bhopal mein 2 BHK furnished flat chahiye. Budget 8000 rupees hai."></textarea><div class="gdrx-tools"><select id="gdrxLang" aria-label="Speech language"><option value="hi-IN">Hindi / Hinglish</option><option value="en-IN">English (India)</option><option value="en-US">English (US)</option></select><button type="button" id="gdrxMic" aria-label="Find a home by speaking" aria-pressed="false"><span class="gdrx-mic-visual" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="2.5" width="6" height="12" rx="3"></rect><path d="M5.5 10.5v1.2a6.5 6.5 0 0 0 13 0v-1.2M12 18.2v3.3m-4 0h8"></path><path d="M3 8v5m18-5v5"></path></svg></span><span>Find a Home by Speaking</span></button><button type="button" id="gdrxUnderstand">Understand my request →</button></div><p id="gdrxStatus" role="status">Microphone is OFF until you click. It listens for one request, then stops. Text search always works.</p><div id="gdrxReview" hidden></div></div>';
 form.parentNode.insertBefore(box,form);
 $("gdrxTalk").onclick=()=>$("gdrxAssistant").scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxManual").onclick=()=>form.scrollIntoView({behavior:"smooth",block:"start"});
 $("gdrxUnderstand").textContent="Find matching homes →";
 $("gdrxUnderstand").setAttribute("aria-label","Search matching homes and show results automatically");
 $("gdrxUnderstand").onclick=()=>review($("gdrxPrompt").value,{autoSearch:true});
 $("gdrxLang").onchange=e=>state.lang=e.target.value;
 $("gdrxMic").onclick=()=>startVoice("gdrxPrompt",state.lang)
}
// Map voice is owned exclusively by GDRMapVoiceAssistant in gdr-map-voice.js.
// The former gdrxMapVoice toolbar injected a second microphone and recognition
// instance, which caused overlapping controls and competing search flows.
function mountMapVoice(){
 const legacy=$("gdrxMapVoice");
 if(legacy)legacy.remove();
}
function mountCompare(){
 if($("gdrxCompare"))return;
 const d=document.createElement("section");d.id="gdrxCompare";d.className="gdrx-compare-tray";d.hidden=true;
 d.innerHTML='<div class="gdrx-tray-top"><div><span class="gdrx-eyebrow">GHARDEKHO COMPARISON</span><h3>Compare properties <small id="gdrxCompareCount">0 / 3</small></h3><p>Shortlist up to three real homes side by side.</p></div><div class="gdrx-tray-actions"><button id="gdrxCompareClear" type="button">Clear all</button><button id="gdrxCompareMinimize" type="button" aria-label="Minimize comparison tray">−</button></div></div><div id="gdrxCompareGrid" class="gdrx-tray-selected"></div><div class="gdrx-tray-discovery"><div class="gdrx-discovery-heading"><strong>Choose another property</strong><span id="gdrxCompareNearbyCount">Loading available homes…</span></div><div class="gdrx-compare-picker-controls"><input id="gdrxCompareSearch" type="search" placeholder="Search by property name or location…" aria-label="Search properties to compare"><select id="gdrxCompareBhk" aria-label="Filter by BHK"><option value="">Any BHK</option><option value="1">1 BHK</option><option value="2">2 BHK</option><option value="3">3 BHK</option><option value="4">4 BHK</option><option value="5">5+ BHK</option></select><select id="gdrxCompareFurnishing" aria-label="Filter by furnishing"><option value="">Any furnishing</option><option value="Furnished">Furnished</option><option value="Semi-Furnished">Semi-Furnished</option><option value="Unfurnished">Unfurnished</option></select></div><div id="gdrxCompareNearby" class="gdrx-nearby-options gdrx-compare-picker-results" aria-live="polite"></div></div><div class="gdrx-tray-bottom"><span id="gdrxCompareHint">Select up to 3 properties</span><button id="gdrxCompareNow" type="button" class="gdrx-compare-now" disabled>Compare now <span aria-hidden="true">→</span></button></div>';
 document.body.appendChild(d);
 const studio=document.createElement("section");studio.id="gdrxCompareStudio";studio.className="gdrx-compare-studio";studio.hidden=true;document.body.appendChild(studio);
 try{const saved=JSON.parse(sessionStorage.getItem("gdrxCompareHomes")||"[]");if(Array.isArray(saved))state.compare=saved.filter(p=>p&&p.id!=null).slice(0,3)}catch(_){}
 $("gdrxCompareClear").onclick=()=>{state.compare=[];renderCompare();toast("Comparison cleared.")};
 $("gdrxCompareMinimize").onclick=()=>d.classList.toggle("is-minimized");
 $("gdrxCompareNow").onclick=openCompareStudio;
 $("gdrxCompareSearch").addEventListener("input",e=>{comparePickerQuery=e.target.value||"";renderComparePicker()});
 $("gdrxCompareBhk").addEventListener("change",e=>{comparePickerBhk=e.target.value||"";renderComparePicker()});
 $("gdrxCompareFurnishing").addEventListener("change",e=>{comparePickerFurnishing=e.target.value||"";renderComparePicker()});
 if(state.compare.length)renderCompare();
 loadComparePickerInventory();
}
function buildCompareSelection(primary,available){
 const key=p=>String(p&&p.id!=null?p.id:"");
 if(!key(primary))return [];
 const unique=new Map([[key(primary),primary]]);
 (Array.isArray(available)?available:[]).filter(p=>key(p)&&key(p)!==key(primary)).slice().sort((a,b)=>{
  const da=Number(a.gdrDistanceKm),db=Number(b.gdrDistanceKm);
  return (Number.isFinite(da)?da:Number.POSITIVE_INFINITY)-(Number.isFinite(db)?db:Number.POSITIVE_INFINITY);
 }).forEach(p=>{if(unique.size<3&&!unique.has(key(p)))unique.set(key(p),p)});
 return Array.from(unique.values()).slice(0,3);
}
function getNearbyCompareProperties(){
 const visible=window.GDRMapExperience&&typeof window.GDRMapExperience.getRenterVisibleProperties==="function"?window.GDRMapExperience.getRenterVisibleProperties():[];
 const selected=new Set(state.compare.map(p=>String(p.id)));
 return (Array.isArray(visible)?visible:[]).filter(p=>p&&p.id!=null&&!selected.has(String(p.id))).sort((a,b)=>{
  const da=Number(a.gdrDistanceKm),db=Number(b.gdrDistanceKm);
  return (Number.isFinite(da)?da:Number.POSITIVE_INFINITY)-(Number.isFinite(db)?db:Number.POSITIVE_INFINITY);
 });
}
function comparePropertyImage(p){
 const images=Array.isArray(p.images)?p.images:[];
 const value=p.image_url||p.cover_image||p.photo_url||p.thumbnail_url||images[0]||"";
 return /^https?:\/\//i.test(String(value))?String(value):"/assets/gdr-property-placeholder.svg";
}
function renderComparePicker(){
 const root=$("gdrxCompareNearby");if(!root)return;
 const selected=new Set(state.compare.map(p=>String(p.id)));
 const query=normalizeSearchText(comparePickerQuery.trim()),tokens=query.split(/\s+/).filter(Boolean);
 const base=filterAssistantListings(comparePickerRows,{});
 const rows=base.filter(p=>{
  if(!p||p.id==null||selected.has(String(p.id)))return false;
  if(comparePickerBhk){const bhk=normalizedPropertyBhk(p);if(bhk===null||(comparePickerBhk==="5"?bhk<5:bhk!==Number(comparePickerBhk)))return false}
  if(comparePickerFurnishing&&String(p.furnishing||"").trim().toLowerCase()!==comparePickerFurnishing.toLowerCase())return false;
  if(tokens.length){const hay=normalizeSearchText([p.title,p.name,p.location,p.address,p.pincode,p.bhk,p.furnishing,p.property_type,p.listing_type,p.rent].filter(Boolean).join(" "));if(!tokens.every(token=>hay.includes(token)))return false}
  return true;
 });
 rows.sort((a,b)=>String(a.title||a.name||"").localeCompare(String(b.title||b.name||"")));
 $("gdrxCompareNearbyCount").textContent=rows.length?rows.length+" available properties":"No matching properties found";
 root.replaceChildren();
 if(comparePickerLoading&&!comparePickerRows.length){const note=document.createElement("p");note.className="gdrx-no-nearby";note.textContent="Loading real properties from GharDekho…";root.append(note);return}
 if(comparePickerError&&!comparePickerRows.length){const note=document.createElement("p");note.className="gdrx-no-nearby";note.textContent=comparePickerError;const retry=document.createElement("button");retry.type="button";retry.className="gdrx-picker-retry";retry.textContent="Try again";retry.onclick=loadComparePickerInventory;root.append(note,retry);return}
 if(!rows.length){const note=document.createElement("p");note.className="gdrx-no-nearby";note.textContent=comparePickerRows.length?"No properties match these filters. Try another search or clear a filter.":"No available properties were returned by the database.";root.append(note);return}
 rows.slice(0,9).forEach(p=>{
  const card=document.createElement("article");card.className="gdrx-picker-property";
  const img=document.createElement("img");img.alt="";img.loading="lazy";img.src=comparePropertyImage(p);img.onerror=()=>{img.src="/assets/gdr-property-placeholder.svg"};
  const details=document.createElement("div");details.className="gdrx-picker-details";
  const name=document.createElement("strong");name.textContent=p.title||p.name||"Rental property";
  const rent=document.createElement("b");rent.textContent=moneyCompare(p.rent)+"/month";
  const meta=document.createElement("span");meta.textContent=[p.bhk?(p.bhk+" BHK"):"",p.furnishing||"",p.location||p.address||""].filter(Boolean).join(" · ")||"Property details available";
  const add=document.createElement("button");add.type="button";add.className="gdrx-picker-add";add.textContent="＋ Add";add.disabled=state.compare.length>=3;add.setAttribute("aria-label","Add "+name.textContent+" to comparison");add.onclick=()=>addCompareProperty(p);
  details.append(name,rent,meta);card.append(img,details,add);root.append(card);
 });
 if(rows.length>9){const more=document.createElement("p");more.className="gdrx-picker-more";more.textContent="Showing 9 of "+rows.length+" matches. Refine your search to narrow the list.";root.append(more)}
 if(state.compare.length>=3){const note=document.createElement("p");note.className="gdrx-picker-limit";note.textContent="All 3 comparison slots are filled. Remove a selected property to add another.";root.append(note)}
}
async function loadComparePickerInventory(){
 if(comparePickerLoading)return;
 comparePickerLoading=true;comparePickerError="";renderComparePicker();
 try{const rows=await loadPublicInventory();comparePickerRows=filterAssistantListings(rows,{});comparePickerError=""}
 catch(error){comparePickerError=error&&error.message?error.message:"Could not load properties. Please try again."}
 finally{comparePickerLoading=false;renderComparePicker()}
}
function addCompareProperty(p){
 if(!p||p.id==null)return;
 if(state.compare.some(x=>String(x.id)===String(p.id))){toast("This property is already selected.");return}
 if(state.compare.length>=3){toast("Remove a property before adding another. Maximum 3.");return}
 state.compare.push(p);renderCompare();toast("Property added to comparison.");
}
function toggleCompare(p){
 if(!p||p.id==null)return;
 const id=String(p.id),existing=state.compare.findIndex(x=>String(x.id)===id);
 if(existing>=0){renderCompare();toast("This property is already selected.");return}
 if(state.compare.length>=3){toast("Compare up to three homes at a time.");return}
 if(!state.compare.length){
  const visible=window.GDRMapExperience&&typeof window.GDRMapExperience.getRenterVisibleProperties==="function"?window.GDRMapExperience.getRenterVisibleProperties():[];
  state.compare=buildCompareSelection(p,visible);
  toast(state.compare.length>1?state.compare.length+" nearby homes added. You can remove or replace any home.":"Added. Select another nearby home to compare.");
 }else{state.compare.push(p);toast("Added to comparison.")}
 renderCompare();
}
function compareValue(p,key,formatter){
 const value=p&&p[key];
 if(value===null||value===undefined||value==="")return "Not available";
 return formatter?formatter(value,p):String(value);
}
function moneyCompare(value){
 const n=Number(value);return Number.isFinite(n)&&n>=0?"₹"+n.toLocaleString("en-IN"):"Not available";
}
function compareFields(){
 return [
  {label:"Monthly rent",get:p=>moneyCompare(p.rent),raw:p=>p.rent,kind:"low"},
  {label:"Security deposit",get:p=>moneyCompare(p.security_deposit),raw:p=>p.security_deposit,kind:"low"},
  {label:"Configuration",get:p=>p.bhk?String(p.bhk)+" BHK":p.room_type||p.listing_type||"Not available"},
  {label:"Location",get:p=>[p.location,p.address].filter(Boolean).join(", ")||"Not available"},
  {label:"Distance",get:p=>Number.isFinite(Number(p.gdrDistanceKm))?Number(p.gdrDistanceKm).toFixed(1)+" km":"Not available",raw:p=>p.gdrDistanceKm,kind:"low"},
  {label:"Furnishing",get:p=>p.furnishing||"Not available"},
  {label:"Property area",get:p=>p.area?String(p.area)+(String(p.area).match(/[a-z]/i)?"":" sq ft"):"Not available"},
  {label:"Monthly maintenance",get:p=>moneyCompare(p.monthly_maintenance),raw:p=>p.monthly_maintenance,kind:"low"},
  {label:"Estimated monthly total",get:p=>p.rent==null?"Not available":p.monthly_maintenance==null?"Rent only · maintenance not listed":moneyCompare(Number(p.rent)+Number(p.monthly_maintenance)),raw:p=>p.rent==null||p.monthly_maintenance==null?null:Number(p.rent)+Number(p.monthly_maintenance),kind:"low"},
  {label:"Amenities",get:p=>Array.isArray(p.amenities)&&p.amenities.length?p.amenities.join(", "):typeof p.amenities==="string"&&p.amenities.trim()?p.amenities:"Not available"},
  {label:"Availability",get:p=>{const raw=String(p.availability_status||p.availability||p.occupancy_status||p.status||"").toLowerCase();return raw?raw.replace(/_/g," ").replace(/\b\w/g,x=>x.toUpperCase()):"Not available"}},
  {label:"Owner verification",get:p=>p.owner_verified===true||String(p.owner_verification_status||"").toLowerCase()==="verified"?"Verified":p.owner_verified===false||String(p.owner_verification_status||"").toLowerCase()==="not_verified"?"Not verified":"Not available"}
 ];
}
function renderCompare(){
 const d=$("gdrxCompare"),grid=$("gdrxCompareGrid");if(!d||!grid)return;
 const count=state.compare.length;d.hidden=!count;
 $("gdrxCompareCount").textContent=count+" / 3";
 $("gdrxCompareNow").disabled=count<2;
 $("gdrxCompareHint").textContent=count<2?"Add at least one more property to compare":count+" properties ready to compare";
 try{if(count)sessionStorage.setItem("gdrxCompareHomes",JSON.stringify(state.compare));else sessionStorage.removeItem("gdrxCompareHomes")}catch(_){}
 grid.replaceChildren();
 state.compare.forEach((p,index)=>{
  const card=document.createElement("article");card.className="gdrx-tray-property";
  const img=document.createElement("img");img.alt="";img.loading="lazy";if(p.image_url&&/^https?:\/\//i.test(String(p.image_url)))img.src=p.image_url;else img.src="/assets/gdr-property-placeholder.svg";img.onerror=()=>{img.src="/assets/gdr-property-placeholder.svg"};
  const info=document.createElement("div"),name=document.createElement("strong"),rent=document.createElement("span"),remove=document.createElement("button");
  name.textContent=p.title||p.name||"Rental property";rent.textContent=moneyCompare(p.rent)+"/month";info.append(name,rent);
  remove.type="button";remove.className="gdrx-remove-property";remove.textContent="×";remove.setAttribute("aria-label","Remove "+name.textContent);remove.onclick=()=>{state.compare=state.compare.filter((_,i)=>i!==index);renderCompare();if(!$("gdrxCompareStudio").hidden)renderCompareStudio();toast("Property removed.")};
  card.append(img,info,remove);grid.append(card);
 });
 renderComparePicker();
 if(!$("gdrxCompareStudio").hidden)renderCompareStudio();
}
function openCompareStudio(){
 if(state.compare.length<2){toast("Select at least two properties to compare.");return}
 const studio=$("gdrxCompareStudio");if(!studio)return;
 studio.hidden=false;document.body.classList.add("gdrx-studio-open");renderCompareStudio();studio.focus?.();
}
function renderCompareStudio(){
 const studio=$("gdrxCompareStudio");if(!studio||studio.hidden)return;
 studio.replaceChildren();
 const head=document.createElement("header");head.className="gdrx-studio-header";
 const heading=document.createElement("div"),eyebrow=document.createElement("span"),title=document.createElement("h2"),subtitle=document.createElement("p"),actions=document.createElement("div"),close=document.createElement("button");
 eyebrow.textContent="GHARDEKHO · PROPERTY DECISION STUDIO";title.textContent="Compare your shortlisted homes";subtitle.textContent="A clear, side-by-side view using verified listing data.";
 heading.append(eyebrow,title,subtitle);actions.className="gdrx-studio-actions";
 const clear=document.createElement("button");clear.type="button";clear.textContent="Clear all";clear.onclick=()=>{state.compare=[];renderCompare();studio.hidden=true;document.body.classList.remove("gdrx-studio-open")};
 close.type="button";close.className="gdrx-studio-close";close.textContent="×";close.setAttribute("aria-label","Close comparison studio");close.onclick=()=>{studio.hidden=true;document.body.classList.remove("gdrx-studio-open")};
 actions.append(clear,close);head.append(heading,actions);studio.append(head);
 const matrix=document.createElement("div");matrix.className="gdrx-comparison-matrix";
 const labels=document.createElement("div");labels.className="gdrx-matrix-labels";const labelHead=document.createElement("div");labelHead.className="gdrx-matrix-label-head";labelHead.textContent="PROPERTY DETAILS";labels.append(labelHead);
 const fields=compareFields();
 fields.forEach(f=>{const el=document.createElement("div");el.className="gdrx-matrix-label";el.textContent=f.label;labels.append(el)});
 const columns=document.createElement("div");columns.className="gdrx-matrix-columns";columns.style.gridTemplateColumns="repeat("+state.compare.length+",minmax(220px,1fr))";
 state.compare.forEach((p,index)=>{
  const col=document.createElement("article");col.className="gdrx-matrix-property";
  const top=document.createElement("div");top.className="gdrx-matrix-property-head";
  const img=document.createElement("img");img.alt="";img.loading="lazy";img.src=p.image_url&&/^https?:\/\//i.test(String(p.image_url))?p.image_url:"/assets/gdr-property-placeholder.svg";img.onerror=()=>{img.src="/assets/gdr-property-placeholder.svg"};
  const name=document.createElement("h3");name.textContent=p.title||p.name||"Rental property";
  const price=document.createElement("strong");price.textContent=moneyCompare(p.rent)+"/month";
  const controls=document.createElement("div");controls.className="gdrx-property-controls";
  const remove=document.createElement("button");remove.type="button";remove.textContent="Remove";remove.onclick=()=>{state.compare=state.compare.filter((_,i)=>i!==index);renderCompare();if(state.compare.length<2){studio.hidden=true;document.body.classList.remove("gdrx-studio-open")}else renderCompareStudio()};
  const replace=document.createElement("button");replace.type="button";replace.textContent="Replace";replace.onclick=()=>{const options=getNearbyCompareProperties();showReplaceOptions(index,options)};
  controls.append(replace,remove);top.append(img,name,price,controls);col.append(top);
  fields.forEach(f=>{const row=document.createElement("div");row.className="gdrx-matrix-value";const val=document.createElement("span");val.textContent=f.get(p);if(f.kind==="low"&&f.raw){const nums=state.compare.map(x=>Number(f.raw(x))).filter(v=>Number.isFinite(v)&&v>=0);if(nums.length>1&&Number(f.raw(p))===Math.min(...nums))row.classList.add("is-best")};row.append(val);col.append(row)});
  columns.append(col);
 });
 matrix.append(labels,columns);studio.append(matrix);
 const recommendation=document.createElement("section");recommendation.className="gdrx-value-insights";const rh=document.createElement("h3");rh.textContent="Quick comparison insights";recommendation.append(rh);
 const insights=[];
 const lowest=(key,label)=>{const rows=state.compare.filter(p=>p[key]!=null&&Number.isFinite(Number(p[key])));if(rows.length){const best=rows.reduce((a,b)=>Number(a[key])<=Number(b[key])?a:b);insights.push(label+": "+(best.title||best.name||"Selected property")+" ("+moneyCompare(best[key])+")")}};
 lowest("rent","Lowest monthly rent");lowest("security_deposit","Lowest security deposit");
 const distances=state.compare.filter(p=>Number.isFinite(Number(p.gdrDistanceKm)));if(distances.length){const best=distances.reduce((a,b)=>Number(a.gdrDistanceKm)<=Number(b.gdrDistanceKm)?a:b);insights.push("Closest property: "+(best.title||best.name||"Selected property")+" ("+Number(best.gdrDistanceKm).toFixed(1)+" km)")};
 const amenityRows=state.compare.map(p=>({p,count:Array.isArray(p.amenities)?p.amenities.length:typeof p.amenities==="string"?p.amenities.split(",").map(x=>x.trim()).filter(Boolean).length:0})).filter(x=>x.count>0);if(amenityRows.length){const best=amenityRows.reduce((a,b)=>a.count>=b.count?a:b);insights.push("Most listed amenities: "+(best.p.title||best.p.name||"Selected property")+" ("+best.count+" listed)")};
 const valueRows=state.compare.map(p=>({p,cost:p.rent==null?NaN:Number(p.rent)+Number(p.monthly_maintenance||0),distance:Number(p.gdrDistanceKm)}));if(valueRows.length>=2&&valueRows.every(x=>x.p.rent!=null&&x.p.monthly_maintenance!=null&&Number.isFinite(x.cost)&&Number.isFinite(x.distance)&&x.cost>=0&&x.distance>=0)){const costRank=x=>valueRows.filter(y=>y.cost<x.cost).length;const distanceRank=x=>valueRows.filter(y=>y.distance<x.distance).length;const best=valueRows.slice().sort((a,b)=>(costRank(a)+distanceRank(a))-(costRank(b)+distanceRank(b)))[0];insights.push("Best overall value: "+(best.p.title||best.p.name||"Selected property")+" (equal-weight ranking of monthly rent + recorded maintenance and distance)")};
 const note=document.createElement("p");note.textContent=insights.length?insights.join("  •  "):"Not enough verified information to generate a reliable recommendation.";recommendation.append(note);studio.append(recommendation);
 const footer=document.createElement("p");footer.className="gdrx-studio-footnote";footer.textContent="Recommendations use only listing values available in GharDekho. Missing information is not estimated; monthly totals exclude unlisted charges.";studio.append(footer);
}
function showReplaceOptions(index,options){
 const studio=$("gdrxCompareStudio");let panel=$("gdrxReplaceOptions");if(panel)panel.remove();
 panel=document.createElement("section");panel.id="gdrxReplaceOptions";panel.className="gdrx-replace-options";
 const title=document.createElement("h3");title.textContent="Replace with a nearby property";panel.append(title);
 if(!options.length){const empty=document.createElement("p");empty.textContent="No other matching properties are currently available. Expand the map area to discover more.";panel.append(empty)}
 options.slice(0,8).forEach(p=>{const b=document.createElement("button");b.type="button";b.textContent=(p.title||p.name||"Rental property")+" · "+moneyCompare(p.rent)+"/mo";b.onclick=()=>{state.compare[index]=p;renderCompare();panel.remove();renderCompareStudio();toast("Property replaced.")};panel.append(b)});
 const cancel=document.createElement("button");cancel.type="button";cancel.textContent="Cancel";cancel.onclick=()=>panel.remove();panel.append(cancel);studio.append(panel);
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
function moveEditProfileToAccount(){
 const root=$("renterDashboard"),button=root?.querySelector(".renter-edit-profile-compact");
 if(!root||!button)return;
 if(button.closest(".renter-account-edit-stack"))return;
 const normalize=value=>String(value||"").replace(/\s+/g," ").trim();
 const candidates=Array.from(document.querySelectorAll("body *")).filter(el=>{
  if(el===button||el.contains(button))return false;
  const value=normalize(el.innerText||el.textContent);
  return /ODD\s+JI/i.test(value)&&/Renter/i.test(value)&&value.length<=100;
 });
 candidates.sort((a,b)=>normalize(a.innerText||a.textContent).length-normalize(b.innerText||b.textContent).length);
 const badge=candidates[0];
 if(!badge||!badge.parentElement)return;
 const stack=document.createElement("div");
 stack.className="renter-account-edit-stack";
 badge.parentElement.insertBefore(stack,badge);
 stack.append(badge,button);
}
function ensureAssistantResultStyles(){
 if(document.querySelector("link[data-gdrx-assistant-result-styles]"))return;
 const link=document.createElement("link");link.rel="stylesheet";link.href="/assets/gdr-renter-experience.css?v=20261107-smart-assistant-results-1";link.dataset.gdrxAssistantResultStyles="true";document.head.appendChild(link);
}

function clearRenterSearchFilters(){
 const blankSelect=(id,label)=>{
  const el=$(id);if(!el||!el.options)return;
  let option=Array.from(el.options).find(item=>String(item.value)==="");
  if(!option){option=document.createElement("option");option.value="";option.textContent=label;el.insertBefore(option,el.firstChild);}
  el.value="";
  el.dispatchEvent(new Event("input",{bubbles:true}));
  el.dispatchEvent(new Event("change",{bubbles:true}));
 };
 [["renterMinBudgetPreset","No minimum"],["renterMaxBudgetPreset","No maximum"],["renterStayType","All property types"],["renterSearchPropertyType","Any property type"],["renterSearchBhk","Any BHK"],["renterSearchFurnishing","Any furnishing"]].forEach(([id,label])=>blankSelect(id,label));
 ["renterMinBudget","renterMaxBudget","renterMinBudgetCustom","renterMaxBudgetCustom"].forEach(id=>{
  const el=$(id);if(!el)return;el.value="";el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));
 });
}
function bindLocationOnlySearchReset(){
 const location=$("renterSearchLocation");if(!location||location.dataset.gdrLocationResetBound)return;
 location.dataset.gdrLocationResetBound="1";
 let baseline=normalizeSearchText(location.value||""),cleared=false;
 const resetIfLocationChanged=()=>{
  const current=normalizeSearchText(location.value||"");
  if(!current||current===baseline){cleared=false;return;}
  if(!cleared){clearRenterSearchFilters();cleared=true;toast("New location selected. Searching all property types and budgets; you can reapply filters below.");}
 };
 location.addEventListener("focus",()=>{baseline=normalizeSearchText(location.value||"");cleared=false;});
 location.addEventListener("input",resetIfLocationChanged);
 location.addEventListener("change",resetIfLocationChanged);
 location.addEventListener("blur",()=>{resetIfLocationChanged();baseline=normalizeSearchText(location.value||"");cleared=false;});
}

function bind(){
 bindLocationOnlySearchReset();ensureAssistantResultStyles();moveEditProfileToAccount();addSupport();mountFinder();mountCompare();$("renterDashboard")?.classList.add("gdrx-premium");
 const results=$("propertiesContainer");if(results&&!results.dataset.gdrxScoreObserver){results.dataset.gdrxScoreObserver="1";let scoreFrame=0;new MutationObserver(()=>{if(scoreFrame)return;scoreFrame=requestAnimationFrame(()=>{scoreFrame=0;applyManualScores();});}).observe(results,{childList:true,subtree:true})}
 const form=$("renterFindHomeForm");if(form&&!form.dataset.gdrxScoreCapture){form.dataset.gdrxScoreCapture="1";form.addEventListener("submit",()=>{state.parsed={location:$("renterSearchLocation")?.value||"",bhk:$("renterSearchBhk")?.value||"",furnishing:$("renterSearchFurnishing")?.value||"",stayType:$("renterStayType")?.value||"",minBudget:$("renterMinBudget")?.value||"",maxBudget:$("renterMaxBudget")?.value||""};setTimeout(applyManualScores,1000)})}
 const fbtn=$("renterFindHomeBtn");if(fbtn&&!fbtn.dataset.gdrx){fbtn.dataset.gdrx="1";fbtn.addEventListener("click",openFind)}
 ["renterFindHomeBackBtn","renterFindHomeCancelBtn"].forEach(id=>{const b=$(id);if(b&&!b.dataset.gdrx){b.dataset.gdrx="1";b.addEventListener("click",closeFind)}})
 const map=$("gdrExploreMapPanel");if(map)map.querySelector("#gdrxMapVoice")?.remove();
}
window.GDRRenterExperience={toggleCompare,buildCompareSelection,parseRequest,normalizeSearchText,filterAssistantListings,searchAssistantListings,openFindHome:openFind,closeFindHome:closeFind,addCompareProperty,openCompareStudio};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();window.addEventListener("load",bind);
// Bind once after DOM readiness and once after full load. Do not observe the
// entire document: bind() scans/moves dashboard nodes and would be re-run for
// every property-card mutation, creating avoidable main-thread work.
})();