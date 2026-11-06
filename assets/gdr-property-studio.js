(function(){
"use strict";
const VERSION="20261107-studio1";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const state={
  user:null,owner:null,step:0,publishing:false,propertyType:"",configuration:"",
  rent:"",deposit:"",description:"",address:"",pincode:"",lat:null,lng:null,
  roomType:"",gender:"",totalBeds:"",availableBeds:"",foodIncluded:"",
  files:[],coverIndex:0,uploadedPhotos:[],uploadedPaths:[],nearbyPlaces:[],
  submissionId:"",recognition:null,recording:false,mapParent:null,mapNext:null
};
const typeLabels={
 apartment:"Apartment / Flat",independent_house:"Independent House",villa:"Villa",
 pg:"PG",hostel:"Hostel",other:"Other"
};
const configurations=["1 RK","1 BHK","2 BHK","3 BHK","4 BHK","5+ BHK"];
const allowedTypes=["image/jpeg","image/png","image/webp"];
let searchTimer=null,searchController=null,googlePlacesPromise=null;
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
  description:state.description,address:state.address,pincode:state.pincode,lat:state.lat,lng:state.lng,
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
  ["propertyType","configuration","rent","deposit","description","address","pincode","roomType","gender","totalBeds","availableBeds","foodIncluded"].forEach(k=>{if(d[k]!==undefined)state[k]=d[k];});
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
  gdrStudioDeposit:state.deposit,gdrStudioDescription:state.description,
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
  showSuggestions(india.length?india:features);
  if(status)status.textContent=(india.length||features.length)?"Choose the correct locality from the suggestions.":"No matching address found. Try adding the city or PIN code.";
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
 if(!moveMapToStudio()){message("The map picker is unavailable. Please use address search or GPS.","error");return;}
 if(!window.GDRMapExperience||typeof window.GDRMapExperience.openOwnerMapPicker!=="function"){
  message("The map service is still loading. Please try again in a moment.","error");restoreMapPanel();return;
 }
 try{
  await window.GDRMapExperience.openOwnerMapPicker();
  message("Tap the exact property entrance or drag the pin, then confirm.","info");
 }catch(e){message(e.message||"Could not open the map picker.","error");restoreMapPanel();}
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
function googleKey(){
 const meta=$('meta[name="gdr-google-maps-api-key"]');
 return String(window.GDR_GOOGLE_MAPS_API_KEY||(meta&&meta.content)||"").trim();
}
function loadGooglePlaces(){
 const key=googleKey();
 if(!key)return Promise.resolve(false);
 if(window.google&&window.google.maps&&window.google.maps.places)return Promise.resolve(true);
 if(googlePlacesPromise)return googlePlacesPromise;
 googlePlacesPromise=new Promise(resolve=>{
  const script=document.createElement("script");
  script.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(key)+"&libraries=places&v=weekly";
  script.async=true;script.defer=true;
  script.onload=()=>resolve(!!(window.google&&window.google.maps&&window.google.maps.places));
  script.onerror=()=>resolve(false);
  document.head.appendChild(script);
 });
 return googlePlacesPromise;
}
const placeTypes=[
 ["train_station","Railway stations"],["bus_station","Bus stops"],["hospital","Hospitals"],
 ["school","Schools"],["university","Colleges & universities"],["shopping_mall","Shopping malls"],
 ["supermarket","Markets"],["park","Parks"],["stadium","Stadiums"],["subway_station","Metro stations"]
];
function renderNearby(){
 const box=$("#gdrStudioNearbyList"),status=$("#gdrStudioNearbyStatus");if(!box||!status)return;
 box.innerHTML="";
 if(!googleKey()){
  status.textContent="Google Places is not configured yet. Real nearby results will appear after a restricted Google Maps browser key is added.";
  return;
 }
 if(!state.nearbyPlaces.length){status.textContent="Searching for genuine nearby public places…";return;}
 state.nearbyPlaces.forEach(place=>{
  const row=document.createElement("div");row.className="gdr-studio-nearby-row";
  const left=document.createElement("span"),name=document.createElement("strong"),category=document.createElement("small");
  name.textContent=place.name;category.textContent=place.category;
  left.append(name,category);
  const dist=document.createElement("b");dist.textContent=distanceLabel(place.distance_m);
  row.append(left,dist);box.appendChild(row);
 });
 status.textContent=state.nearbyPlaces.length+" nearby places found using Google Places.";
}
async function loadNearbyPlaces(){
 state.nearbyPlaces=[];renderNearby();saveDraft();
 if(state.lat===null||state.lng===null)return;
 if(!googleKey())return;
 const status=$("#gdrStudioNearbyStatus");if(status)status.textContent="Finding nearby railway stations, hospitals, schools and more…";
 const ready=await loadGooglePlaces();
 if(!ready){if(status)status.textContent="Google Places could not load. Check the API key, enabled APIs, billing and website restrictions.";return;}
 try{
  const service=new google.maps.places.PlacesService(document.createElement("div"));
  const location=new google.maps.LatLng(state.lat,state.lng);
  const searches=placeTypes.map(([type,label])=>new Promise(resolve=>{
   service.nearbySearch({location:location,radius:5000,type:type},(results,resultStatus)=>{
    if(resultStatus!=="OK"||!Array.isArray(results)){resolve([]);return;}
    resolve(results.map(place=>{
     const loc=place.geometry&&place.geometry.location;
     const lat=loc&&typeof loc.lat==="function"?loc.lat():null;
     const lng=loc&&typeof loc.lng==="function"?loc.lng():null;
     if(!place.name||!Number.isFinite(lat)||!Number.isFinite(lng))return null;
     return {name:place.name,category:label,distance_m:Math.round(distanceMeters(state.lat,state.lng,lat,lng)),latitude:lat,longitude:lng,place_id:place.place_id||""};
    }).filter(Boolean));
   });
  }));
  const batches=await Promise.all(searches),unique=new Map();
  batches.flat().forEach(place=>{const key=place.place_id||place.name+"|"+place.latitude+"|"+place.longitude;if(!unique.has(key))unique.set(key,place);});
  state.nearbyPlaces=Array.from(unique.values()).sort((a,b)=>a.distance_m-b.distance_m).slice(0,30);
  renderNearby();saveDraft();
 }catch(e){
  console.warn("Google Places discovery failed",e);
  if(status)status.textContent="Nearby places could not be loaded. Check the Google Places API configuration and try again.";
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
  ["Location",address||"—"],
  ["Availability","Pending verification after submission"]
 ];
 box.innerHTML=
  '<div class="gdr-studio-preview-card"><img src="'+escapeHtml(cover)+'" alt="Property cover photo"><div class="gdr-studio-preview-copy"><span class="gdr-studio-preview-kicker">RENTER VIEW PREVIEW</span><h3>'+escapeHtml(title)+'</h3><strong class="gdr-studio-preview-rent">'+escapeHtml(formatINR(rent))+' <small>/ month</small></strong><div class="gdr-studio-preview-meta">'+details.map(d=>'<div><small>'+escapeHtml(d[0])+'</small><b>'+escapeHtml(d[1])+'</b></div>').join("")+'</div><p>'+escapeHtml(state.description||"No additional description.")+'</p></div></div>'+
  (photos.length>1?'<div class="gdr-studio-preview-strip">'+photos.map(p=>'<img src="'+escapeHtml(p)+'" alt="Property photo preview">').join("")+'</div>':"")+
  '<div class="gdr-studio-preview-nearby"><strong>Nearby places</strong><p>'+(state.nearbyPlaces.length?state.nearbyPlaces.length+" genuine Google Places results will be shown to renters.":"Nearby Places is awaiting Google Places API configuration.")+'</p></div>';
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
  const dash=$("#ownerDashboard");
  if(!dash||!dash.classList.contains("active")||!document.body.classList.contains("gd-owner-mode")){
   throw new Error("Open the Owner Dashboard to start a property listing.");
  }
  const account=await getOwner();state.user=account.user;state.owner=account.owner;
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
function parseVoice(text){
 const t=String(text||"").toLowerCase();
 if(/\b(pg|paying guest)\b/.test(t))selectedType("pg");
 else if(/\b(hostel)\b/.test(t))selectedType("hostel");
 else if(/\b(villa)\b/.test(t))selectedType("villa");
 else if(/\b(independent house|standalone house|separate house)\b/.test(t))selectedType("independent_house");
 else if(/\b(flat|apartment)\b/.test(t))selectedType("apartment");
 else if(/\b(other)\b/.test(t))selectedType("other");
 const numberWords={ek:"1",one:"1",do:"2",two:"2",teen:"3",three:"3",char:"4",four:"4",paanch:"5",panch:"5",five:"5"};
 const config=t.match(/\b(1\s*rk|1\s*bhk|2\s*bhk|3\s*bhk|4\s*bhk|5\+\s*bhk)\b/i);
 if(config){setConfiguration(config[1].replace(/\s+/g," ").toUpperCase());}
 else{
  const hindi=t.match(/\b(ek|do|teen|char|paanch|panch|one|two|three|four|five)\s*(?:bhk|bedroom)\b/);
  if(hindi&&numberWords[hindi[1]])setConfiguration(numberWords[hindi[1]]+" BHK");
 }
 const rent=t.match(/(?:₹|rs\.?|rupees?|rupee|rupaye|rent|kiraya)\s*(?:is|of|hai|ka|around)?\s*([\d,]{3,})/i);
 if(rent){const val=rent[1].replace(/,/g,"");if(Number(val)>0){state.rent=val;const el=$("#gdrStudioRent");if(el)el.value=val;}}
 const deposit=t.match(/(?:deposit|security)\s*(?:is|of|hai|ka)?\s*(?:₹|rs\.?)?\s*([\d,]{3,})/i);
 if(deposit){state.deposit=deposit[1].replace(/,/g,"");const el=$("#gdrStudioDeposit");if(el)el.value=state.deposit;}
 const hindiLoc=t.match(/(?:mera ghar|mera makaan|property|ghar)\s+(.{3,90}?)\s+(?:mein|me|par)\b/i);
 const englishLoc=t.match(/(?:\bin\s+|\bat\s+)([a-z0-9 ,'-]{3,70}?)(?=\s+(?:is|hai|with|rent|kiraya|monthly|for)\b|[.!?]|$)/i);
 const loc=hindiLoc||englishLoc;
 if(loc){
  const address=loc[1].trim().replace(/\s+/g," ");
  if(address.length>=3){const el=$("#gdrStudioLocation");if(el)el.value=address;state.address=address;searchAddress(address);}
 }
 const pin=t.match(/\b([1-9][0-9]{5})\b/);if(pin){state.pincode=pin[1];const el=$("#gdrStudioPincode");if(el)el.value=pin[1];}
 syncFormFromState();saveDraft();
 message("Voice details filled where recognized. Please review and correct every field before continuing.","success");
}
function startVoice(){
 const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Speech){message("Voice input is not supported in this browser. You can complete the listing by typing.","error");return;}
 stopVoice();
 const lang=$("#gdrStudioVoiceLanguage")?.value||"hi-IN";
 const rec=new Speech();state.recognition=rec;rec.lang=lang;rec.interimResults=false;rec.continuous=false;
 const status=$("#gdrStudioVoiceStatus"),btn=$("#gdrStudioVoiceStart");
 rec.onstart=()=>{state.recording=true;if(status)status.textContent="Listening… Speak naturally in Hindi, English or Hinglish.";if(btn){btn.classList.add("is-recording");btn.textContent="● Listening";}};
 rec.onresult=e=>{
  const transcript=Array.from(e.results||[]).map(r=>r[0]&&r[0].transcript||"").join(" ");
  const area=$("#gdrStudioVoiceTranscript");if(area)area.value=transcript;
  parseVoice(transcript);
 };
 rec.onerror=e=>{if(status)status.textContent=e.error==="not-allowed"?"Microphone permission was denied. Allow microphone access and try again.":"Voice input stopped. You can edit the details manually.";};
 rec.onend=()=>{state.recording=false;if(status&&status.textContent==="Listening… Speak naturally in Hindi, English or Hinglish.")status.textContent="Voice capture finished. Review the details above.";if(btn){btn.classList.remove("is-recording");btn.textContent="Start speaking";}};
 try{rec.start();}catch(e){message("Microphone could not start. Check browser permission and try again.","error");}
}
function stopVoice(){if(state.recognition){try{state.recognition.stop();}catch(e){}state.recognition=null;}state.recording=false;}
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
  state.address=e.target.value;state.lat=null;state.lng=null;state.pincode="";const pin=$("#gdrStudioPincode");if(pin)pin.value="";state.nearbyPlaces=[];saveDraft();
  if(searchTimer)clearTimeout(searchTimer);
  const q=e.target.value.trim();if(q.length<3){$("#gdrStudioLocationSuggestions").hidden=true;updateLocationStatus();return;}
  searchTimer=setTimeout(()=>searchAddress(q),350);
 });
 $("#gdrStudioPincode")?.addEventListener("input",e=>{state.pincode=e.target.value.replace(/\D/g,"").slice(0,6);e.target.value=state.pincode;saveDraft();});
 ["gdrStudioRent","gdrStudioDeposit","gdrStudioDescription","gdrStudioRoomType","gdrStudioGender","gdrStudioTotalBeds","gdrStudioAvailableBeds","gdrStudioFoodIncluded"].forEach(id=>{
  const el=document.getElementById(id);if(!el)return;
  el.addEventListener("input",()=>{const key={gdrStudioRent:"rent",gdrStudioDeposit:"deposit",gdrStudioDescription:"description",gdrStudioRoomType:"roomType",gdrStudioGender:"gender",gdrStudioTotalBeds:"totalBeds",gdrStudioAvailableBeds:"availableBeds",gdrStudioFoodIncluded:"foodIncluded"}[id];state[key]=el.value;saveDraft();});
  el.addEventListener("change",()=>{const key={gdrStudioRent:"rent",gdrStudioDeposit:"deposit",gdrStudioDescription:"description",gdrStudioRoomType:"roomType",gdrStudioGender:"gender",gdrStudioTotalBeds:"totalBeds",gdrStudioAvailableBeds:"availableBeds",gdrStudioFoodIncluded:"foodIncluded"}[id];state[key]=el.value;saveDraft();});
 });
 $("#gdrStudioUseGps")?.addEventListener("click",useGps);
 $("#gdrStudioOpenMap")?.addEventListener("click",openMap);
 $("#gdrStudioPhotoFiles")?.addEventListener("change",e=>{acceptFiles(e.target.files);e.target.value="";});
 $("#gdrStudioCameraFiles")?.addEventListener("change",e=>{acceptFiles(e.target.files);e.target.value="";});
 $("#gdrStudioChoosePhotos")?.addEventListener("click",()=>$("#gdrStudioPhotoFiles")?.click());
 $("#gdrStudioTakePhotos")?.addEventListener("click",()=>$("#gdrStudioCameraFiles")?.click());
 $("#gdrStudioVoiceStart")?.addEventListener("click",startVoice);
 $("#gdrStudioVoiceStop")?.addEventListener("click",stopVoice);
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
   p_furnishing:null,
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
 const body=$("#gdrStudioMain");
 if(body)body.innerHTML=
  '<div class="gdr-studio-success"><div class="gdr-studio-success-mark">✓</div><span>GHARDEKHO PROPERTY STUDIO</span><h1>Your property is submitted.</h1><p>Your listing is saved in My Properties with <strong>Pending verification</strong> status. It will follow the existing GharDekho listing and occupancy workflow.</p><div class="gdr-studio-success-id">Property reference <b>'+escapeHtml(property.id||"Saved")+'</b></div><button type="button" id="gdrStudioViewInventory">View My Properties</button><button type="button" class="gdr-studio-success-secondary" id="gdrStudioSuccessClose">Back to Dashboard</button></div>';
 $("#gdrStudioViewInventory")?.addEventListener("click",()=>{try{sessionStorage.setItem("gdr_studio_open_inventory","1");}catch(e){}window.location.reload();});
 $("#gdrStudioSuccessClose")?.addEventListener("click",()=>window.location.reload());
}
function init(){
 bindEvents();wrapMapCallback();
 const studioRoot=studio();
 if(studioRoot)studioRoot.hidden=true;
}
window.GDRPropertyStudio={open:()=>open(false),openByVoice:()=>open(true),close:close};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();