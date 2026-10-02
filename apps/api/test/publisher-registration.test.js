const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { validatePublicHttpUrl } = require('@nouvellesdupays/shared/src/urlSafety');
const { resetFixtures } = require('../test-support/fixtures');
const { freshIp, formBase, trackingContext, fakeResponse } = require('../test-support/helpers');

let app;
let adminToken;
const pool = () => getPool();
const realFetch = global.fetch;

before(async () => {
  await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } });
  adminToken = login.json().token;
});

afterEach(() => {
  global.fetch = realFetch;
});

after(async () => {
  await app.close();
  await getPool().end();
});

function register(payload) {
  return app.inject({ method: 'POST', url: '/api/publishers/register', payload, headers: { 'x-forwarded-for': freshIp() } });
}

function admin(method, url, payload) {
  return app.inject({ method, url, payload, headers: { authorization: `Bearer ${adminToken}` } });
}

const NO_FEED_SITE = {
  name: 'Abidjan Infos Locales',
  homepage_url: 'https://www.abidjan-infos-locales.ci/',
  country_iso: 'CI',
  region: 'Lagunes',
  city: 'Abidjan',
  language: 'fr',
  description: 'Actualités locales du district d’Abidjan.',
  categories: ['politics', 'local'],
  contact_name: 'Koffi',
  contact_email: 'redaction@abidjan-infos-locales.ci',
  facebook_url: 'https://www.facebook.com/abidjaninfos',
  x_url: 'https://x.com/abidjaninfos',
  category_urls: ['https://www.abidjan-infos-locales.ci/politique', 'https://www.abidjan-infos-locales.ci/societe'],
  article_url_patterns: ['/article/*'],
  permission_confirmed: true,
};

let noFeedId;

test('urlSafety blocks SSRF targets and malformed URLs', () => {
  for (const bad of ['javascript:alert(1)', 'http://localhost/x', 'http://127.0.0.1/', 'http://10.0.0.5/', 'http://192.168.1.1',
    'http://[::1]/', 'http://user:pass@example.com', 'ftp://example.com', 'http://intranet/', 'https://example.com:22/']) {
    assert.equal(validatePublicHttpUrl(bad).ok, false, bad);
  }
  assert.equal(validatePublicHttpUrl('https://www.example.com/path#frag').url, 'https://www.example.com/path');
});

test('website without any feed is accepted as SUBMITTED with its crawl hints', async () => {
  const tracking = trackingContext();
  const res = await register({ ...formBase(), ...NO_FEED_SITE, tracking });
  assert.equal(res.statusCode, 201, res.body);
  const body = res.json();
  assert.equal(body.status, 'submitted');
  assert.equal(body.ingestion_method, 'html');
  assert.equal(body.conversion_event_id, tracking.event_id);
  noFeedId = body.id;

  const { rows: [s] } = await pool().query('SELECT * FROM publisher_submissions WHERE id = $1', [noFeedId]);
  assert.equal(s.feed_url, null);
  assert.equal(s.domain, 'abidjan-infos-locales.ci');
  assert.deepEqual(s.category_urls, NO_FEED_SITE.category_urls);
  assert.deepEqual(s.article_url_patterns, ['/article/*']);
  assert.equal(s.permission_confirmed, true);
  assert.equal(s.x_url, 'https://x.com/abidjaninfos');
});

test('duplicate website (same domain) is refused', async () => {
  const res = await register({ ...formBase(), ...NO_FEED_SITE, name: 'Other name', homepage_url: 'https://abidjan-infos-locales.ci/fr' });
  assert.equal(res.statusCode, 409);
});

