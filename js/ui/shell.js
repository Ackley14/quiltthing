/* App shell: render orchestration, delegated actions, field binding, menus, modals,
   toasts, keyboard shortcuts, export and print. Views register in `Views`. */

const Actions = {};
const Views = {};
const VIEW_LIST = [
  { key: 'block', label: 'Blocks' },
  { key: 'layout', label: 'Layout' },
  { key: 'quilting', label: 'Quilting' },
  { key: 'fabric', label: 'Fabric & cutting' },
  { key: 'pattern', label: 'Pattern' },
];
// The fabric list and the cutting plan share one step; "cutting" opens it on the cutting plan.
const tabOf = v => v === 'cutting' ? 'fabric' : v;
// Steps that use the fabrics & blocks column on the left.
const SIDEBAR_VIEWS = ['block', 'layout'];

/* ---------- icons: one line-icon set, 16 px, drawn with currentColor ---------- */
const ICON_PATHS = {
  paint: '<path d="M10.5 2.5l3 3-5.5 5.5-3-3z"/><path d="M5 8l-1.6 1.6c-.9.9-.6 2.5-1.9 3.9 2 .3 3.6-.2 4.6-1.2L7.6 11"/>',
  select: '<path d="M3.5 2.5l8.5 5-3.8 1-1.7 3.8z"/>',
  shape: '<path d="M8 2.5l5.5 4-2.1 6.5H4.6L2.5 6.5z"/>',
  rect: '<rect x="2.5" y="4" width="11" height="8" rx=".5"/>',
  tri: '<rect x="2.5" y="2.5" width="11" height="11" rx=".5"/><path d="M2.5 13.5l11-11"/>',
  arc: '<path d="M2.5 13.5V2.5a11 11 0 0 1 11 11z"/>',
  seam: '<circle cx="4.5" cy="4.5" r="2"/><circle cx="4.5" cy="11.5" r="2"/><path d="M6.2 5.6L13.5 12M6.2 10.4L13.5 4"/>',
  text: '<path d="M3 4V3h10v1M8 3v10M6 13h4"/>',
  place: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M8 5.5v5M5.5 8h5"/>',
  undo: '<path d="M5.5 3.5L2.5 6.5l3 3"/><path d="M2.5 6.5h7a4 4 0 0 1 0 8h-3"/>',
  redo: '<path d="M10.5 3.5l3 3-3 3"/><path d="M13.5 6.5h-7a4 4 0 0 0 0 8h3"/>',
  more: '<circle cx="3.5" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="8" r="1.1" fill="currentColor" stroke="none"/>',
  help: '<circle cx="8" cy="8" r="6.2"/><path d="M6.2 6.3a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.7-.8 1.3"/><path d="M8 11.4v.1"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  trash: '<path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4.2 4.5l.7 9h6.2l.7-9M6.8 7v4M9.2 7v4"/>',
  rotate: '<path d="M13 8a5 5 0 1 1-1.6-3.7"/><path d="M13 2.5v3h-3"/>',
  mirror: '<path d="M8 1.5v13" stroke-dasharray="1.5 1.5"/><path d="M6 4L2.5 12H6zM10 4l3.5 8H10z"/>',
  front: '<path d="M3 2.5h10M8 13.5V6M5 8.5l3-3 3 3"/>',
  back: '<path d="M3 13.5h10M8 2.5V10M5 7.5l3 3 3-3"/>',
  dup: '<rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M3 10.5V3.5a1 1 0 0 1 1-1h6.5"/>',
  up: '<path d="M4 10l4-4 4 4"/>',
  down: '<path d="M4 6l4 4 4-4"/>',
  right: '<path d="M6 4l4 4-4 4"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  eye: '<path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  print: '<path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5.5h11v5.5h-2"/><rect x="4.5" y="9.5" width="7" height="4"/>',
  centre: '<circle cx="8" cy="8" r="3.5"/><path d="M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3"/>',
  edit: '<path d="M10.5 2.5l3 3-8 8h-3v-3z"/>',
  menu: '<path d="M2.5 4h11M2.5 8h11M2.5 12h11"/>',
  sliders: '<path d="M2.5 4.5h11M2.5 11.5h11"/><circle cx="5.5" cy="4.5" r="1.6" fill="#fff"/><circle cx="10.5" cy="11.5" r="1.6" fill="#fff"/>',
  check: '<path d="M3 8.5l3 3 7-7"/>',
};
function icon(name, size = 16) {
  return `<svg class="ic" viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

/* ---------- rendering ---------- */
let _Q = null;          // quilt build cached per render pass
function Qnow() { return _Q || (_Q = buildQuilt()); }

function render() {
  _Q = null;
  setDisplayUnits(ui.units);
  updateFabricDefs();
  renderTopbar();
  renderSidebar();
  renderView();
  restorePendingFocus();
}
function renderView() {
  const V = Views[ui.view] || Views.block;
  document.body.classList.toggle('no-side', !SIDEBAR_VIEWS.includes(ui.view));
  const main = $('#main'), insp = $('#inspector');
  preserveFocus(main, () => { main.innerHTML = V.main(); });
  V.afterMain?.(main);
  preserveFocus(insp, () => { insp.innerHTML = V.inspector(); });
  document.body.classList.toggle('grayscale', !!ui.grayscale);
  if (ui.grayscale) main.insertAdjacentHTML('afterbegin', `<button class="gs-banner" data-act="toggleUi" data-arg="grayscale" title="Turn off (G)">Value view · turn off</button>`);
}
// Main canvas only — for live previews while a control in a side panel is being dragged.
function renderMainOnly() {
  _Q = null;
  const V = Views[ui.view] || Views.block;
  $('#main').innerHTML = V.main();
  V.afterMain?.($('#main'));
}
function renderInspector() {
  const V = Views[ui.view] || Views.block;
  preserveFocus($('#inspector'), () => { $('#inspector').innerHTML = V.inspector(); });
  restorePendingFocus();
}
// A field commits when it loses focus — usually because the user clicked or tabbed into the next
// field. The re-render then replaces that next field before it gets focus, so we remember where
// focus was heading and put it on the replacement (otherwise typing falls through to shortcuts).
let _focusTarget = null, _lastFieldBlur = 0;
const isField = el => el?.matches?.('input, select, textarea');
document.addEventListener('pointerdown', e => {
  const t = e.target.closest?.('input, select, textarea');
  _focusTarget = t ? { sig: focusSig(t), at: Date.now() } : null;
}, true);
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !isField(e.target)) return;
  const all = [...document.querySelectorAll('input, select, textarea, button, a[href]')].filter(x => !x.disabled && x.offsetParent && x.tabIndex >= 0);
  const next = all[all.indexOf(e.target) + (e.shiftKey ? -1 : 1)];
  _focusTarget = next && focusSig(next) ? { sig: focusSig(next), at: Date.now(), select: true } : null;   // Tab selects the next field's text
}, true);
document.addEventListener('focusout', e => { if (isField(e.target)) _lastFieldBlur = Date.now(); }, true);
function restorePendingFocus() {
  const t = _focusTarget;
  if (!t?.sig || Date.now() - t.at > 1500) return;
  const a = document.activeElement;
  if (a && a !== document.body && document.contains(a)) return;
  const el = document.querySelector(t.sig);
  if (!el) return;
  _focusTarget = null;
  el.focus({ preventScroll: true });
  try { if (t.select) el.select?.(); else if (el.type === 'text' || el.tagName === 'TEXTAREA') el.setSelectionRange(el.value.length, el.value.length); } catch {}
}
let _defsKey = '';
function updateFabricDefs() {
  const key = JSON.stringify(doc.fabrics);
  if (key === _defsKey) return;
  _defsKey = key;
  $('#fabric-defs defs').innerHTML = fabricDefs();
}

function preserveFocus(container, fn) {
  const a = document.activeElement;
  let sig = null, s0, s1;
  if (a && a !== container && container.contains(a)) {
    sig = focusSig(a);
    try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch {}
  }
  fn();
  if (sig) {
    const el = container.querySelector(sig);
    if (el) { el.focus({ preventScroll: true }); try { if (s0 != null) el.setSelectionRange(s0, s1); } catch {} }
  }
}
function focusSig(el) {
  for (const attr of ['data-bind', 'data-change', 'data-input', 'data-act', 'id']) {
    const v = el.getAttribute(attr);
    if (v) {
      let s = `[${attr}="${CSS.escape(v)}"]`;
      if (el.dataset.arg !== undefined) s += `[data-arg="${CSS.escape(el.dataset.arg)}"]`;
      return s;
    }
  }
  return null;
}

function renderTopbar() {
  $('#tabs').innerHTML = VIEW_LIST.map((v, i) =>
    `<button role="tab" aria-selected="${tabOf(ui.view) === v.key}" data-act="view" data-arg="${v.key}" title="${v.label} (${i + 1})"><span class="n">${i + 1}</span><span class="lbl">${v.label}</span></button>`).join('');
  $('#top-actions').innerHTML = `
    <span class="save-dot hide-sm">${saveStatus.at && !saveStatus.ok ? 'Not saved' : ''}</span>
    <button class="icon-btn" data-act="undo" ${undoStack.past.length ? '' : 'disabled'} aria-label="Undo" title="Undo (Ctrl+Z)">${icon('undo')}</button>
    <button class="icon-btn" data-act="redo" ${undoStack.future.length ? '' : 'disabled'} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">${icon('redo')}</button>
    <button class="icon-btn mobile-only" data-act="fileMenu" aria-haspopup="menu">File</button>
`;
  $('#menubar').innerHTML = menubarHtml();
}

/* ---------- event delegation ---------- */
function fieldValue(el) {
  if (el.type === 'checkbox') return el.checked;
  return el.value;
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = Actions[el.dataset.act];
  if (!fn) { console.warn('no action', el.dataset.act); return; }
  if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
  fn(el.dataset.arg, el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.bind) return applyBinding(el);
  const name = el.dataset.change;
  if (name && Actions[name]) Actions[name](fieldValue(el), el, e);
});
document.addEventListener('input', e => {
  const el = e.target;
  const name = el.dataset.input;
  if (name && Actions[name]) Actions[name](fieldValue(el), el, e);
});
// Enter in a bound text/number field commits immediately
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches?.('input[data-bind], input[data-change]')) e.target.blur();
});

function getPath(root, path) { return path.split('.').reduce((o, k) => o?.[k], root); }
function setPath(root, path, v) {
  const ks = path.split('.');
  let o = root;
  for (const k of ks.slice(0, -1)) o = o[k];
  o[ks[ks.length - 1]] = v;
}
// data-bind="layout.blockSize" data-type="len|num|int|text|bool|sel" data-min data-max
function applyBinding(el) {
  const path = el.dataset.bind, type = el.dataset.type || 'text';
  let v = fieldValue(el);
  if (type === 'len') v = parseLen(v);
  else if (type === 'num' || type === 'int') v = parseFloat(v);
  if (type === 'len' || type === 'num' || type === 'int') {
    if (!Number.isFinite(v)) { toast('Please enter a number'); renderView(); return; }
    if (type === 'int') v = Math.round(v);
    const lo = el.dataset.min !== undefined ? parseFloat(el.dataset.min) : -Infinity;
    const hi = el.dataset.max !== undefined ? parseFloat(el.dataset.max) : Infinity;
    v = clamp(v, lo, hi);
  }
  if (path.startsWith('ui.')) { setPath(ui, path.slice(3), v); saveUi(); render(); return; }
  setPath(doc, path, v);
  commit();
}
// Field helpers used by every inspector
// A length box. opts.step adds − and + buttons that change it by that much.
function lenField(label, path, opts = {}) {
  const v = getPath(doc, path);
  const input = `<input type="text" inputmode="decimal" data-bind="${path}" data-type="len" value="${esc(inputLen(v))}"${opts.min !== undefined ? ` data-min="${opts.min}"` : ''}${opts.max !== undefined ? ` data-max="${opts.max}"` : ''} title="Accepts 4.5, 4 1/2, 4½ or 11.4cm">`;
  if (!opts.step) return `<label class="f">${label}${opts.suffix ? ` <span class="muted">${opts.suffix}</span>` : ''}${input}</label>`;
  const arg = d => `${path}|${d}|${opts.min ?? 0}|${opts.max ?? 1e9}`;
  return `<div class="f">${label}<span class="stepper"><button class="btn small" data-act="lenStep" data-arg="${arg(-opts.step)}" aria-label="Less">−</button>${input}<button class="btn small" data-act="lenStep" data-arg="${arg(opts.step)}" aria-label="More">+</button></span></div>`;
}
Actions.lenStep = arg => {
  const [path, d, lo, hi] = arg.split('|'), v = +getPath(doc, path) || 0;
  setPath(doc, path, clamp(Math.round((v + +d) * 8) / 8, +lo, +hi));
  commit();
};
function numField(label, path, opts = {}) {
  const v = getPath(doc, path);
  return `<label class="f">${label}<input type="number" data-bind="${path}" data-type="${opts.int ? 'int' : 'num'}" value="${esc(v)}"${opts.min !== undefined ? ` data-min="${opts.min}" min="${opts.min}"` : ''}${opts.max !== undefined ? ` data-max="${opts.max}" max="${opts.max}"` : ''} step="${opts.step || 1}"></label>`;
}
function selectField(label, path, options, opts = {}) {
  const root = path.startsWith('ui.') ? ui : doc;
  const v = getPath(root, path.replace(/^ui\./, ''));
  return `<label class="f">${label}<select data-bind="${path}"${opts.type ? ` data-type="${opts.type}"` : ''}>${options.map(([k, l]) => `<option value="${esc(k)}" ${String(k) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
// Fabric chooser (row of swatches). act receives "value" via data-arg.
function fabricPicker(current, act, opts = {}) {
  let h = `<div class="fabpick">`;
  if (opts.allowBg) h += `<button class="bgopt" aria-pressed="${current === BG}" data-act="${act}" data-arg="${BG}" title="Quilt background">BG</button>`;
  for (const f of doc.fabrics) h += `<button aria-pressed="${current === f.id}" data-act="${act}" data-arg="${f.id}" title="${esc(f.name)}">${swatchHtml(f.id, 20)}</button>`;
  return h + '</div>';
}
// A panel section; click its heading to fold it. opts.closed: starts folded (rarely used settings).
function section(title, body, opts = {}) {
  const key = opts.key || title;
  const collapsed = key in ui.collapsed ? ui.collapsed[key] : !!opts.closed;
  return `<section class="sec${collapsed ? ' closed' : ''}"><div class="sec-h" data-act="toggleSec" data-arg="${esc(key)}" data-def="${opts.closed ? 1 : 0}" role="button" aria-expanded="${!collapsed}"><span class="tog">${icon(collapsed ? 'right' : 'down', 14)}</span><h3>${title}</h3>${opts.right ? `<span class="sec-r">${opts.right}</span>` : ''}</div>${collapsed ? '' : `<div class="sec-b">${body}</div>`}</section>`;
}
// The quiet link to the next step, at the foot of the right-hand panel.
function nextStep(view, label) {
  return `<div class="next-step"><button class="btn link" data-act="view" data-arg="${view}">Next: ${label} ${icon('right', 14)}</button></div>`;
}

/* ---------- modals, menus, toasts ---------- */
let _modalClose = null;
function openModal(html, onClose) {
  closeMenu();
  $('#modal-root').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" role="dialog" aria-modal="true"><button class="x" data-act="closeModal" aria-label="Close">×</button>${html}</div></div>`;
  _modalClose = onClose || null;
  setTimeout(() => $('#modal-root .modal input, #modal-root .modal button.primary')?.focus(), 30);
}
function closeModal() {
  if (!$('#modal-root').innerHTML) return false;
  $('#modal-root').innerHTML = '';
  const cb = _modalClose; _modalClose = null;
  cb?.();
  return true;
}
Actions.closeModal = () => closeModal();
Actions.modalBack = (a, el, e) => { if (e.target === el) closeModal(); };

function confirmModal(title, body, okLabel, onOk, danger) {
  openModal(`<h2>${title}</h2><p>${body}</p><div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="confirmOk">${okLabel}</button></div>`);
  Actions.confirmOk = () => { closeModal(); onOk(); };
}

let _menuEl = null;
// Items: { label, act, arg, kb, danger, checked (true/false shows a tick column), disabled }, '-' for a
// divider, or { header } for a small group title. opts.align: 'left' drops the menu from the anchor's left edge.
function openMenu(anchor, items, opts = {}) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu';
  m.setAttribute('role', 'menu');
  const ticks = items.some(it => it && it.checked !== undefined);
  m.innerHTML = items.filter(Boolean).map(it => it === '-' ? '<hr>' : it.header ? `<div class="menu-h">${it.header}</div>`
    : `<button role="menuitem" class="${it.danger ? 'danger' : ''}" data-act="${it.act}" ${it.arg !== undefined ? `data-arg="${esc(it.arg)}"` : ''} ${it.disabled ? 'disabled' : ''}>${ticks ? (it.checked ? icon('check', 14) : '<span class="ic-gap"></span>') : ''}${it.label}${it.kb ? `<span class="kb">${it.kb}</span>` : ''}</button>`).join('');
  document.body.appendChild(m);
  const mw = m.offsetWidth, mh = m.offsetHeight;
  if (anchor.getBoundingClientRect) {
    const r = anchor.getBoundingClientRect();
    m.style.top = `${clamp(r.bottom + (opts.align === 'bar' ? 2 : 6), 8, Math.max(8, window.innerHeight - mh - 8))}px`;
    m.style.left = `${clamp(opts.align ? r.left : r.right - mw, 8, window.innerWidth - mw - 8)}px`;
  } else {
    m.style.top = `${clamp(anchor.y, 8, window.innerHeight - mh - 8)}px`;
    m.style.left = `${clamp(anchor.x, 8, window.innerWidth - mw - 8)}px`;
  }
  _menuEl = m;
  setTimeout(() => m.querySelector('button')?.focus(), 10);
}
function closeMenu() { if (!_menuEl) return false; _menuEl.remove(); _menuEl = null; return true; }
document.addEventListener('pointerdown', e => { if (_menuEl && !_menuEl.contains(e.target)) closeMenu(); }, true);
document.addEventListener('click', e => { if (_menuEl && _menuEl.contains(e.target) && e.target.closest('[data-act]:not([disabled])')) setTimeout(closeMenu, 0); });

function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- global actions ---------- */
Actions.view = v => {
  if (v === 'cutting') { v = 'fabric'; ui.fabPane = 'cut'; }
  ui.view = v; ui.drawing = []; saveUi(); render(); $('#main').focus({ preventScroll: true }); document.body.classList.remove('show-sidebar', 'show-inspector'); };
Actions.undo = () => { if (!undo()) toast('Nothing to undo'); };
Actions.redo = () => { if (!redo()) toast('Nothing to redo'); };
Actions.toggleUnits = () => { ui.units = ui.units === 'cm' ? 'in' : 'cm'; saveUi(); render(); toast(ui.units === 'cm' ? 'Showing centimetres' : 'Showing inches'); };
Actions.toggleSec = (key, el) => { const cur = key in ui.collapsed ? ui.collapsed[key] : el?.dataset.def === '1'; ui.collapsed[key] = !cur; saveUi(); render(); };
Actions.toggleDrawer = which => {
  const cls = which === 'sidebar' ? 'show-sidebar' : 'show-inspector';
  const on = !document.body.classList.contains(cls);
  document.body.classList.remove('show-sidebar', 'show-inspector');
  document.body.classList.toggle(cls, on);
};
Actions.setUi = (arg) => { const [k, v] = arg.split('='); ui[k] = v === 'true' ? true : v === 'false' ? false : v; saveUi(); render(); };
Actions.toggleUi = k => { ui[k] = !ui[k]; saveUi(); render(); };

Actions.fileMenu = (a, el) => openMenu(el, [
  { label: 'New project…', act: 'newProject' },
  { label: 'Sample: Midnight Bullseye…', act: 'loadSample' },
  { label: 'Sample: Hexie Bloom…', act: 'loadTessSample' },
  '-',
  { label: 'Open project file…', act: 'openProject', kb: 'Ctrl+O' },
  { label: 'Save project file', act: 'saveProject', kb: 'Ctrl+S' },
  '-',
  { label: 'Import blocks from file…', act: 'importBlocks' },
  { label: 'Export all blocks…', act: 'exportBlocks', arg: 'all' },
  '-',
  { label: 'Export PNG…', act: 'exportPngDialog' },
  { label: 'Export SVG', act: 'exportSvg' },
  { label: 'Print pattern', act: 'printPattern', kb: 'Ctrl+P' },
  '-',
  { label: ui.units === 'cm' ? 'Show inches' : 'Show centimetres', act: 'toggleUnits' },
]);
Actions.helpMenu = (a, el) => openMenu(el, [
  { label: 'How it works', act: 'help', kb: '?' },
  { label: 'Keyboard shortcuts', act: 'shortcuts' },
  '-',
  { label: 'About', act: 'about' },
]);
Actions.newProject = () => confirmModal('Start a new project?', 'This replaces the current design in this browser. Save a project file first if you want to keep it.', 'Start new', () => {
  doc = newDoc(); ui.activeBlock = null; ui.fabric = doc.fabrics[1].id; ui.view = 'block';
  addBlockToDoc(newDrawnBlock('My first block'));
  resetHistory(); saveNow(); render(); toast('New project started');
}, true);
Actions.loadSample = () => confirmModal('Load the sample quilt?', 'This replaces the current design in this browser. Save a project file first if you want to keep it.', 'Load sample', () => {
  loadSampleProject(); toast('Sample quilt loaded');
}, true);
Actions.loadTessSample = () => confirmModal('Load the Hexie Bloom sample?', 'This replaces the current design in this browser. Save a project file first if you want to keep it.', 'Load sample', () => {
  loadTessSample().then(() => toast('Hexie Bloom loaded')).catch(err => toast(err.message));
}, true);
Actions.saveProject = () => { exportProject(); toast('Project file downloaded'); };
Actions.openProject = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => {
    const file = inp.files[0];
    if (!file) return;
    file.text().then(text => {
      try {
        doc = parseProjectFile(text);
        sanitizeUi();
        ui.view = 'layout';
        resetHistory(); saveNow(); render();
        toast(`Opened “${doc.meta.title}”`);
      } catch (err) {
        openModal(`<h2>Couldn't open that file</h2><p>${esc(err.message)}</p><div class="actions"><button class="btn primary" data-act="closeModal">OK</button></div>`);
      }
    });
  };
  inp.click();
};

