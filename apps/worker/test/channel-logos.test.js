// CR-2026-11-17-04: directory channel logos against the test database with a fake YouTube API (no network, no key).
// (DATABASE_URL must point at nouvellesdupays_test -- tables are truncated)
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { refreshChannelLogos, logoOf } = require('../src/channel-logos');

const pool = getPool();
const quiet = () => {};
const UC = (n) => `UC${String(n).padStart(22, 'y')}`;
const NOW = new Date('2026-11-18T10:00:00Z');

function fakeYoutube(channels) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    calls.push({ kind: u.pathname.split('/').pop(), ids: (u.searchParams.get('id') || '').split(',') });
    const items = (u.searchParams.get('id') || '').split(',').map((id) => channels[id]).filter(Boolean);
    return { ok: true, json: async () => ({ items }) };
  };
  return { calls, fetchImpl };
}

const channel = (id, { logo = `https://yt3.ggpht.com/${id}=s240`, subs = '1200', hidden = false } = {}) => ({
  id,
  snippet: { title: id, thumbnails: { default: { url: 'https://yt3.ggpht.com/small' }, high: { url: logo } } },
  statistics: { subscriberCount: subs, viewCount: '500000', videoCount: '40', hiddenSubscriberCount: hidden },
});

let ci;
before(async () => {
  if (!/nouvellesdupays_test/.test(process.env.DATABASE_URL || '')) throw new Error('DATABASE_URL must point at nouvellesdupays_test');
  await pool.query('TRUNCATE countries, publishers, creators, video_channels, agent_runs, discovery_jobs RESTART IDENTITY CASCADE');
  const { rows: [c] } = await pool.query(
    `INSERT INTO countries (iso_code, name, region, capital, languages) VALUES ('CI', 'Côte d''Ivoire', 'West Africa', 'Yamoussoukro', '{French}') RETURNING id`);
  ci = c.id;
  await pool.query(`UPDATE discovery_agents SET paused = false, daily_quota_units = 8000 WHERE agent = 'youtube'`);
  const vc = (name, id, logo = null, category = 'national_tv') => pool.query(
    `INSERT INTO video_channels (country_id, category, name, platform, youtube_channel_id, channel_url, logo_url)
     VALUES ($1, $2, $3, 'youtube', $4, $5, $6)`, [ci, category, name, id, `https://www.youtube.com/channel/${id}`, logo]);
  await vc('RTI 1', UC(1));
  await vc('RTI 1 (direct)', UC(1), null, 'live_now');                 // same channel, second row
  await vc('Curated', UC(2), 'https://cdn.example/curated.png');        // a logo set by hand
  await vc('Hidden subs', UC(3));
  await vc('Gone', UC(4));                                              // the API does not return it
  await vc('Bad host', UC(5));
  for (let n = 10; n < 60; n += 1) await vc(`Bulk ${n}`, UC(n));        // 50 more: two calls
  await pool.query(`INSERT INTO video_channels (country_id, category, name, platform, channel_url) VALUES ($1, 'live_now', 'Stream', 'streaming', 'https://tv.example/live')`, [ci]);
  // RTI 1 also has an account row (publisher), so its numbers are stored; the others have none.
  const { rows: [p] } = await pool.query(
    `INSERT INTO publishers (country_id, name, homepage_url, domain, language) VALUES ($1, 'RTI', 'https://rti.ci', 'rti.ci', 'fr') RETURNING id`, [ci]);
  await pool.query(
    `INSERT INTO social_accounts (publisher_id, platform, url, platform_account_id, verification, status)
     VALUES ($1, 'youtube', $2, $3, 'linked_from_site', 'active'), ($1, 'youtube', $4, $5, 'linked_from_site', 'active')`,
    [p.id, `https://www.youtube.com/channel/${UC(1)}`, UC(1), `https://www.youtube.com/channel/${UC(3)}`, UC(3)]);
});

test('logoOf keeps only https images on YouTube hosts', () => {
  assert.equal(logoOf({ thumbnails: { high: { url: 'https://yt3.ggpht.com/a=s240' } } }), 'https://yt3.ggpht.com/a=s240');
  assert.equal(logoOf({ thumbnails: { medium: { url: 'https://yt3.googleusercontent.com/b' } } }), 'https://yt3.googleusercontent.com/b');
  assert.equal(logoOf({ thumbnails: { high: { url: 'https://evil.example/x.png' } } }), null);
  assert.equal(logoOf({ thumbnails: { high: { url: 'http://yt3.ggpht.com/a' } } }), null);
  assert.equal(logoOf({}), null);
});

