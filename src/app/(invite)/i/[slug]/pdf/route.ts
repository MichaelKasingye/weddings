import { codeFromSlug, findGuestByCode } from '@/lib/guests';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { recordGuestEvent } from '@/lib/guest-events';
import { invitationPdf } from '@/lib/invite-pdf';
import { clientIp, count, hit } from '@/lib/ratelimit';

/**
 * GET /i/<guest link>/pdf: the guest's invitation as a PDF (the download button on the invitation).
 * Every download is counted for the guest, except when a logged-in admin downloads it.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const missKey = 'invite-miss:' + (await clientIp()); // shared with the invitation page's limit on wrong links
  if ((await count(missKey)) >= 30) return new Response('Too many attempts. Please try again later.', { status: 429 });

  const code = codeFromSlug(slug);
  const guest = code ? await findGuestByCode(code) : null;
  if (!guest) {
    await hit(missKey, 15 * 60);
    return new Response('Invitation not found.', { status: 404 });
  }

  const [settings, admin] = await Promise.all([getSettings(), getCurrentUser()]);
  const pdf = await invitationPdf({ name: guest.name, seats: guest.seats }, settings.rsvpContacts);
  if (!admin) await recordGuestEvent(guest._id, 'pdf', req.headers.get('user-agent'));

  const ascii = `Wedding invitation - ${guest.name}`.normalize('NFKD').replace(/[^\x20-\x7E]/g, '').replace(/["\\/:*?<>|]/g, '').trim();
  const utf8 = encodeURIComponent(`Wedding invitation - ${guest.name}.pdf`);
  return new Response(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${ascii || 'Wedding invitation'}.pdf"; filename*=UTF-8''${utf8}`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
