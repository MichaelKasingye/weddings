import { NextResponse } from 'next/server';
import { getDb, lastDbFailure, type HealthDoc } from '@/lib/db';
import { classifyDbError, dbErrorInfo } from '@/lib/db-errors';

/**
 * Health check: goes through the API to MongoDB and back.
 *   1. `ping` command: the server answers { ok: 1 }
 *   2. write + read of a heartbeat document: proves the database really accepts and returns data
 *
 * 200 + JSON when the database answered. 503 + JSON when it didn't (or took longer than 10 s),
 * with `database.error` saying why (not_configured, auth_failed, ip_blocked, unreachable, …), a plain
 * explanation and how to fix it. The error pages call this to show the reason.
 *
 * ?quick=1: if this server failed to connect in the last 30 s, answer with that failure straight away
 * instead of waiting for the database again (used by the error pages).
 *
 * Called once a day by Vercel Cron (vercel.json) so the Atlas cluster always sees activity;
 * an uptime monitor can also call GET /api/health as often as you like.
 */

// a cold start to Atlas (DNS + TLS) takes ~3 s from here; the driver itself gives up after 7 s
const TIMEOUT_MS = 10_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`database did not answer within ${ms} ms`)), ms); }),
  ]).finally(() => clearTimeout(timer));
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
    ok: 1,
    name: db.databaseName,
    ping: { ok: ping.ok, ms: pingMs },
    heartbeat: { count: heartbeat.count, lastAt: heartbeat.lastAt, firstAt: heartbeat.firstAt, ms: writeReadMs },
  };
}

function failure(e: unknown, started: number) {
  const info = classifyDbError(e) ?? dbErrorInfo('db_error');
  return NextResponse.json(
    {
      status: 'error',
      time: new Date().toISOString(),
      totalMs: Math.round(performance.now() - started),
      database: { ok: 0, error: info.code, title: info.title, message: info.message, fix: info.fix },
    },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET(req: Request) {
  const started = performance.now();
  if (new URL(req.url).searchParams.has('quick')) {
    const recent = lastDbFailure(30_000);
    if (recent) return failure(recent, started);
  }
  try {
    const database = await withTimeout(checkDatabase(), TIMEOUT_MS);
    return NextResponse.json(
      { status: 'ok', time: new Date().toISOString(), totalMs: Math.round(performance.now() - started), database },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    console.error('[health] database check failed:', e);
    return failure(e, started);
  }
}
