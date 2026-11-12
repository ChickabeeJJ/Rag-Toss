'use strict';
/* =========================================================================
   Icons (24x24, currentColor). Any element with data-icon="name" is filled
   in by Icons.hydrate().
   ========================================================================= */

const Icons = (() => {
  const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  const F = 'fill="currentColor"';
  const P = {
    heart: `<path d="M12 20.5S3.5 15 3.5 9A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20.5 9c0 6-8.5 11.5-8.5 11.5z" ${F}/>`,
    star: `<path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" ${F}/>`,
    coin: `<circle cx="12" cy="12" r="9" ${F}/><circle cx="12" cy="12" r="6" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.6"/><path d="M12 8v8" stroke="rgba(0,0,0,.3)" stroke-width="2.2" stroke-linecap="round"/>`,
    pause: `<path d="M8.5 5v14M15.5 5v14" ${S} stroke-width="3.4"/>`,
    play: `<path d="M7 4.5v15l12.5-7.5z" ${F}/>`,
    back: `<path d="M15 5l-7 7 7 7" ${S} stroke-width="3"/>`,
    next: `<path d="M9 5l7 7-7 7" ${S} stroke-width="3"/>`,
    close: `<path d="M6 6l12 12M18 6 6 18" ${S} stroke-width="3"/>`,
    gear: `<path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" ${S}/><path d="M10.3 2.8h3.4l.6 2.6 2 1.1 2.5-.9 1.7 2.9-1.9 1.8v2.3l1.9 1.8-1.7 2.9-2.5-.9-2 1.1-.6 2.6h-3.4l-.6-2.6-2-1.1-2.5.9-1.7-2.9 1.9-1.8v-2.3L3.5 8.5l1.7-2.9 2.5.9 2-1.1z" ${S} stroke-width="1.9"/>`,
    scroll: `<path d="M6 3.5h11a2 2 0 0 1 2 2V18a2.5 2.5 0 0 1-2.5 2.5H7.5A2.5 2.5 0 0 1 5 18V5.5" ${F}/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" stroke="rgba(0,0,0,.35)" stroke-width="1.8" stroke-linecap="round"/>`,
    gift: `<rect x="3.5" y="9" width="17" height="11.5" rx="2" ${F}/><rect x="2.5" y="6.5" width="19" height="4" rx="1.4" ${F}/><path d="M12 6.5v14" stroke="rgba(0,0,0,.35)" stroke-width="2"/><path d="M12 6.5C10 3 6.5 3.5 7.5 5.5c.6 1.1 3 1 4.5 1zM12 6.5c2-3.5 5.5-3 4.5-1-.6 1.1-3 1-4.5 1z" ${S} stroke-width="1.8"/>`,
    lock: `<rect x="5" y="10.5" width="14" height="10" rx="2.4" ${F}/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>`,
    check: `<path d="M4.5 12.5l5 5 10-11" ${S} stroke-width="3"/>`,
    up: `<path d="M12 19V6M6 11.5 12 5.5l6 6" ${S} stroke-width="3"/>`,
    down: `<path d="M12 5v13M6 12.5l6 6 6-6" ${S} stroke-width="3"/>`,
    restart: `<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5M4.5 4v4.5H9" ${S} stroke-width="2.6"/>`,
    home: `<path d="M3 11.2 12 3.5l9 7.7V20.5H14.5v-6h-5v6H3z" ${F}/>`,
    skull: `<path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.3 4.2 3 5.3V20h10v-3.7c1.7-1.1 3-2.7 3-5.3a8 8 0 0 0-8-8z" ${F}/><circle cx="8.8" cy="11.5" r="2" fill="#1a1424"/><circle cx="15.2" cy="11.5" r="2" fill="#1a1424"/>`,
    flame: `<path d="M12 2.5c1 3.5 5.5 5.5 5.5 10.5a5.5 5.5 0 0 1-11 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3.2C10.5 8 11 5 12 2.5z" ${F}/>`,
    sound: `<path d="M4 9h4l5-4.5v15L8 15H4z" ${F}/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" ${S} stroke-width="2"/>`,
    music: `<path d="M9 18V5.5l11-2v12.5" ${S} stroke-width="2.4"/><circle cx="6.5" cy="18" r="2.8" ${F}/><circle cx="17.5" cy="16" r="2.8" ${F}/>`,
    shake: `<rect x="7" y="4" width="10" height="16" rx="2" ${F}/><path d="M3.5 8v8M20.5 8v8" ${S} stroke-width="2.2"/>`,
    rotate: `<rect x="3" y="7" width="18" height="10" rx="2" ${S} stroke-width="2.2"/><path d="M16 3.5c2 .2 3.6 1.4 4.3 3.2M20.5 3.5v3.3h-3.3" ${S} stroke-width="1.8"/>`,
    bag: `<path d="M5.5 8.5h13l1.5 10a2 2 0 0 1-2 2.3H6a2 2 0 0 1-2-2.3z" ${F}/><path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5" ${S} stroke-width="2.2"/>`,
    bolt: `<path d="M13.5 2.5 5 13.5h5.5l-1 8L18.5 10H13z" ${F}/>`,
    fist: `<path d="M6 10.5V8a1.6 1.6 0 0 1 3.2 0V7a1.6 1.6 0 0 1 3.2 0v.5a1.6 1.6 0 0 1 3.2 0V9a1.6 1.6 0 0 1 3.2 0v5a6.5 6.5 0 0 1-6.5 6.5h-1A6.3 6.3 0 0 1 6 14.2z" ${F}/><path d="M6 13h7" stroke="rgba(0,0,0,.3)" stroke-width="1.8" stroke-linecap="round"/>`,
    hand: `<path d="M7.5 12V6a1.5 1.5 0 0 1 3 0V4.5a1.5 1.5 0 0 1 3 0V6a1.5 1.5 0 0 1 3 0v2a1.5 1.5 0 0 1 3 0v6A6.5 6.5 0 0 1 13 20.5h-.8a6 6 0 0 1-4.6-2.1L4 14a1.6 1.6 0 0 1 2.4-2.1z" ${F}/>`,
    eye: `<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" ${F}/><circle cx="12" cy="12" r="3.2" fill="rgba(0,0,0,.45)"/>`,
    shield: `<path d="M12 2.8 4.5 5.5V11c0 5 3.2 8.4 7.5 10 4.3-1.6 7.5-5 7.5-10V5.5z" ${F}/>`,
    wing: `<path d="M3 13c5 0 8-2 10-7 0 2.5.5 3.5 1.8 4.6C16.5 9 18.5 7 21 6.5c-.5 6-4 12-11.5 12-3 0-5.5-2-6.5-5.5z" ${F}/>`,
    boom: `<path d="m12 2 2.2 5.2L19.5 5l-1.6 5.4L23 12l-5.1 1.6 1.6 5.4-5.3-2.2L12 22l-2.2-5.2L4.5 19l1.6-5.4L1 12l5.1-1.6L4.5 5l5.3 2.2z" ${F}/>`,
    crown: `<path d="M3 18.5 4.5 7l4.5 5 3-7 3 7 4.5-5 1.5 11.5z" ${F}/>`,
    trophy: `<path d="M7 3.5h10v5a5 5 0 0 1-10 0zM10 15h4v3.5h-4zM7.5 18.5h9v2h-9z" ${F}/><path d="M7 5H4c0 3 1.2 4.5 3.4 5M17 5h3c0 3-1.2 4.5-3.4 5" ${S} stroke-width="2"/>`,
    duck: `<circle cx="9" cy="7" r="3" ${F}/><path d="M9 11c4 0 6 2 7 5l3 .5v3H5.5v-3L7 16c-.3-2 .3-3.6 2-5z" ${F}/><path d="M3 21h18" ${S} stroke-width="1.8" opacity=".6"/>`,
    swap: `<path d="M4 8.5h13M13 4.5l4 4-4 4M20 15.5H7M11 11.5l-4 4 4 4" ${S} stroke-width="2.4"/>`,
  };

  /* ---- the perk icons: full colour, drawn on a 64x64 grid with one outline style ---- */
  const K = '#1b1722';
  const O = 'stroke="' + K + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  const star = (cx, cy, n, r1, r2, rot = 0) => { let d = ''; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + i * Math.PI / n; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1); } return d + 'Z'; };
  const PERK_ICONS = {
    heavy: `<rect x="17" y="50" width="30" height="10" rx="3" fill="#3a6bff" ${O}/><path d="M13 28c0-6 4-10 9-10 3 0 5 1 6 3 1-3 4-5 7-5s6 2 7 5c1-2 3-3 6-3 5 0 8 4 8 10v14c0 6-4 10-9 10H22c-5 0-9-4-9-10z" fill="#ff9a3c" ${O}/><path d="M23 28v12M32 26v12M41 28v12" stroke="#b5561a" stroke-width="2.6" stroke-linecap="round"/><path d="M14 44c-1-4 2-7 6-7h16c4 0 6 3 5 6s-3 5-7 5H20c-3 0-5-1-6-4z" fill="#ffc47a" ${O}/><path d="M18 24c1-2 3-3 5-3M30 22c1-1 3-2 4-2" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".8"/><path d="M52 10l6-4M56 20l6-1M54 30l6 3" stroke="#ff5d3c" stroke-width="3" stroke-linecap="round"/>`,
    twin: `<circle cx="24" cy="38" r="16" fill="#a9bbff" ${O}/><circle cx="40" cy="30" r="17" fill="#5b7cff" ${O}/><ellipse cx="34" cy="22" rx="6" ry="3" fill="#fff" opacity=".6" transform="rotate(-30 34 22)"/><path d="M50 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffe14d" ${O.replace('3','2')}/><path d="M40 24v12M34 30h12" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`,
    skin: `<path d="M32 56C8 40 4 24 15 15c6-4 13-1 17 5 4-6 11-9 17-5 11 9 7 25-17 41z" fill="#ff5d73" ${O}/><path d="M16 22c2-4 6-5 10-3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7" fill="none"/><rect x="27" y="22" width="10" height="24" rx="2.5" fill="#fff" ${O.replace('3','2.4')}/><rect x="20" y="29" width="24" height="10" rx="2.5" fill="#fff" ${O.replace('3','2.4')}/><rect x="28.6" y="23.6" width="6.8" height="20.8" rx="1.4" fill="#fff"/>`,
    lungs: `<rect x="28" y="6" width="8" height="22" rx="4" fill="#d6e0ff" ${O}/><path d="M28 24C13 24 7 44 9 54c2 5 16 5 20-5z" fill="#6fc0ff" ${O}/><path d="M36 24c15 0 21 20 19 30-2 5-16 5-20-5z" fill="#6fc0ff" ${O}/><path d="M26 28c-5 3-8 9-9 16M38 28c5 3 8 9 9 16" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".75"/><path d="M12 50c3 1 6 1 9-1M43 49c3 2 6 2 9 1" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".6"/>`,
    leech: `<path d="M32 22c-9-7-22 0-22 15 0 13 9 23 15 23 3 0 5-1 7-1s4 1 7 1c6 0 15-10 15-23 0-15-13-22-22-15z" fill="#ff4d5e" ${O}/><path d="M32 22c0-6 2-11 6-14" fill="none" stroke="#6b4a2a" stroke-width="3.6" stroke-linecap="round"/><path d="M38 12c6-5 14-3 15 2-5 4-12 3-15-2z" fill="#4be08a" ${O.replace('3','2.4')}/><path d="M17 33c0-5 3-8 7-9" stroke="#fff" stroke-width="3.4" stroke-linecap="round" fill="none" opacity=".75"/><circle cx="48" cy="44" r="7" fill="#ffd9a0" ${O.replace('3','2.2')}/><path d="M45 44h6M48 41v6" stroke="#e2434b" stroke-width="2.4" stroke-linecap="round"/>`,
    eye: `<path d="M3 32C11 17 21 11 32 11s21 6 29 21C53 47 43 53 32 53S11 47 3 32z" fill="#fff" ${O}/><circle cx="32" cy="32" r="13" fill="#4fa8ff" ${O}/><circle cx="32" cy="32" r="6.4" fill="${K}"/><circle cx="28" cy="27" r="3.2" fill="#fff"/><path d="M32 4v9M32 51v9M4 32h8M52 32h8" stroke="#ff4a5e" stroke-width="3.4" stroke-linecap="round"/>`,
    pop: `<path d="${star(32, 32, 10, 29, 16, -0.2)}" fill="#ff9a3c" ${O}/><path d="${star(32, 32, 10, 21, 12, 0.1)}" fill="#ffd23a" ${O.replace('3','2.4')}/><circle cx="32" cy="32" r="8.5" fill="#fff6c8" ${O.replace('3','2.4')}/><path d="M28 30h2M34 30h2M28.5 35.5c2 2 5 2 7 0" stroke="${K}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    big: `<circle cx="32" cy="32" r="19" fill="#ffb347" ${O}/><ellipse cx="25" cy="23" rx="7" ry="3.4" fill="#fff" opacity=".55" transform="rotate(-35 25 23)"/><text x="32" y="40" text-anchor="middle" font-family="Rubik,sans-serif" font-weight="900" font-size="23" fill="${K}">XL</text><path d="M8 20V8h12M44 8h12v12M56 44v12H44M20 56H8V44" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 20V8h12M44 8h12v12M56 44v12H44M20 56H8V44" fill="none" stroke="${K}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>`,
    crate: `<ellipse cx="32" cy="16" rx="12" ry="14" fill="#ff7a3a" ${O}/><ellipse cx="27" cy="11" rx="3.4" ry="5.4" fill="#fff" opacity=".55" transform="rotate(-20 27 11)"/><path d="M29 29h6l-3 4z" fill="#ff7a3a" ${O.replace('3','2')}/><path d="M32 33v7" stroke="#fff" stroke-width="2.4"/><rect x="14" y="40" width="36" height="20" rx="3" fill="#c79a62" ${O}/><path d="M14 46h36M14 54h36" stroke="#8a6236" stroke-width="2.4"/><path d="M16 42l32 16M48 42L16 58" stroke="#8a6236" stroke-width="2.6" stroke-linecap="round"/><text x="32" y="55" text-anchor="middle" font-family="Rubik,sans-serif" font-weight="900" font-size="15" fill="#fff" stroke="${K}" stroke-width="3" paint-order="stroke">?</text>`,
    rich: `<ellipse cx="32" cy="50" rx="20" ry="8" fill="#d49a1a" ${O}/><path d="M12 50v-8c0 4.4 9 8 20 8s20-3.6 20-8v8" fill="#f0b82e" ${O}/><ellipse cx="32" cy="40" rx="20" ry="8" fill="#e8a822" ${O}/><path d="M12 40v-8c0 4.4 9 8 20 8s20-3.6 20-8v8" fill="#ffd24a" ${O}/><ellipse cx="32" cy="30" rx="20" ry="8" fill="#ffd24a" ${O}/><ellipse cx="32" cy="30" rx="13" ry="4.6" fill="none" stroke="#c98a12" stroke-width="2.4"/><path d="M22 28c3-2 7-3 11-3" stroke="#fff" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".8"/><path d="M50 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff6c8" ${O.replace('3','2')}/>`,
    shove: `<path d="M8 14l18 18L8 50h12l18-18L20 14z" fill="#ff5d3c" ${O}/><path d="M30 14l18 18-18 18h12l18-18L42 14z" fill="#ff9a3c" ${O}/><path d="M12 22l9 9" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/><path d="M34 22l9 9" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/><path d="M4 56h14M4 8h10" stroke="${K}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
    hot: `<path d="M32 4C38 16 54 22 51 40 49 53 40 60 32 60 22 60 13 53 13 41 13 31 21 27 22 16 27 21 29 18 32 4z" fill="#ff4a2a" ${O}/><path d="M32 22c4 8 13 11 11 22-1 8-6 12-11 12s-10-4-11-11c-1-7 6-10 7-16 2 3 3 2 4-7z" fill="#ff9a3c" ${O.replace('3','2.4')}/><path d="M32 38c3 5 7 7 6 13-1 4-3 6-6 6s-6-2-6-6c0-5 4-6 6-13z" fill="#ffe14d" ${O.replace('3','2.2')}/><path d="M28 50c0 3 1 4 4 4" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    spring: `<rect x="12" y="52" width="40" height="7" rx="3" fill="#8b94a8" ${O}/><rect x="12" y="5" width="40" height="7" rx="3" fill="#8b94a8" ${O}/><path d="M16 49L48 43L16 37L48 31L16 25L48 19L16 13" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 49L48 43L16 37L48 31L16 25L48 19L16 13" fill="none" stroke="#3fe0a2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 47l14-2.6M20 35l14-2.6M20 23l14-2.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".65"/>`,
    cheap: `<path d="M12 56C8 30 24 8 54 6c-2 24-16 44-42 50z" fill="#b8e4ff" ${O}/><path d="M12 56C26 40 38 26 52 8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M24 44c2-5 6-9 12-11M30 36c0-5 2-8 6-11M20 50c4-1 9-2 13-5" stroke="#5aa8e0" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M46 44l7 8M54 44l-7 8" stroke="none"/><path d="M42 50h14M49 43v14" stroke="none"/>`,
  };
  function perk(id) { return `<svg viewBox="0 0 64 64" aria-hidden="true">${PERK_ICONS[id] || ''}</svg>`; }
  function svg(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`; }
  function hydrate(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.hydrated === el.dataset.icon) return;
      el.innerHTML = svg(el.dataset.icon);
      el.dataset.hydrated = el.dataset.icon;
    });
  }
  return { svg, hydrate, perk };
})();
