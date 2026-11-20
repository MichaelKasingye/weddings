import 'server-only';

/**
 * SMS through Africa's Talking (africastalking.com).
 * Set AT_USERNAME and AT_API_KEY (and AT_SENDER_ID once your sender name is approved).
 * With AT_USERNAME=sandbox, messages go to the Africa's Talking sandbox simulator instead of real phones.
 */
export function smsConfig() {
  const username = process.env.AT_USERNAME || '';
  const apiKey = process.env.AT_API_KEY || '';
  const senderId = process.env.AT_SENDER_ID || '';
  return {
    configured: Boolean(username && apiKey),
    username,
    apiKey,
    senderId,
    sandbox: username === 'sandbox',
  };
}

export type SmsResult = { ok: true; messageId: string | null; cost: string | null } | { ok: false; error: string };

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const cfg = smsConfig();
  if (!cfg.configured) return { ok: false, error: 'SMS is not set up (AT_USERNAME / AT_API_KEY missing).' };
  const endpoint = cfg.sandbox
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';
  const body = new URLSearchParams({ username: cfg.username, to, message });
  if (cfg.senderId) body.set('from', cfg.senderId);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { apiKey: cfg.apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Africa's Talking error ${res.status}: ${text.slice(0, 200)}` };
    const data = JSON.parse(text) as {
      SMSMessageData?: { Message?: string; Recipients?: { status: string; statusCode: number; messageId?: string; cost?: string }[] };
    };
    const r = data.SMSMessageData?.Recipients?.[0];
    if (!r) return { ok: false, error: data.SMSMessageData?.Message || 'No recipient in the response.' };
    // 100 Processed, 101 Sent, 102 Queued
    if ([100, 101, 102].includes(r.statusCode)) return { ok: true, messageId: r.messageId ?? null, cost: r.cost ?? null };
    return { ok: false, error: r.status || `Status ${r.statusCode}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
