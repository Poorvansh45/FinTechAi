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

// ── M-8 · MONGODB_URI must fail closed in production ─────────────────────────
// Same shape as the JWT_SECRET guard above: a subprocess run from a directory
// with no .env, so dotenv cannot repopulate the value from a local backend/.env.

test('production refuses to start without MONGODB_URI (M-8)', () => {
  const envPath = path.join(__dirname, '..', 'config', 'env.js');
  const script =
    `process.env.NODE_ENV = 'production';` +
    `process.env.JWT_SECRET = 'x'.repeat(40);` +   // isolate the Mongo guard
    `delete process.env.MONGODB_URI;` +
    `delete process.env.MONGO_URI;` +
    `require(${JSON.stringify(envPath)});`;
  assert.throws(
    () => {
      execFileSync(process.execPath, ['-e', script], { stdio: 'pipe', cwd: os.tmpdir() });
    },
    /MONGODB_URI is not set/,
    'env.js must throw in production when no Mongo URI is configured',
  );
});

test('production starts when MONGODB_URI IS set (M-8 does not over-fire)', () => {
  const envPath = path.join(__dirname, '..', 'config', 'env.js');
  const script =
    `process.env.NODE_ENV = 'production';` +
    `process.env.JWT_SECRET = 'x'.repeat(40);` +
    `process.env.MONGODB_URI = 'mongodb://example.invalid:27017/finai_edge';` +
    `const e = require(${JSON.stringify(envPath)});` +
    `if (!e.mongoUri.includes('example.invalid')) { throw new Error('wrong uri'); }`;
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ['-e', script], { stdio: 'pipe', cwd: os.tmpdir() });
  }, 'env.js must load in production once a Mongo URI is provided');
});

test('development keeps the localhost fallback (M-8 is production-only)', () => {
  const envPath = path.join(__dirname, '..', 'config', 'env.js');
  const script =
    `process.env.NODE_ENV = 'development';` +
    `delete process.env.MONGODB_URI;` +
    `delete process.env.MONGO_URI;` +
    `const e = require(${JSON.stringify(envPath)});` +
    `if (e.mongoUri !== 'mongodb://localhost:27017/finai_edge') {` +
    `  throw new Error('local fallback changed: ' + e.mongoUri);` +
    `}`;
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ['-e', script], { stdio: 'pipe', cwd: os.tmpdir() });
  }, 'local development must keep the unchanged localhost fallback');
});

// ── M-2 · 5xx must not leak internal exception text in production ────────────
// errorHandler is a pure function of (err, req, res), so it is exercised
// directly with a fake res — no server, no MongoDB, no environment mutation
// beyond the module reload each case needs.

function runErrorHandler({ production, err }) {
  const path = require.resolve('../middleware/errorHandler');
  const envPath = require.resolve('../config/env');
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = production ? 'production' : 'development';
  delete require.cache[path];
  delete require.cache[envPath];
  const { errorHandler } = require(path);

  let captured = { status: null, body: null };
  const res = {
    status(s) { captured.status = s; return this; },
    json(b) { captured.body = b; return this; },
  };
  errorHandler(err, {}, res, () => {});

  process.env.NODE_ENV = prevEnv;
  delete require.cache[path];
  delete require.cache[envPath];
  return captured;
}

test('production 500 does not leak the internal exception message (M-2)', () => {
  const leaky = new Error(
    'MongooseError: connect ECONNREFUSED mongodb+srv://appuser@cluster0.abc.mongodb.net/finai_edge',
  );
  const out = runErrorHandler({ production: true, err: leaky });

  assert.strictEqual(out.status, 500);
  assert.strictEqual(out.body.error, 'Internal Server Error');
  const serialized = JSON.stringify(out.body);
  for (const secret of ['mongodb+srv', 'cluster0', 'appuser', 'ECONNREFUSED']) {
    assert.ok(!serialized.includes(secret), `500 body leaked "${secret}": ${serialized}`);
  }
  assert.ok(!('stack' in out.body), 'stack must never be sent in production');
});

test('development 500 keeps the real message and stack (M-2)', () => {
  const out = runErrorHandler({ production: false, err: new Error('boom-detail') });
  assert.strictEqual(out.status, 500);
  assert.strictEqual(out.body.error, 'boom-detail');
  assert.ok(out.body.stack, 'developers still need the stack locally');
});

test('production 4xx messages are unchanged — API contract preserved (M-2)', () => {
  for (const [status, message] of [
    [400, 'At most 30 tickers are supported per request.'],
    [401, 'Invalid email or password'],
    [403, 'This account is not active. Nivro is currently invite-only.'],
    [409, 'This username is already taken'],
  ]) {
    const err = new Error(message);
    err.status = status;
    const out = runErrorHandler({ production: true, err });
    assert.strictEqual(out.status, status);
    assert.strictEqual(out.body.error, message, `${status} message must pass through`);
  }
});

// ── H-4 · login-specific rate limit ──────────────────────────────────────────

test('login limiter: 5 failed attempts allowed, 6th is 429 (H-4)', async () => {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    // An empty body is rejected by the controller with 400 BEFORE it touches
    // Mongo, so this runs instantly and needs no database. It still exercises
    // the limiter: skipSuccessfulRequests only skips responses < 400, so a 400
    // consumes budget exactly as a 401 would.
    const attempt = (xff) =>
      fetch(`http://127.0.0.1:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff },
        body: JSON.stringify({}),
      });

    const ip = '203.0.113.5';
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await attempt(ip)).status);
    assert.ok(statuses.every((s) => s !== 429), `first 5 must not be limited, got ${statuses}`);

    assert.strictEqual((await attempt(ip)).status, 429, '6th failed attempt must be 429');

    // Spoofing: a forged chain prepended to the real address must NOT reset the
    // bucket. trust proxy = 1 honours only the last hop, which is still 203.0.113.5.
    const spoofed = await attempt(`10.0.0.9, ${ip}`);
    assert.strictEqual(spoofed.status, 429, 'forged X-Forwarded-For must not mint a new bucket');

    // A genuinely different client is unaffected.
    const other = await attempt('203.0.113.77');
    assert.notStrictEqual(other.status, 429, 'a different client must have its own bucket');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
