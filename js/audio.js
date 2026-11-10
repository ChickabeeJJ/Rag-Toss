'use strict';
/* =========================================================================
   Audio: every sound is synthesized with WebAudio, and the music is a small
   generative loop (bass, plucked melody, soft hats) that picks up pace as the
   stage number climbs. Nothing is loaded from disk.
   ========================================================================= */

const Sfx = (() => {
  let ac = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
  let sfxOn = true, musicOn = true, platMuted = false, paused = false;
  let musicTimer = null, mstep = 0, nextAt = 0, tempo = 104, mood = 0, musicPlaying = false;
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
    if (musicPlaying) startMusic();
    return true;
  }
  function applyGains() {
    if (!ac) return;
    sfxBus.gain.value = sfxOn && !platMuted ? 1 : 0;
    musicBus.gain.setTargetAtTime(musicOn && !platMuted ? 0.5 : 0, ac.currentTime, 0.08);
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
    record() { for (let i = 0; i < 4; i++) tone([523, 659, 784, 1047][i], 0.16, 'triangle', 0.2, 0, i * 0.11); },
  };

  /* --------------------------------------------------------------- music */
  // A minor pentatonic over a four-bar bass line; `mood` shifts the pattern per theme
  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17];
  const BASS = [[0, 0, 7, 0, 5, 5, 3, 3], [0, 0, 3, 3, 5, 5, 7, 5], [0, 7, 5, 3, 0, 7, 10, 7]];
  const hz = semi => 110 * Math.pow(2, semi / 12);
  let melody = [];
  function newMelody() {
    melody = [];
    let n = randi(2, 5);
    for (let i = 0; i < 16; i++) {
      if (Math.random() < 0.38) { melody.push(-1); continue; }
      n = clamp(n + randi(-2, 2), 0, SCALE.length - 1);
      melody.push(n);
    }
  }
  function schedule() {
    if (!ac || !musicPlaying) return;
    const spb = 60 / tempo / 2;      // eighth notes
    while (nextAt < ac.currentTime + 0.25) {
      const d = Math.max(0, nextAt - ac.currentTime);
      const bar = Math.floor(mstep / 8) % 8, s = mstep % 8;
      const root = BASS[mood % BASS.length][bar];
      if (s % 2 === 0) tone(hz(root - 12), spb * 1.7, 'triangle', 0.2, 0, d, musicBus);
      if (s === 3 || s === 6) tone(hz(root), spb * 0.8, 'triangle', 0.07, 0, d, musicBus);
      const m = melody[(mstep % 16)];
      if (m >= 0 && bar % 4 !== 3) tone(hz(root + SCALE[m] + 12), spb * 1.4, 'sine', 0.09, 0, d, musicBus);
      if (s % 2 === 1) noise(0.03, 0.035, 7000, 'highpass', 1, d, 0, musicBus);
      if (s === 0 || s === 5) tone(64, 0.12, 'sine', 0.22, 0.5, d, musicBus);
      if (s === 4) noise(0.07, 0.07, 1800, 'bandpass', 1, d, 0, musicBus);
      mstep++;
      if (mstep % 64 === 0) newMelody();
      nextAt += spb;
    }
  }
  function startMusic() {
    musicPlaying = true;
    if (!ac || musicTimer) return;
    newMelody(); mstep = 0; nextAt = ac.currentTime + 0.1;
    musicTimer = setInterval(schedule, 60);
  }
  function stopMusic() { musicPlaying = false; clearInterval(musicTimer); musicTimer = null; }
  // stage 1 ambles, later stages push
  function setStage(n) { tempo = Math.min(148, 100 + n * 4); mood = Math.floor((n - 1) / 2); }

  function suspend(on) {
    paused = on;
    if (!ac) return;
    if (on) ac.suspend().catch(() => {}); else ac.resume().catch(() => {});
  }

  return Object.assign(S, {
    ensure, suspend, startMusic, stopMusic, setStage,
    setSfx(v) { sfxOn = v; applyGains(); }, setMusic(v) { musicOn = v; applyGains(); },
    setPlatformMute(v) { platMuted = v; applyGains(); },
  });
})();
