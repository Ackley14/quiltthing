/* Rulers (View ▸ Rulers): inch or cm marks along the top and left of the block editor and the
   quilt canvases, measured from the block's or the quilt's top-left corner. They follow zoom and
   pan, and the tick spacing adapts to the zoom. */

const RULER = 20;   // px
function rulerScale() {
  // screen px per inch, and the screen position of the 0,0 corner
  const block = ui.view === 'block';
  if (block) {
    const b = activeBlock(), g = $('#ed-c');
    if (!b || b.kind !== 'drawn' || isHexBlock(b) || !g) return null;
    const m = g.getScreenCTM(); if (!m) return null;
    const perIn = m.a * gridScale(b) * b.n / blockFrameSize(b);
    return { perIn, x0: m.e, y0: m.f };
  }
  if (!['layout', 'quilting'].includes(ui.view)) return null;
  const svg = $('#main svg.quilt-svg'); if (!svg) return null;
  const m = svg.getScreenCTM(); if (!m) return null;
  return { perIn: m.a, x0: m.e, y0: m.f };
}
function drawRulers() {
  let host = $('#rulers');
  const s = prefs.rulers ? rulerScale() : null;
  if (!s) { host?.remove(); return; }
  if (!host) { host = document.createElement('div'); host.id = 'rulers'; host.setAttribute('aria-hidden', 'true'); $('#docwrap').appendChild(host); }
  const box = $('#docwrap').getBoundingClientRect(), cm = ui.units === 'cm';
  const unitPx = cm ? s.perIn / 2.54 : s.perIn;   // screen px per inch or per cm
  // label every 1, 2, 5, 10… units so labels stay about 50px apart; small ticks in between
  const steps = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100], label = steps.find(st => st * unitPx >= 46) || 100;
  const minor = label >= 2 ? label / (label % 5 === 0 ? 5 : 2) : label / 4;
  const marks = (len, origin) => {
    let h = '';
    const from = Math.floor(-origin / unitPx / minor) * minor, to = (len - origin) / unitPx;
    for (let u = from; u <= to; u += minor) {
      const px = origin + u * unitPx, big = Math.abs(u / label - Math.round(u / label)) < 1e-6;
      if (px < RULER || px > len) continue;
      h += `<i class="${big ? 'big' : ''}" style="--p:${px.toFixed(1)}px">${big ? `<b>${+u.toFixed(2)}</b>` : ''}</i>`;
    }
    return h;
  };
  host.innerHTML = `<div class="ruler top">${marks(box.width, s.x0 - box.left)}</div><div class="ruler left">${marks(box.height, s.y0 - box.top)}</div><div class="ruler-corner">${cm ? 'cm' : 'in'}</div>`;
}
Actions.toggleRulers = () => { prefs.rulers = !prefs.rulers; savePrefs(); drawRulers(); renderHud(); };
// keep them in step with zoom, pan, scrolling and resizing
for (const fn of ['applyView', 'qzApply']) {
  const run = window[fn];
  if (typeof run === 'function') window[fn] = function (...a) { const r = run.apply(this, a); drawRulers(); return r; };
}
document.addEventListener('scroll', e => { if (e.target.id === 'main') drawRulers(); }, true);
window.addEventListener('resize', debounce(drawRulers, 100));
