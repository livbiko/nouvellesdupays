const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { EVENT_NAMES } = require('@nouvellesdupays/shared/src/trackingEvents');
const { classifyChannel, sanitizeProps, deviceClass } = require('../src/tracking');
const { resetFixtures } = require('../test-support/fixtures');
const { uuid, BROWSER_UA, trackBatch } = require('../test-support/helpers');

let app;
const pool = () => getPool();

before(async () => {
  await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
});

after(async () => {
  await app.close();
  await getPool().end();
});

function track(payload, headers = {}) {
  return app.inject({
    method: 'POST',
    url: '/api/track',
    headers: { 'user-agent': BROWSER_UA, 'content-type': 'application/json', ...headers },
    payload,
  });
}

const FB_AD = {
  utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'africa_news_test', utm_content: 'video_01',
  fbclid: 'IwAR0abc123', landing_page: '/youtube/video-01', referrer: 'https://l.facebook.com/',
};

test('event catalogue: web client list mirrors the server list exactly', () => {
  const ts = fs.readFileSync(path.join(__dirname, '../../web/src/lib/trackingEvents.ts'), 'utf8');
  const block = ts.slice(ts.indexOf('export const EVENT_NAMES'), ts.indexOf('] as const'));
  const webNames = [...block.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(webNames.sort(), [...EVENT_NAMES].sort());
});

test('GET /api/tracking/config returns only public settings', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/tracking/config' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.tracking_enabled, true);
  assert.equal(body.consent_mode, 'opt_in');
  assert.ok(!('meta_test_event_code' in body));
  assert.ok(!JSON.stringify(body).includes('token'));
});

test('classifyChannel: Facebook paid, organic, fbclid-only, search, direct', () => {
  assert.deepEqual(classifyChannel({ utm_source: 'facebook', utm_medium: 'paid_social' }), { channel: 'paid_social', is_facebook: true, is_paid: true });
  assert.deepEqual(classifyChannel({ utm_source: 'facebook', utm_medium: 'social' }), { channel: 'organic_social', is_facebook: true, is_paid: false });
  assert.deepEqual(classifyChannel({ fbclid: 'abc' }), { channel: 'organic_social', is_facebook: true, is_paid: false });
  assert.deepEqual(classifyChannel({ referrer: 'https://www.google.com/' }), { channel: 'organic_search', is_facebook: false, is_paid: false });
  assert.deepEqual(classifyChannel({ referrer: 'https://m.facebook.com/story' }), { channel: 'organic_social', is_facebook: true, is_paid: false });
  assert.deepEqual(classifyChannel({}), { channel: 'direct', is_facebook: false, is_paid: false });
  assert.equal(classifyChannel({ utm_source: 'google', utm_medium: 'cpc' }).channel, 'paid_search');
  assert.equal(classifyChannel({ utm_source: 'newsletter', utm_medium: 'email' }).channel, 'email');
});

test('sanitizeProps drops PII keys, email-like values, nested objects', () => {
  const out = sanitizeProps({ email: 'a@b.co', note: 'x@y.com', ok: 'fine', n: 3, nested: { a: 1 }, 'Bad-Key': 1, flag: true });
  assert.deepEqual(out, { ok: 'fine', n: 3, flag: true });
});

