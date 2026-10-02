const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');
const { freshIp, formBase, trackingContext, BROWSER_UA } = require('../test-support/helpers');

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

function post(url, payload, headers = {}) {
  return app.inject({
    method: 'POST', url, payload,
    headers: { 'x-forwarded-for': freshIp(), 'user-agent': BROWSER_UA, ...headers },
  });
}

const FB = { utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'africa_news_test', utm_content: 'video_02', landing_page: '/youtube/video-02' };

test('registration: valid sign-up stores the lead and records RegistrationCompleted server-side', async () => {
  const tracking = trackingContext({ session: FB });
  const res = await post('/api/leads', {
    ...formBase(), email: 'Reader@Example.com', name: 'Awa', country_iso: 'CI', interests: ['politics', 'videos', 'bogus'],
    privacy_accepted: true, marketing_consent: true, source_page: '/youtube/video-02', tracking,
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.new_registration, true);
  assert.equal(body.conversion_event_id, tracking.event_id);

  const { rows: [lead] } = await pool().query('SELECT * FROM leads WHERE email = $1', ['reader@example.com']);
  assert.ok(lead, 'email normalised to lower case');
  assert.deepEqual(lead.interests, ['politics', 'videos']);
  assert.equal(lead.utm_campaign, 'africa_news_test');
  assert.equal(lead.marketing_consent, true);

  const { rows: [evt] } = await pool().query('SELECT * FROM analytics_events WHERE event_id = $1', [tracking.event_id]);
  assert.equal(evt.event_name, 'RegistrationCompleted');
  assert.equal(evt.source, 'server');
  assert.equal(evt.utm_content, 'video_02');
  assert.equal(evt.country_iso, 'CI');
  assert.ok(!JSON.stringify(evt.properties).includes('@'), 'no email in event properties');
});

test('registration: a repeat email is accepted but is not a second conversion', async () => {
  const tracking = trackingContext();
  const res = await post('/api/leads', { ...formBase(), email: 'reader@example.com', privacy_accepted: true, tracking });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().new_registration, false);
  assert.equal(res.json().conversion_event_id, null);
  const { rows } = await pool().query('SELECT count(*)::int AS n FROM leads');
  assert.equal(rows[0].n, 1);
});

test('registration without analytics consent still stores the lead but no event', async () => {
  const res = await post('/api/leads', { ...formBase(), email: 'noconsent@example.com', privacy_accepted: true });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().conversion_event_id, null);
  const { rows: [lead] } = await pool().query('SELECT visitor_id, utm_source FROM leads WHERE email = $1', ['noconsent@example.com']);
  assert.equal(lead.visitor_id, null);
  assert.equal(lead.utm_source, null);
});

test('registration: invalid email, missing privacy acceptance, unknown country', async () => {
  assert.equal((await post('/api/leads', { ...formBase(), email: 'not-an-email', privacy_accepted: true })).statusCode, 400);
  assert.equal((await post('/api/leads', { ...formBase(), email: 'ok@example.com' })).statusCode, 400);
  assert.equal((await post('/api/leads', { ...formBase(), email: 'ok@example.com', privacy_accepted: true, country_iso: 'ZZ' })).statusCode, 400);
});

test('spam protection: honeypot, too-fast submission, missing timing', async () => {
  const honeypot = await post('/api/leads', { ...formBase(), website_hp: 'http://spam', email: 'bot@example.com', privacy_accepted: true });
  assert.equal(honeypot.statusCode, 400);
  assert.equal(honeypot.json().reason, 'honeypot');
  const fast = await post('/api/leads', { website_hp: '', form_started_at: Date.now() - 200, email: 'bot2@example.com', privacy_accepted: true });
  assert.equal(fast.json().reason, 'too_fast');
  const missing = await post('/api/leads', { email: 'bot3@example.com', privacy_accepted: true });
  assert.equal(missing.json().reason, 'missing_timing');
  const { rows } = await pool().query(`SELECT count(*)::int AS n FROM leads WHERE email LIKE 'bot%'`);
  assert.equal(rows[0].n, 0);
});

test('CSRF hardening: foreign Origin is refused and non-JSON bodies are 415', async () => {
  const foreign = await post('/api/leads', { ...formBase(), email: 'x@example.com', privacy_accepted: true }, { origin: 'https://evil.example' });
  assert.equal(foreign.statusCode, 403);
  const form = await app.inject({
    method: 'POST', url: '/api/leads', payload: 'email=x@example.com',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': freshIp() },
  });
  assert.equal(form.statusCode, 415);
});

test('XSS: HTML is stripped from free-text fields before storage', async () => {
  const res = await post('/api/leads', { ...formBase(), email: 'xss@example.com', name: '<script>alert(1)</script>Kofi', privacy_accepted: true });
  assert.equal(res.statusCode, 201);
  const { rows: [lead] } = await pool().query('SELECT name FROM leads WHERE email = $1', ['xss@example.com']);
  assert.equal(lead.name, 'alert(1) Kofi');
});

test('contact form stores the message and records ContactSubmitted', async () => {
  const tracking = trackingContext();
  const res = await post('/api/contact', { ...formBase(), name: 'Ama', email: 'ama@example.com', subject: 'Hello', message: 'I would like to partner with you.', tracking });
  assert.equal(res.statusCode, 201);
  const { rows: [evt] } = await pool().query('SELECT event_name FROM analytics_events WHERE event_id = $1', [tracking.event_id]);
  assert.equal(evt.event_name, 'ContactSubmitted');
  const short = await post('/api/contact', { ...formBase(), name: 'Ama', email: 'ama@example.com', message: 'hi' });
  assert.equal(short.statusCode, 400);
});
