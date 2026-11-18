const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');
const { parseCsv } = require('../src/categoriesAdmin');

// CR-2026-11-17-02: the category tree from migration 020, managed on /admin/categories; directory channels get
// subcategories (one record per channel however many rows), switched-off categories are hidden and count for their
// parent. The tree is restored after these tests (later test files use it).
let app;
let fixtures;
let adminToken;
let snapshot;
const pool = () => getPool();
const admin = (method, url, payload) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${adminToken}` } });
const dir = async (qs = '') => (await app.inject({ method: 'GET', url: `/api/youtube/directory${qs}` })).json();

async function videoChannel(name, { country = 'ci', channelId = null, url = null, topic = 'news', category = 'national_tv' } = {}) {
  await pool().query(
    `INSERT INTO video_channels (country_id, category, name, platform, youtube_channel_id, channel_url, topic)
     VALUES ($1, $2, $3, 'youtube', $4, $5, $6)`,
    [fixtures.countryIds[country], category, name, channelId, url || (channelId ? `https://www.youtube.com/channel/${channelId}` : null), topic]);
}

before(async () => {
  fixtures = await resetFixtures();
  ({ rows: snapshot } = await pool().query('SELECT slug, parent_slug, name_en, name_fr, description_fr, sort_order, active FROM creator_categories'));
  await pool().query('DELETE FROM video_channel_category_links');
  await pool().query('DELETE FROM video_channels');
  await videoChannel('RTI 1', { channelId: 'UCrti1' });
  await videoChannel('RTI 1 (direct)', { channelId: 'UCrti1', category: 'live_now' }); // same channel, second row
  await videoChannel('Radio Côte', { url: 'https://Radio.example/Live', topic: 'culture' });
  await videoChannel('Lagos Sport', { country: 'ng', channelId: 'UCsport', topic: '' });
  app = buildApp({ logger: false });
  await app.ready();
  adminToken = (await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } })).json().token;
});

after(async () => {
  const keep = snapshot.map((c) => c.slug);
  await pool().query('DELETE FROM video_channel_category_links');
  await pool().query('DELETE FROM creator_category_links WHERE category_id IN (SELECT id FROM creator_categories WHERE NOT (slug = ANY($1)))', [keep]);
  await pool().query('DELETE FROM creator_categories WHERE NOT (slug = ANY($1)) AND parent_slug IS NOT NULL', [keep]);
  await pool().query('DELETE FROM creator_categories WHERE NOT (slug = ANY($1))', [keep]);
  for (const c of snapshot) {
    await pool().query(
      `UPDATE creator_categories SET parent_slug = $2, name_en = $3, name_fr = $4, description_fr = $5, sort_order = $6, active = $7
        WHERE slug = $1`, [c.slug, c.parent_slug, c.name_en, c.name_fr, c.description_fr, c.sort_order, c.active]);
  }
  if (app) await app.close();
});

test('migration 020: the brief tree, 8 main categories and 70 subcategories, old slugs switched off not deleted', async () => {
  const res = await admin('GET', '/api/admin/creator-categories');
  assert.equal(res.statusCode, 200);
  const cats = res.json();
  const on = cats.filter((c) => c.active);
  assert.equal(on.filter((c) => !c.parent_slug).length, 8);
  assert.equal(on.filter((c) => c.parent_slug).length, 70);
  assert.deepEqual(cats.filter((c) => !c.active).map((c) => c.slug).sort(),
    ['beauty', 'culture-society', 'digital-marketing', 'journalism', 'other-sports']);
  const s = Object.fromEntries(cats.map((c) => [c.slug, c]));
  assert.equal(s['social-issues'].parent_slug, 'politics-society');
  assert.equal(s.dance.parent_slug, 'culture-heritage');
  assert.equal(s['news-media'].name_fr, 'Actualités et médias');
  assert.equal(s.politics.name_fr, 'Actualité politique');
  // A main category comes before its subcategories, in order.
  const i = (slug) => cats.findIndex((c) => c.slug === slug);
  assert.ok(i('news-media') < i('national-news') && i('national-news') < i('entertainment'));
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/creator-categories' })).statusCode, 401);
});

