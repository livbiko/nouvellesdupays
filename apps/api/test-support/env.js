// Preloaded via `node --require ./test-support/env.js` (see package.json's
// "test" script) so DATABASE_URL is set before any test file (or the
// shared/db.js module it requires) runs -- this project has no dotenv/.env
// convention, and setting it here works identically regardless of which
// shell `npm test` is invoked from (PowerShell, bash, cmd all differ on
// inline env-var syntax). Lives outside test/ deliberately: Node's test
// runner auto-discovers any *.js file directly under a directory literally
// named "test", which would otherwise pick this up and try to run it as a
// test file itself.
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://nouvellesdupays:changeme@localhost:5432/nouvellesdupays_test';
}
