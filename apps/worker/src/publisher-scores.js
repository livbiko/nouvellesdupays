// Publisher scoring worker — computes activity, reliability, quality, audience
// and overall scores for every publisher that has a slug. Writes to
// source_scores (append-only; safe to re-run daily).
//
// Score kinds match the CHECK constraint in migration 016:
//   'overall' | 'quality' | 'activity' | 'audience' | 'reliability'
//
// Formulas are explainable: score_breakdown carries every factor so
// "why is this publisher scored 62?" always has a real answer.

function band(score) {
  if (score >= 80) return 'priority';
  if (score >= 65) return 'high';
  if (score >= 40) return 'good';
  if (score >= 20) return 'moderate';
  return 'low';
}

// How actively the publisher is publishing lately.
function activityScore(cnt7d, cnt30d, feed) {
  let base;
  if      (cnt7d >= 30) base = 90;
  else if (cnt7d >= 14) base = 70;
  else if (cnt7d >= 7)  base = 50;
  else if (cnt7d >= 3)  base = 30;
  else if (cnt7d >= 1)  base = 15;
  else                  base = 0;

  let feedHealth = 0;
  if (feed && feed.min_failures != null) {
    const hoursSince = feed.last_success_at
      ? (Date.now() - new Date(feed.last_success_at).getTime()) / 3600000
      : null;
    if      (feed.min_failures === 0 && hoursSince != null && hoursSince < 48)  feedHealth =  10;
    else if (feed.min_failures === 0 && hoursSince != null && hoursSince < 168) feedHealth =   5;
    else if (feed.min_failures >= 6)  feedHealth = -40;
    else if (feed.min_failures >= 3)  feedHealth = -25;
    else if (feed.min_failures >= 1)  feedHealth = -10;
  }

  return {
    total: Math.max(0, Math.min(100, base + feedHealth)),
    breakdown: { cnt_7d: cnt7d, cnt_30d: cnt30d, base, feed_health: feedHealth },
  };
}

// How consistently the feed works — based on the healthiest active feed.
function reliabilityScore(feed) {
  if (!feed || feed.min_failures == null) {
    return { total: 0, breakdown: { no_active_feed: true } };
  }
  const hoursSince = feed.last_success_at
    ? (Date.now() - new Date(feed.last_success_at).getTime()) / 3600000
    : null;
  let base;
  if (feed.min_failures === 0) {
    if      (hoursSince != null && hoursSince < 48)  base = 95;
    else if (hoursSince != null && hoursSince < 168) base = 80;
    else if (hoursSince != null && hoursSince < 720) base = 60;
    else                                             base = 40;
  } else if (feed.min_failures <= 2)  base = 45;
  else if   (feed.min_failures <= 5)  base = 25;
  else if   (feed.min_failures <= 10) base = 10;
  else                                base = 0;

  return {
    total: base,
    breakdown: {
      min_failures: feed.min_failures,
      hours_since_success: hoursSince != null ? Math.round(hoursSince) : null,
      base,
    },
  };
}

// How complete/transparent the editorial profile is.
function qualityScore(pub) {
  const b = {};
  b.editorial_profile = pub.has_ep ? 40 : 0;
  const confMap = { high: 30, medium: 20, low: 10, unknown: 5 };
  b.editorial_confidence = pub.has_ep ? (confMap[pub.ep_confidence] ?? 5) : 0;
  b.description         = pub.has_description    ? 10 : 0;
  b.owner_info          = pub.has_owner_info      ? 10 : 0;
  b.verified_social     = pub.has_verified_social ? 10 : 0;
  return {
    total: Math.min(100, Object.values(b).reduce((a, v) => a + v, 0)),
    breakdown: b,
  };
}

// Audience reach based on best subscriber count. Returns null when no data.
function audienceScore(bestSubs) {
  if (bestSubs == null) return null;
  const s = Math.max(0, Math.min(100,
    Math.round((Math.log10(Math.max(1, bestSubs)) - 2) / 5 * 100)
  ));
  return {
    total: s,
    breakdown: { subscribers: bestSubs, log10: +Math.log10(Math.max(1, bestSubs)).toFixed(2) },
  };
}

