/* =========================================================================
   Aaron & Josephine — Wedding Invitation
   main.js: configuration + page wiring.

   ★ EDIT THE CONFIG OBJECT BELOW to change wedding details. ★
   Anything left as null shows "To be confirmed" on the page.
   ========================================================================= */
window.WEDDING_CONFIG = {
  couple: {
    groom: 'Aaron',
    bride: 'Josephine',
    short: 'Aaron & Josephine',
  },

  // "\n" = line break, exactly as on the poster
  intro: '“Therefore what God\nhas joined together,\nlet no one separate.”\n— Mark 10:9',   // under the title
  honorific: '',       // optional gold ribbon under the intro ('' hides it)

  // ---- The families (two emerald panels) ----
  families: {
    label: 'The Families of',
    groom: 'Mr. Ssimbwa Moses\nand Mrs. Nabukalu Kayonga Magaret\nof Kitoma, Masaka, Buddu.',
    bride: 'Mr. Mawande Ronald\nand Mrs. Nakatte Sanyu\nof Kingo, Lwengo, Buddu.',
  },
  inviteLine: 'cordially invite the company of',
  matrimonyLine: 'to the Holy Matrimony of their beloved children',

  // ---- Date, church service and reception (the emerald band) ----
  // Use "\n" to choose line breaks. Ordinals (1st, 2nd) get a raised suffix automatically.
  date: 'Friday,\n1st January 2027',
  pendingText: { date: 'To be\nconfirmed' },
  church: {
    label: 'Church Service:',
    name: 'Rubaga Cathedral',
    time: '12:00 PM',
    note: '(Guests are requested\nto be seated by 11:30 AM)',
    mapsQuery: 'St. Mary’s Cathedral Rubaga, Kampala, Uganda',   // what the map shows when the church is tapped
    mapsUrl: null,                                                // optional exact Google Maps link
  },
  reception: {
    label: 'Reception:',
    text: 'Thereafter, guests will\nproceed to {venue}\nstarting at {time}.',  // {venue} becomes a map link
    venue: 'Kagga Gardens',
    time: '2:00 PM',
    mapsQuery: 'Kagga Gardens, Uganda',
    mapsUrl: null,
  },

  colorTheme: 'Color Theme: Emerald Green & Burgundy',
  tagline: 'Let’s celebrate love, family and new beginnings together!',
  rsvp: { title: 'RSVP', name: 'Nalubowa Dorothy', phone: '0771 008212' },
  phoneCountryCode: '+256',
  footerRibbon: 'Strictly by Invitation',

  // ---- Guest personalisation ----
  // Personal links: index.html?guest=John%20Mukasa
  // Link generator for the hosts: index.html?host
  guest: {
    param: 'guest',
    defaultName: '',     // name shown when the link has no ?guest= (leave '' for a blank dotted line)
    label: 'Mr./Mrs./Ms./Dr.',
    message: 'You are cordially invited to celebrate with us!',
  },

  // ---- Sharing ----
  share: {
    siteUrl: 'https://aaronandjosephine.onrender.com/', // the live address (used for shared and personal links)
    message: "You're invited! 💍 Together with their families, Aaron & Josephine invite you to their Holy Matrimony on Friday, 1st January 2027: church service at Rubaga Cathedral, 12:00 PM, and reception at Kagga Gardens from 2:00 PM. Open your invitation:",
    personalMessage: 'Dear {name}, you are cordially invited to the Holy Matrimony of Aaron & Josephine on Friday, 1st January 2027 (Rubaga Cathedral, 12:00 PM; reception at Kagga Gardens from 2:00 PM)! 💍 Open your personal invitation:',
  },

  // ---- Images (replace the files, or point these paths at new ones) ----
  images: {
    background: 'assets/art/poster.webp', // poster artwork (wording removed)
    couple: 'assets/couple/couple-layer.webp',               // transparent image of the couple
    // where the couple sits, in poster pixels (the poster is 1065 × 1598): left, top, width
    coupleBox: { x: 95, y: 0, w: 807 },
  },

  // ---- Welcome banner ----
  welcome: {
    title: 'WELCOME TO OUR CELEBRATION!',
    subtitle: 'Let the celebration begin!',
    durationMs: 3600,
  },

  // ---- Fireworks (js/fireworks.js) ----
  fireworks: {
    enabled: true,
    minDelayMs: 500,     // shortest gap between launches
    maxDelayMs: 1400,    // longest gap between launches
    maxParticles: { mobile: 380, desktop: 900 },
    colors: ['#D4AF37', '#F3D98B', '#FFF1D6', '#F8F8F4', '#E8364F', '#B3122E', '#F5D6C6', '#6FA8FF'],
    blueChance: 0.12,    // how often a blue burst appears (0–1)
    video: null,         // optional looping fireworks video, e.g. 'assets/backgrounds/fireworks.mp4'
  },

  // ---- Confetti (js/confetti.js) ----
  confetti: {
    enabled: true,
    intervalMs: 5000,    // recurring confetti interval
    particleCount: { mobile: 45, desktop: 90 },
    colors: ['#D4AF37', '#F3D98B', '#FFF1D6', '#F8F8F4', '#650D24', '#8B152B', '#E8364F'],
  },
};

