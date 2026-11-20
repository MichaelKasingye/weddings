/* =========================================================================
   confetti.js — welcome + recurring confetti (uses canvas-confetti).
   Settings live in WEDDING_CONFIG.confetti (js/main.js).
   API: Celebration.welcome(), .fire(), .startLoop(), .stopLoop()
   ========================================================================= */
(function () {
  'use strict';
  const cfg = (window.WEDDING_CONFIG && window.WEDDING_CONFIG.confetti) || {};
  const canvas = document.getElementById('confettiCanvas');
  const lib = window.confetti;
  const colors = cfg.colors || ['#D4AF37', '#FFF1D6', '#650D24', '#8B152B', '#F8F8F4'];

  // No library (offline / blocked)? Expose no-op API so the page still works.
  if (!lib || !canvas) {
    window.Celebration = { welcome() {}, fire() {}, startLoop() {}, stopLoop() {} };
    return;
  }

  const shoot = lib.create(canvas, { resize: true, useWorker: true, disableForReducedMotion: false });
  const isMobile = () => Math.min(window.innerWidth, window.innerHeight) < 700;
  const count = () => {
    const c = cfg.particleCount || {};
    return isMobile() ? (c.mobile || 45) : (c.desktop || 90);
  };
  const scalar = () => (isMobile() ? 0.9 : 1.1);

  /** A shower falling from the top edge of the screen. */
  function fire() {
    const total = count();
    const drops = 3;
    for (let i = 0; i < drops; i++) {
      shoot({
        particleCount: Math.round(total / drops),
        angle: 270,               // straight down
        spread: 140,
        startVelocity: 18,
        gravity: 0.75,
        drift: (Math.random() - 0.5) * 0.8,
        ticks: 320,
        decay: 0.93,
        scalar: scalar(),
        colors,
        origin: { x: (i + 0.5) / drops + (Math.random() - 0.5) * 0.15, y: -0.08 },
      });
    }
  }

  /** Bigger opening burst: side cannons + top shower. */
  function welcome() {
    const n = Math.round(count() * 0.9);
    shoot({ particleCount: n, angle: 60, spread: 60, startVelocity: 55, origin: { x: 0, y: 0.75 }, colors, scalar: scalar(), ticks: 260 });
    shoot({ particleCount: n, angle: 120, spread: 60, startVelocity: 55, origin: { x: 1, y: 0.75 }, colors, scalar: scalar(), ticks: 260 });
    setTimeout(fire, 350);
  }

  let timer = 0;
  let looping = false;

  function tick() {
    if (!looping || document.hidden) return;
    fire();
  }

  window.Celebration = {
    welcome,
    fire,
    startLoop() {
      if (looping) return;
      looping = true;
      clearInterval(timer);
      timer = setInterval(tick, Math.max(1500, cfg.intervalMs || 5000));
    },
    stopLoop() {
      looping = false;
      clearInterval(timer);
      shoot.reset();
    },
  };

  // Pause while the tab is hidden (interval is skipped) and clear leftovers
  document.addEventListener('visibilitychange', () => { if (document.hidden) shoot.reset(); });
})();
