const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const youtube = require('../src/youtube');
const { resetFixtures } = require('../test-support/fixtures');
const { freshIp, formBase, trackingContext, fakeResponse } = require('../test-support/helpers');

let app;
let adminToken;
const pool = () => getPool();

// Fake YouTube: oEmbed + per-channel Atom feed + handle pages.
const VIDEOS = {
  dQw4w9WgXcQ: { title: 'Élections 2026 : le débat à Abidjan', author_name: 'Abidjan TV', author_url: 'https://www.youtube.com/@AbidjanTV', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
  aaaaaaaaaaa: { title: 'Second video', author_name: 'Abidjan TV', author_url: 'https://www.youtube.com/@AbidjanTV', thumbnail_url: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hqdefault.jpg' },
};
function fakeYoutube(url) {
  const u = new URL(String(url));
  if (u.pathname === '/oembed') {
    const id = new URL(u.searchParams.get('url')).searchParams.get('v');
    if (id === 'privateVid1') return fakeResponse(401, 'Unauthorized');
    if (id === 'unreachabl1') throw new Error('ECONNRESET');
    return VIDEOS[id] ? fakeResponse(200, VIDEOS[id]) : fakeResponse(404, 'Not Found');
  }
  if (u.pathname === '/feeds/videos.xml') {
    return u.searchParams.get('channel_id') === 'UCabcdefghijklmnopqrstuv'
      ? fakeResponse(200, '<feed><title>Voices of Lagos</title></feed>')
      : fakeResponse(404, '');
  }
  if (u.pathname === '/@ghostchannel') return fakeResponse(404, '');
  if (u.pathname.startsWith('/@')) return fakeResponse(200, '<meta property="og:title" content="Some Handle">"externalId":"UCzyxwvutsrqponmlkjihgfe"');
  return fakeResponse(404, '');
}

before(async () => {
  await resetFixtures();
  youtube.setFetch(async (url) => fakeYoutube(url));
  delete process.env.YOUTUBE_API_KEY;
  app = buildApp({ logger: false });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } });
  adminToken = login.json().token;
});

beforeEach(() => youtube.setFetch(async (url) => fakeYoutube(url)));

after(async () => {
  youtube.setFetch(null);
  await app.close();
  await getPool().end();
});

const submitVideo = (payload) => app.inject({ method: 'POST', url: '/api/youtube/submit-video', payload: { ...formBase(), ...payload }, headers: { 'x-forwarded-for': freshIp() } });
const submitChannel = (payload) => app.inject({ method: 'POST', url: '/api/youtube/submit-channel', payload: { ...formBase(), ...payload }, headers: { 'x-forwarded-for': freshIp() } });
const admin = (method, url, payload) => app.inject({ method, url, payload, headers: { authorization: `Bearer ${adminToken}` } });

const BASE = { country_iso: 'CI', language: 'fr', category: 'politics', contact_email: 'producer@example.com' };

test('parseVideoId handles every common YouTube URL shape and rejects others', () => {
  const id = 'dQw4w9WgXcQ';
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`, `https://youtu.be/${id}`, `https://m.youtube.com/watch?v=${id}&t=10`,
    `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `https://www.youtube.com/live/${id}`,
  ]) assert.equal(youtube.parseVideoId(url), id, url);
  for (const bad of ['https://vimeo.com/123', 'https://www.youtube.com/watch?v=short', 'not a url', 'https://evil.com/watch?v=dQw4w9WgXcQ']) {
    assert.equal(youtube.parseVideoId(bad), null, bad);
  }
});

test('parseChannelUrl handles /channel/, /@handle, /c/ and rejects others', () => {
  assert.equal(youtube.parseChannelUrl('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv').kind, 'id');
  assert.equal(youtube.parseChannelUrl('https://youtube.com/@AbidjanTV/videos').handle, 'AbidjanTV');
  assert.equal(youtube.parseChannelUrl('https://www.youtube.com/c/SomeName').kind, 'legacy');
  assert.equal(youtube.parseChannelUrl('https://www.youtube.com/watch?v=x'), null);
  assert.equal(youtube.parseChannelUrl('https://example.com/@x'), null);
});

