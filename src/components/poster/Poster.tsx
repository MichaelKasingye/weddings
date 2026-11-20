import type { CSSProperties, ReactNode } from 'react';
import { WEDDING as C, mapsOpenUrl, telHref, type RsvpContact } from '@/lib/wedding';
import { ICON_SPRITE } from './icons';
import PosterClient from './PosterClient';

/*
  THE POSTER
  Every element is placed in "poster units" on the invitation's 1065 × 1598 grid via
  --x / --y / --w (/ --h), and the whole poster scales to the screen (see src/styles/poster.css).
    --x  left edge (or centre, for .c)   --y  top   --fs  font size   --sx  horizontal squeeze   --lh  line height
  The sizes below are the "modern" (Poppins) wording style.

  Artwork layers (rebuilt with tools/poster-build/build-blue.js):
    art/poster.webp      lake background, toned, with the gold frames and bars
    art/title.webp       the gold title + rings, in front of the fireworks
    art/front.webp       the families panels, in front of the couple
    art/bouquet.webp     the bouquet
    couple-layer.webp    the couple
*/

type V = { x?: number; y?: number; w?: number; h?: number; fs?: number; lh?: number; sx?: number };
const v = (o: V): CSSProperties => {
  const s: Record<string, string> = {};
  for (const [k, val] of Object.entries(o)) if (val !== undefined) s['--' + k] = String(val);
  return s as CSSProperties;
};

export type PosterGuest = { name: string; seats: number; code: string };

