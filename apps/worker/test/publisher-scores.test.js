// Unit tests for publisher-scores.js pure scoring functions.
// No DB, no network — all computation is deterministic.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  activityScore, reliabilityScore, qualityScore, audienceScore, overallScore, band,
} = require('../src/publisher-scores');

// ── band() ──────────────────────────────────────────────────────────────────

test('band — boundaries', () => {
  assert.equal(band(0),   'low');
  assert.equal(band(19),  'low');
  assert.equal(band(20),  'moderate');
  assert.equal(band(39),  'moderate');
  assert.equal(band(40),  'good');
  assert.equal(band(64),  'good');
  assert.equal(band(65),  'high');
  assert.equal(band(79),  'high');
  assert.equal(band(80),  'priority');
  assert.equal(band(100), 'priority');
});

// ── activityScore() ─────────────────────────────────────────────────────────

test('activityScore — 0 articles, no feed → 0', () => {
  const s = activityScore(0, 0, null);
  assert.equal(s.total, 0);
});

test('activityScore — 30 articles/7d with healthy feed → 100', () => {
  const feed = { min_failures: 0, last_success_at: new Date(Date.now() - 3600000) }; // 1h ago
  const s = activityScore(30, 120, feed);
  assert.equal(s.total, 100); // 90 base + 10 feed health
});

test('activityScore — 14 articles/7d → 70 base', () => {
  const s = activityScore(14, 60, null);
  assert.equal(s.total, 70);
});

test('activityScore — broken feed (6+ failures) reduces score', () => {
  const feed = { min_failures: 8, last_success_at: null };
  const s = activityScore(7, 20, feed); // 50 base - 40 feed penalty
  assert.equal(s.total, 10);
});

test('activityScore — clamped to 0 minimum', () => {
  const feed = { min_failures: 10, last_success_at: null };
  const s = activityScore(0, 0, feed);
  assert.equal(s.total, 0);
});

// ── reliabilityScore() ──────────────────────────────────────────────────────

test('reliabilityScore — no feed → 0', () => {
  assert.equal(reliabilityScore(null).total, 0);
  assert.equal(reliabilityScore({ min_failures: null, last_success_at: null }).total, 0);
});

test('reliabilityScore — 0 failures, success 1h ago → 95', () => {
  const feed = { min_failures: 0, last_success_at: new Date(Date.now() - 3600000) };
  assert.equal(reliabilityScore(feed).total, 95);
});

test('reliabilityScore — 0 failures, success 5d ago → 80', () => {
  const feed = { min_failures: 0, last_success_at: new Date(Date.now() - 5 * 86400000) };
  assert.equal(reliabilityScore(feed).total, 80);
});

test('reliabilityScore — 2 failures → 45', () => {
  const feed = { min_failures: 2, last_success_at: null };
  assert.equal(reliabilityScore(feed).total, 45);
});

test('reliabilityScore — 15 failures → 0', () => {
  const feed = { min_failures: 15, last_success_at: null };
  assert.equal(reliabilityScore(feed).total, 0);
});

// ── qualityScore() ──────────────────────────────────────────────────────────

test('qualityScore — fully profiled publisher → 100', () => {
  const pub = {
    has_ep: true, ep_confidence: 'high',
    has_description: true, has_owner_info: true, has_verified_social: true,
  };
  assert.equal(qualityScore(pub).total, 100); // 40+30+10+10+10 = 100
});

test('qualityScore — no editorial profile → 0', () => {
  const pub = {
    has_ep: false, ep_confidence: null,
    has_description: false, has_owner_info: false, has_verified_social: false,
  };
  assert.equal(qualityScore(pub).total, 0);
});

test('qualityScore — partial: profile + medium confidence only → 60', () => {
  const pub = {
    has_ep: true, ep_confidence: 'medium',
    has_description: false, has_owner_info: false, has_verified_social: false,
  };
  assert.equal(qualityScore(pub).total, 60); // 40 + 20
});

// ── audienceScore() ─────────────────────────────────────────────────────────

test('audienceScore — null → null', () => {
  assert.equal(audienceScore(null), null);
});

test('audienceScore — 100 subs → 0', () => {
  // log10(100)=2.0, (2.0-2)/5*100 = 0, clamped to 0
  assert.equal(audienceScore(100).total, 0);
});

test('audienceScore — 1000 subs → 20', () => {
  assert.equal(audienceScore(1000).total, 20); // (3-2)/5*100 = 20
});

test('audienceScore — 100k subs → 60', () => {
  assert.equal(audienceScore(100000).total, 60); // (5-2)/5*100 = 60
});

test('audienceScore — 10M subs → 100', () => {
  assert.equal(audienceScore(10000000).total, 100); // (7-2)/5*100 = 100
});

// ── overallScore() ──────────────────────────────────────────────────────────

test('overallScore — without audience uses 40/30/30 weights', () => {
  const s = overallScore(80, 80, 80, null);
  assert.equal(s.total, 80); // 80*0.4 + 80*0.3 + 80*0.3 = 80
  assert.ok(s.breakdown.weights.includes('40/30/30'));
});

test('overallScore — with audience uses 30/20/20/30 weights', () => {
  const s = overallScore(80, 80, 80, 80);
  assert.equal(s.total, 80);
  assert.ok(s.breakdown.weights.includes('30/20/20/30'));
});

test('overallScore — clamped [0, 100]', () => {
  assert.equal(overallScore(0, 0, 0, null).total, 0);
  assert.equal(overallScore(100, 100, 100, 100).total, 100);
});
