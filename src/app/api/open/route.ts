import { NextResponse } from 'next/server';
import { col } from '@/lib/db';
import { isGuestCode } from '@/lib/crypto';
import { getCurrentUser } from '@/lib/auth';
import { recordGuestEvent } from '@/lib/guest-events';

/** The invitation page calls this once it has loaded in a real browser: the guest viewed their invite. */
export async function POST(req: Request) {
  let code = '';
  try { code = String((await req.json())?.code || ''); } catch { /* bad body */ }
  if (!isGuestCode(code)) return new NextResponse(null, { status: 204 });
  if (await getCurrentUser()) return new NextResponse(null, { status: 204 }); // an admin previewing

  const g = await (await col('guests')).findOne({ code }, { projection: { _id: 1 } });
  if (g) await recordGuestEvent(g._id, 'view', req.headers.get('user-agent'));
  return new NextResponse(null, { status: 204 });
}
