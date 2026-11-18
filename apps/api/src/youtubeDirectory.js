// /youtube directory (CR-2026-11-16-11, redesign phase 1): one list of every video channel (video_channels) and every
// approved creator (creators), with the filters and facets the page needs.
//
// GET /api/youtube/directory?q=&country=XX&continent=&category=&type=&lang=&sort=&page=&per=
//   -> { total, page, per, items, facets: { continents, countries, categories, types, languages } }
//
// Read-only, no YouTube call: numbers come only from audience_metrics (official API or a reviewer) and the latest
// creator_rankings, as /api/creators. A missing number is absent, never zero. A creator whose YouTube channel is also
// a video_channels row appears once, as the creator (it has the profile page). Facets count the whole directory, not
// the filtered result, so the explorers show what exists. The list is rebuilt at most every CACHE_MS.

const CACHE_MS = 5 * 60 * 1000;
const PER_DEFAULT = 24;
const PER_MAX = 60;

// Same rule as /api/creators.
const PUBLIC = `cr.review_status = 'approved' AND NOT cr.possible_minor AND cr.merged_into_id IS NULL`;

// countries.region -> continent, Africa first then the order of the brief (section 11).
const CONTINENTS = [
  { key: 'afrique', label: 'Afrique', test: (r) => /Africa/.test(r) },
  { key: 'europe', label: 'Europe', test: (r) => /Europe/.test(r) },
  { key: 'amerique-nord', label: 'Amérique du Nord et centrale', test: (r) => /North America|Central America|Caribbean/.test(r) },
  { key: 'amerique-sud', label: 'Amérique du Sud', test: (r) => r === 'South America' },
  { key: 'moyen-orient', label: 'Moyen-Orient', test: (r) => r === 'Middle East' },
  { key: 'asie', label: 'Asie', test: (r) => /Asia|Caucasus/.test(r) },
  { key: 'oceanie', label: 'Océanie', test: (r) => r === 'Oceania' },
];

// African sub-regions (countries.region), for the /youtube/<region> pages (CR-2026-11-17-03).
const REGIONS = [
  { key: 'afrique-de-l-ouest', label: "Afrique de l'Ouest", region: 'West Africa' },
  { key: 'afrique-centrale', label: 'Afrique centrale', region: 'Central Africa' },
  { key: 'afrique-de-l-est', label: "Afrique de l'Est", region: 'East Africa' },
  { key: 'afrique-du-nord', label: 'Afrique du Nord', region: 'North Africa' },
  { key: 'afrique-australe', label: 'Afrique australe', region: 'Southern Africa' },
];

// Kind of source. Channels keep the rail they were curated into; creators their creator_kind. Neutral labels: a
// creator is not presented as a journalist or a news organisation (brief sections 5 and 12).
const TYPES = [
  { key: 'tv-nationale', label: 'Télévision nationale', channel: 'national_tv' },
  { key: 'tv-continu', label: 'Télévision en continu', channel: 'live_now' },
  { key: 'voix-locales', label: 'Voix locales', channel: 'local_voices' },
  { key: 'voix-panafricaines', label: 'Voix panafricaines', channel: 'africa_voices' },
  { key: 'media-en-ligne', label: 'Média en ligne', creator: 'media_brand' },
  { key: 'createur-independant', label: 'Créateur indépendant', creator: 'individual' },
  { key: 'collectif', label: 'Collectif', creator: 'group' },
];

// Creators store language codes; countries store English names (used for channels, flagged as the country's).
const LANGUAGES = [
  { key: 'fr', label: 'Français', names: ['French'] },
  { key: 'en', label: 'Anglais', names: ['English'] },
  { key: 'ar', label: 'Arabe', names: ['Arabic'] },
  { key: 'pt', label: 'Portugais', names: ['Portuguese'] },
  { key: 'es', label: 'Espagnol', names: ['Spanish'] },
  { key: 'sw', label: 'Swahili', names: ['Swahili'] },
];

