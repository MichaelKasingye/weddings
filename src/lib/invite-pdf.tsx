import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { WEDDING as C, type RsvpContact } from './wedding';

/*
  A guest's invitation as a one-page PDF that looks like the finished poster.

  src/og/poster-pdf.jpg is a photo of the real poster with the guest's name and seats and the RSVP
  names and numbers left blank (made by tools/pdf-snapshot.mjs). Here those parts are drawn back in
  for the guest, with the same fonts, sizes, colours and layout as src/styles/poster.css, and laid
  over the photo. Positions are in poster units (the 1065 × 1598 grid of src/components/poster/Poster.tsx).
*/

const W = 1065, H = 1598;
const PT = 0.6; // PDF points per poster unit: a 639 × 959 pt page (about 22.5 × 33.8 cm)
const S = 3; // the drawn parts are rendered at 3× for sharp text

const GUEST_BAR = { x: 178, y: 670, w: 724, h: 64, padL: 58, padR: 62, gap: 14 };
const RSVP_BAR = { x: 48, y: 1392, w: 970, h: 60 };
const SHADOW_MARGIN = 12; // room around the RSVP bar for the text shadows

const OG = join(process.cwd(), 'src/og');

type Assets = { poster: Buffer; greatVibes: Buffer; poppins500: Buffer; poppins600: Buffer; poppins700: Buffer };
let assets: Promise<Assets> | undefined;
function loadAssets(): Promise<Assets> {
  assets ??= Promise.all(
    ['poster-pdf.jpg', 'GreatVibes-Regular.ttf', 'Poppins-Medium.ttf', 'Poppins-SemiBold.ttf', 'Poppins-Bold.ttf'].map((f) => readFile(join(OG, f))),
  ).then(([poster, greatVibes, poppins500, poppins600, poppins700]) => ({ poster, greatVibes, poppins500, poppins600, poppins700 }))
    .catch((e) => { assets = undefined; throw e; });
  return assets;
}

type Measurer = (text: string, size: number) => number;
const measurers = new WeakMap<Buffer, Measurer>();
function measurer(font: Buffer): Measurer {
  let m = measurers.get(font);
  if (!m) {
    const f = fontkit.create(font);
    m = (text, size) => (f.layout(text).advanceWidth * size) / f.unitsPerEm;
    measurers.set(font, m);
  }
  return m;
}

/** Same rule as fitGuestName() in PosterClient: 36 units, shrunk (down to 22) until the name fits. */
function guestNameSize(name: string, countLabel: string, a: Assets): number {
  const countWidth = measurer(a.poppins600)(countLabel, 20);
  const room = GUEST_BAR.w - GUEST_BAR.padL - GUEST_BAR.padR - GUEST_BAR.gap - countWidth;
  const width = measurer(a.greatVibes)(name, 36);
  return width > room ? Math.max(22, 36 * (room / width) * 0.98) : 36;
}

async function png(element: React.ReactElement, width: number, height: number, a: Assets): Promise<Uint8Array> {
  const res = new ImageResponse(element, {
    width,
    height,
    fonts: [
      { name: 'Great Vibes', data: a.greatVibes, weight: 400, style: 'normal' },
      { name: 'Poppins', data: a.poppins500, weight: 500, style: 'normal' },
      { name: 'Poppins', data: a.poppins600, weight: 600, style: 'normal' },
      { name: 'Poppins', data: a.poppins700, weight: 700, style: 'normal' },
    ],
  });
  return new Uint8Array(await res.arrayBuffer());
}

/** The guest's name and "Invite for (n)" on the cream bar (.guest-bar in poster.css). */
function GuestBar({ name, countLabel, size }: { name: string; countLabel: string; size: number }) {
  const b = GUEST_BAR;
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: b.w * S, height: b.h * S, padding: `0 ${b.padR * S}px 0 ${b.padL * S}px`, gap: b.gap * S }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center', fontFamily: 'Great Vibes', fontSize: size * S, lineHeight: 1.4, color: '#650D24', whiteSpace: 'nowrap' }}>
        {name}
      </div>
      <div style={{ display: 'flex', fontFamily: 'Poppins', fontWeight: 600, fontSize: 20 * S, color: '#5A1020', whiteSpace: 'nowrap' }}>{countLabel}</div>
    </div>
  );
}

const PHONE_PATH =
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z';

