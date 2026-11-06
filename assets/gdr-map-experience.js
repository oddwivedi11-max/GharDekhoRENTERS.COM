
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    renterMap:null, ownerMap:null, renterLayer:null, radiusCircle:null,
    ownerMarker:null, ownerSelection:null, ownerPinManuallyConfirmed:false, renterPin:null, inventory:[], boundsRows:[], visible:[],
    searchCenter:null, radiusKm:5, viewportRpc:null, loadedOnce:false, resolvedQuery:"",
    geolocationAttempted:false, searchTimer:null, searchController:null,
    ownerSearchTimer:null, ownerSearchController:null,
    currentPrefs:{}, selectedPropertyId:null, markerById:new Map(), lastSearchBounds:null
  };
  const INDIA_CENTER=[22.9734,78.6569], TILE_URL="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const PHOTON="https://photon.komoot.io/api/";
  const asNumber=v=>v===null||v===undefined||String(v).trim()===""?null:(Number.isFinite(Number(v))?Number(v):null);
  const validPoint=(lat,lng)=>asNumber(lat)!==null&&asNumber(lng)!==null&&asNumber(lat)>=-90&&asNumber(lat)<=90&&asNumber(lng)>=-180&&asNumber(lng)<=180;
  const money=v=>"₹"+new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(Number(v||0));
  const distanceKm=(a,b)=>{
    const rad=n=>n*Math.PI/180,dLat=rad(b[0]-a[0]),dLng=rad(b[1]-a[1]);
    const x=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)**2;
    return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
  };
  function node(tag,cls,value){const n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined&&value!==null)n.textContent=String(value);return n;}
  function safeImage(value){if(!value)return "";try{const u=new URL(String(value),location.origin);return u.protocol==="https:"||u.origin===location.origin?u.href:"";}catch(_){return "";}}
  function statusOf(p){if(p.status==="pending"||p.verification_status==="pending")return "Pending verification";if(p.status==="occupied")return "Occupied";if(p.status==="soon_available")return "Available soon";return "Available";}
  function db(){return window.__gdrSupabaseClient||null;}
  function setStatus(message){const n=$("gdrMapStatus");if(n)n.textContent=message||"";}
  function photonLabel(p){p=p||{};return [p.name,p.street,p.locality,p.district,p.city,p.state,p.postcode,p.country].filter(Boolean).map(String).filter((v,i,a)=>a.indexOf(v)===i).join(", ");}
  function loadScript(url){
    return new Promise((resolve,reject)=>{
      const existing=[...document.querySelectorAll("script[data-gdr-map-lib]")].find(s=>s.dataset.gdrMapLib===url);
      if(existing){if(window.L)return resolve();existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",reject,{once:true});return;}
      const script=document.createElement("script");script.src=url;script.async=true;script.dataset.gdrMapLib=url;
      script.onload=resolve;script.onerror=()=>reject(new Error("Map library could not be loaded."));document.head.appendChild(script);
    });
  }
  async function ensureLeaflet(){
    if(!window.L)await loadScript("https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js");
    if(!window.L)throw new Error("Map library is unavailable.");
    if(!window.L.markerClusterGroup){
      try{await loadScript("https://cdn.jsdelivr.net/npm/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js");}
      catch(error){console.warn("Marker clustering unavailable; standard markers will be used.",error);}
    }
  }
  function addTiles(map){window.L.tileLayer(TILE_URL,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);}
  function makeLayer(map){
    if(!window.L.markerClusterGroup)return window.L.layerGroup().addTo(map);
    return window.L.markerClusterGroup({
      showCoverageOnHover:false,
      spiderfyOnMaxZoom:true,
      maxClusterRadius:48,
      // Never show the numeric "2 / 3 / 4" bubble. A clustered group of
      // nearby listings is represented by the same 3D GharDekho house motif.
      iconCreateFunction:function(){
        const html='<span class="gdr-home-3d-cluster"><span class="gdr-home-3d-cluster-back"></span><span class="gdr-home-3d-roof"></span><span class="gdr-home-3d-body"><i></i><b></b><em></em></span><span class="gdr-home-3d-base"></span></span>';
        return window.L.divIcon({className:"gdr-home-3d-cluster-wrap",html,iconSize:[76,72],iconAnchor:[38,54]});
      }
    }).addTo(map);
  }
  async function fetchInventory(){const client=db();if(!client)throw new Error("Property service is still loading.");const r=await client.rpc("get_public_properties");if(r.error)throw r.error;state.inventory=(Array.isArray(r.data)?r.data:[]).filter(p=>validPoint(p.latitude,p.longitude));state.loadedOnce=true;return state.inventory;}
  async function fetchBounds(bounds,center,prefs){
    const client=db();if(!client)throw new Error("Property service is not ready.");
    const sw=bounds.getSouthWest(),ne=bounds.getNorthEast(),p=prefs||{};
    const args={
      p_south:Number(sw.lat),p_west:Number(sw.lng),p_north:Number(ne.lat),p_east:Number(ne.lng),
      p_center_lat:Number(center[0]),p_center_lng:Number(center[1]),p_radius_km:Number(state.radiusKm),
      p_min_rent:p.minBudget?Number(p.minBudget):null,
      p_max_rent:p.maxBudget?Number(p.maxBudget):null,
      p_bhk:p.bhk?Number(p.bhk):null,
      p_listing_type:p.stayType||null,
      p_property_type:p.propertyType||null,
      p_furnishing:p.furnishing||null,
      p_limit:200
    };
    const result=await client.rpc("get_available_map_properties_in_bounds",args);
    if(result.error){console.error("Available map search RPC failed:",result.error);throw new Error("Live property search is temporarily unavailable. Please retry in a moment.");}
    const unique=new Map();
    (Array.isArray(result.data)?result.data:[]).forEach(p=>{
      if(!p||!p.id||!validPoint(p.latitude,p.longitude))return;
      const status=String(p.status||"").toLowerCase();
      if(status!=="verified"&&status!=="pending")return;
      if(status==="verified"&&(p.verification_status!=="verified"||p.owner_verified!==true))return;
      if(status==="pending"&&p.verification_status!=="pending")return;
      if((p.listing_type==="pg"||p.listing_type==="hostel")&&Number(p.available_beds||0)<=0)return;
      if(unique.has(String(p.id)))return;
      const distance=distanceKm(center,[Number(p.latitude),Number(p.longitude)]);
      if(!Number.isFinite(distance)||distance>state.radiusKm||!bounds.contains([Number(p.latitude),Number(p.longitude)]))return;
      unique.set(String(p.id),Object.assign({},p,{gdrDistanceKm:distance}));
    });
    return Array.from(unique.values()).sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm);
  }
  function applyRadius(rows,center){return rows.map(p=>Object.assign({},p,{gdrDistanceKm:distanceKm(center,[Number(p.latitude),Number(p.longitude)])})).filter(p=>p.gdrDistanceKm<=state.radiusKm).sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm);}
  async function reverseGeocodeRenter(lat,lng){
    try{const response=await fetch(PHOTON+"reverse?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lng)+"&lang=en",{headers:{Accept:"application/json"}});if(!response.ok)return "";const payload=await response.json(),feature=payload&&payload.features&&payload.features[0];return photonLabel(feature&&feature.properties)||"";}catch(error){console.info("Renter pin reverse geocoding unavailable; exact coordinates are retained.",error);return "";}
  }
  function setRenterPin(point,label){
    if(!state.renterMap||!validPoint(point.lat,point.lng))return;
    state.searchCenter=[Number(point.lat),Number(point.lng)];state.resolvedQuery=String(label||"");
    const placeType=String(point.properties&& (point.properties.type||point.properties.osm_value)||"").toLowerCase();
    if(placeType==="city"){state.radiusKm=10;const radius=$("gdrMapRadius"),radiusLabel=$("gdrMapRadiusValue");if(radius)radius.value="10";if(radiusLabel)radiusLabel.textContent="10 km";}
    if(state.renterPin)state.renterMap.removeLayer(state.renterPin);
    const icon=window.L.divIcon({className:"gdr-renter-pin-wrap",html:"<span class='gdr-renter-pin'><i></i></span>",iconSize:[34,42],iconAnchor:[17,38]});
    state.renterPin=window.L.marker(state.searchCenter,{icon,keyboard:true,title:"Selected search location",zIndexOffset:1000}).addTo(state.renterMap);
    setStatus((state.resolvedQuery||"Selected map location")+" · Location selected. Tap Search this area to find homes nearby.");
  }
  function markerIcon(p,selected){
    const rent=Number(p.rent||0),short=rent>=100000?"₹"+(rent/100000).toFixed(1)+"L":rent>=1000?"₹"+(rent/1000).toFixed(rent%1000?1:0)+"k":money(rent);
    const pending=p.status==="pending"||p.verification_status==="pending";
    return window.L.divIcon({className:"gdr-home-3d-marker-wrap",html:'<span class="gdr-home-3d-marker'+(pending?" gdr-home-pending":"")+'"><span class="gdr-home-3d-roof"></span><span class="gdr-home-3d-body"><i></i><b></b><em></em></span><span class="gdr-home-3d-base"></span><span class="gdr-home-3d-price">'+short+'</span></span>',iconSize:[76,82],iconAnchor:[38,72]});
  }
  function clearPreview(){const p=$("gdrMapPreview");if(p){p.hidden=true;p.replaceChildren();}}
  function showPreview(p){
    const preview=$("gdrMapPreview");if(!preview)return;preview.replaceChildren();
    const main=node("div","gdr-map-preview-main"),img=document.createElement("img");
    img.alt="Property photograph";img.loading="lazy";img.src=safeImage(p.image_url||(Array.isArray(p.photo_urls)?p.photo_urls[0]:""))||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23e9f1ee'/%3E%3C/svg%3E";
    const copy=node("div","");
    copy.append(node("h4","",p.title||p.name||"Rental property"),node("p","",[p.location,p.address].filter(Boolean).join(", ")||"Location details available"),node("p","gdr-map-rent",money(p.rent)+" / month"));
    const meta=[p.bhk?p.bhk+" BHK":"",p.furnishing||"",p.listing_type&&p.listing_type!=="home"?p.listing_type.toUpperCase():"Home",Number.isFinite(p.gdrDistanceKm)?p.gdrDistanceKm.toFixed(1)+" km away":""].filter(Boolean).join(" · ");
    copy.append(node("p","",meta));if(Number.isFinite(Number(p.gdrMatchScore)))copy.append(node("p","gdr-map-match-score",p.gdrMatchScore+"% preference match"));copy.append(node("p","",statusOf(p)+" · "+(p.owner_verified?"Verified owner":"Owner verification pending")+" · Owner contact is shared only through the approved visit flow."));
    main.append(img,copy);
    const actions=node("div","gdr-map-preview-actions"),details=node("button","gdr-map-details-btn","View details"),favorite=node("button","gdr-map-details-btn","♡ Save"),compare=node("button","gdr-map-details-btn","＋ Compare"),close=node("button","gdr-map-dismiss-btn","Close");
    details.type="button";details.addEventListener("click",()=>{if(typeof window.openPropertyDetails==="function")window.openPropertyDetails(p.id);else setStatus("Open this property from the property results to see full details.");});
    favorite.type="button";favorite.addEventListener("click",()=>{if(typeof window.saveProperty==="function")window.saveProperty(p.id);else setStatus("Sign in as a renter to save this home.");});
    compare.type="button";compare.addEventListener("click",()=>{if(window.GDRRenterExperience&&typeof window.GDRRenterExperience.toggleCompare==="function")window.GDRRenterExperience.toggleCompare(p);else setStatus("Comparison tools are loading. Please try again.");});
    close.type="button";close.addEventListener("click",clearPreview);actions.append(details,favorite,compare,close);preview.append(main,actions);preview.hidden=false;
  }
  function selectProperty(p,pan){
    if(!p||!p.id)return;
    const previous=state.selectedPropertyId;
    state.selectedPropertyId=String(p.id);
    if(previous&&state.markerById.has(previous)){
      const old=state.visible.find(x=>String(x.id)===previous);
      if(old)state.markerById.get(previous).setIcon(markerIcon(old,false));
    }
    const marker=state.markerById.get(String(p.id));
    if(marker)marker.setIcon(markerIcon(p,true));
    const panel=$("gdrMapListPanel");
    if(panel){
      panel.querySelectorAll("[data-property-id]").forEach(card=>{
        card.classList.toggle("gdr-map-list-card-selected",card.dataset.propertyId===String(p.id));
      });
      const card=Array.from(panel.querySelectorAll("[data-property-id]")).find(x=>x.dataset.propertyId===String(p.id));
      if(card&&panel.offsetParent!==null)card.scrollIntoView({behavior:"smooth",block:"nearest"});
    }
    if(pan&&state.renterMap)state.renterMap.flyTo([Number(p.latitude),Number(p.longitude)],Math.max(16,state.renterMap.getZoom()),{duration:.55});
    showPreview(p);
  }
  function renderList(rows){
    const panel=$("gdrMapListPanel");if(!panel)return;panel.replaceChildren();
    if(!rows.length){
      const empty=node("div","gdr-map-empty","No rental homes found in this area. Try expanding your search radius.");
      const more=node("button","gdr-map-expand-radius","Expand search radius");
      more.type="button";more.addEventListener("click",()=>setRenterRadius(Math.min(10,Number(state.radiusKm)+1)));
      empty.append(more);panel.append(empty);return;
    }
    rows.forEach(p=>{
      const b=node("button","gdr-map-list-card","");b.type="button";b.dataset.propertyId=String(p.id);
      if(String(p.id)===state.selectedPropertyId)b.classList.add("gdr-map-list-card-selected");
      const img=document.createElement("img");img.loading="lazy";img.alt="Property photograph";
      img.src=safeImage(p.image_url||(Array.isArray(p.photo_urls)?p.photo_urls[0]:""))||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23e9f1ee'/%3E%3C/svg%3E";
      const copy=node("span","");
      copy.append(
        node("strong","",p.title||p.name||"Rental property"),
        node("small","",[p.location||p.address,p.bhk?p.bhk+" BHK":"",p.furnishing||"",Number.isFinite(p.gdrDistanceKm)?(p.gdrDistanceKm<1?Math.round(p.gdrDistanceKm*1000)+" m away":p.gdrDistanceKm.toFixed(1)+" km away"):""].filter(Boolean).join(" · ")),
        node("b","",money(p.rent)+" / month"),
        node("small","",statusOf(p)+(p.owner_verified?" · Verified owner":" · Owner verification pending"))
      );
      b.append(img,copy);b.addEventListener("click",()=>selectProperty(p,true));panel.append(b);
    });
  }
  function renderMarkers(rows,center){
    if(!state.renterMap||!state.renterLayer)return;
    state.renterLayer.clearLayers();state.markerById.clear();
    if(state.radiusCircle)state.renterMap.removeLayer(state.radiusCircle);
    state.radiusCircle=window.L.circle(center,{radius:state.radiusKm*1000,color:"#c8a96b",weight:2,opacity:.9,fillColor:"#c8a96b",fillOpacity:.07,dashArray:"6 6"}).addTo(state.renterMap);
    if(state.renterPin){state.renterMap.removeLayer(state.renterPin);state.renterPin=null;}
    rows.forEach(p=>{
      const marker=window.L.marker([Number(p.latitude),Number(p.longitude)],{
        icon:markerIcon(p,String(p.id)===state.selectedPropertyId),keyboard:true,
        title:(p.title||p.name||"GharDekho home")+" · "+money(p.rent)+"/month"
      });
      marker.on("click",()=>selectProperty(p,true));state.renterLayer.addLayer(marker);state.markerById.set(String(p.id),marker);
    });
    state.visible=rows;renderList(rows);
    const count=$("gdrMapCount");if(count)count.textContent=rows.length+" "+(rows.length===1?"home":"homes")+" found";
    if(!rows.length){
      clearPreview();setStatus("No rental homes found in this area. Try expanding your search radius.");
      const expand=$("gdrMapExpandRadius");if(expand)expand.hidden=false;return;
    }
    setStatus(rows.length+" "+(rows.length===1?"home":"homes")+" found near "+(state.resolvedQuery||"the map center")+". Occupied homes are excluded.");
    const expand=$("gdrMapExpandRadius");if(expand)expand.hidden=true;
  }
  function applyRenterFilters(prefs){
    prefs=prefs||state.currentPrefs||{};
    state.currentPrefs=Object.assign({},prefs);
    if(!state.searchCenter||!Array.isArray(state.boundsRows))return [];
    let rows=applyRadius(state.boundsRows,state.searchCenter);
    if(prefs.minBudget)rows=rows.filter(p=>Number(p.rent)>=Number(prefs.minBudget));
    if(prefs.maxBudget)rows=rows.filter(p=>Number(p.rent)<=Number(prefs.maxBudget));
    if(prefs.bhk)rows=rows.filter(p=>Number(p.bhk)===Number(prefs.bhk));
    if(prefs.furnishing)rows=rows.filter(p=>String(p.furnishing||"").toLowerCase()===String(prefs.furnishing).toLowerCase());
    if(prefs.stayType)rows=rows.filter(p=>String(p.listing_type||"home").toLowerCase()===String(prefs.stayType).toLowerCase());
    if(prefs.propertyType)rows=rows.filter(p=>String(p.property_type||"").toLowerCase()===String(prefs.propertyType).toLowerCase());
    rows=rows.map(p=>Object.assign({},p,{gdrMatchScore:100}));
    renderMarkers(rows,state.searchCenter);return rows;
  }
  function radiusBounds(center){
    const lat=Number(center[0]),lng=Number(center[1]),latDelta=state.radiusKm/111.32;
    const cos=Math.max(.15,Math.cos(lat*Math.PI/180)),lngDelta=state.radiusKm/(111.32*cos);
    const south=Math.max(-90,lat-latDelta),north=Math.min(90,lat+latDelta);
    const west=Math.max(-180,lng-lngDelta),east=Math.min(180,lng+lngDelta);
    return {
      getSouthWest:()=>({lat:south,lng:west}),
      getNorthEast:()=>({lat:north,lng:east}),
      contains:point=>point[0]>=south&&point[0]<=north&&point[1]>=west&&point[1]<=east
    };
  }
  async function photonGeocode(query){
    const url=PHOTON+"?limit=8&lang=en&q="+encodeURIComponent(query);
    const response=await fetch(url,{headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error("Location search service is unavailable.");
    const payload=await response.json(),features=Array.isArray(payload.features)?payload.features:[];
    return features.filter(f=>{
      const coords=f&&f.geometry&&f.geometry.coordinates;
      return Array.isArray(coords)&&validPoint(coords[1],coords[0]);
    });
  }
  function normalizedText(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();}
  async function resolveMapQuery(query){
    const q=String(query||"").trim();
    if(!q)throw new Error("Enter a city, locality or six-digit PIN code first.");
    let features=[],expectedDistrict="",expectedState="",pin=q;
    if(/^\d{6}$/.test(q)){
      setStatus("Verifying PIN "+pin+" with India Post…");
      const response=await fetch("https://api.postalpincode.in/pincode/"+encodeURIComponent(pin),{headers:{Accept:"application/json"}});
      if(!response.ok)throw new Error("India Post PIN lookup is unavailable. Try the locality or city name.");
      const data=await response.json(),record=Array.isArray(data)?data[0]:null;
      const offices=record&&record.Status==="Success"&&Array.isArray(record.PostOffice)?record.PostOffice:[];
      if(!offices.length)throw new Error("PIN "+pin+" was not found. Check the six digits and try again.");
      const office=offices.find(x=>x&&x.BranchType==="Head Office")||offices.find(x=>x&&x.Name)||offices[0];
      expectedDistrict=String(office.District||"");
      expectedState=String(office.State||"");
      const locality=String(office.Name||expectedDistrict).trim();
      setStatus("PIN "+pin+" belongs to "+[locality,expectedDistrict,expectedState].filter(Boolean).join(", ")+". Finding its map coordinates…");
      const queries=[
        [locality,expectedDistrict,expectedState,"India"].filter(Boolean).join(", "),
        [expectedDistrict,expectedState,"India"].filter(Boolean).join(", "),
        pin+", "+expectedDistrict+", "+expectedState+", India"
      ];
      for(const candidate of queries){
        try{features=await photonGeocode(candidate);if(features.length)break;}catch(error){console.warn("PIN geocoding attempt failed:",error);}
      }
      const district=normalizedText(expectedDistrict),stateName=normalizedText(expectedState);
      features=features.filter(f=>{
        const p=f.properties||{},pState=normalizedText(p.state),pDistrict=normalizedText(p.district||p.county||p.city||p.name),postcode=normalizedText(p.postcode);
        if(pState&&stateName&&!pState.includes(stateName)&&!stateName.includes(pState))return false;
        if(postcode&&postcode!==normalizedText(pin))return false;
        if(pDistrict&&district&&!pDistrict.includes(district)&&!district.includes(pDistrict)&&!normalizedText(p.city).includes(district))return false;
        return true;
      });
      if(!features.length)throw new Error("PIN "+pin+" belongs to "+[expectedDistrict,expectedState].filter(Boolean).join(", ")+", but map coordinates could not be verified. Search the locality name instead.");
    }else{
      features=await photonGeocode(q+", India");
      if(!features.length)throw new Error("We could not locate “"+q+"”. Try a nearby locality, city or PIN code.");
    }
    const feature=features[0],coords=feature.geometry.coordinates,props=feature.properties||{};
    return {lat:Number(coords[1]),lng:Number(coords[0]),label:photonLabel(props)||q,query:q,properties:props};
  }
  async function searchTypedMapLocation(){
    const input=$("gdrMapPlaceSearch"),query=String(input&&input.value||"").trim();
    if(!query)return searchRenterArea();
    const button=$("gdrMapSearchAreaBtn");if(button){button.disabled=true;button.textContent="Locating…";}
    try{
      const point=await resolveMapQuery(query);
      setRenterPin(point,point.label||query);
      state.renterMap.setView(state.searchCenter,14,{animate:false});
      return await searchRenterArea();
    }catch(error){
      console.warn("GDR map location search failed:",error);
      setStatus(error.message||"This location could not be found. Try another city, locality or PIN code.");
      return false;
    }finally{if(button){button.disabled=false;button.textContent="Search this area";}}
  }
  async function searchRenterArea(prefs){
    if(!state.renterMap)return false;
    if(prefs)state.currentPrefs=Object.assign({},prefs);
    const button=$("gdrMapSearchAreaBtn");if(button){button.disabled=true;button.textContent="Searching…";}
    setStatus("Searching genuine available homes in the visible map area…");
    try{
      const center=state.renterMap.getCenter();
      if(!validPoint(center.lat,center.lng))throw new Error("The map center is not a valid location.");
      state.searchCenter=[Number(center.lat),Number(center.lng)];
      const bounds=state.renterMap.getBounds();
      if(!bounds||!bounds.getSouthWest||!bounds.getNorthEast)throw new Error("Map boundaries are unavailable. Move or zoom the map and retry.");
      state.lastSearchBounds=bounds;
      state.boundsRows=await fetchBounds(bounds,state.searchCenter,state.currentPrefs);
      const rows=applyRenterFilters(state.currentPrefs);
      if(!rows.length)setStatus("No rental homes found in this area. Try expanding your search radius.");
      return rows;
    }catch(error){
      console.error("GDR map search failed:",error);
      state.boundsRows=[];state.visible=[];
      renderMarkers([],state.searchCenter||[INDIA_CENTER[0],INDIA_CENTER[1]]);
      setStatus(error&&error.message?error.message:"Properties could not be loaded. Please try again.");
      return false;
    }finally{if(button){button.disabled=false;button.textContent="Search this area";}}
  }
  function setRenterSearchPreferences(prefs){state.currentPrefs=Object.assign({},prefs||{});return state.currentPrefs;}
  function setRenterRadius(value,skipSearch){
    const next=Number(value);
    if(!Number.isFinite(next)){throw new Error("Choose a valid search radius.");}
    state.radiusKm=Math.max(.5,Math.min(10,next));
    const input=$("gdrMapRadius"),label=$("gdrMapRadiusValue");
    if(input)input.value=String(state.radiusKm);
    if(label)label.textContent=state.radiusKm<1?Math.round(state.radiusKm*1000)+" m":state.radiusKm+" km";
    if(!skipSearch&&state.renterMap&&state.searchCenter)return searchRenterArea();
    return Promise.resolve(state.visible.slice());
  }
  async function searchAtCoordinates(lat,lng,label){
    if(!validPoint(lat,lng)||!state.renterMap)throw new Error("A valid map location is required.");
    setRenterPin({lat:Number(lat),lng:Number(lng)},label||"Selected location");
    state.renterMap.flyTo([Number(lat),Number(lng)],15,{duration:.65});
    await new Promise(resolve=>state.renterMap.once("moveend",resolve));
    return searchRenterArea();
  }
  function locateRenter(){
    if(!navigator.geolocation){setStatus("This browser does not support location. Search for a city or locality instead.");searchRenterArea();return;}
    setStatus("Requesting your location permission…");
    navigator.geolocation.getCurrentPosition(async pos=>{setRenterPin({lat:pos.coords.latitude,lng:pos.coords.longitude},"My location");state.renterMap.setView(state.searchCenter,16,{animate:true});await searchRenterArea();},
      error=>{setStatus(error.code===1?"Location permission was denied. Search for any city or locality instead.":"Could not determine your location. Showing the selected map area.");searchRenterArea();},
      {enableHighAccuracy:true,timeout:12000,maximumAge:60000});
  }
  function initRenterMap(){
    if(state.renterMap)return;const canvas=$("gdrExploreMapCanvas");if(!canvas)return;
    state.renterMap=window.L.map(canvas,{zoomControl:false,scrollWheelZoom:true,preferCanvas:true});addTiles(state.renterMap);window.L.control.zoom({position:"bottomright"}).addTo(state.renterMap);
    state.renterLayer=makeLayer(state.renterMap);state.renterMap.setView([23.2599,77.4126],12);
    state.renterMap.on("click",e=>{if(state.visible.length)return;setRenterPin(e.latlng,"Selected map location");});
    state.renterMap.on("moveend",()=>{const s=$("gdrMapStatus");if(s&&state.visible.length)s.textContent="Map area changed. Tap Search this area to refresh homes for the visible boundaries.";});
  }
  async function openRenterMap(){
    const dashboard=$("renterDashboard"),panel=$("gdrExploreMapPanel");if(!dashboard||!panel)return;
    dashboard.classList.add("gdr-map-mode");panel.hidden=false;
    try{
      await ensureLeaflet();initRenterMap();requestAnimationFrame(()=>state.renterMap&&state.renterMap.invalidateSize());
      if(!state.renterMap._gdrInitialView){state.renterMap.setView([23.2599,77.4126],12);state.renterMap._gdrInitialView=true;}
      const input=$("gdrMapPlaceSearch"),query=String(input&&input.value||"").trim();
      if(query)await searchTypedMapLocation();
      else setStatus("Tap anywhere on the map to place your starting location, then tap Search this area. You can also search a city, locality or PIN code.");
    }catch(error){console.error("GDR map initialization failed:",error);setStatus("The interactive map could not load. Check your connection and try again.");}
  }
  function closeRenterMap(){const d=$("renterDashboard"),p=$("gdrExploreMapPanel");if(p)p.hidden=true;if(d)d.classList.remove("gdr-map-mode");clearPreview();}
  function setupPlaceSearch(inputId,panelId,onSelect,kind){
    const input=$(inputId),panel=$(panelId);if(!input||!panel)return;
    const timerKey=kind==="owner"?"ownerSearchTimer":"searchTimer",controllerKey=kind==="owner"?"ownerSearchController":"searchController";
    input.addEventListener("input",()=>{
      if(state[timerKey])clearTimeout(state[timerKey]);if(state[controllerKey])state[controllerKey].abort();
      const q=input.value.trim();panel.replaceChildren();panel.classList.remove("gdr-open");if(q.length<3)return;
      state[timerKey]=setTimeout(async()=>{
        const controller=new AbortController();state[controllerKey]=controller;
        try{const response=await fetch(PHOTON+"?limit=6&lang=en&q="+encodeURIComponent(q+", India"),{headers:{Accept:"application/json"},signal:controller.signal});if(!response.ok)throw new Error("Location suggestions unavailable");
          const payload=await response.json(),features=Array.isArray(payload.features)?payload.features:[];
          features.forEach(f=>{const c=f&&f.geometry&&f.geometry.coordinates;if(!Array.isArray(c)||!validPoint(c[1],c[0]))return;
            const label=photonLabel(f.properties)||q,b=node("button","gdr-map-suggestion",label);b.type="button";b.addEventListener("click",()=>{input.value=label;panel.classList.remove("gdr-open");onSelect({lat:Number(c[1]),lng:Number(c[0]),label,properties:f.properties||{}});});panel.append(b);
          });
          if(panel.childElementCount)panel.classList.add("gdr-open");
        }catch(error){if(error.name!=="AbortError")console.warn("GDR place search:",error);}
      },300);
    });
    input.addEventListener("keydown",e=>{if(e.key==="Escape")panel.classList.remove("gdr-open");if(e.key==="Enter"){e.preventDefault();if(panel.firstElementChild)panel.firstElementChild.click();else if(kind==="renter")searchTypedMapLocation();}});
    document.addEventListener("click",e=>{if(!panel.contains(e.target)&&e.target!==input)panel.classList.remove("gdr-open");});
  }
  function updateOwnerStatus(message){const n=$("gdrOwnerMapSelectionStatus");if(n)n.textContent=message||"";}
  function setOwnerPin(point,label,manualConfirmation){
    if(!state.ownerMap||!validPoint(point.lat,point.lng))return;
    state.ownerSelection={lat:Number(point.lat),lng:Number(point.lng),label:String(label||"")};
    state.ownerPinManuallyConfirmed=manualConfirmation===true;
    if(state.ownerMarker)state.ownerMap.removeLayer(state.ownerMarker);
    state.ownerMarker=window.L.marker([point.lat,point.lng],{draggable:true}).addTo(state.ownerMap);
    state.ownerMarker.on("dragend",()=>{const p=state.ownerMarker.getLatLng();state.ownerSelection={lat:p.lat,lng:p.lng,label:""};state.ownerPinManuallyConfirmed=true;updateOwnerStatus("Exact pin position manually adjusted. Confirm to save these coordinates.");});
    updateOwnerStatus((label?label+" · ":"")+"Pin: "+point.lat.toFixed(5)+", "+point.lng.toFixed(5)+". Drag to adjust.");
  }
  function initOwnerMap(){
    if(state.ownerMap)return;const canvas=$("gdrOwnerMapCanvas");if(!canvas)return;
    state.ownerMap=window.L.map(canvas,{zoomControl:false,scrollWheelZoom:true});addTiles(state.ownerMap);window.L.control.zoom({position:"bottomright"}).addTo(state.ownerMap);
    state.ownerMap.setView([23.2599,77.4126],12);state.ownerMap.on("click",e=>setOwnerPin(e.latlng,"",true));
  }
  async function openOwnerMapPicker(){
    const panel=$("gdrOwnerMapPicker");if(!panel)return;
    try{
      await ensureLeaflet();panel.hidden=false;initOwnerMap();
      const toolbar=panel.querySelector(".gdr-owner-map-toolbar");
      if(toolbar&&!$("gdrOwnerPreciseLocationBtn")){
        const locate=node("button","gdr-map-toggle-btn","◎ Use my precise location");
        locate.type="button";locate.id="gdrOwnerPreciseLocationBtn";
        locate.addEventListener("click",usePreciseOwnerLocation);
        toolbar.insertBefore(locate,toolbar.lastElementChild||null);
      }
      requestAnimationFrame(()=>state.ownerMap&&state.ownerMap.invalidateSize());
      const input=$("propertyLocation"),lat=asNumber(input&&input.dataset.gdSelectedLat),lng=asNumber(input&&input.dataset.gdSelectedLng);
      if(lat!==null&&lng!==null){state.ownerMap.setView([lat,lng],16);setOwnerPin({lat,lng},input.dataset.gdSelectedDisplayName||input.value);}
      else if(!state.ownerSelection){const c=state.ownerMap.getCenter();setOwnerPin(c,"Choose the exact property location");}
    }catch(error){console.error("Owner map picker failed:",error);updateOwnerStatus("The map could not load. Use address suggestions or current location instead.");}
  }
  function closeOwnerMapPicker(){const p=$("gdrOwnerMapPicker");if(p)p.hidden=true;}
  function confirmOwnerMapLocation(){
    if(!state.ownerSelection){updateOwnerStatus("Tap the map or use GPS to place the property pin.");return;}
    if(!state.ownerPinManuallyConfirmed){updateOwnerStatus("This is only an approximate locality-search pin, not a verified property location. Zoom in and tap the exact building/entrance or drag the marker, or use high-accuracy GPS, before confirming.");return;}
    const input=$("propertyLocation"),typed=String(input&&input.value||"").trim(),address=typed||state.ownerSelection.label;
    if(!address){updateOwnerStatus("Enter the full property address before confirming the pin.");if(input)input.focus();return;}
    if(typeof window.__gdrSetPropertyLocation!=="function"||!window.__gdrSetPropertyLocation(address,state.ownerSelection.lat,state.ownerSelection.lng)){updateOwnerStatus("Property form is still initializing. Try again.");return;}
    updateOwnerStatus("Location confirmed. Coordinates will be saved with this property.");closeOwnerMapPicker();
  }
  async function usePreciseOwnerLocation(){
    if(!state.ownerMap){updateOwnerStatus("Open the map first, then request your precise location.");return;}
    if(!navigator.geolocation){updateOwnerStatus("This device/browser does not support GPS location. Search the address or place the pin manually.");return;}
    updateOwnerStatus("Requesting high-accuracy GPS location. Keep location services enabled…");
    navigator.geolocation.getCurrentPosition(async pos=>{
      const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude),accuracy=Number(pos.coords.accuracy);
      if(!validPoint(lat,lng)){updateOwnerStatus("The device returned an invalid location. Search or place the pin manually.");return;}
      state.ownerMap.setView([lat,lng],18,{animate:true});
      setOwnerPin({lat,lng},"Device GPS",true);
      if(state.ownerAccuracyCircle)state.ownerMap.removeLayer(state.ownerAccuracyCircle);
      state.ownerAccuracyCircle=window.L.circle([lat,lng],{radius:Math.max(accuracy||0,1),color:"#0f766e",weight:1,fillColor:"#14b8a6",fillOpacity:.12}).addTo(state.ownerMap);
      const accuracyText=Number.isFinite(accuracy)?"±"+Math.round(accuracy)+" m":"accuracy unavailable";
      updateOwnerStatus("GPS fix received ("+accuracyText+"). Review the pin at street level and drag it to the property entrance if needed.");
      try{
        const response=await fetch("https://photon.komoot.io/reverse?lat="+encodeURIComponent(lat)+"&lon="+encodeURIComponent(lng)+"&lang=en",{headers:{Accept:"application/json"}});
        if(response.ok){
          const payload=await response.json(),feature=payload&&payload.features&&payload.features[0];
          const label=photonLabel(feature&&feature.properties);
          if(label){const input=$("gdrOwnerMapSearch");if(input)input.value=label;state.ownerSelection.label=label;}
        }
      }catch(error){console.info("Reverse geocoding unavailable; exact GPS coordinates are retained.",error);}
    },error=>{
      const message=error.code===1?"Location permission denied. Allow location access in browser settings, or search/place the pin manually.":error.code===3?"GPS request timed out. Move outdoors or near a window and try again.":"Unable to get a GPS fix. Check device location services and try again.";
      updateOwnerStatus(message);
    },{enableHighAccuracy:true,timeout:25000,maximumAge:0});
  }

  // Dedicated owner Nearby Properties map. This is intentionally independent
  // from the renter's Find Homes/Explore map and never requests browser GPS.
  const ownerNearby={map:null,layer:null,circle:null,ownerMarker:null,tileLayer:null,tileFallback:false,hiddenSiblings:[],overlay:null,owner:null,properties:[],inventory:[],selected:null,radius:5,visible:[],loading:false,searchCenter:null,searchLabel:""};
  const OWNER_NEARBY_FIELDS="id,owner_id,title,name,location,address,latitude,longitude,rent,status,verification_status,bhk,furnishing,image_url,listing_type,available_beds,total_beds";
  function ownerNearbyAvailable(p){
    const type=String(p.listing_type||"home").toLowerCase();
    if(type==="pg"||type==="hostel")return Number(p.available_beds||0)>0;
    return String(p.status||"").toLowerCase()!=="occupied"&&String(p.status||"").toLowerCase()!=="rejected";
  }
  function ownerNearbyOverlay(){
    if(ownerNearby.overlay)return ownerNearby.overlay;
    const el=document.createElement("section");el.id="gdrOwnerNearbyExperience";el.className="gdr-owner-nearby";el.hidden=true;
    el.innerHTML='<div class="gdr-on-shell"><header class="gdr-on-header"><div class="gdr-on-heading"><div class="gdr-on-brand" aria-hidden="true"><img src="/assets/gdr-mark.svg" alt=""><span>GharDekho</span><small>OWNER SPACE</small></div><span class="gdr-on-kicker">NEARBY HOMES · SOCIETY VIEW</span><h1>Homes around your property</h1><p id="gdrOnSubheading">See your property and nearby rental homes in one place.</p></div><button type="button" class="gdr-on-back" id="gdrOnBack">← Owner Dashboard</button></header><div class="gdr-on-toolbar"><label class="gdr-on-select-wrap"><span>MY PROPERTY</span><select id="gdrOnPropertySelect" aria-label="Select your property"></select></label><div class="gdr-on-count"><strong id="gdrOnCount">—</strong><span>nearby homes</span></div><label class="gdr-on-radius"><span>SEARCH RADIUS</span><select id="gdrOnRadius"><option value="1">1 KM</option><option value="2">2 KM</option><option value="3">3 KM</option><option value="5" selected>5 KM</option><option value="10">10 KM</option></select></label><button type="button" class="gdr-on-control" id="gdrOnRecenter">⌂ My Property</button><button type="button" class="gdr-on-control gdr-on-refresh" id="gdrOnRefresh">↻ Refresh</button></div><form class="gdr-on-area-search" id="gdrOnAreaSearchForm"><label for="gdrOnAreaSearch">SEARCH ANY AREA IN BHOPAL / INDIA</label><div><input id="gdrOnAreaSearch" type="search" placeholder="Try Patel Nagar, Bhopal or PIN code" autocomplete="off"><button type="submit" id="gdrOnAreaSearchBtn">Search area →</button></div><small id="gdrOnAreaSearchHint">Search an area to find all nearby GharDekho homes, even when it is not your own property location.</small></form><section class="gdr-on-society-panel"><div class="gdr-on-society-top"><div><span class="gdr-on-kicker">3D NEIGHBOURHOOD</span><h2>Your home & nearby society</h2><p>Real GharDekho listings placed around your selected property.</p></div><span class="gdr-on-radius-chip" id="gdrOnMapChip">WITHIN 5 KM</span></div><div class="gdr-on-map-loading" id="gdrOnLoading"><span class="gdr-on-spinner"></span><b>Finding nearby homes…</b><small>Checking real property locations</small></div><div class="gdr-on-society-scene" id="gdrOnSocietyScene" aria-live="polite"></div><div class="gdr-on-empty" id="gdrOnEmpty" hidden></div><article class="gdr-on-preview" id="gdrOnPreview" hidden></article></section><p class="gdr-on-footnote" id="gdrOnStatus" aria-live="polite">Loading your property locations…</p></div>';
    document.body.appendChild(el);ownerNearby.overlay=el;
    $("gdrOnBack").addEventListener("click",closeOwnerNearbyMap);
    $("gdrOnPropertySelect").addEventListener("change",()=>{const p=ownerNearby.properties.find(x=>String(x.id)===$("gdrOnPropertySelect").value);if(p){ownerNearby.selected=p;ownerNearby.searchCenter=null;ownerNearby.searchLabel="";const input=$("gdrOnAreaSearch");if(input)input.value="";focusOwnerNearbyProperty();loadOwnerNearbyHomes();}});
    $("gdrOnAreaSearchForm").addEventListener("submit",async e=>{e.preventDefault();await searchOwnerNearbyArea();});
    $("gdrOnRadius").addEventListener("change",()=>{ownerNearby.radius=Math.max(1,Math.min(10,Number($("gdrOnRadius").value)||5));$("gdrOnMapChip").textContent=ownerNearby.radius+" KM radius";loadOwnerNearbyHomes();});
    $("gdrOnRecenter").addEventListener("click",focusOwnerNearbyProperty);
    $("gdrOnRefresh").addEventListener("click",loadOwnerNearbyHomes);
    return el;
  }
  function ownerNearbyStatus(message){const n=$("gdrOnStatus");if(n)n.textContent=message||"";}
  function ownerNearbyLoading(on){const n=$("gdrOnLoading");if(n)n.hidden=!on;}
  function hideOwnerNearbyBackground(){
    if(ownerNearby.hiddenSiblings.length)return;
    ownerNearby.hiddenSiblings=Array.from(document.body.children).filter(el=>el!==ownerNearby.overlay).map(el=>({
      el,display:el.style.getPropertyValue("display"),priority:el.style.getPropertyPriority("display")
    }));
    ownerNearby.hiddenSiblings.forEach(item=>item.el.style.setProperty("display","none","important"));
  }
  function restoreOwnerNearbyBackground(){
    ownerNearby.hiddenSiblings.forEach(item=>{
      if(item.display)item.el.style.setProperty("display",item.display,item.priority);
      else item.el.style.removeProperty("display");
    });
    ownerNearby.hiddenSiblings=[];
  }
  function closeOwnerNearbyMap(){
    if(ownerNearby.overlay)ownerNearby.overlay.hidden=true;
    document.body.classList.remove("gdr-owner-nearby-open");
    restoreOwnerNearbyBackground();
  }
  function ownerNearbyHouseIcon(p){
    const rent=Number(p.rent||0),short=rent>=100000?"₹"+(rent/100000).toFixed(1)+"L":rent>=1000?"₹"+(rent/1000).toFixed(rent%1000?1:0)+"k":money(rent);
    return window.L.divIcon({className:"gdr-on-house-wrap",html:'<span class="gdr-on-house-marker"><i>⌂</i><b>'+short+'</b></span>',iconSize:[86,48],iconAnchor:[43,42]});
  }
  function ownerNearbyPreview(p){
    const n=$("gdrOnPreview");if(!n)return;n.replaceChildren();
    const image=document.createElement("img");image.className="gdr-on-preview-image";image.alt="Property photograph";image.loading="lazy";image.src=safeImage(p.image_url)||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='220'%3E%3Crect width='100%25' height='100%25' fill='%23eaf3ef'/%3E%3Ctext x='50%25' y='52%25' text-anchor='middle' fill='%23758b82' font-size='44'%3E%E2%8C%82%3C/text%3E%3C/svg%3E";
    const body=node("div","gdr-on-preview-body"),top=node("div","gdr-on-preview-top"),title=node("h3","",p.title||p.name||"Rental home"),close=node("button","gdr-on-preview-close","×");close.type="button";close.setAttribute("aria-label","Close property preview");close.onclick=()=>{n.hidden=true;n.replaceChildren();};top.append(title,close);
    body.append(top,node("strong","gdr-on-preview-rent",money(p.rent)+" / month"),node("p","gdr-on-preview-address",[p.location,p.address].filter(Boolean).join(" · ")||"Address not available"),node("p","gdr-on-preview-meta",[p.bhk?p.bhk+" BHK":"",p.furnishing||"",String(p.listing_type||"Home").toUpperCase(),p.gdrIsOwnerProperty?"Your property":Number.isFinite(p.gdrDistanceKm)?(p.gdrDistanceKm<1?Math.round(p.gdrDistanceKm*1000)+" m away":p.gdrDistanceKm.toFixed(2)+" km away"):""].filter(Boolean).join(" · ")),node("span",p.gdrIsOwnerProperty?"gdr-on-preview-status gdr-on-preview-own-status":"gdr-on-preview-status",p.gdrIsOwnerProperty?"MY PROPERTY":String(p.status||"Available").replaceAll("_"," ")));
    const action=node("button","gdr-on-details","View Details →");action.type="button";action.onclick=()=>{if(typeof window.openPropertyDetails==="function")window.openPropertyDetails(p.id);else if(typeof window.openPropertyDetailsModal==="function")window.openPropertyDetailsModal(p.id);else ownerNearbyStatus("Property details action is not available on this page.");};
    body.append(action);n.append(image,body);n.hidden=false;
  }
  function ownerNearbyBuilding(){
    const art=node("span","gdr-on-building","");art.setAttribute("aria-hidden","true");
    art.append(node("span","gdr-on-building-roof",""),node("span","gdr-on-building-wall",""),node("span","gdr-on-building-door",""),node("span","gdr-on-building-window gdr-on-window-one",""),node("span","gdr-on-building-window gdr-on-window-two",""),node("span","gdr-on-building-window gdr-on-window-three",""));
    return art;
  }
  function ownerNearbyHomeCard(p,isOwn){
    const card=node("button",isOwn?"gdr-on-home-card gdr-on-home-card-own":"gdr-on-home-card");
    card.type="button";card.setAttribute("aria-label",(p.title||p.name||"Property")+" · "+(isOwn?"Your property":(Number(p.gdrDistanceKm)||0).toFixed(2)+" kilometres away"));
    const art=node("span","gdr-on-home-art");art.append(ownerNearbyBuilding(),node("span","gdr-on-home-garden",""));const pricePin=node("span","gdr-on-home-map-pin",money(p.rent));pricePin.setAttribute("aria-label","Monthly rent "+money(p.rent));art.append(pricePin);
    const top=node("span","gdr-on-home-top"),kind=node("span","gdr-on-home-kind",isOwn?"MY HOME":String(p.listing_type||"HOME").replaceAll("_"," ").toUpperCase());
    const distance=node("span","gdr-on-home-distance",isOwn?"OWNER PROPERTY":(p.gdrDistanceKm<1?Math.round(p.gdrDistanceKm*1000)+" m away":p.gdrDistanceKm.toFixed(2)+" km away"));
    top.append(kind,distance);
    const title=node("strong","gdr-on-home-title",p.title||p.name||"Rental home");
    const rent=node("span","gdr-on-home-rent",money(p.rent)+" / month");
    const address=node("span","gdr-on-home-address",[p.location,p.address].filter(Boolean).join(" · ")||"Address not available");
    const meta=node("span","gdr-on-home-meta",[p.bhk?p.bhk+" BHK":"",p.furnishing||"",String(p.status||"Available").replaceAll("_"," ")].filter(Boolean).join(" · "));
    card.append(art,top,title,rent,address,meta);
    card.addEventListener("click",()=>ownerNearbyPreview(isOwn?{...p,gdrDistanceKm:0,gdrIsOwnerProperty:true}:p));
    return card;
  }
  function renderOwnerNearbyHomes(rows,center){
    const scene=$("gdrOnSocietyScene");if(!scene)return;
    scene.replaceChildren();
    const own=ownerNearby.selected;
    if(own&&validPoint(own.latitude,own.longitude)&&distanceKm(center,[Number(own.latitude),Number(own.longitude)])<=ownerNearby.radius)scene.append(ownerNearbyHomeCard(own,true));
    rows.forEach(p=>scene.append(ownerNearbyHomeCard(p,false)));
    ownerNearby.visible=rows;
    const count=$("gdrOnCount");if(count)count.textContent=String(rows.length);
    const empty=$("gdrOnEmpty");
    if(empty){
      empty.hidden=rows.length>0;
      empty.textContent=rows.length?"":"No other GharDekho listings with saved coordinates were found within "+ownerNearby.radius+" KM. Your property is shown above. Increase the radius to check a wider area.";
    }
    if(!rows.length){const preview=$("gdrOnPreview");if(preview)preview.hidden=true;}
    ownerNearbyStatus(rows.length+" nearby listings found within "+ownerNearby.radius+" KM. Showing your property and "+rows.length+" nearby homes.");
  }
  function focusOwnerNearbyProperty(){
    const p=ownerNearby.selected;if(!p)return;
    ownerNearby.searchCenter=null;ownerNearby.searchLabel="";
    const input=$("gdrOnAreaSearch");if(input)input.value="";
    const hint=$("gdrOnAreaSearchHint");if(hint)hint.textContent="Search an area to find all nearby GharDekho homes, even when it is not your own property location.";
    const sub=$("gdrOnSubheading");if(sub)sub.textContent=(p.location||p.address||p.title||"Your property")+" · Search within "+ownerNearby.radius+" KM";
    const card=$("gdrOnSocietyScene")?.querySelector(".gdr-on-home-card-own");
    card?.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});
    ownerNearbyPreview({...p,gdrDistanceKm:0,gdrIsOwnerProperty:true});
    ownerNearbyStatus("Your property is highlighted in the society view.");
    loadOwnerNearbyHomes();
  }
  async function searchOwnerNearbyArea(){
    const input=$("gdrOnAreaSearch"),query=String(input&&input.value||"").trim(),button=$("gdrOnAreaSearchBtn");
    if(!query){ownerNearbyStatus("Enter a locality, city or six-digit PIN code, for example Patel Nagar, Bhopal.");return;}
    if(button){button.disabled=true;button.textContent="Locating…";}
    try{
      ownerNearbyStatus("Finding "+query+" on the map…");
      const point=await resolveMapQuery(query);
      ownerNearby.searchCenter=[point.lat,point.lng];ownerNearby.searchLabel=point.label||query;
      const hint=$("gdrOnAreaSearchHint");if(hint)hint.textContent="Showing homes around "+ownerNearby.searchLabel+". Choose My Property to return to your saved property location.";
      const sub=$("gdrOnSubheading");if(sub)sub.textContent="Homes around "+ownerNearby.searchLabel;
      await loadOwnerNearbyHomes();
    }catch(error){console.warn("Owner Nearby area search failed:",error);ownerNearbyStatus(error.message||"This area could not be located. Try a nearby locality or PIN code.");}
    finally{if(button){button.disabled=false;button.textContent="Search area →";}}
  }
  async function loadOwnerNearbyHomes(){
    if(ownerNearby.loading||!ownerNearby.selected)return;
    const fallbackCenter=[asNumber(ownerNearby.selected.latitude),asNumber(ownerNearby.selected.longitude)];
    const center=ownerNearby.searchCenter||fallbackCenter;
    if(center.some(v=>v===null)){ownerNearbyStatus("This property is missing exact latitude/longitude. Please update its location pin first.");ownerNearbyLoading(false);return;}
    ownerNearby.loading=true;ownerNearbyLoading(true);ownerNearbyStatus("Searching real listings within "+ownerNearby.radius+" KM of "+(ownerNearby.searchLabel||"your selected property")+"…");
    try{
      const client=db();if(!client)throw new Error("Account service is not ready. Refresh and sign in again.");
      const bounds=radiusBounds(center),sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
      let inventory=[],source="viewport";
      const viewport=await client.rpc("get_map_properties_in_bounds",{p_south:sw.lat,p_west:sw.lng,p_north:ne.lat,p_east:ne.lng,p_limit:200});
      if(!viewport.error){
        inventory=(Array.isArray(viewport.data)?viewport.data:[]);
      }else{
        console.warn("Owner Nearby viewport lookup unavailable; using public inventory fallback:",viewport.error);
        source="public inventory";
        const fallback=await client.rpc("get_public_properties");
        if(fallback.error)throw fallback.error;
        inventory=Array.isArray(fallback.data)?fallback.data:[];
      }
      const selectedId=String(ownerNearby.selected.id);
      const rows=inventory.map(p=>({...p,name:p.name||p.title,address:p.address||p.location}))
        .filter(p=>String(p.id)!==selectedId&&validPoint(p.latitude,p.longitude))
        .map(p=>({...p,gdrDistanceKm:distanceKm(center,[Number(p.latitude),Number(p.longitude)])}))
        .filter(p=>Number.isFinite(p.gdrDistanceKm)&&p.gdrDistanceKm<=ownerNearby.radius)
        .sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm);
      renderOwnerNearbyHomes(rows,center);
      const sub=$("gdrOnSubheading");if(sub)sub.textContent="Homes around "+(ownerNearby.searchLabel||ownerNearby.selected.location||ownerNearby.selected.address||"your property");
      if(source==="public inventory")ownerNearbyStatus(rows.length+" nearby listings found. Viewport search was unavailable; results use the existing public inventory.");
    }catch(error){console.error("Owner Nearby Properties query failed:",error);ownerNearbyStatus(error.message||"Nearby properties could not be loaded. Check your connection and permissions.");const empty=$("gdrOnEmpty");if(empty){empty.hidden=false;empty.textContent="Could not load nearby homes. Please refresh and try again.";}}
    finally{ownerNearby.loading=false;ownerNearbyLoading(false);}
  }
  async function openOwnerNearbyMap(){
    const overlay=ownerNearbyOverlay();overlay.hidden=false;document.body.classList.add("gdr-owner-nearby-open");hideOwnerNearbyBackground();overlay.scrollTop=0;window.scrollTo(0,0);
    ownerNearby.radius=5;$("gdrOnRadius").value="5";$("gdrOnMapChip").textContent="5 KM radius";$("gdrOnCount").textContent="…";ownerNearbyLoading(true);
    try{
      const client=db();if(!client)throw new Error("Account service is not ready. Refresh and sign in again.");
      const auth=await client.auth.getUser();if(auth.error||!auth.data?.user)throw new Error("Please sign in again to open your owner workspace.");
      const profile=await client.from("owners").select("id,name").eq("user_id",auth.data.user.id).maybeSingle();if(profile.error||!profile.data)throw new Error("Your owner profile could not be loaded.");
      ownerNearby.owner=profile.data;
      const own=await client.from("properties").select(OWNER_NEARBY_FIELDS).eq("owner_id",profile.data.id).order("created_at",{ascending:false});if(own.error)throw own.error;
      ownerNearby.properties=(Array.isArray(own.data)?own.data:[]).filter(p=>validPoint(p.latitude,p.longitude));
      if(!ownerNearby.properties.length)throw new Error("No property with saved map coordinates was found. Edit your property and save its exact location pin first.");
      const selector=$("gdrOnPropertySelect");selector.replaceChildren();
      ownerNearby.properties.forEach(p=>{const opt=document.createElement("option");opt.value=p.id;opt.textContent=(p.title||p.name||"My property")+" · "+(p.location||p.address||"Location");selector.append(opt);});
      ownerNearby.selected=ownerNearby.properties[0];selector.value=ownerNearby.selected.id;
      const sub=$("gdrOnSubheading");if(sub)sub.textContent=(ownerNearby.selected.location||ownerNearby.selected.address||ownerNearby.selected.title||"Your property")+" · Search within 5 KM";
      await loadOwnerNearbyHomes();
    }catch(error){console.error("Owner Nearby map failed:",error);ownerNearbyLoading(false);ownerNearbyStatus(error.message||"Nearby map could not be opened.");const empty=$("gdrOnEmpty");if(empty){empty.hidden=false;empty.textContent=error.message||"Nearby map could not be opened.";}}
  }

  function bind(){
    $("renterExploreMapBtn")?.addEventListener("click",openRenterMap);$("gdrMapBackBtn")?.addEventListener("click",closeRenterMap);
    $("gdrMapSearchAreaBtn")?.addEventListener("click",()=>searchRenterArea());$("gdrMapLocateBtn")?.addEventListener("click",locateRenter);
    const radiusInput=$("gdrMapRadius");if(radiusInput){radiusInput.min="0.5";radiusInput.max="10";radiusInput.step="0.5";radiusInput.addEventListener("input",e=>{state.radiusKm=Math.max(.5,Math.min(10,Number(e.target.value)||5));const label=$("gdrMapRadiusValue");if(label)label.textContent=state.radiusKm<1?Math.round(state.radiusKm*1000)+" m":state.radiusKm+" km";});}
    $("gdrMapRadius")?.addEventListener("change",()=>{if(state.renterMap)searchRenterArea();});
    $("gdrMapListToggle")?.addEventListener("click",()=>{const l=$("gdrMapLayout"),panel=$("gdrMapListPanel");if(!l)return;const on=!l.classList.contains("gdr-list-mode");l.classList.toggle("gdr-list-mode",on);if(panel)panel.hidden=!on;$("gdrMapListToggle").setAttribute("aria-pressed",String(on));$("gdrMapViewToggle").setAttribute("aria-pressed",String(!on));if(state.renterMap)requestAnimationFrame(()=>state.renterMap.invalidateSize());});
    $("gdrMapViewToggle")?.addEventListener("click",()=>{const l=$("gdrMapLayout"),panel=$("gdrMapListPanel");if(!l)return;l.classList.remove("gdr-list-mode");if(panel)panel.hidden=true;$("gdrMapListToggle").setAttribute("aria-pressed","false");$("gdrMapViewToggle").setAttribute("aria-pressed","true");if(state.renterMap)requestAnimationFrame(()=>state.renterMap.invalidateSize());});
    $("gdrOpenOwnerMapPickerBtn")?.addEventListener("click",openOwnerMapPicker);$("gdrCloseOwnerMapPickerBtn")?.addEventListener("click",closeOwnerMapPicker);$("gdrConfirmOwnerMapLocation")?.addEventListener("click",confirmOwnerMapLocation);
    setupPlaceSearch("gdrMapPlaceSearch","gdrMapPlaceSuggestions",r=>{if(state.renterMap){setRenterPin(r,r.label);state.renterMap.setView(state.searchCenter,14,{animate:false});searchRenterArea();}},"renter");
    $("gdrMapPlaceSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchTypedMapLocation();}});
    $("gdrMapPlaceSearch")?.addEventListener("change",()=>{state.resolvedQuery="";});
    setupPlaceSearch("gdrOwnerMapSearch","gdrOwnerMapSuggestions",r=>{if(state.ownerMap){state.ownerMap.flyTo([r.lat,r.lng],16,{duration:.6});setOwnerPin({lat:r.lat,lng:r.lng},r.label,false);updateOwnerStatus("Approximate locality found. Zoom in and tap the exact building/entrance or drag the pin; search results are not exact property coordinates.");}},"owner");
  }
  function loadOwnerRenterEditor(){
    if(!document.querySelector("script[data-gdr-owner-renter-editor]")){
      const script=document.createElement("script");
      script.src="/assets/gdr-owner-renter-editor.js";
      script.defer=true;
      script.dataset.gdrOwnerRenterEditor="true";
      script.onerror=()=>console.warn("Owner renter editor could not be loaded.");
      document.head.appendChild(script);
    }
    if(!document.querySelector("script[data-gdr-owner-renter-page]")){
      const pageScript=document.createElement("script");
      pageScript.src="/assets/gdr-owner-renter-page.js";
      pageScript.defer=true;
      pageScript.dataset.gdrOwnerRenterPage="true";
      pageScript.onerror=()=>console.warn("Dedicated renter profile page could not be loaded.");
      document.head.appendChild(pageScript);
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{bind();loadOwnerRenterEditor();},{once:true});
  else {bind();loadOwnerRenterEditor();}
  window.GDRMapExperience={openRenterMap,closeRenterMap,openOwnerMapPicker,searchRenterArea,searchTypedMapLocation,resolveMapQuery,setRenterPin,searchAtCoordinates,usePreciseOwnerLocation,openOwnerNearbyMap,closeOwnerNearbyMap,applyRenterFilters,setRenterSearchPreferences,setRenterRadius,getRenterVisibleProperties:()=>state.visible.slice()};
})();