// video_channels.topic -> category slug, for a channel not yet classified on /admin/categories (CR-2026-11-17-02:
// video_channel_category_links), so one category filter covers channels and creators.
const TOPIC_CATEGORY = { news: 'news-media', business: 'business-news', politics: 'politics', culture: 'culture-heritage' };

const SORTS = ['populaires', 'vues', 'score', 'croissance', 'alpha'];

function continentOf(region) {
  const c = region ? CONTINENTS.find((x) => x.test(region)) : null;
  return c ? c.key : null;
}

function languageKeys(codesOrNames) {
  return [...new Set((codesOrNames || []).map((v) => {
    const l = LANGUAGES.find((x) => x.key === v || x.names.includes(v));
    return l ? l.key : null;
  }).filter(Boolean))];
}

function youtubeUrl(channelId) {
  return channelId ? `https://www.youtube.com/channel/${channelId}` : null;
}

async function loadEntries(pool) {
  const [{ rows: allCats }, { rows: creators }, { rows: channels }, { rows: channelLinks }] = await Promise.all([
    pool.query('SELECT slug, parent_slug, name_fr, description_fr, sort_order, active FROM creator_categories ORDER BY sort_order'),
    pool.query(
      `SELECT cr.slug, cr.display_name, cr.creator_kind, cr.languages, cr.bio,
              c.iso_code AS country_iso, c.name AS country_name, c.flag_url, coalesce(c.region, cr.region) AS region,
              coalesce((SELECT array_agg(cc.slug ORDER BY l.is_primary DESC, cc.sort_order)
                          FROM creator_category_links l JOIN creator_categories cc ON cc.id = l.category_id
                         WHERE l.creator_id = cr.id), '{}') AS categories,
              acc.url, acc.channel_id, acc.profile_image_url, acc.subscribers, acc.total_views,
              (SELECT json_object_agg(r.dimension, json_build_object('score', r.score::float8, 'rank', r.rank))
                 FROM creator_rankings r
                WHERE r.creator_id = cr.id AND r.computed_at = (SELECT max(computed_at) FROM creator_rankings)
                  AND r.scope = 'global') AS ranks
         FROM creators cr
         LEFT JOIN countries c ON c.id = cr.country_id
         LEFT JOIN LATERAL (
           SELECT sa.url, CASE WHEN sa.platform_account_id LIKE 'UC%' THEN sa.platform_account_id END AS channel_id,
                  sa.profile_image_url,
                  (SELECT value FROM audience_metrics WHERE social_account_id = sa.id AND metric IN ('subscribers', 'followers')
                    ORDER BY measured_at DESC LIMIT 1)::float8 AS subscribers,
                  (SELECT value FROM audience_metrics WHERE social_account_id = sa.id AND metric = 'total_views'
                    ORDER BY measured_at DESC LIMIT 1)::float8 AS total_views
             FROM social_accounts sa
            WHERE sa.creator_id = cr.id AND sa.platform = 'youtube' AND sa.status <> 'dead' AND sa.verification <> 'rejected'
            ORDER BY 4 DESC NULLS LAST, sa.id LIMIT 1
         ) acc ON true
        WHERE ${PUBLIC}`
    ),
    pool.query(
      `SELECT vc.id, vc.name, vc.description, vc.topic, vc.category, vc.platform, vc.youtube_channel_id,
              vc.channel_url, vc.page_url, vc.logo_url,
              c.iso_code AS country_iso, c.name AS country_name, c.flag_url, c.region, c.languages AS country_languages,
              sa.profile_image_url, sa.subscribers
         FROM video_channels vc
         LEFT JOIN countries c ON c.id = vc.country_id
         LEFT JOIN LATERAL (
           SELECT s.profile_image_url,
                  (SELECT value FROM audience_metrics WHERE social_account_id = s.id AND metric = 'subscribers'
                    ORDER BY measured_at DESC LIMIT 1)::float8 AS subscribers
             FROM social_accounts s
            WHERE s.platform = 'youtube' AND vc.youtube_channel_id IS NOT NULL AND s.platform_account_id = vc.youtube_channel_id
            ORDER BY 2 DESC NULLS LAST LIMIT 1
         ) sa ON true`
    ),
    pool.query(
      `SELECT l.channel_key, cc.slug FROM video_channel_category_links l JOIN creator_categories cc ON cc.id = l.category_id
        ORDER BY l.channel_key, l.is_primary DESC, cc.sort_order`
    ),
  ]);

  // Switched-off categories are not shown; a link to one counts for its parent when that parent is on (CR-2026-11-17-02).
  const cats = allCats.filter((c) => c.active);
  const bySlug = Object.fromEntries(allCats.map((c) => [c.slug, c]));
  const visible = (s) => {
    const c = bySlug[s];
    if (!c) return null;
    if (c.active) return s;
    const p = c.parent_slug && bySlug[c.parent_slug];
    return p && p.active ? p.slug : null;
  };
  const withParents = (slugs) => [...new Set(slugs.map(visible).filter(Boolean).flatMap((s) => {
    const p = bySlug[s].parent_slug;
    return p && bySlug[p] && bySlug[p].active ? [s, p] : [s];
  }))];
  const linksOf = new Map();
  for (const l of channelLinks) {
    if (!linksOf.has(l.channel_key)) linksOf.set(l.channel_key, []);
    linksOf.get(l.channel_key).push(l.slug);
  }
  const typeFor = (field, value) => (TYPES.find((t) => t[field] === value) || {}).key || null;

  const entries = [];
  const creatorChannels = new Set();
  for (const r of creators) {
    if (r.channel_id) creatorChannels.add(r.channel_id);
    const ranks = r.ranks || {};
    entries.push({
      key: `createur-${r.slug}`,
      source: 'createur',
      name: r.display_name,
      description: r.bio || null,
      profile_path: `/creators/${r.slug}`,
      url: r.url || youtubeUrl(r.channel_id),
      avatar_url: r.profile_image_url || null,
      country_iso: r.country_iso ? r.country_iso.trim() : null,
      country_name: r.country_name,
      flag_url: r.flag_url,
      region: r.region,
      continent: continentOf(r.region),
      type: typeFor('creator', r.creator_kind),
      categories: withParents(r.categories || []),
      primary_category: (r.categories || []).map(visible).find(Boolean) || null,
      languages: languageKeys(r.languages),
      languages_from_country: false,
      subscribers: r.subscribers,
      total_views: r.total_views,
      score: ranks.overall ? ranks.overall.score : null,
      rank: ranks.overall ? ranks.overall.rank : null,
      growth: ranks.growth ? ranks.growth.score : null,
    });
  }
  // video_channels is curated per country and per rail, so one channel can have many rows (11-16: RT International in
  // 54 countries, 155 such channels): the directory shows it once, with all its countries and types.
  const groups = new Map();
  for (const r of channels) {
    if (r.youtube_channel_id && creatorChannels.has(r.youtube_channel_id)) continue;
    const k = r.youtube_channel_id || String(r.channel_url || r.page_url || `id:${r.id}`).toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const typeOrder = TYPES.map((t) => t.key);
  for (const [groupKey, rows] of groups) {
    const r = rows[0];
    const countries = [...new Map(rows.filter((x) => x.country_iso)
      .map((x) => [x.country_iso.trim(), { iso: x.country_iso.trim(), name: x.country_name, flag_url: x.flag_url, region: x.region }])).values()];
    const one = countries.length === 1 ? countries[0] : null;
    const types = [...new Set(rows.map((x) => typeFor('channel', x.category)).filter(Boolean))]
      .sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b));
    // Classified on /admin/categories, else from the curated topic.
    const linked = linksOf.get(groupKey) || [];
    const topicCats = linked.length ? linked : [...new Set(rows.map((x) => TOPIC_CATEGORY[x.topic]).filter(Boolean))];
    entries.push({
      key: `chaine-${r.id}`,
      source: 'chaine',
      name: r.name,
      description: rows.map((x) => x.description).find(Boolean) || null,
      profile_path: null,
      url: r.channel_url || youtubeUrl(r.youtube_channel_id) || r.page_url || null,
      avatar_url: rows.map((x) => x.logo_url || x.profile_image_url).find(Boolean) || null,
      country_iso: one ? one.iso : null,
      country_name: one ? one.name : countries.length ? `${countries.length} pays` : null,
      flag_url: one ? one.flag_url : null,
      region: one ? one.region : null,
      continent: one ? continentOf(one.region) : null,
      country_list: countries.map((c) => ({ iso: c.iso, name: c.name, flag_url: c.flag_url, continent: continentOf(c.region), region: c.region })),
      type: types[0] || null,
      types,
      categories: withParents(topicCats),
      primary_category: topicCats.map(visible).find(Boolean) || null,
      languages: languageKeys(rows.flatMap((x) => x.country_languages || [])),
      languages_from_country: true,
      subscribers: rows.map((x) => x.subscribers).find((v) => v != null) ?? null,
      total_views: null,
      score: null,
      rank: null,
      growth: null,
    });
  }
  return { entries, categories: cats };
}

