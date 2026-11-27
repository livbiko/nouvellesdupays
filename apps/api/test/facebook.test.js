const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');
const { normalizeFacebookUrl, playerUrl } = require('../src/facebook');

// /facebook (CR-2026-11-27-01): videos entered by an admin, only facebook.com / fb.watch links, newest first, hidden
// videos never public, admin routes need the token, thumbnails must be real images.
let app;
let auth;

// 1x1 PNG.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

before(async () => {
  await resetFixtures();
  await getPool().query('DELETE FROM facebook_videos');
  app = buildApp({ logger: false });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } });
  auth = { authorization: `Bearer ${login.json().token}` };
});

after(async () => {
  if (app) await app.close();
});

const add = (payload, headers = auth) => app.inject({ method: 'POST', url: '/api/admin/facebook/videos', headers, payload });

test('only facebook.com and fb.watch links, normalized; lookalikes refused', () => {
  assert.equal(normalizeFacebookUrl('https://m.facebook.com/watch/?v=123#x'), 'https://www.facebook.com/watch/?v=123');
  assert.equal(normalizeFacebookUrl('http://facebook.com/RTI/videos/456/'), 'https://www.facebook.com/RTI/videos/456/');
  assert.equal(normalizeFacebookUrl('https://fb.watch/abcDEF/'), 'https://fb.watch/abcDEF/');
  for (const bad of ['https://facebook.com.evil.example/watch?v=1', 'https://notfacebook.com/x', 'https://faceb00k.com/x',
    'https://www.facebook.com/', 'javascript:alert(1)', 'https://user@www.facebook.com/x', 'https://www.facebook.com:8443/x',
    'ftp://www.facebook.com/x', 'https://evil.example/?u=https://www.facebook.com/x', '']) {
    assert.equal(normalizeFacebookUrl(bad), null, bad);
  }
  assert.match(playerUrl('https://www.facebook.com/watch/?v=1'), /^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=https%3A%2F%2Fwww\.facebook\.com%2Fwatch%2F%3Fv%3D1&/);
});

test('admin routes need the token', async () => {
  assert.equal((await add({ url: 'https://www.facebook.com/x/videos/1', title: 't', page_name: 'p', published_at: '2026-11-20' }, {})).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/facebook/videos' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/admin/facebook/videos/1', payload: {} })).statusCode, 401);
});

