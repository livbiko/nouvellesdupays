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
    pool.query('SELECT slug, parent_slug, name_fr, name_en, names, description_fr, sort_order, active FROM creator_categories ORDER BY sort_order'),
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
              sa.profile_image_url, sa.subscribers,
              cm.subscribers AS cm_subscribers, cm.total_views AS cm_total_views, cm.measured_at AS cm_measured_at
         FROM video_channels vc
         LEFT JOIN countries c ON c.id = vc.country_id
         LEFT JOIN LATERAL (
           SELECT s.profile_image_url,
                  (SELECT value FROM audience_metrics WHERE social_account_id = s.id AND metric = 'subscribers'
                    ORDER BY measured_at DESC LIMIT 1)::float8 AS subscribers
             FROM social_accounts s
            WHERE s.platform = 'youtube' AND vc.youtube_channel_id IS NOT NULL AND s.platform_account_id = vc.youtube_channel_id
            ORDER BY 2 DESC NULLS LAST LIMIT 1
         ) sa ON true
         -- CR-2026-11-18-01: the channel's own latest public numbers (worker channel-logos.js, daily).
         LEFT JOIN LATERAL (
           SELECT (SELECT value FROM channel_metrics m WHERE m.channel_key = vc.youtube_channel_id AND m.metric = 'subscribers'
                    ORDER BY measured_at DESC LIMIT 1)::float8 AS subscribers,
                  (SELECT value FROM channel_metrics m WHERE m.channel_key = vc.youtube_channel_id AND m.metric = 'total_views'
                    ORDER BY measured_at DESC LIMIT 1)::float8 AS total_views,
                  (SELECT max(measured_at) FROM channel_metrics m WHERE m.channel_key = vc.youtube_channel_id) AS measured_at
         ) cm ON vc.youtube_channel_id IS NOT NULL`
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
      channel_id: r.channel_id || null,
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
      channel_id: r.youtube_channel_id || null,
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
      // A linked account's numbers first, else the channel's own (channel_metrics, CR-2026-11-18-01); never estimated.
      subscribers: rows.map((x) => x.subscribers).find((v) => v != null) ?? rows.map((x) => x.cm_subscribers).find((v) => v != null) ?? null,
      total_views: rows.map((x) => x.cm_total_views).find((v) => v != null) ?? null,
      stats_measured_at: rows.map((x) => x.cm_measured_at).find(Boolean) || null,
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
      .map((c) => ({ slug: c.slug, name_fr: c.name_fr, name_en: c.name_en || null, names: c.names || {}, parent_slug: c.parent_slug, count: byCat.get(c.slug) })),
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
    && (!p.types.length || typesOf(e).some((t) => p.types.includes(t)))
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
  // One type or several (CR-2026-11-25-04: type=voix-locales,createur-independant); unknown keys are dropped.
  const types = [...new Set(s(query.type, 200).split(',').map((t) => t.trim()).filter((t) => TYPES.some((x) => x.key === t)))];
  return {
    q: s(query.q, 100),
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    continent: CONTINENTS.some((c) => c.key === query.continent) ? query.continent : '',
    // ?region=afrique-de-l-ouest -> the countries.region value it stands for.
    region: (REGIONS.find((r) => r.key === query.region) || {}).region || '',
    category: /^[a-z0-9-]{1,60}$/.test(s(query.category)) ? s(query.category) : '',
    type: types.join(','),
    types,
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
        taxonomy: categories.map((c) => ({ slug: c.slug, parent_slug: c.parent_slug, name_fr: c.name_fr, name_en: c.name_en || null, names: c.names || {}, description_fr: c.description_fr || null })),
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

  // CR-2026-11-18-08: the newest uploads of the directory's channels (channel_videos, stored daily by the worker from
  // the official API), newest first, at most VIDEOS_PER_CHANNEL per channel so one busy channel cannot fill the row.
  // Same place / category filters as the directory; only channels the directory shows.
  let videoCache = null;
  async function recentVideos() {
    if (!videoCache || Date.now() - videoCache.at > CACHE_MS) {
      const { rows } = await pool.query(
        `SELECT youtube_video_id, channel_key, title, published_at, thumbnail_url, fetched_at FROM channel_videos
          WHERE published_at > now() - interval '30 days' ORDER BY published_at DESC LIMIT 2000`);
      videoCache = { at: Date.now(), rows };
    }
    return videoCache.rows;
  }
  fastify.get('/api/youtube/latest-videos', async (req) => {
    const q = req.query || {};
    const p = parseParams({ ...q, page: 1 });
    const limit = Math.min(Math.max(parseInt(String(q.limit || '24'), 10) || 24, 1), 60);
    const d = await directory();
    const shown = queryEntries(d.entries, { ...p, page: 1, per: d.entries.length || 1 }).items;
    const byChannel = new Map(shown.filter((e) => e.channel_id).map((e) => [e.channel_id, e]));
    const catName = Object.fromEntries(d.taxonomy.map((c) => [c.slug, c.name_fr]));
    const catNameEn = Object.fromEntries(d.taxonomy.map((c) => [c.slug, c.name_en]));
    const catNames = Object.fromEntries(d.taxonomy.map((c) => [c.slug, c.names]));
    const perChannel = new Map();
    const items = [];
    let updatedAt = null;
    for (const v of await recentVideos()) {
      const e = byChannel.get(v.channel_key);
      if (!e || (perChannel.get(v.channel_key) || 0) >= VIDEOS_PER_CHANNEL) continue;
      perChannel.set(v.channel_key, (perChannel.get(v.channel_key) || 0) + 1);
      items.push({
        youtube_video_id: v.youtube_video_id,
        url: `https://www.youtube.com/watch?v=${v.youtube_video_id}`,
        title: v.title,
        published_at: v.published_at,
        thumbnail_url: v.thumbnail_url,
        channel_name: e.name,
        channel_url: e.url,
        profile_path: e.profile_path || null,
        country_iso: e.country_iso,
        country_name: e.country_name,
        flag_url: e.flag_url,
        type: e.type || null,
        category: e.primary_category || null,
        category_name: e.primary_category ? catName[e.primary_category] || null : null,
        category_name_en: e.primary_category ? catNameEn[e.primary_category] || null : null,
        category_names: e.primary_category ? catNames[e.primary_category] || {} : {},
      });
      // When the shown videos were last read from YouTube (the daily worker run), for "Mis à jour le ...".
      if (v.fetched_at && (!updatedAt || v.fetched_at > updatedAt)) updatedAt = v.fetched_at;
      if (items.length >= limit) break;
    }
    return { items, updated_at: updatedAt };
  });

  // CR-2026-11-25-04: the "Explorer par pays" tree - continents (Africa split into its five regions) -> every country
  // of the countries table -> categories -> subcategories, each with the number of directory entries there (the same
  // entries and the same counting as the directory: an entry in a subcategory also counts for its parent). A country
  // without entries is listed with 0 so none is silently missing.
  let explorerCache = null;
  fastify.get('/api/youtube/explorer', async () => {
    const d = await directory();
    if (!explorerCache || explorerCache.source !== d) {
      const { rows } = await pool.query('SELECT iso_code, name, flag_url, region FROM countries ORDER BY name');
      explorerCache = { source: d, tree: explorerTree(d.entries, d.categories, rows) };
    }
    return explorerCache.tree;
  });
}

