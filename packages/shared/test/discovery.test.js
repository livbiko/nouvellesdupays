const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCandidateUrl, countryFromDomain, analyseHomepage, extractOutlinkCandidates, scoreCandidate, guessSourceType,
} = require('../src/discovery');

const WEST = new Set(['CI', 'GH', 'NG', 'SN', 'ML', 'BF']);

const NEWS_HOME = `<!doctype html><html lang="fr-CI"><head>
<title>Abidjan Matin - Toute l'actualité</title>
<meta property="og:site_name" content="Abidjan Matin">
<meta name="description" content="Quotidien ivoirien d'information">
<link rel="alternate" type="application/rss+xml" href="/feed/">
<link rel="alternate" type="application/rss+xml" href="/comments/feed/">
</head><body>
<a href="/politique/le-gouvernement-annonce-un-nouveau-plan-pour-abidjan">a</a>
<a href="/economie/la-bourse-regionale-termine-la-semaine-en-hausse">b</a>
<a href="/societe/les-pluies-diluviennes-perturbent-la-circulation-ce-matin">c</a>
<a href="/article/123456">d</a>
<a href="/contact">Contact</a>
<a href="https://www.facebook.com/AbidjanMatin">fb</a>
<a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
<a href="https://facebook.com/AbidjanMatin/">fb again</a>
<a href="https://twitter.com/intent/tweet?text=x">tweet</a>
<a href="https://twitter.com/abidjanmatin">x</a>
<a href="https://www.youtube.com/@AbidjanMatinTV">yt</a>
<a href="https://www.youtube.com/watch?v=abc">video</a>
<a href="https://www.tiktok.com/@abidjanmatin">tt</a>
<a href="https://www.fratmat.info/">Fraternité Matin</a>
<a href="https://linfodrome.ci/">Linfodrome</a>
<a href="https://www.myjoyonline.com/">Joy</a>
<a href="https://news.ghanaweb.gh/">gh</a>
<a href="https://www.lemonde.fr/">Le Monde</a>
<a href="https://www.boutique-chaussures.com/">shop</a>
<a href="https://gouv.ci/">Gouvernement</a>
<a href="https://wordpress.org/">WP</a>
<a href="http://127.0.0.1/admin">local</a>
</body></html>`;

test('normalizeCandidateUrl: site root, www-insensitive domain, SSRF guard', () => {
  assert.deepEqual(normalizeCandidateUrl('https://www.Fratmat.info/article/x?y=1'), { ok: true, homepage: 'https://www.fratmat.info/', domain: 'fratmat.info' });
  assert.equal(normalizeCandidateUrl('http://10.0.0.5/').ok, false);
  assert.equal(normalizeCandidateUrl('ftp://example.com/').ok, false);
  assert.equal(normalizeCandidateUrl('not a url').ok, false);
});

test('countryFromDomain: real ccTLDs only, generic ones ignored', () => {
  assert.equal(countryFromDomain('linfodrome.ci', WEST), 'CI');
  assert.equal(countryFromDomain('graphic.com.gh', WEST), 'GH');
  assert.equal(countryFromDomain('maliweb.ml', WEST), 'ML');
  assert.equal(countryFromDomain('example.tv', WEST), null);
  assert.equal(countryFromDomain('example.co', WEST), null);
  assert.equal(countryFromDomain('example.com', WEST), null);
  assert.equal(countryFromDomain('lemonde.fr', WEST), null, 'outside the given set');
  assert.equal(countryFromDomain('lemonde.fr'), 'FR', 'no set = any country');
});

