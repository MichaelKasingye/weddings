import '@/styles/poster.css';
import Notice from '@/components/notice/Notice';
import { getSettings } from '@/lib/settings';

/** Any address that doesn't exist. */
export default async function NotFound() {
  const settings = await getSettings().catch(() => null);
  return (
    <Notice title="Page not found" contacts={settings?.rsvpContacts ?? []} contactsLead="Looking for your invitation? Please contact:">
      <p>There is nothing at this address. Please open the personal link you received on WhatsApp or SMS.</p>
    </Notice>
  );
}
