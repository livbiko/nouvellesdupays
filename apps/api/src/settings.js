// Admin-editable runtime settings, stored in app_settings (migration 011).
// Every key has a typed schema and a default; env vars provide the default
// for the few settings that also have one (e.g. META_PIXEL_ID), so a fresh
// deploy works from env alone and an admin can override at runtime.
//
// Secrets are deliberately NOT settings: META_ACCESS_TOKEN and
// YOUTUBE_API_KEY are read from the environment only and are never returned
// by any endpoint (the admin UI just sees "configured: true/false").

const CACHE_TTL_MS = 30 * 1000;

const SCHEMA = {
  tracking_enabled:        { type: 'boolean', default: () => process.env.TRACKING_ENABLED !== 'false' },
  // 'opt_in'  = nothing is stored or sent until the visitor accepts (UK/EU default)
  // 'opt_out' = analytics on by default, visitor can refuse; advertising still opt-in
  consent_mode:            { type: 'enum', values: ['opt_in', 'opt_out'], default: () => process.env.CONSENT_MODE || 'opt_in' },
  consent_policy_version:  { type: 'string', max: 20, default: () => '1' },
  meta_pixel_enabled:      { type: 'boolean', default: () => Boolean(process.env.META_PIXEL_ID) },
  meta_pixel_id:           { type: 'string', max: 32, pattern: /^\d{0,32}$/, default: () => process.env.META_PIXEL_ID || '' },
  meta_capi_enabled:       { type: 'boolean', default: () => Boolean(process.env.META_ACCESS_TOKEN) },
  meta_test_event_code:    { type: 'string', max: 40, pattern: /^[A-Za-z0-9_-]*$/, default: () => process.env.META_TEST_EVENT_CODE || '' },
  event_debug:             { type: 'boolean', default: () => process.env.TRACKING_DEBUG === 'true' },
  publisher_submissions_open: { type: 'boolean', default: () => true },
  youtube_submissions_open:   { type: 'boolean', default: () => true },
  crawler_default_frequency_minutes: { type: 'integer', min: 15, max: 10080, default: () => 60 },
  crawler_max_articles_per_run:      { type: 'integer', min: 1, max: 100, default: () => 20 },
  landing_cta_text:        { type: 'string', max: 200, default: () => 'Découvrez plus d’actualités africaines et de voix indépendantes sur NouvellesDuPays.' },
  landing_show_related_news:   { type: 'boolean', default: () => true },
  landing_show_related_videos: { type: 'boolean', default: () => true },
};

// Settings safe to expose to anonymous browsers via GET /api/tracking/config.
const PUBLIC_KEYS = [
  'tracking_enabled', 'consent_mode', 'consent_policy_version', 'meta_pixel_enabled', 'meta_pixel_id', 'event_debug',
];

let cache = null;
let cacheAt = 0;

function validate(key, value) {
  const spec = SCHEMA[key];
  if (!spec) return { error: `Unknown setting "${key}"` };
  switch (spec.type) {
    case 'boolean':
      if (typeof value !== 'boolean') return { error: `${key} must be true or false` };
      return { value };
    case 'integer': {
      const n = Number(value);
      if (!Number.isInteger(n) || n < spec.min || n > spec.max) return { error: `${key} must be an integer between ${spec.min} and ${spec.max}` };
      return { value: n };
    }
    case 'enum':
      if (!spec.values.includes(value)) return { error: `${key} must be one of: ${spec.values.join(', ')}` };
      return { value };
    case 'string': {
      if (typeof value !== 'string') return { error: `${key} must be a string` };
      const s = value.trim().replace(/<[^>]*>/g, '');
      if (s.length > spec.max) return { error: `${key} must be at most ${spec.max} characters` };
      if (spec.pattern && !spec.pattern.test(s)) return { error: `${key} has an invalid format` };
      return { value: s };
    }
    default:
      return { error: `Unsupported setting type for ${key}` };
  }
}

async function getSettings(pool, { fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  const out = {};
  for (const [key, spec] of Object.entries(SCHEMA)) out[key] = spec.default();
  try {
    const { rows } = await pool.query('SELECT key, value FROM app_settings');
    for (const row of rows) {
      if (SCHEMA[row.key]) {
        const v = validate(row.key, row.value);
        if (!v.error) out[row.key] = v.value;
      }
    }
  } catch (err) {
    // A missing table (migration not yet applied) must not take the public
    // site down -- fall back to defaults and log.
    console.error(`[settings] could not load app_settings: ${err.message}`);
  }
  cache = out;
  cacheAt = Date.now();
  return out;
}

async function updateSettings(pool, updates) {
  const entries = Object.entries(updates || {});
  if (entries.length === 0) return { error: 'No settings provided' };
  const validated = [];
  for (const [key, value] of entries) {
    const v = validate(key, value);
    if (v.error) return { error: v.error };
    validated.push([key, v.value]);
  }
  for (const [key, value] of validated) {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [key, JSON.stringify(value)]
    );
  }
  invalidateSettingsCache();
  return { settings: await getSettings(pool, { fresh: true }) };
}

function invalidateSettingsCache() {
  cache = null;
  cacheAt = 0;
}

function publicSettings(settings) {
  const out = {};
  for (const key of PUBLIC_KEYS) out[key] = settings[key];
  // The pixel is only "enabled" for browsers when there's an ID to load.
  out.meta_pixel_enabled = Boolean(settings.meta_pixel_enabled && settings.meta_pixel_id);
  // Whether a Meta test event code is set (never the code itself): debug
  // traffic is only forwarded to Meta while one is, see metaCapi.metaStatusFor.
  out.meta_test_mode = Boolean(settings.meta_test_event_code);
  return out;
}

// Status of server-only secrets, without ever revealing them.
function secretStatus() {
  return {
    meta_access_token_configured: Boolean(process.env.META_ACCESS_TOKEN),
    youtube_api_key_configured: Boolean(process.env.YOUTUBE_API_KEY),
    meta_graph_api_version: process.env.META_GRAPH_API_VERSION || 'v21.0',
  };
}

module.exports = { SCHEMA, getSettings, updateSettings, publicSettings, secretStatus, invalidateSettingsCache };
