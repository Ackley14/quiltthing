/* Smaller pieces of the v4 interface: the welcome screen, the second-tab guard, F6 region
   cycling, length fields that step and explain mistakes, the cursor position in the status bar,
   and the selection-size HUD widget. */

/* ---------- welcome: one screen for new people and for v3 users ---------- */
function welcomeV4(whatsNew) {
  const v3 = !!localStorage.getItem('quiltthing.v3.ui') || whatsNew;
  // starting over replaces the design in this browser, so only offer it when there's nothing to lose
  const fresh = !whatsNew && !v3 && !window._hadStoredDesign;
  const theme = t => `<button class="btn" data-act="welcomeTheme" data-arg="${t}" aria-pressed="${prefs.theme === t}">${t === 'dark' ? 'Dark' : 'Light'}</button>`;
  openModal(`<h2>${v3 ? 'Welcome to the new Quilt Designer' : 'Quilt Designer'}</h2>
    <p>${v3 ? 'Everything you had is here, in a new layout. Your quilts, fabrics and saved designs carry over.' : 'Design blocks, lay out a quilt and print the pattern. Your work saves in this browser.'}</p>
    ${v3 ? `<div class="welcome-moved"><h4>Where things moved</h4><ul>
      <li><b>Steps</b> are the tabs at the top: Blocks, Layout, Quilting, Fabric &amp; cutting, Pattern.</li>
      <li><b>Tools</b> are the strip down the left; their options are in the bar above the canvas.</li>
      <li><b>Fabrics and blocks</b> are panels on the left; <b>settings</b> are in Properties on the right.</li>
      <li>Layout's borders, sashing, binding and panels are listed in the <b>Quilt</b> panel.</li>
      <li>Panels can be moved, folded or closed. <b>Window</b> brings any panel back and resets the layout.</li>
      <li>Press <kbd>Ctrl K</kbd> to search for any command.</li></ul></div>` : ''}
    <div class="welcome-prefs"><span>Look</span><div class="btn-row" style="margin:0">${theme('dark')}${theme('light')}</div>
      <label class="f" style="margin:0">Canvas colour<select data-change="setSurround">${Object.entries(SURROUNDS).map(([k, [l]]) => `<option value="${k}" ${prefs.surround === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check" style="margin:0"><input type="checkbox" data-change="welcomeLarge" ${prefs.density === 'large' ? 'checked' : ''}> Larger text</label></div>
    <div class="actions welcome-actions">${fresh ? '<button class="btn" data-act="welcomeBlank">Start a new quilt</button><button class="btn" data-act="welcomeClassic">Start from a classic block</button>' : ''}<button class="btn" data-act="startTour">Take a quick tour</button><span class="grow"></span><button class="btn primary" data-act="closeModal">${whatsNew ? 'Close' : v3 ? 'Carry on' : 'Explore the sample'}</button></div>`,
    () => { prefs.welcomed = true; ui.seenTour = true; savePrefs(); saveUi(); });
  $('#modal-root .modal').classList.add('wide');
}
Actions.welcomeTheme = t => { prefs.theme = t; savePrefs(); applyPrefs(); render(); welcomeV4(_welcomeWhatsNew); setTimeout(() => $(`#modal-root [data-act="welcomeTheme"][data-arg="${t}"]`)?.focus(), 40); };
let _welcomeWhatsNew = false;
Actions.welcomeLarge = v => { prefs.density = v ? 'large' : 'standard'; savePrefs(); applyPrefs(); render(); };
Actions.whatsNew = () => { _welcomeWhatsNew = true; welcomeV4(true); };

/* ---------- second tab: warn when the design changes somewhere else ---------- */
window.addEventListener('storage', e => {
  if (!['quiltthing.v3.doc', 'quiltthing.v3.refs'].includes(e.key) || !e.newValue || (e.key === 'quiltthing.v3.doc' ? e.newValue === snapshot() : e.newValue === JSON.stringify(refImgs))) return;
  savePaused = true;
  let bar = $('#tab-guard');
  if (!bar) { bar = document.createElement('div'); bar.id = 'tab-guard'; bar.setAttribute('role', 'alert'); document.body.appendChild(bar); }
  bar.innerHTML = `${icon('warn', 16)}<span>This design was changed in another tab or window. Saving here is paused so that work isn't replaced.</span><button class="btn small primary" data-act="tabGuardLoad">Load the other version</button><button class="btn small" data-act="tabGuardKeep">Keep this one</button>`;
});
Actions.tabGuardLoad = () => location.reload();
Actions.tabGuardKeep = () => { $('#tab-guard')?.remove(); savePaused = false; saveNow(); saveRefs(); renderSaveState(); toast('Kept this version; saving again'); };

/* ---------- F6: jump between regions (app bar, tool options, tools, panels, canvas, status) ---------- */
const REGIONS = ['#appbar', '#ctxbar', '#toolstrip', '#dock-left', '#flyout-layer', '#docarea', '#dock-right', '#dock-bottom', '#float-layer', '#statusbar'];
const isShown = x => x.getClientRects().length > 0 && getComputedStyle(x).visibility !== 'hidden';
document.addEventListener('keydown', e => {
  if (e.key !== 'F6' || $('#modal-root').innerHTML) return;
  e.preventDefault();
  const live = REGIONS.map(s => $(s)).filter(el => el && (el.id === 'docarea' || [...el.querySelectorAll('button, input, select, [tabindex]')].some(x => isShown(x) && !x.disabled && x.tabIndex !== -1 || x.matches('[aria-selected="true"]'))));
  if (!live.length) return;
  const i = live.findIndex(el => el.contains(document.activeElement));
  const next = live[(i + (e.shiftKey ? -1 : 1) + live.length) % live.length];
  // the selected tab or pressed tool first, else the first visible control
  const shown = sel => [...next.querySelectorAll(sel)].find(x => isShown(x) && !x.disabled);
  const target = next.id === 'docarea' ? $('#main') : shown('[aria-selected="true"][tabindex="0"]') || shown('[aria-pressed="true"]') || shown('button, input, select, [tabindex="0"]');
  target?.focus();
  if (target?.id === 'main') { target.classList.add('kbd-focus'); target.addEventListener('blur', () => target.classList.remove('kbd-focus'), { once: true }); }
  announce(next.getAttribute('aria-label') || next.id.replace(/^dock-/, '') + ' panels');
});

/* ---------- length fields: arrow keys step, Esc puts the old value back, mistakes shown on the field ---------- */
document.addEventListener('focusin', e => { const el = e.target; if (el.matches?.('input[data-type="len"]')) el.dataset.was = el.value; });
document.addEventListener('keydown', e => {
  const el = e.target;
  if (!el.matches?.('input[data-type="len"]')) return;
  if (e.key === 'Escape') { el.value = el.dataset.was ?? el.value; el.classList.remove('invalid'); el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); el.nextElementSibling?.classList?.contains('field-err') && el.nextElementSibling.remove(); delete el.dataset.stepped; el.blur(); e.stopImmediatePropagation(); e.preventDefault(); return; }
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const path = el.dataset.bind, cur = path ? parseLenExpr(el.value, getPath(doc, path)) : parseLenExpr(el.value);
  if (!Number.isFinite(cur)) return;
  // inches: 1/8" (Shift 1", Alt 1/16"); centimetres: 0.5 cm (Shift 1 cm, Alt 1 mm)
  const own = +el.dataset.step || 0;   // a box with arrows steps by the same amount as its arrows
  const step = own && !e.altKey && !e.shiftKey ? own : ui.units === 'cm' ? (e.shiftKey ? 1 : e.altKey ? 0.1 : 0.5) / 2.54 : e.shiftKey ? 1 : e.altKey ? 1 / 16 : 1 / 8;
  const lo = el.dataset.min !== undefined ? +el.dataset.min : 0, hi = el.dataset.max !== undefined ? +el.dataset.max : Infinity;
  const v = clamp(own && !e.altKey && !e.shiftKey ? round(cur + (e.key === 'ArrowUp' ? step : -step), 4) : Math.round((cur + (e.key === 'ArrowUp' ? step : -step)) / step) * step, lo, hi);
  el.value = inputLen(v);
  el.dataset.stepped = '1';
}, true);
// a stepped value saves when the field is left (Enter leaves it too)
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el.matches?.('input[data-type="len"][data-stepped]')) { delete el.dataset.stepped; if (el.value !== el.dataset.was) el.dispatchEvent(new Event('change', { bubbles: true })); }
}, true);
// a length that can't be read: say so on the field and keep the old value
function lenFieldError(el, raw) {
  el.classList.add('invalid');
  let msg = el.parentElement.querySelector('.field-err');
  if (!msg) { msg = document.createElement('div'); msg.className = 'field-err'; msg.id = `ferr-${Math.random().toString(36).slice(2, 8)}`; msg.setAttribute('role', 'alert'); el.insertAdjacentElement('afterend', msg); }
  el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', msg.id);
  msg.textContent = `Couldn't read "${raw}". Try 4.5, 4 1/2, 4-1/2, 4½ or 11cm.`;
  el.value = el.dataset.was ?? el.value;
  setTimeout(() => el.focus(), 0);
}

