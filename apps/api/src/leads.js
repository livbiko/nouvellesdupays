const { CATEGORIES } = require('@nouvellesdupays/shared/src/categories');
const { cleanText, cleanEmail, hashEmail, isUuid, spamCheck, rejectForeignOrigin, requireJson } = require('./security');
const { recordServerConversion, cleanAttribution } = require('./tracking');

// Visitor registration ("Rejoindre NouvellesDuPays") and the contact form.
//
// The site had no visitor account system before this change, so a
// registration is a consented sign-up (email + optional name, country and
// interests), which is the "lead" a Meta campaign optimises for. It is not
// a password account -- if/when real accounts are added, `leads` is the
// natural table to link them to.

const INTERESTS = [...CATEGORIES.filter((c) => c !== 'other'), 'videos', 'local_voices'];

function registerLeadRoutes(fastify) {
  const pool = fastify.pg;
  const writeGuards = [rejectForeignOrigin, requireJson];

  fastify.post(
    '/api/leads',
    { preHandler: writeGuards, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const body = req.body || {};
      const spam = spamCheck(body);
      if (spam) {
        req.log.warn({ reason: spam }, 'lead rejected by spam check');
        return reply.code(400).send({ error: 'Submission rejected', reason: spam });
      }

      const email = cleanEmail(body.email);
      if (!email) return reply.code(400).send({ error: 'A valid email address is required' });
      if (body.privacy_accepted !== true) {
        return reply.code(400).send({ error: 'You must accept the privacy policy to register' });
      }
      const name = cleanText(body.name, 120);
      const interests = Array.isArray(body.interests)
        ? [...new Set(body.interests.filter((i) => INTERESTS.includes(i)))]
        : [];

      let countryId = null;
      let countryIso = null;
      if (body.country_iso) {
        const { rows } = await pool.query('SELECT id, iso_code FROM countries WHERE iso_code = $1', [String(body.country_iso).toUpperCase().slice(0, 2)]);
        if (rows.length === 0) return reply.code(400).send({ error: 'Unknown country' });
        countryId = rows[0].id;
        countryIso = rows[0].iso_code;
      }

      let videoId = null;
      if (body.video_slug) {
        const { rows } = await pool.query(
          `SELECT id FROM youtube_videos WHERE slug = $1 AND status = 'approved'`,
          [String(body.video_slug).slice(0, 80)]
        );
        videoId = rows[0]?.id || null;
      }

      const tracking = body.tracking && typeof body.tracking === 'object' ? body.tracking : null;
      const hasConsent = tracking && tracking.consent?.analytics === true;
      const attribution = hasConsent ? cleanAttribution(tracking.session) : {};

      const { rows } = await pool.query(
        `INSERT INTO leads (email, email_hash, name, country_id, interests, marketing_consent, privacy_accepted_at,
           source_page, video_id, visitor_id, session_id, utm_source, utm_medium, utm_campaign, utm_content)
         VALUES ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (email_hash) DO NOTHING
         RETURNING id`,
        [
          email, hashEmail(email), name, countryId, interests, body.marketing_consent === true,
          cleanText(body.source_page, 300), videoId,
          hasConsent && isUuid(tracking.visitor_id) ? tracking.visitor_id : null,
          hasConsent && isUuid(tracking.session_id) ? tracking.session_id : null,
          attribution.utm_source || null, attribution.utm_medium || null, attribution.utm_campaign || null, attribution.utm_content || null,
        ]
      );

      // Same response either way; a repeat sign-up is not a new conversion,
      // so no RegistrationCompleted event is recorded for it.
      let eventId = null;
      if (rows.length > 0) {
        eventId = await recordServerConversion(pool, req, tracking, {
          name: 'RegistrationCompleted',
          country_iso: countryIso,
          video_id: videoId,
          email,
          properties: { form: body.form_id ? cleanText(body.form_id, 40) : 'registration' },
        });
      }
      return reply.code(201).send({
        status: 'registered',
        message: 'Merci ! Votre inscription est confirmée.',
        conversion_event_id: eventId,
        new_registration: rows.length > 0,
      });
    }
  );

  fastify.post(
    '/api/contact',
    { preHandler: writeGuards, config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const body = req.body || {};
      const spam = spamCheck(body);
      if (spam) return reply.code(400).send({ error: 'Submission rejected', reason: spam });

      const name = cleanText(body.name, 120);
      const email = cleanEmail(body.email);
      const subject = cleanText(body.subject, 200);
      const message = cleanText(body.message, 5000);
      if (!name || !email || !message) {
        return reply.code(400).send({ error: 'name, a valid email and message are required' });
      }
      if (message.length < 10) return reply.code(400).send({ error: 'Message is too short' });

      const tracking = body.tracking && typeof body.tracking === 'object' ? body.tracking : null;
      const hasConsent = tracking && tracking.consent?.analytics === true;
      await pool.query(
        `INSERT INTO contact_messages (name, email, subject, message, visitor_id, session_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [name, email, subject, message,
          hasConsent && isUuid(tracking.visitor_id) ? tracking.visitor_id : null,
          hasConsent && isUuid(tracking.session_id) ? tracking.session_id : null]
      );
      const eventId = await recordServerConversion(pool, req, tracking, { name: 'ContactSubmitted', email, properties: {} });
      return reply.code(201).send({ status: 'received', conversion_event_id: eventId });
    }
  );
}

module.exports = { registerLeadRoutes, INTERESTS };
