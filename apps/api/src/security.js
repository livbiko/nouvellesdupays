const crypto = require('crypto');
const { ALLOWED_ORIGINS } = require('./origins');
const { validatePublicHttpUrl } = require('@nouvellesdupays/shared/src/urlSafety');

// Shared input-hardening helpers for the public (unauthenticated) write
// endpoints: publisher registration, YouTube submission, visitor
// registration, contact form, event tracking.
//
// CSRF: the API uses no cookies at all (admin auth is a Bearer token in a
// header, public forms are anonymous), so there is no ambient credential a
// cross-site request could ride on. On top of that, rejectForeignOrigin()
// refuses any browser request whose Origin header isn't ours, and the form
// endpoints only accept application/json (a cross-site HTML <form> can't
// send that without a CORS preflight, which CORS denies).
//
// XSS: every free-text field is passed through cleanText() (tags and
// control characters stripped, length-capped) before storage, and the
// frontend renders everything as React text nodes, never as HTML.
//
// SQL injection: every query in this codebase is parameterised; dynamic
// column lists are only ever built from hard-coded allow-lists.

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Strip HTML tags, control characters and surrounding whitespace, cap length.
function cleanText(value, max = 500) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const s = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (!s) return null;
  return s.slice(0, max);
}

function cleanEmail(value) {
  const s = cleanText(value, 254);
  if (!s) return null;
  const lower = s.toLowerCase();
  return EMAIL_RE.test(lower) ? lower : null;
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function hashEmail(email) {
  return crypto.createHash('sha256').update(String(email).trim().toLowerCase()).digest('hex');
}

// Optional URL field: returns { value } (null when blank) or { error }.
function optionalUrl(value, field, { hosts } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') return { value: null };
  const v = validatePublicHttpUrl(String(value));
  if (!v.ok) return { error: `${field}: ${v.error}` };
  if (hosts) {
    const host = new URL(v.url).hostname.toLowerCase().replace(/^www\.|^m\./, '');
    if (!hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return { error: `${field} must be a ${hosts[0]} URL` };
    }
  }
  return { value: v.url };
}

function requiredUrl(value, field) {
  const r = optionalUrl(value, field);
  if (r.error) return r;
  if (!r.value) return { error: `${field} is required` };
  return r;
}

// Up to `max` URLs from an array or a newline/comma-separated string.
function urlList(value, field, max = 10) {
  let items = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === 'string') items = value.split(/[\n,]+/);
  items = items.map((s) => String(s).trim()).filter(Boolean);
  if (items.length > max) return { error: `${field}: at most ${max} URLs` };
  const out = [];
  for (const item of items) {
    const v = validatePublicHttpUrl(item);
    if (!v.ok) return { error: `${field}: ${v.error} (${item.slice(0, 80)})` };
    out.push(v.url);
  }
  return { value: out };
}

// Article URL patterns are glob-like ("/article/*"); restrict the
// character set so they can never smuggle markup or regex syntax.
function patternList(value, max = 10) {
  let items = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === 'string') items = value.split(/[\n,]+/);
  items = items.map((s) => String(s).trim()).filter(Boolean);
  if (items.length > max) return { error: `article_url_patterns: at most ${max} patterns` };
  for (const p of items) {
    if (p.length > 200 || !/^[\w\-./*%=?&~:]+$/.test(p)) {
      return { error: `article_url_patterns: invalid pattern "${p.slice(0, 60)}"` };
    }
  }
  return { value: items };
}

// Honeypot + minimum fill-time spam check. Every public form renders a
// visually-hidden "website_hp" input (bots fill it, humans can't see it)
// and sends form_started_at (ms epoch when the form was first rendered).
// A real person cannot complete these forms in under ~2.5s.
const MIN_FILL_MS = 2500;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;

function spamCheck(body) {
  if (body.website_hp && String(body.website_hp).trim() !== '') return 'honeypot';
  const started = Number(body.form_started_at);
  if (!Number.isFinite(started)) return 'missing_timing';
  const elapsed = Date.now() - started;
  if (elapsed < MIN_FILL_MS) return 'too_fast';
  if (elapsed > MAX_FORM_AGE_MS) return 'stale_form';
  const text = [body.description, body.message].filter(Boolean).join(' ');
  if ((text.match(/https?:\/\//g) || []).length > 5) return 'too_many_links';
  return null;
}

// preHandler for public write routes.
function rejectForeignOrigin(req, reply, done) {
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    reply.code(403).send({ error: 'Origin not allowed' });
    return;
  }
  done();
}

// preHandler: forms must be JSON (blocks cross-site <form> posts).
function requireJson(req, reply, done) {
  const ct = String(req.headers['content-type'] || '');
  if (!ct.startsWith('application/json')) {
    reply.code(415).send({ error: 'Content-Type must be application/json' });
    return;
  }
  done();
}

module.exports = {
  cleanText,
  cleanEmail,
  isUuid,
  hashEmail,
  optionalUrl,
  requiredUrl,
  urlList,
  patternList,
  spamCheck,
  rejectForeignOrigin,
  requireJson,
  MIN_FILL_MS,
};
