/* =========================================================================
   Aaron & Josephine — the wedding details shown on the invitation.

   ★ Edit this file to change the wording on the poster. ★
   The RSVP contacts and the WhatsApp / SMS messages are NOT here: the super
   admin changes those in the dashboard (Settings), and they are stored in MongoDB.
   "\n" = a line break, exactly as on the poster.
   ========================================================================= */

export type Place = {
  label: string;
  name?: string;
  venue?: string;
  time: string;
  note?: string;
  text?: string;
  mapsQuery: string;
  mapsUrl?: string | null;
};

export const WEDDING = {
  couple: {
    groom: 'Aaron Mutumba',
    bride: 'Josephine Nagadya',
    short: 'Aaron & Josephine',
  },

  intro: '“Therefore what God\nhas joined together,\nlet no one separate.”\n— Mark 10:9',

  families: {
    label: 'The Family of',
    joiner: 'and',
    groom: 'Mr. Ssimbwa Moses\nand Mrs. Nabukalu\nKayonga Magaret\nof Kitoma, Masaka, Buddu.',
    bride: 'Mr. Mawande Ronald\nand Mrs. Nakatte Sanyu\nof Kingo, Lwengo, Buddu.',
  },
  inviteLine: 'cordially invite the company of',
  matrimonyLine: 'to the marriage of their beloved children',

  date: 'Friday,\n1st January 2027',
  church: {
    label: 'Church Service:',
    name: 'Lubaga Cathedral',
    time: '12:00 PM',
    note: '(Guests are requested\nto be seated by 11:30 AM)',
    mapsQuery: 'St. Mary’s Cathedral Lubaga, Kampala, Uganda',
    mapsUrl: null,
  } as Place,
  reception: {
    label: 'Reception:',
    text: '{venue}\nTime: {time}', // {venue} becomes a map link
    venue: 'Akaama Gardens',
    time: '4:00 PM',
    mapsQuery: 'Akaama Gardens, Uganda',
    mapsUrl: null,
  } as Place,

  tagline: 'Let’s celebrate love, family and new beginnings together!',
  note: 'Children are loved but not invited.',
  confirmNote: 'Please confirm attendance by 20th December to aid better organisation of the event.',
  rsvpTitle: 'RSVP',
  phoneCountryCode: '+256',

  guest: {
    label: 'Mr./Mrs./Ms./Dr.',
    countLabel: 'Invite for ({n})',
    message: 'You are cordially invited to celebrate with us!',
  },

  images: {
    background: '/assets/art/poster.webp',
    couple: '/assets/couple/couple-layer.webp',
    coupleBox: { x: 84, y: 0, w: 683 },
  },

  music: { src: '/assets/art/wedding-song.mp3', volume: 0.8, loop: true },

  welcome: {
    title: 'WELCOME TO OUR CELEBRATION!',
    subtitle: 'Let the celebration begin!',
    durationMs: 3600,
  },

  fireworks: {
    enabled: true,
    minDelayMs: 500,
    maxDelayMs: 1400,
    maxParticles: { mobile: 380, desktop: 900 },
    colors: ['#D4AF37', '#F3D98B', '#FFF1D6', '#F8F8F4', '#E8364F', '#B3122E', '#F5D6C6', '#6FA8FF'],
    blueChance: 0.12,
    video: null as string | null,
  },

  confetti: {
    enabled: true,
    intervalMs: 5000,
    particleCount: { mobile: 45, desktop: 90 },
    colors: ['#D4AF37', '#F3D98B', '#FFF1D6', '#F8F8F4', '#650D24', '#8B152B', '#E8364F'],
  },

  seo: {
    description:
      'Together with their families, Aaron Mutumba and Josephine Nagadya invite you to their wedding on Friday, 1st January 2027: church service at Lubaga Cathedral, 12:00 PM, and reception at Akaama Gardens from 4:00 PM.',
    shareImage: '/assets/share-card-v7.jpg',
  },
};

/** One RSVP contact on the poster's RSVP bar. */
export type RsvpContact = { name: string; phone: string };

/** Starting values for the settings the super admin edits in the dashboard. */
export const DEFAULT_SETTINGS = {
  rsvpContacts: [
    { name: 'Nalubowa Doreen', phone: '+256 771 008212' },
    { name: 'John Paul', phone: '+256 782 871428' },
  ] as RsvpContact[],
  whatsappMessage:
    'Dear {name}, you are warmly invited to the wedding of Aaron Mutumba & Josephine Nagadya on Friday, 1st January 2027 (Lubaga Cathedral, 12:00 PM; reception at Akaama Gardens from 4:00 PM). 💍\n\nView your invitation here: {link}',
  smsMessage: 'Dear {name}, you are invited to the wedding of Aaron & Josephine on 1st Jan 2027. View your invitation: {link}',
};

/** Max RSVP contacts: two rows fit on the poster's RSVP bar. */
export const MAX_RSVP_CONTACTS = 2;

/** "Mr & Mrs …" / "Mr. and Mrs. …" → 2 seats, otherwise 1. */
export function defaultSeats(name: string): number {
  return /\bmr\.?\s*(&|and|\+)\s*mrs\b/i.test(name) ? 2 : 1;
}

/** tel: link for a phone number as written on the poster. */
export function telHref(phone: string): string {
  const d = String(phone || '').replace(/[^\d+]/g, '');
  return 'tel:' + (d.startsWith('+') ? d : WEDDING.phoneCountryCode + d.replace(/^0/, ''));
}

export function mapsOpenUrl(place: Place): string {
  return place.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.mapsQuery || '');
}
