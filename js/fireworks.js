/* =========================================================================
   fireworks.js — canvas fireworks in the poster sky (behind the text and couple).
   Settings live in WEDDING_CONFIG.fireworks (js/main.js).
   API: Fireworks.start(), .stop(), .isRunning(), .finale(), .launchAt(x, y)
   ========================================================================= */
(function () {
  'use strict';
  const cfg = (window.WEDDING_CONFIG && window.WEDDING_CONFIG.fireworks) || {};
  const canvas = document.getElementById('fireworksCanvas');
  const sky = document.querySelector('.sky');
  const video = document.getElementById('skyVideo');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

  const isMobile = () => W < 700;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const TAU = Math.PI * 2;

  const BLUE = '#6FA8FF';
  const colors = (cfg.colors || ['#D4AF37', '#FFF1D6', '#E8364F', '#F8F8F4']).filter((c) => c.toUpperCase() !== BLUE.toUpperCase());
  const GOLDS = ['#D4AF37', '#F3D98B', '#FFE7A3'];

  let W = 0, H = 0, dpr = 1, scale = 1, inView = true;
  let rockets = [], particles = [];
  let running = false, raf = 0, last = 0, nextLaunch = 0;

  function resize() {
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    W = rect.width || window.innerWidth; H = rect.height || window.innerHeight;
    scale = Math.max(0.42, W / 1065);   // poster pixels -> screen pixels
    dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 2 : 1.5);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function maxParticles() {
    const m = cfg.maxParticles || {};
    return isMobile() ? (m.mobile || 380) : (m.desktop || 900);
  }

  /* ---------- rockets ---------- */
  function launch(x, targetY) {
    const sx = x != null ? x : rand(W * 0.05, W * 0.95);
    const ty = targetY != null ? targetY : rand(H * 0.03, H * 0.3);
    const sy = Math.max(ty + 40 * scale, H * 0.6);  // launch from behind the couple / horizon
    const g = 0.06 * scale;
    const vy = -Math.sqrt(2 * g * (sy - ty)) * 1.02; // reach target under gravity
    rockets.push({ x: sx, y: sy, px: sx, py: sy, vx: rand(-0.6, 0.6) * scale, vy, g, ty, color: pick(GOLDS) });
  }

  function scheduleNext(now) {
    const min = cfg.minDelayMs || 650, max = cfg.maxDelayMs || 1700;
    nextLaunch = now + rand(min, max);
  }

  /* ---------- explosions ---------- */
  function burstColor() {
    if (Math.random() < (cfg.blueChance != null ? cfg.blueChance : 0.12)) return BLUE;
    return pick(colors);
  }

  function addParticle(p) { particles.push(p); }

  function explode(r) {
    const budget = maxParticles() - particles.length;
    if (budget < 20) return;
    const mobile = isMobile();
    const kinds = ['peony', 'peony', 'ring', 'willow', 'double', 'heart'];
    const kind = pick(kinds);
    const base = burstColor();
    const n = Math.min(budget, mobile ? (kind === 'heart' ? 46 : 54) : (kind === 'heart' ? 70 : 86));
    const speed = rand(3.4, 4.8) * scale * (mobile ? 1.15 : 1);

    // flash
    flashes.push({ x: r.x, y: r.y, life: 1, color: base });

    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.04, 0.04);
      let vx, vy, color = base, decay = rand(0.010, 0.016), drag = 0.985, grav = 0.035, size = rand(2, 3.2);
      if (kind === 'ring') {
        vx = Math.cos(a) * speed; vy = Math.sin(a) * speed * 0.9;
      } else if (kind === 'heart') {
        const t = a;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        vx = (hx / 16) * speed * 0.85; vy = (-hy / 16) * speed * 0.85;
        color = Math.random() < 0.75 ? '#E8364F' : '#FFF1D6'; grav = 0.02; decay = rand(0.010, 0.014);
      } else if (kind === 'willow') {
        const s = speed * rand(0.4, 1);
        vx = Math.cos(a) * s; vy = Math.sin(a) * s;
        color = pick(GOLDS); decay = rand(0.006, 0.009); drag = 0.975; grav = 0.045; size = rand(1.2, 2);
      } else if (kind === 'double') {
        const inner = i % 2 === 0;
        const s = speed * (inner ? 0.55 : 1) * rand(0.92, 1.05);
        vx = Math.cos(a) * s; vy = Math.sin(a) * s;
        color = inner ? '#FFF1D6' : base;
      } else { // peony
        const s = speed * Math.pow(Math.random(), 0.35);
        vx = Math.cos(a) * s; vy = Math.sin(a) * s;
      }
      addParticle({ x: r.x, y: r.y, px: r.x, py: r.y, vx, vy, life: 1, decay, drag, grav: grav * scale, color, size: Math.max(0.9, size * scale * 1.15), flicker: Math.random() < 0.35 });
    }
  }

  let flashes = [];

  /* ---------- loop ---------- */
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(2.5, (now - (last || now)) / 16.67); // 1 = 60fps frame
    last = now;

    if (!inView) return;
    if (now >= nextLaunch) {
      launch();
      if (Math.random() < 0.28) setTimeout(() => running && launch(), rand(120, 380));
      scheduleNext(now);
    }

    // fade previous frame -> trails, keeping the canvas transparent
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.5, 0.15 * dt) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      const rad = 70 * scale * (1.4 - f.life);
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, rad);
      g.addColorStop(0, 'rgba(255,241,214,' + 0.35 * f.life + ')');
      g.addColorStop(1, 'rgba(255,241,214,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, rad, 0, TAU); ctx.fill();
      f.life -= 0.08 * dt;
      if (f.life <= 0) flashes.splice(i, 1);
    }

    // rockets
    ctx.lineCap = 'round';
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.px = r.x; r.py = r.y;
      r.vy += r.g * dt; r.x += r.vx * dt; r.y += r.vy * dt;
      ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(1, 2 * scale);
      ctx.beginPath(); ctx.moveTo(r.px, r.py + 6 * scale); ctx.lineTo(r.x, r.y); ctx.stroke();
      ctx.fillStyle = '#FFF7E0'; ctx.beginPath(); ctx.arc(r.x, r.y, Math.max(1, 1.6 * scale), 0, TAU); ctx.fill();
      if (r.vy >= -0.4 || r.y <= r.ty) { explode(r); rockets.splice(i, 1); }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.px = p.x; p.py = p.y;
      const d = Math.pow(p.drag, dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const alpha = p.flicker && Math.random() < 0.3 ? p.life * 0.3 : p.life;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
      ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- optional video layer ---------- */
  function setupVideo() {
    if (!video || !cfg.video) return;
    video.src = cfg.video;
    video.addEventListener('error', () => { video.hidden = true; }, { once: true });
    video.addEventListener('canplay', () => { if (running) { video.hidden = false; video.play().catch(() => {}); } }, { once: true });
    video.load();
  }

  function setStatic(on) { if (sky) sky.classList.toggle('is-static', on); }

  /* ---------- public API ---------- */
  const api = {
    start() {
      if (!ctx) { setStatic(true); return; }
      if (running) return;
      running = true; setStatic(false);
      resize(); last = 0;
      nextLaunch = performance.now() + 300;
      if (video && cfg.video && video.readyState >= 2) { video.hidden = false; video.play().catch(() => {}); }
      if (!document.hidden) raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false; cancelAnimationFrame(raf);
      rockets = []; particles = []; flashes = [];
      if (ctx) ctx.clearRect(0, 0, W, H);
      if (video) { video.pause(); video.hidden = true; }
      setStatic(true);
    },
    isRunning: () => running,
    finale() {
      if (!running) return;
      for (let i = 0; i < 6; i++) setTimeout(() => running && launch(W * (0.1 + 0.8 * (i / 5)), rand(H * 0.04, H * 0.26)), i * 180);
    },
    /** Launch toward a tapped point (viewport coordinates). */
    launchAt(clientX, clientY) {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      launch(clientX - rect.left, Math.max(H * 0.03, Math.min(clientY - rect.top, H * 0.55)));
    },
  };

  window.addEventListener('resize', () => { clearTimeout(api._rt); api._rt = setTimeout(resize, 150); });
  if ('ResizeObserver' in window && canvas) new ResizeObserver(() => { clearTimeout(api._rt); api._rt = setTimeout(resize, 120); }).observe(canvas);
  // Only animate while the poster is on screen
  if ('IntersectionObserver' in window && canvas) {
    new IntersectionObserver((en) => { inView = en[0].isIntersecting; }, { threshold: 0.05 }).observe(canvas);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); if (video) video.pause(); }
    else if (running) { last = 0; nextLaunch = performance.now() + 200; raf = requestAnimationFrame(frame); if (video && !video.hidden) video.play().catch(() => {}); }
  });

  if (!ctx) setStatic(true);
  setupVideo();
  window.Fireworks = api;
})();
