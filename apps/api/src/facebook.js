// /facebook (CR-2026-11-27-01): Facebook videos entered by an admin on /admin/facebook, shown like /youtube.
// Standing rule: nothing is fetched from facebook.com by our servers - the API only checks the form of a link, and the
// official player (facebook.com/plugins/video.php) is loaded by the visitor's browser after a click on "Lire".
//
// Public:  GET /api/facebook/directory?q=&country=XX&continent=&region=&category=&type=&lang=&page=&per=
//            -> { total, page, per, items, facets, place_facets, taxonomy, updated_at }   (newest first)
//          GET /api/facebook/latest?limit=&<same filters>  -> { items, updated_at, total }
//          GET /api/facebook/explorer                      -> the "Explorer par pays" tree, as /api/youtube/explorer
//          GET /api/facebook/thumbnails/:id                -> the thumbnail the admin uploaded
// Admin:   GET/POST /api/admin/facebook/videos, PATCH/DELETE /api/admin/facebook/videos/:id (DELETE only hides it).
const { requireAdmin } = require('./adminAuth');
const { explorerTree, continentOf, CONTINENTS, REGIONS, TYPES, LANGUAGES } = require('./youtubeDirectory');

const CACHE_MS = 60 * 1000;
const PER_DEFAULT = 24;
const PER_MAX = 60;
const THUMB_MAX_BYTES = 400 * 1024;
const THUMB_TYPES = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

