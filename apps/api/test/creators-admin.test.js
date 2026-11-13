const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { buildApp } = require('../src/app');
const { getPool } = require('@nouvellesdupays/shared/src/db');
const { resetFixtures } = require('../test-support/fixtures');

let app;
let fixtures;
let auth;
const ids = {};

before(async () => {
  fixtures = await resetFixtures();
  app = buildApp({ logger: false });
  await app.ready();
  const login = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { password: 'test-admin-password' } });
  auth = { authorization: `Bearer ${login.json().token}` };
  // A news publisher's YouTube channel, as migration 016's backfill left them (www, trailing slash).
  const { rows: [sa] } = await getPool().query(
    `INSERT INTO social_accounts (publisher_id, platform, url, verification) VALUES ($1, 'youtube', 'https://www.youtube.com/@TestPublisherCI/', 'unverified')
     RETURNING id`, [fixtures.publisherIds.pubCi]);
  ids.publisherAccount = sa.id;
  await getPool().query(`UPDATE discovery_agents SET paused = true, paused_reason = 'test'`);
});

after(async () => {
  await app.close();
  await getPool().end();
});

const get = (url) => app.inject({ method: 'GET', url, headers: auth });
const post = (url, payload) => app.inject({ method: 'POST', url, headers: auth, payload });
const patch = (url, payload) => app.inject({ method: 'PATCH', url, headers: auth, payload });
const del = (url) => app.inject({ method: 'DELETE', url, headers: auth });

test('creator admin routes need the admin token', async () => {
  for (const [method, url] of [['GET', '/api/admin/creators'], ['POST', '/api/admin/creators'], ['GET', '/api/admin/creators/summary'],
    ['PATCH', '/api/admin/creator-agents/global'], ['GET', '/api/admin/creator-categories']]) {
    const res = await app.inject({ method, url, payload: method === 'GET' ? undefined : {} });
    assert.equal(res.statusCode, 401, `${method} ${url}`);
  }
});

test('category taxonomy: 7 groups and 42 subcategories', async () => {
  const cats = (await get('/api/admin/creator-categories')).json();
  assert.equal(cats.filter((c) => !c.parent_slug).length, 7);
  assert.equal(cats.filter((c) => c.parent_slug).length, 42);
});

test('add a candidate: slug, categories, duplicate-name guard', async () => {
  const res = await post('/api/admin/creators', {
    display_name: 'Le Samouraï', country_iso: 'ci', languages: ['fr'], categories: ['politics', 'news-current-affairs'],
    primary_category: 'news-current-affairs', discovered_from: 'owner brief 2026-11-11',
  });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(res.json().slug, 'le-samourai');
  ids.samourai = res.json().id;

  const c = (await get(`/api/admin/creators/${ids.samourai}`)).json();
  assert.equal(c.review_status, 'candidate');
  assert.equal(c.confidence, 'REQUIRES_REVIEW');
  assert.equal(c.iso_code, 'CI');
  assert.deepEqual(c.categories.map((x) => [x.slug, x.primary]), [['news-current-affairs', true], ['politics', false]]);

  const dup = await post('/api/admin/creators', { display_name: 'le samouraï', country_iso: 'CI' });
  assert.equal(dup.statusCode, 409);
  const forced = await post('/api/admin/creators', { display_name: 'Le Samouraï', country_iso: 'CI', force: true });
  assert.equal(forced.json().slug, 'le-samourai-ci');
  ids.samouraiDup = forced.json().id;

  for (const bad of [{}, { display_name: 'x', country_iso: 'ZZ' }, { display_name: 'x', categories: ['nope'] },
    { display_name: 'x', languages: ['French'] }, { display_name: 'x', official_website: 'javascript:alert(1)' },
    { display_name: 'x', categories: ['music'], primary_category: 'comedy' }]) {
    assert.equal((await post('/api/admin/creators', bad)).statusCode, 400, JSON.stringify(bad));
  }
});

