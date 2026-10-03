const { EVENTS } = require('@nouvellesdupays/shared/src/trackingEvents');
const { getSettings, publicSettings } = require('./settings');
const { isUuid, rejectForeignOrigin } = require('./security');
const metaCapi = require('./metaCapi');

// First-party event ingestion.
//
// The browser batches events (apps/web/src/lib/tracking.ts) and POSTs them
// here as JSON. Only visitors who granted analytics consent ever have a
// visitor_id/session_id, so anything arriving without them is dropped.
// Attribution (UTM, fbclid, landing page, referrer) is captured by the
// browser on the first page of each session and sent with every batch; the
// server stores it once per session (first write wins) and stamps it onto
// every event row so dashboards never need a join.

const MAX_EVENTS_PER_BATCH = 50;
const MAX_CLOCK_SKEW_PAST_MS = 15 * 60 * 1000;
const MAX_CLOCK_SKEW_FUTURE_MS = 60 * 1000;

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python-requests|axios|node-fetch|facebookexternalhit|preview/i;
const PII_KEYS = new Set(['email', 'mail', 'phone', 'tel', 'name', 'first_name', 'last_name', 'firstname', 'lastname', 'address', 'password', 'ip']);
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/;

const FB_SOURCES = new Set(['facebook', 'fb', 'instagram', 'ig', 'meta', 'messenger', 'facebook.com', 'm.facebook.com', 'l.facebook.com', 'lm.facebook.com', 'instagram.com', 'audience_network', 'an']);
const SOCIAL_SOURCES = new Set([...FB_SOURCES, 'twitter', 'x', 't.co', 'linkedin', 'tiktok', 'youtube', 'whatsapp', 'telegram', 'snapchat', 'pinterest', 'reddit']);
const SEARCH_SOURCES = new Set(['google', 'bing', 'duckduckgo', 'yahoo', 'yandex', 'ecosia', 'qwant', 'baidu']);
const PAID_MEDIUMS = new Set(['paid_social', 'paidsocial', 'paid-social', 'social_paid', 'cpc', 'ppc', 'paid', 'cpm', 'cpv', 'cpa', 'display', 'ads', 'ad', 'paid_search', 'sponsored']);
const FB_REFERRER_RE = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|messenger\.com)$/;
const SOCIAL_REFERRER_RE = /(^|\.)(facebook\.com|fb\.com|instagram\.com|messenger\.com|t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|tiktok\.com|youtube\.com|whatsapp\.com|telegram\.org|t\.me|reddit\.com|pinterest\.com|snapchat\.com)$/;
const SEARCH_REFERRER_RE = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|yahoo\.[a-z.]+|yandex\.[a-z.]+|ecosia\.org|qwant\.com|baidu\.com)$/;

function str(v, max = 100) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001F\u007F<>]/g, '').trim();
  return s ? s.slice(0, max) : null;
}

// Path only (no query/hash -- those can carry fbclid, emails, tokens).
function cleanPath(v) {
  const s = str(v, 500);
  if (!s) return null;
  let path = s;
  try {
    path = new URL(s, 'https://nouvellesdupays.com').pathname;
  } catch {
    return null;
  }
  return path.startsWith('/') ? path.slice(0, 300) : null;
}

