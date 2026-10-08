// Media discovery worker: DISCOVER -> DEDUPLICATE -> CHECK -> SCORE -> QUEUE.
//
// 1. mine:  fetch the homepages of active publishers in the target region
//           (a few per run, oldest-mined first) and collect the external news
//           sites they link to -> new discovered_sources rows.
// 2. check: for candidates that are due, fetch robots.txt + homepage, find a
//           feed / news sitemap, read social links, freshness and spam
//           signals, score it into source_scores and put it in review.
//
// Nothing here publishes anything: a candidate only becomes a publisher when
// an admin promotes it (POST /api/admin/discovered-sources/:id/promote) and
// then approves the resulting submission. Safe to run repeatedly: the domain
// is unique, re-finding a site only bumps times_seen.
const Parser = require('rss-parser');
const { fetchText, USER_AGENT } = require('@nouvellesdupays/shared/src/crawler');
const { isAllowed, parseRobots } = require('@nouvellesdupays/shared/src/robots');
const { parseSitemapNews } = require('@nouvellesdupays/shared/src/sitemapNews');
const {
  normalizeCandidateUrl, analyseHomepage, extractOutlinkCandidates, guessSourceType, scoreCandidate, countryFromDomain, hostOf,
} = require('@nouvellesdupays/shared/src/discovery');
const { escapeBareAmpersands } = require('./poll');

const parser = new Parser({ timeout: 15000 });

const FEED_PATHS = ['/feed', '/rss', '/rss.xml', '/feed.xml', '/atom.xml', '/?feed=rss2'];
const NEWS_SITEMAP_PATHS = ['/sitemap-news.xml', '/news-sitemap.xml', '/sitemap_news.xml'];
const RECHECK_OK_DAYS = 7;
const RETRY_DAYS = [1, 3, 7, 14];       // after 1st..4th consecutive failure
const DEAD_AFTER_FAILURES = 4;
const MINE_EVERY_DAYS = 14;

function sameSite(host, domain) {
  const h = String(host || '').replace(/^www\./, '');
  return h === domain || h.endsWith(`.${domain}`) || domain.endsWith(`.${h}`);
}

function addDays(now, days) {
  return new Date(now.getTime() + days * 86400000);
}

const MAX_PAGE_BYTES = 3 * 1024 * 1024;

// Homepage fetch: like crawler.fetchText but also returns the final URL
// after redirects, and decodes the page in its declared charset (older West
// African news sites still serve ISO-8859-1 / windows-1252).
async function fetchPage(url, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
  const finalUrl = res.url || url;
  if (!res.ok) return { ok: false, status: res.status, text: '', finalUrl };
  if (typeof res.arrayBuffer !== 'function') return { ok: true, status: res.status, text: await res.text(), finalUrl };
  const buf = Buffer.from(await res.arrayBuffer()).subarray(0, MAX_PAGE_BYTES);
  const header = (res.headers?.get?.('content-type') || '').match(/charset=([\w-]+)/i);
  const meta = buf.subarray(0, 4096).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i);
  let charset = (header?.[1] || meta?.[1] || 'utf-8').toLowerCase();
  if (charset === 'iso-8859-1' || charset === 'latin1') charset = 'windows-1252';
  let text;
  try {
    text = new TextDecoder(charset).decode(buf);
  } catch {
    text = new TextDecoder('utf-8').decode(buf);
  }
  return { ok: true, status: res.status, text, finalUrl };
}

// Like crawler.loadRobots, but a site that can't be reached at all throws
// (-> 'unreachable') instead of reading as "disallow everything", which
// would wrongly file dead sites under blocked_by_robots.
async function loadRobotsOrThrow(origin, fetchImpl) {
  const { status, ok, text } = await fetchText(`${origin}/robots.txt`, fetchImpl);
  if (ok) return parseRobots(text);
  if (status >= 400 && status < 500) return 'allow-all';
  // 5xx: nothing may be fetched now; treated as a (retried) failure rather
  // than a lasting robots refusal.
  throw new Error(`robots.txt HTTP ${status}`);
}

