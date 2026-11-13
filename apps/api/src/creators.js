// Admin side of the creator directory (db/migrations/018_creators.sql): the review queue for YouTube / Facebook /
// TikTok creators. A creator is a candidate until approved here; nothing in this file is public. Accounts are rows in
// social_accounts (one row per account, possibly shared with a news publisher) and evidence is append-only in
// creator_verifications. No audience numbers are written here: they come from an official API or the creator's own
// connected account, never typed in or estimated (owner brief 2026-11-11, sections 13-14).
const { normalizeSocialProfileUrl } = require('@nouvellesdupays/shared/src/discovery');
const { slugBase, slugCandidates } = require('@nouvellesdupays/shared/src/publisherSlug');
const { cleanText, optionalUrl } = require('./security');

const PLATFORMS = ['youtube', 'facebook', 'tiktok'];
const REVIEW_STATUSES = ['candidate', 'approved', 'rejected', 'merged'];
const CONFIDENCE = ['VERIFIED', 'HIGH_CONFIDENCE', 'PROVISIONAL', 'REQUIRES_REVIEW'];
const KINDS = ['individual', 'group', 'media_brand'];
const EVIDENCE = ['platform_badge', 'cross_link', 'official_website', 'creator_confirmed', 'reviewer', 'name_match_only',
  'impersonator_suspected'];
// Evidence strong enough to call a creator VERIFIED (and to approve it - see SELECTION_EVIDENCE for the other way).
// A name match alone never is (spec section 6).
const STRONG_EVIDENCE = ['platform_badge', 'cross_link', 'official_website', 'creator_confirmed'];
// Evidence a reader can check for themselves needs the page that shows it (Build #233: two cross_link rows saved
// without a URL on 11-11 made a public profile claim links that did not exist). creator_confirmed, reviewer and the
// weak kinds may come from a message or a call, so a note is enough for them.
const NEEDS_URL = ['platform_badge', 'cross_link', 'official_website'];
const missingUrl = (kind, url) => (NEEDS_URL.includes(kind) && !url ? `evidence_url is required for ${kind}` : null);
// Build #248 (owner, 11-13): a creator may also be approved on the reviewer's own decision - none of the first 24
// news candidates had a badge or a site. Such a profile is "selected", not verified: it stays PROVISIONAL, the
// decision needs a note saying why, and VERIFIED / HIGH_CONFIDENCE (shown publicly as "vérifié") still need
// STRONG_EVIDENCE. A reviewer decision never marks an account verified (it used to, before #248).
const SELECTION_EVIDENCE = ['reviewer'];
const NEEDS_STRONG = ['VERIFIED', 'HIGH_CONFIDENCE'];
const missingNote = (kind, note) =>
  (kind === 'reviewer' && !cleanText(note, 1000) ? 'note is required for a reviewer decision (why this creator is selected)' : null);
// What a piece of evidence says about the account itself (social_accounts.verification). 'reviewer' is handled in
// recordEvidence: it only clears an impersonation report.
const ACCOUNT_VERIFICATION = {
  platform_badge: 'verified', cross_link: 'verified', creator_confirmed: 'verified',
  official_website: 'linked_from_site', impersonator_suspected: 'rejected',
};
// An agent can only be resumed when it has a way to collect data.
const AGENT_BLOCKER = {
  youtube: () => (process.env.YOUTUBE_API_KEY ? null : 'YOUTUBE_API_KEY is not set'),
  facebook: () => 'No Meta page-data access (Page Public Content/Metadata Access needs Meta app review)',
  tiktok: () => 'No eligible TikTok API access (the Research API is for academic researchers)',
  global: () => null,
};

function languageList(value) {
  if (value === undefined) return { value: undefined };
  const list = Array.isArray(value) ? value : [];
  if (list.length > 5 || !list.every((l) => typeof l === 'string' && /^[a-z]{2,3}$/.test(l))) {
    return { error: 'languages must be up to 5 ISO 639 codes' };
  }
  return { value: [...new Set(list)] };
}

// A region a creator without a country can be filed under: one of the regions countries are grouped in.
async function knownRegion(db, region) {
  if (typeof region !== 'string' || region.length > 60) return false;
  const { rows } = await db.query('SELECT 1 FROM countries WHERE region = $1 LIMIT 1', [region]);
  return rows.length > 0;
}