/* ---------- cursor position in the status bar ---------- */
document.addEventListener('pointermove', e => {
  const chip = $('#sb-pos'); if (!chip) return;
  const svg = e.target.closest?.('#main svg.editor, #main svg.quilt-svg');
  if (!svg) { chip.textContent = ''; return; }
  let x, y;
  try {
    if (svg.classList.contains('editor')) { const b = activeBlock(); if (!b || b.kind !== 'drawn') return; const g = evtGrid(e, b), k = blockFrameSize(b) / b.n; [x, y] = [g[0] * k, g[1] * k]; }
    else [x, y] = svgPoint(svg, e);
  } catch { return; }
  chip.textContent = `${fmtLen(Math.max(0, x))}, ${fmtLen(Math.max(0, y))}`;
}, { passive: true });

/* ---------- HUD: size of the selected shape ---------- */
HUD_WIDGETS.selsize = {
  label: 'Selected shape size', corner: 'bl', ws: ['block'],
  html: () => {
    const b = activeBlock(); if (!b || b.kind !== 'drawn' || ui.tool !== 'select') return '';
    const sel = selList(); if (!sel.length) return '';
    const k = blockFrameSize(b) / b.n, pts = sel.flatMap(i => b.regions[i].pts), bb = bounds(pts);
    const name = sel.length === 1 ? regionName(b, b.regions[sel[0]]) : plural(sel.length, 'shape');
    return `<div class="hud-info"><b>${esc(name)}</b> · ${inputLen(bb.w * k)} × ${inputLen(bb.h * k)}${ui.units === 'cm' ? ' cm' : '"'} finished</div>`;
  },
};

