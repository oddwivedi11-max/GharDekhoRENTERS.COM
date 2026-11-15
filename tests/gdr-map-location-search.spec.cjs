const { test, expect } = require('@playwright/test');

test.describe('Map location search uses the requested place, not a stale inventory pin', () => {
  test('six-digit PIN is resolved through India Post and rejects a different district', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => window.GDRMapExperience && typeof window.GDRMapExperience.resolveMapQuery === 'function');

    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async input => {
        const url = String(input);
        if (url.includes('api.postalpincode.in/pincode/462022')) {
          return {
            ok: true,
            json: async () => [{
              Status: 'Success',
              PostOffice: [{ Name: 'Bhopal', District: 'Bhopal', State: 'Madhya Pradesh', BranchType: 'Head Office' }]
            }]
          };
        }
        if (url.includes('photon.komoot.io/api/')) {
          return {
            ok: true,
            json: async () => ({
              features: [
                { geometry: { coordinates: [82.66, 24.10] }, properties: { city: 'Waidhan', district: 'Singrauli', state: 'Madhya Pradesh', postcode: '486886', country: 'India', countrycode: 'in' } },
                { geometry: { coordinates: [77.41, 23.23] }, properties: { city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh', postcode: '462022', country: 'India', countrycode: 'in' } }
              ]
            })
          };
        }
        return originalFetch(input);
      };
      return await window.GDRMapExperience.resolveMapQuery('462022');
    });

    expect(result.lat).toBeCloseTo(23.23, 2);
    expect(result.lng).toBeCloseTo(77.41, 2);
    expect(result.label).toContain('Bhopal');
  });

  test('Bhopal PIN 462001 resolves to Bhopal', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => window.GDRMapExperience && typeof window.GDRMapExperience.resolveMapQuery === 'function');
    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async input => {
        const url = String(input);
        if (url.includes('api.postalpincode.in/pincode/462001')) {
          return { ok: true, json: async () => [{ Status: 'Success', PostOffice: [
            { Name: 'Bhopal G.P.O.', District: 'Bhopal', State: 'Madhya Pradesh', BranchType: 'Head Office' }
          ] }] };
        }
        if (url.includes('photon.komoot.io/api/')) {
          return { ok: true, json: async () => ({ features: [
            { geometry: { coordinates: [82.67, 24.20] }, properties: { city: 'Singrauli', district: 'Singrauli', state: 'Madhya Pradesh', postcode: '486889', country: 'India' } },
            { geometry: { coordinates: [77.41, 23.23] }, properties: { city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh', postcode: '462001', country: 'India' } }
          ] }) };
        }
        return originalFetch(input);
      };
      return await window.GDRMapExperience.resolveMapQuery('462001');
    });
    expect(result.lat).toBeCloseTo(23.23, 2);
    expect(result.lng).toBeCloseTo(77.41, 2);
    expect(result.label).toContain('Bhopal');
  });

  test('PIN 462022 resolves Jamunia Kalan from postal coordinates when Photon has no indexed match', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => window.GDRMapExperience && typeof window.GDRMapExperience.resolveMapQuery === 'function');
    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async input => {
        const url = String(input);
        if (url.includes('api.postalpincode.in/pincode/462022')) {
          return { ok: true, json: async () => [{ Status: 'Success', PostOffice: [
            { Name: 'BHEL H.O.', District: 'Bhopal', State: 'Madhya Pradesh', BranchType: 'Head Office' },
            { Name: 'Jamunia Kalan B.O.', District: 'Bhopal', State: 'Madhya Pradesh', BranchType: 'Branch Office', DeliveryStatus: 'Delivery' }
          ] }] };
        }
        if (url.includes('photon.komoot.io/api/')) return { ok: true, json: async () => ({ features: [] }) };
        if (url.includes('api.pincodeapi.in/api/v1/pincode/462022')) {
          return { ok: true, json: async () => ({ success: true, data: { pincode: '462022', post_offices: [
            { office_name: 'BHEL H.O.', pincode: '462022', office_type: 'HO', district: 'Bhopal', state: 'Madhya Pradesh', latitude: 23.2400, longitude: 77.4700 },
            { office_name: 'Jamunia Kalan', pincode: '462022', office_type: 'BO', district: 'Bhopal', state: 'Madhya Pradesh', latitude: 23.2405833, longitude: 77.4704722 }
          ] } }) };
        }
        return originalFetch(input);
      };
      return await window.GDRMapExperience.resolveMapQuery('462022');
    });
    expect(result.lat).toBeCloseTo(23.2405833, 5);
    expect(result.lng).toBeCloseTo(77.4704722, 5);
    expect(result.label).toContain('Jamunia Kalan');
  });

  test('PIN 486886 selects Waidhan Sub Office instead of the Sidhi Head Office', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => window.GDRMapExperience && typeof window.GDRMapExperience.resolveMapQuery === 'function');

    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async input => {
        const url = String(input);
        if (url.includes('api.postalpincode.in/pincode/486886')) {
          return { ok: true, json: async () => [{ Status: 'Success', PostOffice: [
            { Name: 'Sidhi H.O.', District: 'Sidhi', State: 'Madhya Pradesh', BranchType: 'Head Office' },
            { Name: 'Waidhan S.O.', District: 'Sidhi', State: 'Madhya Pradesh', BranchType: 'Sub Office' }
          ] }] };
        }
        if (url.includes('photon.komoot.io/api/')) {
          return { ok: true, json: async () => ({ features: [
            { geometry: { coordinates: [77.41, 24.40] }, properties: { city: 'Sidhi', district: 'Sidhi', state: 'Madhya Pradesh', postcode: '486661', country: 'India', countrycode: 'in' } },
            { geometry: { coordinates: [82.66, 24.10] }, properties: { city: 'Waidhan', district: 'Singrauli', state: 'Madhya Pradesh', postcode: '486886', country: 'India', countrycode: 'in' } },
            { geometry: { coordinates: [82.67, 24.20] }, properties: { city: 'Singrauli', district: 'Singrauli', state: 'Madhya Pradesh', postcode: '486889', country: 'India', countrycode: 'in' } }
          ] }) };
        }
        return originalFetch(input);
      };
      return await window.GDRMapExperience.resolveMapQuery('486886');
    });

    expect(result.lat).toBeCloseTo(24.10, 2);
    expect(result.lng).toBeCloseTo(82.66, 2);
    expect(result.label).toContain('Waidhan');
  });

  test('Singrauli PIN 486889 resolves to Singrauli rather than an unrelated Bhopal or Waidhan result', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForFunction(() => window.GDRMapExperience && typeof window.GDRMapExperience.resolveMapQuery === 'function');
    const result = await page.evaluate(async () => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async input => {
        const url = String(input);
        if (url.includes('api.postalpincode.in/pincode/486889')) {
          return { ok: true, json: async () => [{ Status: 'Success', PostOffice: [
            { Name: 'Singrauli Colliery S.O.', District: 'Singrauli', State: 'Madhya Pradesh', BranchType: 'Sub Office' }
          ] }] };
        }
        if (url.includes('photon.komoot.io/api/')) {
          return { ok: true, json: async () => ({ features: [
            { geometry: { coordinates: [77.41, 23.23] }, properties: { city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh', postcode: '462001', country: 'India' } },
            { geometry: { coordinates: [82.66, 24.10] }, properties: { city: 'Waidhan', district: 'Singrauli', state: 'Madhya Pradesh', postcode: '486886', country: 'India' } },
            { geometry: { coordinates: [82.67, 24.20] }, properties: { city: 'Singrauli', district: 'Singrauli', state: 'Madhya Pradesh', postcode: '486889', country: 'India' } }
          ] }) };
        }
        return originalFetch(input);
      };
      return await window.GDRMapExperience.resolveMapQuery('486889');
    });
    expect(result.lat).toBeCloseTo(24.20, 2);
    expect(result.lng).toBeCloseTo(82.67, 2);
    expect(result.label).toContain('Singrauli');
  });

  test('opening the map does not jump to the first property or request GPS automatically', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const source = await page.locator('script[src*="gdr-map-experience.js"]').getAttribute('src');
    expect(source).toContain('gdr-map-experience.js');
    const script = await page.evaluate(async src => await (await fetch(src)).text(), source);
    expect(script).not.toContain('const first=state.inventory[0];if(first)state.renterMap.setView');
    expect(script).toContain('Tap anywhere on the map to place your starting location');
    expect(script).toContain('else if(kind==="renter")searchTypedMapLocation();');
    expect(script).not.toContain('$("#gdrMapPlaceSearch")?.addEventListener("keydown"');
    expect(script).toContain('state.renterMap.setView(state.searchCenter,targetZoom,{animate:false})');
    expect(script).toContain('radiusInput.addEventListener("input",e=>{state.radiusKm=Math.max(.5,Math.min(10,Number(e.target.value)||5));');
    expect(script).toContain('$("gdrMapRadius")?.addEventListener("change",()=>{if(state.renterMap&&state.searchCenter)searchRenterArea(undefined,state.searchUsesRadius);})');
    expect(script).toContain('state.renterMap.on("click",e=>{');
    expect(script).toContain("state.searchUsesRadius=true;");
    expect(script).toContain('setRenterPin(e.latlng,"Selected map location");');
    expect(script).toContain('draggable:true');
    expect(script).toContain('async function reverseGeocodeRenter(lat,lng)');
    expect(script).toContain('setRenterPin(point,point.label||query)');
    expect(script).toContain('fetchBounds(bounds,state.searchCenter,state.currentPrefs)');
    expect(script).toContain('gdrDistanceKm<=state.radiusKm');
    expect(script).toContain('sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm)');
  });
  test('renter map begins over India, keeps its pin and allows dragging', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const source = await page.locator('script[src*="gdr-map-experience.js"]').getAttribute('src');
    const script = await page.evaluate(async src => await (await fetch(src)).text(), source);
    const initStart = script.indexOf('function initRenterMap(){');
    const initEnd = script.indexOf('function ensureMapVoiceAssistant(){', initStart);
    const init = script.slice(initStart, initEnd);
    expect(init).toContain('state.renterMap.setView(INDIA_CENTER,5)');
    expect(init).not.toContain('setView([23.2599,77.4126],12)');
    expect(init).toContain('state.renterMap.on("click",e=>{');
    expect(init).toContain("state.searchUsesRadius=true;");
    expect(init).toContain('setRenterPin(e.latlng,"Selected map location");');
    expect(script).toContain('draggable:true');
    expect(script).toContain('marker.on("dragend",event=>handleRenterPinDragEnd(event,marker))');
    expect(script).toContain('if(state.renterPin&&preservePin===false)');
    expect(script).toContain('const validIndiaPoint=(lat,lng)=>');
    expect(script).toContain('searchRenterArea(undefined,true)');
  });

});
