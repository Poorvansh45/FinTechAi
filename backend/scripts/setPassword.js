#!/usr/bin/env node
/**
 * Set a private-beta account's password, locally and interactively.
 * =================================================================
 *
 *   node backend/scripts/setPassword.js <email>
 *
 * The password is typed at a hidden prompt and confirmed. It is never taken
 * from argv (visible in `ps` and shell history), never from an environment
 * variable, never echoed to the terminal, and never logged. Only the bcrypt
 * hash reaches the database, via the User model's existing pre-save hook.
 *
 * Use this to:
 *   • give a freshly seeded account its first real password
 *   • recover an account whose password nobody remembers — without anyone
 *     needing to know the old one
 */

require('dotenv').config();
const readline = require('readline');
const { Writable } = require('stream');
const mongoose = require('mongoose');

const env = require('../config/env');
const User = require('../models/User');

const MIN_LENGTH = 10; // above the model's 6-char floor: this is a shared beta

/**
 * Prompt without echoing. A muted writable swallows the terminal echo so the
 * password never appears on screen or in a scrollback buffer.
 */
function promptHidden(question) {
  return new Promise((resolve, reject) => {
    let muted = false;
    const mutedOut = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) process.stdout.write(chunk, encoding);
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutedOut,
      terminal: true,
    });

    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    rl.on('error', reject);
    muted = true; // everything after the prompt text is swallowed
  });
}

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!email) {
    console.error('Usage: node backend/scripts/setPassword.js <email>');
    process.exit(1);
  }

  if (!process.stdin.isTTY) {
    console.error(
      'This script requires an interactive terminal so the password is never\n' +
      'passed through argv, an env var, or a pipe. Run it directly in a shell.'
    );
    process.exit(1);
  }

  await mongoose.connect(env.mongoUri);

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No account found for ${email}. Run seedUsers.js first.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`Setting password for ${user.email} (role: ${user.role})`);

  const first = await promptHidden('New password: ');
  if (first.length < MIN_LENGTH) {
    console.error(`Password must be at least ${MIN_LENGTH} characters.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const second = await promptHidden('Confirm password: ');
  if (first !== second) {
    console.error('Passwords do not match. Nothing was changed.');
    await mongoose.disconnect();
    process.exit(1);
  }

  user.password = first; // hashed by the model's pre-save hook
  user.isActive = true;  // setting a password reactivates a revoked account
  await user.save();

  console.log(`Password updated for ${user.email}.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('FAILED:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