// Referrer reduced to origin + path; same-site referrers are dropped.
function cleanReferrer(v) {
  const s = str(v, 1000);
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (/(^|\.)nouvellesdupays\.com$/.test(u.hostname)) return null;
    return `${u.origin}${u.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

function cleanAttribution(a) {
  a = a && typeof a === 'object' ? a : {};
  const lower = (v) => (str(v) || '').toLowerCase() || null;
  const fbclid = str(a.fbclid, 500);
  return {
    utm_source: lower(a.utm_source),
    utm_medium: lower(a.utm_medium),
    utm_campaign: str(a.utm_campaign),
    utm_content: str(a.utm_content),
    utm_term: str(a.utm_term),
    fbclid: fbclid && /^[\w.-]+$/.test(fbclid) ? fbclid : null,
    landing_page: cleanPath(a.landing_page),
    referrer: cleanReferrer(a.referrer),
  };
}

function classifyChannel({ utm_source: src, utm_medium: med, fbclid, referrer }) {
  let refHost = null;
  if (referrer) {
    try {
      refHost = new URL(referrer).hostname.toLowerCase();
    } catch {
      refHost = null;
    }
  }
  const isFacebook = Boolean(
    (src && FB_SOURCES.has(src)) || fbclid || (!src && refHost && FB_REFERRER_RE.test(refHost))
  );

  if (med && PAID_MEDIUMS.has(med)) {
    const social = isFacebook || (src && SOCIAL_SOURCES.has(src)) || med.includes('social');
    if (social) return { channel: 'paid_social', is_facebook: isFacebook, is_paid: true };
    if ((src && SEARCH_SOURCES.has(src)) || ['cpc', 'ppc', 'paid_search'].includes(med)) {
      return { channel: 'paid_search', is_facebook: isFacebook, is_paid: true };
    }
    return { channel: 'other', is_facebook: isFacebook, is_paid: true };
  }
  if (med === 'email' || (src && src.includes('newsletter'))) return { channel: 'email', is_facebook: isFacebook, is_paid: false };
  if (src || med) {
    if (isFacebook || (src && SOCIAL_SOURCES.has(src)) || (med && med.includes('social'))) {
      return { channel: 'organic_social', is_facebook: isFacebook, is_paid: false };
    }
    if (med === 'organic' || (src && SEARCH_SOURCES.has(src))) return { channel: 'organic_search', is_facebook: false, is_paid: false };
    if (med === 'referral') return { channel: 'referral', is_facebook: false, is_paid: false };
    return { channel: 'other', is_facebook: false, is_paid: false };
  }
  // fbclid with no UTM: Meta appends it to ad clicks AND organic shares, so
  // it proves "came from Facebook" but not "paid". Tag ads with
  // utm_medium=paid_social to get them classified as paid.
  if (fbclid) return { channel: 'organic_social', is_facebook: true, is_paid: false };
  if (refHost) {
    if (SEARCH_REFERRER_RE.test(refHost)) return { channel: 'organic_search', is_facebook: false, is_paid: false };
    if (SOCIAL_REFERRER_RE.test(refHost)) return { channel: 'organic_social', is_facebook: isFacebook, is_paid: false };
    return { channel: 'referral', is_facebook: false, is_paid: false };
  }
  return { channel: 'direct', is_facebook: false, is_paid: false };
}

function deviceClass(ua) {
  if (!ua) return null;
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function pageTypeFor(path) {
  if (!path) return null;
  if (path === '/') return 'home';
  if (/^\/youtube\/[^/]+/.test(path)) return 'youtube_landing';
  if (path === '/youtube') return 'youtube_index';
  if (path.startsWith('/register-publisher')) return 'publisher_registration';
  if (path.startsWith('/register')) return 'registration';
  if (path.startsWith('/submit-video')) return 'youtube_submission';
  if (path.startsWith('/contact')) return 'contact';
  if (path.startsWith('/privacy')) return 'privacy';
  return 'other';
}

// Only flat primitives with safe keys; PII-looking keys/values dropped.
function sanitizeProps(props) {
  const out = {};
  if (!props || typeof props !== 'object' || Array.isArray(props)) return out;
  let count = 0;
  for (const [k, v] of Object.entries(props)) {
    if (count >= 20) break;
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(k) || PII_KEYS.has(k)) continue;
    if (typeof v === 'string') {
      const s = str(v, 200);
      if (!s || EMAIL_LIKE.test(s)) continue;
      out[k] = s;
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === 'boolean') {
      out[k] = v;
    } else {
      continue;
    }
    count += 1;
  }
  return out;
}

function positiveInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 2147483647 ? n : null;
}

function eventTime(ts, now) {
  const t = Number(ts);
  if (!Number.isFinite(t)) return new Date(now);
  if (t < now - MAX_CLOCK_SKEW_PAST_MS || t > now + MAX_CLOCK_SKEW_FUTURE_MS) return new Date(now);
  return new Date(t);
}

/**
 * Upserts visitor + session and inserts events. Shared by POST /api/track
 * (source 'client') and server-recorded conversions (source 'server').
 * Returns { inserted: [event_id...], duplicates }.
 */
async function recordEvents(pool, ctx) {
  const { visitor_id: visitorId, session_id: sessionId, events, consent, settings } = ctx;
  const now = Date.now();
  const session = cleanAttribution(ctx.session);
  const first = cleanAttribution(ctx.first_touch || ctx.session);
  const sessionClass = classifyChannel(session);
  const firstClass = classifyChannel(first);
  const device = deviceClass(ctx.user_agent);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO analytics_visitors (id, first_utm_source, first_utm_medium, first_utm_campaign, first_utm_content,
         first_utm_term, first_fbclid, first_landing_page, first_referrer, first_channel)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
      [visitorId, first.utm_source, first.utm_medium, first.utm_campaign, first.utm_content, first.utm_term,
        first.fbclid, first.landing_page, first.referrer, firstClass.channel]
    );

    const pageViews = events.filter((e) => e.event_name === 'PageView').length;
    const { rows: sessRows } = await client.query(
      `INSERT INTO analytics_sessions (id, visitor_id, landing_page, referrer, utm_source, utm_medium, utm_campaign,
         utm_content, utm_term, fbclid, channel, is_facebook, is_paid, device_class, page_views, event_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       ON CONFLICT (id) DO UPDATE SET
         last_activity_at = now(),
         page_views = analytics_sessions.page_views + EXCLUDED.page_views,
         event_count = analytics_sessions.event_count + EXCLUDED.event_count
       RETURNING visitor_id, landing_page, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                 channel, is_facebook, is_paid`,
      [sessionId, visitorId, session.landing_page, session.referrer, session.utm_source, session.utm_medium,
        session.utm_campaign, session.utm_content, session.utm_term, session.fbclid, sessionClass.channel,
        sessionClass.is_facebook, sessionClass.is_paid, device, pageViews, events.length]
    );
    const s = sessRows[0];
    if (s.visitor_id !== visitorId) {
      // A session id can only ever belong to the visitor that created it.
      await client.query('ROLLBACK');
      return { inserted: [], duplicates: 0, rejected: events.length };
    }

    const cols = ['event_id', 'event_name', 'event_category', 'occurred_at', 'visitor_id', 'session_id', 'page_path',
      'page_type', 'country_iso', 'publisher_id', 'video_id', 'article_id', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_content', 'utm_term', 'channel', 'is_facebook', 'is_paid', 'landing_page', 'properties', 'is_debug',
      'source', 'meta_status'];
    const values = [];
    const rowsSql = [];
    const prepared = [];
    for (const e of events) {
      const metaStatus = metaCapi.metaStatusFor(e.event_name, { advertisingConsent: Boolean(consent?.advertising), settings });
      const row = {
        event_id: e.event_id,
        event_name: e.event_name,
        occurred_at: eventTime(e.ts, now),
        page_path: e.page_path,
        country_iso: e.country_iso,
        video_id: e.video_id,
        properties: e.properties,
      };
      prepared.push({ ...row, meta_status: metaStatus });
      const base = values.length;
      values.push(
        e.event_id, e.event_name, EVENTS[e.event_name].category, row.occurred_at, visitorId, sessionId, e.page_path,
        pageTypeFor(e.page_path), e.country_iso, e.publisher_id, e.video_id, e.article_id, s.utm_source, s.utm_medium,
        s.utm_campaign, s.utm_content, s.utm_term, s.channel, s.is_facebook, s.is_paid, s.landing_page,
        JSON.stringify(e.properties || {}), Boolean(e.debug), ctx.source || 'client', metaStatus
      );
      rowsSql.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(',')})`);
    }
    const { rows: inserted } = await client.query(
      `INSERT INTO analytics_events (${cols.join(',')}) VALUES ${rowsSql.join(',')}
       ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      values
    );
    await client.query('COMMIT');

    const insertedIds = new Set(inserted.map((r) => r.event_id));
    for (const p of prepared) {
      if (p.meta_status === 'queued' && insertedIds.has(p.event_id)) {
        metaCapi.enqueue({
          ...p,
          visitor_id: visitorId,
          ip: ctx.ip,
          user_agent: ctx.user_agent,
          fbp: ctx.fbp,
          fbc: ctx.fbc,
          email: p.email || ctx.email,
        }, settings);
      }
    }
    return { inserted: [...insertedIds], duplicates: events.length - insertedIds.size, rejected: 0 };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function normaliseEvent(raw, defaults = {}) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isUuid(raw.event_id) || !EVENTS[raw.name]) return null;
  const iso = typeof raw.country_iso === 'string' && /^[A-Za-z]{2}$/.test(raw.country_iso) ? raw.country_iso.toUpperCase() : null;
  return {
    event_id: raw.event_id.toLowerCase(),
    event_name: raw.name,
    ts: raw.ts,
    page_path: cleanPath(raw.page_path) || defaults.page_path || null,
    country_iso: iso,
    publisher_id: positiveInt(raw.publisher_id),
    video_id: positiveInt(raw.video_id),
    article_id: positiveInt(raw.article_id),
    properties: sanitizeProps(raw.props),
    debug: raw.debug === true,
  };
}

function cleanCookieValue(v) {
  const s = str(v, 600);
  return s && /^fb\.\d\.\d+\.[\w.-]+$/.test(s) ? s : null;
}

/**
 * For form endpoints (registration, submissions, contact): records a
 * conversion server-side so it is counted even when an ad-blocker drops the
 * browser beacon. `tracking` is the optional context the browser attaches
 * to the form payload -- present only when the visitor consented to
 * analytics. Returns the event_id (for Pixel deduplication) or null.
 */
async function recordServerConversion(pool, req, tracking, { name, properties, country_iso, video_id, publisher_id, email }) {
  try {
    if (!tracking || typeof tracking !== 'object') return null;
    if (!isUuid(tracking.visitor_id) || !isUuid(tracking.session_id) || !isUuid(tracking.event_id)) return null;
    if (!tracking.consent || tracking.consent.analytics !== true) return null;
    const settings = await getSettings(pool);
    if (!settings.tracking_enabled) return null;
    const evt = normaliseEvent({
      event_id: tracking.event_id,
      name,
      page_path: tracking.page_path,
      country_iso,
      video_id,
      publisher_id,
      props: properties,
      debug: tracking.debug,
    });
    if (!evt) return null;
    const result = await recordEvents(pool, {
      visitor_id: tracking.visitor_id.toLowerCase(),
      session_id: tracking.session_id.toLowerCase(),
      session: tracking.session,
      first_touch: tracking.first_touch,
      events: [evt],
      consent: tracking.consent,
      settings,
      source: 'server',
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      fbp: cleanCookieValue(tracking.fbp),
      fbc: cleanCookieValue(tracking.fbc),
      email: tracking.consent.advertising ? email : null,
    });
    return result.inserted.length > 0 ? evt.event_id : null;
  } catch (err) {
    // A tracking failure must never fail the user's actual submission.
    req.log.error({ err }, 'recordServerConversion failed');
    return null;
  }
}

function registerTrackingRoutes(fastify) {
  const pool = fastify.pg;
  metaCapi.configure({ pool, log: fastify.log });

  fastify.get('/api/tracking/config', async (req, reply) => {
    const settings = await getSettings(pool);
    reply.header('Cache-Control', 'public, max-age=60');
    return publicSettings(settings);
  });

  fastify.post(
    '/api/track',
    {
      bodyLimit: 64 * 1024,
      preHandler: rejectForeignOrigin,
      config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      // text/plain is accepted so navigator.sendBeacon() works without a
      // CORS preflight; the body is still parsed strictly as JSON.
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          return reply.code(400).send({ error: 'Body must be JSON' });
        }
      }
      if (!body || typeof body !== 'object') return reply.code(400).send({ error: 'Body must be a JSON object' });

      const ua = String(req.headers['user-agent'] || '');
      if (!ua || BOT_RE.test(ua)) return reply.code(204).send();

      const settings = await getSettings(pool);
      if (!settings.tracking_enabled) return reply.code(204).send();
      if (!body.consent || body.consent.analytics !== true) return reply.code(204).send();
      if (!isUuid(body.visitor_id) || !isUuid(body.session_id)) {
        return reply.code(400).send({ error: 'visitor_id and session_id must be UUIDs' });
      }
      if (!Array.isArray(body.events) || body.events.length === 0) {
        return reply.code(400).send({ error: 'events must be a non-empty array' });
      }
      if (body.events.length > MAX_EVENTS_PER_BATCH) {
        return reply.code(413).send({ error: `At most ${MAX_EVENTS_PER_BATCH} events per batch` });
      }

      const events = [];
      const seen = new Set();
      let rejected = 0;
      for (const raw of body.events) {
        const evt = normaliseEvent(raw);
        if (!evt || seen.has(evt.event_id)) {
          rejected += 1;
          continue;
        }
        seen.add(evt.event_id);
        events.push(evt);
      }
      if (events.length === 0) return reply.code(400).send({ error: 'No valid events in batch', rejected });

      const result = await recordEvents(pool, {
        visitor_id: body.visitor_id.toLowerCase(),
        session_id: body.session_id.toLowerCase(),
        session: body.session,
        first_touch: body.first_touch,
        events,
        consent: body.consent,
        settings,
        source: 'client',
        ip: req.ip,
        user_agent: ua,
        fbp: cleanCookieValue(body.fbp),
        fbc: cleanCookieValue(body.fbc),
      });
      if (settings.event_debug) {
        req.log.info({ events: events.map((e) => e.event_name), session: body.session_id }, 'tracking batch');
      }
      return reply.code(202).send({
        accepted: result.inserted.length,
        duplicates: result.duplicates,
        rejected: rejected + result.rejected,
      });
    }
  );
}

module.exports = {
  registerTrackingRoutes,
  recordEvents,
  recordServerConversion,
  classifyChannel,
  cleanAttribution,
  sanitizeProps,
  deviceClass,
  pageTypeFor,
};