async function countryIdOf(db, iso) {
  const { rows } = await db.query('SELECT id FROM countries WHERE iso_code = upper($1)', [String(iso)]);
  return rows.length ? rows[0].id : null;
}

// Categories by slug -> ids; the primary must be one of them.
async function categoryIds(db, slugs, primary) {
  if (!Array.isArray(slugs) || slugs.length > 6) return { error: 'categories must be a list of up to 6 category slugs' };
  const { rows } = await db.query('SELECT id, slug FROM creator_categories WHERE slug = ANY($1)', [slugs.map(String)]);
  if (rows.length !== new Set(slugs).size) return { error: 'Unknown category' };
  if (primary !== undefined && primary !== null && !slugs.includes(primary)) return { error: 'primary_category must be one of categories' };
  return { rows: rows.map((r) => ({ id: r.id, primary: r.slug === (primary ?? slugs[0]) })) };
}

async function setCategories(client, creatorId, cats) {
  await client.query('DELETE FROM creator_category_links WHERE creator_id = $1', [creatorId]);
  for (const c of cats) {
    await client.query('INSERT INTO creator_category_links (creator_id, category_id, is_primary) VALUES ($1, $2, $3)',
      [creatorId, c.id, c.primary]);
  }
}

// Same collision rule as publisher slugs: name, then -<iso>, then -<id>.
async function assignCreatorSlug(client, id, name, iso) {
  for (const slug of slugCandidates(slugBase(name, null) || `creator-${id}`, iso ? iso.toLowerCase() : null, id)) {
    const { rowCount } = await client.query(
      'UPDATE creators SET slug = $2 WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM creators WHERE slug = $2 AND id <> $1)',
      [id, slug]
    );
    if (rowCount) return slug;
  }
  throw new Error(`No free slug for creator ${id}`);
}

const DETAIL_SQL = `
  SELECT cr.*, c.iso_code, c.name AS country_name, coalesce(c.region, cr.region) AS region,
    coalesce((SELECT json_agg(json_build_object('slug', cc.slug, 'name_fr', cc.name_fr, 'primary', l.is_primary)
                ORDER BY l.is_primary DESC, cc.sort_order)
              FROM creator_category_links l JOIN creator_categories cc ON cc.id = l.category_id
              WHERE l.creator_id = cr.id), '[]') AS categories,
    coalesce((SELECT json_agg(json_build_object('id', sa.id, 'platform', sa.platform, 'url', sa.url, 'handle', sa.handle,
                'display_name', sa.display_name, 'verification', sa.verification, 'platform_verified', sa.platform_verified,
                'status', sa.status, 'publisher_id', sa.publisher_id) ORDER BY sa.platform, sa.id)
              FROM social_accounts sa WHERE sa.creator_id = cr.id), '[]') AS accounts
  FROM creators cr LEFT JOIN countries c ON c.id = cr.country_id`;