test('link accounts: normalized, profile-only, never taken from a publisher silently', async () => {
  const yt = await post(`/api/admin/creators/${ids.samourai}/accounts`, { platform: 'youtube', url: 'https://m.youtube.com/@LeSamourai/?si=abc' });
  assert.equal(yt.statusCode, 200, yt.body);
  assert.equal(yt.json().url, 'https://youtube.com/@LeSamourai');
  ids.ytAccount = yt.json().account_id;

  const again = await post(`/api/admin/creators/${ids.samourai}/accounts`, { platform: 'youtube', url: 'https://www.youtube.com/@lesamourai' });
  assert.equal(again.statusCode, 409);
  const other = await post(`/api/admin/creators/${ids.samouraiDup}/accounts`, { platform: 'youtube', url: 'https://youtube.com/@LeSamourai' });
  assert.equal(other.statusCode, 409);
  assert.equal(other.json().creator_id, ids.samourai);

  assert.equal((await post(`/api/admin/creators/${ids.samourai}/accounts`, { platform: 'youtube', url: 'https://www.youtube.com/watch?v=abc' })).statusCode, 400);
  assert.equal((await post(`/api/admin/creators/${ids.samourai}/accounts`, { platform: 'instagram', url: 'https://instagram.com/x' })).statusCode, 400);

  const shared = await post(`/api/admin/creators/${ids.samourai}/accounts`, { platform: 'youtube', url: 'https://youtube.com/@TestPublisherCI' });
  assert.equal(shared.statusCode, 409);
  assert.equal(shared.json().needs_confirmation, true);
  assert.equal(shared.json().publisher_id, fixtures.publisherIds.pubCi);
  const confirmed = await post(`/api/admin/creators/${ids.samourai}/accounts`,
    { platform: 'youtube', url: 'https://youtube.com/@TestPublisherCI', link_existing: true });
  assert.equal(confirmed.statusCode, 200);
  assert.equal(confirmed.json().account_id, ids.publisherAccount);
  const { rows: [sa] } = await getPool().query('SELECT publisher_id, creator_id FROM social_accounts WHERE id = $1', [ids.publisherAccount]);
  assert.deepEqual(sa, { publisher_id: fixtures.publisherIds.pubCi, creator_id: ids.samourai });

  const tt = await post(`/api/admin/creators/${ids.samourai}/accounts`,
    { platform: 'tiktok', url: 'https://www.tiktok.com/@lesamourai', evidence_kind: 'name_match_only' });
  assert.equal(tt.statusCode, 200);
  ids.ttAccount = tt.json().account_id;
});

test('approval needs strong evidence, a confidence level and no minor flag', async () => {
  const url = `/api/admin/creators/${ids.samourai}`;
  let res = await patch(url, { review_status: 'approved' });
  assert.equal(res.statusCode, 409);
  assert.match(res.json().error, /strong evidence/);

  res = await post(`${url}/evidence`, { social_account_id: ids.ytAccount, evidence_kind: 'cross_link', evidence_url: 'https://lesamourai.example/' });
  assert.equal(res.statusCode, 200, res.body);
  const { rows: [sa] } = await getPool().query('SELECT verification FROM social_accounts WHERE id = $1', [ids.ytAccount]);
  assert.equal(sa.verification, 'verified');

  res = await patch(url, { review_status: 'approved' });
  assert.equal(res.statusCode, 409);
  assert.match(res.json().error, /confidence/);

  res = await patch(url, { possible_minor: true, confidence: 'HIGH_CONFIDENCE', review_status: 'approved' });
  assert.equal(res.statusCode, 409);
  assert.match(res.json().error, /minor/);
  // The rejected PATCH changed nothing.
  assert.equal((await get(url)).json().possible_minor, false);

  res = await patch(url, { confidence: 'HIGH_CONFIDENCE', review_status: 'approved', reviewer_note: 'cross-linked from official site' });
  assert.equal(res.statusCode, 200, res.body);
  const c = (await get(url)).json();
  assert.equal(c.review_status, 'approved');
  assert.ok(c.approved_at);
  assert.equal(c.evidence.length, 2);

  assert.equal((await post(`${url}/evidence`, { evidence_kind: 'cross_link', social_account_id: ids.publisherAccount + 999 })).statusCode, 400);
  assert.equal((await post(`${url}/evidence`, { evidence_kind: 'rumour' })).statusCode, 400);
});

test('evidence a reader can check needs its URL; a creator confirmation or a reviewer note does not', async () => {
  const url = `/api/admin/creators/${ids.samourai}`;
  const count = async () => (await get(url)).json().evidence.length;
  const before = await count();
  for (const kind of ['cross_link', 'official_website', 'platform_badge']) {
    const res = await post(`${url}/evidence`, { social_account_id: ids.ytAccount, evidence_kind: kind, evidence_url: '  ' });
    assert.equal(res.statusCode, 400, kind);
    assert.match(res.json().error, /evidence_url is required/);
  }
  const link = await post(`${url}/accounts`, { platform: 'facebook', url: 'https://www.facebook.com/lesamourai.page', evidence_kind: 'cross_link' });
  assert.equal(link.statusCode, 400);
  assert.equal((await getPool().query(`SELECT 1 FROM social_accounts WHERE url LIKE '%lesamourai.page%'`)).rowCount, 0, 'nothing linked');
  assert.equal(await count(), before, 'nothing recorded');
  assert.equal((await post(`${url}/evidence`, { social_account_id: ids.ytAccount, evidence_kind: 'creator_confirmed', note: 'phone call' })).statusCode, 200);
  assert.equal(await count(), before + 1);
});

