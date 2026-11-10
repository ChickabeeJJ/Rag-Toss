'use strict';
/* =========================================================================
   Boot, main loop and input. A throw is one drag: press anywhere on the
   stage, pull back, let go. Mouse and touch share the same pointer path.
   ========================================================================= */

(async function boot() {
  const canvas = document.getElementById('stage');
  // SDK order: init, loadingStart, load everything, loadingStop, then the UI
  await Platform.init();
  Platform.loadingStart();
  Save.load();
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) document.body.classList.add('touch');
  try { await Promise.all([document.fonts.load('900 20px Rubik'), document.fonts.load('600 20px Rubik')]); } catch (e) { /* fonts are optional */ }
  Game.init(canvas);
  Platform.loadingStop();
  UI.init();

  const inPlay = () => UI.screen === null && !UI.modalOpen() && !Game.paused;

  /* ---------------------------------------------------------- pointer */
  canvas.addEventListener('pointerdown', e => {
    Sfx.ensure();
    document.body.classList.toggle('touch', e.pointerType !== 'mouse');
    if (!inPlay()) return;
    if (e.pointerType === 'mouse' && e.button === 2) { Game.setDuck(true); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    Game.aimStart(e.clientX, e.clientY, e.pointerId);
  });
  window.addEventListener('pointermove', e => Game.aimMove(e.clientX, e.clientY, e.pointerId));
  window.addEventListener('pointerup', e => {
    if (e.pointerType === 'mouse' && e.button === 2) { Game.setDuck(false); return; }
    Game.aimEnd(e.pointerId);
  });
  window.addEventListener('pointercancel', () => Game.aimCancel());
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('wheel', e => { if (inPlay()) Game.cycleSlot(e.deltaY > 0 ? 1 : -1); }, { passive: true });

  /* --------------------------------------------------------- keyboard */
  const DUCK = new Set(['KeyS', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft']);
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    Sfx.ensure();
    // P pauses (Escape is left to the browser for leaving fullscreen)
    if (e.code === 'KeyP') {
      if (UI.screen !== null) return;
      if (UI.modalOpen() && UI.modalKind === 'pause') UI.resume();
      else if (!UI.modalOpen()) UI.openPause();
      return;
    }
    if (DUCK.has(e.code)) { if (inPlay()) { e.preventDefault(); Game.setDuck(true); } return; }
    if (!inPlay() || e.repeat) return;
    switch (e.code) {
      case 'Digit1': case 'Numpad1': Game.selectSlot(0); break;
      case 'Digit2': case 'Numpad2': Game.selectSlot(1); break;
      case 'Digit3': case 'Numpad3': Game.selectSlot(2); break;
      case 'Digit4': case 'Numpad4': case 'KeyF': Game.selectSlot(3); break;
      case 'KeyQ': Game.cycleSlot(-1); break;
      case 'KeyE': case 'Tab': e.preventDefault(); Game.cycleSlot(1); break;
      default: break;
    }
  });
  window.addEventListener('keyup', e => { if (DUCK.has(e.code)) Game.setDuck(false); });
  window.addEventListener('blur', () => { Game.setDuck(false); Game.aimCancel(); });

  window.addEventListener('resize', () => { Game.resize(); UI.checkRotate(); UI.applyUiScale(); UI.syncInset(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (UI.screen === null && !UI.modalOpen() && Game.state === 'play') UI.openPause();
      Save.save();
      Sfx.suspend(true);
    } else Sfx.suspend(false);
  });

  /* ------------------------------------------------------------- loop */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Game.update(dt);
    Game.render();
    UI.tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
