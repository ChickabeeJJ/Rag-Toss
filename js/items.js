'use strict';
/* =========================================================================
   Procedural art for every throwable. Each painter draws around the origin
   in a box of roughly +-16 px; ItemArt.draw scales that to the item's radius.
   One look throughout: a dark outline, a two-tone body with a gradient, and a
   highlight. The same painters make the shop and HUD icons.
   ========================================================================= */

const ItemArt = (() => {
  const P = {};
  const INK = '#1b1722';          // used for small details only (eyes, text), never for outlines
  const stroke = () => {};          // no outlines anywhere: shapes are told apart by their fill and shading
  const fillStroke = (g, fill) => { g.fillStyle = fill; g.fill(); };
  const lin = (g, x0, y0, x1, y1, ...stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; };
  const rad = (g, x, y, r0, r1, ...stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; };
  const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
  const line = (g, x1, y1, x2, y2, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const shine = () => {};           // no gloss on anything: flat, matte props

  /* -------------------------------------------------------------- the stuff */
  P.rock = g => {
    poly(g, [-13, 3, -9, -10, 1, -14, 12, -8, 14, 4, 7, 13, -6, 12]); fillStroke(g, lin(g, -12, -12, 12, 12, '#b8becb', '#8a91a2', '#6b7283'));
    g.fillStyle = 'rgba(255,255,255,0.35)'; poly(g, [-9, -10, 1, -14, 12, -8, 4, -5, -5, -3]); g.fill();
    g.fillStyle = 'rgba(20,24,40,0.28)'; poly(g, [-13, 3, -5, -3, -2, 6, -6, 12]); g.fill();
    g.strokeStyle = 'rgba(30,34,50,0.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-5, -3); g.lineTo(4, -5); g.lineTo(7, 13); g.moveTo(4, -5); g.lineTo(14, 4); g.stroke();
    poly(g, [-13, 3, -9, -10, 1, -14, 12, -8, 14, 4, 7, 13, -6, 12]); stroke(g);
  };
  P.e_rock = g => {
    poly(g, [-13, 3, -9, -10, 1, -14, 12, -8, 14, 4, 7, 13, -6, 12]); fillStroke(g, lin(g, -12, -12, 12, 12, '#8d7070', '#6a5252', '#4d3b3b'));
    g.fillStyle = 'rgba(255,255,255,0.18)'; poly(g, [-9, -10, 1, -14, 12, -8, 4, -5, -5, -3]); g.fill();
  };

  // a proper rubber chicken: limp S-curved neck, big comb, open beak, dangling legs
  P.chicken = (g, t) => {
    const sway = Math.sin(t * 9) * 1.2;
    // legs hang down behind the body
    for (const [x, o] of [[-6, 0], [0, 2]]) {
            g.strokeStyle = '#f59a28'; g.lineCap = 'round'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(x, 7); g.quadraticCurveTo(x - 2 + sway * (o ? -1 : 1), 12, x - 4, 15 + o); g.stroke();
      for (const d of [-3.4, 0, 3.4]) { g.strokeStyle = '#f59a28'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 4, 15 + o); g.lineTo(x - 4 + d, 17.5 + o); g.stroke(); }
    }
    // tail feathers
    for (const [a, l] of [[-0.9, 9], [-0.4, 11], [0.1, 9]]) { g.save(); g.translate(-10, 0); g.rotate(Math.PI + a); ell(g, l / 2, 0, l / 2, 2.8); fillStroke(g, '#f7d646', 1.5); g.restore(); }
    // limp neck, drawn as a fat curved tube
    g.lineCap = 'round';
    g.strokeStyle = '#ffe566'; g.lineWidth = 8; g.beginPath(); g.moveTo(5, -1); g.bezierCurveTo(13, 1, 8, -9, 13, -12); g.stroke();
    // body
    ell(g, -2, 2, 12.5, 9, -0.18); fillStroke(g, rad(g, -5, -2, 1, 14, '#fff1a0', '#ffd93d', '#e9b21e'));
    shine(g, -6, -2, 6, 2.4, -0.25, 0.6);
    g.fillStyle = 'rgba(255,255,255,0)'; ell(g, 2, 3, 4, 2, 0.2); g.fill();
    // wing
    g.save(); g.translate(-3, 3); g.rotate(0.35 + sway * 0.05); ell(g, 0, 0, 6, 3.4); fillStroke(g, '#f0c030', 1.4); g.restore();
    // head, comb, wattle, beak
    circ(g, 14, -13, 5.8); fillStroke(g, rad(g, 12, -15, 1, 7, '#fff1a0', '#ffd93d'));
    for (const [x, y, r] of [[11.5, -19, 2.4], [14.5, -19.8, 2.8], [17.3, -18, 2.2]]) { circ(g, x, y, r); fillStroke(g, '#ee3b3b', 1.4); }
    poly(g, [18.5, -15, 25, -13, 18.5, -11]); fillStroke(g, '#ff9a2e', 1.4); g.strokeStyle = '#b8651a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(18.5, -13.2); g.lineTo(24, -13); g.stroke();
    circ(g, 17.6, -10, 2); fillStroke(g, '#ee3b3b', 1.2);
    circ(g, 15.5, -14.5, 1.7); g.fillStyle = INK; g.fill(); circ(g, 15.9, -15, 0.6); g.fillStyle = '#fff'; g.fill();
    // rubber sheen
    g.strokeStyle = 'rgba(255,255,255,0)'; g.lineWidth = 1.2; g.beginPath(); g.arc(-2, 2, 9.4, 3.5, 4.3); g.stroke();
  };

  P.boomerang = g => {
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-14, 9); g.lineTo(0, -9); g.lineTo(14, 9);
    g.strokeStyle = lin(g, -14, 0, 14, 0, '#b9763a', '#e0a35a', '#b9763a'); g.lineWidth = 9; g.stroke();
    g.strokeStyle = 'rgba(255,235,190,0.6)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-11, 6); g.lineTo(0, -7.5); g.lineTo(11, 6); g.stroke();
    for (const [x, y, a] of [[-9.5, 5.4, 0.9], [9.5, 5.4, -0.9]]) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#e2434b'; g.fillRect(-4.2, -3, 8.4, 2.6); g.fillStyle = '#fff'; g.fillRect(-4.2, 0.2, 8.4, 2); g.restore(); }
    circ(g, 0, -4, 1.6); g.fillStyle = '#e2434b'; g.fill();
  };

  P.cactus = g => {
    // pot
    poly(g, [-8, 7, 8, 7, 6, 15, -6, 15]); fillStroke(g, lin(g, -8, 0, 8, 0, '#d9703a', '#f09050', '#b9562a'));
    g.fillStyle = '#f09050'; g.fillRect(-9.5, 5, 19, 3.4);
    // arms and trunk
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const [w, c] of [[11, null]]) {
      g.strokeStyle = c || lin(g, -6, 0, 6, 0, '#2f8f4e', '#5cc477', '#2f8f4e'); g.lineWidth = w;
      g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -8); g.stroke();
    }
    for (const [w, c] of [[7, '#43aa62']]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(-1, 0); g.lineTo(-10, 0); g.lineTo(-10, -7); g.stroke();
      g.beginPath(); g.moveTo(1, -2); g.lineTo(10, -2); g.lineTo(10, -9); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-1.6, 3); g.lineTo(-1.6, -9); g.stroke();
    g.strokeStyle = '#fffbe6'; g.lineWidth = 1.2;
    for (const [x, y, a] of [[4.5, -6, -0.5], [4.5, 2, 0.4], [-4.5, -3, 3.5], [-12, -2, 3.2], [-8, -8, 4.2], [12, -4, -0.3], [8, -10, 4.9], [0, -13, 4.71]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); g.stroke(); }
    circ(g, 0.5, -13, 3.2); fillStroke(g, '#ff7fae', 1.4); circ(g, 0.5, -13, 1.1); g.fillStyle = '#ffd24a'; g.fill();
  };

  P.snowball = g => {
    circ(g, 0, 0, 13); fillStroke(g, rad(g, -4, -5, 1, 15, '#ffffff', '#dfeaf9', '#a9c0e0'), 1.8);
    g.fillStyle = 'rgba(120,150,200,0.25)'; g.beginPath(); g.arc(0, 0, 12.2, 0.2, 2.3); g.arc(-3, -4, 12.2, 2.1, 0.4, true); g.fill();
    shine(g, -5.5, -6.5, 3.4, 1.8, -0.7, 0.9);
    g.strokeStyle = 'rgba(170,200,240,0.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(3, 3); g.lineTo(7, 1); g.moveTo(3, 3); g.lineTo(4, 8); g.moveTo(-3, 5); g.lineTo(-7, 8); g.stroke();
    g.fillStyle = '#fff'; for (const [x, y] of [[8, -7], [-9, 3], [6, 8]]) { g.beginPath(); g.arc(x, y, 1, 0, TAU); g.fill(); }
  };

  P.bowling = g => {
    circ(g, 0, 0, 15); fillStroke(g, rad(g, -5, -6, 1, 18, '#6a78d8', '#2c3585', '#161a45'), 1.9);
    shine(g, -6, -7, 5.4, 2.8, -0.75, 0.7);
    g.strokeStyle = 'rgba(255,255,255,0)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 12, 2.5, 3.6); g.stroke();
    for (const [x, y, r] of [[3, -5, 2.5], [8.5, -1, 2.5], [3.5, 1.6, 2.8]]) { circ(g, x, y, r); g.fillStyle = '#0a0c1e'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.8; g.stroke(); }
  };

  P.forks = g => {
    g.save(); g.rotate(0);
    line(g, 0, 15.5, 0, -2, 4.4, '#8e98ad'); line(g, -0.8, 14, -0.8, 0, 1.2, '#e8edf6');
    g.beginPath(); g.moveTo(-5.5, -15.5); g.lineTo(-5.5, -6); g.quadraticCurveTo(0, 0, 5.5, -6); g.lineTo(5.5, -15.5); g.moveTo(0, -15.5); g.lineTo(0, -3);
    g.strokeStyle = lin(g, -6, 0, 6, 0, '#7f8aa2', '#c9d2e2', '#7f8aa2'); g.lineWidth = 3.4; g.stroke();
    g.restore();
  };

  P.dynamite = (g, t) => {
    g.save(); g.rotate(-0.5);
    g.beginPath(); g.roundRect(-6.5, -11, 13, 25, 3.5); fillStroke(g, lin(g, -6, 0, 6, 0, '#a82a2a', '#ee4b45', '#c8312f'));
    g.fillStyle = '#f4e6c3'; g.fillRect(-6.5, -3.5, 13, 8);
    g.fillStyle = INK; g.font = '900 6.4px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('TNT', 0, 0.8);
    g.fillStyle = '#6b5a45'; g.fillRect(-2.6, -13.5, 5.2, 3.2);
    g.strokeStyle = '#7a6a54'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -13.5); g.quadraticCurveTo(5, -18, 8.5, -15.5); g.stroke();
    const f = 2.6 + Math.sin(t * 40) * 1.2;
    g.globalCompositeOperation = 'lighter'; circ(g, 8.5, -15.5, f + 3.5); g.fillStyle = 'rgba(255,170,60,0.55)'; g.fill(); g.globalCompositeOperation = 'source-over';
    circ(g, 8.5, -15.5, f + 1.2); g.fillStyle = '#ffb347'; g.fill(); circ(g, 8.5, -15.5, f * 0.55); g.fillStyle = '#fff6c8'; g.fill();
    g.restore();
  };

  P.beehive = g => {
    const rows = [[-11, 7, 5], [-5, 10.5, 6], [1, 12, 6.2], [7, 10, 5.4], [12.5, 6, 4]];
    for (let i = rows.length - 1; i >= 0; i--) { ell(g, 0, rows[i][0], rows[i][1], rows[i][2]); fillStroke(g, lin(g, -10, 0, 10, 0, i % 2 ? '#c98a12' : '#e9a91e', i % 2 ? '#f0b830' : '#ffd24a', i % 2 ? '#c98a12' : '#e9a91e'), 1.6); }
    ell(g, 0, 4.5, 3.8, 4.4); g.fillStyle = '#2d1f0a'; g.fill(); stroke(g, 1.2);
    shine(g, -5, -4, 3, 1.4, -0.5, 0.55);
    g.strokeStyle = '#7a5a2a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, -16); g.lineTo(0, -19); g.stroke();
  };
  P.bee = (g, t) => {
    const w = Math.sin(t * 60) * 0.6;
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (const [x, a] of [[-2, -0.5 + w], [3, 0.5 - w]]) { g.save(); g.translate(x, -4); g.rotate(a); ell(g, 0, -4, 3.6, 6); g.fill(); g.strokeStyle = 'rgba(30,30,50,0.5)'; g.lineWidth = 1; g.stroke(); g.restore(); }
    ell(g, 0, 0, 10, 7); fillStroke(g, '#ffd23a', 1.5);
    g.save(); ell(g, 0, 0, 10, 7); g.clip(); g.fillStyle = '#2a2014'; g.fillRect(-4, -8, 3, 16); g.fillRect(2, -8, 3, 16); g.restore();
    circ(g, 9.5, -1, 4.2); fillStroke(g, '#2a2014', 1.3); circ(g, 10.5, -2, 1); g.fillStyle = '#fff'; g.fill();
    poly(g, [-10, 0, -14, -1.5, -14, 1.5]); fillStroke(g, '#2a2014', 1);
  };

  P.plunger = g => {
    g.lineCap = 'round';
    line(g, -15, 0, 5, 0, 5, lin(g, 0, -2, 0, 2, '#e8b574', '#a9703a'));
    g.beginPath(); g.moveTo(3, -4.5); g.quadraticCurveTo(8, -5.5, 16, -14); g.lineTo(16, 14); g.quadraticCurveTo(8, 5.5, 3, 4.5); g.closePath(); fillStroke(g, lin(g, 3, -10, 16, 10, '#ff5a52', '#d82f2f', '#a51f24'), 1.9);
    g.beginPath(); g.ellipse(16, 0, 3.4, 14, 0, 0, TAU); g.fillStyle = '#a51f24'; g.fill();
    shine(g, 9, -6, 4.5, 1.6, -0.5, 0.5);
  };

  P.firework = (g, t) => {
    line(g, -19, 0, -7, 0, 2.2, '#6b5a45');
    g.beginPath(); g.roundRect(-9, -5.5, 17.5, 11, 2); fillStroke(g, lin(g, 0, -5, 0, 5, '#fafafc', '#cfd3de'));
    g.save(); g.beginPath(); g.roundRect(-9, -5.5, 17.5, 11, 2); g.clip(); g.fillStyle = '#e2434b'; g.fillRect(-6.4, -6, 3.6, 12); g.fillRect(1, -6, 3.6, 12); g.restore();
    poly(g, [8.5, -6.5, 18, 0, 8.5, 6.5]); fillStroke(g, '#3f7fe0', 1.6);
    poly(g, [-9, -5.5, -14, -10.5, -9, 0]); fillStroke(g, '#3f7fe0', 1.4); poly(g, [-9, 5.5, -14, 10.5, -9, 0]); fillStroke(g, '#3f7fe0', 1.4);
    const f = 3.4 + Math.sin(t * 50) * 1.6;
    g.globalCompositeOperation = 'lighter'; circ(g, -14, 0, f + 4); g.fillStyle = 'rgba(255,170,60,0.5)'; g.fill(); g.globalCompositeOperation = 'source-over';
    circ(g, -14, 0, f); g.fillStyle = '#ffb347'; g.fill(); circ(g, -14, 0, f * 0.5); g.fillStyle = '#fff6c8'; g.fill();
  };

  P.magnet = (g, t) => {
    g.lineCap = 'butt'; g.beginPath(); g.moveTo(-8.8, 13); g.lineTo(-8.8, -2); g.arc(0, -2, 8.8, Math.PI, 0); g.lineTo(8.8, 13);
    g.strokeStyle = lin(g, -12, 0, 12, 0, '#a51f24', '#ee4b45', '#a51f24'); g.lineWidth = 11.5; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0)'; g.lineWidth = 1.8; g.beginPath(); g.arc(0, -2, 11.4, Math.PI * 1.08, Math.PI * 1.55); g.stroke();
    for (const x of [-13.5, 4.5]) { g.fillStyle = lin(g, x, 5, x + 9, 5, '#9aa3b4', '#f4f7fc', '#9aa3b4'); g.fillRect(x, 5.5, 9, 8); }
    g.strokeStyle = 'rgba(120,200,255,0.9)'; g.lineWidth = 1.4; const k = Math.sin(t * 12) * 0.5 + 0.5;
    g.beginPath(); g.moveTo(-9, 17); g.lineTo(-9, 17 + 2 + k * 2); g.moveTo(9, 17); g.lineTo(9, 17 + 2 + k * 2); g.stroke();
  };

  P.anvil = g => {
    poly(g, [-17, -11, 13, -11, 18, -6.5, 6, -3, 5, 3, 11, 7.5, 11, 13, -11, 13, -11, 7.5, -5, 3, -6, -3, -13, -5.5]); fillStroke(g, lin(g, 0, -11, 0, 13, '#8892a6', '#4a5164', '#2c313f'), 1.9);
    g.fillStyle = 'rgba(255,255,255,0)'; poly(g, [-17, -11, 13, -11, 16, -8.5, -14, -8.5]); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-11, 9.6, 22, 3);
    g.strokeStyle = 'rgba(255,255,255,0)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-4, -3); g.lineTo(-4, 6); g.stroke();
  };

  // a donkey pinata: striped papier-mache body, fringe, ears, tail, a big happy face
  P.pinata = g => {
    const cols = ['#ff5d8f', '#ffd23a', '#2fd0c4', '#7b6cff'];
    // legs
    for (const [x, o] of [[-9.5, 0], [-5.5, 1], [4.5, 0], [8.5, 1]]) {
      g.beginPath(); g.roundRect(x - 2, 4, 4, 10.5, 1.6); fillStroke(g, cols[(x < 0 ? 1 : 2)], 1.4);
      g.fillStyle = '#ffffff'; g.fillRect(x - 2, 12 + o * 0.4, 4, 1.6);
    }
    // tail
    g.save(); g.translate(-13, -2); g.rotate(-0.5);
    for (let i = 0; i < 3; i++) { g.rotate(0.25); g.beginPath(); g.roundRect(-1.2, -9, 2.8, 9.5, 1.2); fillStroke(g, cols[i], 1.2); }
    g.restore();
    // body with fringe stripes
    g.save(); g.beginPath(); g.roundRect(-14, -8, 28, 15, 6.5); g.clip();
    for (let i = 0; i < 5; i++) { g.fillStyle = cols[i % 4]; g.fillRect(-14, -8 + i * 3.4, 28, 3.5); g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); for (let x = -14; x < 14; x += 3.5) { g.moveTo(x, -8 + i * 3.4 + 3.5); g.lineTo(x + 1.75, -8 + i * 3.4 + 1.7); g.lineTo(x + 3.5, -8 + i * 3.4 + 3.5); } g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0)'; g.fillRect(-14, -8, 28, 3); g.restore();
    g.beginPath(); g.roundRect(-14, -8, 28, 15, 6.5); stroke(g, 1.8);
    // neck and head
    poly(g, [8, -6, 14, -14, 20, -12, 15, -3]); fillStroke(g, cols[3], 1.6);
    g.beginPath(); g.roundRect(11, -18, 12, 9.5, 3.4); fillStroke(g, cols[0], 1.7);
    g.beginPath(); g.roundRect(18.5, -14.8, 7, 6.4, 2.6); fillStroke(g, '#ffd23a', 1.5);
    circ(g, 23.5, -12.4, 0.9); g.fillStyle = INK; g.fill();
    // ears
    for (const [x, a] of [[12.5, -0.35], [16.5, 0.05]]) { g.save(); g.translate(x, -17.5); g.rotate(a); g.beginPath(); g.moveTo(-2, 0); g.lineTo(0, -8); g.lineTo(2.6, 0); g.closePath(); fillStroke(g, cols[1], 1.4); g.restore(); }
    // eye and smile
    circ(g, 16.8, -13.6, 2); g.fillStyle = '#fff'; g.fill(); stroke(g, 1); circ(g, 17.3, -13.4, 1.05); g.fillStyle = INK; g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.3; g.lineCap = 'round'; g.beginPath(); g.arc(21.2, -11.2, 2.2, 0.2, 1.6); g.stroke();
    // mane tufts
    g.fillStyle = cols[2]; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(9 + i * 1.3, -7 - i * 1.7); g.lineTo(7.2 + i * 1.3, -10.5 - i * 1.7); g.lineTo(11 + i * 1.3, -9 - i * 1.7); g.closePath(); g.fill(); }
  };
  P.candy = g => {
    poly(g, [-5, 0, -12, -5.5, -12, 5.5]); fillStroke(g, '#ffa0c6', 1.4); poly(g, [5, 0, 12, -5.5, 12, 5.5]); fillStroke(g, '#ffa0c6', 1.4);
    circ(g, 0, 0, 6.6); fillStroke(g, rad(g, -2, -2, 1, 8, '#ff9fb0', '#ff4a6a', '#d82f52'), 1.5);
    g.strokeStyle = '#fff'; g.lineWidth = 1.8; g.beginPath(); g.arc(0, 0, 3.4, 0.3, 3.7); g.stroke(); shine(g, -2.4, -2.6, 1.8, 0.9, -0.6, 0.8);
  };

  P.jar = (g, t) => {
    g.beginPath(); g.roundRect(-9.5, -8, 19, 23, 5.5); fillStroke(g, lin(g, -9, 0, 9, 0, 'rgba(110,175,240,0.8)', 'rgba(185,225,252,0.75)', 'rgba(95,160,228,0.85)'), 1.8);
    g.beginPath(); g.roundRect(-8.5, -15, 17, 7, 2.4); fillStroke(g, lin(g, 0, -15, 0, -8, '#a97a4a', '#6f4a28'), 1.6);
    const fl = Math.sin(t * 30) > 0.2 ? '#fff9a8' : '#ffe14d';
    g.globalCompositeOperation = 'lighter'; circ(g, 0, 3.5, 9); g.fillStyle = 'rgba(255,240,120,0.35)'; g.fill(); g.globalCompositeOperation = 'source-over';
    poly(g, [2.4, -5, -5.4, 4.5, -1, 4.5, -3.2, 12, 5.6, 1, 1, 1]); fillStroke(g, fl, 1.3);
    shine(g, -6, 1, 1.6, 7, 0, 0.5);
  };

  P.hole = (g, t) => {
    g.globalCompositeOperation = 'lighter'; circ(g, 0, 0, 17); g.fillStyle = 'rgba(150,90,255,0.28)'; g.fill(); g.globalCompositeOperation = 'source-over';
    circ(g, 0, 0, 14.2); fillStroke(g, '#4b2790', 1.7); circ(g, 0, 0, 11); g.fillStyle = rad(g, 0, 0, 0, 11, '#000', '#12061f', '#2a0f55'); g.fill();
    g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = t * 5 + i * TAU / 3; g.strokeStyle = '#c9a8ff'; g.lineWidth = 2.2; g.beginPath(); g.arc(0, 0, 12.4, a, a + 1.1); g.stroke(); }
    g.strokeStyle = '#efe3ff'; g.lineWidth = 1.3; g.beginPath(); g.arc(0, 0, 7, -t * 7, -t * 7 + 1.6); g.stroke();
  };

  P.duck = g => {
    poly(g, [-14, 4, -19.5, -4, -9.5, 0]); fillStroke(g, '#e9a915', 1.6);
    ell(g, -2, 5, 13.5, 8.8); fillStroke(g, rad(g, -6, 1, 1, 15, '#ffe27a', '#ffc21f', '#d8960f'));
    circ(g, 7.5, -6.5, 8); fillStroke(g, rad(g, 5, -9, 1, 9, '#fff0a0', '#ffc928', '#e0a012'));
    g.fillStyle = '#ffe9a0'; ell(g, -3.5, 4, 7, 3.6, -0.2); g.fill(); g.strokeStyle = 'rgba(160,100,10,0.6)'; g.lineWidth = 1.2; g.stroke();
    poly(g, [13.5, -7.5, 21.5, -5.5, 13.5, -2]); fillStroke(g, '#ff922b', 1.5);
    circ(g, 9.5, -8.6, 1.7); g.fillStyle = INK; g.fill(); circ(g, 10, -9.1, 0.55); g.fillStyle = '#fff'; g.fill();
    shine(g, 4, -10.5, 2.6, 1.3, -0.6, 0.85); shine(g, -8, 2, 3, 1.1, -0.2, 0.5);
  };

  P.sack = g => {
    g.beginPath(); g.moveTo(-6, -9); g.quadraticCurveTo(-17, 4, -11.5, 14); g.lineTo(11.5, 14); g.quadraticCurveTo(17, 4, 6, -9); g.closePath(); fillStroke(g, lin(g, -12, 0, 12, 0, '#9a6e3e', '#c79a62', '#8a5f32'), 1.8);
    poly(g, [-7.5, -9, -11, -17, -1, -12.5, 10, -17, 7.5, -9]); fillStroke(g, '#a97a45', 1.6);
    line(g, -6.5, -9, 6.5, -9, 3, '#e2434b');
    g.strokeStyle = 'rgba(70,40,15,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-9, 0); g.lineTo(-3, 11); g.moveTo(9, -1); g.lineTo(5, 10); g.stroke();
    g.fillStyle = '#4a2f14'; g.font = '900 17px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 4);
  };

  /* --------------------------------------------------------------- new stuff */
  P.pie = g => {
    ell(g, 0, 7, 15, 4.8); fillStroke(g, lin(g, -15, 0, 15, 0, '#8c96a9', '#d3d9e4', '#7a8498'), 1.7);
    g.beginPath(); g.moveTo(-13, 6); g.bezierCurveTo(-15, -6, -6, -11, 0, -10); g.bezierCurveTo(7, -11, 15, -6, 13, 6); g.closePath(); fillStroke(g, lin(g, 0, -11, 0, 6, '#fffaf0', '#f3e6cd'), 1.7);
    for (const [x, y, r] of [[-7, -7, 3], [-1.5, -10, 3.4], [5, -8, 3.2], [10, -3, 2.6], [-11, -2, 2.6]]) { circ(g, x, y, r); fillStroke(g, '#fffaf0', 1.3); }
    circ(g, 0, -11.2, 3.2); fillStroke(g, rad(g, -1, -12, 0.5, 4, '#ff8a8a', '#d92b3a'), 1.4); shine(g, -1, -12.4, 0.9, 0.6, 0, 0.9);
    g.strokeStyle = 'rgba(210,190,150,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-9, 3); g.lineTo(8, 3); g.stroke();
  };
  P.knife = g => {
    g.save(); g.rotate(0);
    poly(g, [14, 0, 2, -4.2, -4, -3.4, -4, 3.4, 2, 4.2]); fillStroke(g, lin(g, 0, -4, 0, 4, '#f6f9ff', '#b3bccb', '#7f8aa0'), 1.7);
    g.strokeStyle = 'rgba(255,255,255,0)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(11, -0.4); g.lineTo(-2, -1.8); g.stroke();
    g.beginPath(); g.roundRect(-16, -3, 12.5, 6, 2.2); fillStroke(g, lin(g, 0, -3, 0, 3, '#a8602f', '#6c3a1a'), 1.7);
    g.strokeStyle = '#e2b270'; g.lineWidth = 1.3; g.beginPath(); for (let x = -14.5; x < -4; x += 2.7) { g.moveTo(x, -3); g.lineTo(x + 1.4, 3); } g.stroke();
    g.fillStyle = '#c9d0dc'; g.fillRect(-4.6, -5, 2.2, 10);
    g.restore();
  };
  P.sauce = (g, t) => {
    g.beginPath(); g.moveTo(-4, -15); g.lineTo(4, -15); g.lineTo(4, -9); g.quadraticCurveTo(10, -5, 10, 3); g.lineTo(10, 12); g.quadraticCurveTo(10, 15, 7, 15); g.lineTo(-7, 15); g.quadraticCurveTo(-10, 15, -10, 12); g.lineTo(-10, 3); g.quadraticCurveTo(-10, -5, -4, -9); g.closePath();
    fillStroke(g, lin(g, -10, 0, 10, 0, '#a8161d', '#ef3b3b', '#b5191f'), 1.8);
    g.beginPath(); g.roundRect(-5, -19, 10, 5, 1.6); fillStroke(g, '#2a2a33', 1.5);
    g.beginPath(); g.roundRect(-8.2, -2, 16.4, 11, 2); fillStroke(g, '#fff4d2', 1.4);
    const f = 1 + Math.sin(t * 14) * 0.12; g.save(); g.translate(0, 3.5); g.scale(f, f);
    g.beginPath(); g.moveTo(0, -5); g.quadraticCurveTo(4.5, -1, 3.2, 2.5); g.quadraticCurveTo(0, 5, -3.2, 2.5); g.quadraticCurveTo(-4, -1, 0, -5); fillStroke(g, '#ff7a1a', 1.1);
    g.beginPath(); g.moveTo(0, -1.5); g.quadraticCurveTo(2, 0.5, 1.2, 2.5); g.quadraticCurveTo(-1.2, 3, -1.2, 1); g.closePath(); g.fillStyle = '#ffd23a'; g.fill(); g.restore();
    shine(g, -6, -3, 1.4, 5, 0.1, 0.45);
  };
  P.slime = (g, t) => {
    const w = Math.sin(t * 8) * 0.8;
    g.beginPath(); g.moveTo(-13, 8); g.bezierCurveTo(-15, -4, -7, -12, 0, -12 + w); g.bezierCurveTo(8, -12 + w, 15, -4, 13, 8); g.bezierCurveTo(10, 11, 7, 7, 4, 11 + w); g.bezierCurveTo(1, 14, -2, 8, -5, 11); g.bezierCurveTo(-8, 13, -11, 9, -13, 8); g.closePath();
    fillStroke(g, rad(g, -3, -5, 1, 18, '#b8ff7a', '#5fd638', '#2f9a1c'), 1.8);
    shine(g, -5, -6, 4, 2.2, -0.6, 0.75);
    for (const [x, y, r] of [[5, 0, 2], [-6, 3, 1.4], [8, 5, 1.2]]) { circ(g, x, y, r); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fill(); g.strokeStyle = 'rgba(30,110,20,0.5)'; g.lineWidth = 0.8; g.stroke(); }
    ell(g, 3.5, 14, 2, 3); fillStroke(g, '#5fd638', 1.3);
  };
  P.pan = g => {
    g.save(); g.rotate(0);
    g.beginPath(); g.roundRect(7, -2.6, 13, 5.2, 2.6); fillStroke(g, lin(g, 0, -3, 0, 3, '#7a4c28', '#452a14'), 1.7); circ(g, 17.6, 0, 1); g.fillStyle = '#1b1722'; g.fill();
    circ(g, -3, 0, 12.5); fillStroke(g, rad(g, -7, -4, 1, 15, '#6c7384', '#33384a', '#1b1f2c'), 1.9);
    circ(g, -3, 0, 9.4); g.fillStyle = rad(g, -5, -3, 1, 10, '#3e4458', '#242838'); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.stroke();
    shine(g, -8, -6, 4.8, 1.9, -0.7, 0.45);
    g.restore();
  };
  P.glove = (g, t) => {
        g.strokeStyle = '#8b94a8'; g.lineWidth = 3.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < 4; i++) { const x = -17 + i * 3.2; g.moveTo(x, -2.4); g.lineTo(x + 1.6, 2.4); g.lineTo(x + 3.2, -2.4); } g.stroke();
    g.beginPath(); g.moveTo(-4, -7); g.bezierCurveTo(6, -13, 18, -10, 18, -1); g.bezierCurveTo(18, 7, 12, 11, 5, 9); g.lineTo(-4, 8); g.closePath(); fillStroke(g, rad(g, 6, -6, 1, 20, '#ff6a5e', '#e02f2f', '#a51f24'), 1.9);
    ell(g, 8, 6.5, 6.8, 2.8, 0.05); g.fillStyle = 'rgba(120,10,15,0.35)'; g.fill();
    g.beginPath(); g.roundRect(-6, -7.5, 5, 16.5, 1.6); fillStroke(g, '#f6f3ea', 1.5);
    shine(g, 9, -6.6, 5, 1.6, -0.15, 0.55);
  };
  P.beachball = (g, t) => {
    g.save(); circ(g, 0, 0, 14); g.clip();
    const cols = ['#ff4f6a', '#ffd23a', '#37b4ff', '#ffffff', '#4be08a', '#ff9a3c'];
    for (let i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 18, i * TAU / 6 + t * 0.0, (i + 1) * TAU / 6 + 0.01); g.closePath(); g.fill(); }
    g.fillStyle = rad(g, -5, -6, 1, 16, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)', 'rgba(0,0,60,0.2)'); g.fillRect(-16, -16, 32, 32);
    g.restore(); circ(g, 0, 0, 14); stroke(g, 1.9);
    circ(g, 0, 0, 2.2); fillStroke(g, '#fff', 1.2);
    shine(g, -6, -7.5, 3.6, 1.7, -0.75, 0.85);
  };
  P.glue = (g, t) => {
    g.beginPath(); g.moveTo(-4.4, -9); g.lineTo(4.4, -9); g.lineTo(9, -2); g.lineTo(9, 12); g.quadraticCurveTo(9, 15, 6, 15); g.lineTo(-6, 15); g.quadraticCurveTo(-9, 15, -9, 12); g.lineTo(-9, -2); g.closePath();
    fillStroke(g, lin(g, -9, 0, 9, 0, '#d7dbe5', '#ffffff', '#c3c9d8'), 1.8);
    g.beginPath(); g.moveTo(-3.4, -9); g.lineTo(-2, -16); g.lineTo(2, -16); g.lineTo(3.4, -9); g.closePath(); fillStroke(g, '#ff8a1f', 1.6);
    g.beginPath(); g.roundRect(-7.5, -1, 15, 10, 1.8); fillStroke(g, '#4a7bff', 1.3);
    g.fillStyle = '#fff'; g.font = '900 5.6px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GLUE', 0, 4.4);
    g.beginPath(); g.moveTo(-1.2, -16); g.quadraticCurveTo(0, -20 - Math.abs(Math.sin(t * 5)) * 2, 1.2, -16); g.fillStyle = '#fff'; g.fill(); stroke(g, 1);
    shine(g, -5.8, 2, 1.1, 6, 0, 0.7);
  };

  /* --------------------------------------------------------------- enemy ammo */
  P.e_bomb = (g, t) => {
    circ(g, 0, 2, 12.4); fillStroke(g, rad(g, -4, -2, 1, 16, '#5b6378', '#272b38', '#14161e'), 1.9);
    shine(g, -5, -3, 3.8, 1.8, -0.7, 0.45);
    g.beginPath(); g.roundRect(-3.5, -14.5, 7, 5.4, 1.4); fillStroke(g, '#4a5063', 1.5);
    g.strokeStyle = '#9a8a6a'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -14.5); g.quadraticCurveTo(5, -20, 9, -17); g.stroke();
    const f = 2.6 + Math.sin(t * 40) * 1.2;
    g.globalCompositeOperation = 'lighter'; circ(g, 9, -17, f + 3.5); g.fillStyle = 'rgba(255,140,60,0.5)'; g.fill(); g.globalCompositeOperation = 'source-over';
    circ(g, 9, -17, f + 1.2); g.fillStyle = '#ff7a3a'; g.fill(); circ(g, 9, -17, f * 0.55); g.fillStyle = '#fff0b8'; g.fill();
  };
  P.e_ball = g => {
    circ(g, 0, 0, 10); fillStroke(g, rad(g, -3, -3, 1, 12, '#ffffff', '#efe9d8', '#cfc6ad'), 1.7);
    g.strokeStyle = '#d83b3b'; g.lineWidth = 1.5; g.beginPath(); g.arc(-9, 0, 8, -0.95, 0.95); g.stroke(); g.beginPath(); g.arc(9, 0, 8, Math.PI - 0.95, Math.PI + 0.95); g.stroke();
  };
  P.e_pin = g => {
    g.beginPath(); g.moveTo(-3, -15); g.quadraticCurveTo(-5, -9, -3, -5); g.quadraticCurveTo(-9, 3, -5, 15); g.lineTo(5, 15); g.quadraticCurveTo(9, 3, 3, -5); g.quadraticCurveTo(5, -9, 3, -15); g.closePath();
    fillStroke(g, lin(g, -8, 0, 8, 0, '#e7e2d6', '#ffffff', '#d3ccbb'), 1.6);
    g.save(); g.clip(); g.fillStyle = '#b05be0'; g.fillRect(-8, -8, 16, 3.4); g.fillRect(-8, -2, 16, 2); g.restore();
  };
  P.e_dart = g => {
    line(g, -10, 0, 8, 0, 3.4, '#c9cedb'); poly(g, [8, -3.4, 17, 0, 8, 3.4]); fillStroke(g, '#eef1f8', 1.4);
    poly(g, [-10, 0, -16.5, -6.5, -12.5, 0, -16.5, 6.5]); fillStroke(g, '#e06aa5', 1.4);
  };
  P.e_barrel = g => {
    g.beginPath(); g.roundRect(-13, -16, 26, 32, 7); fillStroke(g, lin(g, -13, 0, 13, 0, '#7a4f26', '#b4834f', '#7a4f26'), 1.9);
    g.fillStyle = 'rgba(255,255,255,0)'; g.fillRect(-9, -15, 4.5, 30);
    for (const y of [-10.5, 6.5]) { g.fillStyle = lin(g, 0, y, 0, y + 4, '#6a7184', '#3a3f4e'); g.fillRect(-13.5, y, 27, 4.4); }
  };

  /* --------------------------------------------------------- props and extras */
  P.crate = g => {
    g.beginPath(); g.roundRect(-15, -15, 30, 30, 3.4); fillStroke(g, lin(g, -15, -15, 15, 15, '#d6a46a', '#b98a52', '#9a6e3c'), 2);
    g.strokeStyle = '#7d5429'; g.lineWidth = 3; g.strokeRect(-12.8, -12.8, 25.6, 25.6);
    g.beginPath(); g.moveTo(-12, -12); g.lineTo(12, 12); g.moveTo(12, -12); g.lineTo(-12, 12); g.stroke();
    circ(g, 0, 0, 8.4); fillStroke(g, rad(g, -2, -2, 1, 9, '#ffc070', '#ff8a2a'), 1.7);
    g.fillStyle = '#1a1404'; g.font = '900 13px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 0, 1);
  };
  P.lid = g => {
    circ(g, 0, 0, 16); fillStroke(g, '#8690a2', 1.9); circ(g, 0, 0, 12.5); g.strokeStyle = 'rgba(30,34,50,0.28)'; g.lineWidth = 1.4; g.stroke();
    g.beginPath(); g.roundRect(-5, -2.2, 10, 4.4, 2.2); fillStroke(g, '#6d7586', 1.4); shine(g, -7, -8, 5, 1.8, -0.7, 0.5);
  };
  P.pot = g => {
    g.beginPath(); g.arc(0, 2, 13, Math.PI, 0); g.lineTo(13, 5); g.lineTo(-13, 5); g.closePath(); fillStroke(g, '#8690a2', 1.8);
    line(g, 12, 2, 22, 0, 3.4, '#6d7586'); shine(g, -4, -3, 6, 1.8, -0.5, 0.5);
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
  const TILT = { forks: 0.5, plunger: -0.6, firework: -0.6, knife: -0.5, pan: -0.5, glove: 0, pinata: 0, chicken: 0 };
  // how big each item may be drawn in a tile, and how far to shift it so it sits centred (in item units)
  const FIT = { chicken: 0.245, pinata: 0.25, glove: 0.285, plunger: 0.29, firework: 0.29, dynamite: 0.29, magnet: 0.3, duck: 0.3, pan: 0.3, anvil: 0.3, knife: 0.3, glue: 0.3, sauce: 0.3, sack: 0.31, beehive: 0.31, forks: 0.31 };
  const OFF = { chicken: [-4, 0], pinata: [-4, 5], dynamite: [0, 2], glue: [0, -1], plunger: [-1, 0], glove: [-1, 0], pan: [-3, 0], knife: [-1, 0], sauce: [0, -1], magnet: [0, -1] };
  function icon(id, size = 64) {
    const key = id + ':' + size;
    if (cache.has(key)) return cache.get(key);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const fit = FIT[id] || 0.34, k = size * fit / 14, off = OFF[id] || [0, 0];
    draw(g, id, size / 2 + off[0] * k, size / 2 + off[1] * k, TILT[id] || 0, size * fit, 0.3);
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