test('create, rename, describe, move and switch off; validation', async () => {
  assert.equal((await admin('POST', '/api/admin/creator-categories', { slug: 'Bad Slug', name_fr: 'x' })).statusCode, 400);
  assert.equal((await admin('POST', '/api/admin/creator-categories', { slug: 'x-test', name_fr: 'X', parent_slug: 'football' })).statusCode, 400,
    'two levels only');
  const created = await admin('POST', '/api/admin/creator-categories', { slug: 'handball', name_fr: 'Handball', parent_slug: 'sports' });
  assert.equal(created.statusCode, 201, created.body);
  assert.equal((await admin('POST', '/api/admin/creator-categories', { slug: 'handball', name_fr: 'Handball' })).statusCode, 409);
  const main = await admin('POST', '/api/admin/creator-categories', { slug: 'sante', name_fr: 'Santé' });
  assert.equal(main.statusCode, 201);
  assert.ok(main.json().sort_order >= 900);

  assert.equal((await admin('PATCH', '/api/admin/creator-categories/handball', { name_fr: 'Handball et volley', description_fr: 'Clubs, ligues' })).statusCode, 200);
  assert.equal((await admin('PATCH', '/api/admin/creator-categories/handball', { name_fr: '' })).statusCode, 400);
  assert.equal((await admin('PATCH', '/api/admin/creator-categories/sports', { parent_slug: 'news-media' })).statusCode, 400,
    'a main category with subcategories cannot move under another');
  assert.equal((await admin('PATCH', '/api/admin/creator-categories/handball', { parent_slug: 'sante' })).statusCode, 200);
  assert.equal((await admin('PATCH', '/api/admin/creator-categories/handball', { active: 'no' })).statusCode, 400);
  assert.equal((await admin('PATCH', '/api/admin/creator-categories/nope', { active: false })).statusCode, 404);
  const { rows: [h] } = await pool().query(`SELECT name_fr, description_fr, parent_slug FROM creator_categories WHERE slug = 'handball'`);
  assert.deepEqual(h, { name_fr: 'Handball et volley', description_fr: 'Clubs, ligues', parent_slug: 'sante' });
});

test('order: main categories and one main category\'s subcategories', async () => {
  const subs = (await admin('GET', '/api/admin/creator-categories')).json().filter((c) => c.parent_slug === 'sports').map((c) => c.slug);
  const reversed = [...subs].reverse();
  assert.equal((await admin('PUT', '/api/admin/creator-categories-order', { parent_slug: 'sports', slugs: reversed.slice(1) })).statusCode, 400);
  assert.equal((await admin('PUT', '/api/admin/creator-categories-order', { parent_slug: 'sports', slugs: reversed })).statusCode, 200);
  const after1 = (await admin('GET', '/api/admin/creator-categories')).json().filter((c) => c.parent_slug === 'sports').map((c) => c.slug);
  assert.deepEqual(after1, reversed);

  const mains = (await admin('GET', '/api/admin/creator-categories')).json().filter((c) => !c.parent_slug).map((c) => c.slug);
  const moved = ['sports', ...mains.filter((s) => s !== 'sports')];
  assert.equal((await admin('PUT', '/api/admin/creator-categories-order', { slugs: moved })).statusCode, 200);
  const cats = (await admin('GET', '/api/admin/creator-categories')).json();
  assert.equal(cats[0].slug, 'sports');
  assert.equal(cats[1].parent_slug, 'sports', 'its subcategories follow it');
});

test('channel classification: one record per channel, several subcategories, one primary; directory filters by any level', async () => {
  const list = (await admin('GET', '/api/admin/channel-categories?status=unclassified')).json();
  assert.equal(list.total, 3, 'RTI 1 listed twice in video_channels is one channel');
  assert.equal(list.classified, 0);
  const rti = list.items.find((x) => x.name.startsWith('RTI 1'));
  assert.equal(rti.key, 'UCrti1');
  assert.deepEqual(rti.rails.sort(), ['live_now', 'national_tv']);

  assert.equal((await admin('PUT', '/api/admin/channel-categories', { key: 'UCnope', categories: ['national-news'] })).statusCode, 404);
  assert.equal((await admin('PUT', '/api/admin/channel-categories', { key: 'UCrti1', categories: ['unknown-cat'] })).statusCode, 400);
  assert.equal((await admin('PUT', '/api/admin/channel-categories', { key: 'UCrti1', categories: ['national-news', 'tv-radio'], primary: 'football' })).statusCode, 400);
  const ok = await admin('PUT', '/api/admin/channel-categories', { key: 'UCrti1', categories: ['tv-radio', 'national-news'], primary: 'tv-radio' });
  assert.equal(ok.statusCode, 200, ok.body);
  // URL-keyed channel: the key is the lowercased URL.
  assert.equal((await admin('PUT', '/api/admin/channel-categories', { key: 'https://radio.example/live', categories: ['radio-stations'] })).statusCode, 200);

  const after1 = (await admin('GET', '/api/admin/channel-categories')).json();
  assert.equal(after1.classified, 2);
  const r = after1.items.find((x) => x.key === 'UCrti1');
  assert.deepEqual(r.categories.map((c) => [c.slug, c.primary]), [['tv-radio', true], ['national-news', false]]);

  const byName = async (qs) => (await dir(qs)).items.map((e) => e.name).sort();
  assert.deepEqual(await byName('?category=tv-radio'), ['RTI 1']);
  assert.deepEqual(await byName('?category=news-media'), ['RTI 1', 'Radio Côte'], 'a main category matches its subcategories');
  assert.deepEqual(await byName('?category=radio-stations'), ['Radio Côte']);
  assert.deepEqual(await byName('?category=culture-heritage'), [], 'classified channel no longer uses its topic');
  const d = await dir();
  assert.equal(d.items.find((e) => e.name === 'RTI 1').primary_category, 'tv-radio');
  assert.ok(d.facets.categories.some((c) => c.slug === 'radio-stations' && c.count === 1));
});