/** RSVP | ☎ names | numbers (.rsvp-bar in poster.css). */
function RsvpBar({ contacts }: { contacts: RsvpContact[] }) {
  const m = SHADOW_MARGIN;
  const text = {
    display: 'flex', alignItems: 'center', gap: 10 * S, fontFamily: 'Poppins', fontWeight: 500, fontSize: 23 * S, lineHeight: 1,
    color: '#FFF8EC', whiteSpace: 'nowrap' as const, textShadow: `0 ${1.5 * S}px ${3 * S}px rgba(0,0,0,.55)`,
  };
  const col = { display: 'flex', flexDirection: 'column' as const, justifyContent: 'center', gap: 7 * S };
  const divider = (
    <div style={{ width: 2 * S, height: RSVP_BAR.h * 0.7 * S, backgroundImage: 'linear-gradient(180deg, rgba(217,174,79,0), #E8BC55 25%, #FFE7A3 50%, #E8BC55 75%, rgba(217,174,79,0))' }} />
  );
  return (
    <div style={{ display: 'flex', width: (RSVP_BAR.w + 2 * m) * S, height: (RSVP_BAR.h + 2 * m) * S, padding: m * S }}>
      {/* "space-evenly" isn't supported here: "space-between" with an empty item at each end spaces the same */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: RSVP_BAR.w * S, height: RSVP_BAR.h * S }}>
        <div style={{ display: 'flex', width: 0 }} />
        <div style={{ display: 'flex', fontFamily: 'Poppins', fontWeight: 700, fontSize: 40 * S, lineHeight: 1, letterSpacing: 0.8 * S, color: '#F6C64E', textShadow: `0 ${1.5 * S}px ${3 * S}px rgba(30,15,0,.7)` }}>
          {C.rsvpTitle}
        </div>
        {divider}
        <div style={{ ...col, position: 'relative', top: -1.3 * S }}>{/* lines up with the browser, measured */}
          {contacts.map((c, i) => (
            <div key={i} style={text}>
              <svg width={24 * S} height={24 * S} viewBox="0 0 24 24" fill="none" stroke="#F6C64E" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d={PHONE_PATH} />
              </svg>
              <span>{c.name}</span>
            </div>
          ))}
        </div>
        {divider}
        <div style={col}>
          {contacts.map((c, i) => (
            <div key={i} style={text}>{c.phone}</div>
          ))}
        </div>
        <div style={{ display: 'flex', width: 0 }} />
      </div>
    </div>
  );
}

/** Builds the PDF for one guest. */
export async function invitationPdf(guest: { name: string; seats: number }, contacts: RsvpContact[]): Promise<Uint8Array> {
  const a = await loadAssets();
  const countLabel = C.guest.countLabel.replace('{n}', String(guest.seats));
  const m = SHADOW_MARGIN;

  const [guestPng, rsvpPng] = await Promise.all([
    png(<GuestBar name={guest.name} countLabel={countLabel} size={guestNameSize(guest.name, countLabel, a)} />, GUEST_BAR.w * S, GUEST_BAR.h * S, a),
    contacts.length ? png(<RsvpBar contacts={contacts} />, (RSVP_BAR.w + 2 * m) * S, (RSVP_BAR.h + 2 * m) * S, a) : null,
  ]);

  const doc = await PDFDocument.create();
  doc.setTitle(`Wedding invitation · ${guest.name}`);
  doc.setSubject(`The wedding of ${C.couple.groom} & ${C.couple.bride}`);
  doc.setAuthor(C.couple.short);
  doc.setCreator(`${C.couple.short} · Wedding`);

  const page = doc.addPage([W * PT, H * PT]);
  // PDF coordinates start at the bottom-left corner; poster units at the top-left
  const place = (x: number, y: number, w: number, h: number) => ({ x: x * PT, y: (H - y - h) * PT, width: w * PT, height: h * PT });

  page.drawImage(await doc.embedJpg(a.poster), place(0, 0, W, H));
  page.drawImage(await doc.embedPng(guestPng), place(GUEST_BAR.x, GUEST_BAR.y, GUEST_BAR.w, GUEST_BAR.h));
  if (rsvpPng) page.drawImage(await doc.embedPng(rsvpPng), place(RSVP_BAR.x - m, RSVP_BAR.y - m, RSVP_BAR.w + 2 * m, RSVP_BAR.h + 2 * m));

  return doc.save();
}