test('one run: logos on every row of a channel, curated logo kept, numbers only for linked accounts', async () => {
  const channels = {};
  for (const n of [1, 2, ...Array.from({ length: 50 }, (_, i) => i + 10)]) channels[UC(n)] = channel(UC(n));
  channels[UC(3)] = channel(UC(3), { hidden: true });
  channels[UC(5)] = channel(UC(5), { logo: 'https://evil.example/x.png' });
  const yt = fakeYoutube(channels);
  const out = await refreshChannelLogos(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: NOW });

  assert.equal(out.status, 'ok');
  assert.equal(yt.calls.length, 2, '55 channel ids = 2 calls of up to 50');
  assert.ok(yt.calls.every((c) => c.kind === 'channels'));
  assert.equal(out.checked, 55);
  assert.equal(out.missing, 1, 'UC4 not returned');
  assert.equal(out.quota, 2);

  const logo = async (name) => (await pool.query('SELECT logo_url FROM video_channels WHERE name = $1', [name])).rows[0].logo_url;
  assert.equal(await logo('RTI 1'), `https://yt3.ggpht.com/${UC(1)}=s240`);
  assert.equal(await logo('RTI 1 (direct)'), `https://yt3.ggpht.com/${UC(1)}=s240`);
  assert.equal(await logo('Curated'), 'https://cdn.example/curated.png', 'a logo set by hand is never overwritten');
  assert.equal(await logo('Gone'), null);
  assert.equal(await logo('Bad host'), null, 'only YouTube image hosts are stored');
  assert.equal(await logo('Stream'), null);

  const { rows: metrics } = await pool.query(
    `SELECT sa.platform_account_id AS id, am.metric, am.value::bigint AS value FROM audience_metrics am JOIN social_accounts sa ON sa.id = am.social_account_id ORDER BY 1, 2`);
  assert.deepEqual(metrics.map((m) => [m.id, m.metric, Number(m.value)]), [
    [UC(1), 'subscribers', 1200], [UC(1), 'total_views', 500000], [UC(1), 'video_count', 40],
    [UC(3), 'total_views', 500000], [UC(3), 'video_count', 40],
  ], 'hidden subscriber count not stored; channels without an account row get no metrics');

  const { rows: [run] } = await pool.query(`SELECT status, quota_units, message FROM agent_runs WHERE agent = 'youtube' ORDER BY id DESC LIMIT 1`);
  assert.equal(run.status, 'ok');
  assert.equal(run.quota_units, 2, 'units charged to the youtube budget');
  assert.match(run.message, /^channel-logos: 55 checked/);
});

test('a second run within 20 h does nothing; a later run refreshes a logo it set', async () => {
  const yt = fakeYoutube({ [UC(1)]: channel(UC(1), { logo: 'https://yt3.ggpht.com/new=s240' }) });
  const again = await refreshChannelLogos(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: new Date(NOW.getTime() + 3600e3) });
  assert.match(again.skipped, /last 20 h/);
  assert.equal(yt.calls.length, 0);

  const later = await refreshChannelLogos(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: new Date(NOW.getTime() + 21 * 3600e3) });
  assert.equal(later.status, 'ok');
  const { rows: [r] } = await pool.query(`SELECT logo_url FROM video_channels WHERE name = 'RTI 1'`);
  assert.equal(r.logo_url, 'https://yt3.ggpht.com/new=s240');
  const { rows: [c] } = await pool.query(`SELECT logo_url FROM video_channels WHERE name = 'Curated'`);
  assert.equal(c.logo_url, 'https://cdn.example/curated.png');
});

test('no key, a paused agent or a used budget: no call', async () => {
  const yt = fakeYoutube({});
  const later = new Date(NOW.getTime() + 48 * 3600e3);
  assert.equal((await refreshChannelLogos(pool, { apiKey: '', fetchImpl: yt.fetchImpl, log: quiet, now: later })).skipped, 'no YOUTUBE_API_KEY');
  await pool.query(`UPDATE discovery_agents SET paused = true WHERE agent = 'youtube'`);
  assert.equal((await refreshChannelLogos(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: later })).skipped, 'paused');
  await pool.query(`UPDATE discovery_agents SET paused = false, daily_quota_units = 1 WHERE agent = 'youtube'`);
  assert.match((await refreshChannelLogos(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: later })).skipped, /quota budget used/);
  assert.equal(yt.calls.length, 0);
  await pool.query(`UPDATE discovery_agents SET paused = true, daily_quota_units = 8000 WHERE agent = 'youtube'`);
});
