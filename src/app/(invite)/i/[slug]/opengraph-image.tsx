import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { codeFromSlug, findGuestByCode } from '@/lib/guests';
import { WEDDING as C } from '@/lib/wedding';

/* The link preview WhatsApp shows for a guest's personal link: the poster on the left,
   "Dear {name}" and the wedding details on the right. */

export const alt = 'Your personal wedding invitation: Aaron Mutumba & Josephine Nagadya, Friday 1st January 2027';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const OG = join(process.cwd(), 'src/og');

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const code = codeFromSlug(slug);
  const guest = code ? await findGuestByCode(code) : null;

  const [card, playball, poppinsMedium, poppinsSemi] = await Promise.all([
    readFile(join(OG, 'share-card.jpg')),
    readFile(join(OG, 'Playball-Regular.ttf')),
    readFile(join(OG, 'Poppins-Medium.ttf')),
    readFile(join(OG, 'Poppins-SemiBold.ttf')),
  ]);
  const cardSrc = `data:image/jpeg;base64,${card.toString('base64')}`;
  const fonts = [
    { name: 'Playball', data: playball, weight: 400 as const, style: 'normal' as const },
    { name: 'Poppins', data: poppinsMedium, weight: 500 as const, style: 'normal' as const },
    { name: 'Poppins', data: poppinsSemi, weight: 600 as const, style: 'normal' as const },
  ];

  // No guest (an unknown link): the general share card as it is.
  if (!guest) {
    return new ImageResponse(
      // eslint-disable-next-line @next/next/no-img-element
      <img src={cardSrc} width={1200} height={630} alt="" />,
      { ...size, fonts },
    );
  }

  const name = guest.name;
  const nameSize = name.length > 34 ? 46 : name.length > 24 ? 56 : 66;
  const gold = 'linear-gradient(180deg, #FFFCE6 0%, #FFF0AE 22%, #FDDD72 45%, #F6C846 68%, #EDB436 100%)';

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: 'flex', position: 'relative', background: '#0B1B45', fontFamily: 'Poppins' }}>
        {/* the whole card as the backdrop; its right side is covered below */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cardSrc} width={1200} height={630} alt="" style={{ position: 'absolute', left: 0, top: 0 }} />
        <div
          style={{
            position: 'absolute', left: 450, top: 34, width: 712, height: 562, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            background: 'radial-gradient(120% 90% at 50% 40%, #1F3F8A 0%, #163273 55%, #10275E 100%)',
          }}
        >
          <div style={{ fontFamily: 'Playball', fontSize: 40, color: '#F3D98B', display: 'flex' }}>Dear</div>
          <div
            style={{
              fontFamily: 'Playball', fontSize: nameSize, lineHeight: 1.15, maxWidth: 660, display: 'flex', justifyContent: 'center',
              backgroundImage: gold, backgroundClip: 'text', color: 'transparent', padding: '0 10px',
            }}
          >
            {name}
          </div>
          <div style={{ fontSize: 24, color: '#FFF8EC', marginTop: 14, display: 'flex' }}>you are invited to the wedding of</div>
          <div style={{ fontFamily: 'Playball', fontSize: 46, color: '#F6C846', marginTop: 4, display: 'flex' }}>
            {C.couple.groom} &amp; {C.couple.bride}
          </div>
          <div style={{ width: 420, height: 2, marginTop: 18, marginBottom: 18, display: 'flex', background: 'linear-gradient(90deg, rgba(232,188,85,0), #E8BC55 30%, #FFE7A3 50%, #E8BC55 70%, rgba(232,188,85,0))' }} />
          <div style={{ fontSize: 34, fontWeight: 600, color: '#FFFFFF', display: 'flex' }}>Friday, 1st January 2027</div>
          <div style={{ fontSize: 24, color: '#FFF8EC', marginTop: 8, display: 'flex' }}>
            <span style={{ color: '#F4C553', fontWeight: 600, marginRight: 8 }}>Church:</span> Lubaga Cathedral · 12:00 PM
          </div>
          <div style={{ fontSize: 24, color: '#FFF8EC', marginTop: 4, display: 'flex' }}>
            <span style={{ color: '#F4C553', fontWeight: 600, marginRight: 8 }}>Reception:</span> Akaama Gardens · 4:00 PM
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
