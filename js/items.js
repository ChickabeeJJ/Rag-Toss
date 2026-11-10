'use strict';
/* =========================================================================
   Procedural art for every throwable. Each painter draws around the origin
   in a box of roughly +-16 px; drawItem scales that to the item's radius.
   The same painters make the shop and HUD icons.
   ========================================================================= */

const ItemArt = (() => {
  const P = {};
  const circ = (g, x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const line = (g, x1, y1, x2, y2, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const poly = (g, pts, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };

  P.rock = g => {
    poly(g, [-13, 2, -9, -10, 1, -14, 12, -8, 14, 4, 7, 13, -6, 12], '#8d93a1');
    poly(g, [-9, -10, 1, -14, 12, -8, 4, -5, -5, -3], '#b3b8c4');
    poly(g, [-13, 2, -5, -3, -2, 6, -6, 12], '#767c8a');
  };
  P.e_rock = g => {
    poly(g, [-13, 2, -9, -10, 1, -14, 12, -8, 14, 4, 7, 13, -6, 12], '#5d4a4a');
    poly(g, [-9, -10, 1, -14, 12, -8, 4, -5, -5, -3], '#7d6464');
  };
  P.chicken = g => {
    line(g, -6, 6, -14, 12, 3, '#f0a53a'); line(g, -3, 8, -9, 16, 3, '#f0a53a');
    g.fillStyle = '#f6dc7a'; g.beginPath(); g.ellipse(-2, 1, 12, 7.5, -0.5, 0, TAU); g.fill();
    g.fillStyle = '#fbeaa0'; g.beginPath(); g.ellipse(-3, -1, 7, 3.5, -0.5, 0, TAU); g.fill();
    line(g, 5, -4, 11, -10, 6, '#f6dc7a');
    circ(g, 11, -11, 5.5, '#f6dc7a');
    poly(g, [8, -16, 10, -20, 12, -16, 14, -19, 15, -14], '#e2434b');
    poly(g, [15, -12, 21, -10, 15, -8], '#f0a53a');
    circ(g, 12, -12, 1.4, '#231a10');
  };
  P.boomerang = g => {
    g.strokeStyle = '#a8703a'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-13, 10); g.lineTo(0, -9); g.lineTo(13, 10); g.stroke();
    g.strokeStyle = '#d19a56'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-11, 8); g.lineTo(0, -8); g.lineTo(11, 8); g.stroke();
    line(g, -9, 5, -6, 7, 2.5, '#e2434b'); line(g, 9, 5, 6, 7, 2.5, '#e2434b');
  };
  P.cactus = g => {
    g.strokeStyle = '#3f9d57'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 6; g.beginPath(); g.moveTo(-10, -2); g.lineTo(-10, 4); g.lineTo(0, 4); g.stroke();
    g.beginPath(); g.moveTo(10, -6); g.lineTo(10, 0); g.lineTo(0, 0); g.stroke();
    g.lineWidth = 10; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, 12); g.stroke();
    g.strokeStyle = '#5fc277'; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, -10); g.lineTo(-2, 10); g.stroke();
    g.strokeStyle = '#f4f7e8'; g.lineWidth = 1.4;
    for (const [x, y, a] of [[5, -9, -0.6], [5, 6, 0.3], [-5, -4, 3.6], [-14, 0, 3.3], [14, -4, -0.2], [-5, 10, 2.8], [0, -15, -1.57]]) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); g.stroke();
    }
    circ(g, 2, -15, 3, '#ff7fae');
  };
  P.snowball = g => {
    circ(g, 0, 0, 13, '#dfeaf7'); circ(g, -2, -2, 10.5, '#ffffff');
    g.fillStyle = '#b9cde6'; g.beginPath(); g.arc(0, 0, 13, 0.35, 2.2); g.arc(-3, -4, 13, 2.0, 0.6, true); g.fill();
    circ(g, -5, -6, 2, '#ffffff');
  };
  P.bowling = g => {
    circ(g, 0, 0, 15, '#232a4d'); circ(g, -3, -3, 11, '#303a69');
    circ(g, 3, -6, 2.2, '#0d1024'); circ(g, 8, -2, 2.2, '#0d1024'); circ(g, 3, 1, 2.4, '#0d1024');
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.arc(0, 0, 11.5, 3.5, 4.4); g.stroke();
  };
  P.dynamite = (g, t) => {
    g.save(); g.rotate(-0.5);
    g.fillStyle = '#d93a3a'; g.beginPath(); g.roundRect(-6, -10, 12, 24, 3); g.fill();
    g.fillStyle = '#ee5a52'; g.fillRect(-4, -9, 3, 22);
    g.fillStyle = '#f2e3c0'; g.fillRect(-6, -4, 12, 3); g.fillRect(-6, 6, 12, 3);
    g.strokeStyle = '#5a4634'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -10); g.quadraticCurveTo(4, -17, 8, -15); g.stroke();
    const f = 2.5 + Math.sin(t * 40) * 1.2;
    circ(g, 8, -15, f + 1.5, '#ffb347'); circ(g, 8, -15, f * 0.6, '#fff6c8');
    g.restore();
  };
  P.forks = g => {
    line(g, 0, 15, 0, -3, 2.6, '#c9d0dc');
    g.strokeStyle = '#e6ebf3'; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-4, -15); g.lineTo(-4, -6); g.quadraticCurveTo(0, -1, 4, -6); g.lineTo(4, -15); g.moveTo(0, -15); g.lineTo(0, -4); g.stroke();
  };
  P.beehive = g => {
    const rows = [[-11, 7, 5], [-5, 10, 6], [1, 11, 6], [7, 9, 5], [12, 5, 4]];
    for (let i = 0; i < rows.length; i++) { g.fillStyle = i % 2 ? '#e3a520' : '#f5c53a'; g.beginPath(); g.ellipse(0, rows[i][0], rows[i][1], rows[i][2], 0, 0, TAU); g.fill(); }
    circ(g, 0, 4, 3.6, '#3a2a12');
    line(g, 0, -15, 0, -18, 2.5, '#7a5a2a');
  };
  P.bee = (g, t) => {
    const w = Math.sin(t * 60) * 0.6;
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.ellipse(-2, -7, 5, 8, -0.5 + w, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(3, -7, 5, 8, 0.5 - w, 0, TAU); g.fill();
    g.fillStyle = '#f5c53a'; g.beginPath(); g.ellipse(0, 0, 10, 7, 0, 0, TAU); g.fill();
    g.fillStyle = '#2a2014'; g.fillRect(-4, -6.5, 3, 13); g.fillRect(2, -6.5, 3, 13);
    circ(g, 9, -1, 4, '#2a2014');
  };
  P.plunger = g => {
    line(g, -14, 0, 4, 0, 4, '#c58a4c'); line(g, -13, -1, 2, -1, 1.5, '#e0aa6c');
    g.fillStyle = '#d83b3b'; g.beginPath(); g.moveTo(3, -4); g.quadraticCurveTo(8, -5, 15, -13); g.lineTo(15, 13); g.quadraticCurveTo(8, 5, 3, 4); g.closePath(); g.fill();
    g.fillStyle = '#ee5a52'; g.beginPath(); g.moveTo(5, -3); g.quadraticCurveTo(9, -4, 13, -9); g.lineTo(13, -4); g.quadraticCurveTo(9, -1, 5, 0); g.closePath(); g.fill();
  };
  P.firework = (g, t) => {
    line(g, -18, 0, -6, 0, 2, '#c58a4c');
    g.fillStyle = '#f2f2f6'; g.beginPath(); g.roundRect(-9, -5, 17, 10, 2); g.fill();
    g.fillStyle = '#e2434b'; g.fillRect(-6, -5, 3.5, 10); g.fillRect(1, -5, 3.5, 10);
    poly(g, [8, -6.5, 17, 0, 8, 6.5], '#3f7fe0');
    poly(g, [-9, -5, -13, -9, -9, 0], '#3f7fe0'); poly(g, [-9, 5, -13, 9, -9, 0], '#3f7fe0');
    const f = 3 + Math.sin(t * 50) * 1.5;
    circ(g, -12, 0, f, '#ffb347'); circ(g, -12, 0, f * 0.5, '#fff6c8');
  };
  P.magnet = g => {
    g.lineCap = 'butt'; g.strokeStyle = '#d83b3b'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(-8.5, 12); g.lineTo(-8.5, -2); g.arc(0, -2, 8.5, Math.PI, 0); g.lineTo(8.5, 12); g.stroke();
    g.strokeStyle = '#ee6a62'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, -2, 10.5, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    g.fillStyle = '#dfe5ee'; g.fillRect(-12.5, 6, 8, 7); g.fillRect(4.5, 6, 8, 7);
  };
  P.anvil = g => {
    poly(g, [-17, -10, 12, -10, 17, -6, 6, -3, 5, 3, 10, 7, 10, 12, -10, 12, -10, 7, -5, 3, -6, -3, -12, -5], '#3d4352');
    poly(g, [-17, -10, 12, -10, 15, -8, -14, -8], '#6a7286');
    poly(g, [-10, 9, 10, 9, 10, 12, -10, 12], '#2c313d');
  };
  P.pinata = g => {
    const cols = ['#ff5d73', '#ffc933', '#45e08a', '#4fa8ff', '#b05be0'];
    g.save(); g.beginPath(); g.ellipse(0, 1, 13, 10, 0, 0, TAU); g.clip();
    for (let i = 0; i < 5; i++) { g.fillStyle = cols[i]; g.fillRect(-13 + i * 5.3, -10, 5.6, 22); }
    g.restore();
    poly(g, [-8, -7, -11, -17, -4, -9], '#ff5d73'); poly(g, [8, -7, 11, -17, 4, -9], '#4fa8ff');
    line(g, -6, 10, -7, 16, 3, '#ffc933'); line(g, 6, 10, 7, 16, 3, '#45e08a');
    circ(g, 10, -1, 1.6, '#1d1a2a');
  };
  P.candy = g => {
    poly(g, [-5, 0, -11, -5, -11, 5], '#ff9ec0'); poly(g, [5, 0, 11, -5, 11, 5], '#ff9ec0');
    circ(g, 0, 0, 6.5, '#ff5d73');
    g.strokeStyle = '#fff'; g.lineWidth = 1.8; g.beginPath(); g.arc(0, 0, 3.4, 0.3, 3.6); g.stroke();
  };
  P.jar = (g, t) => {
    g.fillStyle = 'rgba(190,225,255,0.5)'; g.beginPath(); g.roundRect(-9, -8, 18, 22, 5); g.fill();
    g.strokeStyle = '#dff1ff'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(-9, -8, 18, 22, 5); g.stroke();
    g.fillStyle = '#8a6a4c'; g.beginPath(); g.roundRect(-8, -14, 16, 6, 2); g.fill();
    const fl = Math.sin(t * 30) > 0.2 ? '#fff9a8' : '#ffe14d';
    poly(g, [2, -5, -5, 4, -1, 4, -3, 11, 5, 1, 1, 1], fl);
  };
  P.hole = (g, t) => {
    circ(g, 0, 0, 14, '#3b1d66'); circ(g, 0, 0, 10.5, '#12061f');
    g.strokeStyle = '#b98cff'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; g.beginPath(); g.arc(0, 0, 12, a, a + 1.1); g.stroke(); }
    g.strokeStyle = '#e4d3ff'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 7, -t * 7, -t * 7 + 1.6); g.stroke();
  };
  P.duck = g => {
    g.fillStyle = '#f5b921'; g.beginPath(); g.ellipse(-2, 5, 13, 8.5, 0, 0, TAU); g.fill();
    poly(g, [-15, 4, -19, -3, -10, 0], '#f5b921');
    circ(g, 7, -6, 7.5, '#ffcf3a');
    g.fillStyle = '#ffe58a'; g.beginPath(); g.ellipse(-3, 3, 7, 3.5, -0.2, 0, TAU); g.fill();
    poly(g, [13, -7, 20, -5, 13, -2], '#f08a2a');
    circ(g, 9, -8, 1.5, '#2a1c08'); circ(g, 4, -10, 1.6, '#fff8d0');
  };
  P.sack = g => {
    g.fillStyle = '#a57b4a'; g.beginPath(); g.moveTo(-6, -9); g.quadraticCurveTo(-16, 4, -11, 13); g.lineTo(11, 13); g.quadraticCurveTo(16, 4, 6, -9); g.closePath(); g.fill();
    poly(g, [-7, -9, -10, -16, 0, -12, 10, -16, 7, -9], '#8d6638');
    line(g, -6, -9, 6, -9, 2.5, '#5a3e1e');
    g.fillStyle = '#fff3d6'; g.font = '900 16px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 3.5);
  };
  /* ------------------------------------------------------- enemy ammo */
  P.e_bomb = (g, t) => {
    circ(g, 0, 2, 12, '#20232e'); circ(g, -3, -1, 7, '#343949');
    g.fillStyle = '#4a5063'; g.fillRect(-3, -14, 6, 5);
    g.strokeStyle = '#9a8a6a'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(5, -20, 9, -17); g.stroke();
    const f = 2.6 + Math.sin(t * 40) * 1.2;
    circ(g, 9, -17, f + 1.2, '#ff7a3a'); circ(g, 9, -17, f * 0.55, '#fff0b8');
  };
  P.e_ball = g => {
    circ(g, 0, 0, 10, '#f6f1e4');
    g.strokeStyle = '#d83b3b'; g.lineWidth = 1.6;
    g.beginPath(); g.arc(-9, 0, 8, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(9, 0, 8, Math.PI - 0.9, Math.PI + 0.9); g.stroke();
  };
  P.e_pin = g => {
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(-3, -15); g.quadraticCurveTo(-5, -9, -3, -5); g.quadraticCurveTo(-9, 3, -5, 15); g.lineTo(5, 15);
    g.quadraticCurveTo(9, 3, 3, -5); g.quadraticCurveTo(5, -9, 3, -15); g.closePath(); g.fill();
    g.fillStyle = '#b05be0'; g.fillRect(-4, -7, 8, 3);
  };
  P.e_dart = g => {
    line(g, -10, 0, 8, 0, 3, '#c9cedb'); poly(g, [8, -3, 16, 0, 8, 3], '#e9edf5');
    poly(g, [-10, 0, -16, -6, -12, 0, -16, 6], '#e06aa5');
  };
  P.e_barrel = g => {
    g.fillStyle = '#9a6a3c'; g.beginPath(); g.roundRect(-13, -16, 26, 32, 7); g.fill();
    g.fillStyle = '#b4834f'; g.fillRect(-9, -15, 5, 30);
    g.fillStyle = '#4a4e5c'; g.fillRect(-13.5, -10, 27, 4); g.fillRect(-13.5, 6, 27, 4);
  };
  /* ---------------------------------------------------- props and extras */
  P.crate = g => {
    g.fillStyle = '#b98a52'; g.beginPath(); g.roundRect(-15, -15, 30, 30, 3); g.fill();
    g.strokeStyle = '#8a6236'; g.lineWidth = 3; g.strokeRect(-13.5, -13.5, 27, 27);
    g.beginPath(); g.moveTo(-13, -13); g.lineTo(13, 13); g.moveTo(13, -13); g.lineTo(-13, 13); g.stroke();
    circ(g, 0, 0, 8, '#ff9a3c');
    g.fillStyle = '#1a1404'; g.font = '900 13px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 1);
  };
  P.lid = g => {
    circ(g, 0, 0, 16, '#9aa3b4'); circ(g, 0, 0, 12.5, '#b9c1cf'); circ(g, 0, 0, 7, '#9aa3b4');
    g.strokeStyle = '#6d7586'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-4, 0); g.lineTo(4, 0); g.stroke();
  };
  P.pot = g => {
    g.fillStyle = '#8f98a8'; g.beginPath(); g.arc(0, 2, 13, Math.PI, 0); g.lineTo(13, 5); g.lineTo(-13, 5); g.closePath(); g.fill();
    line(g, 12, 2, 22, 0, 3.5, '#6d7586');
    g.fillStyle = '#b3bbc9'; g.beginPath(); g.arc(-3, 0, 7, Math.PI * 1.05, Math.PI * 1.6); g.lineTo(-3, 0); g.fill();
  };

  function has(id) { return !!P[id]; }
  // world drawing: centred on (x, y), radius r, rotated
  function draw(ctx, id, x, y, rot, r, t = 0) {
    const fn = P[id] || P.rock;
    const k = r / 14;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
    fn(ctx, t);
    ctx.restore();
  }
  // a crisp icon canvas for menus and the HUD
  const cache = new Map();
  function icon(id, size = 64) {
    const key = id + ':' + size;
    if (cache.has(key)) return cache.get(key);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    draw(g, id, size / 2, size / 2, id === 'forks' ? 0.5 : id === 'plunger' || id === 'firework' ? -0.6 : 0, size * 0.36, 0.3);
    cache.set(key, c);
    return c;
  }
  function iconEl(id, size = 64) {
    const src = icon(id, size);
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.style.width = c.style.height = size + 'px';
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }
  return { draw, icon, iconEl, has };
})();
