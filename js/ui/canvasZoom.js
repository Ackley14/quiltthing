/* Zoom and pan for the quilt canvases (Layout and Quilting). The zoom is the svg's viewBox, the
   same way the block editor zooms: Ctrl + scroll zooms at the pointer, + and − step, 0 fits.
   Zoomed in, scrolling pans, and so does dragging with the middle button or with Space held
   (a plain drag still paints and places in Layout). Each step keeps its own zoom. */

const QZ_VIEWS = ['layout', 'quilting'];
const _qz = { layout: { z: 1 }, quilting: { z: 1 }, space: false, pan: null };
const qzState = () => _qz[ui.view] || { z: 1 };
const qzSvg = () => QZ_VIEWS.includes(ui.view) ? $('#main svg.quilt-svg') : null;
const qzZoom = () => qzState().z;

// the whole-quilt viewBox, as drawn
function qzBase(svg) {
  if (!svg.dataset.vb0) svg.dataset.vb0 = svg.getAttribute('viewBox');
  return svg.dataset.vb0.split(/[ ,]+/).map(Number);
}
function qzApply(svg = qzSvg()) {
  if (!svg) return;
  const [x0, y0, W, H] = qzBase(svg), s = qzState();
  if (s.z <= 1) svg.setAttribute('viewBox', [x0, y0, W, H].join(' '));
  else {
    const w = W / s.z, h = H / s.z;
    s.cx = clamp(s.cx ?? x0 + W / 2, x0 + w / 2, x0 + W - w / 2);
    s.cy = clamp(s.cy ?? y0 + H / 2, y0 + h / 2, y0 + H - h / 2);
    svg.setAttribute('viewBox', [s.cx - w / 2, s.cy - h / 2, w, h].map(v => round(v, 4)).join(' '));
  }
  svg.classList.toggle('zoomed', s.z > 1);
  const lbl = $('#q-zoom'); if (lbl) lbl.textContent = `${Math.round(s.z * 100)}%`;
}
// Zoom to z, keeping the point `at` (quilt units) where it is on screen.
function qzSet(z, at) {
  const svg = qzSvg(); if (!svg) return;
  const s = qzState(), cur = svg.getAttribute('viewBox').split(/[ ,]+/).map(Number), [, , W, H] = qzBase(svg);
  z = clamp(z, 1, 12);
  const p = at || [cur[0] + cur[2] / 2, cur[1] + cur[3] / 2];
  const fx = (p[0] - cur[0]) / cur[2], fy = (p[1] - cur[1]) / cur[3], w = W / z, h = H / z;
  s.z = z; s.cx = p[0] - fx * w + w / 2; s.cy = p[1] - fy * h + h / 2;
  qzApply(svg);
}
Actions.qZoomBy = dir => qzSet(dir === 'fit' ? 1 : qzZoom() * (dir === 'in' ? 1.5 : 1 / 1.5));
function qzPanBy(dx, dy) { const s = qzState(); if (s.z <= 1) return; s.cx += dx; s.cy += dy; qzApply(); }

// after each render of a quilt canvas: restore its zoom and listen for zooming and panning
function qzAttach(root) {
  const svg = QZ_VIEWS.includes(ui.view) && root?.querySelector('svg.quilt-svg');
  if (!svg) return;
  qzApply(svg);
  svg.addEventListener('wheel', e => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); qzSet(qzZoom() * (e.deltaY < 0 ? 1.2 : 1 / 1.2), svgPoint(svg, e)); return; }
    if (qzZoom() > 1) {
      e.preventDefault();
      const px = 1 / svg.getScreenCTM().a;
      qzPanBy((e.shiftKey ? e.deltaY : e.deltaX) * px, (e.shiftKey ? 0 : e.deltaY) * px);
    }
  }, { passive: false });
  // capture, so a pan drag never reaches the Layout tools
  svg.addEventListener('pointerdown', e => {
    if (!(e.button === 1 || (_qz.space && e.button === 0))) return;
    e.preventDefault(); e.stopImmediatePropagation();
    _qz.pan = { x: e.clientX, y: e.clientY, k: 1 / svg.getScreenCTM().a };
    svg.setPointerCapture(e.pointerId);
    svg.classList.add('panning');
  }, { capture: true });
  svg.addEventListener('pointermove', e => {
    if (!_qz.pan) return;
    e.stopImmediatePropagation();
    qzPanBy(-(e.clientX - _qz.pan.x) * _qz.pan.k, -(e.clientY - _qz.pan.y) * _qz.pan.k);
    _qz.pan.x = e.clientX; _qz.pan.y = e.clientY;
  }, { capture: true });
  const end = e => { if (!_qz.pan) return; e.stopImmediatePropagation(); _qz.pan = null; svg.classList.remove('panning'); };
  svg.addEventListener('pointerup', end, { capture: true });
  svg.addEventListener('pointercancel', end, { capture: true });
}
// a redraw inside the same svg (Layout drags) brings the whole-quilt viewBox back
function qzRebase(svg, vb) { svg.dataset.vb0 = vb; qzApply(svg); }

document.addEventListener('keydown', e => {
  if (!QZ_VIEWS.includes(ui.view) || e.ctrlKey || e.metaKey || e.altKey || $('#modal-root').innerHTML) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  if (e.key === ' ' && !e.target.closest?.('button')) { e.preventDefault(); if (!_qz.space) { _qz.space = true; qzSvg()?.classList.add('pan'); } return; }
  if (e.key === '+' || e.key === '=') { Actions.qZoomBy('in'); return; }
  if (e.key === '-' || e.key === '_') { Actions.qZoomBy('out'); return; }
  if (e.key === '0') Actions.qZoomBy('fit');
});
document.addEventListener('keyup', e => { if (e.key === ' ' && _qz.space) { _qz.space = false; qzSvg()?.classList.remove('pan'); } });
window.addEventListener('blur', () => { _qz.space = false; });
