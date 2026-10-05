// Meta Conversions API: what gets sent, when, and how it is recorded.
// Runs with a fake access token and a stubbed Graph API -- nothing leaves
// the machine.
process.env.META_ACCESS_TOKEN = 'test-token-not-real';
process.env.META_PIXEL_ID = '111122223333';
process.env.META_TEST_EVENT_CODE = 'TEST12345';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const metaCapi = require('../src/metaCapi');
const { resetFixtures } = require('../test-support/fixtures');
const { BROWSER_UA, trackBatch, freshIp, formBase, trackingContext, fakeResponse } = require('../test-support/helpers');

let app;
const calls = [];
let respondWith = 200;
const pool = () => getPool();

before(async () => {
  await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
  metaCapi._resetForTests();
  metaCapi.configure({
    fetch: async (url, opts) => {
      calls.push({ url, body: JSON.parse(opts.body) });
      return fakeResponse(respondWith, respondWith === 200 ? { events_received: 1 } : { error: { message: 'bad' } });
    },
  });
});

after(async () => {
  metaCapi._resetForTests();
  await app.close();
  await getPool().end();
});

const SESSION = { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'africa_news_test', fbclid: 'IwAR123', landing_page: '/youtube/video-01' };

test('advertising consent: mapped events are queued, sent with the shared event_id, then marked sent', async () => {
  const batch = trackBatch({
    advertising: true,
    session: SESSION,
    events: [
      { name: 'PageView', page_path: '/youtube/video-01' },
      { name: 'LandingPageView', page_path: '/youtube/video-01' }, // first-party only
      { name: 'YouTubeLandingPageView', page_path: '/youtube/video-01', country_iso: 'CI' },
    ],
  });
  batch.fbc = 'fb.1.1700000000000.IwAR123';
  batch.fbp = 'fb.1.1700000000000.987654321';
  const res = await app.inject({ method: 'POST', url: '/api/track', payload: batch, headers: { 'user-agent': BROWSER_UA, 'x-forwarded-for': '198.51.100.7' } });
  assert.equal(res.statusCode, 202);

  const { rows } = await pool().query('SELECT event_name, meta_status FROM analytics_events ORDER BY id');
  assert.deepEqual(rows.map((r) => r.meta_status), ['queued', 'not_applicable', 'queued']);

  await metaCapi.flush();
  assert.equal(calls.length, 1);
  const { url, body } = calls[0];
  assert.match(url, /graph\.facebook\.com\/v[\d.]+\/111122223333\/events\?access_token=/);
  assert.equal(body.test_event_code, 'TEST12345');
  assert.equal(body.data.length, 2);
  const [pv, vc] = body.data;
  assert.equal(pv.event_name, 'PageView');
  assert.equal(pv.event_id, batch.events[0].event_id, 'same id as the browser Pixel -> Meta deduplicates');
  assert.equal(pv.action_source, 'website');
  assert.equal(pv.event_source_url, 'https://nouvellesdupays.com/youtube/video-01');
  assert.equal(pv.user_data.client_ip_address, '198.51.100.7');
  assert.equal(pv.user_data.client_user_agent, BROWSER_UA);
  assert.equal(pv.user_data.fbc, 'fb.1.1700000000000.IwAR123');
  assert.equal(pv.user_data.fbp, 'fb.1.1700000000000.987654321');
  assert.match(pv.user_data.external_id[0], /^[0-9a-f]{64}$/, 'visitor id is hashed');
  assert.equal(vc.event_name, 'ViewContent');
  assert.equal(vc.custom_data.content_name, 'YouTubeLandingPageView');
  assert.equal(vc.custom_data.country, 'CI');

  const after = await pool().query(`SELECT meta_status FROM analytics_events WHERE meta_status <> 'not_applicable'`);
  assert.ok(after.rows.every((r) => r.meta_status === 'sent'));
});

test('no advertising consent: nothing is sent to Meta', async () => {
  calls.length = 0;
  const batch = trackBatch({ advertising: false, session: SESSION, events: [{ name: 'PageView', page_path: '/' }] });
  await app.inject({ method: 'POST', url: '/api/track', payload: batch, headers: { 'user-agent': BROWSER_UA } });
  await metaCapi.flush();
  assert.equal(calls.length, 0);
  const { rows: [e] } = await pool().query('SELECT meta_status FROM analytics_events WHERE event_id = $1', [batch.events[0].event_id]);
  assert.equal(e.meta_status, 'no_consent');
});

