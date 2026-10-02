const {
  LEAD_EVENTS, CLICK_EVENTS, VIDEO_INTERACTION_EVENTS, OUTBOUND_YOUTUBE_EVENTS, SITE_ENGAGEMENT_EVENTS,
} = require('@nouvellesdupays/shared/src/trackingEvents');
const { cleanText, isUuid } = require('./security');

// Admin analytics: every number here is computed from rows actually stored
// in analytics_events / leads / publisher_submissions / youtube_videos /
// campaign_spend. Nothing is estimated or sampled; when a figure needs data
// that doesn't exist (e.g. cost per lead without spend entered), it is
// returned as null and the UI shows "—".
//
// Filters:
//   date range       range=today|yesterday|7d|30d|90d|custom (+from/to YYYY-MM-DD), tz=<IANA zone>
//   attribution      campaign, source, medium, landing_page  -> the session's attribution
//   content          country, publisher_id, video_id, channel_id -> sessions that touched it
//   include_debug=1  include events sent in debug/test mode (excluded by default)

const YOUTUBE_EVENTS = ['YouTubeLandingPageView', ...VIDEO_INTERACTION_EVENTS];
// A "registration start" is counted once per session, whether the visitor
// clicked a "Rejoindre" CTA (RegisterStarted), focused the form
// (RegistrationStarted), or both.
const REG_START_EVENTS = ['RegistrationStarted', 'RegisterStarted'];
const RANGE_DAYS = { today: 0, yesterday: 1, '7d': 6, '30d': 29, '90d': 89 };
const MAX_CUSTOM_DAYS = 366;
const tzCache = new Map();

class FilterError extends Error {}

async function validTimezone(pool, tz) {
  if (tzCache.has(tz)) return tzCache.get(tz);
  const { rows } = await pool.query('SELECT 1 FROM pg_timezone_names WHERE name = $1', [tz]);
  const ok = rows.length > 0;
  tzCache.set(tz, ok);
  return ok;
}

async function parseFilters(pool, q) {
  const tz = typeof q.tz === 'string' && q.tz.length < 64 ? q.tz : 'UTC';
  if (!(await validTimezone(pool, tz))) throw new FilterError('Unknown timezone');
  const range = q.range || '7d';

  let bounds;
  if (range === 'custom') {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(q.from || '') || !re.test(q.to || '')) throw new FilterError('Custom range needs from and to as YYYY-MM-DD');
    const { rows } = await pool.query(
      `SELECT ($1::date)::timestamp AT TIME ZONE $3 AS from_ts, (($2::date) + 1)::timestamp AT TIME ZONE $3 AS to_ts,
              ($2::date - $1::date) AS days`,
      [q.from, q.to, tz]
    );
    if (rows[0].days < 0) throw new FilterError('"from" must be before "to"');
    if (rows[0].days > MAX_CUSTOM_DAYS) throw new FilterError(`Custom range is limited to ${MAX_CUSTOM_DAYS} days`);
    bounds = rows[0];
  } else {
    if (!(range in RANGE_DAYS)) throw new FilterError('Unknown range');
    const startOffset = RANGE_DAYS[range];
    const endOffset = range === 'yesterday' ? 0 : -1; // yesterday ends at today's midnight
    const { rows } = await pool.query(
      `SELECT (date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => $2)) AT TIME ZONE $1 AS from_ts,
              (date_trunc('day', now() AT TIME ZONE $1) - make_interval(days => $3)) AT TIME ZONE $1 AS to_ts`,
      [tz, startOffset, endOffset]
    );
    bounds = rows[0];
  }

  const int = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  return {
    tz,
    range,
    from: bounds.from_ts,
    to: bounds.to_ts,
    campaign: cleanText(q.campaign, 100),
    source: cleanText(q.source, 100)?.toLowerCase() || null,
    medium: cleanText(q.medium, 100)?.toLowerCase() || null,
    landing_page: cleanText(q.landing_page, 300),
    country: typeof q.country === 'string' && /^[A-Za-z]{2}$/.test(q.country) ? q.country.toUpperCase() : null,
    publisher_id: int(q.publisher_id),
    video_id: int(q.video_id),
    channel_id: int(q.channel_id),
    include_debug: q.include_debug === '1' || q.include_debug === 'true',
  };
}

