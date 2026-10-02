const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');
const { BROWSER_UA, trackBatch } = require('../test-support/helpers');

let app;
let adminToken;
let v1;
let v2;
const pool = () => getPool();

const track = (payload) => app.inject({ method: 'POST', url: '/api/track', payload, headers: { 'user-agent': BROWSER_UA } });
const admin = (method, url, payload) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${adminToken}` } });

// A small, fully-known journey set. Every assertion below is computed by
// hand from these events -- the dashboard must reproduce them exactly.
//   A: Facebook ad video_01 -> landing -> thumbnail click -> play -> news click -> registration
//   B: Facebook ad video_02 -> landing -> Watch on YouTube (leaves)
//   C: Google organic -> home -> selects Côte d'Ivoire -> second page view
//   D: Facebook ad, debug/test mode (must be excluded by default)
before(async () => {
  await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
  adminToken = (await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } })).json().token;

  const ci = (await pool().query(`SELECT id FROM countries WHERE iso_code = 'CI'`)).rows[0].id;
  const ins = await pool().query(
    `INSERT INTO youtube_videos (youtube_video_id, slug, title, country_id, status, approved_at, category)
     VALUES ('vid01aaaaaa', 'video-01', 'Video one', $1, 'approved', now(), 'news'),
            ('vid02bbbbbb', 'video-02', 'Video two', $1, 'approved', now(), 'news')
     RETURNING id`,
    [ci]
  );
  [v1, v2] = ins.rows.map((r) => r.id);

  const fb = (content, landing) => ({
    utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'africa_news_test', utm_content: content, landing_page: landing,
  });
  const A = trackBatch({
    session: fb('video_01', '/youtube/video-01'),
    events: [
      { name: 'PageView', page_path: '/youtube/video-01' },
      { name: 'LandingPageView', page_path: '/youtube/video-01' },
      { name: 'YouTubeLandingPageView', page_path: '/youtube/video-01', video_id: v1 },
      { name: 'VideoThumbnailClick', page_path: '/youtube/video-01', video_id: v1 },
      { name: 'YouTubePlay', page_path: '/youtube/video-01', video_id: v1 },
      { name: 'NewsArticleClick', page_path: '/youtube/video-01', publisher_id: 1 },
      { name: 'RegistrationStarted', page_path: '/youtube/video-01' },
      { name: 'RegistrationCompleted', page_path: '/youtube/video-01' },
    ],
  });
  const B = trackBatch({
    session: fb('video_02', '/youtube/video-02'),
    events: [
      { name: 'PageView', page_path: '/youtube/video-02' },
      { name: 'LandingPageView', page_path: '/youtube/video-02' },
      { name: 'YouTubeLandingPageView', page_path: '/youtube/video-02', video_id: v2 },
      { name: 'WatchOnYouTube', page_path: '/youtube/video-02', video_id: v2 },
    ],
  });
  const C = trackBatch({
    session: { landing_page: '/', referrer: 'https://www.google.com/' },
    events: [
      { name: 'PageView', page_path: '/' },
      { name: 'LandingPageView', page_path: '/' },
      { name: 'CountrySelected', page_path: '/', country_iso: 'CI' },
      { name: 'PageView', page_path: '/register' },
    ],
  });
  const D = trackBatch({
    session: fb('video_01', '/youtube/video-01'),
    events: [{ name: 'PageView', page_path: '/youtube/video-01', debug: true }],
  });
  for (const batch of [A, B, C, D]) assert.equal((await track(batch)).statusCode, 202);
});

after(async () => {
  await app.close();
  await getPool().end();
});

test('analytics endpoints require admin auth', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/admin/analytics/dashboard' });
  assert.equal(res.statusCode, 401);
});

test('overview totals match the stored events exactly', async () => {
  const res = await admin('GET', '/api/admin/analytics/dashboard?range=7d&tz=Europe/London');
  assert.equal(res.statusCode, 200, res.body);
  const t = res.json().overview.totals;
  assert.equal(t.unique_visitors, 3);
  assert.equal(t.total_visitors, 3);
  assert.equal(t.sessions, 3);
  assert.equal(t.page_views, 4);
  assert.equal(t.facebook_visitors, 2);
  assert.equal(t.ad_visitors, 2);
  assert.equal(t.organic_visitors, 1);
  assert.equal(t.youtube_visitors, 2);
  assert.equal(t.landing_page_views, 3);
  assert.equal(t.clicks, 3);
  assert.equal(t.registration_starts, 1);
  assert.equal(t.registrations, 1);
  assert.equal(t.leads, 1);
  assert.equal(t.conversion_rate, 33.33);

  const series = res.json().overview.timeseries;
  assert.equal(series.length, 7);
  assert.equal(series.reduce((s, d) => s + d.page_views, 0), 4);
  const channels = Object.fromEntries(res.json().overview.channels.map((c) => [c.channel, c.sessions]));
  assert.deepEqual(channels, { paid_social: 2, organic_search: 1 });
});

test('debug events are excluded unless include_debug=1', async () => {
  const res = await admin('GET', '/api/admin/analytics/dashboard?range=today&include_debug=1');
  assert.equal(res.json().overview.totals.unique_visitors, 4);
});

test('campaign performance per ad, with cost per lead once spend is entered', async () => {
  const created = await admin('POST', '/api/admin/campaigns', { utm_campaign: 'africa_news_test', label: 'Africa news test', platform: 'meta' });
  assert.equal(created.statusCode, 201);
  const today = new Date().toISOString().slice(0, 10);
  const spend = await admin('POST', `/api/admin/campaigns/${created.json().id}/spend`, { spend_date: today, utm_content: 'video_01', amount: 10, currency: 'EUR', link_clicks: 5, impressions: 900 });
  assert.equal(spend.statusCode, 201);
  assert.equal((await admin('POST', `/api/admin/campaigns/${created.json().id}/spend`, { spend_date: 'yesterday', amount: 1 })).statusCode, 400);

  const res = await admin('GET', '/api/admin/analytics/dashboard?range=today&tz=UTC');
  const ads = res.json().campaigns.ads;
  const a1 = ads.find((r) => r.content === 'video_01');
  const a2 = ads.find((r) => r.content === 'video_02');
  assert.deepEqual(
    { visitors: a1.visitors, lpv: a1.landing_page_views, clicks: a1.clicks, regs: a1.registrations, cr: a1.conversion_rate, spend: a1.spend, cpl: a1.cost_per_lead },
    { visitors: 1, lpv: 2, clicks: 2, regs: 1, cr: 100, spend: 10, cpl: 10 }
  );
  assert.equal(a1.source, 'facebook');
  assert.equal(a1.medium, 'paid_social');
  assert.deepEqual({ visitors: a2.visitors, clicks: a2.clicks, regs: a2.registrations, spend: a2.spend, cpl: a2.cost_per_lead }, { visitors: 1, clicks: 1, regs: 0, spend: null, cpl: null });
  const total = res.json().campaigns.campaigns.find((c) => c.campaign === 'africa_news_test');
  assert.equal(total.visitors, 2);
  assert.equal(total.spend, 10);
  assert.equal(total.cost_per_lead, 10);
  assert.equal(total.link_clicks, 5);
});

test('landing pages and YouTube performance', async () => {
  const res = await admin('GET', '/api/admin/analytics/dashboard?range=today');
  const lp = res.json().landing_pages.find((r) => r.landing_page === '/youtube/video-01');
  assert.deepEqual({ v: lp.visitors, yt: lp.youtube_clicks, s: lp.registration_starts, c: lp.registrations, cr: lp.conversion_rate }, { v: 1, yt: 1, s: 1, c: 1, cr: 100 });
  const yt = Object.fromEntries(res.json().youtube.map((r) => [r.slug, r]));
  assert.deepEqual({ views: yt['video-01'].views, plays: yt['video-01'].plays, clicks: yt['video-01'].clicks, regs: yt['video-01'].registrations }, { views: 1, plays: 1, clicks: 1, regs: 1 });
  assert.deepEqual({ views: yt['video-02'].views, outbound: yt['video-02'].outbound_clicks, regs: yt['video-02'].registrations, cr: yt['video-02'].conversion_rate }, { views: 1, outbound: 1, regs: 0, cr: 0 });
});

test('Facebook funnel stages and percentages come from real sessions + entered Meta clicks', async () => {
  const res = await admin('GET', '/api/admin/analytics/funnel?range=today&scope=facebook');
  const stages = Object.fromEntries(res.json().stages.map((s) => [s.key, s]));
  assert.equal(stages.ad_clicks.count, 5);
  assert.equal(stages.landing.count, 2);
  assert.equal(stages.landing.rate_from_previous, 40);
  assert.equal(stages.video.count, 2);
  assert.equal(stages.engaged.count, 1);
  assert.equal(stages.engaged.rate_from_previous, 50);
  assert.equal(stages.started.count, 1);
  assert.equal(stages.completed.count, 1);
  assert.equal(stages.completed.rate_from_top, 20);

  const all = await admin('GET', '/api/admin/analytics/funnel?range=today&scope=all');
  const allStages = Object.fromEntries(all.json().stages.map((s) => [s.key, s]));
  assert.equal(allStages.ad_clicks.count, null);
  assert.equal(allStages.landing.count, 3);
});

test('filters: source, campaign, country (session-level), video', async () => {
  const q = async (qs) => (await admin('GET', `/api/admin/analytics/dashboard?range=today&${qs}`)).json().overview.totals;
  assert.equal((await q('source=facebook')).unique_visitors, 2);
  assert.equal((await q('campaign=africa_news_test')).unique_visitors, 2);
  assert.equal((await q('medium=paid_social')).registrations, 1);
  assert.equal((await q('country=CI')).unique_visitors, 1);
  assert.equal((await q('country=CI')).page_views, 2);
  assert.equal((await q(`video_id=${v2}`)).unique_visitors, 1);
  assert.equal((await q('landing_page=/youtube/video-01')).registrations, 1);
});

test('date filters: custom range validation, yesterday is empty', async () => {
  assert.equal((await admin('GET', '/api/admin/analytics/dashboard?range=custom&from=2026-02-01')).statusCode, 400);
  assert.equal((await admin('GET', '/api/admin/analytics/dashboard?range=custom&from=2026-02-10&to=2026-02-01')).statusCode, 400);
  assert.equal((await admin('GET', '/api/admin/analytics/dashboard?range=bogus')).statusCode, 400);
  assert.equal((await admin('GET', '/api/admin/analytics/dashboard?range=7d&tz=Not/AZone')).statusCode, 400);
  const y = await admin('GET', '/api/admin/analytics/dashboard?range=yesterday');
  assert.equal(y.json().overview.totals.unique_visitors, 0);
  assert.equal(y.json().overview.totals.conversion_rate, null, 'no fake 0% when there is no data');
  const today = new Date().toISOString().slice(0, 10);
  const c = await admin('GET', `/api/admin/analytics/dashboard?range=custom&from=${today}&to=${today}&tz=UTC`);
  assert.equal(c.json().overview.totals.unique_visitors, 3);
});

test('export: CSV and JSON with the same filters', async () => {
  const csv = await admin('GET', '/api/admin/analytics/export?range=today&dataset=events&format=csv&source=facebook');
  assert.equal(csv.statusCode, 200);
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.headers['content-disposition'], /attachment; filename="ndp-events-today-/);
  const lines = csv.body.trim().split('\n');
  assert.equal(lines.length, 1 + 12, 'header + 12 non-debug Facebook events');
  assert.ok(lines[0].startsWith('event_id,event_name'));

  const json = await admin('GET', '/api/admin/analytics/export?range=today&dataset=campaigns&format=json');
  const body = JSON.parse(json.body);
  assert.equal(body.dataset, 'campaigns');
  assert.equal(body.row_count, 2);
  assert.equal((await admin('GET', '/api/admin/analytics/export?dataset=nope')).statusCode, 400);
});

test('live test console lists recent events with truncated ids and Meta status', async () => {
  const res = await admin('GET', '/api/admin/analytics/live');
  const events = res.json().events;
  assert.equal(events.length, 17);
  assert.equal(events[0].visitor.length, 8);
  assert.ok(events.some((e) => e.is_debug));
  const newest = events[0].id;
  assert.equal((await admin('GET', `/api/admin/analytics/live?after_id=${newest}`)).json().events.length, 0);
});

test('filter options list campaigns, sources and landing pages actually seen', async () => {
  const res = await admin('GET', '/api/admin/analytics/filters?range=7d');
  const f = res.json();
  assert.deepEqual(f.campaigns, ['africa_news_test']);
  assert.deepEqual(f.sources, ['facebook']);
  assert.ok(f.landing_pages.includes('/youtube/video-01'));
  assert.equal(f.youtube_videos.length, 2);
});

test('settings: validated, secrets never returned, public config reflects changes', async () => {
  const get = await admin('GET', '/api/admin/settings');
  assert.equal(get.statusCode, 200);
  assert.equal(get.json().secrets.meta_access_token_configured, false);
  assert.ok(!JSON.stringify(get.json()).toLowerCase().includes('access_token"'));

  assert.equal((await admin('PUT', '/api/admin/settings', { meta_pixel_id: 'abc' })).statusCode, 400);
  assert.equal((await admin('PUT', '/api/admin/settings', { consent_mode: 'whatever' })).statusCode, 400);
  assert.equal((await admin('PUT', '/api/admin/settings', { unknown_key: true })).statusCode, 400);
  const put = await admin('PUT', '/api/admin/settings', { meta_pixel_id: '1234567890', meta_pixel_enabled: true, event_debug: true });
  assert.equal(put.statusCode, 200);
  const pub = (await app.inject({ method: 'GET', url: '/api/tracking/config' })).json();
  assert.equal(pub.meta_pixel_enabled, true);
  assert.equal(pub.meta_pixel_id, '1234567890');
  assert.equal(pub.event_debug, true);
});

test('admin lead list is protected', async () => {
  assert.equal((await app.inject({ method: 'GET', url: '/api/admin/leads' })).statusCode, 401);
  assert.equal((await admin('GET', '/api/admin/leads')).statusCode, 200);
});