// Countries, continents and types of an entry (a merged channel can have several).
const countriesOf = (e) => e.country_list
  || (e.country_iso ? [{ iso: e.country_iso, name: e.country_name, flag_url: e.flag_url, continent: e.continent, region: e.region }] : []);
const continentsOf = (e) => [...new Set(countriesOf(e).map((c) => c.continent).filter(Boolean))];
const typesOf = (e) => e.types || (e.type ? [e.type] : []);

function facets(entries, categories) {
  const count = (pick) => {
    const m = new Map();
    for (const e of entries) for (const k of [].concat(pick(e) || [])) m.set(k, (m.get(k) || 0) + 1);
    return m;
  };
  const byContinent = count(continentsOf);
  const byType = count(typesOf);
  const byLang = count((e) => e.languages);
  const byCat = count((e) => e.categories);
  const countries = new Map();
  for (const e of entries) {
    for (const x of countriesOf(e)) {
      const c = countries.get(x.iso) || { ...x, count: 0, creators: 0, categories: new Set() };
      c.count++;
      if (e.source === 'createur') c.creators++;
      if (e.primary_category) c.categories.add(e.primary_category);
      countries.set(x.iso, c);
    }
  }
  return {
    continents: CONTINENTS.map((c) => ({ key: c.key, label: c.label, count: byContinent.get(c.key) || 0 })).filter((c) => c.count),
    countries: [...countries.values()].map((c) => ({ ...c, categories: [...c.categories] }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    // Top-level categories, plus any sub-category actually used.
    categories: categories.filter((c) => byCat.get(c.slug))
      .map((c) => ({ slug: c.slug, name_fr: c.name_fr, parent_slug: c.parent_slug, count: byCat.get(c.slug) })),
    types: TYPES.map((t) => ({ key: t.key, label: t.label, count: byType.get(t.key) || 0 })).filter((t) => t.count),
    languages: LANGUAGES.map((l) => ({ key: l.key, label: l.label, count: byLang.get(l.key) || 0 })).filter((l) => l.count),
  };
}

// Accent-, case- and punctuation-insensitive: "cote d ivoire" finds "Côte d'Ivoire".
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’\-]/g, ' ').replace(/\s+/g, ' ');
}

