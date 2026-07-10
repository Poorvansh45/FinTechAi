// ─────────────────────────────────────────────────────────────────────────────
// Backend smoke tests — "does the app still boot?"
// Uses Node's built-in test runner (node --test), so no extra dependencies.
// Does NOT require MongoDB, JWT secrets, or any external API.
// ─────────────────────────────────────────────────────────────────────────────

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

// A dummy secret so config/env.js does not warn/throw during import in tests.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-for-production-use';
process.env.NODE_ENV = 'test';

// Importing server.js exports the Express app WITHOUT listening (require.main guard).
const app = require('../server');

test('config/env loads with a JWT secret set', () => {
  const env = require('../config/env');
  assert.ok(env.jwtSecret, 'jwtSecret should be defined');
  assert.strictEqual(typeof env.port, 'number');
});

test('GET /health returns 200 and healthy status', async () => {
  const server = app.listen(0); // ephemeral port, no fixed binding
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/health`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'healthy');
    assert.ok('db' in body, 'health payload should report db state');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('production refuses to start without JWT_SECRET (Phase 4 hardening)', () => {
  const envPath = path.join(__dirname, '..', 'config', 'env.js');
  // Run from a directory with no .env so dotenv cannot repopulate JWT_SECRET
  // from a developer's local backend/.env (CI has no .env file at all).
  const script =
    `process.env.NODE_ENV = 'production';` +
    `delete process.env.JWT_SECRET;` +
    `require(${JSON.stringify(envPath)});`;
  assert.throws(
    () => {
      execFileSync(process.execPath, ['-e', script], {
        stdio: 'pipe',
        cwd: os.tmpdir(),
      });
    },
    /JWT_SECRET is not set/,
    'env.js must throw in production when JWT_SECRET is missing',
  );
});
