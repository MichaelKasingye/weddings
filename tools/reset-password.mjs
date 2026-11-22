#!/usr/bin/env node
/**
 * Sets a new password for any admin, straight in the database. For when the super admin is locked out
 * (or the website is down). Run it on a computer that has this project and the database address:
 *
 *   npm run reset-password              → the super admin
 *   npm run reset-password -- Michael   → that username
 *
 * MONGODB_URI comes from the environment, or else from .env.local / .env. To reset the live site's
 * password, use the same MONGODB_URI as in Vercel. You are asked for the new password twice (hidden).
 * Every device that was logged in as that admin is logged out.
 */
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MongoClient } from 'mongodb';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvFile(name) {
  const file = join(root, name);
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/* Same format as hashPassword() in src/lib/crypto.ts: "scrypt$N$r$p$salt$hash". Keep the two in step. */
const N = 16384, R = 8, P = 1, LEN = 64;
async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await promisify(scrypt)(password, salt, LEN, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64url'), hash.toString('base64url')].join('$');
}

/** Asks a question; with hidden=true the typing isn't shown. Works with piped input too. */
function makeAsker() {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const lines = [];
  const waiting = [];
  rl.on('line', (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)));
  let hide = false;
  const write = rl._writeToOutput?.bind(rl);
  if (write) rl._writeToOutput = (s) => write(hide && !s.startsWith('\r\n') && s !== '\n' ? '' : s);
  const ask = (q, hidden = false) =>
    new Promise((resolve) => {
      process.stdout.write(q);
      hide = hidden && process.stdin.isTTY;
      const done = (l) => { if (hide) process.stdout.write('\n'); hide = false; resolve(l); };
      lines.length ? done(lines.shift()) : waiting.push(done);
    });
  return { ask, close: () => rl.close() };
}

async function main() {
  const env = { ...readEnvFile('.env'), ...readEnvFile('.env.local'), ...process.env };
  const uri = env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set (in the environment, .env.local or .env).');

  const wanted = process.argv[2]?.trim();
  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 10000 }).connect();
  const { ask, close } = makeAsker();
  try {
    const db = client.db();
    const users = db.collection('users');
    const user = wanted
      ? await users.findOne({ usernameLower: wanted.toLowerCase() })
      : await users.findOne({ role: 'super', active: true }, { sort: { createdAt: 1 } });

    if (!user) {
      const all = await users.find({}, { projection: { username: 1, role: 1, active: 1 } }).toArray();
      console.error(wanted ? `No admin called “${wanted}”.` : 'There is no super admin yet: open /setup on the website instead.');
      if (all.length) console.error('Admins in this database: ' + all.map((u) => `${u.username} (${u.role}${u.active ? '' : ', removed'})`).join(', '));
      process.exitCode = 1;
      return;
    }

    console.log(`Database: ${db.databaseName}`);
    console.log(`Setting a new password for ${user.username} (${user.role === 'super' ? 'super admin' : 'admin'}${user.active ? '' : ', removed'}).`);
    const password = await ask('New password (at least 8 characters): ', true);
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (password.length > 200) throw new Error('Password is too long.');
    if ((await ask('Repeat new password: ', true)) !== password) throw new Error('The two passwords don’t match.');

    await users.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(password) } });
    const { deletedCount } = await db.collection('sessions').deleteMany({ userId: user._id });
    await db.collection('invites').updateMany({ purpose: 'reset', userId: user._id, usedAt: null, revokedAt: null }, { $set: { revokedAt: new Date() } });
    await db.collection('rate_limits').deleteOne({ _id: 'login-user:' + user.usernameLower });
    await db.collection('activity').insertOne({ at: new Date(), userId: null, username: 'system', action: 'Password reset from the command line', details: { admin: user.username } });

    console.log(`Done. ${user.username} can log in with the new password${deletedCount ? ` (logged out on ${deletedCount} device${deletedCount === 1 ? '' : 's'})` : ''}.`);
  } finally {
    close();
    await client.close();
  }
}

main().catch((e) => {
  console.error('Error: ' + (e?.message || e));
  process.exit(1);
});