// Builds `WITH ev AS (...)` over analytics_events for the given filters.
function eventsCte(f) {
  const params = [f.from, f.to];
  const conds = ['e.occurred_at >= $1', 'e.occurred_at < $2'];
  const add = (sql, value) => {
    params.push(value);
    conds.push(sql.replace('?', `$${params.length}`));
  };
  if (!f.include_debug) conds.push('NOT e.is_debug');
  if (f.campaign) add('e.utm_campaign = ?', f.campaign);
  if (f.source) add('e.utm_source = ?', f.source);
  if (f.medium) add('e.utm_medium = ?', f.medium);
  if (f.landing_page) add('e.landing_page = ?', f.landing_page);
  const touch = (col, value) =>
    add(`e.session_id IN (SELECT x.session_id FROM analytics_events x WHERE x.occurred_at >= $1 AND x.occurred_at < $2 AND x.${col} = ?)`, value);
  if (f.country) touch('country_iso', f.country);
  if (f.publisher_id) touch('publisher_id', f.publisher_id);
  if (f.video_id) touch('video_id', f.video_id);
  if (f.channel_id) {
    add(`e.session_id IN (SELECT x.session_id FROM analytics_events x JOIN youtube_videos yv ON yv.id = x.video_id
          WHERE x.occurred_at >= $1 AND x.occurred_at < $2 AND yv.channel_id = ?)`, f.channel_id);
  }
  return { sql: `WITH ev AS (SELECT e.* FROM analytics_events e WHERE ${conds.join(' AND ')})`, params };
}

// Appends extra parameters after the CTE's own.
function withParams(base, extra) {
  const params = [...base.params];
  const refs = extra.map((v) => {
    params.push(v);
    return `$${params.length}`;
  });
  return { params, refs };
}

function rate(num, den) {
  return den > 0 ? Math.round((num / den) * 10000) / 100 : null;
}

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

async function overview(pool, f) {
  const cte = eventsCte(f);
  const { params, refs } = withParams(cte, [YOUTUBE_EVENTS, CLICK_EVENTS, LEAD_EVENTS, f.tz, REG_START_EVENTS]);
  const [yt, clicks, leads, tz, regStarts] = refs;
  const { rows } = await pool.query(
    `${cte.sql}
     SELECT count(DISTINCT visitor_id) AS unique_visitors,
            count(DISTINCT (visitor_id, (occurred_at AT TIME ZONE ${tz})::date)) AS total_visitors,
            count(DISTINCT session_id) AS sessions,
            count(*) FILTER (WHERE event_name = 'PageView') AS page_views,
            count(DISTINCT visitor_id) FILTER (WHERE is_facebook) AS facebook_visitors,
            count(DISTINCT visitor_id) FILTER (WHERE is_paid) AS ad_visitors,
            count(DISTINCT visitor_id) FILTER (WHERE NOT is_paid) AS organic_visitors,
            count(DISTINCT visitor_id) FILTER (WHERE event_name = ANY(${yt})) AS youtube_visitors,
            count(*) FILTER (WHERE event_name = 'LandingPageView') AS landing_page_views,
            count(*) FILTER (WHERE event_name = ANY(${clicks})) AS clicks,
            count(DISTINCT session_id) FILTER (WHERE event_name = ANY(${regStarts})) AS registration_starts,
            count(*) FILTER (WHERE event_name = 'RegistrationCompleted') AS registrations,
            count(*) FILTER (WHERE event_name = ANY(${leads})) AS leads
     FROM ev`,
    params
  );
  const r = rows[0];
  const totals = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, n(v)]));
  totals.conversion_rate = rate(totals.registrations, totals.unique_visitors);
  totals.lead_rate = rate(totals.leads, totals.unique_visitors);

  const seriesTz = `$${cte.params.length + 1}`;
  const series = await pool.query(
    `${cte.sql}
     , days AS (
       SELECT generate_series(($1::timestamptz AT TIME ZONE ${seriesTz})::date,
                              (($2::timestamptz - interval '1 second') AT TIME ZONE ${seriesTz})::date, interval '1 day')::date AS day
     )
     SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            count(DISTINCT ev.visitor_id) AS visitors,
            count(ev.event_id) FILTER (WHERE ev.event_name = 'PageView') AS page_views,
            count(DISTINCT ev.visitor_id) FILTER (WHERE ev.is_facebook) AS facebook_visitors,
            count(ev.event_id) FILTER (WHERE ev.event_name = 'RegistrationCompleted') AS registrations
     FROM days d
     LEFT JOIN ev ON (ev.occurred_at AT TIME ZONE ${seriesTz})::date = d.day
     GROUP BY d.day ORDER BY d.day`,
    [...cte.params, f.tz]
  );

  const channels = await pool.query(
    `${cte.sql}
     SELECT coalesce(channel, 'direct') AS channel, count(DISTINCT session_id) AS sessions, count(DISTINCT visitor_id) AS visitors
     FROM ev GROUP BY 1 ORDER BY sessions DESC`,
    cte.params
  );

  // Source-of-truth table counts (include visitors who refused analytics
  // consent -- their conversions exist even though their journey doesn't).
  const tables = await pool.query(
    `SELECT (SELECT count(*) FROM leads WHERE created_at >= $1 AND created_at < $2) AS registrations_all,
            (SELECT count(*) FROM publisher_submissions WHERE submitted_at >= $1 AND submitted_at < $2) AS publisher_submissions,
            (SELECT count(*) FROM youtube_videos WHERE submitted_at >= $1 AND submitted_at < $2) AS video_submissions,
            (SELECT count(*) FROM youtube_channels WHERE submitted_at >= $1 AND submitted_at < $2) AS channel_submissions,
            (SELECT count(*) FROM contact_messages WHERE created_at >= $1 AND created_at < $2) AS contact_messages`,
    [f.from, f.to]
  );

  return {
    totals,
    timeseries: series.rows.map((d) => ({
      day: d.day, visitors: n(d.visitors), page_views: n(d.page_views),
      facebook_visitors: n(d.facebook_visitors), registrations: n(d.registrations),
    })),
    channels: channels.rows.map((c) => ({ channel: c.channel, sessions: n(c.sessions), visitors: n(c.visitors) })),
    table_totals: Object.fromEntries(Object.entries(tables.rows[0]).map(([k, v]) => [k, n(v)])),
  };
}

