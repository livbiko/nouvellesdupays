const crypto = require('crypto');
const { EVENTS } = require('@nouvellesdupays/shared/src/trackingEvents');

// Meta Conversions API (server-side) sender.
//
// Events reach Meta from two places with the SAME event_id: the browser
// Pixel (fbq ... {eventID}) and this server-side call. Meta deduplicates
// the pair on (event_name, event_id), so a visitor whose ad-blocker drops
// the Pixel is still counted once, and a visitor seen by both is not
// double-counted.
//
// Only events that (a) have a Meta mapping in the shared catalogue and
// (b) come from a visitor who granted *advertising* consent are sent. The
// IP address and User-Agent are used for Meta's matching only and are
// never written to the database. Email is sent only as a SHA-256 hash and
// only for conversions where the visitor typed it themselves.
//
// Sending is asynchronous and batched: enqueue() returns immediately, and
// a timer flushes up to 500 events per Graph API request, so tracking can
// never slow down an HTTP response.

const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 500;
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://nouvellesdupays.com';

let queue = [];
let timer = null;
let fetchImpl = (...args) => fetch(...args);
let poolRef = null;
let logger = console;

function sha256(v) {
  return crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');
}

function configure({ pool, log, fetch: f } = {}) {
  if (pool) poolRef = pool;
  if (log) logger = log;
  if (f) fetchImpl = f;
}

function metaMapping(eventName) {
  return EVENTS[eventName] ? EVENTS[eventName].meta : null;
}

// Decides the meta_status an event row should be stored with.
function metaStatusFor(eventName, { advertisingConsent, settings }) {
  if (!metaMapping(eventName)) return 'not_applicable';
  if (!advertisingConsent) return 'no_consent';
  if (!settings.meta_capi_enabled || !process.env.META_ACCESS_TOKEN || !settings.meta_pixel_id) return 'disabled';
  return 'queued';
}

function buildServerEvent(evt) {
  const mapping = metaMapping(evt.event_name);
  const userData = {
    client_ip_address: evt.ip || undefined,
    client_user_agent: evt.user_agent || undefined,
    fbc: evt.fbc || undefined,
    fbp: evt.fbp || undefined,
    external_id: evt.visitor_id ? [sha256(evt.visitor_id)] : undefined,
    em: evt.email ? [sha256(evt.email)] : undefined,
  };
  Object.keys(userData).forEach((k) => userData[k] === undefined && delete userData[k]);

  const customData = {};
  if (mapping.type === 'custom' || mapping.name !== evt.event_name) customData.content_name = evt.event_name;
  if (evt.country_iso) customData.country = evt.country_iso;
  if (evt.video_id) customData.content_ids = [String(evt.video_id)];
  if (evt.properties?.category) customData.content_category = String(evt.properties.category);
  if (evt.properties?.search_term) customData.search_string = String(evt.properties.search_term);

  return {
    event_name: mapping.name,
    event_time: Math.floor(new Date(evt.occurred_at || Date.now()).getTime() / 1000),
    event_id: evt.event_id,
    action_source: 'website',
    event_source_url: evt.page_path ? `${SITE_URL}${evt.page_path}` : SITE_URL,
    user_data: userData,
    custom_data: customData,
  };
}

function enqueue(evt, settings) {
  queue.push({ evt, pixelId: settings.meta_pixel_id, testCode: settings.meta_test_event_code || null });
  if (queue.length >= MAX_BATCH) {
    flush();
  } else if (!timer) {
    timer = setTimeout(flush, FLUSH_DELAY_MS);
    if (timer.unref) timer.unref();
  }
}

async function markStatus(eventIds, status) {
  if (!poolRef || eventIds.length === 0) return;
  try {
    await poolRef.query('UPDATE analytics_events SET meta_status = $2 WHERE event_id = ANY($1::uuid[])', [eventIds, status]);
  } catch (err) {
    logger.error?.(`[meta-capi] could not update meta_status: ${err.message}`);
  }
}

async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const pending = queue.splice(0, queue.length);

  // Group by pixel + test code (normally a single group).
  const groups = new Map();
  for (const item of pending) {
    const key = `${item.pixelId}|${item.testCode || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const token = process.env.META_ACCESS_TOKEN;
  const version = process.env.META_GRAPH_API_VERSION || 'v21.0';

  for (const items of groups.values()) {
    for (let i = 0; i < items.length; i += MAX_BATCH) {
      const chunk = items.slice(i, i + MAX_BATCH);
      const { pixelId, testCode } = chunk[0];
      const ids = chunk.map((c) => c.evt.event_id);
      if (!token || !pixelId) {
        await markStatus(ids, 'disabled');
        continue;
      }
      const body = { data: chunk.map((c) => buildServerEvent(c.evt)) };
      if (testCode) body.test_event_code = testCode;
      try {
        const res = await fetchImpl(
          `https://graph.facebook.com/${version}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
          }
        );
        if (res.ok) {
          await markStatus(ids, 'sent');
        } else {
          const text = await res.text().catch(() => '');
          // Never log the token: the URL is not logged, only Meta's error body.
          logger.error?.(`[meta-capi] Graph API returned ${res.status}: ${text.slice(0, 500)}`);
          await markStatus(ids, 'failed');
        }
      } catch (err) {
        logger.error?.(`[meta-capi] request failed: ${err.message}`);
        await markStatus(ids, 'failed');
      }
    }
  }
}

function _resetForTests() {
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
}

module.exports = { configure, enqueue, flush, metaStatusFor, buildServerEvent, metaMapping, _resetForTests, sha256 };
