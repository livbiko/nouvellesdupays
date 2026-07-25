# NouvellesDuPays.com — Product Requirements & Architecture (v0.1, MVP-focused)

## 1. Vision

An interactive, globe-first news aggregation platform. Instead of a homepage feed, users navigate a 3D globe, click a country, and see that country's news sources and latest headlines. Africa-first in coverage depth and visual emphasis; architecture supports every country worldwide from day one (no Africa-only hardcoding).

## 2. Why phase this, not build all 20 deliverables at once

The full spec (AI summarization, publisher portal with licensing, regional-bloc dashboards, mobile apps, monetization, fact-check integration, misinformation detection) is a multi-quarter, multi-engineer platform. Building all of it simultaneously produces shallow stubs everywhere instead of anything real. Instead:

- **Phase 1 (MVP / walking skeleton)** — this doc's main focus. Prove the core loop end-to-end: globe → country → real articles from real RSS feeds, for a handful of countries, with no AI/auth/monetization.
- **Phase 2** — expand country/publisher coverage, add search/filter, add favorites + accounts.
- **Phase 3** — AI features (summarization, dedup, categorization, translation), publisher onboarding portal.
- **Phase 4** — regional dashboards, mobile apps, monetization, fact-check integrations, misinformation indicators.

Each later phase gets its own design doc once we're actually there — writing detailed LLDs for AI microservices or mobile apps now, before the core loop works, would be speculative and likely wrong once real constraints show up.

## 3. Phase 1 scope (what we're actually building first)

**In scope:**
- Interactive globe (rotate/zoom/click) as the landing page.
- 5 pilot countries to start: Côte d'Ivoire, Nigeria, Kenya, South Africa, Senegal — chosen for RSS feed availability and geographic spread across West/East/Southern Africa. Easy to add more once the pipeline works.
- Real RSS/Atom ingestion for each pilot country's major outlets (discovered and validated, not hardcoded blindly).
- Country profile panel: flag, capital, population, current time, basic map.
- Article list per country: headline, summary, image, source, published date, link to original (we never rehost full article content — traffic goes to the publisher).
- Dark mode, responsive (desktop/tablet/mobile).
- Basic category tagging (rule-based from feed metadata, not AI yet).

**Explicitly out of scope for Phase 1:** AI features, user accounts/favorites, publisher onboarding portal, multilingual UI, search, admin dashboard, mobile apps, monetization, non-pilot countries. All real, all deferred, all listed in section 8.

## 4. Tech stack (Phase 1)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 + React + TypeScript | SSR/SEO for article pages, file-based routing, huge ecosystem |
| Globe | `react-globe.gl` (Three.js wrapper) | Purpose-built for exactly this (clickable countries, arcs, points), far less custom WebGL code than raw Three.js |
| Styling | Tailwind CSS | Fast iteration, dark-mode-first utility support |
| Backend | Node.js + Fastify (not NestJS yet) | Fastify is lighter for a Phase-1 API surface that's mostly "list feeds for country X"; NestJS's DI/module ceremony pays off more once we have real microservices (Phase 3 AI split) — premature now |
| Database | PostgreSQL | Relational fit for Country/Publisher/Feed/Article; `pg_trgm` covers basic search later without needing Elasticsearch yet |
| Feed polling | Node cron worker (`node-cron` + a queue table), not Kafka/RabbitMQ | Polling ~30-50 feeds every few minutes doesn't need a message broker; revisit if publisher count grows into the hundreds |
| Caching | Redis | Feed-fetch dedup locks, hot country/article list caching |
| Hosting | OCI (same tenancy/patterns as the Tekeche project) | Team already has working OCI Terraform patterns (VCN, LB, OKE) to reuse rather than learning a new cloud |
| Deployment | Docker containers, plain OCI Compute + LB first — not Kubernetes yet | One frontend service + one API service + one worker does not justify OKE's operational overhead at Phase 1 scale; revisit at Phase 4 |

Deliberately **not** using Elasticsearch/OpenSearch, Kubernetes, or Python AI microservices in Phase 1 — all real Phase 3/4 needs, premature today per the "don't design for hypothetical future requirements" principle.

## 5. Data model (Phase 1)