async function spendRows(pool, f) {
  const params = [f.from, f.to, f.tz];
  let cond = '';
  if (f.campaign) {
    params.push(f.campaign);
    cond = ` AND c.utm_campaign = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT c.utm_campaign, s.utm_content, sum(s.amount) AS spend, min(s.currency) AS currency,
            count(DISTINCT s.currency) AS currencies, sum(s.link_clicks) AS link_clicks, sum(s.impressions) AS impressions
     FROM campaign_spend s JOIN campaigns c ON c.id = s.campaign_id
     WHERE s.spend_date >= ($1::timestamptz AT TIME ZONE $3)::date AND s.spend_date < ($2::timestamptz AT TIME ZONE $3)::date + 1 ${cond}
     GROUP BY c.utm_campaign, s.utm_content`,
    params
  );
  return rows;
}

async function campaigns(pool, f) {
  const cte = eventsCte(f);
  const { params, refs } = withParams(cte, [CLICK_EVENTS, LEAD_EVENTS, REG_START_EVENTS]);
  const [clicks, leads, regStarts] = refs;
  const { rows } = await pool.query(
    `${cte.sql}
     SELECT utm_campaign AS campaign, utm_source AS source, utm_medium AS medium, utm_content AS content,
            count(DISTINCT visitor_id) AS visitors, count(DISTINCT session_id) AS sessions,
            count(*) FILTER (WHERE event_name IN ('LandingPageView', 'YouTubeLandingPageView')) AS landing_page_views,
            count(*) FILTER (WHERE event_name = ANY(${clicks})) AS clicks,
            count(DISTINCT session_id) FILTER (WHERE event_name = ANY(${regStarts})) AS registration_starts,
            count(*) FILTER (WHERE event_name = 'RegistrationCompleted') AS registrations,
            count(*) FILTER (WHERE event_name = ANY(${leads})) AS leads
     FROM ev
     WHERE utm_campaign IS NOT NULL OR utm_source IS NOT NULL
     GROUP BY 1, 2, 3, 4
     ORDER BY visitors DESC
     LIMIT 300`,
    params
  );
  const spend = await spendRows(pool, f);
  const spendKey = (c, content) => `${c}\u0000${content || ''}`;
  const spendMap = new Map(spend.map((s) => [spendKey(s.utm_campaign, s.utm_content), s]));

  const adRows = rows.map((r) => {
    const out = {
      campaign: r.campaign, source: r.source, medium: r.medium, content: r.content,
      visitors: n(r.visitors), sessions: n(r.sessions), landing_page_views: n(r.landing_page_views),
      clicks: n(r.clicks), registration_starts: n(r.registration_starts), registrations: n(r.registrations), leads: n(r.leads),
    };
    out.conversion_rate = rate(out.registrations, out.visitors);
    const s = r.content ? spendMap.get(spendKey(r.campaign, r.content)) : null;
    out.spend = s ? Number(s.spend) : null;
    out.currency = s ? s.currency : null;
    out.cost_per_lead = s && out.leads > 0 && n(s.currencies) === 1 ? Math.round((Number(s.spend) / out.leads) * 100) / 100 : null;
    return out;
  });

  // Campaign-level roll-up (all ads), where whole-campaign spend lives.
  const byCampaign = new Map();
  for (const r of adRows) {
    if (!r.campaign) continue;
    const t = byCampaign.get(r.campaign) || { campaign: r.campaign, visitors: 0, sessions: 0, landing_page_views: 0, clicks: 0, registration_starts: 0, registrations: 0, leads: 0 };
    for (const k of ['visitors', 'sessions', 'landing_page_views', 'clicks', 'registration_starts', 'registrations', 'leads']) t[k] += r[k];
    byCampaign.set(r.campaign, t);
  }
  for (const s of spend) {
    if (!byCampaign.has(s.utm_campaign)) {
      byCampaign.set(s.utm_campaign, { campaign: s.utm_campaign, visitors: 0, sessions: 0, landing_page_views: 0, clicks: 0, registration_starts: 0, registrations: 0, leads: 0 });
    }
    const t = byCampaign.get(s.utm_campaign);
    t.spend = (t.spend || 0) + Number(s.spend);
    t.currency = t.currency && t.currency !== s.currency ? 'MIXED' : s.currency;
    t.link_clicks = s.link_clicks === null ? t.link_clicks ?? null : (t.link_clicks || 0) + Number(s.link_clicks);
    t.impressions = s.impressions === null ? t.impressions ?? null : (t.impressions || 0) + Number(s.impressions);
  }
  const campaignTotals = [...byCampaign.values()].map((t) => ({
    ...t,
    spend: t.spend ?? null,
    currency: t.currency ?? null,
    link_clicks: t.link_clicks ?? null,
    impressions: t.impressions ?? null,
    conversion_rate: rate(t.registrations, t.visitors),
    cost_per_lead: t.spend !== undefined && t.leads > 0 && t.currency !== 'MIXED' ? Math.round((t.spend / t.leads) * 100) / 100 : null,
    cost_per_registration: t.spend !== undefined && t.registrations > 0 && t.currency !== 'MIXED' ? Math.round((t.spend / t.registrations) * 100) / 100 : null,
  })).sort((a, b) => b.visitors - a.visitors);

  return { ads: adRows, campaigns: campaignTotals };
}

