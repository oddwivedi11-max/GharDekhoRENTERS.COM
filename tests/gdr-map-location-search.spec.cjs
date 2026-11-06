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

  test('opening the map does not jump to the first property or request GPS automatically', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const source = await page.locator('script[src*="gdr-map-experience.js"]').getAttribute('src');
    expect(source).toContain('gdr-map-experience.js');
    const script = await page.evaluate(async src => await (await fetch(src)).text(), source);
    expect(script).not.toContain('const first=state.inventory[0];if(first)state.renterMap.setView');
    expect(script).toContain('Tap anywhere on the map to place your starting location');
    expect(script).toContain('addEventListener("click",searchTypedMapLocation)');
    expect(script).toContain('state.renterMap.setView(state.searchCenter,14,{animate:false})');
    expect(script).toContain('addEventListener("change",()=>{if(state.renterMap)searchRenterArea();})');
    expect(script).toContain('state.renterMap.on("click",e=>setRenterPin(e.latlng,""))');
    expect(script).toContain('draggable:true,zIndexOffset:1000');
    expect(script).toContain('async function reverseGeocodeRenter(lat,lng)');
    expect(script).toContain('setRenterPin(point,point.label||query)');
    expect(script).toContain('fetchBounds(radiusBounds(state.searchCenter))');
    expect(script).toContain('gdrDistanceKm<=state.radiusKm');
    expect(script).toContain('sort((a,b)=>a.gdrDistanceKm-b.gdrDistanceKm)');
  });
});
