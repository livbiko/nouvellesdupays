// Minimal robots.txt support for the feed-less source crawler
// (packages/shared/src/crawler.js). Implements the parts of RFC 9309 that
// matter for a polite single-bot crawler: user-agent groups, Allow/Disallow
// with longest-match precedence (Allow wins ties), `*` wildcards and `$`
// end anchors, plus Crawl-delay. Unreachable robots.txt (network error/5xx)
// is treated as "disallow everything" -- the conservative reading -- while
// a 404 means "no restrictions", per the RFC.

const BOT_TOKEN = 'nouvellesdupaysbot';

function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === 'allow' || field === 'disallow') {
      if (value === '' && field === 'disallow') continue; // "Disallow:" = allow all
      current.rules.push({ allow: field === 'allow', path: value });
    } else if (field === 'crawl-delay') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  return groups;
}

function pickGroup(groups, botToken = BOT_TOKEN) {
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && botToken.includes(a)));
  return specific || groups.find((g) => g.agents.includes('*')) || null;
}

function patternToRegex(path) {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

// `robots` is the result of parseRobots(), or the sentinels
// 'allow-all' / 'disallow-all'.
function isAllowed(robots, urlOrPath, botToken = BOT_TOKEN) {
  if (robots === 'allow-all') return true;
  if (robots === 'disallow-all') return false;
  let path = urlOrPath;
  try {
    const u = new URL(urlOrPath);
    path = u.pathname + u.search;
  } catch {
    // already a path
  }
  const group = pickGroup(robots, botToken);
  if (!group) return true;

  let best = null;
  for (const rule of group.rules) {
    if (!patternToRegex(rule.path).test(path)) continue;
    const len = rule.path.length;
    if (!best || len > best.len || (len === best.len && rule.allow)) best = { len, allow: rule.allow };
  }
  return best ? best.allow : true;
}

function crawlDelaySeconds(robots, botToken = BOT_TOKEN) {
  if (!Array.isArray(robots)) return null;
  const group = pickGroup(robots, botToken);
  return group ? group.crawlDelay : null;
}

module.exports = { parseRobots, isAllowed, crawlDelaySeconds, BOT_TOKEN };