test('slugify produces ASCII, hyphenated slugs', () => {
  assert.equal(youtube.slugify('Élections 2026 : le débat à Abidjan!'), 'elections-2026-le-debat-a-abidjan');
});

let videoId;

test('valid video: metadata taken from YouTube, status PENDING, conversion recorded', async () => {
  const tracking = trackingContext();
  const res = await submitVideo({ ...BASE, video_url: 'https://youtu.be/dQw4w9WgXcQ', title: 'typed title is ignored', tracking });
  assert.equal(res.statusCode, 201, res.body);
  const body = res.json();
  assert.equal(body.status, 'pending');
  assert.equal(body.metadata_source, 'oembed');
  assert.equal(body.title, VIDEOS.dQw4w9WgXcQ.title);
  videoId = body.id;
  const { rows: [v] } = await pool().query('SELECT * FROM youtube_videos WHERE id = $1', [videoId]);
  assert.equal(v.slug, 'elections-2026-le-debat-a-abidjan');
  assert.equal(v.channel_name, 'Abidjan TV');
  assert.equal(v.channel_url, 'https://www.youtube.com/@AbidjanTV');
  assert.ok(v.channel_id, 'channel row created');
  assert.equal(v.availability, 'available');
  const { rows: [e] } = await pool().query('SELECT event_name FROM analytics_events WHERE event_id = $1', [tracking.event_id]);
  assert.equal(e.event_name, 'YouTubeSubmissionCompleted');
});

