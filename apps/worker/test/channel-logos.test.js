// CR-2026-11-17-04: directory channel logos against the test database with a fake YouTube API (no network, no key).
// (DATABASE_URL must point at nouvellesdupays_test -- tables are truncated)
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { refreshChannelLogos, refreshLatestUploads, uploadsReserve, logoOf, uploadOf } = require('../src/channel-logos');

const pool = getPool();
const quiet = () => {};
const UC = (n) => `UC${String(n).padStart(22, 'y')}`;
const NOW = new Date('2026-11-18T10:00:00Z');

function fakeYoutube(channels, uploads = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    const u = new URL(url);
    const kind = u.pathname.split('/').pop();
    calls.push({ kind, ids: (u.searchParams.get('id') || '').split(','), playlist: u.searchParams.get('playlistId') });
    if (kind === 'playlistItems') {
      const list = uploads[u.searchParams.get('playlistId')];
      if (list === 'missing') return { ok: false, status: 404, text: async () => '{"error":{"errors":[{"reason":"playlistNotFound"}]}}' };
      return { ok: true, json: async () => ({ items: list || [] }) };
    }
    const items = (u.searchParams.get('id') || '').split(',').map((id) => channels[id]).filter(Boolean);
    return { ok: true, json: async () => ({ items }) };
  };
  return { calls, fetchImpl };
}

const upload = (id, title, publishedAt, thumb = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`) => ({
  snippet: { title, thumbnails: { medium: { url: thumb } } }, contentDetails: { videoId: id, videoPublishedAt: publishedAt },
});

const channel = (id, { logo = `https://yt3.ggpht.com/${id}=s240`, subs = '1200', hidden = false } = {}) => ({
  id,
  snippet: { title: id, thumbnails: { default: { url: 'https://yt3.ggpht.com/small' }, high: { url: logo } } },
  statistics: { subscriberCount: subs, viewCount: '500000', videoCount: '40', hiddenSubscriberCount: hidden },
});