test('validation: invalid URL, private URL, invalid email, wrong social host, off-site category URL, permission', async () => {
  const cases = [
    [{ homepage_url: 'not a url' }, /homepage_url/],
    [{ homepage_url: 'http://192.168.0.10/' }, /Private IP/],
    [{ contact_email: 'nope@' }, /contact_email/],
    [{ facebook_url: 'https://evil.example/fb' }, /facebook/],
    [{ category_urls: ['https://elsewhere.example/news'] }, /not on/],
    [{ article_url_patterns: ['<script>'] }, /invalid pattern/],
    [{ categories: ['made-up'] }, /category/],
  ];
  for (const [patch, re] of cases) {
    const res = await register({ ...formBase(), ...NO_FEED_SITE, homepage_url: 'https://valid-new-site.example/', category_urls: [], ...patch });
    assert.equal(res.statusCode, 400, JSON.stringify(patch));
    assert.match(res.json().error, re);
  }
  const noPermission = await register({ ...formBase(), ...NO_FEED_SITE, homepage_url: 'https://valid-new-site.example/', category_urls: [], permission_confirmed: false });
  assert.equal(noPermission.statusCode, 400);
  const noEmail = await register({ ...formBase(), ...NO_FEED_SITE, homepage_url: 'https://valid-new-site.example/', category_urls: [], contact_email: '' });
  assert.equal(noEmail.statusCode, 400, 'contact email required when there is no feed');
});

test('spam submission is rejected before any outbound fetch', async () => {
  let fetched = false;
  global.fetch = async () => {
    fetched = true;
    return fakeResponse(500, '');
  };
  const res = await register({ ...NO_FEED_SITE, website_hp: 'spam', form_started_at: Date.now() - 5000, homepage_url: 'https://spam.example/', feed_url: 'https://spam.example/rss' });
  assert.equal(res.statusCode, 400);
  assert.equal(fetched, false);
});

test('feed-based registration still verifies the feed (existing flow) -> PENDING', async () => {
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
    <item><title>Premier article</title><link>https://feedsite.example/a1</link></item></channel></rss>`;
  global.fetch = async (url) => (String(url) === 'https://feedsite.example/rss' ? fakeResponse(200, rss) : fakeResponse(404, ''));
  const res = await register({ ...formBase(), name: 'Feed Site', homepage_url: 'https://feedsite.example/', feed_url: 'https://feedsite.example/rss', country_iso: 'NG', language: 'en', permission_confirmed: true });
  assert.equal(res.statusCode, 201, res.body);
  assert.equal(res.json().status, 'pending');
  assert.equal(res.json().feed_type, 'rss');
});

test('feed that fails verification is refused with 422', async () => {
  global.fetch = async () => fakeResponse(404, '');
  const res = await register({ ...formBase(), name: 'Broken Feed', homepage_url: 'https://broken.example/', feed_url: 'https://broken.example/rss', country_iso: 'NG', language: 'en', permission_confirmed: true });
  assert.equal(res.statusCode, 422);
});

test('admin workflow: SUBMITTED -> PENDING REVIEW -> APPROVED -> ACTIVE -> SUSPENDED', async () => {
  const review = await admin('POST', `/api/admin/submissions/${noFeedId}/review`);
  assert.equal(review.json().status, 'pending');

  const approve = await admin('POST', `/api/admin/submissions/${noFeedId}/approve`);
  assert.equal(approve.statusCode, 200);
  assert.equal(approve.json().live, false);
  const publisherId = approve.json().publisher_id;

  const { rows: [pub] } = await pool().query('SELECT feed_status, x_url, facebook_url, city FROM publishers WHERE id = $1', [publisherId]);
  assert.equal(pub.feed_status, 'pending', 'feed-less publisher is not crawled until activated');
  assert.equal(pub.city, 'Abidjan');
  const { rows: sources } = await pool().query('SELECT * FROM feeds WHERE publisher_id = $1', [publisherId]);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].feed_type, 'html');
  assert.equal(sources[0].crawl_frequency_minutes, 60);
  assert.equal(sources[0].respect_robots_txt, true);
  assert.deepEqual(sources[0].allowed_domains, ['abidjan-infos-locales.ci']);

  const activate = await admin('POST', `/api/admin/submissions/${noFeedId}/activate`);
  assert.equal(activate.json().status, 'active');
  const { rows: [active] } = await pool().query('SELECT feed_status FROM publishers WHERE id = $1', [publisherId]);
  assert.equal(active.feed_status, 'active');

  const suspend = await admin('POST', `/api/admin/submissions/${noFeedId}/suspend`, { note: 'paused' });
  assert.equal(suspend.json().status, 'suspended');
  const { rows: [susp] } = await pool().query('SELECT feed_status FROM publishers WHERE id = $1', [publisherId]);
  assert.equal(susp.feed_status, 'suspended');

  // Reactivation is allowed from suspended.
  assert.equal((await admin('POST', `/api/admin/submissions/${noFeedId}/activate`)).json().status, 'active');
});

