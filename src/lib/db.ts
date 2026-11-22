import 'server-only';
import { after } from 'next/server';
import { MongoClient, type Db, type Collection, type ObjectId } from 'mongodb';
import type { RsvpContact } from './wedding';

/* ---------- document shapes ---------- */

export type Role = 'super' | 'admin';

export type UserDoc = {
  _id: ObjectId;
  username: string;
  usernameLower: string;
  passwordHash: string;
  role: Role;
  active: boolean;
  createdAt: Date;
  createdBy?: ObjectId | null;
  lastLoginAt?: Date | null;
};

export type SessionDoc = {
  _id: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  createdAt: Date;
  expiresAt: Date;
};

/** A one-time link: "join" creates an admin, "reset" sets a new password for an existing one. */
export type InviteDoc = {
  _id: ObjectId;
  tokenHash: string;
  purpose: 'join' | 'reset';
  role: Role;
  userId?: ObjectId | null;
  createdBy: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date | null;
  usedBy?: ObjectId | null;
  revokedAt?: Date | null;
};

export type SendRecord = { at: Date; by: ObjectId; byName: string };
export type SmsRecord = SendRecord & {
  status: 'sent' | 'delivered' | 'failed';
  messageId?: string | null;
  error?: string | null;
  cost?: string | null;
};

export type GuestDoc = {
  _id: ObjectId;
  name: string;
  phone: string; // E.164, e.g. +256772123456
  seats: number;
  code: string; // the random part of the personal link
  slug: string; // the readable part of the personal link
  createdAt: Date;
  createdBy: ObjectId;
  updatedAt: Date;
  whatsapp?: SendRecord | null;
  sms?: SmsRecord | null;
  /** "Viewed": the invitation loaded on the guest's screen (counted from the browser, see /api/open) */
  opens?: { count: number; firstAt: Date; lastAt: Date } | null;
  /** the invitation downloaded as a PDF (see /i/<link>/pdf) */
  pdf?: { count: number; firstAt: Date; lastAt: Date } | null;
};

export type SettingsDoc = {
  _id: 'site';
  rsvpContacts: RsvpContact[];
  whatsappMessage: string;
  smsMessage: string;
  smsEnabled: boolean;
  updatedAt: Date;
  updatedBy?: ObjectId | null;
};

export type ActivityDoc = {
  _id?: ObjectId;
  at: Date;
  userId: ObjectId | null;
  username: string;
  action: string;
  details?: Record<string, unknown>;
};

export type RateDoc = { _id: string; count: number; expiresAt: Date };

/** One thing a guest did with their invitation, for the history on their page in the dashboard. */
export type GuestEventDoc = {
  _id?: ObjectId;
  guestId: ObjectId;
  type: 'view' | 'pdf';
  at: Date;
  device: string; // e.g. "Android phone", "iPhone", "Windows computer"
};

/** One document, rewritten by every /api/health call, so the check is a real write + read. */
export type HealthDoc = { _id: 'heartbeat'; count: number; lastAt: Date; firstAt: Date };

/* ---------- connection (one client per server process) ---------- */

const g = globalThis as unknown as { _mongo?: Promise<MongoClient>; _indexes?: Promise<void>; _dbFailure?: { at: number; error: unknown } };

/** How long to wait for the database before giving up (the driver's default is 30 s). */
const DB_TIMEOUT_MS = 7000;

/** The last time this server failed to connect, so /api/health can explain it at once. */
export function lastDbFailure(maxAgeMs: number): unknown {
  const f = g._dbFailure;
  return f && Date.now() - f.at < maxAgeMs ? f.error : null;
}

function client(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const error = new Error('MONGODB_URI is not set (see .env.example)');
    g._dbFailure = { at: Date.now(), error };
    return Promise.reject(error);
  }
  if (!g._mongo) {
    let mongo: MongoClient;
    try {
      mongo = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: DB_TIMEOUT_MS, connectTimeoutMS: DB_TIMEOUT_MS });
    } catch (error) {
      g._dbFailure = { at: Date.now(), error }; // e.g. a malformed MONGODB_URI
      return Promise.reject(error);
    }
    // forget a failed connection so the next request tries again instead of failing forever
    g._mongo = mongo.connect().then(
      (c) => { g._dbFailure = undefined; return c; },
      (error) => { g._mongo = undefined; g._dbFailure = { at: Date.now(), error }; void mongo.close().catch(() => {}); throw error; },
    );
  }
  return g._mongo;
}

/** Bump this after changing the list below, so every server creates the new indexes once. */
const INDEXES_VERSION = 2;

async function ensureIndexes(db: Db) {
  // one quick read instead of 8 createIndex calls on every cold start
  const meta = db.collection<{ _id: string; version: number; at: Date }>('meta');
  if ((await meta.findOne({ _id: 'indexes' }))?.version === INDEXES_VERSION) return;
  await Promise.all([
    db.collection('users').createIndex({ usernameLower: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('invites').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('guests').createIndex({ code: 1 }, { unique: true }),
    db.collection('guests').createIndex({ phone: 1 }),
    db.collection('activity').createIndex({ at: -1 }),
    db.collection('rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('guest_events').createIndex({ guestId: 1, at: -1 }),
    db.collection('guest_events').createIndex({ at: -1 }),
  ]);
  await meta.updateOne({ _id: 'indexes' }, { $set: { version: INDEXES_VERSION, at: new Date() } }, { upsert: true });
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db();
  // Indexes are created after the response has been sent: they already exist after the first run, and
  // creating them up front added 3–4 s to every cold start (and made /api/health time out).
  // On failure, the next request tries again.
  if (!g._indexes) {
    const run = () => ensureIndexes(db).catch((e) => { g._indexes = undefined; console.error('[db] creating indexes failed:', e); });
    g._indexes = new Promise<void>((resolve) => {
      try { after(() => run().then(resolve)); } catch { void run().then(resolve); } // outside a request: run now
    });
  }
  return db;
}

export async function col<T extends keyof Collections>(name: T): Promise<Collection<Collections[T]>> {
  return (await getDb()).collection<Collections[T]>(name);
}

type Collections = {
  users: UserDoc;
  sessions: SessionDoc;
  invites: InviteDoc;
  guests: GuestDoc;
  settings: SettingsDoc;
  activity: ActivityDoc;
  rate_limits: RateDoc;
  guest_events: GuestEventDoc;
  health: HealthDoc;
};
