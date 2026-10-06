// GET /api/countries/:iso/video-channels -- Africa Voices (migration 014):
// pan-African channels stored once (country_id NULL) and returned for every
// African country, never for others, and never mixed into local_voices.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app;
const pool = () => getPool();
const realFetch = globalThis.fetch;

before(async () => {
  await resetFixtures();
  // latest-video lookups hit YouTube's public feed: stub it, nothing leaves the machine.
  globalThis.fetch = async () => ({ ok: false, status: 404, text: async () => '' });
  await pool().query('DELETE FROM video_channels');
  await pool().query(
    `INSERT INTO countries (iso_code, name, region, capital, population, languages, timezone, flag_url, lat, lng)
     VALUES ('FR', 'France', 'Western Europe', 'Paris', 68000000, ARRAY['French'], 'Europe/Paris', 'https://flagcdn.com/w320/fr.png', 48.85, 2.35)
     ON CONFLICT (iso_code) DO NOTHING`
  );
  await pool().query(
    `INSERT INTO video_channels (country_id, category, name, platform, youtube_channel_id, channel_url, rank)
     VALUES
       ((SELECT id FROM countries WHERE iso_code = 'CI'), 'local_voices', 'Voix CI', 'youtube', 'UCci0000000000000000000a', 'https://www.youtube.com/@voixci', 1),
       ((SELECT id FROM countries WHERE iso_code = 'FR'), 'local_voices', 'Voix FR', 'youtube', 'UCfr0000000000000000000a', 'https://www.youtube.com/@voixfr', 1),
       (NULL, 'africa_voices', 'Pan B', 'youtube', 'UCpan000000000000000000b', 'https://www.youtube.com/@panb', 2),
       (NULL, 'africa_voices', 'Pan A', 'youtube', 'UCpan000000000000000000a', 'https://www.youtube.com/@pana', 1)`
  );
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  globalThis.fetch = realFetch;
  await pool().query('DELETE FROM video_channels');
  await app.close();
  await getPool().end();
});

test('African country: own local_voices plus africa_voices (ranked), not mixed', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/countries/CI/video-channels' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.deepEqual(body.local_voices.map((c) => c.name), ['Voix CI']);
  assert.deepEqual(body.africa_voices.map((c) => c.name), ['Pan A', 'Pan B']);
  assert.equal(body.africa_voices[0].latest_video, null, 'feed lookup failure degrades to null');
});

test('African country with no channels of its own still gets Africa Voices', async () => {
  const body = (await app.inject({ method: 'GET', url: '/api/countries/NG/video-channels' })).json();
  assert.deepEqual(body.local_voices, []);
  assert.equal(body.africa_voices.length, 2);
});

test('non-African country: africa_voices is empty', async () => {
  const body = (await app.inject({ method: 'GET', url: '/api/countries/FR/video-channels' })).json();
  assert.deepEqual(body.local_voices.map((c) => c.name), ['Voix FR']);
  assert.deepEqual(body.africa_voices, []);
});

test('schema: only africa_voices rows may omit the country; no duplicate Africa Voices channel', async () => {
  await assert.rejects(
    pool().query(`INSERT INTO video_channels (country_id, category, name, channel_url) VALUES (NULL, 'local_voices', 'x', 'https://x')`),
    /video_channels_country_scope_check/
  );
  await assert.rejects(
    pool().query(`INSERT INTO video_channels (country_id, category, name, platform, youtube_channel_id, channel_url)
                  VALUES (NULL, 'africa_voices', 'dup', 'youtube', 'UCpan000000000000000000a', 'https://x')`),
    /uq_video_channels_africa_voices_channel/
  );
});
