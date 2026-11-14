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
    // in play the keys belong to the game: a button that kept focus would swallow Space or Enter and draw a focus ring
    if (inPlay() && document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
    if (DUCK.has(e.code)) { if (inPlay()) { e.preventDefault(); Game.setDuck(true); } return; }
    // the hotbar keys work whenever a run is on screen: also behind the pause sheet, and right after coming back from another tab
    const hotOk = UI.screen === null && Game.state === 'play' && (!UI.modalOpen() || UI.modalKind === 'pause');
    if (e.repeat || !(hotOk || inPlay())) return;
    switch (e.code) {
      case 'Digit1': case 'Numpad1': Game.selectNth(0); break;
      case 'Digit2': case 'Numpad2': Game.selectNth(1); break;
      case 'Digit3': case 'Numpad3': Game.selectNth(2); break;
      case 'Digit4': case 'Numpad4': case 'KeyF': Game.selectSlot(3); break;
      case 'KeyQ': Game.cycleSlot(-1); break;
      case 'KeyE': case 'Tab': e.preventDefault(); Game.cycleSlot(1); break;
      default: break;
    }
  });
  window.addEventListener('keyup', e => { if (DUCK.has(e.code)) Game.setDuck(false); });
  window.addEventListener('pagehide', () => { Game.saveRun(); Save.save(); });
  window.addEventListener('blur', () => { Game.setDuck(false); Game.aimCancel(); });
  // coming back to the page (or clicking it) always hands the keyboard back to the game
  const grab = () => { try { window.focus(); if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* ignore */ } };
  window.addEventListener('focus', grab); window.addEventListener('pointerdown', grab, true);

  window.addEventListener('resize', () => { Game.resize(); UI.checkRotate(); UI.applyUiScale(); UI.syncInset(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (UI.screen === null && !UI.modalOpen() && Game.state === 'play') UI.openPause();
      Game.saveRun();
      Save.save();
      Sfx.suspend(true);
    } else { Sfx.suspend(false); grab(); }
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