/* ---------- export ---------- */
function exportSvgString(opts = {}) {
  if (ui.view === 'block' && activeBlock()) {
    const b = activeBlock(), S = b.kind === 'drawn' ? blockFrameSize(b) : doc.layout.blockSize;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S * 96}" height="${S * 96}"><defs>${fabricDefs()}</defs>${blockSvg(b, S, S)}</svg>`, w: S, h: S, name: b.name };
  }
  const Q = buildQuilt();
  const q = (ui.view === 'quilting' || opts.quilting) ? quiltingSvg(Q) : '';
  let svg = quiltSvg(Q, { idp: 'ex', defs: true, quilting: q, size: [Q.W * 96, Q.H * 96] });
  svg = svg.replace('<g class="hover-layer" pointer-events="none"></g>', '');
  return { svg, w: Q.W, h: Q.H, name: doc.meta.title };
}
Actions.exportSvg = () => {
  const { svg, name } = exportSvgString();
  downloadBlob(slugify(name) + '.svg', new Blob([svg], { type: 'image/svg+xml' }));
};
Actions.exportPngDialog = () => {
  openModal(`<h2>Export picture</h2><p>Exports the ${ui.view === 'block' ? 'current block' : 'quilt'} as a PNG image.</p>
    <label class="f">Width in pixels<select id="png-w"><option value="1200">1200 px (web)</option><option value="2400" selected>2400 px (sharp)</option><option value="4800">4800 px (print poster)</option></select></label>
    ${ui.view !== 'block' ? `<label class="check"><input type="checkbox" id="png-q" ${ui.view === 'quilting' ? 'checked' : ''}> Include quilting lines</label>` : ''}
    <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="exportPng">Export PNG</button></div>`);
};
Actions.exportPng = () => {
  const px = +($('#png-w')?.value || 2400);
  const withQ = !!$('#png-q')?.checked;
  closeModal();
  const { svg, w, h, name } = exportSvgString({ quilting: withQ });
  const scale = px / Math.max(w, h);
  const W = Math.round(w * scale), H = Math.round(h * scale);
  const sized = svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${W}" height="${H}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0, W, H);
    URL.revokeObjectURL(url);
    c.toBlob(b => { downloadBlob(slugify(name) + '.png', b); toast('Picture exported'); }, 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Export failed. Try SVG.'); };
  img.src = url;
};