```
Country
  id, iso_code, name, region, capital, population, languages[], timezone, flag_url, lat, lng

Publisher
  id, country_id, name, homepage_url, logo_url, feed_status (active|unavailable|pending), language

Feed
  id, publisher_id, feed_url, feed_type (rss|atom), last_fetched_at, last_status, etag/last_modified (for polite polling)

Article
  id, feed_id, publisher_id, country_id, headline, summary, image_url, original_url,
  author, category (rule-based enum for now), published_at, fetched_at,
  dedup_hash (normalized headline+publisher, prevents re-storing same item on re-poll)

Category (enum for Phase 1, not its own table yet)
  politics | business | technology | sports | health | entertainment | other
```

No `User`/`Favorite`/`License` tables yet — Phase 2.

## 6. Feed aggregation pipeline (Phase 1)

1. **Discovery** (manual + assisted, per pilot publisher): check `/feed`, `/rss`, `<link rel="alternate" type="application/rss+xml">` in homepage HTML. Record result in `Publisher.feed_status`.
2. **No feed found** → mark `feed_status = 'unavailable'`. Phase 1 does **not** build the outreach-email/publisher-portal workflow yet (that's Phase 3, once we have more than a handful of publishers to manage) — for Phase 1's ~25-30 pilot-country outlets, a human just checks manually. No scraping under any circumstances, feed or nothing.
3. **Polling worker**: every 5 minutes, fetch each active feed (conditional GET via ETag/Last-Modified to be a polite crawler), parse RSS/Atom, upsert articles by `dedup_hash`, discard items with `published_at` older than a rolling 14-day window.
4. **Rule-based categorization**: match feed-provided `<category>` tags and a keyword fallback list against the fixed enum. AI-based categorization is Phase 3.

## 7. API surface (Phase 1)

```
GET  /api/countries                    list all countries (globe markers)
GET  /api/countries/:iso               country profile
GET  /api/countries/:iso/articles      paginated articles for a country
GET  /api/countries/:iso/publishers    publishers for a country
GET  /api/articles/:id                 single article detail (links out to original)
```

No auth required for Phase 1 (no accounts yet). Rate-limited at the LB layer regardless (basic abuse protection, not full OWASP hardening — that's a real Phase 2+ item once there's an admin/auth surface worth attacking).

## 8. Explicitly deferred (real items, not forgotten — just sequenced)

- AI: summarization, dedup-by-similarity, translation, misinformation indicators, trend clustering, recommendations.
- Publisher Onboarding Portal (self-serve registration, domain verification, licensing, analytics for publishers).
- Accounts, favorites, personalized feeds.
- Search (keyword/person/company/topic) — needs at minimum `pg_trgm`, likely Elasticsearch once article volume is real.
- Admin dashboard (moderation, crawler status, roles/permissions).
- Regional bloc dashboards (ECOWAS/SADC/EAC/COMESA/AU).
- Multilingual UI (French is the natural second language given Côte d'Ivoire's presence in the pilot set; Arabic/Portuguese/Swahili later).
- Mobile apps (Android/iOS).
- Monetization (subscriptions, sponsored content, publisher revenue share).
- Fact-check integrations.
- Full worldwide country coverage beyond the 5 pilots.
- Kubernetes, Elasticsearch, message queues, Python AI microservices, OAuth2/OIDC/MFA/RBAC, WAF/DDoS protection, structured SEO markup — all real, all sequenced into Phase 2-4 as the platform actually needs them.

## 9. Open questions (need answers before/during Phase 1 build)

1. Domain confirmed: `nouvellesdupays.com`. Is it already registered? Under which registrar/account?
2. OCI tenancy: reuse the existing Tekeche/Livbiko OCI tenancy (same compartment patterns), or a separate tenancy for billing isolation?
3. Pilot country outlets — do you want to pick the specific ~5-6 sources per pilot country, or should the first build pass propose a list (based on discoverable RSS feeds) for you to approve before wiring them in?

## 10. Phase 1 build order

1. Repo scaffold (Next.js frontend + Fastify backend + Postgres, Docker Compose for local dev).
2. DB schema + migrations for Country/Publisher/Feed/Article.
3. Seed the 5 pilot countries + their publishers/feeds (pending Q3 above).
4. Feed polling worker, running against real feeds.
5. API endpoints (section 7).
6. Globe UI wired to `/api/countries`, click-through to country panel + article list.
7. Deploy: single OCI Compute instance or small LB-fronted pair, reusing Terraform patterns from `tekeche/ops/oci`.
