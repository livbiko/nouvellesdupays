// CR-2026-11-17-02: the category tree, managed from /admin/categories without code changes (migration 020).
//   GET   /api/admin/creator-categories              every category (switched-off ones too) with link counts
//   POST  /api/admin/creator-categories              create a main category or a subcategory
//   PATCH /api/admin/creator-categories/:slug        rename, describe, move, switch on/off (never delete)
//   PUT   /api/admin/creator-categories-order        order of the main categories, or of one main's subcategories
//   GET   /api/admin/channel-categories              /youtube directory channels with their subcategories
//   PUT   /api/admin/channel-categories              set one channel's subcategories (one primary)
//   GET   /api/admin/channel-categories/export       CSV of every channel's classification
//   POST  /api/admin/channel-categories/import       apply a CSV (export format, or the review CSV with owner_decision)
// Two levels only: a subcategory's parent is a main category. A channel is keyed like the directory groups it: its
// YouTube channel id, or its lowercased channel/page URL - one record however many countries/rails list it.
const { invalidateDirectory } = require('./youtubeDirectory');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CHANNEL_KEY = "coalesce(nullif(vc.youtube_channel_id, ''), lower(coalesce(vc.channel_url, vc.page_url)))";
const MAX_CATEGORIES = 6;

const text = (v, max) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

async function categoryBySlug(db, slug) {
  const { rows: [c] } = await db.query('SELECT id, slug, parent_slug, active, sort_order FROM creator_categories WHERE slug = $1', [slug]);
  return c || null;
}

// Validates a list of category slugs (and its primary) for a channel: known, at most MAX_CATEGORIES, no duplicates.
async function resolveCategories(db, slugs, primary) {
  if (!Array.isArray(slugs) || !slugs.length || slugs.length > MAX_CATEGORIES) {
    return { error: `indiquez de 1 à ${MAX_CATEGORIES} catégories` };
  }
  const list = [...new Set(slugs.map((s) => String(s).trim()))];
  const { rows } = await db.query('SELECT id, slug FROM creator_categories WHERE slug = ANY($1)', [list]);
  if (rows.length !== list.length) {
    const known = new Set(rows.map((r) => r.slug));
    return { error: `catégorie inconnue : ${list.filter((s) => !known.has(s)).join(', ')}` };
  }
  const main = primary || list[0];
  if (!list.includes(main)) return { error: 'la catégorie principale doit faire partie de la liste' };
  return { rows: rows.map((r) => ({ id: r.id, slug: r.slug, primary: r.slug === main })) };
}

async function setChannelCategories(client, key, cats) {
  await client.query('DELETE FROM video_channel_category_links WHERE channel_key = $1', [key]);
  for (const c of cats) {
    await client.query('INSERT INTO video_channel_category_links (channel_key, category_id, is_primary) VALUES ($1, $2, $3)',
      [key, c.id, c.primary]);
  }
}

async function setCreatorCategories(client, creatorId, cats) {
  await client.query('DELETE FROM creator_category_links WHERE creator_id = $1', [creatorId]);
  for (const c of cats) {
    await client.query('INSERT INTO creator_category_links (creator_id, category_id, is_primary) VALUES ($1, $2, $3)',
      [creatorId, c.id, c.primary]);
  }
  await client.query('UPDATE creators SET updated_at = now() WHERE id = $1', [creatorId]);
}

async function channelExists(db, key) {
  const { rows } = await db.query(`SELECT 1 FROM video_channels vc WHERE ${CHANNEL_KEY} = $1 LIMIT 1`, [key]);
  return rows.length > 0;
}