/* ---------- names for undo steps made on the canvas or with keys (History panel) ---------- */
const TOOL_STEP = { paint: 'Paint', fill: 'Fill', erase: 'Erase', polygon: 'Draw shape', rect: 'Draw rectangle', tri: 'Draw triangle', arc: 'Draw quarter circle', seam: 'Seam line', text: 'Add text' };
function gestureName(e) {
  if (ui.view === 'block') {
    if (ui.tool === 'select') return e.target.closest?.('[data-vh], [data-eh]') ? 'Reshape shape' : 'Move shapes';
    return TOOL_STEP[ui.tool] || null;
  }
  if (ui.view === 'layout') {
    if (e.button === 2) return 'Clear position';
    return { place: 'Place block', paintcell: 'Paint', select: 'Move panel' }[layoutTool()] || null;
  }
  return null;
}
document.addEventListener('pointerdown', e => { if (e.target.closest?.('#main')) gestureLabel = gestureName(e); }, true);
document.addEventListener('pointerup', () => setTimeout(() => { gestureLabel = null; }, 0), true);
document.addEventListener('drop', e => { if (e.target.closest?.('#main')) { nextCommitLabel = dragBlockId ? 'Place block' : 'Paint'; setTimeout(() => { nextCommitLabel = null; }, 0); } }, true);
const KEY_STEP = { Delete: 'Delete', Backspace: 'Delete', ArrowUp: 'Nudge', ArrowDown: 'Nudge', ArrowLeft: 'Nudge', ArrowRight: 'Nudge' };
document.addEventListener('keydown', e => {
  if (e.target.closest?.('input, select, textarea')) return;
  const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
  const name = KEY_STEP[e.key] || (ctrl ? { d: 'Duplicate', v: 'Paste', x: 'Cut' }[k] : ui.view === 'block' ? { q: 'Rotate', e: 'Rotate', x: 'Flip', y: 'Flip' }[k] : ui.view === 'layout' ? { r: 'Turn block', f: 'Flip block' }[k] : null);
  if (name) { nextCommitLabel = name; setTimeout(() => { nextCommitLabel = null; }, 0); }
}, true);

