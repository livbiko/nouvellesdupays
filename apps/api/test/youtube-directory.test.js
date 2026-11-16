const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');
const { parseParams, continentOf, languageKeys, queryEntries } = require('../src/youtubeDirectory');

// /youtube directory (CR-2026-11-16-11): video channels + approved creators in one list, filters combine, a creator
// whose channel is also a video channel appears once, missing numbers stay absent, private creators never appear.
let app;
let fixtures;

async function creator(slug, name, { status = 'approved', country = 'ci', kind = 'individual', langs = '{fr}', channelId, subs, views, cat } = {}) {
  const pool = getPool();
  const { rows: [c] } = await pool.query(
    `INSERT INTO creators (slug, display_name, country_id, languages, creator_kind, confidence, review_status, discovered_from, approved_at, bio)
     VALUES ($1, $2, $3, $4, $5, 'HIGH_CONFIDENCE', $6, 'test', now(), $7) RETURNING id`,
    [slug, name, country ? fixtures.countryIds[country] : null, langs, kind, status, `Bio de ${name}`]
  );
  if (channelId) {
    const { rows: [sa] } = await pool.query(
      `INSERT INTO social_accounts (creator_id, platform, url, platform_account_id, verification, status, profile_image_url)
       VALUES ($1, 'youtube', $2, $3, 'linked_from_site', 'active', $4) RETURNING id`,
      [c.id, `https://youtube.com/channel/${channelId}`, channelId, `https://yt3.example/${channelId}.jpg`]
    );
    if (subs != null) {
      await pool.query(`INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at)
                        VALUES ($1, 'subscribers', $2, 'youtube_data_api', now())`, [sa.id, subs]);
    }
    if (views != null) {
      await pool.query(`INSERT INTO audience_metrics (social_account_id, metric, value, source, measured_at)
                        VALUES ($1, 'total_views', $2, 'youtube_data_api', now())`, [sa.id, views]);
    }
  }
  if (cat) {
    await pool.query(`INSERT INTO creator_category_links (creator_id, category_id, is_primary)
                      SELECT $1, id, true FROM creator_categories WHERE slug = $2`, [c.id, cat]);
  }
  return c.id;
}

async function videoChannel(name, { country = 'ci', category = 'national_tv', topic = 'news', channelId = null } = {}) {
  await getPool().query(
    `INSERT INTO video_channels (country_id, category, name, platform, youtube_channel_id, channel_url, topic)
     VALUES ($1, $2, $3, 'youtube', $4, $5, $6)`,
    [country ? fixtures.countryIds[country] : null, category, name, channelId,
      channelId ? `https://www.youtube.com/channel/${channelId}` : 'https://voix.example/live', topic]
  );
}

before(async () => {
  fixtures = await resetFixtures();
  await getPool().query('DELETE FROM video_channels');
  await creator('abidjan-direct', 'Abidjan Direct', { kind: 'media_brand', channelId: 'UCabidjan', subs: 500000, views: 90000000, cat: 'news-current-affairs' });
  await creator('lagos-voice', 'Lagos Voice', { country: 'ng', langs: '{en}', channelId: 'UClagos', subs: 80000, cat: 'football' });
  await creator('sans-chiffres', 'Sans Chiffres', { channelId: 'UCnone' });
  await creator('candidat-prive', 'Candidat Privé', { status: 'candidate', channelId: 'UCcand', subs: 9000000 });
  await videoChannel('RTI 1', { channelId: 'UCrti' });
  await videoChannel('Abidjan Direct (chaîne)', { channelId: 'UCabidjan', category: 'live_now' }); // same channel as a creator
  await videoChannel('Channels TV', { country: 'ng', category: 'live_now', topic: 'business', channelId: 'UCchannels' });
  await videoChannel('Voix du continent', { country: null, category: 'africa_voices', topic: '' });
  // One channel curated in two countries and two rails: one card.
  await videoChannel('RT Monde', { channelId: 'UCrt' });
  await videoChannel('RT Monde', { country: 'ng', category: 'live_now', channelId: 'UCrt' });
  app = await buildApp();
});

after(async () => {
  if (app) await app.close();
});

const get = async (qs = '') => {
  const res = await app.inject({ method: 'GET', url: `/api/youtube/directory${qs}` });
  assert.equal(res.statusCode, 200);
  return res.json();
};

test('one list of channels and approved creators, a shared channel once, private creators never', async () => {
  const d = await get('?per=60');
  const names = d.items.map((e) => e.name).sort();
  assert.deepEqual(names, ['Abidjan Direct', 'Channels TV', 'Lagos Voice', 'RT Monde', 'RTI 1', 'Sans Chiffres', 'Voix du continent']);
  assert.equal(d.total, 7);
  const rt = d.items.find((e) => e.name === 'RT Monde');
  assert.equal(rt.country_name, '2 pays');
  assert.equal(rt.country_iso, null);
  assert.deepEqual(rt.types, ['tv-nationale', 'tv-continu']);
  assert.deepEqual(rt.country_list.map((c) => c.iso).sort(), ['CI', 'NG']);
  const abj = d.items.find((e) => e.name === 'Abidjan Direct');
  assert.equal(abj.source, 'createur');
  assert.equal(abj.profile_path, '/creators/abidjan-direct');
  assert.equal(abj.type, 'media-en-ligne');
  assert.deepEqual(abj.categories.sort(), ['news-current-affairs', 'news-media'].sort(), 'parent category added');
});