// Inserts candidates, skipping any site that is already a publisher, a
// submission or a candidate (by domain, www.-insensitive). Returns how many
// were new.
async function addCandidates(pool, candidates, { method, query, from, fromPublisherId } = {}) {
  let added = 0;
  for (const c of candidates) {
    const n = normalizeCandidateUrl(c.homepage);
    if (!n.ok) continue;
    const { rows: known } = await pool.query(
      `SELECT 1 FROM publishers WHERE lower(split_part(regexp_replace(domain, '^www\\.', ''), '/', 1)) = $1
       UNION ALL SELECT 1 FROM publisher_submissions WHERE lower(split_part(regexp_replace(coalesce(domain, ''), '^www\\.', ''), '/', 1)) = $1
       LIMIT 1`,
      [n.domain]
    );
    if (known.length) continue;
    const { rows } = await pool.query(
      `INSERT INTO discovered_sources (name, homepage_url, domain, country_id, discovery_method, discovery_query,
         discovered_from, discovered_from_publisher_id, flags)
       VALUES ($1, $2, $3, (SELECT id FROM countries WHERE iso_code = $4), $5, $6, $7, $8, $9)
       ON CONFLICT (domain) DO UPDATE SET updated_at = now(),
         -- counts distinct referrers, not the same page re-mined every fortnight
         times_seen = discovered_sources.times_seen + CASE WHEN discovered_sources.discovered_from IS DISTINCT FROM EXCLUDED.discovered_from THEN 1 ELSE 0 END
       RETURNING (xmax = 0) AS inserted`,
      [c.name || n.domain, n.homepage, n.domain, c.country || null, method || 'manual', query || null,
        from || null, fromPublisherId || null, c.countryFromTld === false ? ['country_from_referrer'] : []]
    );
    if (rows[0].inserted) added += 1;
  }
  return added;
}

async function regionIsoCodes(pool, region) {
  const { rows } = await pool.query('SELECT iso_code FROM countries WHERE region = $1', [region]);
  return new Set(rows.map((r) => r.iso_code.trim()));
}

