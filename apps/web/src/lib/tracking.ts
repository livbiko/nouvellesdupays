// First-party, consent-gated tracking client.
//
// Privacy rules enforced here (see docs/ANALYTICS-TRACKING.md):
//   * Nothing is written to the browser and nothing is sent anywhere until
//     the visitor accepts analytics (consent_mode 'opt_in', the UK/EU
//     default). The landing URL's UTM/fbclid are held in memory only until
//     then, so an ad click's attribution isn't lost if consent comes a few
//     seconds later -- or after a client-side navigation.
//   * The Meta Pixel is loaded only after *advertising* consent.
//   * Identifiers are random UUIDs; no fingerprinting, no email, no IP.
//
// Events are batched and sent with fetch(keepalive) / navigator.sendBeacon
// as text/plain JSON (no CORS preflight), so tracking never blocks
// rendering or navigation.
import { META_EVENT_MAP, type EventName } from './trackingEvents';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 20;
const MAX_QUEUE = 200;
const KEY = {
  consent: 'ndp_consent',
  visitor: 'ndp_vid',
  session: 'ndp_session',
  firstTouch: 'ndp_ft',
};

export interface TrackingConfig {
  tracking_enabled: boolean;
  consent_mode: 'opt_in' | 'opt_out';
  consent_policy_version: string;
  meta_pixel_enabled: boolean;
  meta_pixel_id: string;
  event_debug: boolean;
}

export interface Consent {
  analytics: boolean;
  advertising: boolean;
  version: string;
  ts: number;
}

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  landing_page?: string;
  referrer?: string;
  ts?: number;
}

interface StoredSession {
  id: string;
  started: number;
  last: number;
  attribution: Attribution;
}

export interface EventContext {
  country_iso?: string | null;
  publisher_id?: number | null;
  video_id?: number | null;
  article_id?: number | null;
}

type Props = Record<string, string | number | boolean | null | undefined>;

interface QueuedEvent extends EventContext {
  event_id: string;
  name: EventName;
  ts: number;
  page_path: string;
  props?: Props;
  debug?: boolean;
}

export interface FormTrackingContext {
  visitor_id: string;
  session_id: string;
  event_id: string;
  consent: { analytics: boolean; advertising: boolean };
  page_path: string;
  session: Attribution;
  first_touch: Attribution | null;
  fbp: string | null;
  fbc: string | null;
  // Test traffic (?ndp_debug=1): the server-side conversion is stored with
  // is_debug like the browser's own events, so it stays out of the dashboard.
  debug?: boolean;
}

let config: TrackingConfig | null = null;
let configPromise: Promise<TrackingConfig | null> | null = null;
let queue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingAttribution: Attribution | null = null;
let debugMode = false;
let pixelLoaded = false;
let listenersBound = false;

const isBrowser = () => typeof window !== 'undefined';

function storageGet<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage blocked (private mode, quota) -- tracking degrades to per-page
  }
}

function storageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function uuid(): string {
  if (isBrowser() && window.crypto?.randomUUID) return window.crypto.randomUUID();
  const b = new Uint8Array(16);
  window.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Captures UTM/fbclid/referrer from the URL the visitor landed on. Memory
// only -- persisted solely once analytics consent exists.
function captureLandingAttribution() {
  if (!isBrowser() || pendingAttribution) return;
  const params = new URLSearchParams(window.location.search);
  const a: Attribution = { landing_page: window.location.pathname, ts: Date.now() };
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid'] as const) {
    const v = params.get(k);
    if (v) a[k] = v.slice(0, k === 'fbclid' ? 500 : 100);
  }
  try {
    if (document.referrer) {
      const r = new URL(document.referrer);
      if (r.host !== window.location.host) a.referrer = `${r.origin}${r.pathname}`;
    }
  } catch {
    // ignore malformed referrer
  }
  if (params.get('ndp_debug') === '1') debugMode = true;
  pendingAttribution = a;
}

function hasCampaignParams(a: Attribution | null): boolean {
  return Boolean(a && (a.utm_source || a.utm_medium || a.utm_campaign || a.fbclid));
}