// Filters combine (AND); sort keeps entries without the number at the end, then by name.
function queryEntries(entries, p) {
  const q = norm(p.q).trim();
  let list = entries.filter((e) =>
    (!q || norm([e.name, e.description, ...countriesOf(e).map((c) => c.name)].join(' ')).includes(q))
    && (!p.country || countriesOf(e).some((c) => c.iso === p.country))
    && (!p.continent || continentsOf(e).includes(p.continent))
    && (!p.region || countriesOf(e).some((c) => c.region === p.region))
    && (!p.category || e.categories.includes(p.category))
    && (!p.type || typesOf(e).includes(p.type))
    && (!p.lang || e.languages.includes(p.lang)));
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
  const desc = (f) => (a, b) => (b[f] ?? -1) - (a[f] ?? -1) || byName(a, b);
  const sorters = {
    populaires: desc('subscribers'),
    vues: desc('total_views'),
    score: desc('score'),
    croissance: desc('growth'),
    alpha: byName,
  };
  list = [...list].sort(sorters[p.sort] || sorters.populaires);
  // Africa first (brief section 2) unless the reader chose a place or alphabetical order: African entries, then the
  // rest, each part keeping the chosen order.
  if (!p.country && !p.continent && !p.region && p.sort !== 'alpha') {
    const africa = (e) => continentsOf(e).includes('afrique');
    list = [...list.filter(africa), ...list.filter((e) => !africa(e))];
  }
  const total = list.length;
  const start = (p.page - 1) * p.per;
  return { total, items: list.slice(start, start + p.per) };
}