let ci;
before(async () => {
  if (!/nouvellesdupays_test/.test(process.env.DATABASE_URL || '')) throw new Error('DATABASE_URL must point at nouvellesdupays_test');
  await pool.query('TRUNCATE countries, publishers, creators, video_channels, agent_runs, discovery_jobs RESTART IDENTITY CASCADE');
  await pool.query('DELETE FROM channel_metrics');
  await pool.query('DELETE FROM channel_videos');
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
  const uploads = {
    [`UU${UC(1).slice(2)}`]: [
      upload('aaaaaaaaaa1', 'RTI 1 : journal de 20 h', '2026-11-18T08:00:00Z'),
      upload('aaaaaaaaaa2', 'Old \u0000show', '2026-09-01T08:00:00Z'),                 // older than 30 days: not kept
      upload('aaaaaaaaaa3', 'Private video', undefined),                                // no publish date: skipped
      upload('aaaaaaaaaa4', 'Odd thumbnail', '2026-11-17T08:00:00Z', 'https://evil.example/t.jpg'),
    ],
    [`UU${UC(2).slice(2)}`]: 'missing',                                                  // no uploads playlist: skipped
  };
  const yt = fakeYoutube(channels, uploads);
  const out = await refreshChannelLogos(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: NOW });

  assert.equal(out.status, 'ok');
  assert.equal(yt.calls.filter((c) => c.kind === 'channels').length, 2, '55 channel ids = 2 calls of up to 50');
  assert.equal(yt.calls.filter((c) => c.kind === 'playlistItems').length, 54, 'one uploads call per returned channel');
  assert.equal(out.checked, 55);
  assert.equal(out.missing, 1, 'UC4 not returned');
  assert.equal(out.quota, 56);

  // CR-2026-11-18-08: the uploads kept.
  const { rows: vids } = await pool.query('SELECT youtube_video_id, channel_key, title, thumbnail_url FROM channel_videos ORDER BY 1');
  assert.deepEqual(vids, [
    { youtube_video_id: 'aaaaaaaaaa1', channel_key: UC(1), title: 'RTI 1 : journal de 20 h', thumbnail_url: 'https://i.ytimg.com/vi/aaaaaaaaaa1/mqdefault.jpg' },
    { youtube_video_id: 'aaaaaaaaaa4', channel_key: UC(1), title: 'Odd thumbnail', thumbnail_url: null },
  ]);
  assert.deepEqual([out.uploads, out.uploadChannels, out.uploadFailed], [2, 53, 1]);

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

  // CR-2026-11-18-01: every returned channel's numbers in channel_metrics, keyed by channel id (54 returned: 53 x 3
  // metrics + UC3 with its hidden subscriber count left out).
  const { rows: [cm] } = await pool.query(`SELECT count(*)::int AS n, count(DISTINCT channel_key)::int AS channels,
    count(*) FILTER (WHERE channel_key = $1 AND metric = 'subscribers')::int AS hidden FROM channel_metrics`, [UC(3)]);
  assert.deepEqual(cm, { n: 161, channels: 54, hidden: 0 });
  assert.equal(out.channelMetrics, 161);
  const { rows: [rti] } = await pool.query(`SELECT value::int AS value FROM channel_metrics WHERE channel_key = $1 AND metric = 'subscribers'`, [UC(1)]);
  assert.equal(rti.value, 1200);

  const { rows: [run] } = await pool.query(`SELECT status, quota_units, message FROM agent_runs WHERE agent = 'youtube' ORDER BY id DESC LIMIT 1`);
  assert.equal(run.status, 'ok');
  assert.equal(run.quota_units, 56, 'units charged to the youtube budget');
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

test('uploadOf: id, title, date and thumbnail host checks', () => {
  const now = new Date('2026-11-18T10:00:00Z');
  assert.equal(uploadOf(upload('bad', 't', '2026-11-18T08:00:00Z'), now), null, 'not an 11-char video id');
  assert.equal(uploadOf(upload('aaaaaaaaaa1', '  ', '2026-11-18T08:00:00Z'), now), null, 'no title');
  assert.equal(uploadOf(upload('aaaaaaaaaa1', 't', 'nope'), now), null, 'no date');
  assert.equal(uploadOf(upload('aaaaaaaaaa1', 't', '2026-10-01T08:00:00Z'), now), null, 'older than 30 days');
  assert.deepEqual(uploadOf(upload('aaaaaaaaaa1', 'A\u0000b', '2026-11-18T08:00:00Z'), now),
    { id: 'aaaaaaaaaa1', title: 'Ab', published: new Date('2026-11-18T08:00:00Z'), thumb: 'https://i.ytimg.com/vi/aaaaaaaaaa1/mqdefault.jpg' });
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

// Runs last: its run is dated 40 days later, which the 20 h guard of any later test would see.
test('uploads: a budget that runs out stops only the uploads step; old videos are purged', async () => {
  const later = new Date(NOW.getTime() + 40 * 864e5);
  await pool.query(`UPDATE discovery_agents SET paused = false, daily_quota_units = 3 WHERE agent = 'youtube'`);
  const channels = {};
  for (const n of [1, 2, ...Array.from({ length: 50 }, (_, i) => i + 10)]) channels[UC(n)] = channel(UC(n));
  const yt = fakeYoutube(channels, {});
  try {
    const out = await refreshChannelLogos(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: later });
    assert.equal(out.status, 'ok', 'logos and numbers were stored; only the uploads step stopped');
    assert.equal(out.quota, 3);
    assert.equal(out.uploadChannels, 1);
    assert.match(out.stopped, /^uploads: quota budget reached/);
    const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM channel_videos');
    assert.equal(n, 0, 'videos published 40+ days before this run are purged');
  } finally {
    await pool.query(`UPDATE discovery_agents SET daily_quota_units = 8000 WHERE agent = 'youtube'`);
  }
});

// CR-2026-11-26-02: the uploads alone every 3 h, after the 40-day run above (which stored the numbers of 52 channels).
test('uploads every 3 h: only playlistItems, only channels the daily run saw, spacing and budget', async () => {
  const t0 = new Date(NOW.getTime() + 41 * 864e5);
  await pool.query(`UPDATE discovery_agents SET paused = false, daily_quota_units = 8000 WHERE agent = 'youtube'`);
  const uploads = { [`UU${UC(1).slice(2)}`]: [upload('bbbbbbbbbb1', 'RTI 1 : midi', new Date(t0.getTime() - 3600e3).toISOString())] };
  try {
    assert.equal(await uploadsReserve(pool, t0), 57, '52 channels seen in the last 3 days + 5');
    const yt = fakeYoutube({}, uploads);
    const out = await refreshLatestUploads(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: t0 });
    assert.equal(out.status, 'ok');
    assert.equal(yt.calls.filter((c) => c.kind === 'channels').length, 0, 'no channels.list call');
    assert.equal(yt.calls.filter((c) => c.kind === 'playlistItems').length, 52);
    assert.ok(!yt.calls.some((c) => c.playlist === `UU${UC(4).slice(2)}`), 'a channel the API does not return is not fetched');
    assert.deepEqual([out.uploads, out.uploadChannels, out.quota], [1, 52, 52]);
    const { rows: [v] } = await pool.query(`SELECT channel_key, title FROM channel_videos WHERE youtube_video_id = 'bbbbbbbbbb1'`);
    assert.deepEqual(v, { channel_key: UC(1), title: 'RTI 1 : midi' });
    const { rows: [run] } = await pool.query(`SELECT status, quota_units, message FROM agent_runs WHERE agent = 'youtube' ORDER BY id DESC LIMIT 1`);
    assert.equal(run.quota_units, 52);
    assert.match(run.message, /^channel-uploads: 1 uploads from 52 of 52 channels/);

    const soon = fakeYoutube({}, uploads);
    const again = await refreshLatestUploads(pool, { apiKey: 'k', fetchImpl: soon.fetchImpl, log: quiet, now: new Date(t0.getTime() + 2 * 3600e3) });
    assert.match(again.skipped, /last 3 h/);
    assert.equal(soon.calls.length, 0);
    const third = await refreshLatestUploads(pool, { apiKey: 'k', fetchImpl: soon.fetchImpl, log: quiet, now: new Date(t0.getTime() + 3 * 3600e3 + 60e3) });
    assert.equal(third.status, 'ok', 'due again after 3 h');

    await pool.query(`UPDATE discovery_agents SET daily_quota_units = 150 WHERE agent = 'youtube'`);
    const poor = fakeYoutube({}, uploads);
    const none = await refreshLatestUploads(pool, { apiKey: 'k', fetchImpl: poor.fetchImpl, log: quiet, now: new Date(t0.getTime() + 7 * 3600e3) });
    assert.match(none.skipped, /quota budget used \(46 left, 52 needed\)/, 'never starts a run it cannot finish');
    assert.equal(poor.calls.length, 0);
  } finally {
    await pool.query(`UPDATE discovery_agents SET paused = true, daily_quota_units = 8000 WHERE agent = 'youtube'`);
  }
});

test('a daily channel-logos run counts as an uploads run', async () => {
  const t = new Date(NOW.getTime() + 50 * 864e5);
  await pool.query(`UPDATE discovery_agents SET paused = false WHERE agent = 'youtube'`);
  try {
    const channels = { [UC(1)]: channel(UC(1)) };
    await refreshChannelLogos(pool, { apiKey: 'k', fetchImpl: fakeYoutube(channels).fetchImpl, log: quiet, now: t });
    const yt = fakeYoutube({});
    const out = await refreshLatestUploads(pool, { apiKey: 'k', fetchImpl: yt.fetchImpl, log: quiet, now: new Date(t.getTime() + 3600e3) });
    assert.match(out.skipped, /last 3 h/);
    assert.equal(yt.calls.length, 0);
  } finally {
    await pool.query(`UPDATE discovery_agents SET paused = true WHERE agent = 'youtube'`);
  }
});