/* ---------- HUD: seam help (the warning triangle) ---------- */
HUD_WIDGETS.seam = {
  label: 'Seam warning', corner: 'bl', ws: ['block'],
  html: () => {
    const b = activeBlock(); if (!b || b.kind !== 'drawn' || ui.tool === 'seam') return '';
    const sg = _seamState.block === b.id && _seamState.key === blockKey(b) ? _seamState.s : null;
    if (!sg?.required.length) return '';
    const t = `${plural(sg.reqPieces, 'piece')} need${sg.reqPieces === 1 ? 's' : ''} set-in seams as drawn. Click for the Seam tool.`;
    return `<button class="seam-flag" data-act="blockTool" data-arg="seam" title="${t}" aria-label="${t}">${icon('warn', 18)}<span>Seams</span></button>`;
  },
};

document.addEventListener('keydown', e => {
  if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.code !== 'Digit1' || e.target.closest?.('input, select, textarea') || $('#modal-root').innerHTML) return;
  e.preventDefault();
  if (ui.view === 'block') Actions.edZoomBy('fit'); else if (['layout', 'quilting'].includes(ui.view)) Actions.qZoomBy('fit');
}, true);

const TOUR = [
  ['#ws-tabs', 'Steps', 'Work moves left to right: draw blocks, lay out the quilt, plan the quilting, then fabric & cutting and the printed pattern. Keys 1 to 5 jump between them.'],
  ['[data-panel="fabrics"], .dstrip-b[data-arg="fabrics"]', 'Fabrics', 'Click a fabric to paint with it, and click it again to edit it. Palettes recolour the whole quilt at once.'],
  ['[data-panel="blocks"], .dstrip-b[data-arg="blocks"]', 'Blocks', 'Add blocks from the library or draw your own. In Layout, pick a block and click the quilt to place it.'],
  ['#toolstrip', 'Tools', 'Drawing and painting tools. The bar above the canvas shows the options for the tool you pick.'],
  ['#dock-right', 'Panels', 'Settings for whatever is selected are in Properties. Panels can be folded, moved or closed; the Window menu brings any panel back.'],
  ['#appbar [data-act="commandPalette"]', 'Search', 'Press Ctrl K and type what you want to do, like "border", "print" or "palette". Your work saves as you go; File, Save keeps a named copy.'],
];
let _tour = -1;
Actions.startTour = () => { closeModal(); _tour = 0; showTour(); };
function showTour() {
  $('#tour')?.remove();
  if (_tour < 0 || _tour >= TOUR.length) { _tour = -1; return; }
  const [sel, title, text] = TOUR[_tour], el = [...document.querySelectorAll(sel)].find(x => x.offsetParent !== null || x.getClientRects().length);
  const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0, right: innerWidth / 2, bottom: innerHeight / 3 };
  const box = document.createElement('div');
  box.id = 'tour'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', `Tour: ${title}`);
  box.innerHTML = `<div class="tour-hl" style="left:${r.left - 4}px;top:${r.top - 4}px;width:${r.width + 8}px;height:${r.height + 8}px"></div>
    <div class="tour-card"><b>${title}</b> <span class="muted">${_tour + 1} of ${TOUR.length}</span><p>${text}</p><div class="btn-row"><button class="btn small" data-act="tourEnd">Close</button><span class="grow"></span>${_tour ? '<button class="btn small" data-act="tourStep" data-arg="-1">Back</button>' : ''}<button class="btn small primary" data-act="tourStep" data-arg="1">${_tour === TOUR.length - 1 ? 'Done' : 'Next'}</button></div></div>`;
  document.body.appendChild(box);
  const card = box.querySelector('.tour-card'), cw = card.offsetWidth, ch = card.offsetHeight;
  if (r.height > innerHeight / 3) {   // tall targets (the tool strip, the panels): beside them
    const right = r.right + 16 + cw < innerWidth;
    card.style.left = `${right ? r.right + 16 : Math.max(12, r.left - cw - 16)}px`;
    card.style.top = `${clamp(r.top + 40, 12, innerHeight - ch - 12)}px`;
  } else {
    const below = r.bottom + 12 + ch < innerHeight;
    card.style.top = `${below ? r.bottom + 12 : Math.max(12, r.top - ch - 12)}px`;
    card.style.left = `${clamp(r.left, 12, innerWidth - cw - 12)}px`;
  }
  card.querySelector('.primary').focus();
}
Actions.tourStep = d => { _tour += +d; showTour(); };
Actions.tourEnd = () => { _tour = -1; $('#tour')?.remove(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && _tour >= 0) Actions.tourEnd(); });
window.addEventListener('resize', debounce(() => { if (_tour >= 0) showTour(); }, 100));