// Only facebook.com (www, m, web) and fb.watch, over https, no user, no port. m./web. links become www.; the fragment
// is dropped. Lookalikes (facebook.com.example.org, notfacebook.com, faceb00k.com) are refused. Returns null if refused.
function normalizeFacebookUrl(input) {
  let u;
  try {
    u = new URL(String(input || '').trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  let base;
  if (['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com'].includes(host)) base = 'https://www.facebook.com';
  else if (host === 'fb.watch') base = 'https://fb.watch';
  else return null;
  if (!u.pathname || u.pathname === '/') return null;
  return `${base}${u.pathname}${u.search}`;
}

// The official embedded player for a video link (loaded by the visitor's browser only).
function playerUrl(url) {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`;
}

async function loadVideos(pool) {
  const [{ rows: allCats }, { rows }] = await Promise.all([
    pool.query('SELECT slug, parent_slug, name_fr, name_en, names, description_fr, sort_order, active FROM creator_categories ORDER BY sort_order'),
    pool.query(
      `SELECT v.id, v.url, v.title, v.page_name, v.page_url, v.published_at, v.category_slug, v.type, v.language,
              v.thumbnail IS NOT NULL AS has_thumbnail, v.updated_at,
              c.iso_code AS country_iso, c.name AS country_name, c.flag_url, c.region
         FROM facebook_videos v LEFT JOIN countries c ON c.id = v.country_id
        WHERE v.review_status = 'approved'
        ORDER BY v.published_at DESC, v.id DESC`
    ),
  ]);
  const cats = allCats.filter((c) => c.active);
  const bySlug = Object.fromEntries(allCats.map((c) => [c.slug, c]));
  // A switched-off category counts for its parent when that one is on (as youtubeDirectory.js).
  const visible = (s) => {
    const c = s && bySlug[s];
    if (!c) return null;
    if (c.active) return s;
    const p = c.parent_slug && bySlug[c.parent_slug];
    return p && p.active ? p.slug : null;
  };
  let updatedAt = null;
  const entries = rows.map((r) => {
    const cat = visible(r.category_slug);
    const parent = cat && bySlug[cat].parent_slug && bySlug[bySlug[cat].parent_slug]?.active ? bySlug[cat].parent_slug : null;
    if (!updatedAt || r.updated_at > updatedAt) updatedAt = r.updated_at;
    return {
      key: `facebook-${r.id}`,
      id: r.id,
      url: r.url,
      player_url: playerUrl(r.url),
      title: r.title,
      page_name: r.page_name,
      page_url: r.page_url || null,
      published_at: r.published_at,
      thumbnail_url: r.has_thumbnail ? `/api/facebook/thumbnails/${r.id}?v=${new Date(r.updated_at).getTime()}` : null,
      country_iso: r.country_iso ? r.country_iso.trim() : null,
      country_name: r.country_name || null,
      flag_url: r.flag_url || null,
      region: r.region || null,
      continent: continentOf(r.region),
      type: r.type || null,
      language: r.language || null,
      languages: r.language ? [r.language] : [],
      category: cat,
      primary_category: cat,
      categories: cat ? (parent ? [cat, parent] : [cat]) : [],
    };
  });
  const taxonomy = cats.map((c) => ({ slug: c.slug, parent_slug: c.parent_slug, name_fr: c.name_fr, name_en: c.name_en || null, names: c.names || {}, description_fr: c.description_fr || null }));
  return { entries, categories: cats, taxonomy, updatedAt };
}

function facets(entries, categories) {
  const count = (pick) => {
    const m = new Map();
    for (const e of entries) for (const k of [].concat(pick(e) || [])) m.set(k, (m.get(k) || 0) + 1);
    return m;
  };
  const byContinent = count((e) => e.continent);
  const byType = count((e) => e.type);
  const byLang = count((e) => e.language);
  const byCat = count((e) => e.categories);
  const countries = new Map();
  for (const e of entries) {
    if (!e.country_iso) continue;
    const c = countries.get(e.country_iso) || { iso: e.country_iso, name: e.country_name, flag_url: e.flag_url, continent: e.continent, region: e.region, count: 0 };
    c.count++;
    countries.set(e.country_iso, c);
  }
  return {
    continents: CONTINENTS.map((c) => ({ key: c.key, label: c.label, count: byContinent.get(c.key) || 0 })).filter((c) => c.count),
    countries: [...countries.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    categories: categories.filter((c) => byCat.get(c.slug))
      .map((c) => ({ slug: c.slug, name_fr: c.name_fr, name_en: c.name_en || null, names: c.names || {}, parent_slug: c.parent_slug, count: byCat.get(c.slug) })),
    types: TYPES.map((t) => ({ key: t.key, label: t.label, count: byType.get(t.key) || 0 })).filter((t) => t.count),
    languages: LANGUAGES.map((l) => ({ key: l.key, label: l.label, count: byLang.get(l.key) || 0 })).filter((l) => l.count),
  };
}

function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’\-]/g, ' ').replace(/\s+/g, ' ');
}

function parseParams(query) {
  const s = (v, max = 80) => String(v || '').trim().slice(0, max);
  const country = s(query.country, 2).toUpperCase();
  const types = [...new Set(s(query.type, 200).split(',').map((t) => t.trim()).filter((t) => TYPES.some((x) => x.key === t)))];
  return {
    q: s(query.q, 100),
    country: /^[A-Z]{2}$/.test(country) ? country : '',
    continent: CONTINENTS.some((c) => c.key === query.continent) ? query.continent : '',
    region: (REGIONS.find((r) => r.key === query.region) || {}).region || '',
    category: /^[a-z0-9-]{1,60}$/.test(s(query.category)) ? s(query.category) : '',
    types,
    lang: LANGUAGES.some((l) => l.key === query.lang) ? query.lang : '',
    page: Math.max(parseInt(String(query.page || '1'), 10) || 1, 1),
    per: Math.min(Math.max(parseInt(String(query.per || PER_DEFAULT), 10) || PER_DEFAULT, 1), PER_MAX),
  };
}

// Filters combine (AND); the list stays newest first.
function queryVideos(entries, p) {
  const q = norm(p.q).trim();
  const list = entries.filter((e) =>
    (!q || norm([e.title, e.page_name, e.country_name].join(' ')).includes(q))
    && (!p.country || e.country_iso === p.country)
    && (!p.continent || e.continent === p.continent)
    && (!p.region || e.region === p.region)
    && (!p.category || e.categories.includes(p.category))
    && (!p.types.length || p.types.includes(e.type))
    && (!p.lang || e.language === p.lang));
  const start = (p.page - 1) * p.per;
  return { total: list.length, items: list.slice(start, start + p.per) };
}

// Admin input -> columns. Returns { error } or { values } (only the fields present, for PATCH).
async function readFields(pool, body, { partial }) {
  const b = body || {};
  const v = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const text = (k, max) => String(b[k] ?? '').trim().slice(0, max);
  if (!partial || has('url')) {
    const url = normalizeFacebookUrl(b.url);
    if (!url) return { error: 'Lien refusé : seuls les liens https://www.facebook.com/... ou https://fb.watch/... sont acceptés.' };
    v.url = url;
  }
  if (!partial || has('title')) {
    v.title = text('title', 300);
    if (!v.title) return { error: 'Titre manquant.' };
  }
  if (!partial || has('page_name')) {
    v.page_name = text('page_name', 200);
    if (!v.page_name) return { error: 'Nom de la page Facebook manquant.' };
  }
  if (has('page_url')) {
    if (b.page_url === null || b.page_url === '') v.page_url = null;
    else {
      v.page_url = normalizeFacebookUrl(b.page_url);
      if (!v.page_url) return { error: 'Lien de la page refusé : seuls les liens facebook.com sont acceptés.' };
    }
  }
  if (!partial || has('published_at')) {
    const d = new Date(String(b.published_at || ''));
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86400000 || d.getFullYear() < 2004) return { error: 'Date de publication invalide.' };
    v.published_at = d.toISOString();
  }
  if (has('country')) {
    if (!b.country) v.country_id = null;
    else {
      const { rows } = await pool.query('SELECT id FROM countries WHERE iso_code = $1', [String(b.country).toUpperCase().slice(0, 2)]);
      if (!rows.length) return { error: 'Pays inconnu.' };
      v.country_id = rows[0].id;
    }
  }
  if (has('category')) {
    if (!b.category) v.category_slug = null;
    else {
      const { rows } = await pool.query('SELECT slug FROM creator_categories WHERE slug = $1', [String(b.category).slice(0, 60)]);
      if (!rows.length) return { error: 'Catégorie inconnue.' };
      v.category_slug = rows[0].slug;
    }
  }
  if (has('type')) {
    if (b.type && !TYPES.some((t) => t.key === b.type)) return { error: 'Type inconnu.' };
    v.type = b.type || null;
  }
  if (has('language')) {
    if (b.language && !LANGUAGES.some((l) => l.key === b.language)) return { error: 'Langue inconnue.' };
    v.language = b.language || null;
  }
  if (has('review_status')) {
    if (!['approved', 'hidden'].includes(b.review_status)) return { error: 'Statut inconnu.' };
    v.review_status = b.review_status;
  }
  // thumbnail: { type, data (base64) } to set it, null to remove it. The bytes must be the image type they claim.
  if (has('thumbnail')) {
    if (b.thumbnail === null) {
      v.thumbnail = null;
      v.thumbnail_type = null;
    } else {
      const type = String(b.thumbnail?.type || '');
      const check = THUMB_TYPES[type];
      const buf = Buffer.from(String(b.thumbnail?.data || ''), 'base64');
      if (!check || buf.length < 12 || !check(buf)) return { error: 'Miniature refusée : JPEG, PNG ou WebP uniquement.' };
      if (buf.length > THUMB_MAX_BYTES) return { error: 'Miniature trop lourde (400 Ko au plus).' };
      v.thumbnail = buf;
      v.thumbnail_type = type;
    }
  }
  return { values: v };
}

const ADMIN_COLUMNS = `v.id, v.url, v.title, v.page_name, v.page_url, v.published_at, v.category_slug AS category, v.type, v.language,
  v.review_status, v.thumbnail IS NOT NULL AS has_thumbnail, v.added_by, v.created_at, v.updated_at,
  c.iso_code AS country_iso, c.name AS country_name`;

let generation = 0;

function registerFacebookRoutes(fastify) {
  const pool = fastify.pg;
  let cache = null;
  async function data() {
    if (!cache || cache.generation !== generation || Date.now() - cache.at > CACHE_MS) {
      const g = generation;
      const d = await loadVideos(pool);
      cache = { ...d, at: Date.now(), generation: g, facets: facets(d.entries, d.categories), explorer: null };
    }
    return cache;
  }

  fastify.get('/api/facebook/directory', async (req) => {
    const p = parseParams(req.query || {});
    const d = await data();
    const { total, items } = queryVideos(d.entries, p);
    let placeFacets = null;
    if (p.country || p.continent || p.region) {
      const place = queryVideos(d.entries, { ...parseParams({}), country: p.country, continent: p.continent, region: p.region, per: d.entries.length || 1 });
      placeFacets = facets(place.items, d.categories);
    }
    return { total, page: p.page, per: p.per, items, facets: d.facets, place_facets: placeFacets, taxonomy: d.taxonomy, updated_at: d.updatedAt };
  });

  fastify.get('/api/facebook/latest', async (req) => {
    const q = req.query || {};
    const limit = Math.min(Math.max(parseInt(String(q.limit || '12'), 10) || 12, 1), PER_MAX);
    const d = await data();
    const { items } = queryVideos(d.entries, { ...parseParams(q), page: 1, per: limit });
    // total = every public video (the home page shows its /facebook link from FACEBOOK_MENU_MIN of them).
    return { items, updated_at: d.updatedAt, total: d.entries.length };
  });

  fastify.get('/api/facebook/explorer', async () => {
    const d = await data();
    if (!d.explorer) {
      const { rows } = await pool.query('SELECT iso_code, name, flag_url, region FROM countries ORDER BY name');
      d.explorer = explorerTree(d.entries, d.categories, rows);
    }
    return d.explorer;
  });

  fastify.get('/api/facebook/thumbnails/:id', async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return reply.code(404).send({ error: 'Not found' });
    const { rows } = await pool.query(
      `SELECT thumbnail, thumbnail_type FROM facebook_videos WHERE id = $1 AND review_status = 'approved' AND thumbnail IS NOT NULL`, [id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    // The address carries ?v=<updated_at>, so a new thumbnail gets a new address.
    return reply.header('Content-Type', rows[0].thumbnail_type).header('Cache-Control', 'public, max-age=86400')
      .header('X-Content-Type-Options', 'nosniff').send(rows[0].thumbnail);
  });

  // Admin.
  fastify.get('/api/admin/facebook/videos', { preHandler: requireAdmin }, async () => {
    const { rows } = await pool.query(
      `SELECT ${ADMIN_COLUMNS} FROM facebook_videos v LEFT JOIN countries c ON c.id = v.country_id ORDER BY v.published_at DESC, v.id DESC`);
    return rows.map((r) => ({ ...r, country_iso: r.country_iso ? r.country_iso.trim() : null }));
  });

  fastify.post('/api/admin/facebook/videos', { preHandler: requireAdmin, bodyLimit: 1024 * 1024 }, async (req, reply) => {
    const { error, values } = await readFields(pool, req.body, { partial: false });
    if (error) return reply.code(400).send({ error });
    const cols = Object.keys(values);
    try {
      const { rows } = await pool.query(
        `INSERT INTO facebook_videos (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
        cols.map((c) => values[c]));
      generation += 1;
      return reply.code(201).send({ id: rows[0].id, url: values.url });
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Cette vidéo est déjà enregistrée.' });
      throw err;
    }
  });

  fastify.patch('/api/admin/facebook/videos/:id', { preHandler: requireAdmin, bodyLimit: 1024 * 1024 }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return reply.code(404).send({ error: 'Not found' });
    const { error, values } = await readFields(pool, req.body, { partial: true });
    if (error) return reply.code(400).send({ error });
    const cols = Object.keys(values);
    if (!cols.length) return reply.code(400).send({ error: 'Rien à modifier.' });
    try {
      const { rowCount } = await pool.query(
        `UPDATE facebook_videos SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now() WHERE id = $1`,
        [id, ...cols.map((c) => values[c])]);
      if (!rowCount) return reply.code(404).send({ error: 'Not found' });
      generation += 1;
      return { status: 'updated' };
    } catch (err) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Cette vidéo est déjà enregistrée.' });
      throw err;
    }
  });

  // Hides the video (nothing is deleted; PATCH review_status=approved shows it again).
  fastify.delete('/api/admin/facebook/videos/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return reply.code(404).send({ error: 'Not found' });
    const { rowCount } = await pool.query(`UPDATE facebook_videos SET review_status = 'hidden', updated_at = now() WHERE id = $1`, [id]);
    if (!rowCount) return reply.code(404).send({ error: 'Not found' });
    generation += 1;
    return { status: 'hidden' };
  });
}

module.exports = { registerFacebookRoutes, normalizeFacebookUrl, playerUrl, parseParams, queryVideos };