export default function Poster({ guest, rsvpContacts, track }: { guest: PosterGuest; rsvpContacts: RsvpContact[]; track: boolean }) {
  const box = C.images.coupleBox;
  const rc = C.reception;
  const [beforeVenue, afterVenue = ''] = (rc.text || '{venue}').split('{venue}');
  const receptionText: ReactNode = (
    <>
      {beforeVenue.replace('{time}', rc.time)}
      <a className="det-link det-venue" href={mapsOpenUrl(rc)} data-map="reception" aria-haspopup="dialog">{rc.venue}</a>
      {afterVenue.replace('{time}', rc.time)}
    </>
  );

  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} />

      <canvas className="confetti-canvas" id="confettiCanvas" aria-hidden="true" />

      {/* Welcome banner */}
      <div className="welcome" id="welcome" role="status" aria-live="polite" hidden>
        <div className="welcome-card">
          <p className="welcome-title" id="welcomeTitle">Dear {guest.name},</p>
          <p className="welcome-sub" id="welcomeSub">{C.guest.message}</p>
        </div>
      </div>

      <main className="page anim-in">
        <div className="screen">
          <article className="poster" id="poster" aria-label={`Wedding invitation of ${C.couple.groom} and ${C.couple.bride}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="poster-bg" src={C.images.background} alt="" width={1065} height={1598} fetchPriority="high" decoding="async" />
            <video className="poster-video" id="skyVideo" muted loop playsInline preload="none" hidden />
            <canvas className="poster-fireworks" id="fireworksCanvas" aria-hidden="true" />

            <img id="coupleImg" className="pos couple" style={v(box)} src={C.images.couple} alt="The couple walking hand in hand: the groom in a black tuxedo and bow tie, the bride in a white off-shoulder outfit" width={683} height={500} decoding="async" />
            <img className="pos art" style={v({ x: 120, y: 455, w: 825 })} src="/assets/art/front.webp" alt="" width={825} height={170} decoding="async" />
            <img className="pos art" style={v({ x: 728, y: 40, w: 332 })} src="/assets/art/title.webp" alt="" width={332} height={272} decoding="async" />
            <img className="pos art" style={v({ x: -125, y: 588, w: 311 })} src="/assets/art/bouquet.webp" alt="" width={311} height={396} decoding="async" />

            <h1 className="sr-only">Wedding Invitation</h1>

            <p className="tx c scripture" style={v({ x: 893, y: 312, fs: 24, lh: 1.22, sx: 1 })} data-maxw="250">{C.intro}</p>

            <section aria-label="The families of the couple">
              <p className="tx c fam-tab" id="tabGroom" style={v({ x: 330, y: 470, fs: 21, sx: 1 })}>{C.families.label}</p>
              <p className="tx c fam-tab" id="tabBride" style={v({ x: 736, y: 470, fs: 21, sx: 1 })}>{C.families.label}</p>
              <p className="pos fam-and" style={v({ x: 507, y: 528, w: 52 })} aria-hidden="true"><span>{C.families.joiner}</span></p>
              <p className="tx c fam-text" style={v({ x: 322, y: 500, fs: 21.5, lh: 1.2 })} data-maxw="330">{C.families.groom}</p>
              <p className="tx c fam-text" style={v({ x: 742, y: 513, fs: 21.5, lh: 1.2 })} data-maxw="330">{C.families.bride}</p>
            </section>

            <p className="tx c script-line" style={v({ x: 533, y: 634, fs: 27 })} data-maxw="560">{C.inviteLine}</p>
            {/* the guest's name on the cream bar */}
            <div className="pos guest-bar has-name" style={v({ x: 178, y: 670, w: 724, h: 64 })} id="guest">
              <span className="guest-label">{C.guest.label}</span><span className="guest-dots" aria-hidden="true" />
              <span className="guest-name" id="guestName">{guest.name}</span>
              <span className="guest-count" id="guestCount">{C.guest.countLabel.replace('{n}', String(guest.seats))}</span>
            </div>
            <p className="tx c script-line" style={v({ x: 533, y: 746, fs: 27 })} data-maxw="700">{C.matrimonyLine}</p>

            <p className="tx c name gold" style={v({ x: 540, y: 776, fs: 84, sx: 1 })} data-text={C.couple.groom} data-maxw="760">{C.couple.groom}</p>
            <p className="tx c name gold" style={v({ x: 540, y: 904, fs: 84, sx: 1 })} data-text={C.couple.bride} data-maxw="760">{C.couple.bride}</p>

            {/* Date | Church service | Reception (the icons and dividers are artwork) */}
            <section aria-label="Date, church service and reception">
              <p className="tx l det-label" id="labDate" style={v({ x: 160, y: 1068, fs: 24, sx: 1 })}>Date:</p>
              <p className="tx l det-value" id="dateText" style={v({ x: 160, y: 1102, fs: 21.5, lh: 1.2, sx: 1 })} data-maxw="185" aria-label="Date">{C.date}</p>

              <p className="tx l det-label" style={v({ x: 466, y: 1068, fs: 24, sx: 1 })}>{C.church.label}</p>
              <p className="tx l det-value" id="churchName" style={v({ x: 466, y: 1104, fs: 21.5, sx: 1 })} data-maxw="200">
                <a className="det-link" id="churchLink" href={mapsOpenUrl(C.church)} data-map="church" aria-haspopup="dialog">{C.church.name}</a>
              </p>
              <p className="tx l det-value" id="churchTime" style={v({ x: 466, y: 1136, fs: 21.5, sx: 1 })} data-maxw="200">Time: {C.church.time}</p>
              <p className="tx c det-note" style={v({ x: 525, y: 1178, fs: 16, lh: 1.25, sx: 1 })} data-maxw="230">{C.church.note}</p>

              <p className="tx l det-label" style={v({ x: 800, y: 1068, fs: 24, sx: 1 })}>{C.reception.label}</p>
              <p className="tx l det-value" id="receptionText" style={v({ x: 800, y: 1100, fs: 21.5, lh: 1.49, sx: 1 })} data-maxw="245">{receptionText}</p>
            </section>
            <p className="tx c script-line tagline" style={v({ x: 533, y: 1262, fs: 25, sx: 1 })} data-maxw="640">{C.tagline}</p>
            {C.note && <p className="tx c script-line note-line" style={v({ x: 533, y: 1306, fs: 19, sx: 1 })} data-maxw="560">{C.note}</p>}
            {C.confirmNote && <p className="tx c script-line note-line" style={v({ x: 533, y: 1336, fs: 17, sx: 1 })} data-maxw="660">{C.confirmNote}</p>}

            {/* RSVP: the gold-framed bar (artwork) — RSVP | ☎ names | numbers, one row per contact */}
            <section className="pos rsvp-bar" style={v({ x: 48, y: 1392, w: 970, h: 60 })} aria-label="RSVP">
              <p className="rsvp-title">{C.rsvpTitle}</p>
              <span className="rsvp-div" aria-hidden="true" />
              <div className="rsvp-col" id="rsvpNames">
                {rsvpContacts.map((c, i) => (
                  <p className="rsvp-name" key={i}><svg className="rsvp-ico" aria-hidden="true"><use href="#i-phone" /></svg><span>{c.name}</span></p>
                ))}
              </div>
              <span className="rsvp-div" aria-hidden="true" />
              <div className="rsvp-col" id="rsvpPhones">
                {rsvpContacts.map((c, i) => (
                  <a className="rsvp-phone" key={i} href={telHref(c.phone)} aria-label={`Call ${c.name}, ${c.phone}`}>{c.phone}</a>
                ))}
              </div>
            </section>
          </article>
        </div>
      </main>

      {/* Venue map (opens when the venue is tapped; without JavaScript the venue link opens Google Maps instead) */}
      <dialog className="map-modal" id="mapModal" aria-labelledby="mapTitle">
        <div className="map-head">
          <svg className="map-head-ico" aria-hidden="true"><use href="#i-map-pin" /></svg>
          <div className="map-head-text">
            <p className="map-kicker" id="mapKicker">The venue</p>
            <h2 className="map-title" id="mapTitle">{C.reception.venue}</h2>
            <p className="map-sub" id="mapSub" />
          </div>
          <button className="map-close" type="button" id="mapClose" aria-label="Close the map"><svg aria-hidden="true"><use href="#i-x" /></svg></button>
        </div>
        <div className="map-frame"><iframe id="mapFrame" title="Map of the venue" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen /></div>
        <div className="map-actions">
          <a className="btn btn-gold" id="mapDirections" href="#" target="_blank" rel="noopener"><svg className="btn-ico" aria-hidden="true"><use href="#i-navigation" /></svg> Get directions</a>
          <a className="btn btn-ghost" id="mapOpen" href="#" target="_blank" rel="noopener"><svg className="btn-ico" aria-hidden="true"><use href="#i-external-link" /></svg> Open in Google Maps</a>
        </div>
      </dialog>

      {/* Background music */}
      <audio id="bgMusic" preload="auto" playsInline />
      <button className="music-btn" id="musicToggle" type="button" aria-pressed="true" aria-label="Mute music" hidden>
        <svg className="music-on" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
        <svg className="music-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M3 3l18 18" /></svg>
      </button>
      <div className="toast" id="toast" role="status" aria-live="polite" hidden />

      <PosterClient code={guest.code} track={track} />
    </>
  );
}
