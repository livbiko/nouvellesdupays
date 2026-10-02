const crypto = require('crypto');

// Unique client IP per call, via X-Forwarded-For (the app runs with
// trustProxy, exactly as behind ingress-nginx in production) -- lets a test
// file exercise the strict per-IP rate limits of the public form endpoints
// (5/hour for publisher registration) without tripping them.
let ipCounter = 1;
function freshIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

// Fields every public form sends: an empty honeypot and a render timestamp
// comfortably older than the minimum fill time.
function formBase() {
  return { website_hp: '', form_started_at: Date.now() - 5000 };
}

const uuid = () => crypto.randomUUID();

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function trackingContext({ visitorId = uuid(), sessionId = uuid(), advertising = false, session = {} } = {}) {
  return {
    visitor_id: visitorId,
    session_id: sessionId,
    event_id: uuid(),
    consent: { analytics: true, advertising },
    page_path: '/register',
    session,
  };
}

// Builds the JSON body the browser tracker sends to POST /api/track.
function trackBatch({ visitorId = uuid(), sessionId = uuid(), session = {}, events, advertising = false }) {
  return {
    visitor_id: visitorId,
    session_id: sessionId,
    consent: { analytics: true, advertising },
    session,
    first_touch: session,
    events: events.map((e) => ({ event_id: uuid(), ts: Date.now(), ...e })),
  };
}

// Minimal Response-like object for stubbing global fetch.
function fakeResponse(status, body, headers = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

module.exports = { freshIp, formBase, uuid, BROWSER_UA, trackingContext, trackBatch, fakeResponse };
