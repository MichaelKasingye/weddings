import { WEDDING as C, telHref, type RsvpContact } from '@/lib/wedding';

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

/** A card in the poster's style: the couple's names, a message and the RSVP contacts. */
export default function Notice({
  title,
  children,
  contacts,
  contactsLead,
  showAdminLink = false,
}: {
  title: string;
  children: React.ReactNode;
  contacts: RsvpContact[];
  contactsLead?: string;
  showAdminLink?: boolean;
}) {
  return (
    <main className="notice-page">
      <section className="notice-card" aria-labelledby="notice-title">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="notice-rings" src="/assets/art/title.webp" alt="" width={332} height={272} />
        <p className="notice-names">{C.couple.short}</p>
        <p className="notice-date">{C.date.replace(/\s*\n\s*/g, ' ')}</p>
        <div className="notice-rule" aria-hidden="true" />
        <h1 className="notice-title" id="notice-title">{title}</h1>
        <div className="notice-text">{children}</div>
        {contacts.length > 0 && (
          <>
            {contactsLead && <p className="notice-text">{contactsLead}</p>}
            <div className="notice-contacts">
              {contacts.map((c, i) => (
                <a key={i} className="notice-contact" href={telHref(c.phone)}>
                  <PhoneIcon />
                  <span className="notice-contact-text"><span>{c.name}</span><span className="notice-contact-phone">{c.phone}</span></span>
                </a>
              ))}
            </div>
          </>
        )}
        {showAdminLink && <a className="notice-admin" href="/login">Admin login</a>}
      </section>
    </main>
  );
}
