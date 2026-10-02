const net = require('net');

// Validation for every user-supplied URL this project stores or fetches
// (publisher homepages/sitemaps/category pages, YouTube links, social
// profiles). The server fetches several of these itself (feed verification,
// source testing, crawling), so on top of "is it a URL" this also blocks
// the obvious SSRF targets: non-http(s) schemes, embedded credentials,
// localhost and private/link-local IP literals. DNS-rebinding is NOT
// covered here (it needs resolution-time checks) -- documented in
// docs/ANALYTICS-TRACKING.md as a known limitation.

const MAX_URL_LENGTH = 2048;

function isPrivateIpv4(ip) {
  const p = ip.split('.').map(Number);
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    p[0] >= 224
  );
}

function isPrivateIpv6(ip) {
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:');
}

// Returns { ok: true, url: <normalised string> } or { ok: false, error }.
function validatePublicHttpUrl(input) {
  if (typeof input !== 'string') return { ok: false, error: 'URL must be a string' };
  const raw = input.trim();
  if (!raw) return { ok: false, error: 'URL is empty' };
  if (raw.length > MAX_URL_LENGTH) return { ok: false, error: 'URL is too long' };

  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: 'Not a valid URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: 'Only http(s) URLs are allowed' };
  }
  if (u.username || u.password) return { ok: false, error: 'URLs with embedded credentials are not allowed' };

  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host) return { ok: false, error: 'URL has no host' };
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, error: 'Local addresses are not allowed' };
  }
  const ipVersion = net.isIP(host);
  if (ipVersion === 4 && isPrivateIpv4(host)) return { ok: false, error: 'Private IP addresses are not allowed' };
  if (ipVersion === 6 && isPrivateIpv6(host)) return { ok: false, error: 'Private IP addresses are not allowed' };
  if (ipVersion === 0 && !host.includes('.')) return { ok: false, error: 'Host must be a public domain name' };
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) {
    return { ok: false, error: 'Non-standard ports are not allowed' };
  }

  u.hash = '';
  return { ok: true, url: u.toString() };
}

// "www.example.com/path" -> "example.com" (lower-case, no www.). Used as
// the duplicate-website key.
function domainOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

// True when `url`'s host is `domain` or a subdomain of it.
function hostMatches(url, domains) {
  const host = domainOf(url);
  if (!host) return false;
  return domains.some((d) => {
    const dd = String(d).toLowerCase().replace(/^www\./, '');
    return host === dd || host.endsWith(`.${dd}`);
  });
}

module.exports = { validatePublicHttpUrl, domainOf, hostMatches, MAX_URL_LENGTH };