async function landingPages(pool, f) {
  const cte = eventsCte(f);
  const { params, refs } = withParams(cte, [['YouTubeClick', 'WatchOnYouTube', 'VideoThumbnailClick'], REG_START_EVENTS]);
  const [ytClicks, regStarts] = refs;
  const { rows } = await pool.query(
    `${cte.sql}
     SELECT coalesce(landing_page, '(inconnu)') AS landing_page,
            count(DISTINCT visitor_id) AS visitors, count(DISTINCT session_id) AS sessions,
            count(*) FILTER (WHERE event_name = ANY(${ytClicks})) AS youtube_clicks,
            count(DISTINCT session_id) FILTER (WHERE event_name = ANY(${regStarts})) AS registration_starts,
            count(*) FILTER (WHERE event_name = 'RegistrationCompleted') AS registrations
     FROM ev GROUP BY 1 ORDER BY visitors DESC LIMIT 100`,
    params
  );
  return rows.map((r) => ({
    landing_page: r.landing_page, visitors: n(r.visitors), sessions: n(r.sessions),
    youtube_clicks: n(r.youtube_clicks), registration_starts: n(r.registration_starts),
    registrations: n(r.registrations), conversion_rate: rate(n(r.registrations), n(r.visitors)),
  }));
}

async function publisherRegistration(pool, f) {
  const { rows } = await pool.query(
    `SELECT count(*) AS submitted,
            count(*) FILTER (WHERE status IN ('approved', 'active')) AS approved,
            count(*) FILTER (WHERE status = 'active') AS active,
            count(*) FILTER (WHERE status IN ('submitted', 'pending')) AS pending,
            count(*) FILTER (WHERE status = 'rejected') AS rejected,
            count(*) FILTER (WHERE status = 'suspended') AS suspended,
            count(*) FILTER (WHERE feed_url IS NULL) AS without_feed
     FROM publisher_submissions WHERE submitted_at >= $1 AND submitted_at < $2`,
    [f.from, f.to]
  );
  const cte = eventsCte(f);
  const ev = await pool.query(
    `${cte.sql}
     SELECT count(DISTINCT session_id) FILTER (WHERE event_name = 'PublisherRegistrationStarted') AS started,
            count(*) FILTER (WHERE event_name = 'PublisherRegistrationCompleted') AS completed,
            count(DISTINCT session_id) FILTER (WHERE page_type = 'publisher_registration' AND event_name = 'PageView') AS form_views
     FROM ev`,
    cte.params
  );
  const counts = Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, n(v)]));
  const e = Object.fromEntries(Object.entries(ev.rows[0]).map(([k, v]) => [k, n(v)]));
  return { ...counts, form_views: e.form_views, started: e.started, completed: e.completed, completion_rate: rate(e.completed, e.started) };
}