document.addEventListener('keydown', e => {
  const t = e.target.closest?.('#ws-tabs [role="tab"]');
  if (!t || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const tabs = $$('#ws-tabs [role="tab"]'), i = tabs.indexOf(t);
  const j = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  Actions.view(tabs[j].dataset.arg);
  setTimeout(() => $(`#ws-tabs [data-arg="${tabs[j].dataset.arg}"]`)?.focus(), 0);
});

/* ---------- documents: the Hand tool drags the page ---------- */
Actions.docTool = t => { ui.docTool = t; saveUi(); renderView(); };
document.addEventListener('pointerdown', e => {
  if (!['fabric', 'pattern'].includes(ui.view) || ui.docTool !== 'hand' || e.button !== 0 || !e.target.closest?.('#main') || e.target.closest('button, input, select, a')) return;
  const m = $('#main'), x0 = e.clientX, y0 = e.clientY, sx = m.scrollLeft, sy = m.scrollTop;
  e.preventDefault(); m.setPointerCapture(e.pointerId); m.classList.add('dragging');
  const mv = ev => { m.scrollLeft = sx - (ev.clientX - x0); m.scrollTop = sy - (ev.clientY - y0); };
  const up = () => { m.removeEventListener('pointermove', mv); m.removeEventListener('pointerup', up); m.classList.remove('dragging'); };
  m.addEventListener('pointermove', mv); m.addEventListener('pointerup', up);
});
// tool keys where the workspace has no key handler of its own
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, select, textarea') || $('#modal-root').innerHTML) return;
  const k = e.key.toLowerCase();
  if (ui.view === 'quilting' && (k === 'h' || k === 'z')) Actions.qTool(k === 'h' ? 'hand' : 'zoom');
  if (['fabric', 'pattern'].includes(ui.view)) {
    if (k === 'h' || k === 's' || k === 'v' || k === 'z') Actions.docTool(k === 'h' ? 'hand' : k === 'z' ? 'zoom' : 'pointer');
    if (e.key === '+' || e.key === '=') Actions.docZoomBy('in');
    if (e.key === '-' || e.key === '_') Actions.docZoomBy('out');
    if (e.key === '0') Actions.docZoomBy('fit');
  }
});

/* ---------- zoom at true scale ---------- */
// screen pixels per inch on the canvas now (null when there's no zoomable canvas)
function canvasPxPerInch() {
  if (ui.view === 'block') { const b = activeBlock(), g = $('#ed-c'); if (!b || b.kind !== 'drawn' || !g) return null; const m = g.getScreenCTM(); return m ? m.a * gridScale(b) * b.n / blockFrameSize(b) : null; }
  if (['layout', 'quilting'].includes(ui.view)) { const m = $('#main svg.quilt-svg')?.getScreenCTM(); return m ? m.a : null; }
  return null;
}
// 100% is actual size (a 1" piece measures 1" on a typical 96 dpi screen)
function zoomPctText() { const p = canvasPxPerInch(); return p ? `${Math.max(1, Math.round(p / 96 * 100))}%` : '—'; }
Actions.zoomActual = () => {
  const p = canvasPxPerInch(); if (!p) return;
  if (ui.view === 'block') setZoom(edZoom() * 96 / p); else qzSet(qzZoom() * 96 / p);
};
document.addEventListener('keydown', e => {
  if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.code !== 'Digit0' || e.target.closest?.('input, select, textarea') || $('#modal-root').innerHTML) return;
  e.preventDefault(); Actions.zoomActual();
}, true);

