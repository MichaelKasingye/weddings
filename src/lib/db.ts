import 'server-only';
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
  opens?: { count: number; firstAt: Date; lastAt: Date } | null;
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

/** One document, rewritten by every /api/health call, so the check is a real write + read. */
export type HealthDoc = { _id: 'heartbeat'; count: number; lastAt: Date; firstAt: Date };

/* ---------- connection (one client per server process) ---------- */

const g = globalThis as unknown as { _mongo?: Promise<MongoClient>; _indexes?: Promise<void> };

function client(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set (see .env.example)');
  if (!g._mongo) {
    // forget a failed connection so the next request tries again instead of failing forever
    g._mongo = new MongoClient(uri, { maxPoolSize: 10 }).connect().catch((e) => { g._mongo = undefined; throw e; });
  }
  return g._mongo;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    db.collection('users').createIndex({ usernameLower: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('invites').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('guests').createIndex({ code: 1 }, { unique: true }),
    db.collection('guests').createIndex({ phone: 1 }),
    db.collection('activity').createIndex({ at: -1 }),
    db.collection('rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db();
  if (!g._indexes) g._indexes = ensureIndexes(db).catch((e) => { g._indexes = undefined; throw e; });
  await g._indexes;
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
  health: HealthDoc;
};
