import { NextResponse } from 'next/server';
import { getDb, type HealthDoc } from '@/lib/db';

/**
 * Health check: goes through the API to MongoDB and back.
 *   1. `ping` command: the server answers { ok: 1 }
 *   2. write + read of a heartbeat document: proves the database really accepts and returns data
 *
 * 200 + JSON when the database answered, 503 when it didn't (or took longer than TIMEOUT_MS).
 * Called once a day by Vercel Cron (vercel.json) so the Atlas cluster always sees activity;
 * an uptime monitor can also call GET /api/health as often as you like.
 */

const TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`database did not answer within ${ms} ms`)), ms)),
  ]);
}

async function checkDatabase() {
  const db = await getDb();

  const t0 = performance.now();
  const ping = await db.command({ ping: 1 });
  const pingMs = Math.round(performance.now() - t0);

  const now = new Date();
  const t1 = performance.now();
  const heartbeat = await db.collection<HealthDoc>('health').findOneAndUpdate(
    { _id: 'heartbeat' },
    { $inc: { count: 1 }, $set: { lastAt: now }, $setOnInsert: { firstAt: now } },
    { upsert: true, returnDocument: 'after' },
  );
  const writeReadMs = Math.round(performance.now() - t1);

  if (ping?.ok !== 1 || !heartbeat) throw new Error('unexpected database response');
  return {
    name: db.databaseName,
    ping: { ok: ping.ok, ms: pingMs },
    heartbeat: { count: heartbeat.count, lastAt: heartbeat.lastAt, firstAt: heartbeat.firstAt, ms: writeReadMs },
  };
}

export async function GET() {
  const started = performance.now();
  try {
    const database = await withTimeout(checkDatabase(), TIMEOUT_MS);
    return NextResponse.json(
      { status: 'ok', time: new Date().toISOString(), totalMs: Math.round(performance.now() - started), database },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('[health] database check failed:', e);
    return NextResponse.json(
      { status: 'error', time: new Date().toISOString(), totalMs: Math.round(performance.now() - started), database: { ok: 0, error: 'database unreachable' } },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