// Step 1: outbound-link mining on publisher homepages.
async function mine(pool, { region, limit, fetchImpl, now, log }) {
  const isoCodes = await regionIsoCodes(pool, region);
  const { rows: pubs } = await pool.query(
    `SELECT p.id, p.homepage_url, c.iso_code
     FROM publishers p
     JOIN countries c ON c.id = p.country_id
     LEFT JOIN discovery_mining_log m ON m.publisher_id = p.id
     WHERE c.region = $1 AND p.feed_status = 'active'
       AND (m.mined_at IS NULL OR m.mined_at < $2)
     ORDER BY m.mined_at NULLS FIRST, p.id
     LIMIT $3`,
    [region, addDays(now, -MINE_EVERY_DAYS), limit]
  );
  let total = 0;
  for (const p of pubs) {
    let found = 0;
    let added = 0;
    let error = null;
    try {
      const origin = new URL(p.homepage_url).origin;
      const robots = await loadRobotsOrThrow(origin, fetchImpl);
      if (!isAllowed(robots, p.homepage_url)) throw new Error('homepage disallowed by robots.txt');
      const res = await fetchPage(p.homepage_url, fetchImpl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { links } = analyseHomepage(res.text, p.homepage_url);
      const cands = extractOutlinkCandidates(links, p.homepage_url, { isoCodes })
        .map((c) => ({ ...c, country: c.country || p.iso_code.trim() }));
      found = cands.length;
      added = await addCandidates(pool, cands, {
        method: 'outlink', query: `linked from publisher ${p.id}`, from: p.homepage_url, fromPublisherId: p.id,
      });
    } catch (err) {
      error = String(err.message || err).slice(0, 300);
    }
    await pool.query(
      `INSERT INTO discovery_mining_log (publisher_id, mined_at, links_found, candidates_added, error)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (publisher_id) DO UPDATE SET mined_at = $2, links_found = $3, candidates_added = $4, error = $5`,
      [p.id, now, found, added, error]
    );
    log(`  mined publisher ${p.id} ${p.homepage_url}: ${found} candidate links, ${added} new${error ? ` (${error})` : ''}`);
    total += added;
  }
  return { mined: pubs.length, added: total };
}

function newestDate(dates) {
  let best = null;
  for (const d of dates) {
    const t = d ? new Date(d) : null;
    if (t && !Number.isNaN(t.getTime()) && (!best || t > best)) best = t;
  }
  return best;
}

async function tryFeed(url, robots, fetchImpl, now) {
  if (!isAllowed(robots, url)) return null;
  let res;
  try {
    res = await fetchText(url, fetchImpl);
  } catch {
    return null;
  }
  if (!res.ok || !/<(rss|feed|rdf:RDF)\b/i.test(res.text.slice(0, 2000))) return null;
  try {
    const parsed = await parser.parseString(escapeBareAmpersands(res.text));
    const items = (parsed.items || []).filter((i) => i.title && i.link);
    if (!items.length) return null;
    // Future dates (local time labelled UTC) are capped like poll.js does.
    const latest = newestDate(items.map((i) => i.isoDate || i.pubDate));
    return {
      feedUrl: url,
      feedType: /<feed\b/i.test(res.text.slice(0, 2000)) ? 'atom' : 'rss',
      itemCount: items.length,
      latestItemAt: latest && latest > now ? now : latest,
    };
  } catch {
    return null;
  }
}

async function tryNewsSitemap(url, robots, fetchImpl, now) {
  if (!isAllowed(robots, url)) return null;
  try {
    const res = await fetchText(url, fetchImpl);
    if (!res.ok) return null;
    const items = parseSitemapNews(res.text);
    if (!items.length) return null;
    const latest = newestDate(items.map((i) => i.publishedAt));
    return { feedUrl: url, feedType: 'sitemap-news', itemCount: items.length, latestItemAt: latest && latest > now ? now : latest };
  } catch {
    return null;
  }
}

async function findIngestion(homepage, page, robots, fetchImpl, now) {
  for (const url of page.announcedFeeds.slice(0, 3)) {
    const f = await tryFeed(url, robots, fetchImpl, now);
    if (f) return f;
  }
  for (const path of FEED_PATHS) {
    const f = await tryFeed(new URL(path, homepage).toString(), robots, fetchImpl, now);
    if (f) return f;
  }
  for (const path of NEWS_SITEMAP_PATHS) {
    const f = await tryNewsSitemap(new URL(path, homepage).toString(), robots, fetchImpl, now);
    if (f) return f;
  }
  const sitemap = new URL('/sitemap.xml', homepage).toString();
  if (isAllowed(robots, sitemap)) {
    try {
      const res = await fetchText(sitemap, fetchImpl);
      if (res.ok && /<(urlset|sitemapindex)\b/i.test(res.text.slice(0, 3000))) {
        return { feedUrl: null, feedType: 'sitemap', sitemapUrl: sitemap, itemCount: null, latestItemAt: null };
      }
    } catch {
      // no sitemap
    }
  }
  return null;
}

async function recordFailure(pool, c, now, health, error) {
  const failures = c.consecutive_failures + 1;
  const dead = failures >= DEAD_AFTER_FAILURES;
  await pool.query(
    `UPDATE discovered_sources SET health = $2, last_error = $3, consecutive_failures = $4, check_count = check_count + 1,
       last_checked_at = $5, next_check_at = $6, updated_at = now()
     WHERE id = $1`,
    [c.id, dead ? 'dead' : health, error.slice(0, 500), failures, now,
      addDays(now, dead ? 30 : RETRY_DAYS[Math.min(failures, RETRY_DAYS.length) - 1])]
  );
}

// Step 2: check + score one candidate.
async function checkCandidate(pool, c, { fetchImpl, now, isoCodes }) {
  const homepage = c.homepage_url;
  let robots;
  try {
    robots = await loadRobotsOrThrow(new URL(homepage).origin, fetchImpl);
  } catch (err) {
    await recordFailure(pool, c, now, 'unreachable', String(err.message || err));
    return 'unreachable';
  }
  if (!isAllowed(robots, homepage)) {
    await pool.query(
      `UPDATE discovered_sources SET health = 'blocked_by_robots', last_error = 'homepage disallowed by robots.txt',
         check_count = check_count + 1, last_checked_at = $2, next_check_at = $3, updated_at = now()
       WHERE id = $1`,
      [c.id, now, addDays(now, 30)]
    );
    return 'blocked_by_robots';
  }

  let res;
  try {
    res = await fetchPage(homepage, fetchImpl);
  } catch (err) {
    await recordFailure(pool, c, now, 'unreachable', String(err.message || err));
    return 'unreachable';
  }
  if (!res.ok) {
    await recordFailure(pool, c, now, 'unreachable', `HTTP ${res.status}`);
    return 'unreachable';
  }

  let page = analyseHomepage(res.text, homepage);
  let pageUrl = res.finalUrl;
  // A root that is only a <meta refresh> to a page on the same site
  // (L'Intelligent d'Abidjan: / -> /news/): follow it once.
  if (page.refreshUrl && page.links.length < 5 && sameSite(hostOf(page.refreshUrl), c.domain) && isAllowed(robots, page.refreshUrl)) {
    try {
      const next = await fetchPage(page.refreshUrl, fetchImpl);
      if (next.ok) {
        page = analyseHomepage(next.text, next.finalUrl);
        pageUrl = next.finalUrl;
      }
    } catch {
      // keep the first page
    }
  }
  // Redirected to another site (expired domain bought by a shop, a rebrand...):
  // analysed as-is, but flagged for the reviewer.
  const finalHost = hostOf(pageUrl);
  const redirectedElsewhere = Boolean(finalHost) && !sameSite(finalHost, c.domain);
  const ingestion = page.spam.length ? null : await findIngestion(homepage, page, robots, fetchImpl, now);
  const tldCountry = countryFromDomain(c.domain, isoCodes);
  const socialCount = Object.keys(page.socials).length;
  // A real publishing rhythm, not a company blog with two posts: many
  // article links, or a feed with several items in the last month.
  const recentFeed = (ingestion?.itemCount || 0) >= 5 && ingestion?.latestItemAt && now - ingestion.latestItemAt <= 30 * 86400000;
  const newsLike = page.articleLinkCount >= 8 || recentFeed || (page.articleLinkCount >= 3 && (ingestion?.itemCount || 0) >= 3);
  const score = scoreCandidate({
    reachable: true,
    feedType: ingestion?.feedType,
    latestItemAt: ingestion?.latestItemAt,
    articleLinkCount: page.articleLinkCount,
    countryFromTld: Boolean(tldCountry),
    countryKnown: Boolean(c.country_id),
    hasIdentityPage: page.hasIdentityPage,
    title: page.title,
    socialCount,
    timesSeen: c.times_seen,
    spam: page.spam,
    redirectedElsewhere,
    newsLike,
  }, now);

  // Next to no links in the HTML: a JavaScript app (acturoutes.info) or a
  // placeholder -- can't be judged without a browser, so a human looks.
  const jsOrEmpty = page.links.length < 5 && !ingestion?.feedUrl;
  const health = page.spam.length ? 'spam_suspect' : newsLike ? 'ok' : 'not_news';
  // Redirects to a site we already carry (mediaguinee.org -> mediaguinee.com): a duplicate.
  let duplicateOf = null;
  if (redirectedElsewhere) {
    const { rows } = await pool.query(
      `SELECT id, name FROM publishers WHERE lower(split_part(regexp_replace(domain, '^www\\.', ''), '/', 1)) = $1 LIMIT 1`,
      [finalHost.replace(/^www\./, '')]
    );
    duplicateOf = rows[0] || null;
  }
  // Spam/hijacked sites and duplicates are rejected automatically (reversible
  // by an admin); everything else waits for a human, whatever its score.
  const autoReject = page.spam.length ? `auto-rejected ${now.toISOString().slice(0, 10)}: ${page.spam.join('; ')}`
    : duplicateOf ? `auto-rejected ${now.toISOString().slice(0, 10)}: duplicate, redirects to publisher ${duplicateOf.id} (${duplicateOf.name})` : null;
  const status = autoReject ? 'rejected' : c.status === 'discovered' ? 'under_review' : c.status;
  const flags = new Set((c.flags || []).filter((f) => !['no_feed', 'stale', 'spam', 'redirects_elsewhere', 'js_or_empty_page', 'bot_challenge', 'duplicate'].includes(f)));
  if (!ingestion?.feedUrl) flags.add('no_feed');
  if (ingestion?.latestItemAt && now - ingestion.latestItemAt > 30 * 86400000) flags.add('stale');
  if (page.spam.length) flags.add('spam');
  if (redirectedElsewhere) flags.add('redirects_elsewhere');
  if (jsOrEmpty) flags.add('js_or_empty_page');
  if (page.botChallenge) flags.add('bot_challenge');
  if (duplicateOf) flags.add('duplicate');

  await pool.query(
    `UPDATE discovered_sources SET
       -- auto-derived names follow the site's title; a name an admin typed is kept
       name = CASE WHEN (name = domain OR name = site_title) AND $2::text IS NOT NULL THEN left($2, 200) ELSE name END,
       site_title = $2, description = $3, html_lang = $4, http_status = $5, final_url = $26,
       language = coalesce(language, $4),
       country_id = coalesce(country_id, (SELECT id FROM countries WHERE iso_code = $6)),
       source_type = coalesce(source_type, $7),
       feed_url = $8, feed_type = $9, sitemap_url = $10, item_count = $11, latest_item_at = $12,
       article_link_count = $13,
       youtube_url = $14, facebook_url = $15, x_url = $16, instagram_url = $17, tiktok_url = $18,
       health = $19, status = $20, flags = $21, score = $22,
       notes = CASE WHEN $23::text IS NULL THEN notes ELSE concat_ws(E'\n', notes, $23) END,
       last_error = NULL, consecutive_failures = 0, check_count = check_count + 1,
       last_checked_at = $24, next_check_at = $25, updated_at = now()
     WHERE id = $1`,
    [c.id, page.title, page.description, page.lang, res.status, tldCountry,
      guessSourceType(c.domain, page.title),
      ingestion?.feedUrl || null, ingestion?.feedType || null, ingestion?.sitemapUrl || null,
      ingestion?.itemCount ?? null, ingestion?.latestItemAt || null, page.articleLinkCount,
      page.socials.youtube_url || null, page.socials.facebook_url || null, page.socials.x_url || null,
      page.socials.instagram_url || null, page.socials.tiktok_url || null,
      health, status, [...flags], score.total,
      autoReject && c.status !== 'rejected' ? autoReject : null,
      now, addDays(now, RECHECK_OK_DAYS), pageUrl]
  );
  await pool.query(
    `INSERT INTO source_scores (discovered_source_id, total_score, score_breakdown, score_band, computed_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [c.id, score.total, JSON.stringify(score.breakdown), score.band, now]
  );
  return health;
}

async function checkDue(pool, { limit, fetchImpl, now, log, concurrency = 4 }) {
  const { rows: isoRows } = await pool.query('SELECT iso_code FROM countries');
  const isoCodes = new Set(isoRows.map((r) => r.iso_code.trim()));
  const { rows: due } = await pool.query(
    `SELECT * FROM discovered_sources
     WHERE status IN ('discovered', 'under_review') AND (next_check_at IS NULL OR next_check_at <= $1)
     ORDER BY next_check_at NULLS FIRST, times_seen DESC, id
     LIMIT $2`,
    [now, limit]
  );
  const results = {};
  let i = 0;
  async function lane() {
    while (i < due.length) {
      const c = due[i++];
      let outcome;
      try {
        outcome = await checkCandidate(pool, c, { fetchImpl, now, isoCodes });
      } catch (err) {
        outcome = 'error';
        await recordFailure(pool, c, now, 'unreachable', `check failed: ${err.message}`);
      }
      results[outcome] = (results[outcome] || 0) + 1;
      log(`  checked ${c.domain}: ${outcome}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, due.length) }, lane));
  return { checked: due.length, results };
}

async function runDiscovery(pool, opts = {}) {
  const {
    region = process.env.DISCOVERY_REGION || 'West Africa',
    mineLimit = Number(process.env.DISCOVERY_MINE_LIMIT || 6),
    checkLimit = Number(process.env.DISCOVERY_CHECK_LIMIT || 20),
    fetchImpl = fetch,
    now = new Date(),
    log = console.log,
  } = opts;
  log(`Discovery run ${now.toISOString()} region="${region}"`);
  const mined = await mine(pool, { region, limit: mineLimit, fetchImpl, now, log });
  const checked = await checkDue(pool, { limit: checkLimit, fetchImpl, now, log });
  return { mined, checked };
}

module.exports = { runDiscovery, addCandidates, checkCandidate, mine, checkDue };
