import Notice from '@/components/notice/Notice';
import { getSettings } from '@/lib/settings';

/** Shown for links that aren't on the guest list (made-up, mistyped, cut off, or the guest was removed). */
export default async function InvitationNotFound() {
  const settings = await getSettings();
  return (
    <Notice title="Invitation not found" contacts={settings.rsvpContacts} contactsLead="If you believe you were invited, please contact:">
      <p>This link isn&rsquo;t on our guest list. Please check that you opened the full link you received.</p>
    </Notice>
  );
}
