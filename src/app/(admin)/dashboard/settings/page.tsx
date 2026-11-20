import ActionForm, { SubmitButton } from '@/components/admin/ActionForm';
import SmsToggle from '@/components/admin/SmsToggle';
import { requireUser } from '@/lib/auth';
import { getSettings, appUrl } from '@/lib/settings';
import { smsConfig } from '@/lib/sms';
import { MAX_RSVP_CONTACTS } from '@/lib/wedding';
import { saveMessagesAction, saveRsvpAction } from '../actions';

export default async function SettingsPage() {
  await requireUser('super');
  const s = await getSettings();
  const sms = smsConfig();
  const slots = Array.from({ length: MAX_RSVP_CONTACTS }, (_, i) => s.rsvpContacts[i] ?? { name: '', phone: '' });
  return (
    <div className="max-w-3xl space-y-4">
      <h1>Settings</h1>

      <section className="panel p-5">
        <h2 className="font-semibold">RSVP contacts</h2>
        <p className="muted text-sm mb-4">Shown on the RSVP bar of every invitation (two fit), and on the home and “not found” pages. Changes show immediately.</p>
        <ActionForm action={saveRsvpAction}>
          {slots.map((c, i) => (
            <div key={i} className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor={`name${i}`}>Contact {i + 1}: name</label>
                <input className="input" id={`name${i}`} name={`name${i}`} defaultValue={c.name} maxLength={40} placeholder={i ? 'Optional' : 'e.g. Nalubowa Doreen'} />
              </div>
              <div>
                <label className="label" htmlFor={`phone${i}`}>Contact {i + 1}: phone (as shown on the invitation)</label>
                <input className="input" id={`phone${i}`} name={`phone${i}`} defaultValue={c.phone} inputMode="tel" placeholder="+256 771 008212" />
              </div>
            </div>
          ))}
          <SubmitButton>Save RSVP contacts</SubmitButton>
        </ActionForm>
      </section>

      <section className="panel p-5">
        <h2 className="font-semibold">Invitation messages</h2>
        <p className="muted text-sm mb-4">
          <code>{'{name}'}</code> becomes the guest’s name and <code>{'{link}'}</code> their personal link, e.g. {appUrl()}/i/mr-mrs-john-doe-k3x9pqr
        </p>
        <ActionForm action={saveMessagesAction}>
          <div>
            <label className="label" htmlFor="whatsappMessage">WhatsApp message</label>
            <textarea className="input" id="whatsappMessage" name="whatsappMessage" rows={5} defaultValue={s.whatsappMessage} required />
          </div>
          <div>
            <label className="label" htmlFor="smsMessage">SMS message</label>
            <textarea className="input" id="smsMessage" name="smsMessage" rows={3} defaultValue={s.smsMessage} required />
            <p className="muted text-xs mt-1">Keep SMS short: one SMS is 160 characters; longer messages are charged as 2 or more.</p>
          </div>
          <SubmitButton>Save messages</SubmitButton>
        </ActionForm>
      </section>

      <section className="panel p-5 space-y-3">
        <h2 className="font-semibold">SMS (Africa’s Talking)</h2>
        {sms.configured ? (
          <>
            <p className="text-sm">
              Connected as <b>{sms.username}</b>{sms.sandbox && ' (sandbox: messages go to the simulator, not real phones)'}
              {sms.senderId ? <> · sender name <b>{sms.senderId}</b></> : ' · no sender name yet (messages come from a shared number)'}
            </p>
            <SmsToggle enabled={s.smsEnabled} />
          </>
        ) : (
          <div className="alert alert-warn text-sm">
            SMS isn’t set up yet. Create an Africa’s Talking account, then add <code>AT_USERNAME</code>, <code>AT_API_KEY</code> (and
            <code> AT_SENDER_ID</code> once your sender name is approved) to the server settings. The SMS buttons appear once it’s switched on here.
          </div>
        )}
      </section>
    </div>
  );
}
