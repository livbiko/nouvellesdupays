// Browser origins allowed to call this API. Shared by the CORS config
// (app.js) and the Origin check on public write endpoints (security.js).
const ALLOWED_ORIGINS = [
  'https://nouvellesdupays.com',
  'https://www.nouvellesdupays.com',
  'http://localhost:3000',
];

module.exports = { ALLOWED_ORIGINS };