test('analyseHomepage: title, language, feeds, socials, article links, identity', () => {
  const p = analyseHomepage(NEWS_HOME, 'https://abidjanmatin.ci/');
  assert.equal(p.title, 'Abidjan Matin');
  assert.equal(p.description, "Quotidien ivoirien d'information");
  assert.equal(p.lang, 'fr');
  assert.deepEqual(p.announcedFeeds, ['https://abidjanmatin.ci/feed/'], 'comment feeds skipped');
  assert.equal(p.socials.facebook_url, 'https://facebook.com/AbidjanMatin', 'profile, not the share link');
  assert.equal(p.socials.x_url, 'https://x.com/abidjanmatin', 'twitter.com normalised to x.com, intents ignored');
  assert.equal(p.socials.youtube_url, 'https://youtube.com/@AbidjanMatinTV', 'channel, not a single video');
  assert.equal(p.socials.tiktok_url, 'https://tiktok.com/@abidjanmatin');
  assert.equal(p.socials.instagram_url, undefined);
  assert.equal(p.articleLinkCount, 4);
  assert.equal(p.hasIdentityPage, true);
  assert.deepEqual(p.spam, []);
});

test('analyseHomepage: hijacked / parked domains are flagged', () => {
  const casino = '<html><head><title>Slot Gacor - Casino Online Terpercaya</title></head><body>judi togel</body></html>';
  assert.ok(analyseHomepage(casino, 'https://centrafrique-presse.com/').spam.length > 0);
  const parked = '<html><head><title>rjdh.org</title></head><body>This domain is for sale! Buy this domain at HugeDomains</body></html>';
  assert.ok(analyseHomepage(parked, 'https://rjdh.org/').spam.length > 0);
  const article = '<html><head><title>Sport : la CAF sanctionne un club</title></head><body>Le casino de la ville a fermé.</body></html>';
  assert.deepEqual(analyseHomepage(article, 'https://news.ci/').spam, [], 'one mention in body text is not spam');
});

test('extractOutlinkCandidates: regional news sites only', () => {
  const p = analyseHomepage(NEWS_HOME, 'https://abidjanmatin.ci/');
  const c = extractOutlinkCandidates(p.links, 'https://abidjanmatin.ci/', { isoCodes: WEST });
  const domains = c.map((x) => x.domain).sort();
  assert.deepEqual(domains, ['fratmat.info', 'linfodrome.ci', 'myjoyonline.com', 'news.ghanaweb.gh'].sort());
  assert.equal(c.find((x) => x.domain === 'linfodrome.ci').country, 'CI');
  assert.equal(c.find((x) => x.domain === 'linfodrome.ci').countryFromTld, true);
  assert.equal(c.find((x) => x.domain === 'fratmat.info').country, null, 'news-like name, country left to the referrer');
  assert.equal(c.find((x) => x.domain === 'fratmat.info').countryFromTld, false);
});

test('guessSourceType', () => {
  assert.equal(guessSourceType('rti.ci', 'RTI - Radiodiffusion Télévision Ivoirienne'), 'TV');
  assert.equal(guessSourceType('radiojam.ci', 'Radio Jam FM'), 'RADIO');
  assert.equal(guessSourceType('aip.ci', "Agence Ivoirienne de Presse"), 'NEWS_AGENCY');
  assert.equal(guessSourceType('linfodrome.ci', "Linfodrome - l'info en continu"), 'ONLINE_NEWS');
});

test('scoreCandidate: explainable, fresh feed beats dead site, spam is zero', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const good = scoreCandidate({
    reachable: true, feedType: 'rss', latestItemAt: '2026-10-08T08:00:00Z', articleLinkCount: 40,
    countryFromTld: true, hasIdentityPage: true, title: 'X', socialCount: 3, timesSeen: 2,
  }, now);
  assert.equal(good.total, Object.values(good.breakdown).reduce((a, b) => a + b, 0));
  assert.equal(good.band, 'priority');
  const stale = scoreCandidate({ reachable: true, articleLinkCount: 2, title: 'Y' }, now);
  assert.ok(stale.total < 30 && stale.band === 'low');
  const spam = scoreCandidate({ reachable: true, feedType: 'rss', latestItemAt: now, articleLinkCount: 40, spam: ['casino'] }, now);
  assert.equal(spam.total, 0);
});