test('registration conversion: CompleteRegistration with hashed email only', async () => {
  calls.length = 0;
  const tracking = trackingContext({ advertising: true, session: SESSION });
  const res = await app.inject({
    method: 'POST', url: '/api/leads', headers: { 'x-forwarded-for': freshIp(), 'user-agent': BROWSER_UA },
    payload: { ...formBase(), email: 'Lead@Example.com', privacy_accepted: true, tracking },
  });
  assert.equal(res.statusCode, 201);
  await metaCapi.flush();
  assert.equal(calls.length, 1);
  const evt = calls[0].body.data[0];
  assert.equal(evt.event_name, 'CompleteRegistration');
  assert.equal(evt.event_id, tracking.event_id);
  assert.equal(evt.user_data.em[0], metaCapi.sha256('lead@example.com'));
  assert.ok(!JSON.stringify(calls[0].body).includes('Lead@Example.com'));
  assert.ok(!JSON.stringify(calls[0].body).toLowerCase().includes('lead@example.com'));
});

test('Graph API failure is recorded as failed (and logged), never thrown to the visitor', async () => {
  calls.length = 0;
  respondWith = 400;
  const batch = trackBatch({ advertising: true, session: SESSION, events: [{ name: 'PageView', page_path: '/' }] });
  const res = await app.inject({ method: 'POST', url: '/api/track', payload: batch, headers: { 'user-agent': BROWSER_UA } });
  assert.equal(res.statusCode, 202);
  await metaCapi.flush();
  const { rows: [e] } = await pool().query('SELECT meta_status FROM analytics_events WHERE event_id = $1', [batch.events[0].event_id]);
  assert.equal(e.meta_status, 'failed');
  respondWith = 200;
});

test('debug traffic reaches Meta only while a test event code is set', async () => {
  const settings = require('../src/settings');
  const send = async () => {
    calls.length = 0;
    const batch = trackBatch({ advertising: true, session: SESSION, events: [{ name: 'PageView', page_path: '/', debug: true }] });
    await app.inject({ method: 'POST', url: '/api/track', payload: batch, headers: { 'user-agent': BROWSER_UA } });
    await metaCapi.flush();
    const { rows: [e] } = await pool().query('SELECT meta_status, is_debug FROM analytics_events WHERE event_id = $1', [batch.events[0].event_id]);
    return e;
  };

  // Test code set (META_TEST_EVENT_CODE in this suite): routed to Test Events.
  let e = await send();
  assert.equal(e.is_debug, true);
  assert.equal(e.meta_status, 'sent');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.test_event_code, 'TEST12345');

  // No test code: kept out of the live dataset entirely.
  await pool().query(`INSERT INTO app_settings (key, value) VALUES ('meta_test_event_code', '""') ON CONFLICT (key) DO UPDATE SET value = '""'`);
  settings.invalidateSettingsCache();
  e = await send();
  assert.equal(e.meta_status, 'disabled');
  assert.equal(calls.length, 0);

  const cfg = await app.inject({ method: 'GET', url: '/api/tracking/config' });
  assert.equal(cfg.json().meta_test_mode, false);
  assert.ok(!('meta_test_event_code' in cfg.json()), 'the code itself is never public');

  await pool().query(`DELETE FROM app_settings WHERE key = 'meta_test_event_code'`);
  settings.invalidateSettingsCache();
});

test('CAPI disabled by admin setting -> events stored as "disabled"', async () => {
  await pool().query(`INSERT INTO app_settings (key, value) VALUES ('meta_capi_enabled', 'false') ON CONFLICT (key) DO UPDATE SET value = 'false'`);
  require('../src/settings').invalidateSettingsCache();
  const batch = trackBatch({ advertising: true, session: SESSION, events: [{ name: 'PageView', page_path: '/' }] });
  await app.inject({ method: 'POST', url: '/api/track', payload: batch, headers: { 'user-agent': BROWSER_UA } });
  const { rows: [e] } = await pool().query('SELECT meta_status FROM analytics_events WHERE event_id = $1', [batch.events[0].event_id]);
  assert.equal(e.meta_status, 'disabled');
});