test('missing numbers stay absent; default sort puts known audiences first', async () => {
  const d = await get();
  assert.equal(d.sort, 'populaires');
  assert.deepEqual(d.items.slice(0, 2).map((e) => e.name), ['Abidjan Direct', 'Lagos Voice']);
  const none = d.items.find((e) => e.name === 'Sans Chiffres');
  assert.equal(none.subscribers, null);
  assert.equal(none.total_views, null);
  const rti = d.items.find((e) => e.name === 'RTI 1');
  assert.equal(rti.subscribers, null);
  assert.equal(rti.languages_from_country, true);
  assert.deepEqual(rti.languages, ['fr']);
});

test('filters combine', async () => {
  assert.deepEqual((await get('?country=NG')).items.map((e) => e.name).sort(), ['Channels TV', 'Lagos Voice', 'RT Monde']);
  assert.deepEqual((await get('?country=NG&type=tv-continu')).items.map((e) => e.name).sort(), ['Channels TV', 'RT Monde']);
  assert.deepEqual((await get('?category=sports')).items.map((e) => e.name), ['Lagos Voice'], 'parent of football');
  assert.deepEqual((await get('?category=business-finance&lang=en')).items.map((e) => e.name), ['Channels TV']);
  assert.deepEqual((await get('?q=abidjan')).items.map((e) => e.name), ['Abidjan Direct']);
  assert.deepEqual((await get('?q=cote d ivoire&type=tv-nationale')).items.map((e) => e.name).sort(), ['RT Monde', 'RTI 1'], 'accent-free search on country');
  assert.equal((await get('?continent=afrique')).total, 6, 'the channel without a country has no continent');
  assert.equal((await get('?country=ZZ')).total, 0);
});

test('sorts and pagination', async () => {
  assert.deepEqual((await get('?sort=alpha&per=2')).items.map((e) => e.name), ['Abidjan Direct', 'Channels TV']);
  assert.deepEqual((await get('?sort=alpha&per=2&page=4')).items.map((e) => e.name), ['Voix du continent']);
  assert.equal((await get('?sort=vues')).items[0].name, 'Abidjan Direct');
});

test('facets count the whole directory', async () => {
  const { facets } = await get('?country=NG');
  assert.deepEqual(facets.continents, [{ key: 'afrique', label: 'Afrique', count: 6 }]);
  assert.deepEqual(facets.countries.map((c) => [c.iso, c.count, c.creators]), [['CI', 4, 2], ['NG', 3, 1]]);
  assert.ok(facets.types.some((t) => t.key === 'tv-nationale' && t.count === 2));
  assert.ok(facets.types.some((t) => t.key === 'createur-independant' && t.count === 2));
  assert.ok(facets.languages.some((l) => l.key === 'en' && l.count === 3));
});

test('Africa first unless a place or A-Z is chosen', () => {
  const e = (name, subscribers, continent) => ({ name, subscribers, continent, country_iso: continent ? 'XX' : null, categories: [], languages: [] });
  const entries = [e('Brasil TV', 9e6, 'amerique-sud'), e('Dakar TV', 1e5, 'afrique'), e('Lagos TV', 2e5, 'afrique'), e('Sans pays', 5e6, null)];
  const names = (p) => queryEntries(entries, { ...parseParams({}), ...p }).items.map((x) => x.name);
  assert.deepEqual(names({}), ['Lagos TV', 'Dakar TV', 'Brasil TV', 'Sans pays']);
  assert.deepEqual(names({ sort: 'alpha' }), ['Brasil TV', 'Dakar TV', 'Lagos TV', 'Sans pays']);
  assert.deepEqual(names({ continent: 'amerique-sud' }), ['Brasil TV']);
});

test('parameters are validated', () => {
  const p = parseParams({ country: 'ci', sort: 'drop table', per: '999', page: '-3', type: 'x', lang: 'fr', category: 'A B' });
  assert.deepEqual([p.country, p.sort, p.per, p.page, p.type, p.lang, p.category], ['CI', 'populaires', 60, 1, '', 'fr', '']);
  assert.equal(continentOf('West Africa'), 'afrique');
  assert.equal(continentOf('Caribbean'), 'amerique-nord');
  assert.equal(continentOf('Caucasus'), 'asie');
  assert.deepEqual(languageKeys(['French', 'en', 'Klingon']), ['fr', 'en']);
});
