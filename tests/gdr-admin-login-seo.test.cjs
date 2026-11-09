const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(process.cwd(), name), 'utf8');

test('public admin login landing page is branded and indexable without auth logic', () => {
  const html = read('admin-login.html');
  assert.match(html, /<title>GharDekho Renters Admin Login<\/title>/);
  assert.match(html, /name="description"/);
  assert.match(html, /name="robots" content="index,follow"/);
  assert.match(html, /rel="canonical" href="https:\/\/ghardekhorenters\.com\/admin-login"/);
  assert.match(html, /href="\/admin\/"[^>]*>Continue to Admin Login/);
  assert.doesNotMatch(html, /signInWithPassword|createClient\(|ADMIN_EMAIL|service_role|sb_secret/i);
});

test('public admin login route is rewritten to the standalone landing page', () => {
  const redirects = read('_redirects');
  assert.match(redirects, /^\/admin-login \/admin-login\.html 200$/m);
  assert.match(redirects, /^\/admin \/admin\/ 302$/m);
  assert.match(redirects, /^\/admin\/control \/index\.html 200$/m);
});

test('robots and sitemap expose only the public admin login URL', () => {
  const robots = read('robots.txt');
  const sitemap = read('sitemap.xml');
  assert.match(robots, /^Allow: \/admin-login$/m);
  assert.match(robots, /^Disallow: \/admin\/$/m);
  assert.match(robots, /^Disallow: \/admin\/control$/m);
  assert.match(sitemap, /<loc>https:\/\/ghardekhorenters\.com\/admin-login<\/loc>/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/ghardekhorenters\.com\/admin\/(?:control|index)/);
});
