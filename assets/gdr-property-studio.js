(function(){
"use strict";
const VERSION="20261107-voiceassistant1";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={
  user:null,owner:null,step:0,publishing:false,published:false,propertyType:"",configuration:"",
  rent:"",deposit:"",furnishing:"",description:"",address:"",pincode:"",lat:null,lng:null,
  roomType:"",gender:"",totalBeds:"",availableBeds:"",foodIncluded:"",
  files:[],coverIndex:0,uploadedPhotos:[],uploadedPaths:[],nearbyPlaces:[],
  submissionId:"",recognition:null,recording:false,mapParent:null,mapNext:null,voice:{active:false,manualStop:false,speaking:false,restartTimer:null,turnTimer:null,turnText:"",finalText:"",interimText:"",pending:{},awaitingConfirmation:false,lastReply:"",lastQuestion:"",lastField:"",muted:false,language:"hi",session:0,permissionBlocked:false,skippedDeposit:false}
};
const typeLabels={
 apartment:"Apartment / Flat",independent_house:"Independent House",villa:"Villa",
 pg:"PG",hostel:"Hostel",other:"Other"
};
const configurations=["1 RK","1 BHK","2 BHK","3 BHK","4 BHK","5+ BHK"];
const allowedTypes=["image/jpeg","image/png","image/webp"];
let searchTimer=null,searchController=null,nearbyRun=0,nearbyController=null;
function client(){return window.__gdrSupabaseClient||null;}
function studio(){return $("#gdrPropertyStudio");}
function message(text,tone){
 const el=$("#gdrStudioMessage");if(!el)return;
 el.textContent=text||"";el.dataset.tone=tone||"info";el.hidden=!text;
}
function setStatus(text){const el=$("#gdrStudioDraftStatus");if(el)el.textContent=text;}
function uuid(){
 if(window.crypto&&typeof window.crypto.randomUUID==="function")return window.crypto.randomUUID();
 return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16);});
}
function draftKey(){return "gdr_property_studio_draft_v1:"+String(state.user&&state.user.id||"guest");}
function saveDraft(){
 if(!state.user)return;
 const data={
  propertyType:state.propertyType,configuration:state.configuration,rent:state.rent,deposit:state.deposit,
  description:state.description,furnishing:state.furnishing,address:state.address,pincode:state.pincode,lat:state.lat,lng:state.lng,
  roomType:state.roomType,gender:state.gender,totalBeds:state.totalBeds,availableBeds:state.availableBeds,
  foodIncluded:state.foodIncluded,uploadedPhotos:state.uploadedPhotos,uploadedPaths:state.uploadedPaths,
  nearbyPlaces:state.nearbyPlaces,submissionId:state.submissionId,step:state.step
 };
 try{localStorage.setItem(draftKey(),JSON.stringify(data));setStatus("Draft saved automatically");}catch(e){setStatus("Draft could not be saved on this device");}
}
function restoreDraft(){
 if(!state.user)return;
 try{
  const raw=localStorage.getItem(draftKey());if(!raw)return;
  const d=JSON.parse(raw);if(!d||typeof d!=="object")return;
  ["propertyType","configuration","rent","deposit","furnishing","description","address","pincode","roomType","gender","totalBeds","availableBeds","foodIncluded"].forEach(k=>{if(d[k]!==undefined)state[k]=d[k];});
  state.lat=Number.isFinite(Number(d.lat))&&d.lat!==null?Number(d.lat):null;
  state.lng=Number.isFinite(Number(d.lng))&&d.lng!==null?Number(d.lng):null;
  state.uploadedPhotos=Array.isArray(d.uploadedPhotos)?d.uploadedPhotos:[];
  state.uploadedPaths=Array.isArray(d.uploadedPaths)?d.uploadedPaths:[];
  state.nearbyPlaces=Array.isArray(d.nearbyPlaces)?d.nearbyPlaces:[];
  state.submissionId=d.submissionId||uuid();
  state.step=Number.isInteger(d.step)?Math.min(4,Math.max(0,d.step)):0;
  syncFormFromState();
  if(state.uploadedPhotos.length)renderPhotos();
  if(state.lat!==null&&state.lng!==null)renderNearby();
  message("Your saved draft has been restored. Review the details and continue.","success");
 }catch(e){console.warn("Property Studio draft restore failed",e);}
}
function syncFormFromState(){
 const values={
  gdrStudioLocation:state.address,gdrStudioPincode:state.pincode,gdrStudioRent:state.rent,
  gdrStudioDeposit:state.deposit,gdrStudioFurnishing:state.furnishing,gdrStudioDescription:state.description,
  gdrStudioRoomType:state.roomType,gdrStudioGender:state.gender,
  gdrStudioTotalBeds:state.totalBeds,gdrStudioAvailableBeds:state.availableBeds
 };
 Object.keys(values).forEach(id=>{const el=document.getElementById(id);if(el)el.value=values[id]??"";});
 const food=$("#gdrStudioFoodIncluded");if(food)food.value=state.foodIncluded||"";
 updateTypeCards();updateConfigurationCards();updateConditionalFields();updateLocationStatus();
}
function updateTypeCards(){
 $$("[data-gdr-property-type]").forEach(b=>{
  const active=b.dataset.gdrPropertyType===state.propertyType;
  b.classList.toggle("is-selected",active);b.setAttribute("aria-pressed",active?"true":"false");
 });
}
function updateConfigurationCards(){
 $$("[data-gdr-configuration]").forEach(b=>{
  const active=b.dataset.gdrConfiguration===state.configuration;
  b.classList.toggle("is-selected",active);b.setAttribute("aria-pressed",active?"true":"false");
 });
}
function updateConditionalFields(){
 const home=["apartment","independent_house","villa"].includes(state.propertyType);
 const other=state.propertyType==="other";
 const pg=["pg","hostel"].includes(state.propertyType);
 const config=$("#gdrStudioConfigurationWrap");if(config)config.hidden=!(home||other);
 const pgWrap=$("#gdrStudioPgDetails");if(pgWrap)pgWrap.hidden=!pg;
 const confLabel=$("#gdrStudioConfigurationLabel");if(confLabel)confLabel.textContent=other?"Property configuration":"BHK configuration";
 if(other){
  const wrap=$("#gdrStudioConfigurationOptions");if(wrap)wrap.hidden=true;
  const hint=$("#gdrStudioOtherHint");if(hint)hint.hidden=false;
 }else{
  const wrap=$("#gdrStudioConfigurationOptions");if(wrap)wrap.hidden=false;
  const hint=$("#gdrStudioOtherHint");if(hint)hint.hidden=true;
 }
}
function updateLocationStatus(){
 const el=$("#gdrStudioLocationStatus");if(!el)return;
 if(state.lat!==null&&state.lng!==null)el.textContent="Location pin confirmed · "+state.lat.toFixed(5)+", "+state.lng.toFixed(5);
 else el.textContent="Choose a search result, use GPS or place the pin on the map.";
}
function setLocation(address,lat,lng,pincode){
 state.address=String(address||"").trim();
 state.lat=Number.isFinite(Number(lat))?Number(lat):null;
 state.lng=Number.isFinite(Number(lng))?Number(lng):null;
 if(pincode)state.pincode=String(pincode).replace(/\D/g,"").slice(0,6);
 const input=$("#gdrStudioLocation");if(input)input.value=state.address;
 const pin=$("#gdrStudioPincode");if(pin)pin.value=state.pincode;
 updateLocationStatus();saveDraft();
 if(state.lat!==null&&state.lng!==null)loadNearbyPlaces();
}
function escapeHtml(value){
 return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function distanceMeters(a,b,c,d){
 const rad=x=>x*Math.PI/180,R=6371000;
 const dLat=rad(c-a),dLng=rad(d-b);
 const q=Math.sin(dLat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLng/2)**2;
 return 2*R*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
function distanceLabel(m){
 const n=Number(m||0);return n<1000?Math.round(n)+" m":(n/1000).toFixed(1)+" km";
}
function formatINR(v){
 const n=Number(v||0);return "₹"+n.toLocaleString("en-IN",{maximumFractionDigits:0});
}
function showSuggestions(items){
 const box=$("#gdrStudioLocationSuggestions");if(!box)return;
 box.innerHTML="";
 if(!items.length){box.hidden=true;return;}
 items.forEach(item=>{
  const p=item.properties||{},coords=item.geometry&&item.geometry.coordinates||[];
  const label=[p.name,p.street,p.locality,p.district,p.city,p.state,p.postcode,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(", ");
  if(!label||coords.length<2)return;
  const b=document.createElement("button");b.type="button";b.className="gdr-studio-suggestion";
  const strong=document.createElement("strong");strong.textContent=label;
  const small=document.createElement("small");small.textContent="Use this address and save its map coordinates";
  b.append(strong,small);
  b.addEventListener("click",()=>{
   setLocation(label,Number(coords[1]),Number(coords[0]),p.postcode||"");
   box.hidden=true;
   const status=$("#gdrStudioLocationStatus");if(status)status.textContent="✓ Address selected. Exact coordinates saved.";
  });
  box.appendChild(b);
 });
 box.hidden=!box.childElementCount;
}
async function searchAddress(query){
 if(searchController)searchController.abort();
 searchController=new AbortController();
 const box=$("#gdrStudioLocationSuggestions"),status=$("#gdrStudioLocationStatus");
 if(box){box.innerHTML="";box.hidden=false;}
 if(status)status.textContent="Searching Indian addresses…";
 try{
  const url="https://photon.komoot.io/api/?limit=8&lang=en&q="+encodeURIComponent(query);
  const res=await fetch(url,{headers:{Accept:"application/json"},signal:searchController.signal});
  if(!res.ok)throw new Error("Location search is temporarily unavailable.");
  const data=await res.json();
  const features=(Array.isArray(data.features)?data.features:[]).filter(f=>f&&f.geometry&&Array.isArray(f.geometry.coordinates)&&Number.isFinite(Number(f.geometry.coordinates[0]))&&Number.isFinite(Number(f.geometry.coordinates[1])));
  const india=features.filter(f=>String(f.properties&&f.properties.countrycode||"").toLowerCase()==="in");
   showSuggestions(india);
   if(status)status.textContent=india.length?"Choose the correct Indian locality from the suggestions.":"No matching Indian address found. Try adding the city or PIN code.";
 }catch(e){
  if(e.name==="AbortError")return;
  if(status)status.textContent="Address suggestions are unavailable. You can still use GPS or the map pin.";
  if(box)box.hidden=true;
 }
}
async function reverseGeocode(lat,lng){
 const url="https://photon.komoot.io/reverse?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lng)+"&lang=en";
 const res=await fetch(url,{headers:{Accept:"application/json"}});
 if(!res.ok)throw new Error("Address lookup unavailable");
 const data=await res.json(),p=data&&data.features&&data.features[0]&&data.features[0].properties||{};
 return {
  address:[p.name,p.street,p.locality,p.district,p.city,p.state,p.postcode,p.country].filter((v,i,a)=>v&&a.indexOf(v)===i).join(", "),
  pincode:p.postcode||""
 };
}
async function useGps(){
 if(!navigator.geolocation){message("GPS is not supported in this browser. Search for the address or use the map pin.","error");return;}
 message("Finding the property location…","info");
 navigator.geolocation.getCurrentPosition(async pos=>{
  const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude);
  try{
   const found=await reverseGeocode(lat,lng);
   if(!found.address)throw new Error("Address could not be identified");
   setLocation(found.address,lat,lng,found.pincode);
   message("Your current location has been added. Please confirm it is the property address.","success");
  }catch(e){
   setLocation(state.address,lat,lng,state.pincode);
   message("GPS coordinates found, but the address could not be identified. Enter the locality in the address field.","error");
  }
 },err=>{
  const reason=err.code===1?"Location permission was denied. You can search or place the pin manually.":"Could not detect GPS location. Please try again or search the address.";
  message(reason,"error");
 },{enableHighAccuracy:true,timeout:15000,maximumAge:30000});
}
function moveMapToStudio(){
 const panel=$("#gdrOwnerMapPicker"),host=$("#gdrStudioMapHost");
 if(!panel||!host)return false;
 if(!state.mapParent){state.mapParent=panel.parentNode;state.mapNext=panel.nextSibling;}
 const oldInput=$("#propertyLocation");if(oldInput)oldInput.value=state.address;
 host.appendChild(panel);panel.hidden=false;
 return true;
}
function restoreMapPanel(){
 const panel=$("#gdrOwnerMapPicker");
 if(!panel||!state.mapParent)return;
 panel.hidden=true;
 try{state.mapParent.insertBefore(panel,state.mapNext&&state.mapNext.parentNode===state.mapParent?state.mapNext:null);}catch(e){}
}
async function openMap(){
 const host=$("#gdrStudioMapHost");
 if(!host)return;
 if(!moveMapToStudio()){
  message("The map picker is unavailable. Please use address search or GPS.","error");
  return;
 }
 if(!window.GDRMapExperience||typeof window.GDRMapExperience.openOwnerMapPicker!=="function"){
  message("The free OpenStreetMap picker is still loading. Please try again.","error");
  restoreMapPanel();
  return;
 }
 try{
  await window.GDRMapExperience.openOwnerMapPicker();
  message("Tap the property entrance or drag the pin, then confirm its location.","info");
 }catch(e){
  message(e.message||"Could not open the map picker.","error");
  restoreMapPanel();
 }
}
function wrapMapCallback(){
 const original=window.__gdrSetPropertyLocation;
 if(typeof original!=="function"||original.__gdrStudioWrapped)return;
 const wrapped=function(address,lat,lng){
  const ok=original(address,lat,lng);
  if(ok&&!studio().hidden){
   setLocation(address,Number(lat),Number(lng),state.pincode);
   message("Map pin confirmed. Nearby place discovery is refreshing.","success");
   setTimeout(restoreMapPanel,120);
  }
  return ok;
 };
 wrapped.__gdrStudioWrapped=true;
 window.__gdrSetPropertyLocation=wrapped;
}
const osmCategory=tags=>{
 if(tags.railway==="station")return "Railway station";
 if(tags.amenity==="bus_station")return "Bus station";
 if(tags.public_transport==="station")return "Transit station";
 if(tags.highway==="bus_stop"||tags.public_transport==="platform")return "Bus stop";
 if(tags.amenity==="hospital"||tags.healthcare==="hospital")return "Hospital";
 if(tags.amenity==="school")return "School";
 if(tags.amenity==="college")return "College";
 if(tags.amenity==="university")return "University";
 if(tags.amenity==="marketplace")return "Market";
 if(tags.shop==="supermarket"||tags.shop==="mall")return "Market / shopping";
 if(tags.leisure==="park")return "Park";
 if(tags.leisure==="stadium")return "Stadium";
 return "Public place";
};
function renderNearby(){
 const box=$("#gdrStudioNearbyList"),status=$("#gdrStudioNearbyStatus");
 if(!box||!status)return;
 box.innerHTML="";
 if(state.lat===null||state.lng===null){
  status.textContent="Confirm the property location to discover nearby public places.";
  return;
 }
 if(!state.nearbyPlaces.length){
  status.textContent="Checking OpenStreetMap for named public facilities within 5 km…";
  return;
 }
 state.nearbyPlaces.forEach(place=>{
  const row=document.createElement("div");row.className="gdr-studio-nearby-row";
  const left=document.createElement("span"),name=document.createElement("strong"),category=document.createElement("small");
  name.textContent=place.name;category.textContent=place.category;
  left.append(name,category);
  const dist=document.createElement("b");dist.textContent=distanceLabel(place.distance_m);
  row.append(left,dist);box.appendChild(row);
 });
 status.textContent=state.nearbyPlaces.length+" named nearby places found · © OpenStreetMap contributors.";
}
async function loadNearbyPlaces(){
 const run=++nearbyRun;
 if(nearbyController){nearbyController.abort();nearbyController=null;}
 state.nearbyPlaces=[];
 const status=$("#gdrStudioNearbyStatus");
 if(status)status.textContent="Searching OpenStreetMap for nearby public facilities…";
 renderNearby();saveDraft();
 if(state.lat===null||state.lng===null)return;
 const lat=Number(state.lat),lng=Number(state.lng);
 if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
 const radius=5000;
 // Cache nearby results for 24 hours per rounded location to avoid repeat public API calls.
 const cacheKey="gdr_osm_nearby_v1:"+lat.toFixed(4)+":"+lng.toFixed(4);
 try{
  const cached=JSON.parse(localStorage.getItem(cacheKey)||"null");
  if(cached&&Number.isFinite(cached.savedAt)&&Date.now()-cached.savedAt<86400000&&Array.isArray(cached.places)){
   state.nearbyPlaces=cached.places.filter(p=>Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude))).map(p=>({...p,distance_m:Math.round(distanceMeters(lat,lng,Number(p.latitude),Number(p.longitude)))})).sort((a,b)=>a.distance_m-b.distance_m).slice(0,30);
   renderNearby();saveDraft();
   if(!state.nearbyPlaces.length&&status)status.textContent="No named public facilities were found within 5 km. Source: © OpenStreetMap contributors.";
   return;
  }
 }catch(e){console.warn("OpenStreetMap nearby cache could not be read",e);}
 const query=`[out:json][timeout:20];
(
 nwr(around:${radius},${lat},${lng})[railway=station];
 nwr(around:${radius},${lat},${lng})[public_transport=station];
 nwr(around:${radius},${lat},${lng})[amenity=bus_station];
 nwr(around:${radius},${lat},${lng})[highway=bus_stop];
 nwr(around:${radius},${lat},${lng})[amenity=hospital];
 nwr(around:${radius},${lat},${lng})[healthcare=hospital];
 nwr(around:${radius},${lat},${lng})[amenity=school];
 nwr(around:${radius},${lat},${lng})[amenity=college];
 nwr(around:${radius},${lat},${lng})[amenity=university];
 nwr(around:${radius},${lat},${lng})[amenity=marketplace];
 nwr(around:${radius},${lat},${lng})[shop=supermarket];
 nwr(around:${radius},${lat},${lng})[shop=mall];
 nwr(around:${radius},${lat},${lng})[leisure=park];
 nwr(around:${radius},${lat},${lng})[leisure=stadium];
);
out center tags;`;
 const controller=new AbortController();nearbyController=controller;
 const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch("https://overpass-api.de/api/interpreter",{
   method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8","Accept":"application/json"},
   body:"data="+encodeURIComponent(query),
   signal:controller.signal
  });
  if(!response.ok)throw new Error("OpenStreetMap nearby service returned HTTP "+response.status);
  const data=await response.json();
  if(run!==nearbyRun)return;
  const unique=new Map();
  (Array.isArray(data.elements)?data.elements:[]).forEach(element=>{
   const tags=element.tags||{};
   const name=String(tags.name||tags["name:en"]||"").trim();
   const point=element.type==="node"?element:{center:element.center};
   const placeLat=Number(point.lat??point.center?.lat);
   const placeLng=Number(point.lon??point.center?.lon);
   if(!name||!Number.isFinite(placeLat)||!Number.isFinite(placeLng))return;
   const distance=Math.round(distanceMeters(lat,lng,placeLat,placeLng));
   if(distance>radius)return;
   const key=element.type+":"+element.id;
   unique.set(key,{name,category:osmCategory(tags),distance_m:distance,latitude:placeLat,longitude:placeLng,osm_type:element.type,osm_id:element.id});
  });
  state.nearbyPlaces=Array.from(unique.values()).sort((a,b)=>a.distance_m-b.distance_m).slice(0,30);
  try{localStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),places:state.nearbyPlaces}));}catch(e){}
  renderNearby();saveDraft();
  if(!state.nearbyPlaces.length&&status)status.textContent="No named public facilities were found within 5 km. Source: © OpenStreetMap contributors.";
 }catch(e){
  if(run!==nearbyRun)return;
  console.warn("OpenStreetMap nearby discovery unavailable",e);
  if(status)status.textContent="Nearby facilities are temporarily unavailable from OpenStreetMap. Your confirmed location is saved; you can continue without this optional information.";
 }
 finally{
  clearTimeout(timeout);
  if(run===nearbyRun)nearbyController=null;
 }
}
function revokePreviews(){
 state.files.forEach(f=>{if(f.previewUrl)URL.revokeObjectURL(f.previewUrl);});
}
function renderPhotos(){
 const wrap=$("#gdrStudioPhotoPreview");if(!wrap)return;
 wrap.innerHTML="";
 const items=state.files.length?state.files.map((f,i)=>({url:f.previewUrl,name:f.name,index:i,cover:i===state.coverIndex})):
  state.uploadedPhotos.map((f,i)=>({url:f.url,name:"Property photo "+(i+1),index:i,cover:i===0}));
 if(!items.length){wrap.hidden=true;return;}
 wrap.hidden=false;
 items.forEach(item=>{
  const card=document.createElement("div");card.className="gdr-studio-photo-card";
  const img=document.createElement("img");img.src=item.url;img.alt=item.name;
  const meta=document.createElement("div"),name=document.createElement("span");name.textContent=item.name;
  const btn=document.createElement("button");btn.type="button";btn.textContent=item.cover?"✓ Cover photo":"Set as cover";
  btn.disabled=item.cover;
  btn.addEventListener("click",()=>{
   if(state.files.length)state.coverIndex=item.index;
   else if(item.index!==0){const moved=state.uploadedPhotos.splice(item.index,1)[0];state.uploadedPhotos.unshift(moved);state.uploadedPaths.unshift(state.uploadedPaths.splice(item.index,1)[0]);}
   saveDraft();renderPhotos();
  });
  const remove=document.createElement("button");remove.type="button";remove.textContent="Remove photo";remove.className="gdr-studio-photo-remove";
  remove.addEventListener("click",async()=>{
   if(state.files.length){const removed=state.files.splice(item.index,1)[0];if(removed&&removed.previewUrl)URL.revokeObjectURL(removed.previewUrl);state.coverIndex=Math.max(0,Math.min(state.coverIndex,state.files.length-1));}
   else{
    const removed=state.uploadedPhotos.splice(item.index,1)[0];const path=state.uploadedPaths.splice(item.index,1)[0];
    if(path){try{await client().storage.from("property-images").remove([path]);}catch(e){console.warn("Could not remove property photo",e);}}
   }
   saveDraft();renderPhotos();
  });
  meta.append(name,btn,remove);card.append(img,meta);wrap.appendChild(card);
 });
}
async function removeUploadedFiles(){
 const c=client();if(!c||!state.uploadedPaths.length)return;
 try{await c.storage.from("property-images").remove(state.uploadedPaths);}catch(e){console.warn("Could not clean up replaced studio photos",e);}
 state.uploadedPaths=[];state.uploadedPhotos=[];
}
async function acceptFiles(list){
 const incoming=Array.from(list||[]);
 if(!incoming.length)return;
 const current=state.files.length+state.uploadedPhotos.length;
 if(current+incoming.length>8){message("Choose up to 8 property photos.","error");return;}
 for(const f of incoming){
  if(!allowedTypes.includes(f.type)){message("Use JPG, PNG or WEBP photos only.","error");return;}
  if(f.size>5*1024*1024){message("Each photo must be 5 MB or smaller.","error");return;}
 }
 if(state.uploadedPhotos.length){await removeUploadedFiles();}
 incoming.forEach(f=>{f.previewUrl=URL.createObjectURL(f);state.files.push(f);});
 state.coverIndex=0;renderPhotos();saveDraft();message("Photos added. Choose the cover photo before publishing.","success");
}
function uploadPhotos(){
 const c=client();
 if(state.uploadedPhotos.length)return Promise.resolve(state.uploadedPhotos);
 if(!state.files.length)return Promise.resolve([]);
 return (async()=>{
  const ordered=state.files.slice();
  if(state.coverIndex>0)ordered.unshift(ordered.splice(state.coverIndex,1)[0]);
  const uploaded=[],paths=[];
  try{
   for(const file of ordered){
    const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";
    const path=state.user.id+"/"+uuid()+"."+ext;
    const result=await c.storage.from("property-images").upload(path,file,{cacheControl:"3600",contentType:file.type,upsert:false});
    if(result.error)throw result.error;
    const publicResult=c.storage.from("property-images").getPublicUrl(result.data.path);
    const url=publicResult&&publicResult.data&&publicResult.data.publicUrl;
    if(!url)throw new Error("Could not create the uploaded photo URL.");
    uploaded.push({url:url,path:path});paths.push(path);
    state.uploadedPhotos=uploaded.slice();state.uploadedPaths=paths.slice();saveDraft();
   }
   state.files=[];state.coverIndex=0;renderPhotos();return uploaded;
  }catch(error){
   if(paths.length){try{await c.storage.from("property-images").remove(paths);}catch(e){}}
   state.uploadedPhotos=[];state.uploadedPaths=[];saveDraft();throw error;
  }
 })();
}
function titleForListing(){
 const type=typeLabels[state.propertyType]||"Rental property";
 const config=state.configuration&&state.configuration!=="Other"?state.configuration+" ":"";
 const place=state.address.split(",").map(v=>v.trim()).filter(Boolean)[0]||"your area";
 return (config+type+" in "+place).slice(0,120);
}
function validateStep(step){
 if(step===0){
  if(!state.propertyType){message("Please choose your property type.","error");return false;}
  if(["apartment","independent_house","villa"].includes(state.propertyType)&&!state.configuration){message("Please select the BHK configuration.","error");return false;}
  if(state.propertyType==="pg"||state.propertyType==="hostel"){
   const room=$("#gdrStudioRoomType"),gender=$("#gdrStudioGender"),total=$("#gdrStudioTotalBeds"),available=$("#gdrStudioAvailableBeds");
   state.roomType=room&&room.value||"";state.gender=gender&&gender.value||"";
   state.totalBeds=total&&total.value||"";state.availableBeds=available&&available.value||"";
   state.foodIncluded=$("#gdrStudioFoodIncluded")?.value||"";
   if(!state.roomType||!state.gender||!state.totalBeds||!state.availableBeds||Number(state.availableBeds)>Number(state.totalBeds)){
    message("Please complete the room type, preference and bed details.","error");return false;
   }
  }
 }
 if(step===1){
  state.rent=$("#gdrStudioRent")?.value||state.rent;
  state.deposit=$("#gdrStudioDeposit")?.value||state.deposit;
 state.furnishing=$("#gdrStudioFurnishing")?.value||state.furnishing;
  if(!Number.isFinite(Number(state.rent))||Number(state.rent)<1||Number(state.rent)>10000000){message("Enter a valid monthly rent.","error");return false;}
  if(state.deposit!==""&&(!Number.isFinite(Number(state.deposit))||Number(state.deposit)<0||Number(state.deposit)>10000000)){message("Enter a valid security deposit or leave it blank.","error");return false;}
 }
 if(step===2){
  state.address=$("#gdrStudioLocation")?.value.trim()||state.address;
  state.pincode=$("#gdrStudioPincode")?.value.trim()||state.pincode;
  if(!state.address){message("Please search for the property address or enter its locality and city.","error");return false;}
  if(state.pincode&&!/^\d{6}$/.test(state.pincode)){message("PIN code must contain 6 digits.","error");return false;}
 }
 return true;
}
function renderPreview(){
 const title=titleForListing();
 const rent=$("#gdrStudioRent")?.value||state.rent;
 const deposit=$("#gdrStudioDeposit")?.value||state.deposit;
 const address=$("#gdrStudioLocation")?.value||state.address;
 const photos=state.files.length?state.files.map(f=>f.previewUrl):state.uploadedPhotos.map(p=>p.url);
 const cover=photos[state.coverIndex]||photos[0]||"/assets/gdr-property-placeholder.svg";
 const box=$("#gdrStudioPreview");if(!box)return;
 const config=state.propertyType==="other"?"Other":state.configuration;
 const details=[
  ["Property",typeLabels[state.propertyType]||"—"],
  ["Configuration",config||"—"],
  ["Monthly rent",formatINR(rent)],
  ["Security deposit",deposit?formatINR(deposit):"Not specified"],
  ["Furnishing",state.furnishing||"Not specified"],
  ["Location",address||"—"],
  ["Availability","Pending verification after submission"]
 ];
  const nearbyHtml=state.nearbyPlaces.length
   ?'<div class="gdr-studio-preview-nearby-list">'+state.nearbyPlaces.slice(0,8).map(place=>'<div><span><b>'+escapeHtml(place.name||"Nearby place")+'</b><small>'+escapeHtml(place.category||"Public place")+'</small></span><strong>'+escapeHtml(distanceLabel(place.distance_m))+'</strong></div>').join("")+'</div>'
   :'<p>Nearby facilities are sourced from OpenStreetMap when available.</p>';
  box.innerHTML=
   '<div class="gdr-studio-preview-card"><img src="'+escapeHtml(cover)+'" alt="Property cover photo"><div class="gdr-studio-preview-copy"><span class="gdr-studio-preview-kicker">RENTER VIEW PREVIEW</span><h3>'+escapeHtml(title)+'</h3><strong class="gdr-studio-preview-rent">'+escapeHtml(formatINR(rent))+' <small>/ month</small></strong><div class="gdr-studio-preview-meta">'+details.map(d=>'<div><small>'+escapeHtml(d[0])+'</small><b>'+escapeHtml(d[1])+'</b></div>').join("")+'</div><p>'+escapeHtml(state.description||"No additional description.")+'</p></div></div>'+
   (photos.length>1?'<div class="gdr-studio-preview-strip">'+photos.map(p=>'<img src="'+escapeHtml(p)+'" alt="Property photo preview">').join("")+'</div>':"")+
   '<div class="gdr-studio-preview-nearby"><strong>Nearby places</strong>'+nearbyHtml+'</div>';
}
function updateStep(){
 const root=studio();if(!root)return;
 $$("[data-gdr-studio-panel]",root).forEach(p=>{p.hidden=Number(p.dataset.gdrStudioPanel)!==state.step;});
 $$("[data-gdr-studio-step-indicator]",root).forEach(el=>{
  const n=Number(el.dataset.gdrStudioStepIndicator);
  el.classList.toggle("is-current",n===state.step);el.classList.toggle("is-complete",n<state.step);
 });
 const back=$("#gdrStudioBack"),next=$("#gdrStudioNext"),publish=$("#gdrStudioPublish");
 if(back)back.hidden=state.step===0;
 if(next)next.hidden=state.step===4;
 if(publish)publish.hidden=state.step!==4;
 if(state.step===4)renderPreview();
 const title=$("#gdrStudioStepTitle");
 if(title)title.textContent=["Property type","Rent details","Property location","Property photos","Review your listing"][state.step];
 const progress=$("#gdrStudioProgressFill");if(progress)progress.style.width=((state.step+1)/5*100)+"%";
}
function goToStep(n){
 if(n>state.step&&!validateStep(state.step))return;
 state.step=Math.min(4,Math.max(0,n));updateStep();saveDraft();
 const main=$("#gdrStudioMain");if(main)main.scrollIntoView({behavior:"smooth",block:"start"});
 message("");
}
async function getOwner(){
 const c=client();if(!c)throw new Error("Account service is not ready. Refresh the page and sign in again.");
 const auth=await c.auth.getUser();
 if(auth.error||!auth.data||!auth.data.user)throw new Error("Please sign in to your Owner account.");
 const user=auth.data.user;
 const profile=await c.from("owners").select("id,name").eq("user_id",user.id).maybeSingle();
 if(profile.error||!profile.data)throw new Error("This account does not have an Owner profile. Please sign in using your Owner account.");
 return {user:user,owner:profile.data};
}
async function open(voice){
 if(state.publishing)return;
 try{
  await readyPromise;
  const dash=$("#ownerDashboard");
  if(!dash||!dash.classList.contains("active")||!document.body.classList.contains("gd-owner-mode")){
   throw new Error("Open the Owner Dashboard to start a property listing.");
  }
  const account=await getOwner();state.user=account.user;state.owner=account.owner;state.published=false;
  state.submissionId=state.submissionId||uuid();
  restoreDraft();
  const root=studio();if(!root)throw new Error("Property Studio could not be loaded. Refresh and try again.");
  root.hidden=false;document.body.classList.add("gdr-property-studio-open");
  const dashSection=$("#dashboardSection");if(dashSection){dashSection.style.display="none";dashSection.setAttribute("aria-hidden","true");}
  updateStep();window.scrollTo({top:0,behavior:"instant"});
  wrapMapCallback();
  if(voice)startVoice();
 }catch(e){message(e.message||"Could not open Property Studio.","error");const m=$("#backendMessage");if(m){m.textContent=e.message||"Could not open Property Studio.";m.className="backend-message error";}}
}
function close(){
 if(state.publishing)return;
 if(state.published){window.location.reload();return;}
 stopVoice();restoreMapPanel();
 const root=studio();if(root)root.hidden=true;
 document.body.classList.remove("gdr-property-studio-open");
 const dash=$("#dashboardSection");if(dash){dash.style.display="block";dash.setAttribute("aria-hidden","false");}
 window.scrollTo({top:0,behavior:"instant"});
 saveDraft();
}
function selectedType(type){
 state.propertyType=type;
 if(type==="other")state.configuration="Other";
 else if(type==="pg"||type==="hostel")state.configuration="";
 else if(state.configuration==="Other")state.configuration="";
 updateTypeCards();updateConfigurationCards();updateConditionalFields();saveDraft();
}
function setConfiguration(value){state.configuration=value;updateConfigurationCards();saveDraft();}
function setCover(i){state.coverIndex=i;renderPhotos();saveDraft();}
// Please review and correct every field before continuing; publishing remains a manual owner action.
function detectVoiceLanguage(text){
 const value=String(text||"");
 if(/[ऀ-ॿ]/.test(value))return "hi";
 const lower=value.toLowerCase();
 if(/\b(mera|meri|mujhe|chahiye|hai|mein|me|ka|ki|ke|kiraya|ghar|makaan|bhk|rent|flat|furnished|semi furnished)\b/.test(lower))return "hi";
 return "en";
}
function voiceText(hi,en){return state.voice.language==="en"?en:hi;}
function setVoiceState(label,recording){
 const stateEl=$("#gdrStudioVoiceState"),start=$("#gdrStudioVoiceStart");
 if(stateEl)stateEl.textContent=label;
 if(start){start.classList.toggle("is-recording",!!recording);start.textContent=recording?"● Listening…":"Start speaking";}
}
function setVoiceReply(text){
 const reply=$("#gdrStudioVoiceReply");if(reply)reply.textContent=text;
 state.voice.lastReply=text;
}
function speakVoice(text,after){
 state.voice.lastReply=text;
 const reply=$("#gdrStudioVoiceReply");if(reply)reply.textContent=text;
 if(state.voice.muted||!window.speechSynthesis||!window.SpeechSynthesisUtterance){if(typeof after==="function")after();return;}
 try{
  window.speechSynthesis.cancel();state.voice.speaking=true;
  if(state.recognition){const oldRecognition=state.recognition;state.recognition=null;state.recording=false;state.voice.session++;try{oldRecognition.stop();}catch(e){}}
  const utterance=new SpeechSynthesisUtterance(text),language=state.voice.language==="en"?"en-IN":"hi-IN";
  utterance.lang=language;utterance.rate=.96;utterance.pitch=1;
  const voices=window.speechSynthesis.getVoices?window.speechSynthesis.getVoices():[];
  const voice=voices.find(v=>String(v.lang||"").toLowerCase()===language.toLowerCase())||voices.find(v=>String(v.lang||"").toLowerCase().startsWith(state.voice.language==="en"?"en":"hi"));
  if(voice)utterance.voice=voice;
  utterance.onend=()=>{state.voice.speaking=false;if(typeof after==="function")after();else scheduleVoiceRestart(250);};
  utterance.onerror=()=>{state.voice.speaking=false;if(typeof after==="function")after();else scheduleVoiceRestart(250);};
  window.speechSynthesis.speak(utterance);
 }catch(error){state.voice.speaking=false;if(typeof after==="function")after();else scheduleVoiceRestart(250);}
}
function amountFromText(text){
 const s=String(text||"").toLowerCase().replace(/,/g," ");
 let m=s.match(/\b(\d+(?:\.\d+)?)\s*(k|thousand|हज़ार|हजार)\b/);
 if(m)return Math.round(Number(m[1])*1000);
 m=s.match(/\b(\d{3,8})\b/);if(m)return Number(m[1]);
 const words={one:1,ek:1,two:2,do:2,three:3,teen:3,four:4,char:4,five:5,paanch:5,ten:10,das:10,fifteen:15,pandrah:15,twenty:20,bees:20,thirty:30,tees:30,fifty:50,pachaas:50};
 const wordMatch=s.match(/\b(one|ek|two|do|three|teen|four|char|five|paanch|ten|das|fifteen|pandrah|twenty|bees|thirty|tees|fifty|pachaas)\s+(?:thousand|hazaar|hazar)\b/);
 if(wordMatch&&words[wordMatch[1]])return words[wordMatch[1]]*1000;
 return null;
}
function extractVoiceDetails(text){
 const raw=String(text||"").trim(),t=raw.toLowerCase(),out={};
 if(/\b(pg|paying guest)\b/.test(t))out.propertyType="pg";
 else if(/\b(hostel)\b/.test(t))out.propertyType="hostel";
 else if(/\b(villa)\b/.test(t))out.propertyType="villa";
 else if(/\b(independent house|standalone house|separate house)\b/.test(t))out.propertyType="independent_house";
 else if(/\b(flat|apartment)\b/.test(t)||/फ्लैट|अपार्टमेंट/.test(t))out.propertyType="apartment";
 else if(/\b(other property|other type)\b/.test(t))out.propertyType="other";
 let config=t.match(/\b(5\+\s*bhk|[1-4]\s*bhk|1\s*rk)\b/i);
 if(config)out.configuration=config[1].replace(/\s+/g," ").toUpperCase();
 else{
  const wordConfig=t.match(/\b(ek|do|teen|char|paanch|panch|one|two|three|four|five)\s*(?:bhk|bedroom)\b/);
  const map={ek:"1",one:"1",do:"2",two:"2",teen:"3",three:"3",char:"4",four:"4",paanch:"5",panch:"5",five:"5"};
  if(wordConfig)out.configuration=map[wordConfig[1]]+" BHK";
  else if(/\bone\s*rk\b|\bek\s*rk\b|1\s*room\s*kitchen|एक\s*आरके/.test(t))out.configuration="1 RK";
  else{const hindiConfig=t.match(/(एक|दो|तीन|चार|पाँच|पांच)\s*(?:बीएचके|bhk|bedroom)/);const hindiMap={"एक":"1","दो":"2","तीन":"3","चार":"4","पाँच":"5","पांच":"5"};if(hindiConfig)out.configuration=hindiMap[hindiConfig[1]]+" BHK";}
 }
 if(out.configuration&&!out.propertyType)out.propertyType="apartment";
 const furnish=t.match(/\b(semi[\s-]?furnished|fully furnished|furnished|unfurnished)\b/);
 if(furnish)out.furnishing=/semi/.test(furnish[1])?"Semi-Furnished":/unfurnished/.test(furnish[1])?"Unfurnished":"Furnished";
 const depIdx=t.search(/security deposit|deposit/),rentIdx=t.search(/rent|kiraya|किराया|monthly/);
 if(depIdx>=0){const n=amountFromText(raw.slice(depIdx,depIdx+90));if(n!==null)out.deposit=String(n);}
 if(rentIdx>=0){const n=amountFromText(raw.slice(rentIdx,Math.min(raw.length,rentIdx+100)));if(n!==null)out.rent=String(n);}
 else{
  const currency=raw.match(/(?:₹|rs\.?|rupees?|rupee|rupaye)\s*([\d,]+(?:\s*(?:k|thousand))?)/i);
  if(currency){const n=amountFromText(currency[0]);if(n!==null)out.rent=String(n);}
  else{const trailing=raw.match(/([\d,]+(?:\s*(?:k|thousand))?)\s*(?:rupees?|rupee|rupaye|रुपये|रुपए)/i);if(trailing){const n=amountFromText(trailing[1]);if(n!==null)out.rent=String(n);}}
 }
 const pin=raw.match(/\b([1-9][0-9]{5})\b/);if(pin)out.pincode=pin[1];
 const locationPatterns=[
  /(?:location|address|area)\s*(?:is|:)?\s+(.+?)(?=\s+(?:rent|kiraya|deposit|security|furnished|unfurnished|semi[\s-]?furnished|pin|pincode)\b|[.!?]|$)/i,
  /(?:in|at)\s+([a-z0-9][a-z0-9 ,'-]{2,75}?)(?=\s+(?:rent|kiraya|deposit|security|furnished|unfurnished|semi[\s-]?furnished|monthly|and rent)\b|[.!?]|$)/i,
  /([a-z][a-z0-9 ,'-]{2,65}?)\s+(?:mein|me)\b/i,
  /(?:में|मे)\s*([ऀ-ॿa-zA-Z0-9 ,'-]{3,70}?)(?=\s*(?:है|और|किराया|₹|$))/i
 ];
 for(const pattern of locationPatterns){const m=raw.match(pattern);if(m){const address=m[1].trim().replace(/\s+/g," ").replace(/^(mera|meri|my|property|flat|house|home)\s+/i,"").replace(/\s+(hai|is)$/i,"");if(address.length>=3&&!/^(a property|property|flat|apartment)$/i.test(address))out.address=address;break;}}
 const room=t.match(/\b(single|double|triple|shared)\s*(?:sharing|room)?\b/);if(room)out.roomType=room[1][0].toUpperCase()+room[1].slice(1);
 const gender=t.match(/\b(male|female|anyone|both)\b/);if(gender)out.gender=gender[1]==="both"||gender[1]==="anyone"?"Any":gender[1][0].toUpperCase()+gender[1].slice(1);
 const total=t.match(/\btotal\s*beds?\s*(?:is|are|of)?\s*(\d{1,3})\b/);if(total)out.totalBeds=total[1];
 const available=t.match(/\bavailable\s*beds?\s*(?:is|are|of)?\s*(\d{1,3})\b/);if(available)out.availableBeds=available[1];
 if(/\b(meals included|food included)\b/.test(t))out.foodIncluded="yes";else if(/\b(no meals|food not included)\b/.test(t))out.foodIncluded="no";
 return out;
}
function voiceFieldLabel(key){return ({propertyType:"Property type",configuration:"Configuration",rent:"Monthly rent",deposit:"Security deposit",furnishing:"Furnishing",address:"Location",pincode:"PIN code",roomType:"Room type",gender:"Guest preference",totalBeds:"Total beds",availableBeds:"Available beds",foodIncluded:"Meals"})[key]||key;}
function voiceFieldValue(key,value){if(key==="propertyType")return typeLabels[value]||value;if(key==="rent"||key==="deposit")return formatINR(value);if(key==="foodIncluded")return value==="yes"?"Meals included":"No meals";return String(value);}
function renderVoicePending(){
 const box=$("#gdrStudioVoicePending"),actions=$("#gdrStudioVoiceConfirmActions");if(!box||!actions)return;
 const entries=Object.entries(state.voice.pending||{});if(!entries.length){box.hidden=true;actions.hidden=true;return;}
 box.hidden=false;actions.hidden=false;box.replaceChildren();
 const heading=document.createElement("strong");heading.textContent=voiceText("मैंने ये जानकारी समझी है:","I understood these details:");box.appendChild(heading);
 entries.forEach(([key,value])=>{const row=document.createElement("div"),label=document.createElement("span"),val=document.createElement("b");label.textContent=voiceFieldLabel(key);val.textContent=voiceFieldValue(key,value);row.append(label,val);box.appendChild(row);});
}
function currentVoiceValue(key){return ({propertyType:state.propertyType,configuration:state.configuration,rent:state.rent,deposit:state.deposit,furnishing:state.furnishing,address:state.address,pincode:state.pincode,roomType:state.roomType,gender:state.gender,totalBeds:state.totalBeds,availableBeds:state.availableBeds,foodIncluded:state.foodIncluded})[key]||"";}
function applyVoicePending(){
 const pending={...state.voice.pending};
 Object.entries(pending).forEach(([key,value])=>{
  if(key==="propertyType")selectedType(value);
  else if(key==="configuration")setConfiguration(value);
  else if(key==="address"){state.address=value;state.lat=null;state.lng=null;const el=$("#gdrStudioLocation");if(el)el.value=value;searchAddress(value);}
  else if(key==="pincode"){state.pincode=value;const el=$("#gdrStudioPincode");if(el)el.value=value;}
  else if(["rent","deposit","furnishing","roomType","gender","totalBeds","availableBeds","foodIncluded"].includes(key)){state[key]=value;const ids={rent:"gdrStudioRent",deposit:"gdrStudioDeposit",furnishing:"gdrStudioFurnishing",roomType:"gdrStudioRoomType",gender:"gdrStudioGender",totalBeds:"gdrStudioTotalBeds",availableBeds:"gdrStudioAvailableBeds",foodIncluded:"gdrStudioFoodIncluded"};const el=$("#"+ids[key]);if(el)el.value=value;}
 });
 syncFormFromState();saveDraft();state.voice.pending={};state.voice.awaitingConfirmation=false;renderVoicePending();
}
function nextVoiceQuestion(){
 const home=["apartment","independent_house","villa","other"].includes(state.propertyType);let field="",question="";
 if(!state.propertyType){field="propertyType";question=voiceText("आप किस तरह की property list करना चाहते हैं—flat, independent house, villa, PG या hostel?","What kind of property would you like to list: flat, independent house, villa, PG or hostel?");}
 else if(home&&!state.configuration&&state.propertyType!=="other"){field="configuration";question=voiceText("कितना configuration है—1 RK, 1 BHK, 2 BHK या कुछ और?","What is the configuration: 1 RK, 1 BHK, 2 BHK or something else?");}
 else if(!state.address){field="address";question=voiceText("Property किस area और city में है?","Which area and city is the property in?");}
 else if(!state.rent){field="rent";question=voiceText("Monthly rent कितना रखना चाहेंगे?","What monthly rent would you like to set?");}
 else if(!state.deposit&&!state.voice.skippedDeposit){field="deposit";question=voiceText("Security deposit कितना है? अगर अभी तय नहीं है तो skip बोल सकते हैं।","What is the security deposit? Say skip if you have not decided yet.");}
 else if(!state.furnishing){field="furnishing";question=voiceText("Property furnished, semi-furnished या unfurnished है?","Is the property furnished, semi-furnished or unfurnished?");}
 else{field="complete";question=voiceText("बहुत बढ़िया! ज़रूरी details पूरी हो गई हैं। अब photos और बाकी details जोड़कर preview में सब check करें।","Great! The key details are complete. Add photos and the remaining details, then review the preview.");}
 state.voice.lastField=field;state.voice.lastQuestion=question;speakVoice(question);
}
function isVoiceYes(text){return /^(haan|han|ha|yes|yeah|correct|right|bilkul|sahi|correct hai|that's right|ठीक|हाँ|हां|जी|सही|बिल्कुल)(?:[\s,.!?]|$)/i.test(String(text||"").trim());}
function isVoiceNo(text){return /^(nahi|nahin|no|wrong|galat|नहीं|नही|गलत)(?:[\s,.!?]|$)/i.test(String(text||"").trim());}
function processVoiceTurn(text){
 const raw=String(text||"").trim();if(!raw)return;state.voice.finalText=(state.voice.finalText?state.voice.finalText+" ":"")+raw;state.voice.interimText="";updateVoiceTranscript();state.voice.language=detectVoiceLanguage(raw);const lower=raw.toLowerCase();
 if(/\b(stop listening|stop microphone|band karo|mic band)\b|रोक दो|बंद करो/.test(lower)){stopVoice();setVoiceReply(voiceText("ठीक है, microphone रोक दिया है। दोबारा शुरू करने के लिए Start speaking दबाएँ।","Okay, I stopped listening. Press Start speaking when you want to continue."));return;}
 if(/\b(repeat|say again|dobara bolo|phir se bolo|फिर से बोलो|दोहराओ)\b/.test(lower)){speakVoice(state.voice.lastQuestion||state.voice.lastReply);return;}
 if(/\b(show details|details dikhao|meri details|सब दिखाओ|जानकारी दिखाओ)\b/.test(lower)){const keys=["propertyType","configuration","address","rent","deposit","furnishing"];const summary=keys.map(k=>currentVoiceValue(k)?voiceFieldLabel(k)+": "+voiceFieldValue(k,currentVoiceValue(k)):"").filter(Boolean).join(". ");speakVoice(summary||voiceText("अभी कोई detail confirm नहीं हुई है।","No details have been confirmed yet."));return;}
 if(/\b(submit|publish|list my property|property submit|publish my property)\b/.test(lower)||/सबमिट|पब्लिश/.test(lower)){speakVoice(voiceText("मैं आपकी property अपने आप publish नहीं करूँगा। Preview में details check करके Publish My Property दबाएँ।","I won't publish automatically. Review the preview and press Publish My Property yourself."));return;}
 if(state.voice.awaitingConfirmation&&isVoiceYes(raw)){applyVoicePending();speakVoice(voiceText("ठीक है, ये details form में confirm कर दी हैं।","Confirmed. I have added these details to the form."),nextVoiceQuestion);return;}
 if(state.voice.awaitingConfirmation&&isVoiceNo(raw)){state.voice.pending={};state.voice.awaitingConfirmation=false;renderVoicePending();speakVoice(voiceText("कोई बात नहीं। सही detail बोलिए, मैं उसे दोबारा check करूँगा।","No problem. Tell me the correct detail and I'll check it again."));return;}
 if(/\b(skip|chhodo)\b|छोड़ो|स्किप/.test(lower)){if(state.voice.lastField==="deposit"){state.voice.skippedDeposit=true;nextVoiceQuestion();return;}speakVoice(voiceText("ठीक है, इस optional detail को बाद में भर सकते हैं।","Okay, you can fill this optional detail later."));return;}
 const extracted=extractVoiceDetails(raw);
 if(!Object.keys(extracted).length){speakVoice(voiceText("मैं आपकी बात पूरी तरह नहीं समझ पाया। कृपया property type, location या rent जैसी detail फिर से बताइए।","I couldn't identify a property detail. Please repeat the property type, location or rent."));return;}
 state.voice.pending={...state.voice.pending,...extracted};state.voice.awaitingConfirmation=true;renderVoicePending();
 const summary=Object.entries(state.voice.pending).map(([key,value])=>voiceFieldLabel(key)+" "+voiceFieldValue(key,value)).join(", ");
 speakVoice(voiceText("मैंने ये details समझी हैं: ","I understood: ")+summary+voiceText(". क्या ये सही हैं? हाँ या नहीं बोलें।",". Are these correct? Say yes or no."));
}
function scheduleVoiceTurn(){
 if(state.voice.turnTimer)clearTimeout(state.voice.turnTimer);
 state.voice.turnTimer=setTimeout(()=>{const text=state.voice.turnText.trim();state.voice.turnText="";if(text)processVoiceTurn(text);},1100);
}
function updateVoiceTranscript(){const area=$("#gdrStudioVoiceTranscript");if(area)area.value=[state.voice.finalText,state.voice.turnText,state.voice.interimText].filter(Boolean).join(" ").trim();}
function scheduleVoiceRestart(delay){
 if(!state.voice.active||state.voice.manualStop||state.voice.permissionBlocked||state.voice.speaking)return;
 if(state.voice.restartTimer)clearTimeout(state.voice.restartTimer);
 state.voice.restartTimer=setTimeout(()=>{state.voice.restartTimer=null;startVoiceRecognition();},delay||350);
}
function startVoiceRecognition(){
 if(!state.voice.active||state.voice.manualStop||state.voice.speaking||state.recognition)return;
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){setVoiceState("VOICE INPUT UNAVAILABLE",false);setVoiceReply(voiceText("इस browser में voice recognition उपलब्ध नहीं है। आप नीचे type कर सकते हैं।","Voice recognition is unavailable in this browser. You can type below instead."));return;}
 const rec=new Speech(),session=++state.voice.session;rec.lang=$("#gdrStudioVoiceLanguage")?.value||"hi-IN";rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;state.recognition=rec;
 rec.onstart=()=>{if(session!==state.voice.session)return;state.recording=true;setVoiceState("LISTENING · SPEAK NATURALLY",true);const status=$("#gdrStudioVoiceStatus");if(status)status.textContent=voiceText("मैं सुन रहा हूँ। आप आराम से बोलिए; थोड़ी देर pause लेने पर mic बंद नहीं होगा।","I'm listening. Speak naturally; a short pause won't end your session.");};
 rec.onresult=e=>{
  if(session!==state.voice.session)return;let interim="";
  for(let i=e.resultIndex;i<e.results.length;i++){const result=e.results[i],spoken=result[0]&&result[0].transcript||"";if(result.isFinal&&spoken.trim())state.voice.turnText+=(state.voice.turnText?" ":"")+spoken.trim();else interim+=spoken;}
  state.voice.interimText=interim;updateVoiceTranscript();if(state.voice.turnText.trim())scheduleVoiceTurn();
 };
 rec.onerror=e=>{
  if(session!==state.voice.session)return;const fatal=["not-allowed","service-not-allowed","audio-capture","language-not-supported"].includes(e.error);
  if(fatal){state.voice.permissionBlocked=true;state.voice.active=false;state.recording=false;setVoiceState("MICROPHONE NEEDS ATTENTION",false);setVoiceReply(e.error==="not-allowed"||e.error==="service-not-allowed"?voiceText("Microphone permission blocked है। Chrome site settings में microphone allow करके दोबारा Start speaking दबाएँ।","Microphone permission is blocked. Allow it in Chrome site settings, then press Start speaking again."):voiceText("Microphone या selected language उपलब्ध नहीं है। Language बदलें या manually type करें।","The microphone or selected language is unavailable. Change the language or type manually."));}
  else if(e.error==="network")setVoiceReply(voiceText("Browser speech recognition को network access नहीं मिल रहा। Connection check करें; manual typing उपलब्ध है।","Browser speech recognition needs a network connection. Check your connection; manual typing is still available."));
 };
 rec.onend=()=>{
  if(session!==state.voice.session)return;state.recognition=null;state.recording=false;
  if(state.voice.active&&!state.voice.manualStop&&!state.voice.permissionBlocked&&!state.voice.speaking){setVoiceState("RECONNECTING MICROPHONE…",true);scheduleVoiceRestart(450);}
  else if(state.voice.permissionBlocked)setVoiceState("MICROPHONE NEEDS ATTENTION",false);
  else if(!state.voice.speaking)setVoiceState("READY",false);
 };
 try{rec.start();}catch(error){state.recognition=null;state.recording=false;scheduleVoiceRestart(800);}
}
function startVoice(){
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){setVoiceState("VOICE INPUT UNAVAILABLE",false);setVoiceReply(voiceText("इस browser में voice input नहीं है। आप manually type कर सकते हैं।","Voice input is unavailable in this browser. You can type manually."));return;}
 if(state.voice.active&&state.recording)return;state.voice.manualStop=false;state.voice.permissionBlocked=false;state.voice.active=true;
 const status=$("#gdrStudioVoiceStatus");if(status)status.textContent=voiceText("Microphone शुरू हो रहा है…","Starting microphone…");setVoiceState("STARTING",true);speakVoice(voiceText("नमस्ते! मैं GDR हूँ। अपनी property के बारे में बताइए। मैं एक-एक करके ज़रूरी details पूछूँगा।","Hello! I’m GDR. Tell me about your property and I’ll ask for the details I need."),startVoiceRecognition);
}
function stopVoice(){
 state.voice.active=false;state.voice.manualStop=true;state.recording=false;state.voice.session++;
 if(state.voice.restartTimer)clearTimeout(state.voice.restartTimer);state.voice.restartTimer=null;
 if(state.voice.turnTimer)clearTimeout(state.voice.turnTimer);state.voice.turnTimer=null;
 if(state.recognition){const rec=state.recognition;state.recognition=null;try{rec.stop();}catch(e){}}
 if(window.speechSynthesis)window.speechSynthesis.cancel();state.voice.speaking=false;setVoiceState("PAUSED",false);
 const status=$("#gdrStudioVoiceStatus");if(status)status.textContent=voiceText("Microphone रोक दिया गया है। दोबारा शुरू करने के लिए Start speaking दबाएँ।","Microphone paused. Press Start speaking to continue.");
}
function toggleVoiceMute(){
 state.voice.muted=!state.voice.muted;const btn=$("#gdrStudioVoiceMute");
 if(btn){btn.textContent=state.voice.muted?"🔇 Voice muted":"🔊 Voice on";btn.setAttribute("aria-pressed",state.voice.muted?"true":"false");}
 if(state.voice.muted&&window.speechSynthesis)window.speechSynthesis.cancel();
}

function bindEvents(){
 const root=studio();if(!root||root.dataset.bound==="1")return;root.dataset.bound="1";
 root.addEventListener("click",e=>{
  const type=e.target.closest("[data-gdr-property-type]");if(type){selectedType(type.dataset.gdrPropertyType);return;}
  const config=e.target.closest("[data-gdr-configuration]");if(config){setConfiguration(config.dataset.gdrConfiguration);return;}
  const step=e.target.closest("[data-gdr-studio-goto]");if(step){goToStep(Number(step.dataset.gdrStudioGoto));return;}
 });
 $("#gdrStudioBack")?.addEventListener("click",()=>goToStep(state.step-1));
 $("#gdrStudioNext")?.addEventListener("click",()=>goToStep(state.step+1));
 $("#gdrStudioClose")?.addEventListener("click",close);
 $("#gdrStudioLocation")?.addEventListener("input",e=>{
  state.address=e.target.value;state.lat=null;state.lng=null;state.pincode="";const pin=$("#gdrStudioPincode");if(pin)pin.value="";state.nearbyPlaces=[];renderNearby();saveDraft();
  if(searchTimer)clearTimeout(searchTimer);
  const q=e.target.value.trim();if(q.length<3){$("#gdrStudioLocationSuggestions").hidden=true;updateLocationStatus();return;}
  searchTimer=setTimeout(()=>searchAddress(q),350);
 });
 $("#gdrStudioPincode")?.addEventListener("input",e=>{state.pincode=e.target.value.replace(/\D/g,"").slice(0,6);e.target.value=state.pincode;saveDraft();});
 ["gdrStudioRent","gdrStudioDeposit","gdrStudioFurnishing","gdrStudioDescription","gdrStudioRoomType","gdrStudioGender","gdrStudioTotalBeds","gdrStudioAvailableBeds","gdrStudioFoodIncluded"].forEach(id=>{
  const el=document.getElementById(id);if(!el)return;
  el.addEventListener("input",()=>{const key={gdrStudioRent:"rent",gdrStudioDeposit:"deposit",gdrStudioFurnishing:"furnishing",gdrStudioDescription:"description",gdrStudioRoomType:"roomType",gdrStudioGender:"gender",gdrStudioTotalBeds:"totalBeds",gdrStudioAvailableBeds:"availableBeds",gdrStudioFoodIncluded:"foodIncluded"}[id];state[key]=el.value;saveDraft();});
  el.addEventListener("change",()=>{const key={gdrStudioRent:"rent",gdrStudioDeposit:"deposit",gdrStudioFurnishing:"furnishing",gdrStudioDescription:"description",gdrStudioRoomType:"roomType",gdrStudioGender:"gender",gdrStudioTotalBeds:"totalBeds",gdrStudioAvailableBeds:"availableBeds",gdrStudioFoodIncluded:"foodIncluded"}[id];state[key]=el.value;saveDraft();});
 });
 $("#gdrStudioUseGps")?.addEventListener("click",useGps);
 $("#gdrStudioOpenMap")?.addEventListener("click",openMap);
 $("#gdrStudioPhotoFiles")?.addEventListener("change",e=>{acceptFiles(e.target.files);e.target.value="";});
 $("#gdrStudioCameraFiles")?.addEventListener("change",e=>{acceptFiles(e.target.files);e.target.value="";});
 $("#gdrStudioChoosePhotos")?.addEventListener("click",()=>$("#gdrStudioPhotoFiles")?.click());
 $("#gdrStudioTakePhotos")?.addEventListener("click",()=>$("#gdrStudioCameraFiles")?.click());
 $("#gdrStudioVoiceStart")?.addEventListener("click",startVoice);
 $("#gdrStudioVoiceStop")?.addEventListener("click",stopVoice);
 $("#gdrStudioVoiceMute")?.addEventListener("click",toggleVoiceMute);
 $("#gdrStudioVoiceConfirm")?.addEventListener("click",()=>{applyVoicePending();speakVoice(voiceText("ठीक है, details confirm कर दी हैं।","Details confirmed."),nextVoiceQuestion);});
 $("#gdrStudioVoiceEdit")?.addEventListener("click",()=>{state.voice.pending={};state.voice.awaitingConfirmation=false;renderVoicePending();speakVoice(voiceText("ठीक है, आप form में manually बदलाव कर सकते हैं।","Okay, you can edit the form manually."));});
 $("#gdrStudioVoiceLanguage")?.addEventListener("change",e=>{state.voice.language=String(e.target.value||"hi-IN").startsWith("en")?"en":"hi";});
 $("#gdrStudioVoiceTranscript")?.addEventListener("input",e=>{state.voice.finalText=e.target.value;});
 $("#gdrStudioPublish")?.addEventListener("click",publish);
 document.addEventListener("click",e=>{
  if(e.target.closest("#ownerAddPropertyBtn")){
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open(false);
  }
  if(e.target.closest("#gdrListPropertyStart")){
   e.preventDefault();open(false);
  }
  if(e.target.closest("#gdrListPropertySpeak")){
   e.preventDefault();open(true);
  }
  if(e.target.closest("#gdrCloseOwnerMapPickerBtn"))setTimeout(restoreMapPanel,120);
  if(e.target.closest("#gdrConfirmOwnerMapLocation"))setTimeout(restoreMapPanel,180);
 },true);
 document.addEventListener("click",e=>{
  const cover=e.target.closest("[data-gdr-studio-cover]");
  if(cover){setCover(Number(cover.dataset.gdrStudioCover));}
  const remove=e.target.closest("[data-gdr-studio-remove-photo]");
  if(remove){
   const index=Number(remove.dataset.gdrStudioRemovePhoto);
   if(state.files[index]){URL.revokeObjectURL(state.files[index].previewUrl);state.files.splice(index,1);}
   state.coverIndex=Math.max(0,Math.min(state.coverIndex,state.files.length-1));renderPhotos();saveDraft();
  }
 });
 const formInputs=$$("#gdrPropertyStudio input,#gdrPropertyStudio select,#gdrPropertyStudio textarea");
 formInputs.forEach(el=>el.addEventListener("change",saveDraft));
}
async function publish(){
 if(state.publishing)return;
 for(let i=0;i<4;i++){if(!validateStep(i)){goToStep(i);return;}}
 state.address=$("#gdrStudioLocation")?.value.trim()||state.address;
 state.rent=$("#gdrStudioRent")?.value||state.rent;
 state.deposit=$("#gdrStudioDeposit")?.value||state.deposit;
 state.description=$("#gdrStudioDescription")?.value||state.description;
 state.pincode=$("#gdrStudioPincode")?.value||state.pincode;
 try{
  const account=await getOwner();state.user=account.user;state.owner=account.owner;
  state.publishing=true;
  const btn=$("#gdrStudioPublish");if(btn){btn.disabled=true;btn.textContent="Publishing securely…";}
  message("Uploading your genuine property photos…","info");
  const uploaded=await uploadPhotos();
  const photoUrls=uploaded.map(p=>p.url);
  const coverUrl=photoUrls[0]||null;
  const propertyType=state.propertyType;
  const listingType=propertyType==="pg"?"pg":propertyType==="hostel"?"hostel":"home";
  const config=propertyType==="other"?"Other":state.configuration;
  const bhk=listingType==="home"?(config==="1 RK"||config==="1 BHK"?1:config==="2 BHK"?2:config==="3 BHK"?3:config==="4 BHK"?4:config==="5+ BHK"?5:1):null;
  const title=titleForListing();
  const params={
   p_submission_id:state.submissionId||uuid(),
   p_property_type:propertyType,
   p_configuration:config||null,
   p_security_deposit:state.deposit===""?null:Number(state.deposit),
   p_pincode:state.pincode||null,
   p_photo_urls:photoUrls,
   p_nearby_places:state.nearbyPlaces,
   p_listing_type:listingType,
   p_room_type:listingType==="home"?null:state.roomType,
   p_gender_preference:listingType==="home"?null:state.gender,
   p_food_included:listingType==="home"?null:(state.foodIncluded==="yes"?true:state.foodIncluded==="no"?false:null),
   p_total_beds:listingType==="home"?null:Number(state.totalBeds),
   p_available_beds:listingType==="home"?null:Number(state.availableBeds),
   p_name:title,
   p_title:title,
   p_location:state.address,
   p_area:state.address.split(",")[0].trim(),
   p_address:state.address,
   p_latitude:state.lat,
   p_longitude:state.lng,
   p_bhk:bhk,
   p_rent:Number(state.rent),
   p_furnishing:state.furnishing||null,
   p_description:state.description||null,
   p_image_url:coverUrl
  };
  const c=client();
  const {data,error}=await c.rpc("owner_publish_property_studio",params);
  if(error||!data)throw error||new Error("The property could not be saved. Please try again.");
  try{localStorage.removeItem(draftKey());}catch(e){}
  state.publishing=false;
  showSuccess(data);
 }catch(e){
  console.error("GharDekho Property Studio publish failed",e);
  message(e.message||"Your property could not be published. Your draft is saved; please try again.","error");
 }finally{
  state.publishing=false;
  const btn=$("#gdrStudioPublish");if(btn){btn.disabled=false;btn.textContent="Publish My Property";}
 }
}
function showSuccess(property){
 const root=studio();if(!root)return;
 state.published=true;
 const body=$("#gdrStudioMain");
 if(body)body.innerHTML=
  '<div class="gdr-studio-success"><div class="gdr-studio-success-mark">✓</div><span>GHARDEKHO PROPERTY STUDIO</span><h1>Your property is submitted.</h1><p>Your listing is saved in My Properties with <strong>Pending verification</strong> status. It will follow the existing GharDekho listing and occupancy workflow.</p><div class="gdr-studio-success-id">Property reference <b>'+escapeHtml(property.id||"Saved")+'</b></div><button type="button" id="gdrStudioViewInventory">View My Properties</button><button type="button" class="gdr-studio-success-secondary" id="gdrStudioSuccessClose">Back to Dashboard</button></div>';
 $("#gdrStudioViewInventory")?.addEventListener("click",()=>{try{sessionStorage.setItem("gdr_studio_open_inventory","1");}catch(e){}window.location.reload();});
 $("#gdrStudioSuccessClose")?.addEventListener("click",()=>window.location.reload());
}
async function init(){
 const mount=$("#gdrPropertyStudioMount");
 if(mount&&!studio()){
  const response=await fetch("/assets/gdr-property-studio.txt?v="+VERSION,{cache:"no-cache"});
  if(!response.ok)throw new Error("Property Studio layout could not be loaded.");
  mount.innerHTML=await response.text();
 }
 bindEvents();wrapMapCallback();
 const studioRoot=studio();
 if(studioRoot)studioRoot.hidden=true;
}
let readyPromise=Promise.resolve();
window.GDRPropertyStudio={open:()=>open(false),openByVoice:()=>open(true),close:close};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{readyPromise=init();},{once:true});else readyPromise=init();
})();