test('a switched-off category is hidden and counts for its parent', async () => {
  await admin('PUT', '/api/admin/channel-categories', { key: 'UCsport', categories: ['football'] });
  assert.deepEqual((await dir('?category=football')).items.map((e) => e.name), ['Lagos Sport']);
  assert.equal((await admin('PATCH', '/api/admin/creator-categories/football', { active: false })).statusCode, 200);
  // The directory list is cached; an admin change clears it at once.
  const d = await dir('?category=sports');
  assert.deepEqual(d.items.map((e) => e.name), ['Lagos Sport'], 'counts for the parent');
  assert.equal(d.items[0].primary_category, 'sports');
  assert.equal((await dir('?category=football')).total, 0);
  assert.ok(!d.facets.categories.some((c) => c.slug === 'football'));
});

test('CSV: export, then import the export format and the review format (dry run by default)', async () => {
  const exp = await admin('GET', '/api/admin/channel-categories/export');
  assert.equal(exp.statusCode, 200);
  assert.match(exp.headers['content-type'], /text\/csv/);
  const rows = parseCsv(exp.body);
  assert.deepEqual(rows[0], ['kind', 'key', 'name', 'countries', 'primary', 'others']);
  assert.ok(rows.some((r) => r[1] === 'UCrti1' && r[4] === 'tv-radio' && r[5] === 'national-news'));

  // French Excel saves with ";".
  const review = [
    'kind;key;name;proposed_primary_subcategory;proposed_other_subcategories;owner_decision (ok / slug;slug / reject)',
    'channel;UCrti1;RTI 1;national-news;tv-radio;ok',
    'channel;https://radio.example/live;Radio Côte;radio-stations;;"music;radio-stations"',
    'channel;UCsport;Lagos Sport;sports-news;;reject',
    'channel;UCghost;Ghost;national-news;;ok',
    'channel;UCsport;Lagos Sport;bad-slug;;ok',
    'channel;UCsport;Lagos Sport;national-news;;',
  ].join('\r\n');
  const dry = await admin('POST', '/api/admin/channel-categories/import', { csv: review });
  assert.equal(dry.statusCode, 200, dry.body);
  assert.deepEqual({ ...dry.json(), errors: dry.json().errors.map((e) => e.line) }, { dry_run: true, rows: 6, applied: 2, skipped: 2, errors: [5, 6] });
  let r = (await admin('GET', '/api/admin/channel-categories')).json().items.find((x) => x.key === 'UCrti1');
  assert.equal(r.categories.find((c) => c.primary).slug, 'tv-radio', 'dry run wrote nothing');

  const real = await admin('POST', '/api/admin/channel-categories/import', { csv: review, dry_run: false });
  assert.equal(real.json().applied, 2);
  const items = (await admin('GET', '/api/admin/channel-categories')).json().items;
  r = items.find((x) => x.key === 'UCrti1');
  assert.deepEqual(r.categories.map((c) => [c.slug, c.primary]), [['national-news', true], ['tv-radio', false]]);
  const radio = items.find((x) => x.key === 'https://radio.example/live');
  assert.deepEqual(radio.categories.map((c) => [c.slug, c.primary]), [['music', true], ['radio-stations', false]]);

  assert.equal((await admin('POST', '/api/admin/channel-categories/import', { csv: 'name\nx' })).statusCode, 400);
});
