import { NextResponse } from 'next/server';
import { col } from '@/lib/db';

/**
 * Delivery reports from Africa's Talking. In their dashboard set the SMS delivery-report callback to
 *   https://<your-site>/api/sms?key=<AT_CALLBACK_KEY>
 */
export async function POST(req: Request) {
  const key = new URL(req.url).searchParams.get('key');
  if (!process.env.AT_CALLBACK_KEY || key !== process.env.AT_CALLBACK_KEY) return new NextResponse(null, { status: 403 });
  const form = await req.formData();
  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '');
  if (!id) return new NextResponse(null, { status: 400 });
  const mapped = status === 'Success' ? 'delivered' : ['Failed', 'Rejected', 'AbsentSubscriber', 'Expired'].includes(status) ? 'failed' : null;
  if (mapped) {
    await (await col('guests')).updateOne(
      { 'sms.messageId': id },
      { $set: { 'sms.status': mapped, ...(mapped === 'failed' ? { 'sms.error': String(form.get('failureReason') || status) } : {}) } },
    );
  }
  return new NextResponse(null, { status: 200 });
}
