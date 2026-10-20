// Unit tests for youtube-audience.js.
// The DB-integration path (actual audience_metrics writes) is verified via the
// rankings.test.js fixtures; here we cover the URL-parsing helpers and the
// API fetch logic with a fake fetch, so no real YouTube API is called.
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Extract the pure helpers for direct testing without importing the full module
// (which reads process.env.YOUTUBE_API_KEY at load time).
const src = require('../src/youtube-audience');

// Re-expose internals only for testing via a thin wrapper — the module itself
// exports only fetchYoutubeAudience; but we can exercise the public function
// with a fake pool and fake fetch.

// ── URL helpers (tested via the public function's fake-fetch path) ──────────

function makePool(accounts = []) {
  const queries = [];
  return {
    _queries: queries,
    async query(sql, params) {
      queries.push({ sql: sql.trim().slice(0, 60), params });
      // SELECT: return the supplied accounts on the first call
      if (sql.trim().toLowerCase().startsWith('select')) {
        return { rows: accounts.splice(0, accounts.length) };
      }
      return { rows: [] };
    },
  };
}

function makeApi(items = []) {
  return async (url) => ({
    ok: true,
    async json() {
      return { items };
    },
  });
}

test('fetchYoutubeAudience — skips when YOUTUBE_API_KEY is absent', async () => {
  const saved = process.env.YOUTUBE_API_KEY;
  delete process.env.YOUTUBE_API_KEY;
  // Re-require after clearing key — module is already loaded, so we check the
  // exported function's guard directly.
  const { fetchYoutubeAudience } = require('../src/youtube-audience');
  const pool = makePool([]);
  const { skipped } = await fetchYoutubeAudience(pool, { fetchImpl: makeApi(), log: () => {} });
  assert.equal(skipped, true);
  process.env.YOUTUBE_API_KEY = saved;
});

test('fetchYoutubeAudience — returns updated:0 when no accounts are due', async () => {
  const saved = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = 'FAKE_KEY';
  const { fetchYoutubeAudience } = require('../src/youtube-audience');
  const pool = makePool([]); // SELECT returns nothing
  const result = await fetchYoutubeAudience(pool, { fetchImpl: makeApi(), log: () => {} });
  assert.equal(result.updated, 0);
  process.env.YOUTUBE_API_KEY = saved;
});

test('fetchYoutubeAudience — updates metrics for a channel ID account', async () => {
  const saved = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = 'FAKE_KEY';
  const { fetchYoutubeAudience } = require('../src/youtube-audience');

  const accounts = [{
    id: 1,
    url: 'https://www.youtube.com/channel/UCabc123456789012345678901',
    handle: null,
    platform_account_id: 'UCabc123456789012345678901',
  }];
  const pool = makePool(accounts);
  const fakeApi = makeApi([{
    id: 'UCabc123456789012345678901',
    snippet: { customUrl: '@testchannel' },
    statistics: { subscriberCount: '12345', viewCount: '9876543', videoCount: '200', hiddenSubscriberCount: false },
  }]);

  const result = await fetchYoutubeAudience(pool, { fetchImpl: fakeApi, log: () => {} });
  assert.equal(result.updated, 1);
  assert.equal(result.errors, 0);

  // Verify an INSERT into audience_metrics was attempted (subscribers)
  const inserts = pool._queries.filter((q) => q.sql.startsWith('INSERT INTO audience_metrics'));
  assert.ok(inserts.length >= 2, 'at least subscribers + total_views inserted');
  const subRow = inserts.find((q) => (q.params || []).includes('subscribers'));
  assert.ok(subRow, 'subscribers metric inserted');
  assert.equal(subRow.params[2], 12345);

  process.env.YOUTUBE_API_KEY = saved;
});

test('fetchYoutubeAudience — hidden subscriber count not stored', async () => {
  const saved = process.env.YOUTUBE_API_KEY;
  process.env.YOUTUBE_API_KEY = 'FAKE_KEY';
  const { fetchYoutubeAudience } = require('../src/youtube-audience');

  const accounts = [{
    id: 2,
    url: 'https://www.youtube.com/channel/UCxyz123456789012345678901',
    handle: null,
    platform_account_id: 'UCxyz123456789012345678901',
  }];
  const pool = makePool(accounts);
  const fakeApi = makeApi([{
    id: 'UCxyz123456789012345678901',
    snippet: {},
    statistics: { subscriberCount: '99999', viewCount: '111111', videoCount: '50', hiddenSubscriberCount: true },
  }]);

  await fetchYoutubeAudience(pool, { fetchImpl: fakeApi, log: () => {} });
  const inserts = pool._queries.filter((q) => q.sql.startsWith('INSERT INTO audience_metrics'));
  const subRow = inserts.find((q) => (q.params || []).includes('subscribers'));
  assert.equal(subRow, undefined, 'subscribers not stored when hiddenSubscriberCount=true');
  const viewRow = inserts.find((q) => (q.params || []).includes('total_views'));
  assert.ok(viewRow, 'total_views still stored');

  process.env.YOUTUBE_API_KEY = saved;
});