/* ---------- documents zoom (Fabric & cutting, Pattern): 100% is the page at its natural size ---------- */
const DOC_ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const docZoom = () => (ui.docZoom && ui.docZoom[ui.view]) || 1;
function applyDocZoom(el = $('#main')) {
  const d = el?.querySelector('.docview'); if (!d) return;
  const z = docZoom();
  d.classList.toggle('zoomed', z !== 1); d.style.zoom = z !== 1 ? String(z) : '';
}
Actions.docZoomBy = (a, el, ev, pt) => {
  // keep the point under the pointer (or the centre) where it is
  const m = $('#main'), mr = m.getBoundingClientRect(), px = pt?.clientX ?? mr.left + mr.width / 2, py = pt?.clientY ?? mr.top + mr.height / 2;
  const fx = (m.scrollLeft + px - mr.left) / (m.scrollWidth || 1), fy = (m.scrollTop + py - mr.top) / (m.scrollHeight || 1);
  const z = docZoom(), i = DOC_ZOOMS.findIndex(x => x >= z - 1e-6);
  const nz = a === 'in' ? DOC_ZOOMS[Math.min(DOC_ZOOMS.length - 1, (DOC_ZOOMS[i] > z + 1e-6 ? i : i + 1))] : a === 'out' ? DOC_ZOOMS[Math.max(0, i - 1)] : 1;
  ui.docZoom = { ...(ui.docZoom || {}), [ui.view]: nz }; saveUi();
  if (ui.view === 'pattern') { _patAnchor = null; Views.pattern.afterMain?.($('#main')); } else applyDocZoom();
  m.scrollLeft = fx * m.scrollWidth - (px - mr.left); m.scrollTop = fy * m.scrollHeight - (py - mr.top);
  renderHud(); renderStatusChips();
};
// the Zoom tool on a document: click to zoom in, Alt-click to zoom out
document.addEventListener('pointerdown', e => {
  if (!['fabric', 'pattern'].includes(ui.view) || ui.docTool !== 'zoom' || e.button !== 0 || !e.target.closest?.('#main') || e.target.id === 'main' || e.target.closest('button, input, select, a, label')) return;
  e.preventDefault(); Actions.docZoomBy(e.altKey ? 'out' : 'in', null, null, e);
});

document.addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || (e.key !== 'a' && e.key !== 'A') || !['fabric', 'pattern'].includes(ui.view) || e.target.closest?.('input, textarea, select') || $('#modal-root').innerHTML) return;
  const d = $('#main .docview, #main #pattern-preview'); if (!d) return;
  e.preventDefault(); getSelection().selectAllChildren(d);
}, true);
$('#main')?.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey) || !['fabric', 'pattern'].includes(ui.view)) return;
  e.preventDefault();
  if (Date.now() - _docWheelAt > 250) _docWheel = 0;
  _docWheelAt = Date.now();
  _docWheel += e.deltaY;   // a trackpad sends many small steps: add them up to one notch
  if (Math.abs(_docWheel) < 80) return;
  Actions.docZoomBy(_docWheel < 0 ? 'in' : 'out', null, null, e); _docWheel = 0;
}, { passive: false });
let _docWheel = 0, _docWheelAt = 0;

// the options bar names the document tool while it isn't the plain Select
function docToolChip() {
  const t = { hand: ['hand', 'Hand'], zoom: ['zoomin', 'Zoom'] }[ui.docTool];
  return t ? `<span class="tool-chip">${icon(t[0], 16)}${t[1]}</span><span class="sep"></span>` : '';
}