export async function loadTrackingConfig(): Promise<TrackingConfig | null> {
  if (!isBrowser()) return null;
  captureLandingAttribution();
  if (config) return config;
  if (!configPromise) {
    configPromise = fetch(`${API_URL}/api/tracking/config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c: TrackingConfig | null) => {
        config = c;
        if (c?.event_debug) debugMode = true;
        bindLifecycleListeners();
        const consent = getConsent();
        if (consent?.advertising) loadMetaPixel();
        return c;
      })
      .catch(() => null);
  }
  return configPromise;
}

export function getConfig() {
  return config;
}

// Stored consent, or the implied default in opt_out mode. null = not asked yet.
export function getConsent(): Consent | null {
  if (!isBrowser()) return null;
  const stored = storageGet<Consent>(KEY.consent);
  const version = config?.consent_policy_version || '1';
  if (stored && stored.version === version) return stored;
  if (config?.consent_mode === 'opt_out') {
    // GPC (Global Privacy Control) is honoured as a refusal.
    const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
    return { analytics: !gpc, advertising: false, version, ts: 0 };
  }
  return null;
}

export function needsConsentPrompt(): boolean {
  if (!config?.tracking_enabled) return false;
  const stored = storageGet<Consent>(KEY.consent);
  return !stored || stored.version !== (config.consent_policy_version || '1');
}

export function setConsent(analytics: boolean, advertising: boolean) {
  const consent: Consent = { analytics, advertising: analytics && advertising, version: config?.consent_policy_version || '1', ts: Date.now() };
  storageSet(KEY.consent, consent);
  if (!analytics) {
    // Withdrawal: drop identifiers and anything not yet sent.
    storageRemove(KEY.visitor);
    storageRemove(KEY.session);
    storageRemove(KEY.firstTouch);
    queue = [];
  }
  if (consent.advertising) {
    loadMetaPixel();
    window.fbq?.('consent', 'grant');
  } else if (pixelLoaded) {
    window.fbq?.('consent', 'revoke');
  }
  window.dispatchEvent(new CustomEvent('ndp-consent-change', { detail: consent }));
}

export function openConsentSettings() {
  if (isBrowser()) window.dispatchEvent(new Event('ndp-open-consent'));
}

function trackingAllowed(): boolean {
  if (!isBrowser() || !config?.tracking_enabled) return false;
  if (window.location.pathname.startsWith('/admin')) return false;
  return getConsent()?.analytics === true;
}

function visitorId(): string {
  let id = storageGet<string>(KEY.visitor);
  if (!id) {
    id = uuid();
    storageSet(KEY.visitor, id);
  }
  return id;
}

// Returns the active session, starting a new one after 30 min of
// inactivity or when the visitor arrives through a new campaign link.
function ensureSession(): { session: StoredSession; isNew: boolean } {
  const now = Date.now();
  const current = storageGet<StoredSession>(KEY.session);
  const incoming = pendingAttribution;
  const campaignChanged = hasCampaignParams(incoming) && current &&
    (incoming!.utm_campaign !== current.attribution.utm_campaign ||
      incoming!.utm_content !== current.attribution.utm_content ||
      (incoming!.fbclid && incoming!.fbclid !== current.attribution.fbclid));

  if (current && now - current.last < SESSION_TIMEOUT_MS && !campaignChanged) {
    current.last = now;
    storageSet(KEY.session, current);
    pendingAttribution = null;
    return { session: current, isNew: false };
  }

  const attribution: Attribution = incoming
    ? { ...incoming }
    : { landing_page: window.location.pathname, ts: now };
  const session: StoredSession = { id: uuid(), started: now, last: now, attribution };
  storageSet(KEY.session, session);
  if (!storageGet<Attribution>(KEY.firstTouch)) storageSet(KEY.firstTouch, attribution);
  pendingAttribution = null;
  return { session, isNew: true };
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// Meta click id cookie value: _fbc set by the Pixel, else derived from fbclid.
function fbc(session: StoredSession): string | null {
  const cookie = readCookie('_fbc');
  if (cookie) return cookie;
  const f = session.attribution.fbclid;
  return f ? `fb.1.${session.attribution.ts || session.started}.${f}` : null;
}

function debugLog(...args: unknown[]) {
  if (debugMode) console.info('[ndp-track]', ...args);
}

export function track(name: EventName, props?: Props, ctx: EventContext = {}) {
  if (!trackingAllowed()) {
    debugLog('(not sent: no consent or tracking disabled)', name, props);
    return;
  }
  const { session, isNew } = ensureSession();
  const path = window.location.pathname;
  if (isNew) {
    queue.push({ event_id: uuid(), name: 'LandingPageView', ts: Date.now(), page_path: session.attribution.landing_page || path, debug: debugMode || undefined });
  }
  const event: QueuedEvent = {
    event_id: uuid(),
    name,
    ts: Date.now(),
    page_path: path,
    props,
    debug: debugMode || undefined,
    ...ctx,
  };
  queue.push(event);
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  debugLog(name, { props, ctx, session: session.id.slice(0, 8), attribution: session.attribution });
  sendToPixel(name, event.event_id, { ...ctx, ...props });
  scheduleFlush();
}

function scheduleFlush() {
  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (!flushTimer) flushTimer = setTimeout(() => flush(), FLUSH_DELAY_MS);
}

function buildPayload(events: QueuedEvent[]) {
  const session = storageGet<StoredSession>(KEY.session);
  const consent = getConsent();
  if (!session || !consent) return null;
  return {
    visitor_id: visitorId(),
    session_id: session.id,
    consent: { analytics: consent.analytics, advertising: consent.advertising },
    session: session.attribution,
    first_touch: storageGet<Attribution>(KEY.firstTouch),
    fbp: consent.advertising ? readCookie('_fbp') : null,
    fbc: consent.advertising ? fbc(session) : null,
    events,
  };
}

export function flush(useBeacon = false) {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!isBrowser() || queue.length === 0 || !trackingAllowed()) return;
  const events = queue.splice(0, MAX_BATCH);
  const payload = buildPayload(events);
  if (!payload) return;
  const body = JSON.stringify(payload);
  const url = `${API_URL}/api/track`;
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
  } else {
    fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {
      // Network blip: requeue once (bounded), don't retry forever.
      queue = [...events, ...queue].slice(0, MAX_QUEUE);
    });
  }
  if (queue.length > 0) scheduleFlush();
}

function bindLifecycleListeners() {
  if (listenersBound) return;
  listenersBound = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', () => flush(true));
}

// Context attached to form submissions, so the API can record the
// conversion server-side (ad-blocker proof) with the same event_id the
// Pixel will use. null when the visitor hasn't consented to analytics.
export function getFormTrackingContext(): FormTrackingContext | null {
  if (!trackingAllowed()) return null;
  const { session } = ensureSession();
  const consent = getConsent()!;
  flush();
  return {
    visitor_id: visitorId(),
    session_id: session.id,
    event_id: uuid(),
    consent: { analytics: consent.analytics, advertising: consent.advertising },
    page_path: window.location.pathname,
    session: session.attribution,
    first_touch: storageGet<Attribution>(KEY.firstTouch),
    fbp: consent.advertising ? readCookie('_fbp') : null,
    fbc: consent.advertising ? fbc(session) : null,
    debug: debugMode || undefined,
  };
}

// After a server-recorded conversion: fire only the Pixel (the event row
// already exists server-side; queueing it again would be a duplicate).
export function reportServerConversion(name: EventName, eventId: string | null | undefined, props?: Props) {
  if (!eventId) return;
  debugLog(`${name} (recorded server-side)`, { eventId, props });
  sendToPixel(name, eventId, props);
}

// --- Meta Pixel -------------------------------------------------------

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
    _fbq?: unknown;
  }
}

function loadMetaPixel() {
  if (pixelLoaded || !isBrowser() || !config?.meta_pixel_enabled || !config.meta_pixel_id) return;
  pixelLoaded = true;
  // Standard Meta Pixel bootstrap (queues calls until fbevents.js loads).
  /* eslint-disable */
  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod(...args) : n.queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode!.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq!('consent', 'grant');
  window.fbq!('init', config.meta_pixel_id);
}

function sendToPixel(name: EventName, eventId: string, params?: Props) {
  const mapping = META_EVENT_MAP[name];
  if (!mapping || !pixelLoaded || !window.fbq || getConsent()?.advertising !== true) return;
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== null && v !== undefined && k !== 'publisher_id' && k !== 'article_id') clean[k] = v;
  }
  if (mapping.type === 'custom' || mapping.name !== name) clean.content_name = name;
  window.fbq(mapping.type === 'standard' ? 'track' : 'trackCustom', mapping.name, clean, { eventID: eventId });
}
