'use client';

import { useEffect } from 'react';
import { WEDDING as C, mapsOpenUrl, type Place } from '@/lib/wedding';

/*
  Everything the poster does in the browser, ported from the old js/main.js:
  fitting long text, the venue map window, background music, the welcome banner,
  fireworks + confetti (public/js/fireworks.js, public/js/confetti.js, unchanged)
  and telling the server the guest viewed their invitation.
*/

type FireworksApi = { start(): void; launchAt(x: number, y: number): void };
type CelebrationApi = { welcome(): void; startLoop(): void };
declare global {
  interface Window {
    WEDDING_CONFIG?: unknown;
    Fireworks?: FireworksApi;
    Celebration?: CelebrationApi;
    __posterBooted?: boolean;
  }
}

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const oneLine = (t: string) => String(t || '').replace(/\s*\n\s*/g, ' ').trim();

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.body.appendChild(s);
  });
}

/* ---------- keep longer wording inside its space ----------
   Each line has a maximum width (data-maxw, in poster pixels). If it is wider,
   its font size is reduced just enough to fit. */
function fitText() {
  const poster = $('#poster');
  const pw = poster.getBoundingClientRect().width;
  if (!pw) return;
  document.querySelectorAll<HTMLElement>('[data-maxw]').forEach((el) => {
    if (!el.dataset.fs) { el.dataset.fs = el.style.getPropertyValue('--fs'); el.dataset.y = el.style.getPropertyValue('--y'); }
    const fs0 = parseFloat(el.dataset.fs), y0 = parseFloat(el.dataset.y!);
    el.style.setProperty('--fs', String(fs0)); el.style.setProperty('--y', String(y0));
    const w = (el.getBoundingClientRect().width / pw) * 1065;
    const max = parseFloat(el.dataset.maxw!);
    if (w <= max) return;
    const fs = (fs0 * max) / w;
    el.style.setProperty('--fs', String(fs));
    // single lines stay centred on their original line; blocks keep their top edge
    if (!el.textContent!.includes('\n')) {
      const cs = getComputedStyle(el);
      const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) || 1.15;
      el.style.setProperty('--y', String(y0 + ((fs0 - fs) * lh) / 2));
    }
  });
}

/* long guest names shrink (down to 60%) so the whole name fits on the bar */
function fitGuestName() {
  const el = $('#guestName');
  el.style.setProperty('--gfs', '36');
  if (!el.textContent || !el.clientWidth) return;
  const ratio = el.clientWidth / el.scrollWidth;
  if (ratio < 1) el.style.setProperty('--gfs', String(Math.max(22, 36 * ratio * 0.98)));
}

/* ---------- map window (church / reception) ---------- */
function wireMap() {
  const dlg = $<HTMLDialogElement>('#mapModal');
  if (!dlg || typeof dlg.showModal !== 'function') return; // old browser: the links open Google Maps
  let opener: HTMLElement | null = null;
  const close = () => dlg.open && dlg.close();
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest<HTMLElement>('[data-map]');
    if (!link) return;
    e.preventDefault();
    opener = link;
    const which = link.dataset.map;
    const place: Place = which === 'church' ? C.church : C.reception;
    const title = (which === 'church' ? place.name : place.venue) || '';
    $('#mapKicker').textContent = which === 'church' ? 'Church service' : 'Reception';
    $('#mapTitle').textContent = title;
    $('#mapSub').textContent = [oneLine(C.date), place.time && (which === 'church' ? place.time : 'from ' + place.time)].filter(Boolean).join(' · ');
    $<HTMLAnchorElement>('#mapOpen').href = mapsOpenUrl(place);
    $<HTMLAnchorElement>('#mapDirections').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(place.mapsQuery || title);
    const frame = $<HTMLIFrameElement>('#mapFrame');
    frame.title = 'Map of ' + title;
    const src = 'https://www.google.com/maps?q=' + encodeURIComponent(place.mapsQuery || title) + '&z=15&output=embed';
    if (frame.getAttribute('src') !== src) frame.src = src; // the map loads only when opened
    document.documentElement.classList.add('modal-open');
    dlg.showModal();
  });
  $('#mapClose').addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); }); // tap outside the window
  dlg.addEventListener('close', () => {
    document.documentElement.classList.remove('modal-open');
    if (opener) opener.focus({ preventScroll: true });
  });
}