test('deviceClass buckets user agents', () => {
  assert.equal(deviceClass(BROWSER_UA), 'mobile');
  assert.equal(deviceClass('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');
  assert.equal(deviceClass('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
});

test('Facebook landing-page visit: session + events stored with full attribution', async () => {
  const visitorId = uuid();
  const sessionId = uuid();
  const res = await track(trackBatch({
    visitorId, sessionId, session: FB_AD,
    events: [
      { name: 'PageView', page_path: '/youtube/video-01' },
      { name: 'LandingPageView', page_path: '/youtube/video-01' },
      { name: 'YouTubeLandingPageView', page_path: '/youtube/video-01', country_iso: 'ci' },
    ],
  }));
  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.json(), { accepted: 3, duplicates: 0, rejected: 0 });

  const { rows: [s] } = await pool().query('SELECT * FROM analytics_sessions WHERE id = $1', [sessionId]);
  assert.equal(s.utm_campaign, 'africa_news_test');
  assert.equal(s.utm_content, 'video_01');
  assert.equal(s.fbclid, 'IwAR0abc123');
  assert.equal(s.channel, 'paid_social');
  assert.equal(s.is_facebook, true);
  assert.equal(s.landing_page, '/youtube/video-01');
  assert.equal(s.referrer, 'https://l.facebook.com/');
  assert.equal(s.device_class, 'mobile');
  assert.equal(s.page_views, 1);

  const { rows: [v] } = await pool().query('SELECT * FROM analytics_visitors WHERE id = $1', [visitorId]);
  assert.equal(v.first_utm_source, 'facebook');
  assert.equal(v.first_channel, 'paid_social');

  const { rows: events } = await pool().query('SELECT * FROM analytics_events WHERE session_id = $1 ORDER BY id', [sessionId]);
  assert.equal(events.length, 3);
  for (const e of events) {
    assert.equal(e.utm_campaign, 'africa_news_test');
    assert.equal(e.is_facebook, true);
    assert.equal(e.landing_page, '/youtube/video-01');
  }
  assert.equal(events[2].country_iso, 'CI');
  assert.equal(events[2].page_type, 'youtube_landing');
  // No advertising consent -> never forwarded to Meta.
  assert.equal(events[0].meta_status, 'no_consent');
});

test('navigation between pages keeps the session attribution (first write wins)', async () => {
  const visitorId = uuid();
  const sessionId = uuid();
  await track(trackBatch({ visitorId, sessionId, session: FB_AD, events: [{ name: 'PageView', page_path: '/youtube/video-01' }] }));
  // Second page: the browser still sends the session's original attribution;
  // even a conflicting payload must not overwrite what the session started with.
  const res = await track(trackBatch({
    visitorId, sessionId, session: { utm_source: 'twitter', landing_page: '/' },
    events: [{ name: 'PageView', page_path: '/' }, { name: 'CountrySelected', page_path: '/', country_iso: 'NG' }],
  }));
  assert.equal(res.statusCode, 202);
  const { rows: [s] } = await pool().query('SELECT * FROM analytics_sessions WHERE id = $1', [sessionId]);
  assert.equal(s.utm_source, 'facebook');
  assert.equal(s.page_views, 2);
  assert.equal(s.event_count, 3);
  const { rows } = await pool().query('SELECT DISTINCT utm_campaign FROM analytics_events WHERE session_id = $1', [sessionId]);
  assert.deepEqual(rows.map((r) => r.utm_campaign), ['africa_news_test']);
});

test('normal organic visit is classified organic, not Facebook', async () => {
  const sessionId = uuid();
  await track(trackBatch({ sessionId, session: { landing_page: '/', referrer: 'https://www.google.com/search?q=x' }, events: [{ name: 'PageView', page_path: '/' }] }));
  const { rows: [s] } = await pool().query('SELECT channel, is_facebook, is_paid, referrer FROM analytics_sessions WHERE id = $1', [sessionId]);
  assert.equal(s.channel, 'organic_search');
  assert.equal(s.is_facebook, false);
  assert.equal(s.is_paid, false);
  assert.equal(s.referrer, 'https://www.google.com/search', 'query string stripped from referrer');
});

test('fbclid-only attribution marks Facebook traffic without claiming it was paid', async () => {
  const sessionId = uuid();
  await track(trackBatch({ sessionId, session: { fbclid: 'IwAR_only', landing_page: '/' }, events: [{ name: 'PageView', page_path: '/' }] }));
  const { rows: [s] } = await pool().query('SELECT channel, is_facebook, is_paid, fbclid FROM analytics_sessions WHERE id = $1', [sessionId]);
  assert.equal(s.is_facebook, true);
  assert.equal(s.is_paid, false);
  assert.equal(s.fbclid, 'IwAR_only');
});

test('session persistence: a session id cannot be hijacked by another visitor', async () => {
  const sessionId = uuid();
  await track(trackBatch({ sessionId, events: [{ name: 'PageView', page_path: '/' }] }));
  const res = await track(trackBatch({ sessionId, events: [{ name: 'PageView', page_path: '/x' }] }));
  assert.equal(res.statusCode, 202);
  assert.equal(res.json().accepted, 0);
});

test('duplicate event ids are stored once', async () => {
  const batch = trackBatch({ events: [{ name: 'PageView', page_path: '/' }] });
  await track(batch);
  const res = await track(batch);
  assert.deepEqual(res.json(), { accepted: 0, duplicates: 1, rejected: 0 });
});

test('unknown event names are rejected; page paths lose their query string', async () => {
  const sessionId = uuid();
  const res = await track(trackBatch({
    sessionId,
    events: [{ name: 'NotARealEvent' }, { name: 'PageView', page_path: '/youtube/x?fbclid=123&email=a@b.co' }],
  }));
  assert.equal(res.json().accepted, 1);
  assert.equal(res.json().rejected, 1);
  const { rows: [e] } = await pool().query('SELECT page_path FROM analytics_events WHERE session_id = $1', [sessionId]);
  assert.equal(e.page_path, '/youtube/x');
});

test('no analytics consent, bots, and foreign origins are not tracked', async () => {
  const noConsent = trackBatch({ events: [{ name: 'PageView' }] });
  noConsent.consent = { analytics: false };
  assert.equal((await track(noConsent)).statusCode, 204);

  const bot = await track(trackBatch({ events: [{ name: 'PageView' }] }), { 'user-agent': 'Googlebot/2.1' });
  assert.equal(bot.statusCode, 204);

  const foreign = await track(trackBatch({ events: [{ name: 'PageView' }] }), { origin: 'https://evil.example' });
  assert.equal(foreign.statusCode, 403);
});

test('sendBeacon text/plain bodies are accepted; malformed bodies are 400', async () => {
  const batch = trackBatch({ events: [{ name: 'PageView', page_path: '/' }] });
  const ok = await track(JSON.stringify(batch), { 'content-type': 'text/plain' });
  assert.equal(ok.statusCode, 202);
  const bad = await track('{not json', { 'content-type': 'text/plain' });
  assert.equal(bad.statusCode, 400);
  const badIds = await track({ visitor_id: 'x', session_id: 'y', consent: { analytics: true }, events: [] });
  assert.equal(badIds.statusCode, 400);
});

test('tracking can be switched off by an admin setting', async () => {
  await pool().query(`INSERT INTO app_settings (key, value) VALUES ('tracking_enabled', 'false')`);
  require('../src/settings').invalidateSettingsCache();
  const res = await track(trackBatch({ events: [{ name: 'PageView' }] }));
  assert.equal(res.statusCode, 204);
  await pool().query(`DELETE FROM app_settings WHERE key = 'tracking_enabled'`);
  require('../src/settings').invalidateSettingsCache();
});