// Weighted combination. Audience is optional; weights shift when it's absent.
function overallScore(act, rel, qual, aud) {
  let total, breakdown;
  if (aud != null) {
    total = Math.round(act * 0.30 + rel * 0.20 + qual * 0.20 + aud * 0.30);
    breakdown = { activity: act, reliability: rel, quality: qual, audience: aud, weights: '30/20/20/30' };
  } else {
    total = Math.round(act * 0.40 + rel * 0.30 + qual * 0.30);
    breakdown = { activity: act, reliability: rel, quality: qual, weights: '40/30/30' };
  }
  return { total: Math.max(0, Math.min(100, total)), breakdown };
}

async function scorePublishers(pool, { log = console.log } = {}) {
  const now = new Date();

  const { rows: publishers } = await pool.query(`
    SELECT p.id, p.slug,
           p.description IS NOT NULL AND length(trim(p.description)) > 0 AS has_description,
           ep.id IS NOT NULL                                              AS has_ep,
           ep.confidence                                                  AS ep_confidence,
           (ep.ownership_type IS NOT NULL OR ep.owner IS NOT NULL)        AS has_owner_info,
           EXISTS (
             SELECT 1 FROM social_accounts sa
              WHERE sa.publisher_id = p.id
                AND sa.verification IN ('linked_from_site', 'verified')
                AND sa.status <> 'dead'
           )                                                              AS has_verified_social
      FROM publishers p
      LEFT JOIN editorial_profiles ep ON ep.publisher_id = p.id
     WHERE p.slug IS NOT NULL
       AND p.feed_status IN ('active', 'unavailable', 'pending')
     ORDER BY p.id
  `);

  log(`[publisher-scores] scoring ${publishers.length} publishers`);

  for (const pub of publishers) {
    const [{ rows: [art] }, { rows: feedRows }, { rows: audRows }] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE published_at >= $1::timestamptz - interval '7 days')::int  AS cnt_7d,
          COUNT(*) FILTER (WHERE published_at >= $1::timestamptz - interval '30 days')::int AS cnt_30d
          FROM articles
         WHERE publisher_id = $2
           AND published_at < $1::timestamptz + interval '1 day'
      `, [now, pub.id]),
      pool.query(`
        SELECT MIN(consecutive_failures) AS min_failures,
               MAX(last_success_at)      AS last_success_at
          FROM feeds
         WHERE publisher_id = $1 AND enabled = true
      `, [pub.id]),
      pool.query(`
        SELECT MAX(am.value)::int AS best_subs
          FROM social_accounts sa
          JOIN LATERAL (
            SELECT value FROM audience_metrics
             WHERE social_account_id = sa.id AND metric = 'subscribers'
             ORDER BY measured_at DESC LIMIT 1
          ) am ON true
         WHERE sa.publisher_id = $1 AND sa.status <> 'dead'
      `, [pub.id]),
    ]);

    const feed = feedRows[0]?.min_failures != null ? feedRows[0] : null;
    const bestSubs = audRows[0]?.best_subs ?? null;

    const act = activityScore(art.cnt_7d, art.cnt_30d, feed);
    const rel = reliabilityScore(feed);
    const qual = qualityScore(pub);
    const aud = audienceScore(bestSubs);
    const overall = overallScore(act.total, rel.total, qual.total, aud?.total ?? null);

    const scores = [
      { kind: 'activity',    ...act },
      { kind: 'reliability', ...rel },
      { kind: 'quality',     ...qual },
      ...(aud ? [{ kind: 'audience', ...aud }] : []),
      { kind: 'overall',     ...overall },
    ];

    for (const s of scores) {
      await pool.query(
        `INSERT INTO source_scores (publisher_id, score_kind, total_score, score_breakdown, score_band, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pub.id, s.kind, s.total, JSON.stringify(s.breakdown), band(s.total), now]
      );
    }
  }

  log(`[publisher-scores] done — ${publishers.length} publishers scored`);
  return { scored: publishers.length };
}

module.exports = { scorePublishers, activityScore, reliabilityScore, qualityScore, audienceScore, overallScore, band };