async function youtubePerformance(pool, f) {
  const cte = eventsCte(f);
  const { params, refs } = withParams(cte, [OUTBOUND_YOUTUBE_EVENTS]);
  const [outbound] = refs;
  const { rows } = await pool.query(
    `${cte.sql}
     , regs AS (
       SELECT DISTINCT lp.video_id, r.event_id
       FROM ev lp JOIN ev r ON r.session_id = lp.session_id AND r.event_name = 'RegistrationCompleted'
       WHERE lp.event_name = 'YouTubeLandingPageView' AND lp.video_id IS NOT NULL
     )
     SELECT v.id, v.slug, v.title, v.channel_name, v.status,
            count(*) FILTER (WHERE e.event_name = 'YouTubeLandingPageView') AS views,
            count(DISTINCT e.visitor_id) FILTER (WHERE e.event_name = 'YouTubeLandingPageView') AS visitors,
            count(*) FILTER (WHERE e.event_name = 'VideoThumbnailClick') AS thumbnail_clicks,
            count(*) FILTER (WHERE e.event_name = 'YouTubePlay') AS plays,
            count(*) FILTER (WHERE e.event_name = ANY(${outbound})) AS outbound_clicks,
            count(*) FILTER (WHERE e.event_name = 'Share') AS shares,
            (SELECT count(*) FROM regs WHERE regs.video_id = v.id) AS registrations
     FROM ev e JOIN youtube_videos v ON v.id = e.video_id
     GROUP BY v.id
     ORDER BY views DESC
     LIMIT 200`,
    params
  );
  return rows.map((r) => {
    const out = {
      video_id: r.id, slug: r.slug, title: r.title, channel_name: r.channel_name, status: r.status,
      views: n(r.views), visitors: n(r.visitors), thumbnail_clicks: n(r.thumbnail_clicks), plays: n(r.plays),
      outbound_clicks: n(r.outbound_clicks), shares: n(r.shares), registrations: n(r.registrations),
    };
    out.clicks = out.thumbnail_clicks + out.outbound_clicks;
    out.conversion_rate = rate(out.registrations, out.visitors);
    return out;
  });
}