/* ---------- background music ---------- */
function startMusic() {
  const M = C.music, audio = $<HTMLAudioElement>('#bgMusic'), btn = $<HTMLButtonElement>('#musicToggle');
  if (!M.src || !audio) { if (btn) btn.hidden = true; return; }
  audio.src = M.src; audio.loop = M.loop !== false; audio.volume = M.volume ?? 0.8;
  btn.hidden = false;
  // Music is ON by default; it is off only if this visitor chose to mute it (remembered in this browser).
  const KEY = 'mm-wedding:music';
  const saved = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
  const remember = (val: string) => { try { localStorage.setItem(KEY, val); } catch { /* storage unavailable */ } };
  let wanted = saved !== 'off';
  const show = () => {
    const playing = !audio.paused;
    btn.classList.toggle('is-on', wanted); btn.classList.toggle('is-playing', playing);
    btn.setAttribute('aria-pressed', String(wanted)); btn.setAttribute('aria-label', wanted ? 'Mute music' : 'Play music');
  };
  const tryPlay = () => audio.play().then(show).catch(show);
  const events = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];
  const onFirst = (e: Event) => {
    if ((e.target as HTMLElement)?.closest?.('#musicToggle')) return; // the button handles itself
    events.forEach((ev) => window.removeEventListener(ev, onFirst, true));
    if (wanted && audio.paused) tryPlay();
  };
  audio.addEventListener('play', show); audio.addEventListener('pause', show);
  btn.addEventListener('click', () => {
    if (wanted && !audio.paused) { wanted = false; remember('off'); audio.pause(); } // mute
    else if (wanted) { tryPlay(); } // on, but blocked: this tap starts it
    else { wanted = true; remember('on'); tryPlay(); } // un-mute
    show();
  });
  show();
  if (!wanted) return;
  // play right away; browsers that hold sound back until the first touch start it on that touch
  audio.play().then(show).catch(() => { show(); events.forEach((ev) => window.addEventListener(ev, onFirst, { capture: true, passive: true })); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.pause(); else if (wanted && audio.played.length) tryPlay();
  });
}

/* ---------- welcome banner ---------- */
let welcomeTimer: ReturnType<typeof setTimeout> | undefined;
function showWelcome() {
  const w = $('#welcome');
  clearTimeout(welcomeTimer);
  w.classList.remove('is-leaving');
  // Only show the banner in free space above or below the poster, never over it.
  w.style.visibility = 'hidden'; w.hidden = false;
  const card = w.firstElementChild as HTMLElement, ch = card.getBoundingClientRect().height, gap = 8;
  const p = $('#poster').getBoundingClientRect(), above = p.top, below = window.innerHeight - p.bottom;
  w.style.visibility = '';
  if (above >= ch + gap * 2) w.style.top = Math.max(gap, (above - ch) / 2) + 'px';
  else if (below >= ch + gap * 2) w.style.top = p.bottom + (below - ch) / 2 + 'px';
  else { w.hidden = true; return; }
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  welcomeTimer = setTimeout(hideWelcome, C.welcome.durationMs);
}
function hideWelcome() {
  const w = $('#welcome');
  if (w.hidden) return;
  w.classList.add('is-leaving');
  setTimeout(() => { w.hidden = true; w.classList.remove('is-leaving'); }, 450);
}

/* ---------- download as PDF: the server makes it, which takes a moment ---------- */
function wirePdf() {
  const btn = $<HTMLAnchorElement>('#pdfDownload'), toast = $('#toast');
  if (!btn) return;
  btn.addEventListener('click', () => {
    btn.classList.add('is-busy');
    if (toast) { toast.textContent = 'Preparing your invitation PDF…'; toast.hidden = false; }
    setTimeout(() => { btn.classList.remove('is-busy'); if (toast) toast.hidden = true; }, 3500);
  });
}

/* ---------- fireworks + confetti (unless the visitor prefers reduced motion) ---------- */
async function startEffects(): Promise<{ cfOn: boolean }> {
  const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fwOn = C.fireworks.enabled && motionOk;
  const cfOn = C.confetti.enabled && motionOk;
  $('#welcome').addEventListener('click', hideWelcome);
  if (!fwOn && !cfOn) return { cfOn };
  window.WEDDING_CONFIG = { fireworks: C.fireworks, confetti: C.confetti };
  try {
    if (!window.Fireworks) {
      await loadScript('/js/vendor/confetti.browser.min.js');
      await loadScript('/js/fireworks.js');
      await loadScript('/js/confetti.js');
    }
  } catch { return { cfOn: false }; }
  if (fwOn) window.Fireworks?.start();
  if (cfOn) window.Celebration?.startLoop();
  // Tap the night sky (empty poster area) to launch a firework
  $('#poster').addEventListener('click', (e) => {
    if (!fwOn || !window.Fireworks) return;
    if ((e.target as HTMLElement).closest('a, button, #guest')) return;
    window.Fireworks.launchAt(e.clientX, e.clientY);
  });
  return { cfOn };
}

export default function PosterClient({ code, track }: { code: string; track: boolean }) {
  useEffect(() => {
    if (window.__posterBooted) return; // React dev mode runs effects twice
    window.__posterBooted = true;

    const poster = $('#poster');
    fitGuestName();
    if (document.fonts?.ready) document.fonts.ready.then(() => { fitText(); fitGuestName(); }); else fitText();
    const ro = new ResizeObserver(() => { fitText(); fitGuestName(); });
    ro.observe(poster);
    wireMap();
    wirePdf();
    startMusic();
    startEffects().then((state) => {
      showWelcome();
      if (state.cfOn) window.Celebration?.welcome();
    });

    // "viewed": counted from the browser, so WhatsApp's link-preview robot doesn't count as the guest
    if (track) {
      fetch('/api/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), keepalive: true }).catch(() => {});
    }
  }, [code, track]);

  return null;
}
