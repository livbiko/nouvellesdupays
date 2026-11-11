// Unit tests for youtube-audience.js.
// The DB-integration path (actual audience_metrics writes) is verified via the
// rankings.test.js fixtures; here we cover the URL-parsing helpers and the
// API fetch logic with a fake fetch, so no real YouTube API is called.
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// youtube-audience.js reads YOUTUBE_API_KEY once, when it is loaded, so each test reloads it with the key it needs
// (setting process.env after a plain require has no effect). The variable is restored after every test; assigning
// `undefined` back would set the string "undefined", so an absent key is deleted instead.
const MODULE = require.resolve('../src/youtube-audience');
const savedKey = process.env.YOUTUBE_API_KEY;

function setKey(key) {
  if (key === undefined) delete process.env.YOUTUBE_API_KEY;
  else process.env.YOUTUBE_API_KEY = key;
}

function loadWithKey(key) {
  setKey(key);
  delete require.cache[MODULE];
  return require(MODULE);
}

afterEach(() => {
  setKey(savedKey);
  delete require.cache[MODULE];
});

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
  const { fetchYoutubeAudience } = loadWithKey(undefined);
  const pool = makePool([]);
  const { skipped } = await fetchYoutubeAudience(pool, { fetchImpl: makeApi(), log: () => {} });
  assert.equal(skipped, true);
});

test('fetchYoutubeAudience — returns updated:0 when no accounts are due', async () => {
  const { fetchYoutubeAudience } = loadWithKey('FAKE_KEY');
  const pool = makePool([]); // SELECT returns nothing
  const result = await fetchYoutubeAudience(pool, { fetchImpl: makeApi(), log: () => {} });
  assert.equal(result.updated, 0);
});

test('fetchYoutubeAudience — updates metrics for a channel ID account', async () => {
  const { fetchYoutubeAudience } = loadWithKey('FAKE_KEY');

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
});

test('fetchYoutubeAudience — hidden subscriber count not stored', async () => {
  const { fetchYoutubeAudience } = loadWithKey('FAKE_KEY');

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
});