test('an impersonation report rejects the account until a reviewer clears it', async () => {
  const url = `/api/admin/creators/${ids.samourai}`;
  const verification = async () =>
    (await getPool().query('SELECT verification FROM social_accounts WHERE id = $1', [ids.ytAccount])).rows[0].verification;
  await post(`${url}/evidence`, { social_account_id: ids.ytAccount, evidence_kind: 'impersonator_suspected', note: 'fan channel' });
  await post(`${url}/evidence`, { social_account_id: ids.ytAccount, evidence_kind: 'platform_badge', evidence_url: 'https://youtube.com/@lesamourai' });
  assert.equal(await verification(), 'rejected');
  assert.equal((await patch(url, { confidence: 'VERIFIED' })).statusCode, 409);

  await post(`${url}/evidence`, { social_account_id: ids.ytAccount, evidence_kind: 'reviewer', note: 'checked: official channel' });
  assert.equal(await verification(), 'verified');
  assert.equal((await patch(url, { confidence: 'VERIFIED' })).statusCode, 200);
});

test('unlink: a shared account goes back to its publisher, a creator-only account is removed', async () => {
  const url = `/api/admin/creators/${ids.samourai}/accounts`;
  assert.equal((await del(`${url}/${ids.publisherAccount}`)).json().status, 'unlinked');
  const { rows: [shared] } = await getPool().query('SELECT publisher_id, creator_id FROM social_accounts WHERE id = $1', [ids.publisherAccount]);
  assert.deepEqual(shared, { publisher_id: fixtures.publisherIds.pubCi, creator_id: null });

  assert.equal((await del(`${url}/${ids.ttAccount}`)).json().status, 'removed');
  assert.equal((await getPool().query('SELECT 1 FROM social_accounts WHERE id = $1', [ids.ttAccount])).rowCount, 0);
  assert.equal((await del(`${url}/${ids.ttAccount}`)).statusCode, 404);
});

test('merge moves accounts and evidence and keeps the duplicate as merged', async () => {
  const dupAcc = await post(`/api/admin/creators/${ids.samouraiDup}/accounts`, { platform: 'facebook', url: 'https://web.facebook.com/LeSamouraiOfficiel' });
  assert.equal(dupAcc.statusCode, 200);
  const res = await post(`/api/admin/creators/${ids.samouraiDup}/merge`, { into_id: ids.samourai });
  assert.equal(res.statusCode, 200, res.body);
  const dup = (await get(`/api/admin/creators/${ids.samouraiDup}`)).json();
  assert.equal(dup.review_status, 'merged');
  assert.equal(dup.merged_into_id, ids.samourai);
  assert.equal(dup.accounts.length, 0);
  const main = (await get(`/api/admin/creators/${ids.samourai}`)).json();
  assert.ok(main.accounts.some((a) => a.url === 'https://facebook.com/LeSamouraiOfficiel'));
  assert.equal((await patch(`/api/admin/creators/${ids.samouraiDup}`, { display_name: 'x' })).statusCode, 409);
  assert.equal((await post(`/api/admin/creators/${ids.samourai}/merge`, { into_id: ids.samourai })).statusCode, 400);
});

test('list filters and summary', async () => {
  const approved = (await get('/api/admin/creators?status=approved&country=CI&platform=facebook')).json();
  assert.deepEqual(approved.map((c) => c.id), [ids.samourai]);
  assert.equal((await get('/api/admin/creators?status=approved&country=NG')).json().length, 0);
  assert.equal((await get('/api/admin/creators?status=bogus')).statusCode, 400);
  const s = (await get('/api/admin/creators/summary')).json();
  assert.equal(s.totals.approved, 1);
  assert.equal(s.totals.merged, 1);
  assert.deepEqual(s.agents.map((a) => a.agent), ['global', 'youtube', 'facebook', 'tiktok']);
  assert.ok(s.agents.find((a) => a.agent === 'facebook').blocker);
});