test('invalid, deleted, private and duplicate videos are refused', async () => {
  assert.equal((await submitVideo({ ...BASE, video_url: 'https://vimeo.com/1' })).statusCode, 400);
  const deleted = await submitVideo({ ...BASE, video_url: 'https://www.youtube.com/watch?v=xxxxxxxxxxx' });
  assert.equal(deleted.statusCode, 422);
  assert.match(deleted.json().error, /deleted/);
  const priv = await submitVideo({ ...BASE, video_url: 'https://www.youtube.com/watch?v=privateVid1' });
  assert.equal(priv.statusCode, 422);
  const dup = await submitVideo({ ...BASE, video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  assert.equal(dup.statusCode, 409);
  assert.equal((await submitVideo({ ...BASE, contact_email: 'bad', video_url: 'https://youtu.be/aaaaaaaaaaa' })).statusCode, 400);
  assert.equal((await submitVideo({ ...BASE, country_iso: 'ZZ', video_url: 'https://youtu.be/aaaaaaaaaaa' })).statusCode, 400);
});

test('YouTube unreachable: submitter metadata kept, status SUBMITTED, title then required', async () => {
  const noTitle = await submitVideo({ ...BASE, video_url: 'https://youtu.be/unreachabl1' });
  assert.equal(noTitle.statusCode, 400);
  const res = await submitVideo({ ...BASE, video_url: 'https://youtu.be/unreachabl1', title: 'Manual title', thumbnail_url: 'https://evil.example/x.png' });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().status, 'submitted');
  assert.equal(res.json().metadata_source, 'submitter');
  const { rows: [v] } = await pool().query('SELECT thumbnail_url, availability FROM youtube_videos WHERE id = $1', [res.json().id]);
  assert.equal(v.thumbnail_url, 'https://i.ytimg.com/vi/unreachabl1/hqdefault.jpg', 'non-YouTube thumbnail hosts ignored');
  assert.equal(v.availability, 'unknown');
});

test('channels: valid id, valid handle, invalid channel, invalid URL, duplicate', async () => {
  const ok = await submitChannel({ ...BASE, channel_url: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv' });
  assert.equal(ok.statusCode, 201, ok.body);
  assert.equal(ok.json().verification, 'verified');
  const handle = await submitChannel({ ...BASE, channel_url: 'https://www.youtube.com/@LagosVoices' });
  assert.equal(handle.json().verification, 'verified');
  assert.equal((await submitChannel({ ...BASE, channel_url: 'https://www.youtube.com/channel/UCzzzzzzzzzzzzzzzzzzzzzz' })).statusCode, 422);
  assert.equal((await submitChannel({ ...BASE, channel_url: 'https://www.youtube.com/@ghostchannel' })).statusCode, 422);
  assert.equal((await submitChannel({ ...BASE, channel_url: 'https://example.com/channel/x' })).statusCode, 400);
  assert.equal((await submitChannel({ ...BASE, channel_url: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv' })).statusCode, 409);
});

test('landing page is only public once approved', async () => {
  const before = await app.inject({ method: 'GET', url: '/api/youtube/videos/elections-2026-le-debat-a-abidjan' });
  assert.equal(before.statusCode, 404);

  assert.equal((await admin('POST', `/api/admin/youtube/videos/${videoId}/approve`)).json().status, 'approved');
  const res = await app.inject({ method: 'GET', url: '/api/youtube/videos/elections-2026-le-debat-a-abidjan' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.video.youtube_video_id, 'dQw4w9WgXcQ');
  assert.equal(body.country.iso_code, 'CI');
  assert.ok(Array.isArray(body.related_news) && body.related_news.length > 0, 'related CI news from fixtures');
  assert.ok(body.cta_text.length > 0);
  assert.ok(!JSON.stringify(body).includes('producer@example.com'), 'contact email never public');

  // Also reachable by YouTube id (for /watch/<id>).
  assert.equal((await app.inject({ method: 'GET', url: '/api/youtube/videos/dQw4w9WgXcQ' })).statusCode, 200);
});

test('admin can set a campaign slug; duplicates and bad slugs refused', async () => {
  const bad = await admin('PATCH', `/api/admin/youtube/videos/${videoId}`, { slug: 'Video 01!' });
  assert.equal(bad.statusCode, 400);
  const ok = await admin('PATCH', `/api/admin/youtube/videos/${videoId}`, { slug: 'video-01', landing_headline: 'Le débat qui divise Abidjan' });
  assert.equal(ok.json().slug, 'video-01');
  const res = await app.inject({ method: 'GET', url: '/api/youtube/videos/video-01' });
  assert.equal(res.json().video.landing_headline, 'Le débat qui divise Abidjan');
  const other = await pool().query(`SELECT id FROM youtube_videos WHERE id <> $1 LIMIT 1`, [videoId]);
  const dup = await admin('PATCH', `/api/admin/youtube/videos/${other.rows[0].id}`, { slug: 'video-01' });
  assert.equal(dup.statusCode, 409);
});

test('refresh detects a video deleted after approval and suspends its landing page', async () => {
  youtube.setFetch(async () => fakeResponse(404, ''));
  const res = await admin('POST', `/api/admin/youtube/videos/${videoId}/refresh`);
  assert.equal(res.json().availability, 'unavailable');
  const { rows: [v] } = await pool().query('SELECT status FROM youtube_videos WHERE id = $1', [videoId]);
  assert.equal(v.status, 'suspended');
  assert.equal((await app.inject({ method: 'GET', url: '/api/youtube/videos/video-01' })).statusCode, 404);
  const reapprove = await admin('POST', `/api/admin/youtube/videos/${videoId}/approve`);
  assert.equal(reapprove.statusCode, 409, 'cannot approve an unavailable video');
});

test('public list returns approved videos only, without private fields', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/youtube/videos' });
  assert.equal(res.statusCode, 200);
  for (const v of res.json()) assert.ok(!('contact_email' in v));
});

test('admin channel moderation', async () => {
  const list = await admin('GET', '/api/admin/youtube/channels?status=submitted');
  assert.ok(list.json().length >= 1);
  const id = list.json()[0].id;
  assert.equal((await admin('POST', `/api/admin/youtube/channels/${id}/approve`)).json().status, 'approved');
  assert.equal((await admin('POST', `/api/admin/youtube/channels/${id}/reject`)).statusCode, 409);
});
