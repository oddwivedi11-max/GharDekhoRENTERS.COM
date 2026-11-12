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
                { geometry: { coordinates: [82.66, 24.10] }, properties: { city: 'Waidhan', district: 'Singrauli', state: 'Madhya Pradesh', postcode: '486886' } },
                { geometry: { coordinates: [77.41, 23.23] }, properties: { city: 'Bhopal', district: 'Bhopal', state: 'Madhya Pradesh', postcode: '462022' } }
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
    expect(script).toContain('$("gdrMapPlaceSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchTypedMapLocation();}})');
    expect(script).toContain('state.renterMap.setView(state.searchCenter,cityLike?11:14,{animate:false})');
    expect(script).toContain('radiusInput.addEventListener("input",e=>{state.radiusKm=Math.max(.5,Math.min(10,Number(e.target.value)||5));');
    expect(script).toContain('$("gdrMapRadius")?.addEventListener("change",()=>{if(state.renterMap&&state.searchCenter)searchRenterArea(undefined,state.searchUsesRadius);})');
    expect(script).toContain('state.renterMap.on("click",e=>{if(state.visible.length)return;setRenterPin(e.latlng,"Selected map location");})');
    expect(script).toContain('draggable:true');
    expect(script).toContain('async function reverseGeocodeRenter(lat,lng)');
    expect(script).toContain('setRenterPin(point,point.label||query)');
    expect(script).toContain('fetchBounds(bounds,state.searchCenter,state.currentPrefs)');
    expect(script).toContain('gdrDistanceKm<=state.radiusKm');
    expect(script).toContain('sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm)');
  });
});
