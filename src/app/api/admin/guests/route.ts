import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listGuestRows } from '@/lib/guests';
import { classifyDbError } from '@/lib/db-errors';

/** The guest list for the dashboard (React Query refreshes it in the background). Logged-in admins only. */
export async function GET() {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    if (!(await getCurrentUser())) return NextResponse.json({ error: 'You are not logged in.' }, { status: 401, headers });
    return NextResponse.json({ rows: await listGuestRows() }, { headers });
  } catch (e) {
    console.error('[api/admin/guests]', e);
    const db = classifyDbError(e);
    return NextResponse.json({ error: db ? `${db.title}. ${db.message}` : 'Could not load the guest list.' }, { status: db ? 503 : 500, headers });
  }
}
