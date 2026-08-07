#!/usr/bin/env node
/**
 * Private-beta account seeder.
 * =============================
 * FinTechAI is a closed beta: there is no /register route, so every account is
 * created here. Run it as often as you like — it is idempotent.
 *
 *   node backend/scripts/seedUsers.js            # apply
 *   node backend/scripts/seedUsers.js --dry-run  # show what would change
 *
 * ── Password policy ──────────────────────────────────────────────────────────
 * This script NEVER writes a password you chose, and never prints one.
 *
 *   • Existing account  → password hash is left completely untouched. The roster
 *                         only promotes/demotes `role` and flips `isActive`.
 *                         This is what keeps an owner account whose password
 *                         nobody remembers working exactly as before.
 *   • New account       → created with a 48-byte cryptographically random
 *                         password that is hashed and then discarded. Nobody —
 *                         including whoever runs this script — ever learns it,
 *                         so the account is unusable until an operator sets a
 *                         real password:
 *
 *                             node backend/scripts/setPassword.js <email>
 *
 * That is deliberate: it means no plaintext credential exists in source control,
 * in .env, in shell history, in CI logs, or in this file.
 *
 * ── Roster ───────────────────────────────────────────────────────────────────
 * The roster below contains NO secrets — only email, username and role — so it
 * is safe in git. It is the single source of truth for who may sign in; anyone
 * in the database but absent here is deactivated (not deleted).
 */

require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

const env = require('../config/env');
const User = require('../models/User');

// ── Roster ───────────────────────────────────────────────────────────────────
// Edit this list to add or remove a tester, then re-run the script.
const ROSTER = [
  { email: 'poorvanshnandwar145@gmail.com', username: 'Vansh45',    role: 'owner' },
  { email: 'akarshj866@gmail.com',          username: 'Bhandari09', role: 'owner' },
  { email: 'friend1@gmail.com',             username: 'beta_one',   role: 'beta'  },
  { email: 'friend2@gmail.com',             username: 'beta_two',   role: 'beta'  },
  { email: 'friend3@gmail.com',             username: 'beta_three', role: 'beta'  },
  { email: 'demo@fintechai.app',            username: 'demo',       role: 'demo'  },
];

/** Accounts to remove outright rather than deactivate (throwaway test data). */
const PURGE = ['testuser@example.com', 'uniqueemail123@example.com'];

const DRY_RUN = process.argv.includes('--dry-run');

/** Unguessable placeholder. Hashed by the model's pre-save hook, then dropped. */
function throwawayPassword() {
  return crypto.randomBytes(48).toString('base64url');
}

async function main() {
  await mongoose.connect(env.mongoUri);
  console.log(`[seed] connected to ${mongoose.connection.name}${DRY_RUN ? '  (DRY RUN — no writes)' : ''}`);

  const rosterEmails = ROSTER.map((u) => u.email.toLowerCase().trim());
  const created = [];
  const updated = [];
  const unchanged = [];

  for (const entry of ROSTER) {
    const email = entry.email.toLowerCase().trim();
    const existing = await User.findOne({ email });

    if (existing) {
      // Never touch `password` here — see the policy note at the top.
      const changes = {};
      if (existing.role !== entry.role) changes.role = entry.role;
      if (existing.isActive !== true) changes.isActive = true;

      if (Object.keys(changes).length === 0) {
        unchanged.push(`${email} (${existing.role})`);
        continue;
      }
      if (!DRY_RUN) {
        Object.assign(existing, changes);
        await existing.save({ validateModifiedOnly: true });
      }
      updated.push(`${email}: ${JSON.stringify(changes)}`);
      continue;
    }

    if (!DRY_RUN) {
      await User.create({
        username: entry.username,
        email,
        password: throwawayPassword(), // hashed by pre-save hook, never logged
        role: entry.role,
        isActive: true,
      });
    }
    created.push(`${email} (${entry.role})`);
  }

  // Anyone not on the roster loses access but keeps their data.
  const deactivateFilter = { email: { $nin: [...rosterEmails, ...PURGE] }, isActive: { $ne: false } };
  const toDeactivate = await User.find(deactivateFilter).select('email');
  if (!DRY_RUN && toDeactivate.length) {
    await User.updateMany(deactivateFilter, { $set: { isActive: false } });
  }

  const purgeFilter = { email: { $in: PURGE } };
  const toPurge = await User.find(purgeFilter).select('email');
  if (!DRY_RUN && toPurge.length) {
    await User.deleteMany(purgeFilter);
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const line = (label, items) => {
    console.log(`\n[seed] ${label} (${items.length})`);
    items.forEach((i) => console.log(`         ${i}`));
  };

  line('created', created);
  line('updated', updated);
  line('unchanged', unchanged);
  line('deactivated', toDeactivate.map((u) => u.email));
  line('purged', toPurge.map((u) => u.email));

  if (created.length) {
    console.log(
      `\n[seed] ${created.length} new account(s) have an unusable random password.` +
      `\n       Set a real one before handing them out:\n`
    );
    created.forEach((c) => console.log(`         node backend/scripts/setPassword.js ${c.split(' ')[0]}`));
  }

  await mongoose.disconnect();
  console.log('\n[seed] done.');
}

main().catch(async (err) => {
  console.error('[seed] FAILED:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