(function () {
  'use strict';
  const C = window.WEDDING_CONFIG;
  const $ = (s) => document.querySelector(s);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- small helpers ---------- */
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
  }

  function baseUrl() {
    if (C.share.siteUrl) return C.share.siteUrl;
    const u = new URL(window.location.href);
    u.search = ''; u.hash = '';
    return u.toString();
  }
  function personalUrl(name) {
    const u = new URL(baseUrl());
    u.searchParams.set(C.guest.param, name.trim());
    return u.toString();
  }
  const waLink = (text) => 'https://wa.me/?text=' + encodeURIComponent(text);

  async function copyText(text, fallbackInput) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      if (fallbackInput) {
        fallbackInput.value = text; fallbackInput.hidden = false;
        fallbackInput.focus(); fallbackInput.select();
        try { if (document.execCommand('copy')) return true; } catch (err) { /* ignore */ }
      }
      return false;
    }
  }

  /* ---------- fill text from CONFIG ---------- */
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const withOrdinals = (t) => esc(t).replace(/(\d)(st|nd|rd|th)\b/g, '$1<sup>$2</sup>');

  function setDetail(el, value, pending) {
    el.innerHTML = esc(value || pending); // ordinals stay inline ("1st"), as on the printed design
    el.classList.toggle('is-pending', !value);
  }

  function applyConfig() {
    document.querySelectorAll('[data-bind]').forEach((el) => {
      const val = getPath(C, el.getAttribute('data-bind'));
      if (val) { el.textContent = val; if (el.classList.contains('gold')) el.dataset.text = val; }
    });
    $('.honorific').hidden = !C.honorific;

    setDetail($('#dateText'), C.date, C.pendingText.date);
    const ch = C.church || {};
    $('#churchTime').innerHTML = ch.time ? 'Time: ' + esc(ch.time) : '';
    $('#churchLink').href = mapsOpenUrl(ch);
    const rc = C.reception || {};
    $('#receptionText').innerHTML = esc(rc.text || '')
      .replace('{venue}', '<a class="det-link det-venue" href="' + esc(mapsOpenUrl(rc)) + '" data-map="reception" aria-haspopup="dialog">' + esc(rc.venue || '') + '</a>')
      .replace('{time}', esc(rc.time || ''));
    if (C.rsvp) $('#rsvpPhone').href = telHref(C.rsvp.phone);

    const bg = $('.poster-bg');
    if (C.images.background && !bg.src.endsWith(C.images.background)) bg.src = C.images.background;

    const img = $('#coupleImg');
    if (C.images.couple && !img.src.endsWith(C.images.couple)) img.src = C.images.couple;
    const box = C.images.coupleBox;
    if (box) { img.style.setProperty('--x', box.x); img.style.setProperty('--y', box.y); img.style.setProperty('--w', box.w); }
    $('#poster').setAttribute('aria-label', 'Wedding invitation of ' + C.couple.groom + ' and ' + C.couple.bride);
  }

  const telHref = (phone) => {
    const d = String(phone || '').replace(/[^\d+]/g, '');
    return 'tel:' + (d.startsWith('+') ? d : (C.phoneCountryCode || '') + d.replace(/^0/, ''));
  };

  /* ---------- map window (church / reception) ---------- */
  const oneLine = (t) => String(t || '').replace(/\s*\n\s*/g, ' ').trim();
  const mapsOpenUrl = (place) => (place && place.mapsUrl) || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((place && place.mapsQuery) || '');

  function wireMap() {
    const dlg = $('#mapModal');
    if (!dlg || typeof dlg.showModal !== 'function') return; // old browser: the links open Google Maps
    let opener = null;
    const close = () => dlg.open && dlg.close();
    document.addEventListener('click', (e) => {
      const link = e.target.closest('[data-map]');
      if (!link) return;
      e.preventDefault();
      opener = link;
      const which = link.dataset.map, place = which === 'church' ? C.church : C.reception;
      const title = which === 'church' ? place.name : place.venue;
      $('#mapKicker').textContent = which === 'church' ? 'Church service' : 'Reception';
      $('#mapTitle').textContent = title;
      $('#mapSub').textContent = [oneLine(C.date), place.time && (which === 'church' ? place.time : 'from ' + place.time)].filter(Boolean).join(' · ');
      $('#mapOpen').href = mapsOpenUrl(place);
      $('#mapDirections').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(place.mapsQuery || title);
      const frame = $('#mapFrame');
      frame.title = 'Map of ' + title;
      const src = 'https://www.google.com/maps?q=' + encodeURIComponent(place.mapsQuery || title) + '&z=15&output=embed';
      if (frame.getAttribute('src') !== src) frame.src = src; // the map loads only when opened
      document.documentElement.classList.add('modal-open');
      dlg.showModal();
    });
    $('#mapClose').addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); }); // tap outside the window
    dlg.addEventListener('close', () => { document.documentElement.classList.remove('modal-open'); if (opener) opener.focus({ preventScroll: true }); });
  }

  /* ---------- guest personalisation ---------- */
  let guestName = '';
  function applyGuest() {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get(C.guest.param) || C.guest.defaultName || '').trim().slice(0, 80);
    if (!raw) return;
    guestName = raw;
    $('#guestName').textContent = raw;
    $('#guest').classList.add('has-name');
    fitGuestName();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitGuestName);
    if ('ResizeObserver' in window) new ResizeObserver(fitGuestName).observe($('#poster'));
    document.title = 'Dear ' + raw + ' · ' + C.couple.short + ' Wedding';
  }

  // long names shrink (down to 60%) so the whole name fits on the bar
  function fitGuestName() {
    const el = $('#guestName');
    el.style.setProperty('--gfs', 36);
    if (!el.textContent || !el.clientWidth) return;
    const ratio = el.clientWidth / el.scrollWidth;
    if (ratio < 1) el.style.setProperty('--gfs', String(Math.max(22, 36 * ratio * 0.98)));
  }

  /* ---------- sharing ---------- */
  function wireSharing() {
    // Host link generator (?host)
    const params = new URLSearchParams(window.location.search);
    if (params.has('host')) {
      $('#hostTool').hidden = false;
      $('#hostForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('#hostName').value.trim();
        if (!name) return;
        const link = personalUrl(name);
        $('#hostLink').value = link;
        $('#hostWa').href = waLink(C.share.personalMessage.replace('{name}', name) + ' ' + link);
        $('#hostResult').hidden = false;
      });
      $('#hostCopy').addEventListener('click', async () => {
        const ok = await copyText($('#hostLink').value, $('#hostLink'));
        toast(ok ? 'Personal link copied' : 'Select the link to copy it');
      });
    }
  }

  /* ---------- welcome banner ---------- */
  let welcomeTimer;
  function showWelcome() {
    const w = $('#welcome');
    $('#welcomeTitle').textContent = guestName ? 'Dear ' + guestName + ',' : C.welcome.title;
    $('#welcomeSub').textContent = guestName ? C.guest.message : C.welcome.subtitle;
    clearTimeout(welcomeTimer);
    w.classList.remove('is-leaving');
    // Only show the banner in free space above or below the poster, never over it
    // (on tablets and big screens the poster fills the height, so there is no banner).
    w.style.visibility = 'hidden'; w.hidden = false;
    const card = w.firstElementChild, ch = card.getBoundingClientRect().height, gap = 8;
    const p = $('#poster').getBoundingClientRect(), above = p.top, below = window.innerHeight - p.bottom;
    w.style.visibility = '';
    if (above >= ch + gap * 2) w.style.top = Math.max(gap, (above - ch) / 2) + 'px';
    else if (below >= ch + gap * 2) w.style.top = p.bottom + (below - ch) / 2 + 'px';
    else { w.hidden = true; return; }
    // restart the CSS animation
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    welcomeTimer = setTimeout(hideWelcome, C.welcome.durationMs);
  }
  function hideWelcome() {
    const w = $('#welcome');
    if (w.hidden) return;
    w.classList.add('is-leaving');
    setTimeout(() => { w.hidden = true; w.classList.remove('is-leaving'); }, 450);
  }

  /* ---------- fireworks + confetti (always on, unless the visitor prefers reduced motion) ---------- */
  function startEffects() {
    const motionOk = !reduceMotion.matches;
    const fwOn = C.fireworks.enabled && motionOk;
    const cfOn = C.confetti.enabled && motionOk;
    if (fwOn && window.Fireworks) window.Fireworks.start();
    if (cfOn && window.Celebration) window.Celebration.startLoop();
    $('#welcome').addEventListener('click', hideWelcome);

    // Tap the night sky (empty poster area) to launch a firework
    $('#poster').addEventListener('click', (e) => {
      if (!fwOn || !window.Fireworks) return;
      if (e.target.closest('a, button, #guest')) return;
      window.Fireworks.launchAt(e.clientX, e.clientY);
    });
    return { cfOn };
  }

  /* ---------- keep longer wording inside its space ----------
     Each line has a maximum width (data-maxw, in poster pixels). If new wording is
     wider than that, its font size is reduced just enough to fit. */
  function fitText() {
    const poster = $('#poster');
    const pw = poster.getBoundingClientRect().width;
    if (!pw) return;
    document.querySelectorAll('[data-maxw]').forEach((el) => {
      if (!el.dataset.fs) { el.dataset.fs = el.style.getPropertyValue('--fs'); el.dataset.y = el.style.getPropertyValue('--y'); }
      const fs0 = parseFloat(el.dataset.fs), y0 = parseFloat(el.dataset.y);
      el.style.setProperty('--fs', fs0); el.style.setProperty('--y', y0);
      const w = (el.getBoundingClientRect().width / pw) * 1065;
      const max = parseFloat(el.dataset.maxw);
      if (w <= max) return;
      const fs = (fs0 * max) / w;
      el.style.setProperty('--fs', String(fs));
      // single lines stay centred on their original line; blocks keep their top edge
      if (!el.textContent.includes('\n')) {
        const lh = parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize) || 1.15;
        el.style.setProperty('--y', String(y0 + ((fs0 - fs) * lh) / 2));
      }
    });
  }

  /* ---------- boot ---------- */
  window.WeddingApp = {
    config: C,
    toast,
    boot() {
      applyConfig();
      applyGuest();
      wireMap();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitText); else fitText();
      if ('ResizeObserver' in window) new ResizeObserver(() => fitText()).observe($('#poster'));
      wireSharing();
      if (!reduceMotion.matches) document.documentElement.classList.add('anim-in');
      const state = startEffects();
      // Welcome: banner always; confetti burst only when confetti is on
      showWelcome();
      if (state.cfOn && window.Celebration) window.Celebration.welcome();
    },
  };
})();