function explorerTree(entries, categories, countryRows) {
  const countries = new Map(countryRows.map((c) => [c.iso_code.trim(), {
    iso: c.iso_code.trim(), name: c.name, flag_url: c.flag_url, region: c.region, continent: continentOf(c.region), keys: new Set(), cats: new Map(),
  }]));
  for (const e of entries) {
    for (const x of countriesOf(e)) {
      const c = countries.get(x.iso);
      if (!c) continue;
      c.keys.add(e.key);
      for (const slug of e.categories) c.cats.set(slug, (c.cats.get(slug) || 0) + 1);
    }
  }
  const tops = categories.filter((c) => !c.parent_slug);
  const subsOf = (slug) => categories.filter((c) => c.parent_slug === slug);
  const shape = (c) => ({
    iso: c.iso, name: c.name, flag_url: c.flag_url, count: c.keys.size,
    categories: tops.filter((t) => c.cats.get(t.slug)).map((t) => ({
      slug: t.slug, count: c.cats.get(t.slug),
      subcategories: subsOf(t.slug).filter((x) => c.cats.get(x.slug)).map((x) => ({ slug: x.slug, count: c.cats.get(x.slug) })),
    })),
  });
  const all = [...countries.values()];
  // A channel curated in several countries counts once per country, but once in a region or continent total.
  const distinct = (list) => new Set(list.flatMap((c) => [...c.keys])).size;
  const group = (list) => ({ count: distinct(list), countries: list.map(shape) });
  return {
    continents: CONTINENTS.map((k) => {
      const list = all.filter((c) => c.continent === k.key);
      if (k.key !== 'afrique') return { key: k.key, label: k.label, ...group(list), regions: null };
      const regions = REGIONS.map((r) => ({ key: r.key, label: r.label, ...group(list.filter((c) => c.region === r.region)) }));
      return { key: k.key, label: k.label, count: distinct(list), countries: null, regions };
    }).filter((k) => (k.regions ? k.regions.some((r) => r.countries.length) : k.countries.length)),
    categories: categories.map((c) => ({ slug: c.slug, parent_slug: c.parent_slug, name_fr: c.name_fr, name_en: c.name_en || null, names: c.names || {} })),
  };
}

const VIDEOS_PER_CHANNEL = 2;

module.exports = { registerYoutubeDirectoryRoutes, explorerTree, invalidateDirectory, queryEntries, parseParams, continentOf, languageKeys, CONTINENTS, REGIONS, TYPES, LANGUAGES };