test('no declared country: approved with a region and a language, filtered by them (Build #223)', async () => {
  const { rows: [cr] } = await getPool().query(
    `INSERT INTO creators (slug, display_name, region, languages, confidence) VALUES ('abidjan-sans-pays', 'Abidjan Sans Pays', 'West Africa', '{}', 'PROVISIONAL')
     RETURNING id`);
  const url = `/api/admin/creators/${cr.id}`;
  let res = await post(`${url}/accounts`, { platform: 'youtube', url: 'https://www.youtube.com/@AbidjanSansPays' });
  assert.equal(res.statusCode, 200, res.body);
  const accountId = (await get(url)).json().accounts[0].id;
  assert.equal((await post(`${url}/evidence`, { social_account_id: accountId, evidence_kind: 'cross_link', evidence_url: 'https://asp.example/' })).statusCode, 200);
  assert.equal((await patch(url, { categories: ['comedy'] })).statusCode, 200);

  res = await patch(url, { review_status: 'approved' });
  assert.equal(res.statusCode, 409);
  assert.match(res.json().error, /region and a language/, 'a region alone is not enough');
  assert.equal((await patch(url, { region: 'Atlantis' })).statusCode, 400);
  res = await patch(url, { languages: ['fr'], review_status: 'approved' });
  assert.equal(res.statusCode, 200, res.body);
  const c = (await get(url)).json();
  assert.deepEqual([c.review_status, c.iso_code, c.region, c.languages], ['approved', null, 'West Africa', ['fr']]);

  const ids2 = async (qs) => (await get(`/api/admin/creators?status=all&${qs}`)).json().map((x) => x.id);
  assert.deepEqual(await ids2('country=none'), [cr.id]);
  assert.ok((await ids2('region=West%20Africa')).includes(cr.id));
  assert.ok((await ids2('region=West%20Africa')).includes(ids.samourai), 'region of a creator with a country comes from the country');
  assert.deepEqual(await ids2('country=none&language=en'), []);
  assert.deepEqual(await ids2('country=none&language=fr'), [cr.id]);
  assert.equal((await get('/api/admin/creators/summary')).json().totals.candidates_no_country, 0);
});

test('selected on a reviewer decision: needs a note, stays PROVISIONAL, verifies no account (Build #248)', async () => {
  const res0 = await post('/api/admin/creators', { display_name: 'Abidjan News Pulse', country_iso: 'CI', categories: ['politics'] });
  assert.equal(res0.statusCode, 200, res0.body);
  const url = `/api/admin/creators/${res0.json().id}`;
  const acc = await post(`${url}/accounts`, { platform: 'youtube', url: 'https://www.youtube.com/@KenyaNewsPulseTv' });
  assert.equal(acc.statusCode, 200, acc.body);
  const accountId = acc.json().account_id;
  const verification = async () =>
    (await getPool().query('SELECT verification FROM social_accounts WHERE id = $1', [accountId])).rows[0].verification;

  let res = await post(`${url}/evidence`, { social_account_id: accountId, evidence_kind: 'reviewer' });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().error, /note is required/);
  res = await post(`${url}/accounts`, { platform: 'tiktok', url: 'https://www.tiktok.com/@kenyanewspulse', evidence_kind: 'reviewer', note: '   ' });
  assert.equal(res.statusCode, 400, 'no account linked with an empty reviewer note');

  res = await post(`${url}/evidence`, { social_account_id: accountId, evidence_kind: 'reviewer', note: 'Kenyan political news, checked 11-13' });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(await verification(), 'unverified', 'a reviewer decision does not verify the account');

  for (const confidence of ['HIGH_CONFIDENCE', 'VERIFIED']) {
    res = await patch(url, { confidence, review_status: 'approved' });
    assert.equal(res.statusCode, 409, confidence);
    assert.match(res.json().error, /stays PROVISIONAL/);
  }
  assert.equal((await get(url)).json().review_status, 'candidate', 'the refused PATCHes changed nothing');

  res = await patch(url, { confidence: 'PROVISIONAL', review_status: 'approved' });
  assert.equal(res.statusCode, 200, res.body);
  const c = (await get(url)).json();
  assert.deepEqual([c.review_status, c.confidence], ['approved', 'PROVISIONAL']);
  assert.equal((await patch(url, { confidence: 'HIGH_CONFIDENCE' })).statusCode, 409, 'no upgrade without strong evidence');

  // An impersonation report on this account, then a reviewer decision: cleared back to unverified, not verified.
  await post(`${url}/evidence`, { social_account_id: accountId, evidence_kind: 'impersonator_suspected', note: 'test' });
  assert.equal(await verification(), 'rejected');
  await post(`${url}/evidence`, { social_account_id: accountId, evidence_kind: 'reviewer', note: 'cleared: same channel' });
  assert.equal(await verification(), 'unverified');
});

test('agents: cannot resume without data access, can pause and resume global', async () => {
  const saved = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  try {
    assert.equal((await patch('/api/admin/creator-agents/youtube', { paused: false })).statusCode, 409);
    assert.equal((await patch('/api/admin/creator-agents/tiktok', { paused: false })).statusCode, 409);
    assert.equal((await patch('/api/admin/creator-agents/global', { paused: false })).json().paused, false);
    const paused = (await patch('/api/admin/creator-agents/global', { paused: true, reason: 'maintenance' })).json();
    assert.deepEqual([paused.paused, paused.paused_reason], [true, 'maintenance']);
    assert.equal((await patch('/api/admin/creator-agents/nope', { paused: true })).statusCode, 404);
    assert.equal((await patch('/api/admin/creator-agents/global', {})).statusCode, 400);
  } finally {
    if (saved !== undefined) process.env.YOUTUBE_API_KEY = saved;
  }
});