// RFC 4180 CSV (quoted fields, doubled quotes, CRLF or LF, optional BOM) -> array of rows. The separator is "," or
// ";" (French Excel saves with ";"), whichever the header line uses more.
function parseCsv(input) {
  const s = String(input || '').replace(/^\uFEFF/, '');
  const header = s.split(/\r?\n/, 1)[0].replace(/"(?:[^"]|"")*"/g, '');
  const sep = (header.match(/;/g) || []).length > (header.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false; else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function registerCategoryAdminRoutes(admin, pool) {
  admin.get('/api/admin/creator-categories', async () => {
    const { rows } = await pool.query(
      `SELECT c.slug, c.parent_slug, c.name_en, c.name_fr, c.description_fr, c.sort_order, c.active,
              (SELECT count(*)::int FROM creator_category_links l WHERE l.category_id = c.id) AS creators,
              (SELECT count(*)::int FROM creator_category_links l JOIN creators cr ON cr.id = l.creator_id
                WHERE l.category_id = c.id AND cr.review_status = 'approved') AS approved_creators,
              (SELECT count(*)::int FROM video_channel_category_links v WHERE v.category_id = c.id) AS channels
         FROM creator_categories c
         LEFT JOIN creator_categories p ON p.slug = c.parent_slug
        ORDER BY coalesce(p.sort_order, c.sort_order), c.parent_slug IS NOT NULL, c.sort_order, c.slug`
    );
    return rows;
  });

  admin.post('/api/admin/creator-categories', async (req, reply) => {
    const b = req.body || {};
    const slug = String(b.slug || '').trim();
    if (!SLUG.test(slug) || slug.length > 60) return reply.code(400).send({ error: 'identifiant : lettres minuscules, chiffres et tirets (60 au plus)' });
    const nameFr = text(b.name_fr, 80);
    if (!nameFr) return reply.code(400).send({ error: 'le nom est obligatoire' });
    const parentSlug = b.parent_slug ? String(b.parent_slug) : null;
    if (await categoryBySlug(pool, slug)) return reply.code(409).send({ error: 'cet identifiant existe déjà' });
    let sort;
    if (parentSlug) {
      const parent = await categoryBySlug(pool, parentSlug);
      if (!parent || parent.parent_slug) return reply.code(400).send({ error: 'le parent doit être une catégorie principale' });
      const { rows: [m] } = await pool.query('SELECT coalesce(max(sort_order), $2) AS max FROM creator_categories WHERE parent_slug = $1',
        [parentSlug, parent.sort_order]);
      sort = m.max + 1;
    } else {
      const { rows: [m] } = await pool.query('SELECT coalesce(max(sort_order), 0) AS max FROM creator_categories WHERE parent_slug IS NULL');
      sort = (Math.floor(m.max / 100) + 1) * 100;
    }
    await pool.query(
      `INSERT INTO creator_categories (slug, parent_slug, name_en, name_fr, description_fr, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [slug, parentSlug, text(b.name_en, 80) || nameFr, nameFr, text(b.description_fr, 500), sort]
    );
    invalidateDirectory();
    return reply.code(201).send({ slug, parent_slug: parentSlug, sort_order: sort });
  });

  admin.patch('/api/admin/creator-categories/:slug', async (req, reply) => {
    const cat = await categoryBySlug(pool, req.params.slug);
    if (!cat) return reply.code(404).send({ error: 'catégorie inconnue' });
    const b = req.body || {};
    const sets = [];
    const params = [];
    const set = (col, v) => { params.push(v); sets.push(`${col} = $${params.length}`); };
    if (b.name_fr !== undefined) {
      const v = text(b.name_fr, 80);
      if (!v) return reply.code(400).send({ error: 'le nom ne peut pas être vide' });
      set('name_fr', v);
    }
    if (b.name_en !== undefined) {
      const v = text(b.name_en, 80);
      if (!v) return reply.code(400).send({ error: 'le nom anglais ne peut pas être vide' });
      set('name_en', v);
    }
    if (b.description_fr !== undefined) set('description_fr', text(b.description_fr, 500));
    if (b.active !== undefined) {
      if (typeof b.active !== 'boolean') return reply.code(400).send({ error: 'active doit valoir true ou false' });
      set('active', b.active);
    }
    if (b.parent_slug !== undefined && (b.parent_slug || null) !== cat.parent_slug) {
      const parentSlug = b.parent_slug ? String(b.parent_slug) : null;
      if (parentSlug) {
        const parent = await categoryBySlug(pool, parentSlug);
        if (!parent || parent.parent_slug) return reply.code(400).send({ error: 'le parent doit être une catégorie principale' });
        const { rows: kids } = await pool.query('SELECT 1 FROM creator_categories WHERE parent_slug = $1 LIMIT 1', [cat.slug]);
        if (kids.length) return reply.code(400).send({ error: 'une catégorie principale qui a des sous-catégories ne peut pas devenir une sous-catégorie' });
        const { rows: [m] } = await pool.query('SELECT coalesce(max(sort_order), $2) AS max FROM creator_categories WHERE parent_slug = $1',
          [parentSlug, parent.sort_order]);
        set('sort_order', m.max + 1);
      } else {
        const { rows: [m] } = await pool.query('SELECT coalesce(max(sort_order), 0) AS max FROM creator_categories WHERE parent_slug IS NULL');
        set('sort_order', (Math.floor(m.max / 100) + 1) * 100);
      }
      set('parent_slug', parentSlug);
    }
    if (!sets.length) return reply.code(400).send({ error: 'rien à modifier' });
    params.push(cat.id);
    await pool.query(`UPDATE creator_categories SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
    invalidateDirectory();
    return { slug: cat.slug, updated: sets.length };
  });

  // Order of the main categories (parent_slug null) or of one main category's subcategories: `slugs` must list exactly
  // that set. Main categories get 100, 200, ...; each subcategory its main's value + 1, + 2, ... (so ORDER BY
  // sort_order lists a main before its subcategories everywhere it is used).
  admin.put('/api/admin/creator-categories-order', async (req, reply) => {
    const b = req.body || {};
    const parentSlug = b.parent_slug ? String(b.parent_slug) : null;
    const slugs = Array.isArray(b.slugs) ? b.slugs.map(String) : null;
    if (!slugs) return reply.code(400).send({ error: 'slugs doit être une liste' });
    const { rows: current } = await pool.query(
      parentSlug ? 'SELECT slug FROM creator_categories WHERE parent_slug = $1' : 'SELECT slug FROM creator_categories WHERE parent_slug IS NULL',
      parentSlug ? [parentSlug] : []);
    const have = new Set(current.map((r) => r.slug));
    if (slugs.length !== have.size || new Set(slugs).size !== slugs.length || !slugs.every((s) => have.has(s))) {
      return reply.code(400).send({ error: 'slugs doit lister exactement les catégories de ce niveau' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (parentSlug) {
        const parent = await categoryBySlug(client, parentSlug);
        for (const [i, s] of slugs.entries()) {
          await client.query('UPDATE creator_categories SET sort_order = $2, updated_at = now() WHERE slug = $1', [s, parent.sort_order + i + 1]);
        }
      } else {
        for (const [i, s] of slugs.entries()) {
          const base = (i + 1) * 100;
          await client.query('UPDATE creator_categories SET sort_order = $2, updated_at = now() WHERE slug = $1', [s, base]);
          const { rows: kids } = await client.query('SELECT slug FROM creator_categories WHERE parent_slug = $1 ORDER BY sort_order, slug', [s]);
          for (const [j, k] of kids.entries()) {
            await client.query('UPDATE creator_categories SET sort_order = $2, updated_at = now() WHERE slug = $1', [k.slug, base + j + 1]);
          }
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    invalidateDirectory();
    return { parent_slug: parentSlug, order: slugs };
  });

  const CHANNELS_SQL = `
    SELECT g.*,
           coalesce((SELECT json_agg(json_build_object('slug', cc.slug, 'name_fr', cc.name_fr, 'primary', l.is_primary, 'active', cc.active)
                                     ORDER BY l.is_primary DESC, cc.sort_order)
                       FROM video_channel_category_links l JOIN creator_categories cc ON cc.id = l.category_id
                      WHERE l.channel_key = g.key), '[]') AS categories
      FROM (SELECT ${CHANNEL_KEY} AS key, min(vc.name) AS name,
                   array_remove(array_agg(DISTINCT trim(c.iso_code)), NULL) AS countries,
                   array_agg(DISTINCT vc.category) AS rails, array_remove(array_agg(DISTINCT nullif(vc.topic, '')), NULL) AS topics,
                   (array_agg(vc.logo_url) FILTER (WHERE vc.logo_url IS NOT NULL))[1] AS logo_url
              FROM video_channels vc LEFT JOIN countries c ON c.id = vc.country_id
             GROUP BY 1) g`;

  admin.get('/api/admin/channel-categories', async (req) => {
    const q = req.query || {};
    const status = ['classified', 'unclassified'].includes(q.status) ? q.status : 'all';
    const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const { rows } = await pool.query(
      `SELECT * FROM (${CHANNELS_SQL}) x
        WHERE ($1::text IS NULL OR x.name ILIKE '%' || $1 || '%' OR x.key ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR upper($2) = ANY(x.countries))
          AND ($3 = 'all' OR ($3 = 'classified') = (json_array_length(x.categories) > 0))
          AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM json_array_elements(x.categories) e WHERE e->>'slug' = $4))
        ORDER BY x.name
        LIMIT $5 OFFSET $6`,
      [q.q ? String(q.q).slice(0, 100) : null, q.country ? String(q.country).slice(0, 2) : null, status,
        q.category ? String(q.category).slice(0, 60) : null, limit, offset]
    );
    const { rows: [n] } = await pool.query(
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE json_array_length(categories) > 0)::int AS classified FROM (${CHANNELS_SQL}) x`);
    return { ...n, items: rows };
  });

  admin.put('/api/admin/channel-categories', async (req, reply) => {
    const b = req.body || {};
    const key = String(b.key || '');
    if (!key || !(await channelExists(pool, key))) return reply.code(404).send({ error: 'chaîne inconnue' });
    const cats = await resolveCategories(pool, b.categories, b.primary);
    if (cats.error) return reply.code(400).send({ error: cats.error });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await setChannelCategories(client, key, cats.rows);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    invalidateDirectory();
    return { key, categories: cats.rows.map((c) => c.slug), primary: cats.rows.find((c) => c.primary).slug };
  });

  admin.get('/api/admin/channel-categories/export', async (req, reply) => {
    const { rows } = await pool.query(`SELECT * FROM (${CHANNELS_SQL}) x ORDER BY x.name`);
    const lines = [['kind', 'key', 'name', 'countries', 'primary', 'others'].map(csvCell).join(',')];
    for (const r of rows) {
      const cats = r.categories || [];
      const primary = (cats.find((c) => c.primary) || {}).slug || '';
      lines.push(['channel', r.key, r.name, r.countries.join(','), primary,
        cats.filter((c) => !c.primary).map((c) => c.slug).join(';')].map(csvCell).join(','));
    }
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', 'attachment; filename="classement-chaines.csv"');
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  });

  // Applies a CSV: the export format (key, primary, others) or the CR review file (key, proposed_primary_subcategory,
  // proposed_other_subcategories, owner_decision: "ok" = the proposal, "slug;slug" = these (first = primary),
  // "reject" or empty = not applied). Rows whose key is "creator:<slug>" set an approved creator's categories.
  // dry_run (default true) reports what would change without writing.
  admin.post('/api/admin/channel-categories/import', async (req, reply) => {
    const b = req.body || {};
    if (typeof b.csv !== 'string' || !b.csv.trim()) return reply.code(400).send({ error: 'le CSV est vide' });
    if (b.csv.length > 2_000_000) return reply.code(400).send({ error: 'le CSV est trop volumineux' });
    const dryRun = b.dry_run !== false;
    const rows = parseCsv(b.csv);
    if (rows.length < 2) return reply.code(400).send({ error: 'le CSV ne contient aucune ligne de données' });
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const col = (name) => head.findIndex((h) => h === name || h.startsWith(`${name} `));
    const iKey = col('key');
    const iDecision = col('owner_decision');
    const iPrimary = iDecision >= 0 ? col('proposed_primary_subcategory') : col('primary');
    const iOthers = iDecision >= 0 ? col('proposed_other_subcategories') : col('others');
    if (iKey < 0 || iPrimary < 0) return reply.code(400).send({ error: 'le CSV doit avoir une colonne key et une colonne primary (ou proposed_primary_subcategory)' });

    const out = { dry_run: dryRun, rows: rows.length - 1, applied: 0, skipped: 0, errors: [] };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [n, r] of rows.slice(1).entries()) {
        const line = n + 2;
        const key = (r[iKey] || '').trim();
        let slugs;
        if (iDecision >= 0) {
          const d = (r[iDecision] || '').trim();
          if (!d || /^(reject|rejet|non|no)$/i.test(d)) { out.skipped += 1; continue; }
          slugs = /^ok$/i.test(d)
            ? [r[iPrimary], ...String(r[iOthers] || '').split(';')]
            : d.split(/[;,]/);
        } else {
          slugs = [r[iPrimary], ...String(iOthers >= 0 ? r[iOthers] || '' : '').split(';')];
        }
        slugs = slugs.map((s) => String(s || '').trim()).filter(Boolean);
        if (!slugs.length) { out.skipped += 1; continue; }
        const cats = await resolveCategories(client, slugs, slugs[0]);
        if (cats.error) { out.errors.push({ line, key, error: cats.error }); continue; }
        if (key.startsWith('creator:')) {
          const { rows: [cr] } = await client.query(`SELECT id FROM creators WHERE slug = $1 AND review_status = 'approved'`, [key.slice(8)]);
          if (!cr) { out.errors.push({ line, key, error: 'créateur inconnu ou non approuvé' }); continue; }
          await setCreatorCategories(client, cr.id, cats.rows);
        } else {
          if (!key || !(await channelExists(client, key))) { out.errors.push({ line, key, error: 'chaîne inconnue' }); continue; }
          await setChannelCategories(client, key, cats.rows);
        }
        out.applied += 1;
      }
      await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    if (!dryRun && out.applied) invalidateDirectory();
    out.errors = out.errors.slice(0, 50);
    return reply.send(out);
  });
}

module.exports = { registerCategoryAdminRoutes, parseCsv, CHANNEL_KEY };
