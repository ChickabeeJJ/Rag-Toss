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
  function svg(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`; }
  function hydrate(root = document) {
    root.querySelectorAll('[data-icon]').forEach(el => {
      if (el.dataset.hydrated === el.dataset.icon) return;
      el.innerHTML = svg(el.dataset.icon);
      el.dataset.hydrated = el.dataset.icon;
    });
  }
  return { svg, hydrate };
})();
