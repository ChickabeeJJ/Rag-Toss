'use strict';
/* =========================================================================
   Audio: every sound effect is synthesized with WebAudio. The music is one
   looping track (assets/music.mp3) that picks up pace as the stage number climbs.
   ========================================================================= */

const Sfx = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let sfxVol = 1, musicVol = 1, sfxOn = true, musicOn = true, platMuted = false, paused = false;
  let track = null, rate = 1, hype = false, ducked = true, musicPlaying = false;
  const last = {};

  function ensure() {
    if (ac) { if (ac.state === 'suspended' && !paused) ac.resume().catch(() => {}); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.8;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
    master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.connect(master);
    applyGains();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    musicPlaying = true; loadTrack(); playTrack();     // the first tap anywhere starts the music
    return true;
  }
  function applyGains() {
    if (!ac) return;
    sfxBus.gain.value = sfxOn && !platMuted ? sfxVol : 0;
    musicBus.gain.setTargetAtTime(musicOn && !platMuted ? (ducked ? 0.2 : 0.42) * musicVol : 0, ac.currentTime, 0.25);
  }
  // don't let the same sound stack up in one frame (nine candies landing at once)
  function gate(id, ms = 40) { const n = performance.now(); if (last[id] && n - last[id] < ms) return false; last[id] = n; return true; }

  function env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0, bus = null) {
    if (!ac || (!bus && !sfxOn)) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    env(g, t, 0.004, vol, dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol = 0.3, filt = 1200, type = 'lowpass', q = 1, delay = 0, sweep = 0, bus = null) {
    if (!ac || (!bus && !sfxOn)) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = rand(0.85, 1.15);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(filt, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, filt * sweep), t + dur);
    const g = ac.createGain();
    env(g, t, 0.003, vol, dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t, Math.random() * 1.2); s.stop(t + dur + 0.05);
  }

  /* ---------------------------------------------------------------- game */
  const S = {
    click() { tone(660, 0.05, 'triangle', 0.14, 1.3); },
    deny() { tone(180, 0.12, 'square', 0.1, 0.7); },
    buy() { tone(660, 0.08, 'triangle', 0.2); tone(880, 0.1, 'triangle', 0.2, 0, 0.07); tone(1320, 0.16, 'triangle', 0.18, 0, 0.14); },
    equip() { tone(520, 0.06, 'triangle', 0.16, 1.5); noise(0.05, 0.1, 3000, 'highpass'); },
    stretch(p) { if (gate('stretch', 70)) tone(140 + p * 200, 0.05, 'triangle', 0.035, 1.05); },
    throw(heavy) { noise(0.16, heavy ? 0.34 : 0.26, heavy ? 500 : 900, 'bandpass', 0.8, 0, heavy ? 2 : 3.2); tone(heavy ? 150 : 240, 0.1, 'sine', 0.1, 0.6); },
    foeThrow() { if (gate('ft', 60)) noise(0.12, 0.12, 700, 'bandpass', 0.8, 0, 2.6); },
    thud(big) { if (!gate('thud', 30)) return; noise(0.08, big ? 0.5 : 0.36, big ? 500 : 900, 'lowpass', 1, 0, 0.4); tone(big ? 80 : 130, big ? 0.16 : 0.1, 'sine', big ? 0.5 : 0.34, 0.5); },
    head() { tone(520, 0.07, 'square', 0.12, 0.5); noise(0.07, 0.4, 1600, 'bandpass', 1.2, 0, 0.4); tone(110, 0.14, 'sine', 0.42, 0.5); },
    clang() { if (!gate('clang', 50)) return; tone(880, 0.3, 'square', 0.08, 0.98); tone(1320, 0.25, 'triangle', 0.1, 0.99); noise(0.05, 0.3, 4000, 'highpass'); },
    land() { if (gate('land', 50)) noise(0.08, 0.16, 500, 'lowpass', 1, 0, 0.5); },
    squeak() { if (!gate('squeak', 60)) return; tone(900, 0.09, 'sawtooth', 0.11, 1.9); tone(1700, 0.12, 'sawtooth', 0.08, 0.5, 0.08); },
    quack() { tone(520, 0.07, 'sawtooth', 0.14, 0.7); tone(430, 0.1, 'sawtooth', 0.12, 0.6, 0.07); },
    boing() { if (gate('boing', 60)) tone(220, 0.18, 'sine', 0.24, 2.2); },
    whirl() { if (gate('whirl', 90)) noise(0.09, 0.07, 1500, 'bandpass', 3, 0, 1.6); },
    stick() { if (!gate('stick', 40)) return; noise(0.04, 0.3, 2400, 'bandpass', 2); tone(200, 0.07, 'triangle', 0.2, 0.6); },
    freeze() { tone(1800, 0.25, 'triangle', 0.12, 0.5); tone(2400, 0.3, 'sine', 0.08, 0.6, 0.03); noise(0.2, 0.2, 6000, 'highpass', 1, 0, 0.5); },
    shatter() { noise(0.25, 0.42, 5000, 'highpass', 1, 0, 0.4); tone(1500, 0.1, 'square', 0.08, 0.4); tone(2100, 0.12, 'triangle', 0.08, 0.4, 0.03); },
    boom(big) { noise(0.5, big ? 0.85 : 0.7, 900, 'lowpass', 0.7, 0, 0.12); tone(70, 0.4, 'sine', 0.75, 0.4); noise(0.1, 0.4, 3500, 'highpass'); },
    zap() { if (!gate('zap', 60)) return; noise(0.16, 0.3, 4000, 'bandpass', 1, 0, 0.3); tone(1400, 0.14, 'sawtooth', 0.1, 0.2); tone(90, 0.12, 'square', 0.14, 0.6); },
    buzz() { if (gate('buzz', 110)) tone(190 + Math.random() * 40, 0.14, 'sawtooth', 0.05, 1.1); },
    fizz() { if (gate('fizz', 70)) noise(0.08, 0.1, 5000, 'highpass', 1, 0, 1.4); },
    vortex() { tone(60, 1.6, 'sawtooth', 0.14, 3.5); noise(1.6, 0.16, 300, 'bandpass', 2, 0, 5); },
    pop() { if (!gate('pop', 40)) return; noise(0.05, 0.42, 2600, 'bandpass', 1.5); tone(700, 0.05, 'square', 0.1, 0.4); },
    glass() { noise(0.2, 0.4, 5500, 'highpass', 1, 0, 0.5); tone(2200, 0.08, 'triangle', 0.1, 0.5); },
    burn() { if (gate('burn', 200)) noise(0.2, 0.08, 1800, 'bandpass', 0.7, 0, 0.5); },
    yank() { tone(300, 0.2, 'sawtooth', 0.12, 2.6); noise(0.12, 0.2, 1200, 'bandpass', 2, 0.02, 2); },
    catch() { tone(700, 0.06, 'triangle', 0.18, 1.4); noise(0.04, 0.2, 2500, 'bandpass', 2); },
    anvil() { tone(1100, 0.5, 'triangle', 0.14, 0.97); tone(1650, 0.4, 'sine', 0.08, 0.98); noise(0.12, 0.55, 700, 'lowpass', 1, 0, 0.3); tone(60, 0.3, 'sine', 0.6, 0.5); },
    hurt() { tone(220, 0.16, 'sawtooth', 0.18, 0.5); noise(0.1, 0.4, 700, 'lowpass', 1, 0, 0.4); tone(90, 0.18, 'sine', 0.45, 0.5); },
    ko() { tone(300, 0.1, 'square', 0.1, 0.4); noise(0.12, 0.42, 1000, 'lowpass', 1, 0, 0.3); tone(90, 0.24, 'sine', 0.5, 0.4); },
    coin(i = 0) { if (gate('coin', 35)) tone(1240 + Math.min(i, 8) * 70, 0.07, 'triangle', 0.1, 1.2); },
    combo(n) { tone(440 * Math.pow(1.06, Math.min(n, 14)), 0.08, 'triangle', 0.14, 1.25); },
    style() { tone(880, 0.07, 'triangle', 0.14); tone(1320, 0.1, 'triangle', 0.14, 0, 0.06); },
    crate() { noise(0.12, 0.4, 1200, 'bandpass', 1, 0, 0.5); tone(523, 0.1, 'triangle', 0.18, 0, 0.05); tone(784, 0.1, 'triangle', 0.18, 0, 0.13); tone(1047, 0.18, 'triangle', 0.18, 0, 0.21); },
    heal() { tone(523, 0.1, 'sine', 0.2); tone(659, 0.1, 'sine', 0.2, 0, 0.08); tone(784, 0.2, 'sine', 0.2, 0, 0.16); },
    empty() { if (gate('empty', 200)) { tone(140, 0.08, 'square', 0.08, 0.8); tone(110, 0.1, 'square', 0.08, 0.8, 0.07); } },
    warn() { if (gate('warn', 150)) tone(980, 0.06, 'square', 0.05, 1); },
    boss() { tone(110, 0.6, 'sawtooth', 0.2, 0.8); tone(165, 0.6, 'sawtooth', 0.16, 0.8, 0.02); tone(82, 0.9, 'sawtooth', 0.2, 0.9, 0.45); noise(0.8, 0.22, 400, 'lowpass', 1, 0, 0.5); },
    bossDown() { for (let i = 0; i < 5; i++) tone([523, 659, 784, 1047, 1319][i], 0.2, 'triangle', 0.2, 0, i * 0.09); noise(0.6, 0.4, 900, 'lowpass', 0.7, 0, 0.2); tone(60, 0.5, 'sine', 0.6, 0.4); },
    perk() { tone(659, 0.1, 'triangle', 0.2); tone(988, 0.1, 'triangle', 0.2, 0, 0.08); tone(1319, 0.24, 'triangle', 0.2, 0, 0.16); },
    stage() { tone(392, 0.12, 'triangle', 0.2); tone(523, 0.12, 'triangle', 0.2, 0, 0.1); tone(659, 0.22, 'triangle', 0.2, 0, 0.2); },
    death() { tone(330, 0.5, 'sawtooth', 0.16, 0.25); tone(220, 0.7, 'sawtooth', 0.14, 0.25, 0.15); noise(0.5, 0.4, 500, 'lowpass', 1, 0, 0.3); },
    revive() { tone(330, 0.12, 'triangle', 0.22); tone(494, 0.12, 'triangle', 0.22, 0, 0.1); tone(659, 0.12, 'triangle', 0.22, 0, 0.2); tone(988, 0.3, 'triangle', 0.22, 0, 0.3); },
    tick() { if (gate('tick', 45)) tone(1500 + Math.random() * 500, 0.05, 'triangle', 0.09, 1.15); },
    fever() { for (let i = 0; i < 5; i++) tone(392 * Math.pow(1.19, i), 0.13, 'sawtooth', 0.11, 1.02, i * 0.055); noise(0.5, 0.16, 900, 'bandpass', 1, 0, 6); },
    bounty() { tone(784, 0.09, 'triangle', 0.2); tone(1047, 0.09, 'triangle', 0.2, 0, 0.08); tone(1568, 0.22, 'triangle', 0.2, 0, 0.16); },
    gold() { for (let i = 0; i < 4; i++) tone([1319, 1661, 1976, 2637][i], 0.16, 'sine', 0.13, 0, i * 0.07); },
    jackpot() { for (let i = 0; i < 8; i++) tone(880 * Math.pow(1.122, i), 0.11, 'triangle', 0.16, 0, i * 0.05); },
    stand() { for (let i = 0; i < 6; i++) { tone(58, 0.16, 'sine', 0.5, 0.7, i * 0.62); tone(52, 0.14, 'sine', 0.4, 0.7, i * 0.62 + 0.17); } tone(180, 0.6, 'sawtooth', 0.12, 0.4); },
    parp() { tone(160, 0.34, 'sawtooth', 0.24, 0.5); tone(125, 0.3, 'square', 0.12, 0.55, 0.04); noise(0.18, 0.15, 500, 'lowpass', 1, 0.02); },
    dong() { tone(523, 1.1, 'sine', 0.28); tone(1047, 0.9, 'sine', 0.13); tone(1568, 0.6, 'triangle', 0.08); noise(0.04, 0.3, 3000, 'highpass'); },
    snap() { noise(0.04, 0.55, 3200, 'highpass'); tone(1500, 0.05, 'square', 0.2, 0.4); tone(420, 0.1, 'square', 0.12, 0.5, 0.02); },
    rattle() { for (let i = 0; i < 4; i++) { noise(0.025, 0.28, 1800 + i * 300, 'bandpass', 2, i * 0.045); } },
    alarm() { for (let i = 0; i < 8; i++) tone(i % 2 ? 1320 : 1760, 0.07, 'square', 0.14, 0, i * 0.075); },
    record() { for (let i = 0; i < 4; i++) tone([523, 659, 784, 1047][i], 0.16, 'triangle', 0.2, 0, i * 0.11); },
  };

  /* --------------------------------------------------------------- music */
  // One looping track, streamed and routed through the music bus so the mute, the
  // settings toggle and a pause all reach it. It plays quieter behind the menus,
  // and a touch faster as the stages climb.
  function loadTrack() {
    if (track || !ac) return;
    track = new Audio('assets/music.mp3');
    track.loop = true; track.preload = 'auto';
    try { ac.createMediaElementSource(track).connect(musicBus); } catch (e) { track.volume = 0.35; }
  }
  function playTrack() { if (track && !paused) { const p = track.play(); if (p && p.catch) p.catch(() => {}); } }
  function startMusic() { musicPlaying = true; ducked = false; if (!ac) return; loadTrack(); applyGains(); playTrack(); }
  function stopMusic() { ducked = true; applyGains(); }
  function setStage(n) { rate = Math.min(1.1, 1 + 0.012 * (n - 1)); if (track) track.playbackRate = rate * (hype ? 1.06 : 1); }
  function setHype(v) { hype = v; if (track) track.playbackRate = rate * (hype ? 1.06 : 1); }

  function suspend(on) {
    paused = on;
    if (!ac) return;
    if (on) { ac.suspend().catch(() => {}); if (track) track.pause(); } else { ac.resume().catch(() => {}); if (musicPlaying) playTrack(); }
  }

  return Object.assign(S, {
    ensure, suspend, startMusic, stopMusic, setStage, setHype,
    setSfxVol(v) { sfxVol = Math.max(0, Math.min(1, v)); applyGains(); }, setMusicVol(v) { musicVol = Math.max(0, Math.min(1, v)); applyGains(); },
    setSfx(v) { sfxOn = v; applyGains(); }, setMusic(v) { musicOn = v; applyGains(); },
    setPlatformMute(v) { platMuted = v; applyGains(); },
  });
})();
