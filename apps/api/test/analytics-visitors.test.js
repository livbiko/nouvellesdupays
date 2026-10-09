const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');
const { BROWSER_UA, trackBatch } = require('../test-support/helpers');

let app;
let adminToken;
const pool = () => getPool();
const uuid = () => crypto.randomUUID();
const track = (payload) => app.inject({ method: 'POST', url: '/api/track', payload, headers: { 'user-agent': BROWSER_UA } });

// Six visitors with a known first source, sent through the real /api/track:
const V = { fb: uuid(), google: uuid(), direct: uuid(), whatsapp: uuid(), referral: uuid(), email: uuid() };

before(async () => {
  await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
  adminToken = (await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } })).json().token;

  const visit = (visitorId, session, events = [{ name: 'PageView', page_path: '/' }]) =>
    track(trackBatch({ visitorId, sessionId: uuid(), session: { landing_page: '/', ...session }, events }));

  for (const res of await Promise.all([
    visit(V.fb, { fbclid: 'IwAR0abc123' }),
    visit(V.google, { referrer: 'https://www.google.com/' }, [
      { name: 'PageView', page_path: '/' },
      { name: 'CountrySelected', page_path: '/', country_iso: 'CI' },
    ]),
    visit(V.direct, {}),
    visit(V.whatsapp, { utm_source: 'whatsapp', utm_medium: 'social' }),
    visit(V.referral, { referrer: 'https://www.lefaso.net/spip.php?article1' }),
    visit(V.email, { utm_source: 'friends', utm_medium: 'email', utm_campaign: 'test_invite_oct26' }),
  ])) assert.equal(res.statusCode, 202, res.body);
  // The Google visitor comes back directly the same day (second session).
  assert.equal((await visit(V.google, {})).statusCode, 202);

  // The Google visitor signs up; another sign-up comes from someone who refused analytics cookies.
  await pool().query(
    `INSERT INTO leads (email, email_hash, name, privacy_accepted_at, visitor_id) VALUES
       ('ama@example.com', 'h1', 'Ama', now(), $1),
       ('nocookies@example.com', 'h2', 'Kofi', now(), NULL)`,
    [V.google]
  );
});

after(async () => {
  await app.close();
  await getPool().end();
});

const dashboard = async (qs = 'range=today&tz=UTC') => {
  const res = await app.inject({ method: 'GET', url: `/api/admin/analytics/dashboard?${qs}`, headers: { authorization: `Bearer ${adminToken}` } });
  assert.equal(res.statusCode, 200, res.body);
  return res.json().visitors;
};

test('visitors by first source: Facebook, Google, direct, WhatsApp, referring site, email', async () => {
  const v = await dashboard();
  const by = Object.fromEntries(v.sources.map((s) => [s.source, s]));
  assert.deepEqual(Object.keys(by).sort(), ['direct', 'email', 'facebook', 'google', 'referral', 'whatsapp']);
  for (const s of v.sources) assert.equal(s.visitors, 1, s.source);
  assert.equal(v.total_visitors, 6);
  assert.equal(by.google.returning_visitors, 1, 'two sessions = returning');
  assert.equal(by.google.leads, 1);
  assert.equal(by.google.lead_rate, 100);
  assert.equal(by.facebook.leads, 0);
  assert.deepEqual(by.referral.referrers, ['lefaso.net'], 'referring host, www. and path removed');
  assert.equal(v.untracked_leads, 1, 'the cookie-less sign-up is counted, not attributed');
});

test('visitor list: newest first, with source, visits, countries and the lead', async () => {
  const v = await dashboard();
  assert.equal(v.visitors.length, 6);
  const g = v.visitors.find((x) => x.visitor_id === V.google);
  assert.equal(g.source, 'google');
  assert.equal(g.sessions, 2);
  assert.deepEqual(g.countries, ['CI']);
  assert.equal(g.lead.email, 'ama@example.com');
  assert.equal(g.lead.name, 'Ama');
  const e = v.visitors.find((x) => x.visitor_id === V.email);
  assert.equal(e.campaign, 'test_invite_oct26');
  assert.equal(v.visitors.find((x) => x.visitor_id === V.fb).lead, null);
  const times = v.visitors.map((x) => new Date(x.last_seen_at).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => b - a));
});

test('the dashboard filters apply: a campaign filter keeps only that campaign’s visitors', async () => {
  const v = await dashboard('range=today&tz=UTC&campaign=test_invite_oct26');
  assert.deepEqual(v.sources.map((s) => s.source), ['email']);
  assert.equal(v.visitors.length, 1);
});