function parseParams(query) {
  const s = (v, max = 80) => String(v || '').trim().slice(0, max);
  const country = s(query.country, 2).toUpperCase();
  return {
    q: s(query.q, 100),
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    continent: CONTINENTS.some((c) => c.key === query.continent) ? query.continent : '',
    // ?region=afrique-de-l-ouest -> the countries.region value it stands for.
    region: (REGIONS.find((r) => r.key === query.region) || {}).region || '',
    category: /^[a-z0-9-]{1,60}$/.test(s(query.category)) ? s(query.category) : '',
    type: TYPES.some((t) => t.key === query.type) ? query.type : '',
    lang: LANGUAGES.some((l) => l.key === query.lang) ? query.lang : '',
    sort: SORTS.includes(query.sort) ? query.sort : 'populaires',
    page: Math.max(parseInt(String(query.page || '1'), 10) || 1, 1),
    per: Math.min(Math.max(parseInt(String(query.per || PER_DEFAULT), 10) || PER_DEFAULT, 1), PER_MAX),
  };
}

// A category or classification change on /admin/categories rebuilds this pod's list on the next request (other API
// pods follow within CACHE_MS).
let generation = 0;
function invalidateDirectory() {
  generation += 1;
}

function registerYoutubeDirectoryRoutes(fastify) {
  const pool = fastify.pg;
  let cache = null;
  async function directory() {
    if (!cache || cache.generation !== generation || Date.now() - cache.at > CACHE_MS) {
      const at = generation;
      const { entries, categories } = await loadEntries(pool);
      cache = {
        at: Date.now(), generation: at, entries, categories, facets: facets(entries, categories),
        taxonomy: categories.map((c) => ({ slug: c.slug, parent_slug: c.parent_slug, name_fr: c.name_fr, description_fr: c.description_fr || null })),
      };
    }
    return cache;
  }

  // With a place (country, continent or African region), place_facets counts what exists there whatever the other
  // filters, for the nested menus of the /youtube/<place>[/<category>[/<subcategory>]] pages (CR-2026-11-17-03).
  // taxonomy = every switched-on category (names, descriptions), for breadcrumbs and page texts.
  fastify.get('/api/youtube/directory', async (req) => {
    const p = parseParams(req.query || {});
    const d = await directory();
    const { total, items } = queryEntries(d.entries, p);
    let placeFacets = null;
    if (p.country || p.continent || p.region) {
      const place = queryEntries(d.entries, { ...parseParams({}), country: p.country, continent: p.continent, region: p.region, per: d.entries.length || 1 });
      placeFacets = facets(place.items, d.categories);
    }
    return { total, page: p.page, per: p.per, sort: p.sort, items, facets: d.facets, place_facets: placeFacets, taxonomy: d.taxonomy };
  });
}

module.exports = { registerYoutubeDirectoryRoutes, invalidateDirectory, queryEntries, parseParams, continentOf, languageKeys, CONTINENTS, REGIONS, TYPES, LANGUAGES };
