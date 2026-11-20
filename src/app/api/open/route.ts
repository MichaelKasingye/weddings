import { NextResponse } from 'next/server';
import { col } from '@/lib/db';
import { isGuestCode } from '@/lib/crypto';
import { getCurrentUser } from '@/lib/auth';

/** The invitation page calls this once it has loaded in a real browser: the guest opened their invite. */
export async function POST(req: Request) {
  let code = '';
  try { code = String((await req.json())?.code || ''); } catch { /* bad body */ }
  if (!isGuestCode(code)) return new NextResponse(null, { status: 204 });
  if (await getCurrentUser()) return new NextResponse(null, { status: 204 }); // an admin previewing

  const now = new Date();
  const guests = await col('guests');
  const g = await guests.findOne({ code }, { projection: { opens: 1 } });
  if (g) {
    await guests.updateOne(
      { _id: g._id },
      g.opens
        ? { $inc: { 'opens.count': 1 }, $set: { 'opens.lastAt': now } }
        : { $set: { opens: { count: 1, firstAt: now, lastAt: now } } },
    );
  }
  return new NextResponse(null, { status: 204 });
}
