
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const state = {
    renterMap:null, ownerMap:null, renterLayer:null, radiusCircle:null,
    ownerMarker:null, ownerSelection:null, ownerPinManuallyConfirmed:false, renterPin:null, inventory:[], boundsRows:[], visible:[],
    searchCenter:null, radiusKm:5, viewportRpc:null, loadedOnce:false, resolvedQuery:"",
    geolocationAttempted:false, searchTimer:null, searchController:null,
    ownerSearchTimer:null, ownerSearchController:null
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
  function makeLayer(map){return window.L.markerClusterGroup?window.L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,maxClusterRadius:48}).addTo(map):window.L.layerGroup().addTo(map);}
  async function fetchInventory(){const client=db();if(!client)throw new Error("Property service is still loading.");const r=await client.rpc("get_public_properties");if(r.error)throw r.error;state.inventory=(Array.isArray(r.data)?r.data:[]).filter(p=>validPoint(p.latitude,p.longitude));state.loadedOnce=true;return state.inventory;}
  async function fetchBounds(bounds){
    const client=db();if(!client)throw new Error("Property service is not ready.");
    const sw=bounds.getSouthWest(),ne=bounds.getNorthEast();
    if(state.viewportRpc!==false){
      const r=await client.rpc("get_map_properties_in_bounds",{p_south:sw.lat,p_west:sw.lng,p_north:ne.lat,p_east:ne.lng,p_limit:200});
      if(!r.error){state.viewportRpc=true;return (Array.isArray(r.data)?r.data:[]).filter(p=>validPoint(p.latitude,p.longitude));}
      state.viewportRpc=false;console.info("Viewport RPC not installed yet; using existing public inventory as a compatibility fallback.");
    }
    if(!state.loadedOnce)await fetchInventory();
    return state.inventory.filter(p=>bounds.contains([Number(p.latitude),Number(p.longitude)]));
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
    state.renterPin=window.L.marker(state.searchCenter,{icon,draggable:true,zIndexOffset:1000}).addTo(state.renterMap);
    state.renterPin.on("dragend",async()=>{const p=state.renterPin.getLatLng();state.searchCenter=[p.lat,p.lng];state.resolvedQuery=await reverseGeocodeRenter(p.lat,p.lng);setStatus("Pin moved to "+(state.resolvedQuery||p.lat.toFixed(5)+", "+p.lng.toFixed(5))+". Tap Search this area to find homes.");});
    setStatus((state.resolvedQuery||"Selected map location")+" · Pin "+state.searchCenter[0].toFixed(5)+", "+state.searchCenter[1].toFixed(5)+". Drag the pin or tap the map, then Search this area.");
  }
  function markerIcon(p){
    const rent=Number(p.rent||0),short=rent>=100000?"₹"+(rent/100000).toFixed(1)+"L":rent>=1000?"₹"+(rent/1000).toFixed(rent%1000?1:0)+"k":money(rent);
    const pending=p.status==="pending"||p.verification_status==="pending";
    return window.L.divIcon({className:"gdr-price-marker-wrap",html:'<span class="gdr-price-marker'+(pending?" gdr-marker-pending":"")+'">'+short+'</span>',iconSize:[72,34],iconAnchor:[36,17]});
  }
  function clearPreview(){const p=$("gdrMapPreview");if(p){p.hidden=true;p.replaceChildren();}}
  function showPreview(p){
    const preview=$("gdrMapPreview");if(!preview)return;preview.replaceChildren();
    const main=node("div","gdr-map-preview-main"),img=document.createElement("img");
    img.alt="Property photograph";img.loading="lazy";img.src=safeImage(p.image_url)||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23e9f1ee'/%3E%3C/svg%3E";
    const copy=node("div","");
    copy.append(node("h4","",p.title||p.name||"Rental property"),node("p","",[p.location,p.address].filter(Boolean).join(", ")||"Location details available"),node("p","gdr-map-rent",money(p.rent)+" / month"));
    const meta=[p.bhk?p.bhk+" BHK":"",p.furnishing||"",p.listing_type&&p.listing_type!=="home"?p.listing_type.toUpperCase():"Home",Number.isFinite(p.gdrDistanceKm)?p.gdrDistanceKm.toFixed(1)+" km away":""].filter(Boolean).join(" · ");
    copy.append(node("p","",meta),node("p","",statusOf(p)+" · Owner contact is shared only through the approved visit flow."));
    main.append(img,copy);
    const actions=node("div","gdr-map-preview-actions"),details=node("button","gdr-map-details-btn","View details"),close=node("button","gdr-map-dismiss-btn","Close");
    details.type="button";details.addEventListener("click",()=>{if(typeof window.openPropertyDetails==="function")window.openPropertyDetails(p.id);else setStatus("Open this property from the property results to see full details.");});
    close.type="button";close.addEventListener("click",clearPreview);actions.append(details,close);preview.append(main,actions);preview.hidden=false;
  }
  function renderList(rows){
    const panel=$("gdrMapListPanel");if(!panel)return;panel.replaceChildren();
    if(!rows.length){panel.append(node("div","gdr-map-empty","No properties found in this area. Move the map, change the radius or search another locality."));return;}
    rows.forEach(p=>{
      const b=node("button","gdr-map-list-card","");b.type="button";
      const img=document.createElement("img");img.loading="lazy";img.alt="Property";img.src=safeImage(p.image_url)||"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='160'%3E%3Crect width='100%25' height='100%25' fill='%23e9f1ee'/%3E%3C/svg%3E";
      const copy=node("span","");copy.append(node("strong","",p.title||p.name||"Rental property"),node("small","",[p.location,p.bhk?p.bhk+" BHK":"",p.furnishing||"",Number.isFinite(p.gdrDistanceKm)?(p.gdrDistanceKm<1?Math.round(p.gdrDistanceKm*1000)+" m away":p.gdrDistanceKm.toFixed(1)+" km away"):""].filter(Boolean).join(" · ")),node("b","",money(p.rent)+" / month"));
      b.append(img,copy);b.addEventListener("click",()=>{state.renterMap.flyTo([Number(p.latitude),Number(p.longitude)],16,{duration:.55});showPreview(p);});panel.append(b);
    });
  }
  function renderMarkers(rows,center){
    if(!state.renterMap||!state.renterLayer)return;state.renterLayer.clearLayers();
    if(state.radiusCircle)state.renterMap.removeLayer(state.radiusCircle);
    state.radiusCircle=window.L.circle(center,{radius:state.radiusKm*1000,color:"#176b63",weight:1.5,opacity:.65,fillColor:"#176b63",fillOpacity:.055,dashArray:"5 7"}).addTo(state.renterMap);
    rows.forEach(p=>{const marker=window.L.marker([Number(p.latitude),Number(p.longitude)],{icon:markerIcon(p)});marker.on("click",()=>showPreview(p));state.renterLayer.addLayer(marker);});
    state.visible=rows;renderList(rows);const count=$("gdrMapCount");if(count)count.textContent=rows.length+(rows.length===1?" home":" homes");if(!rows.length)clearPreview();
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
    if(!query){await searchRenterArea();return;}
    const button=$("gdrMapSearchAreaBtn");if(button){button.disabled=true;button.textContent="Locating…";}
    try{
      const point=await resolveMapQuery(query);
      setRenterPin(point,point.label||query);
      state.renterMap.setView(state.searchCenter,14,{animate:false});
      await searchRenterArea();
    }catch(error){console.warn("GDR map location search failed:",error);setStatus(error.message||"This location could not be found. Try another city, locality or PIN code.");}
    finally{if(button){button.disabled=false;button.textContent="Search this area";}}
  }
  async function searchRenterArea(){
    if(!state.renterMap)return;const button=$("gdrMapSearchAreaBtn");if(button){button.disabled=true;button.textContent="Searching…";}
    setStatus("Searching homes within "+state.radiusKm+" km of the selected location…");
    try{
      if(!state.searchCenter){const c=state.renterMap.getCenter();setRenterPin(c,"");}
      state.boundsRows=await fetchBounds(radiusBounds(state.searchCenter));
      const rows=applyRadius(state.boundsRows,state.searchCenter);renderMarkers(rows,state.searchCenter);
      setStatus(rows.length+" properties within "+state.radiusKm+" km of "+(state.resolvedQuery||"the selected map centre")+".");
    }catch(error){console.error("GDR map search failed:",error);setStatus("Properties could not be loaded. Please try again.");}
    finally{if(button){button.disabled=false;button.textContent="Search this area";}}
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
    state.renterLayer=makeLayer(state.renterMap);state.renterMap.setView(INDIA_CENTER,5);state.renterMap.on("click",e=>setRenterPin(e.latlng,""));
    state.renterMap.on("moveend",()=>{const s=$("gdrMapStatus");if(s&&state.visible.length&&state.searchCenter)s.textContent="Pin selected at "+state.searchCenter[0].toFixed(5)+", "+state.searchCenter[1].toFixed(5)+". Tap Search this area to refresh homes.";});
  }
  async function openRenterMap(){
    const dashboard=$("renterDashboard"),panel=$("gdrExploreMapPanel");if(!dashboard||!panel)return;
    dashboard.classList.add("gdr-map-mode");panel.hidden=false;
    try{
      await ensureLeaflet();initRenterMap();requestAnimationFrame(()=>state.renterMap&&state.renterMap.invalidateSize());
      if(!state.renterMap._gdrInitialView){state.renterMap.setView(INDIA_CENTER,5);state.renterMap._gdrInitialView=true;}
      const input=$("gdrMapPlaceSearch"),query=String(input&&input.value||"").trim();
      if(query)await searchTypedMapLocation();
      else setStatus("Search a city, locality or PIN code, tap anywhere on the map to drop a pin, or choose My location. Drag the pin to adjust, then tap Search this area.");
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
  const ownerNearby={map:null,layer:null,circle:null,ownerMarker:null,tileLayer:null,tileFallback:false,hiddenSiblings:[],overlay:null,owner:null,properties:[],inventory:[],selected:null,radius:5,visible:[],loading:false};
  const OWNER_NEARBY_FIELDS="id,owner_id,title,name,location,address,latitude,longitude,rent,status,verification_status,bhk,furnishing,image_url,listing_type,available_beds,total_beds";
  function ownerNearbyAvailable(p){
    const type=String(p.listing_type||"home").toLowerCase();
    if(type==="pg"||type==="hostel")return Number(p.available_beds||0)>0;
    return String(p.status||"").toLowerCase()!=="occupied"&&String(p.status||"").toLowerCase()!=="rejected";
  }
  function ownerNearbyOverlay(){
    if(ownerNearby.overlay)return ownerNearby.overlay;
    const el=document.createElement("section");el.id="gdrOwnerNearbyExperience";el.className="gdr-owner-nearby";el.hidden=true;
    el.innerHTML='<div class="gdr-on-shell"><header class="gdr-on-header"><div class="gdr-on-heading"><div class="gdr-on-brand"><img src="/assets/gdr-mark.svg" alt="GharDekho"><span>GharDekho</span><small>OWNER MAP</small></div><span class="gdr-on-kicker">OWNER WORKSPACE · NEARBY DISCOVERY</span><h1>Nearby Properties</h1><p id="gdrOnSubheading">Discover available rental homes around your property.</p></div><button type="button" class="gdr-on-back" id="gdrOnBack">← Owner Dashboard</button></header><div class="gdr-on-toolbar"><label class="gdr-on-select-wrap"><span>MY PROPERTY</span><select id="gdrOnPropertySelect" aria-label="Select your property"></select></label><div class="gdr-on-count"><strong id="gdrOnCount">—</strong><span>nearby homes</span></div><label class="gdr-on-radius"><span>SEARCH RADIUS</span><select id="gdrOnRadius"><option value="1">1 KM</option><option value="2">2 KM</option><option value="3">3 KM</option><option value="5" selected>5 KM</option><option value="10">10 KM</option></select></label><button type="button" class="gdr-on-control" id="gdrOnRecenter">◎ My Property</button><button type="button" class="gdr-on-control gdr-on-refresh" id="gdrOnRefresh">↻ Refresh</button></div><div class="gdr-on-map-wrap"><div id="gdrOwnerNearbyMapCanvas" role="application" aria-label="Nearby rental properties map"></div><div class="gdr-on-map-chip" id="gdrOnMapChip">5 KM radius</div><div class="gdr-on-map-loading" id="gdrOnLoading"><span class="gdr-on-spinner"></span><b>Finding nearby homes…</b><small>Checking real property locations</small></div><article class="gdr-on-preview" id="gdrOnPreview" hidden></article><div class="gdr-on-empty" id="gdrOnEmpty" hidden></div></div><p class="gdr-on-footnote" id="gdrOnStatus" aria-live="polite">Loading your property locations…</p></div>';
    document.body.appendChild(el);ownerNearby.overlay=el;
    $("gdrOnBack").addEventListener("click",closeOwnerNearbyMap);
    $("gdrOnPropertySelect").addEventListener("change",()=>{const p=ownerNearby.properties.find(x=>String(x.id)===$("gdrOnPropertySelect").value);if(p){ownerNearby.selected=p;focusOwnerNearbyProperty();loadOwnerNearbyHomes();}});
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
  function ownerNearbyMyHomeIcon(){
    return window.L.divIcon({className:"gdr-on-myhome-wrap",html:'<span class="gdr-on-myhome-marker"><i>⌂</i><b>MY HOME</b></span>',iconSize:[112,48],iconAnchor:[56,42]});
  }
  function renderOwnerNearbyHomes(rows,center){
    if(!ownerNearby.map||!ownerNearby.layer)return;
    ownerNearby.layer.clearLayers();if(ownerNearby.circle)ownerNearby.map.removeLayer(ownerNearby.circle);
    if(ownerNearby.ownerMarker){ownerNearby.map.removeLayer(ownerNearby.ownerMarker);ownerNearby.ownerMarker=null;}
    ownerNearby.circle=window.L.circle(center,{radius:ownerNearby.radius*1000,color:"#168477",weight:2,opacity:.78,fillColor:"#80cbb8",fillOpacity:.12,dashArray:"7 7"}).addTo(ownerNearby.map);
    rows.forEach(p=>{const m=window.L.marker([Number(p.latitude),Number(p.longitude)],{icon:ownerNearbyHouseIcon(p),riseOnHover:true});m.on("click",()=>ownerNearbyPreview(p));ownerNearby.layer.addLayer(m);});
    const own=ownerNearby.selected;
    if(own&&validPoint(own.latitude,own.longitude)){
      const ownPoint={...own,gdrDistanceKm:0,gdrIsOwnerProperty:true};
      ownerNearby.ownerMarker=window.L.marker([Number(own.latitude),Number(own.longitude)],{icon:ownerNearbyMyHomeIcon(),riseOnHover:true,zIndexOffset:1500,keyboard:true,title:"Your property"}).addTo(ownerNearby.map);
      ownerNearby.ownerMarker.on("click",()=>ownerNearbyPreview(ownPoint));
    }
    ownerNearby.visible=rows;const count=$("gdrOnCount");if(count)count.textContent=String(rows.length);
    const empty=$("gdrOnEmpty");if(empty){empty.hidden=rows.length>0;empty.textContent=rows.length?"":"No nearby homes found within "+ownerNearby.radius+" KM. Your MY HOME pin is still shown on the map.";}
    if(!rows.length){const preview=$("gdrOnPreview");if(preview)preview.hidden=true;}
    ownerNearbyStatus(rows.length+" available homes found within "+ownerNearby.radius+" KM. Your property is marked as MY HOME.");
  }
  function focusOwnerNearbyProperty(){
    const p=ownerNearby.selected;if(!p||!ownerNearby.map)return;
    const lat=asNumber(p.latitude),lng=asNumber(p.longitude);
    if(lat===null||lng===null){ownerNearbyStatus("This property has no saved map coordinates. Edit the property and place its exact pin using the property location picker.");return;}
    ownerNearby.map.flyTo([lat,lng],16,{duration:.65});
    if(ownerNearby.circle){ownerNearby.circle.setLatLng([lat,lng]);ownerNearby.circle.setRadius(ownerNearby.radius*1000);}
    const ownPoint={...p,gdrDistanceKm:0,gdrIsOwnerProperty:true};
    if(ownerNearby.ownerMarker)ownerNearby.ownerMarker.setZIndexOffset(1800);
    ownerNearbyPreview(ownPoint);
    ownerNearbyStatus("Showing your property pin on the map.");
  }
  async function loadOwnerNearbyHomes(){
    if(ownerNearby.loading||!ownerNearby.selected)return;
    const center=[asNumber(ownerNearby.selected.latitude),asNumber(ownerNearby.selected.longitude)];
    if(center.some(v=>v===null)){ownerNearbyStatus("This property is missing exact latitude/longitude. Please update its location pin first.");ownerNearbyLoading(false);return;}
    ownerNearby.loading=true;ownerNearbyLoading(true);ownerNearbyStatus("Searching real listings within "+ownerNearby.radius+" KM…");
    try{
      const client=db();if(!client)throw new Error("Account service is not ready. Refresh and sign in again.");
      const result=await client.rpc("get_public_properties");
      if(result.error)throw result.error;
      const selectedId=String(ownerNearby.selected.id);
      // Reuse the platform public-inventory RPC: it intentionally includes
      // eligible pending listings without weakening table RLS or requiring
      // an extra admin-verification gate for this discovery map.
      const inventory=(Array.isArray(result.data)?result.data:[]).map(p=>({...p,name:p.name||p.title,address:p.address||p.location}));
      const rows=inventory.filter(p=>String(p.id)!==selectedId&&validPoint(p.latitude,p.longitude)&&ownerNearbyAvailable(p)).map(p=>({...p,gdrDistanceKm:distanceKm(center,[Number(p.latitude),Number(p.longitude)])})).filter(p=>p.gdrDistanceKm<=ownerNearby.radius).sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm);
      renderOwnerNearbyHomes(rows,center);
    }catch(error){console.error("Owner Nearby Properties query failed:",error);ownerNearbyStatus(error.message||"Nearby properties could not be loaded. Check your connection and permissions.");const empty=$("gdrOnEmpty");if(empty){empty.hidden=false;empty.textContent="Could not load nearby homes. Please refresh and try again.";}}
    finally{ownerNearby.loading=false;ownerNearbyLoading(false);}
  }
  async function openOwnerNearbyMap(){
    const overlay=ownerNearbyOverlay();overlay.hidden=false;document.body.classList.add("gdr-owner-nearby-open");hideOwnerNearbyBackground();
    ownerNearby.radius=5;$("gdrOnRadius").value="5";$("gdrOnMapChip").textContent="5 KM radius";$("gdrOnCount").textContent="…";ownerNearbyLoading(true);
    try{
      await ensureLeaflet();
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
      const canvas=$("gdrOwnerNearbyMapCanvas");
      if(!ownerNearby.map){
        // Leaflet needs an initial view before tiles, markers or flyTo can render.
        // Start at the selected owner's saved coordinates, never browser GPS.
        const initialCenter=[Number(ownerNearby.selected.latitude),Number(ownerNearby.selected.longitude)];
        ownerNearby.map=window.L.map(canvas,{zoomControl:false,scrollWheelZoom:true,preferCanvas:true}).setView(initialCenter,14);
        let tileErrors=0;
        const useOsmFallback=()=>{
          if(ownerNearby.tileFallback)return;
          ownerNearby.tileFallback=true;
          if(ownerNearby.tileLayer)ownerNearby.map.removeLayer(ownerNearby.tileLayer);
          ownerNearby.tileLayer=window.L.tileLayer(TILE_URL,{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'});
          ownerNearby.tileLayer.on("tileerror",()=>ownerNearbyStatus("Map tiles are temporarily unavailable. Check your connection and try Refresh."));
          ownerNearby.tileLayer.addTo(ownerNearby.map);
        };
        // Register error listeners BEFORE adding the layer, otherwise the first
        // batch of failed tiles can be missed and the map stays blank.
        ownerNearby.tileLayer=window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{subdomains:"abcd",maxZoom:20,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>'});
        ownerNearby.tileLayer.on("tileerror",()=>{tileErrors++;if(tileErrors>=2)useOsmFallback();});
        ownerNearby.tileLayer.addTo(ownerNearby.map);
        window.L.control.zoom({position:"bottomright"}).addTo(ownerNearby.map);
        ownerNearby.layer=makeLayer(ownerNearby.map);
      }
      requestAnimationFrame(()=>{ownerNearby.map.invalidateSize();focusOwnerNearbyProperty();});
      await loadOwnerNearbyHomes();
    }catch(error){console.error("Owner Nearby map failed:",error);ownerNearbyLoading(false);ownerNearbyStatus(error.message||"Nearby map could not be opened.");const empty=$("gdrOnEmpty");if(empty){empty.hidden=false;empty.textContent=error.message||"Nearby map could not be opened.";}}
  }

  function bind(){
    $("renterExploreMapBtn")?.addEventListener("click",openRenterMap);$("gdrMapBackBtn")?.addEventListener("click",closeRenterMap);
    $("gdrMapSearchAreaBtn")?.addEventListener("click",searchTypedMapLocation);$("gdrMapLocateBtn")?.addEventListener("click",locateRenter);
    const radiusInput=$("gdrMapRadius");if(radiusInput){radiusInput.min="0.5";radiusInput.max="10";radiusInput.step="0.5";radiusInput.addEventListener("input",e=>{state.radiusKm=Math.max(.5,Math.min(10,Number(e.target.value)||5));const label=$("gdrMapRadiusValue");if(label)label.textContent=state.radiusKm<1?Math.round(state.radiusKm*1000)+" m":state.radiusKm+" km";});}
    $("gdrMapRadius")?.addEventListener("change",()=>{if(state.renterMap)searchRenterArea();});
    $("gdrMapListToggle")?.addEventListener("click",()=>{const l=$("gdrMapLayout"),panel=$("gdrMapListPanel");if(!l)return;const on=!l.classList.contains("gdr-list-mode");l.classList.toggle("gdr-list-mode",on);if(panel)panel.hidden=!on;$("gdrMapListToggle").setAttribute("aria-pressed",String(on));$("gdrMapViewToggle").setAttribute("aria-pressed",String(!on));if(state.renterMap)requestAnimationFrame(()=>state.renterMap.invalidateSize());});
    $("gdrMapViewToggle")?.addEventListener("click",()=>{const l=$("gdrMapLayout"),panel=$("gdrMapListPanel");if(!l)return;l.classList.remove("gdr-list-mode");if(panel)panel.hidden=true;$("gdrMapListToggle").setAttribute("aria-pressed","false");$("gdrMapViewToggle").setAttribute("aria-pressed","true");if(state.renterMap)requestAnimationFrame(()=>state.renterMap.invalidateSize());});
    $("gdrOpenOwnerMapPickerBtn")?.addEventListener("click",openOwnerMapPicker);$("gdrCloseOwnerMapPickerBtn")?.addEventListener("click",closeOwnerMapPicker);$("gdrConfirmOwnerMapLocation")?.addEventListener("click",confirmOwnerMapLocation);
    setupPlaceSearch("gdrMapPlaceSearch","gdrMapPlaceSuggestions",r=>{state.searchCenter=[r.lat,r.lng];state.resolvedQuery=r.label;if(state.renterMap){state.renterMap.setView(state.searchCenter,14,{animate:false});searchRenterArea();}},"renter");
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
  window.GDRMapExperience={openRenterMap,closeRenterMap,openOwnerMapPicker,searchRenterArea,searchTypedMapLocation,resolveMapQuery,setRenterPin,usePreciseOwnerLocation,openOwnerNearbyMap,closeOwnerNearbyMap};
})();