function registerCreatorAdminRoutes(admin, pool) {
  admin.get('/api/admin/creator-categories', async () => {
    const { rows } = await pool.query('SELECT slug, parent_slug, name_en, name_fr FROM creator_categories ORDER BY sort_order');
    return rows;
  });

  admin.get('/api/admin/creators', async (req, reply) => {
    const q = req.query || {};
    if (q.status && q.status !== 'all' && !REVIEW_STATUSES.includes(q.status)) return reply.code(400).send({ error: 'Unknown status' });
    if (q.platform && !PLATFORMS.includes(q.platform)) return reply.code(400).send({ error: 'Unknown platform' });
    const limit = Math.min(Math.max(Number(q.limit) || 100, 1), 500);
    const offset = Math.max(Number(q.offset) || 0, 0);
    const { rows } = await pool.query(
      `${DETAIL_SQL}
       WHERE ($1::text IS NULL OR $1 = 'all' OR cr.review_status = $1)
         AND ($2::text IS NULL OR ($2 = 'none' AND cr.country_id IS NULL) OR c.iso_code = upper($2))
         AND ($3::text IS NULL OR coalesce(c.region, cr.region) = $3)
         AND ($8::text IS NULL OR $8 = ANY(cr.languages))
         AND ($4::text IS NULL OR EXISTS (SELECT 1 FROM social_accounts sa WHERE sa.creator_id = cr.id AND sa.platform = $4))
         AND ($5::text IS NULL OR cr.display_name ILIKE '%' || $5 || '%')
       ORDER BY cr.updated_at DESC
       LIMIT $6 OFFSET $7`,
      [q.status || 'candidate', q.country || null, q.region || null, q.platform || null,
        q.q ? String(q.q).slice(0, 100) : null, limit, offset, q.language ? String(q.language).toLowerCase().slice(0, 3) : null]
    );
    return rows;
  });

  admin.get('/api/admin/creators/summary', async () => {
    const { rows: [totals] } = await pool.query(
      `SELECT count(*) FILTER (WHERE review_status = 'candidate')::int AS candidates,
              count(*) FILTER (WHERE review_status = 'approved')::int AS approved,
              count(*) FILTER (WHERE review_status = 'rejected')::int AS rejected,
              count(*) FILTER (WHERE review_status = 'merged')::int AS merged,
              count(*) FILTER (WHERE confidence = 'VERIFIED')::int AS verified,
              count(*) FILTER (WHERE possible_minor)::int AS possible_minor,
              count(*) FILTER (WHERE review_status = 'candidate' AND country_id IS NULL)::int AS candidates_no_country,
              (SELECT count(*)::int FROM social_accounts WHERE creator_id IS NOT NULL) AS accounts
       FROM creators`
    );
    const { rows: agents } = await pool.query(
      `SELECT a.agent, a.paused, a.paused_reason, a.daily_quota_units, a.updated_at,
              r.started_at AS last_run_at, r.status AS last_run_status, r.message AS last_run_message
       FROM discovery_agents a
       LEFT JOIN LATERAL (SELECT * FROM agent_runs WHERE agent = a.agent ORDER BY started_at DESC LIMIT 1) r ON true
       ORDER BY array_position(ARRAY['global', 'youtube', 'facebook', 'tiktok'], a.agent)`
    );
    return { totals, agents: agents.map((a) => ({ ...a, blocker: AGENT_BLOCKER[a.agent]() })) };
  });

  admin.get('/api/admin/creators/:id', async (req, reply) => {
    const { rows: [creator] } = await pool.query(`${DETAIL_SQL} WHERE cr.id = $1`, [req.params.id]);
    if (!creator) return reply.code(404).send({ error: 'Creator not found' });
    const { rows: evidence } = await pool.query(
      'SELECT * FROM creator_verifications WHERE creator_id = $1 ORDER BY created_at DESC', [creator.id]);
    return { ...creator, evidence };
  });

  admin.post('/api/admin/creators', async (req, reply) => {
    const b = req.body || {};
    const name = cleanText(b.display_name, 200);
    if (!name) return reply.code(400).send({ error: 'display_name is required' });
    if (b.creator_kind !== undefined && !KINDS.includes(b.creator_kind)) return reply.code(400).send({ error: 'Unknown creator_kind' });
    const langs = languageList(b.languages);
    if (langs.error) return reply.code(400).send({ error: langs.error });
    const site = optionalUrl(b.official_website, 'official_website');
    if (site.error) return reply.code(400).send({ error: site.error });
    const countryId = b.country_iso ? await countryIdOf(pool, b.country_iso) : null;
    if (b.country_iso && !countryId) return reply.code(400).send({ error: 'Unknown country' });
    const cats = await categoryIds(pool, b.categories || [], b.primary_category);
    if (cats.error) return reply.code(400).send({ error: cats.error });
    if (!b.force) {
      const { rows: same } = await pool.query(
        `SELECT id FROM creators WHERE lower(display_name) = lower($1) AND country_id IS NOT DISTINCT FROM $2
           AND review_status <> 'merged' LIMIT 1`, [name, countryId]);
      if (same.length) return reply.code(409).send({ error: `A creator with this name already exists (id ${same[0].id})`, id: same[0].id });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [cr] } = await client.query(
        `INSERT INTO creators (slug, display_name, country_id, languages, bio, official_website, creator_kind,
           possible_minor, discovered_from)
         VALUES ('pending-' || md5(random()::text), $1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [name, countryId, langs.value || [], cleanText(b.bio, 1000), site.value, b.creator_kind || 'individual',
          Boolean(b.possible_minor), cleanText(b.discovered_from, 300) || 'admin']
      );
      const slug = await assignCreatorSlug(client, cr.id, name, b.country_iso);
      await setCategories(client, cr.id, cats.rows);
      await client.query('COMMIT');
      return { id: cr.id, slug };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  admin.patch('/api/admin/creators/:id', async (req, reply) => {
    const b = req.body || {};
    const { rows: [cur] } = await pool.query('SELECT * FROM creators WHERE id = $1', [req.params.id]);
    if (!cur) return reply.code(404).send({ error: 'Creator not found' });
    if (cur.review_status === 'merged') return reply.code(409).send({ error: `Merged into creator ${cur.merged_into_id}` });
    if (b.review_status !== undefined && !['candidate', 'approved', 'rejected'].includes(b.review_status)) {
      return reply.code(400).send({ error: 'review_status can be candidate, approved or rejected (use merge)' });
    }
    if (b.confidence !== undefined && !CONFIDENCE.includes(b.confidence)) return reply.code(400).send({ error: 'Unknown confidence' });
    if (b.creator_kind !== undefined && !KINDS.includes(b.creator_kind)) return reply.code(400).send({ error: 'Unknown creator_kind' });
    const langs = languageList(b.languages);
    if (langs.error) return reply.code(400).send({ error: langs.error });
    const site = optionalUrl(b.official_website, 'official_website');
    if (site.error) return reply.code(400).send({ error: site.error });
    let countryId;
    if (b.country_iso !== undefined) {
      countryId = await countryIdOf(pool, b.country_iso);
      if (!countryId) return reply.code(400).send({ error: 'Unknown country' });
    }
    if (b.region !== undefined && b.region !== null && !(await knownRegion(pool, b.region))) {
      return reply.code(400).send({ error: 'Unknown region' });
    }
    let cats;
    if (b.categories !== undefined) {
      cats = await categoryIds(pool, b.categories, b.primary_category);
      if (cats.error) return reply.code(400).send({ error: cats.error });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [cr] } = await client.query(
        `UPDATE creators SET
           display_name = coalesce($2, display_name), country_id = coalesce($3, country_id),
           languages = coalesce($4, languages), bio = CASE WHEN $5::boolean THEN $6 ELSE bio END,
           official_website = CASE WHEN $7::boolean THEN $8 ELSE official_website END,
           creator_kind = coalesce($9, creator_kind), possible_minor = coalesce($10, possible_minor),
           confidence = coalesce($11, confidence), reviewer_note = coalesce($12, reviewer_note),
           region = CASE WHEN $13::boolean THEN $14 ELSE region END, updated_at = now()
         WHERE id = $1 RETURNING *`,
        [cur.id, b.display_name !== undefined ? cleanText(b.display_name, 200) || null : null, countryId ?? null,
          langs.value ?? null, b.bio !== undefined, cleanText(b.bio, 1000), b.official_website !== undefined, site.value,
          b.creator_kind ?? null, typeof b.possible_minor === 'boolean' ? b.possible_minor : null, b.confidence ?? null,
          b.reviewer_note !== undefined ? cleanText(b.reviewer_note, 2000) : null, b.region !== undefined, b.region ?? null]
      );
      if (cats) await setCategories(client, cr.id, cats.rows);

      // VERIFIED / HIGH_CONFIDENCE need strong evidence for at least one linked account; approval needs that or a
      // reviewer decision (Build #248). Approval also needs the minor check cleared, a place (a country, or for a
      // channel that declares none a region and a language - owner decision 11-11, Build #223) and a category, so
      // every public list can place the creator.
      const approving = b.review_status === 'approved';
      if (approving || NEEDS_STRONG.includes(cr.confidence)) {
        const strong = await evidenceCount(client, cr.id, STRONG_EVIDENCE);
        const error = strong ? null
          : NEEDS_STRONG.includes(cr.confidence)
            ? `Confidence ${cr.confidence} needs strong evidence (platform badge, cross-link, official website or creator confirmation) for a linked account; a creator selected on a reviewer decision stays PROVISIONAL`
            : !(await evidenceCount(client, cr.id, SELECTION_EVIDENCE))
              ? 'Needs strong evidence (platform badge, cross-link, official website or creator confirmation) or a reviewer decision with a note for a linked account'
              : null;
        if (error) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error });
        }
      }
      if (b.review_status === 'approved') {
        const { rows: [{ n: catCount }] } = await client.query(
          'SELECT count(*)::int AS n FROM creator_category_links WHERE creator_id = $1', [cr.id]);
        const problem = cr.possible_minor ? 'Possible minor: review and clear the flag first'
          : !cr.country_id && !(cr.region && cr.languages.length) ? 'Set the country, or the region and a language, first' : !catCount ? 'Set at least one category first'
            : cr.confidence === 'REQUIRES_REVIEW' ? 'Set the confidence level first' : null;
        if (problem) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: problem });
        }
      }
      if (b.review_status !== undefined && b.review_status !== cr.review_status) {
        await client.query(
          `UPDATE creators SET review_status = $2, approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE NULL END
           WHERE id = $1`, [cr.id, b.review_status]);
      }
      await client.query('COMMIT');
      return { id: cr.id, review_status: b.review_status ?? cr.review_status, confidence: cr.confidence };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Link a platform account. If the account already exists (e.g. a news publisher's channel) it is only attached
  // when the admin confirms with link_existing - an account is never silently taken from another owner.
  admin.post('/api/admin/creators/:id/accounts', async (req, reply) => {
    const b = req.body || {};
    if (!PLATFORMS.includes(b.platform)) return reply.code(400).send({ error: 'platform must be youtube, facebook or tiktok' });
    const n = normalizeSocialProfileUrl(b.platform, b.url);
    if (!n.ok) return reply.code(400).send({ error: n.error });
    if (b.evidence_kind !== undefined && !EVIDENCE.includes(b.evidence_kind)) return reply.code(400).send({ error: 'Unknown evidence_kind' });
    const ev = optionalUrl(b.evidence_url, 'evidence_url');
    if (ev.error) return reply.code(400).send({ error: ev.error });
    const noUrl = missingUrl(b.evidence_kind, ev.value) || missingNote(b.evidence_kind, b.note);
    if (noUrl) return reply.code(400).send({ error: noUrl });
    const { rows: [cr] } = await pool.query('SELECT id, review_status FROM creators WHERE id = $1', [req.params.id]);
    if (!cr) return reply.code(404).send({ error: 'Creator not found' });
    if (cr.review_status === 'merged') return reply.code(409).send({ error: 'Creator was merged' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [existing] } = await client.query(
        `SELECT sa.id, sa.creator_id, sa.publisher_id, sa.discovered_source_id, p.name AS publisher_name
         FROM social_accounts sa LEFT JOIN publishers p ON p.id = sa.publisher_id
         WHERE sa.platform = $1
           AND regexp_replace(lower(rtrim(sa.url, '/')), '^https?://(www\\.|m\\.|web\\.|mobile\\.)?', '') = lower($2)
         FOR UPDATE OF sa`,
        [b.platform, n.url.replace(/^https:\/\//, '')]
      );
      let accountId;
      if (existing) {
        if (existing.creator_id === cr.id) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: 'Already linked to this creator', account_id: existing.id });
        }
        if (existing.creator_id) {
          await client.query('ROLLBACK');
          return reply.code(409).send({ error: `Linked to creator ${existing.creator_id}`, creator_id: existing.creator_id });
        }
        if (!b.link_existing) {
          await client.query('ROLLBACK');
          return reply.code(409).send({
            error: existing.publisher_id
              ? `This account belongs to publisher ${existing.publisher_name} (${existing.publisher_id}); confirm to link it to this creator too`
              : 'This account is already known (discovery candidate); confirm to link it',
            account_id: existing.id, publisher_id: existing.publisher_id, needs_confirmation: true,
          });
        }
        await client.query('UPDATE social_accounts SET creator_id = $2, updated_at = now() WHERE id = $1', [existing.id, cr.id]);
        accountId = existing.id;
      } else {
        const { rows: [sa] } = await client.query(
          `INSERT INTO social_accounts (creator_id, platform, url, handle, platform_account_id, verification, discovered_from)
           VALUES ($1, $2, $3, $4, $5, 'unverified', $6) RETURNING id`,
          [cr.id, b.platform, n.url, n.handle, n.accountId, cleanText(b.discovered_from, 300) || 'admin']
        );
        accountId = sa.id;
      }
      if (b.evidence_kind) {
        await recordEvidence(client, cr.id, accountId, b.evidence_kind, ev.value, b.note);
      }
      await client.query('UPDATE creators SET updated_at = now() WHERE id = $1', [cr.id]);
      await client.query('COMMIT');
      return { account_id: accountId, url: n.url, linked_existing: Boolean(existing) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Unlink. A shared account goes back to its other owner; a creator-only account is removed, unless numbers were
  // already collected for it (audience_metrics / rankings keep their history).
  admin.delete('/api/admin/creators/:id/accounts/:accountId', async (req, reply) => {
    const { rows: [sa] } = await pool.query(
      `SELECT id, publisher_id, discovered_source_id,
         EXISTS (SELECT 1 FROM audience_metrics WHERE social_account_id = social_accounts.id)
           OR EXISTS (SELECT 1 FROM creator_rankings WHERE social_account_id = social_accounts.id) AS has_history
       FROM social_accounts WHERE id = $1 AND creator_id = $2`, [req.params.accountId, req.params.id]);
    if (!sa) return reply.code(404).send({ error: 'No such account on this creator' });
    if (sa.publisher_id || sa.discovered_source_id) {
      await pool.query('UPDATE social_accounts SET creator_id = NULL, updated_at = now() WHERE id = $1', [sa.id]);
      return { status: 'unlinked' };
    }
    if (sa.has_history) return reply.code(409).send({ error: 'Numbers were collected for this account; mark it rejected instead' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM creator_verifications WHERE social_account_id = $1', [sa.id]);
      await client.query('DELETE FROM social_accounts WHERE id = $1', [sa.id]);
      await client.query('COMMIT');
      return { status: 'removed' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  admin.post('/api/admin/creators/:id/evidence', async (req, reply) => {
    const b = req.body || {};
    if (!EVIDENCE.includes(b.evidence_kind)) return reply.code(400).send({ error: 'Unknown evidence_kind' });
    const { rows: [cr] } = await pool.query('SELECT id FROM creators WHERE id = $1', [req.params.id]);
    if (!cr) return reply.code(404).send({ error: 'Creator not found' });
    if (b.social_account_id !== undefined && b.social_account_id !== null) {
      const { rows } = await pool.query('SELECT 1 FROM social_accounts WHERE id = $1 AND creator_id = $2', [b.social_account_id, cr.id]);
      if (!rows.length) return reply.code(400).send({ error: 'social_account_id is not linked to this creator' });
    }
    const ev = optionalUrl(b.evidence_url, 'evidence_url');
    if (ev.error) return reply.code(400).send({ error: ev.error });
    const noUrl = missingUrl(b.evidence_kind, ev.value) || missingNote(b.evidence_kind, b.note);
    if (noUrl) return reply.code(400).send({ error: noUrl });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const id = await recordEvidence(client, cr.id, b.social_account_id ?? null, b.evidence_kind, ev.value, b.note);
      await client.query('COMMIT');
      return { id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Merge a duplicate into the creator that stays: accounts, categories and evidence move; the duplicate is kept
  // as 'merged' (pointing at the survivor) so old links and history still resolve.
  admin.post('/api/admin/creators/:id/merge', async (req, reply) => {
    const intoId = Number((req.body || {}).into_id);
    if (!Number.isInteger(intoId) || String(intoId) === String(req.params.id)) return reply.code(400).send({ error: 'into_id must be another creator' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'SELECT id, review_status FROM creators WHERE id = ANY($1) FOR UPDATE', [[Number(req.params.id), intoId]]);
      const from = rows.find((r) => String(r.id) === String(req.params.id));
      const into = rows.find((r) => r.id === intoId);
      if (!from || !into) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Creator not found' });
      }
      if (from.review_status === 'merged' || into.review_status === 'merged') {
        await client.query('ROLLBACK');
        return reply.code(409).send({ error: 'One of these creators is already merged' });
      }
      await client.query('UPDATE social_accounts SET creator_id = $2, updated_at = now() WHERE creator_id = $1', [from.id, into.id]);
      await client.query(
        `INSERT INTO creator_category_links (creator_id, category_id, is_primary)
         SELECT $2, category_id, false FROM creator_category_links WHERE creator_id = $1 ON CONFLICT DO NOTHING`,
        [from.id, into.id]);
      await client.query('DELETE FROM creator_category_links WHERE creator_id = $1', [from.id]);
      await client.query('UPDATE creator_verifications SET creator_id = $2 WHERE creator_id = $1', [from.id, into.id]);
      await client.query(
        `UPDATE creators SET review_status = 'merged', merged_into_id = $2, approved_at = NULL, updated_at = now() WHERE id = $1`,
        [from.id, into.id]);
      await recordEvidence(client, into.id, null, 'reviewer', null, `Merged duplicate creator ${from.id} into this one`);
      await client.query('COMMIT');
      return { status: 'merged', into_id: into.id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  admin.patch('/api/admin/creator-agents/:agent', async (req, reply) => {
    const agent = req.params.agent;
    if (!AGENT_BLOCKER[agent]) return reply.code(404).send({ error: 'Unknown agent' });
    const b = req.body || {};
    if (typeof b.paused !== 'boolean') return reply.code(400).send({ error: 'paused (true/false) is required' });
    const blocker = AGENT_BLOCKER[agent]();
    if (!b.paused && blocker) return reply.code(409).send({ error: `Cannot resume ${agent}: ${blocker}` });
    const { rows: [a] } = await pool.query(
      `UPDATE discovery_agents SET paused = $2, paused_reason = $3, updated_at = now(), updated_by = 'admin'
       WHERE agent = $1 RETURNING agent, paused, paused_reason`,
      [agent, b.paused, b.paused ? cleanText(b.reason, 300) || 'paused by admin' : null]
    );
    return a;
  });
}

async function recordEvidence(client, creatorId, accountId, kind, url, note) {
  const { rows: [v] } = await client.query(
    `INSERT INTO creator_verifications (creator_id, social_account_id, evidence_kind, evidence_url, note, recorded_by)
     VALUES ($1, $2, $3, $4, $5, 'admin') RETURNING id`,
    [creatorId, accountId, kind, cleanText(url, 500), cleanText(note, 1000)]
  );
  const verification = accountId && ACCOUNT_VERIFICATION[kind];
  if (verification) {
    // An impersonation report rejects the account, and no automatic evidence lifts that: only an explicit reviewer
    // decision does. A rejected account never counts towards approval or VERIFIED.
    await client.query(
      `UPDATE social_accounts SET verification = $2, last_checked_at = now(), updated_at = now()
       WHERE id = $1 AND (verification <> 'rejected' OR $2 = 'rejected')`,
      [accountId, verification]
    );
  } else if (accountId && kind === 'reviewer') {
    // A reviewer decision clears an impersonation report but verifies nothing by itself (Build #248): the account
    // goes back to what its other evidence shows.
    await client.query(
      `UPDATE social_accounts sa SET verification = CASE
          WHEN EXISTS (SELECT 1 FROM creator_verifications v WHERE v.social_account_id = sa.id
                         AND v.evidence_kind IN ('platform_badge', 'cross_link', 'creator_confirmed')) THEN 'verified'
          WHEN EXISTS (SELECT 1 FROM creator_verifications v WHERE v.social_account_id = sa.id
                         AND v.evidence_kind = 'official_website') THEN 'linked_from_site'
          ELSE 'unverified' END,
         last_checked_at = now(), updated_at = now()
       WHERE sa.id = $1 AND sa.verification = 'rejected'`,
      [accountId]
    );
  }
  return v.id;
}

async function evidenceCount(client, creatorId, kinds) {
  const { rows: [ev] } = await client.query(
    `SELECT count(*)::int AS n FROM creator_verifications v JOIN social_accounts sa ON sa.id = v.social_account_id
     WHERE v.creator_id = $1 AND sa.creator_id = $1 AND v.evidence_kind = ANY($2) AND sa.verification <> 'rejected'`,
    [creatorId, kinds]);
  return ev.n;
}

module.exports = { registerCreatorAdminRoutes, STRONG_EVIDENCE };
