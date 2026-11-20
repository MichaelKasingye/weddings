import type { Metadata } from 'next';
import Notice from '@/components/notice/Notice';
import { getSettings } from '@/lib/settings';
import { WEDDING as C } from '@/lib/wedding';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${C.couple.short} · Wedding`,
  description: 'A private wedding invitation. Please open the personal link you received.',
};

/** The bare address: invitations are private, so this only points guests to their personal link. */
export default async function Home() {
  const settings = await getSettings();
  return (
    <Notice
      title="This is a private invitation"
      contacts={settings.rsvpContacts}
      contactsLead="Questions? Please contact:"
      showAdminLink
    >
      <p>Please open the personal link you received on WhatsApp or SMS to view your invitation.</p>
    </Notice>
  );
}
