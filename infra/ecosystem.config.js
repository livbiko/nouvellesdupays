// On-prem (BikoDC) PM2 config for nouvellesdupays.com's on-prem failover
// leg, added 2026-07-30. Deliberately does NOT run apps/worker here -- the
// RSS poller runs every 5 min in OKE (the primary) and running it on both
// legs would double-ingest articles into the shared (streaming-replicated)
// database. This leg is api+web only, serving reads off the Postgres
// streaming replica at localhost:5432 (see nouvellesdupays-replica).
module.exports = {
  apps: [
    {
      name: 'nouvellesdupays-api',
      script: 'apps/api/src/index.js',
      cwd: 'C:\\inetpub\\wwwroot\\nouvellesdupays',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: 'postgres://nouvellesdupays:hgVJ4CK3puPbqnkIec7YLRO2@localhost:5432/nouvellesdupays',
      },
      error_file: 'C:\\logs\\nouvellesdupays-api-error.log',
      out_file:   'C:\\logs\\nouvellesdupays-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'nouvellesdupays-web',
      script: '.next/standalone/server.js',
      cwd: 'C:\\inetpub\\wwwroot\\nouvellesdupays\\apps\\web',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3400,
        HOSTNAME: '0.0.0.0',
        // NEXT_PUBLIC_API_URL is baked in at build time, not read at runtime --
        // apps/web/.env.local had 'http://localhost:4000' during this build,
        // which happens to be correct here (api+web collocated on BikoDC),
        // unlike OKE where web/api are separate pods needing a different value.
      },
      error_file: 'C:\\logs\\nouvellesdupays-web-error.log',
      out_file:   'C:\\logs\\nouvellesdupays-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
