import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import Poster from '@/components/poster/Poster';
import Notice from '@/components/notice/Notice';
import { codeFromSlug, findGuestByCode, guestPath } from '@/lib/guests';
import { getSettings } from '@/lib/settings';
import { getCurrentUser } from '@/lib/auth';
import { clientIp, count, hit } from '@/lib/ratelimit';
import { WEDDING as C } from '@/lib/wedding';

export const dynamic = 'force-dynamic';

/** Wrong links allowed per visitor before the page stops answering for a while. */
const MAX_BAD_TRIES = 30;
const WINDOW_SEC = 15 * 60;

const lookup = cache(async (slug: string) => {
  const code = codeFromSlug(slug);
  return code ? findGuestByCode(code) : null;
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guest = await lookup(slug);
  const robots = { index: false, follow: false };
  if (!guest) return { title: 'Invitation not found', robots };
  const title = `Dear ${guest.name} · ${C.couple.short} Wedding`;
  const description = `You are cordially invited to the wedding of ${C.couple.groom} & ${C.couple.bride}: Friday, 1st January 2027 · Lubaga Cathedral, 12:00 PM · Reception at Akaama Gardens, 4:00 PM.`;
  return {
    title,
    description,
    robots,
    openGraph: { type: 'website', siteName: `${C.couple.short} · Wedding`, title, description, url: guestPath(guest), locale: 'en_GB' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function GuestInvite({ params }: Props) {
  const { slug } = await params;
  const ip = await clientIp();
  const key = 'invite-miss:' + ip;

  if ((await count(key)) >= MAX_BAD_TRIES) {
    const settings = await getSettings();
    return (
      <Notice title="Too many attempts" contacts={settings.rsvpContacts} contactsLead="If you were invited, please contact:">
        <p>Too many invitation links that don&rsquo;t exist were opened from this connection. Please try again in a little while.</p>
      </Notice>
    );
  }

  const guest = await lookup(slug);
  if (!guest) {
    await hit(key, WINDOW_SEC);
    notFound();
  }
  // the guest's name was changed since the link was sent: the old link still works and moves to the new one
  if (decodeURIComponent(slug).toLowerCase() !== `${guest.slug}-${guest.code}`) redirect(guestPath(guest));

  const [settings, admin] = await Promise.all([getSettings(), getCurrentUser()]);
  return (
    <Poster
      guest={{ name: guest.name, seats: guest.seats, code: guest.code, pdfUrl: `${guestPath(guest)}/pdf` }}
      rsvpContacts={settings.rsvpContacts}
      track={!admin /* admins previewing an invite don't count as the guest opening it */}
    />
  );
}