// Closed funnel over sessions: each stage only counts sessions that also
// reached every earlier stage, so percentages are always <= 100%.
async function funnel(pool, f, scope = 'facebook') {
  const cte = eventsCte(f);
  const { params, refs } = withParams(cte, [VIDEO_INTERACTION_EVENTS, SITE_ENGAGEMENT_EVENTS, REG_START_EVENTS]);
  const [video, engagement, regStarts] = refs;
  const scopeCond = scope === 'facebook' ? 'fb' : 'true';
  const { rows } = await pool.query(
    `${cte.sql}
     , s AS (
       SELECT session_id,
              bool_or(is_facebook) AS fb,
              bool_or(event_name IN ('LandingPageView', 'YouTubeLandingPageView')) AS lp,
              bool_or(event_name = ANY(${video})) AS video,
              (bool_or(event_name = ANY(${engagement})) OR count(*) FILTER (WHERE event_name = 'PageView') >= 2) AS engaged,
              bool_or(event_name = ANY(${regStarts})) AS started,
              bool_or(event_name = 'RegistrationCompleted') AS completed
       FROM ev GROUP BY session_id
     )
     SELECT count(*) FILTER (WHERE ${scopeCond} AND lp) AS landing,
            count(*) FILTER (WHERE ${scopeCond} AND lp AND video) AS video,
            count(*) FILTER (WHERE ${scopeCond} AND lp AND video AND engaged) AS engaged,
            count(*) FILTER (WHERE ${scopeCond} AND lp AND video AND engaged AND started) AS started,
            count(*) FILTER (WHERE ${scopeCond} AND lp AND video AND engaged AND started AND completed) AS completed,
            count(*) FILTER (WHERE ${scopeCond}) AS sessions,
            count(*) FILTER (WHERE ${scopeCond} AND completed) AS completed_any_path
     FROM s`,
    params
  );
  const r = Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, n(v)]));

  // Meta-reported link clicks are only known when an admin entered them.
  let adClicks = null;
  if (scope === 'facebook') {
    const spend = await spendRows(pool, f);
    const withClicks = spend.filter((s) => s.link_clicks !== null);
    if (withClicks.length > 0) adClicks = withClicks.reduce((sum, s) => sum + Number(s.link_clicks), 0);
  }

  const stages = [
    { key: 'ad_clicks', label: scope === 'facebook' ? 'Publicité Facebook (clics déclarés par Meta)' : 'Clics publicitaires', count: adClicks },
    { key: 'landing', label: 'Page de destination', count: r.landing },
    { key: 'video', label: 'Interaction vidéo', count: r.video },
    { key: 'engaged', label: 'Engagement sur le site', count: r.engaged },
    { key: 'started', label: 'Inscription commencée', count: r.started },
    { key: 'completed', label: 'Inscription terminée', count: r.completed },
  ];
  const top = stages.find((s) => s.count !== null && s.count > 0);
  let prev = null;
  for (const s of stages) {
    s.rate_from_previous = s.count !== null && prev !== null ? rate(s.count, prev) : null;
    s.rate_from_top = s.count !== null && top ? rate(s.count, top.count) : null;
    if (s.count !== null) prev = s.count;
  }
  return { scope, stages, sessions: r.sessions, completed_any_path: r.completed_any_path };
}

async function filterOptions(pool, f) {
  const [countries, attrib, landing, publishers, channels, videos] = await Promise.all([
    pool.query(`SELECT iso_code, name FROM countries ORDER BY name`),
    pool.query(
      `SELECT array_agg(DISTINCT utm_campaign) FILTER (WHERE utm_campaign IS NOT NULL) AS campaigns,
              array_agg(DISTINCT utm_source) FILTER (WHERE utm_source IS NOT NULL) AS sources,
              array_agg(DISTINCT utm_medium) FILTER (WHERE utm_medium IS NOT NULL) AS mediums
       FROM analytics_sessions WHERE started_at >= $1::timestamptz - interval '90 days'`,
      [f.from]
    ),
    pool.query(
      `SELECT landing_page, count(*) AS c FROM analytics_sessions
       WHERE started_at >= $1::timestamptz - interval '90 days' AND landing_page IS NOT NULL
       GROUP BY 1 ORDER BY c DESC LIMIT 100`,
      [f.from]
    ),
    pool.query(
      `SELECT DISTINCT p.id, p.name FROM publishers p
       WHERE EXISTS (SELECT 1 FROM analytics_events e WHERE e.publisher_id = p.id) ORDER BY p.name LIMIT 300`
    ),
    pool.query(`SELECT id, name, channel_url FROM youtube_channels WHERE status IN ('approved', 'pending', 'submitted') ORDER BY name NULLS LAST LIMIT 300`),
    pool.query(`SELECT id, slug, title FROM youtube_videos WHERE status IN ('approved', 'suspended') ORDER BY approved_at DESC NULLS LAST LIMIT 300`),
  ]);
  const a = attrib.rows[0];
  return {
    countries: countries.rows,
    campaigns: (a.campaigns || []).sort(),
    sources: (a.sources || []).sort(),
    mediums: (a.mediums || []).sort(),
    landing_pages: landing.rows.map((r) => r.landing_page),
    publishers: publishers.rows,
    youtube_channels: channels.rows,
    youtube_videos: videos.rows,
  };
}