test('add, list newest first with filters, hide, show again', async () => {
  const bad = await add({ url: 'https://facebook.com.evil.example/v/1', title: 'X', page_name: 'P', published_at: '2026-11-20' });
  assert.equal(bad.statusCode, 400);
  assert.equal((await add({ url: 'https://www.facebook.com/a/videos/1', title: '', page_name: 'P', published_at: '2026-11-20' })).statusCode, 400);
  assert.equal((await add({ url: 'https://www.facebook.com/a/videos/1', title: 'T', page_name: 'P', published_at: '2099-01-01' })).statusCode, 400);
  assert.equal((await add({ url: 'https://www.facebook.com/a/videos/1', title: 'T', page_name: 'P', published_at: '2026-11-20', country: 'ZZ' })).statusCode, 400);

  const a = await add({ url: 'https://m.facebook.com/rti/videos/111/', title: 'Journal de 20 h', page_name: 'RTI Officiel',
    page_url: 'https://www.facebook.com/rti', published_at: '2026-11-25T20:00:00Z', country: 'CI', type: 'tv-nationale', language: 'fr',
    thumbnail: { type: 'image/png', data: PNG } });
  assert.equal(a.statusCode, 201, a.body);
  assert.equal(a.json().url, 'https://www.facebook.com/rti/videos/111/');
  const b = await add({ url: 'https://fb.watch/lagos1/', title: 'Lagos street interview', page_name: 'Lagos Voice',
    published_at: '2026-11-26T10:00:00Z', country: 'NG', type: 'createur-independant', language: 'en' });
  assert.equal(b.statusCode, 201, b.body);
  assert.equal((await add({ url: 'https://www.facebook.com/rti/videos/111/', title: 'dup', page_name: 'P', published_at: '2026-11-20' })).statusCode, 409);

  let d = (await app.inject({ method: 'GET', url: '/api/facebook/directory' })).json();
  assert.deepEqual(d.items.map((v) => v.title), ['Lagos street interview', 'Journal de 20 h']);
  assert.equal(d.total, 2);
  const rti = d.items[1];
  assert.equal(rti.country_iso, 'CI');
  assert.equal(rti.continent, 'afrique');
  assert.match(rti.player_url, /^https:\/\/www\.facebook\.com\/plugins\/video\.php\?href=/);
  assert.match(rti.thumbnail_url, new RegExp(`^/api/facebook/thumbnails/${a.json().id}\\?v=\\d+$`));
  assert.equal(d.items[0].thumbnail_url, null);
  assert.deepEqual(d.facets.countries.map((c) => [c.iso, c.count]), [['CI', 1], ['NG', 1]]);
  assert.deepEqual(d.facets.types.map((t) => t.key), ['tv-nationale', 'createur-independant']);

  d = (await app.inject({ method: 'GET', url: '/api/facebook/directory?country=ng' })).json();
  assert.deepEqual(d.items.map((v) => v.title), ['Lagos street interview']);
  assert.ok(d.place_facets);
  d = (await app.inject({ method: 'GET', url: '/api/facebook/directory?type=tv-nationale&lang=fr&q=journal' })).json();
  assert.equal(d.total, 1);
  const latest = (await app.inject({ method: 'GET', url: '/api/facebook/latest?limit=1' })).json();
  assert.deepEqual(latest.items.map((v) => v.title), ['Lagos street interview']);
  assert.ok(latest.updated_at);
  assert.equal(latest.total, 2);

  const img = await app.inject({ method: 'GET', url: rti.thumbnail_url });
  assert.equal(img.statusCode, 200);
  assert.equal(img.headers['content-type'], 'image/png');
  assert.equal(img.rawPayload.toString('base64'), PNG);

  const explorer = (await app.inject({ method: 'GET', url: '/api/facebook/explorer' })).json();
  const west = explorer.continents.find((c) => c.key === 'afrique').regions.find((r) => r.key === 'afrique-de-l-ouest');
  assert.equal(west.count, 2);

  // Hide: gone from the public lists and its thumbnail; still in the admin list.
  const id = a.json().id;
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/admin/facebook/videos/${id}`, headers: auth, payload: {} })).statusCode, 200);
  d = (await app.inject({ method: 'GET', url: '/api/facebook/directory' })).json();
  assert.deepEqual(d.items.map((v) => v.title), ['Lagos street interview']);
  assert.equal((await app.inject({ method: 'GET', url: rti.thumbnail_url })).statusCode, 404);
  const admin = (await app.inject({ method: 'GET', url: '/api/admin/facebook/videos', headers: auth })).json();
  assert.equal(admin.find((v) => v.id === id).review_status, 'hidden');
  assert.equal(admin.find((v) => v.id === id).country_iso, 'CI');

  const show = await app.inject({ method: 'PATCH', url: `/api/admin/facebook/videos/${id}`, headers: auth, payload: { review_status: 'approved', title: 'Journal de 20 h (RTI)' } });
  assert.equal(show.statusCode, 200, show.body);
  d = (await app.inject({ method: 'GET', url: '/api/facebook/directory' })).json();
  assert.ok(d.items.some((v) => v.title === 'Journal de 20 h (RTI)'));
  assert.equal((await app.inject({ method: 'PATCH', url: `/api/admin/facebook/videos/${id}`, headers: auth, payload: { url: 'https://example.org/x' } })).statusCode, 400);
});

test('a thumbnail must be the image it claims, and small', async () => {
  const base = { title: 'T', page_name: 'P', published_at: '2026-11-20' };
  const html = Buffer.from('<html><script>alert(1)</script></html>').toString('base64');
  assert.equal((await add({ ...base, url: 'https://www.facebook.com/p/videos/9', thumbnail: { type: 'image/png', data: html } })).statusCode, 400);
  assert.equal((await add({ ...base, url: 'https://www.facebook.com/p/videos/9', thumbnail: { type: 'image/svg+xml', data: html } })).statusCode, 400);
  const big = Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(500 * 1024)]).toString('base64');
  const res = await add({ ...base, url: 'https://www.facebook.com/p/videos/9', thumbnail: { type: 'image/png', data: big } });
  assert.ok([400, 413].includes(res.statusCode), String(res.statusCode));
});