test('admin: rejection of a submitted website, and invalid transitions are 404', async () => {
  const res = await register({ ...formBase(), ...NO_FEED_SITE, homepage_url: 'https://to-reject.example/', category_urls: [] });
  const id = res.json().id;
  const reject = await admin('POST', `/api/admin/submissions/${id}/reject`, { note: '<b>Not a news site</b>' });
  assert.equal(reject.json().status, 'rejected');
  const { rows: [s] } = await pool().query('SELECT reviewer_note FROM publisher_submissions WHERE id = $1', [id]);
  assert.equal(s.reviewer_note, 'Not a news site');
  assert.equal((await admin('POST', `/api/admin/submissions/${id}/approve`)).statusCode, 404);
  assert.equal((await admin('POST', `/api/admin/submissions/${id}/activate`)).statusCode, 404);
});

test('admin: activating a website with no configurable source is refused', async () => {
  const res = await register({ ...formBase(), ...NO_FEED_SITE, name: 'API Only News', homepage_url: 'https://api-only.example/', category_urls: [], api_url: 'https://api-only.example/api/v1/news' });
  assert.equal(res.json().ingestion_method, 'api');
  const id = res.json().id;
  await admin('POST', `/api/admin/submissions/${id}/approve`);
  const act = await admin('POST', `/api/admin/submissions/${id}/activate`);
  assert.equal(act.statusCode, 409);
});

test('admin: source configuration is validated and the test endpoint is a dry run', async () => {
  const { rows: [feed] } = await pool().query(`SELECT f.id FROM feeds f WHERE f.feed_type = 'html' LIMIT 1`);
  const bad = await admin('PATCH', `/api/admin/sources/${feed.id}`, { crawl_frequency_minutes: 1 });
  assert.equal(bad.statusCode, 400);
  const ok = await admin('PATCH', `/api/admin/sources/${feed.id}`, { crawl_frequency_minutes: 120, allowed_domains: 'abidjan-infos-locales.ci', article_url_patterns: ['/article/*', '/actu/*'] });
  assert.equal(ok.statusCode, 200);

  const home = '<a href="/article/une-premiere-histoire-locale">x</a><a href="/contact">c</a>';
  const article = '<html><head><meta property="og:title" content="Une première histoire"><meta property="article:published_time" content="2026-09-30T10:00:00Z"></head></html>';
  global.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith('/robots.txt')) return fakeResponse(404, '');
    if (u.includes('/article/')) return fakeResponse(200, article);
    return fakeResponse(200, home);
  };
  const before = await pool().query('SELECT count(*)::int AS n FROM articles');
  const test = await admin('POST', `/api/admin/sources/${feed.id}/test`);
  assert.equal(test.statusCode, 200);
  assert.equal(test.json().ok, true);
  assert.equal(test.json().sample[0].title, 'Une première histoire');
  const afterCount = await pool().query('SELECT count(*)::int AS n FROM articles');
  assert.equal(afterCount.rows[0].n, before.rows[0].n, 'test does not insert articles');
});

test('admin: publisher list exposes status, crawl health, article count and traffic', async () => {
  const res = await admin('GET', '/api/admin/publishers');
  const pub = res.json().find((p) => p.name === 'Abidjan Infos Locales');
  assert.ok(pub);
  for (const k of ['article_count', 'last_success_at', 'last_error', 'clicks_30d', 'source_types']) assert.ok(k in pub, k);
  const patch = await admin('PATCH', `/api/admin/publishers/${pub.id}`, { instagram_url: 'https://evil.example/' });
  assert.equal(patch.statusCode, 400);
  const patch2 = await admin('PATCH', `/api/admin/publishers/${pub.id}`, { feed_status: 'suspended', city: 'Bouaké' });
  assert.equal(patch2.statusCode, 200);
});