/* ---------- print ---------- */
function preparePrint() {
  const cls = ui.patternPage === 'a4' ? 'a4' : '';
  flatFills = true;
  let html;
  try { html = renderPatternDoc(); } finally { flatFills = false; }
  $('#print-root').innerHTML = html.replace(/class="page /g, `class="page ${cls} `);
  // lay it out off screen for a moment so long sections can be split into sheets
  const root = $('#print-root');
  root.style.cssText = `display:block;position:absolute;left:-20000px;top:0;width:${ui.patternPage === 'a4' ? 7.27 : 7.5}in`;
  try { paginatePattern(root); } finally { root.style.cssText = ''; }
  $('#page-size').textContent = `@page { size: ${ui.patternPage === 'a4' ? 'A4' : 'letter'} portrait; margin: 0.5in; }`;
}
Actions.printPattern = () => { preparePrint(); setTimeout(() => window.print(), 50); };
window.addEventListener('beforeprint', preparePrint);

/* ---------- help & about ---------- */
Actions.help = () => openModal(`<h2>How it works</h2>
  <ol class="how">
    <li><b>Blocks.</b> Draw a block on the grid, or add a classic from the library, and paint its pieces.</li>
    <li><b>Layout.</b> Place blocks in rows, on point or in a tessellation. Add sashing, borders and binding.</li>
    <li><b>Quilting.</b> Choose the stitching: in the ditch, echo, meander, crosshatch and more.</li>
    <li><b>Fabric &amp; cutting.</b> What to buy, what you already have, and how to cut every piece.</li>
    <li><b>Pattern.</b> Print the full pattern or save it as a PDF.</li>
  </ol>
  <p class="hint">Your work saves in this browser. To keep a copy, use File, Save project file.</p>
  <div class="actions"><button class="btn" data-act="shortcuts">Keyboard shortcuts</button><button class="btn primary" data-act="closeModal">Close</button></div>`);
Actions.shortcuts = () => openModal(`<h2>Keyboard shortcuts</h2>
  <div class="shortcuts">
    <h4>Everywhere</h4>
    <div><kbd>1</kbd>–<kbd>5</kbd> go to a step</div>
    <div><kbd>Ctrl Z</kbd> undo · <kbd>Ctrl Shift Z</kbd> redo</div>
    <div><kbd>Ctrl S</kbd> save project file</div>
    <div><kbd>Ctrl P</kbd> print pattern</div>
    <div><kbd>G</kbd> value view</div>
    <h4>Blocks</h4>
    <div><kbd>V</kbd> paint · <kbd>S</kbd> select</div>
    <div><kbd>P</kbd> shape · <kbd>R</kbd> rectangle</div>
    <div><kbd>T</kbd> triangle · <kbd>C</kbd> quarter circle</div>
    <div><kbd>K</kbd> seam · <kbd>L</kbd> text</div>
    <div><kbd>Enter</kbd> finish a shape · <kbd>Backspace</kbd> remove last point</div>
    <div><kbd>Esc</kbd> cancel · <kbd>Delete</kbd> delete selected</div>
    <div>Arrow keys nudge the selection</div>
    <div><kbd>Shift</kbd>-click or <kbd>Ctrl</kbd>-drag to select several</div>
    <div><kbd>Ctrl D</kbd> duplicate · <kbd>Ctrl C</kbd> <kbd>Ctrl V</kbd> copy, paste</div>
    <div><kbd>Q</kbd> <kbd>E</kbd> rotate · <kbd>X</kbd> <kbd>Y</kbd> mirror</div>
    <div>Right-click a shape for more</div>
    <div>Double-click a corner to remove it</div>
    <div><kbd>Alt</kbd>-click an edge handle to add a corner</div>
    <div><kbd>Shift</kbd> half-grid steps · <kbd>Alt</kbd>-click picks up a fabric</div>
    <h4>Layout</h4>
    <div><kbd>B</kbd> place · <kbd>V</kbd> paint · <kbd>S</kbd> select</div>
    <div><kbd>R</kbd> turn · <kbd>F</kbd> mirror the selected block</div>
    <div>Click or drag to place · right-click to clear</div>
    <div>Click a placed block again to turn it</div>
    <div><kbd>Shift</kbd> places it mirrored</div>
    <div>Drag a block from My blocks onto the quilt</div>
  </div>
  <div class="actions"><button class="btn primary" data-act="closeModal">Close</button></div>`);
Actions.about = () => openModal(`<h2>Quilt Designer ${APP_VERSION}</h2>
  <p>Design blocks, lay out a quilt, work out fabric and cutting, plan the quilting and print the pattern. Free.</p>
  <p>Your project saves in this browser. To keep a copy or move it to another computer, use File, Save project file.</p>
  <p><a href="https://github.com/Ackley14/quiltthing" target="_blank" rel="noopener">Source code on GitHub</a> · MIT licence · Uses <a href="https://github.com/mfogel/polygon-clipping" target="_blank" rel="noopener">polygon-clipping</a> (MIT).</p>
  <div class="actions"><button class="btn primary" data-act="closeModal">Close</button></div>`);

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  const t = e.target;
  const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (closeMenu() || closeModal()) return;
    if (ui.fabPop) { Actions.closeFabricPopover(); return; }
    Views[ui.view]?.key?.(e);
    return;
  }
  if (ctrl && (e.key === 's' || e.key === 'S')) { e.preventDefault(); Actions.saveProject(); return; }
  if (ctrl && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); Actions.openProject(); return; }
  if (ctrl && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); Actions.printPattern(); return; }
  // a dropdown has no undo of its own, so Ctrl+Z still undoes there
  if (inField && !(ctrl && t.tagName === 'SELECT')) return;
  // single-key shortcuts are ignored for a moment after leaving a field, in case the next click
  // didn't land in a field (keys meant for typing shouldn't switch tabs or tools)
  if (!ctrl && !e.altKey && e.key.length === 1 && Date.now() - _lastFieldBlur < 600) return;
  if (ctrl && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? Actions.redo() : Actions.undo(); return; }
  if (ctrl && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); Actions.redo(); return; }
  if ($('#modal-root').innerHTML) return;
  if (!ctrl && !e.altKey && /^[1-5]$/.test(e.key)) { e.preventDefault(); Actions.view(VIEW_LIST[+e.key - 1].key); return; }
  if (!ctrl && (e.key === 'g' || e.key === 'G')) { Actions.toggleUi('grayscale'); return; }
  if (e.key === '?') { Actions.help(); return; }
  Views[ui.view]?.key?.(e);
});

/* ---------- pointer → svg coordinates ---------- */
function svgPoint(svg, e) {
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return [pt.x, pt.y];
}
