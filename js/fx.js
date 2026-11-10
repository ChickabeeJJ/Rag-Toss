'use strict';
/* =========================================================================
   Effects: particles, shock rings, lightning, flying debris and combat text.
   Everything is drawn in world space by Game.render.
   ========================================================================= */

const Fx = (() => {
  const parts = [], rings = [], texts = [], bolts = [], debris = [];
  const MAX = 900;

  function clear() { parts.length = rings.length = texts.length = bolts.length = debris.length = 0; }

  /* o: { color | colors, speed [min,max], life [min,max], size [min,max], grav, drag,
          shape 'dot' | 'rect' | 'spark' | 'smoke', ang, spread, vx, vy, glow } */
  function burst(x, y, n, o = {}) {
    const sp = o.speed || [60, 220], lf = o.life || [0.3, 0.7], sz = o.size || [2, 5];
    for (let i = 0; i < n && parts.length < MAX; i++) {
      const a = o.ang != null ? o.ang + rand(-1, 1) * (o.spread != null ? o.spread : 0.5) : rand(0, TAU);
      const v = rand(sp[0], sp[1]);
      const life = rand(lf[0], lf[1]);
      parts.push({
        x: x + rand(-1, 1) * (o.jitter || 0), y: y + rand(-1, 1) * (o.jitter || 0),
        vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v + (o.vy || 0),
        life, max: life, size: rand(sz[0], sz[1]), grav: o.grav != null ? o.grav : 900, drag: o.drag != null ? o.drag : 1.5,
        color: o.colors ? pick(o.colors) : (o.color || '#ffffff'), shape: o.shape || 'dot', rot: rand(0, TAU), vr: rand(-12, 12), glow: !!o.glow,
      });
    }
  }
  function ring(x, y, r0, r1, life = 0.35, color = '#ffffff', width = 4) { rings.push({ x, y, r0, r1, life, max: life, color, width }); }
  function text(x, y, str, color = '#ffffff', size = 22, vy = -70) {
    // nudge apart labels that would land on top of each other
    for (const t of texts) if (Math.abs(t.x - x) < 70 && Math.abs(t.y - y) < size) y -= size * 0.95;
    texts.push({ x, y, str, color, size, life: 0.95, max: 0.95, vy });
  }
  function bolt(x1, y1, x2, y2, color = '#fff9a8', life = 0.22) {
    const pts = [[x1, y1]];
    const n = Math.max(3, Math.floor(dist(x1, y1, x2, y2) / 28));
    for (let i = 1; i < n; i++) pts.push([lerp(x1, x2, i / n) + rand(-14, 14), lerp(y1, y2, i / n) + rand(-14, 14)]);
    pts.push([x2, y2]);
    bolts.push({ pts, color, life, max: life });
  }
  // a whole item sprite spinning away (lost helmets, broken lids, dropped ammo)
  function chunk(id, x, y, vx, vy, r, life = 1.6) { debris.push({ id, x, y, vx, vy, r, rot: rand(0, TAU), vr: rand(-10, 10), life, max: life }); }

  function explosion(x, y, r, hot = true) {
    ring(x, y, r * 0.2, r, 0.3, '#ffffff', 8);
    ring(x, y, r * 0.1, r * 0.75, 0.22, hot ? '#ffcf6a' : '#c9e2ff', 14);
    burst(x, y, 18, { colors: hot ? ['#fff3c0', '#ffb347', '#ff7a3a'] : ['#ffffff', '#cfe6ff'], speed: [120, r * 3.2], life: [0.25, 0.55], size: [4, 9], grav: 200, drag: 3, glow: true });
    burst(x, y, 12, { colors: ['#4a4652', '#35323c', '#5c5766'], speed: [40, r * 1.3], life: [0.6, 1.2], size: [10, 20], grav: -90, drag: 2.2, shape: 'smoke' });
    burst(x, y, 12, { color: '#ffe9a0', speed: [260, r * 5], life: [0.2, 0.45], size: [2, 3], grav: 500, drag: 1, shape: 'spark' });
  }
  function dust(x, y, n = 6, color = '#e9e2d0') { burst(x, y, n, { color, speed: [30, 130], life: [0.3, 0.6], size: [4, 9], grav: -40, drag: 3, shape: 'smoke', ang: -Math.PI / 2, spread: 1.3 }); }
  function hit(x, y, ang, color = '#ffffff', n = 8) {
    burst(x, y, n, { color, speed: [140, 420], life: [0.15, 0.4], size: [2, 3.5], grav: 700, drag: 2, shape: 'spark', ang: ang + Math.PI, spread: 1.0 });
    ring(x, y, 4, 26, 0.18, color, 3);
  }
  function confetti(x, y, n = 24) { burst(x, y, n, { colors: ['#ff5d73', '#ffc933', '#45e08a', '#4fa8ff', '#b05be0', '#ffffff'], speed: [120, 460], life: [0.7, 1.4], size: [4, 7], grav: 520, drag: 2.2, shape: 'rect' }); }

  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy = p.vy * d + p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt; if (rings[i].life <= 0) rings.splice(i, 1); }
    for (let i = bolts.length - 1; i >= 0; i--) { bolts[i].life -= dt; if (bolts[i].life <= 0) bolts.splice(i, 1); }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= Math.max(0, 1 - 2.4 * dt);
      if (t.life <= 0) texts.splice(i, 1);
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i]; d.life -= dt;
      d.vy += G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.vr * dt;
      if (d.life <= 0 || d.y > WORLD_H + 300) debris.splice(i, 1);
    }
  }

  function draw(ctx, time) {
    for (const d of debris) { ctx.globalAlpha = clamp(d.life / 0.4, 0, 1); ItemArt.draw(ctx, d.id, d.x, d.y, d.rot, d.r, time); }
    ctx.globalAlpha = 1;
    for (const p of parts) {
      const k = p.life / p.max;
      if (p.shape === 'smoke') {
        ctx.globalAlpha = k * 0.55; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, TAU); ctx.fill();
      } else if (p.shape === 'spark') {
        ctx.globalAlpha = Math.min(1, k * 2); ctx.strokeStyle = p.color; ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035); ctx.stroke();
      } else if (p.shape === 'rect') {
        ctx.globalAlpha = Math.min(1, k * 3); ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size / 2, -p.size * 0.3 * Math.abs(Math.cos(p.rot * 2)) - 0.5, p.size, p.size * 0.6 * Math.abs(Math.cos(p.rot * 2)) + 1); ctx.restore();
      } else {
        if (p.glow) { ctx.globalCompositeOperation = 'lighter'; Glow.draw(ctx, p.color, p.x, p.y, p.size * 2.6, k * 0.6); ctx.globalCompositeOperation = 'source-over'; }
        ctx.globalAlpha = Math.min(1, k * 2.5); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + k * 0.6), 0, TAU); ctx.fill();
      }
    }
    for (const r of rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = r.color; ctx.lineWidth = r.width * (1 - k) + 0.5;
      ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, easeOut(k)), 0, TAU); ctx.stroke();
    }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const b of bolts) {
      const k = b.life / b.max;
      for (const [w, c, a] of [[9, b.color, 0.35], [3, '#ffffff', 1]]) {
        ctx.globalAlpha = k * a; ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(b.pts[0][0], b.pts[0][1]);
        for (let i = 1; i < b.pts.length; i++) ctx.lineTo(b.pts[i][0], b.pts[i][1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // text is drawn last, over the whole scene
  function drawText(ctx) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    for (const t of texts) {
      const k = t.life / t.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.font = `900 ${Math.round(t.size * pop)}px Rubik, sans-serif`;
      ctx.lineWidth = Math.max(3, t.size * 0.22); ctx.strokeStyle = 'rgba(12,14,21,0.85)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  return { clear, burst, ring, text, bolt, chunk, explosion, dust, hit, confetti, update, draw, drawText };
})();