function toCsv(rows) {
  if (rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    // Neutralise spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

const EXPORT_LIMIT = 50000;

async function exportDataset(pool, f, dataset) {
  if (dataset === 'events') {
    const cte = eventsCte(f);
    const { rows } = await pool.query(
      `${cte.sql}
       SELECT event_id, event_name, event_category, occurred_at, visitor_id, session_id, page_path, page_type,
              country_iso, publisher_id, video_id, article_id, utm_source, utm_medium, utm_campaign, utm_content,
              utm_term, channel, is_facebook, is_paid, landing_page, properties, source, meta_status
       FROM ev ORDER BY occurred_at LIMIT ${EXPORT_LIMIT}`,
      cte.params
    );
    return rows;
  }
  if (dataset === 'sessions') {
    const cte = eventsCte(f);
    const { rows } = await pool.query(
      `${cte.sql}
       SELECT s.id AS session_id, s.visitor_id, s.started_at, s.last_activity_at, s.landing_page, s.referrer,
              s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.utm_term, s.channel, s.is_facebook,
              s.is_paid, s.device_class, s.page_views, s.event_count
       FROM analytics_sessions s WHERE s.id IN (SELECT DISTINCT session_id FROM ev)
       ORDER BY s.started_at LIMIT ${EXPORT_LIMIT}`,
      cte.params
    );
    return rows;
  }
  if (dataset === 'campaigns') return (await campaigns(pool, f)).ads;
  if (dataset === 'campaign_totals') return (await campaigns(pool, f)).campaigns;
  if (dataset === 'landing_pages') return landingPages(pool, f);
  if (dataset === 'youtube') return youtubePerformance(pool, f);
  if (dataset === 'funnel') return (await funnel(pool, f, 'facebook')).stages;
  return null;
}

function registerAnalyticsAdminRoutes(admin, pool) {
  const withFilters = (handler) => async (req, reply) => {
    let f;
    try {
      f = await parseFilters(pool, req.query || {});
    } catch (err) {
      if (err instanceof FilterError) return reply.code(400).send({ error: err.message });
      throw err;
    }
    return handler(req, reply, f);
  };

  admin.get('/api/admin/analytics/dashboard', withFilters(async (req, reply, f) => {
    const scope = req.query.funnel_scope === 'all' ? 'all' : 'facebook';
    const [ov, camp, lp, pubs, yt, fun] = await Promise.all([
      overview(pool, f), campaigns(pool, f), landingPages(pool, f), publisherRegistration(pool, f),
      youtubePerformance(pool, f), funnel(pool, f, scope),
    ]);
    return {
      filters: { ...f, from: f.from, to: f.to },
      overview: ov,
      campaigns: camp,
      landing_pages: lp,
      publisher_registration: pubs,
      youtube: yt,
      funnel: fun,
    };
  }));

  admin.get('/api/admin/analytics/funnel', withFilters(async (req, reply, f) => funnel(pool, f, req.query.scope === 'all' ? 'all' : 'facebook')));

  admin.get('/api/admin/analytics/filters', withFilters(async (req, reply, f) => filterOptions(pool, f)));

  admin.get('/api/admin/analytics/export', withFilters(async (req, reply, f) => {
    const dataset = String(req.query.dataset || 'events');
    const format = req.query.format === 'json' ? 'json' : 'csv';
    const rows = await exportDataset(pool, f, dataset);
    if (rows === null) return reply.code(400).send({ error: 'Unknown dataset' });
    const day = new Date().toISOString().slice(0, 10);
    const filename = `ndp-${dataset}-${f.range}-${day}.${format}`;
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    reply.header('Cache-Control', 'no-store');
    if (format === 'json') {
      reply.type('application/json');
      return JSON.stringify({ dataset, filters: f, row_count: rows.length, rows });
    }
    reply.type('text/csv; charset=utf-8');
    return toCsv(rows);
  }));

  // Event test console: newest events first, polled by the admin UI.
  // Visitor/session ids are truncated unless the admin filters on their own
  // full visitor id. No personal data exists in this table to begin with.
  admin.get('/api/admin/analytics/live', async (req) => {
    const after = Number.isInteger(Number(req.query.after_id)) ? Number(req.query.after_id) : 0;
    const visitor = isUuid(req.query.visitor_id) ? req.query.visitor_id.toLowerCase() : null;
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const { rows } = await pool.query(
      `SELECT id, event_id, event_name, event_category, occurred_at, received_at, page_path, utm_campaign, utm_source,
              utm_medium, utm_content, channel, left(visitor_id::text, 8) AS visitor, left(session_id::text, 8) AS session,
              country_iso, video_id, publisher_id, properties, is_debug, source, meta_status
       FROM analytics_events
       WHERE id > $1 AND ($2::uuid IS NULL OR visitor_id = $2) AND received_at > now() - interval '24 hours'
       ORDER BY id DESC LIMIT $3`,
      [after, visitor, limit]
    );
    return { events: rows, server_time: new Date().toISOString() };
  });

  // Campaign registry + manual spend entry (for cost per lead).
  admin.get('/api/admin/campaigns', async () => {
    const { rows } = await pool.query(
      `SELECT c.*, coalesce(sum(s.amount), 0) AS total_spend, min(s.currency) AS currency,
              coalesce(json_agg(json_build_object('id', s.id, 'spend_date', s.spend_date, 'utm_content', s.utm_content,
                'amount', s.amount, 'currency', s.currency, 'impressions', s.impressions, 'link_clicks', s.link_clicks)
                ORDER BY s.spend_date DESC) FILTER (WHERE s.id IS NOT NULL), '[]') AS spend
       FROM campaigns c LEFT JOIN campaign_spend s ON s.campaign_id = c.id
       GROUP BY c.id ORDER BY c.created_at DESC`
    );
    const discovered = await pool.query(
      `SELECT DISTINCT utm_campaign FROM analytics_sessions
       WHERE utm_campaign IS NOT NULL AND utm_campaign NOT IN (SELECT utm_campaign FROM campaigns)
       ORDER BY 1 LIMIT 100`
    );
    return { campaigns: rows, unregistered_campaigns: discovered.rows.map((r) => r.utm_campaign) };
  });

  admin.post('/api/admin/campaigns', async (req, reply) => {
    const b = req.body || {};
    const key = cleanText(b.utm_campaign, 100);
    if (!key) return reply.code(400).send({ error: 'utm_campaign is required' });
    const platform = ['meta', 'google', 'tiktok', 'other'].includes(b.platform) ? b.platform : 'meta';
    const status = ['draft', 'active', 'paused', 'ended'].includes(b.status) ? b.status : 'active';
    const { rows } = await pool.query(
      `INSERT INTO campaigns (utm_campaign, label, platform, objective, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (utm_campaign) DO UPDATE SET label = EXCLUDED.label, platform = EXCLUDED.platform,
         objective = EXCLUDED.objective, status = EXCLUDED.status, notes = EXCLUDED.notes
       RETURNING id`,
      [key, cleanText(b.label, 200), platform, cleanText(b.objective, 100), status, cleanText(b.notes, 2000)]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  admin.post('/api/admin/campaigns/:id/spend', async (req, reply) => {
    const b = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.spend_date || '')) return reply.code(400).send({ error: 'spend_date must be YYYY-MM-DD' });
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e9) return reply.code(400).send({ error: 'amount must be a positive number' });
    const currency = typeof b.currency === 'string' && /^[A-Z]{3}$/.test(b.currency) ? b.currency : 'EUR';
    const optInt = (v) => (v === undefined || v === null || v === '' ? null : Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : NaN);
    const impressions = optInt(b.impressions);
    const linkClicks = optInt(b.link_clicks);
    if (Number.isNaN(impressions) || Number.isNaN(linkClicks)) return reply.code(400).send({ error: 'impressions and link_clicks must be whole numbers' });
    const { rows: camp } = await pool.query('SELECT id FROM campaigns WHERE id = $1', [req.params.id]);
    if (camp.length === 0) return reply.code(404).send({ error: 'Campaign not found' });
    const { rows } = await pool.query(
      `INSERT INTO campaign_spend (campaign_id, utm_content, spend_date, amount, currency, impressions, link_clicks)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (campaign_id, utm_content, spend_date) DO UPDATE SET amount = EXCLUDED.amount,
         currency = EXCLUDED.currency, impressions = EXCLUDED.impressions, link_clicks = EXCLUDED.link_clicks
       RETURNING id`,
      [req.params.id, cleanText(b.utm_content, 100) || '', b.spend_date, amount, currency, impressions, linkClicks]
    );
    return reply.code(201).send({ id: rows[0].id });
  });

  admin.delete('/api/admin/campaign-spend/:id', async (req, reply) => {
    const { rowCount } = await pool.query('DELETE FROM campaign_spend WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return reply.code(404).send({ error: 'Spend entry not found' });
    return { status: 'deleted' };
  });
}

module.exports = {
  registerAnalyticsAdminRoutes,
  parseFilters,
  eventsCte,
  overview,
  campaigns,
  landingPages,
  funnel,
  youtubePerformance,
  publisherRegistration,
  toCsv,
};
