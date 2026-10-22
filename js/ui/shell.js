/* App shell: render orchestration, delegated actions, field binding, menus, modals,
   toasts, keyboard shortcuts, export and print. Views register in `Views`. */

const Actions = {};
const Views = {};
const VIEW_LIST = [
  { key: 'block', label: 'Blocks', short: 'Blocks' },
  { key: 'layout', label: 'Layout', short: 'Layout' },
  { key: 'quilting', label: 'Quilting', short: 'Quilting' },
  { key: 'fabric', label: 'Fabric & cutting', short: 'Fabric' },
  { key: 'pattern', label: 'Pattern', short: 'Pattern' },
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
  sliders: '<path d="M2.5 4.5h11M2.5 11.5h11"/><circle cx="5.5" cy="4.5" r="1.6" fill="var(--bg-panel, #fff)"/><circle cx="10.5" cy="11.5" r="1.6" fill="var(--bg-panel, #fff)"/>',
  check: '<path d="M3 8.5l3 3 7-7"/>',
  left: '<path d="M10 4l-4 4 4 4"/>',
  hand: '<path d="M5.5 8V3.8a1 1 0 0 1 2 0V7.5M7.5 7V3a1 1 0 0 1 2 0v4M9.5 7.2V4a1 1 0 0 1 2 0v5c0 3-1.6 5-4.2 5-1.6 0-2.6-.8-3.4-2L2.6 9.3a1 1 0 0 1 1.6-1.2L5.5 9.5"/>',
  zoomin: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.3 3.3M5 7h4M7 5v4"/>',
  pointer: '<path d="M4 2.5l8.5 5.2-3.9.9-1.9 3.9z"/>',
  lock: '<rect x="3.5" y="7" width="9" height="7" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
  minus: '<path d="M3 8h10"/>',
  search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.3 3.3"/>',
  panelLeft: '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11"/>',
  panelRight: '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M10 2.5v11"/>',
  swatch: '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>',
  blocks: '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/><path d="M2.5 8h11M8 2.5v11M2.5 2.5l5.5 5.5"/>',
  quilt: '<rect x="2" y="2" width="12" height="12" rx="1"/><path d="M6 2v12M10 2v12M2 6h12M2 10h12"/>',
  list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.8" cy="4" r=".6" fill="currentColor"/><circle cx="2.8" cy="8" r=".6" fill="currentColor"/><circle cx="2.8" cy="12" r=".6" fill="currentColor"/>',
  cut: '<circle cx="4.5" cy="11.5" r="2"/><circle cx="11.5" cy="11.5" r="2"/><path d="M6 10L12 2.5M10 10L4 2.5"/>',
  pages: '<path d="M4 2.5h6l2.5 2.5v8.5H4z"/><path d="M10 2.5V5h2.5M6 8h4.5M6 10.5h4.5"/>',
  layers: '<path d="M8 2.5l6 3-6 3-6-3z"/><path d="M2 8.5l6 3 6-3M2 11l6 3 6-3"/>',
  shapes: '<rect x="2.5" y="2.5" width="6" height="6" rx=".5"/><circle cx="10.5" cy="10.5" r="3"/>',
  history: '<path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9"/><path d="M2.5 2.5v3h3M8 5v3.2l2 1.3"/>',
  palette: '<path d="M8 2a6 6 0 1 0 0 12c1 0 1.3-.8.9-1.6-.5-.9.1-1.9 1.1-1.9H12a2 2 0 0 0 2-2A6 6 0 0 0 8 2z"/><circle cx="5" cy="7" r=".9" fill="currentColor"/><circle cx="7.5" cy="4.6" r=".9" fill="currentColor"/><circle cx="10.6" cy="5.6" r=".9" fill="currentColor"/>',
  library: '<path d="M3 2.5v11M6 2.5v11M9.2 2.8l3.6 10.4"/>',
  info: '<circle cx="8" cy="8" r="6.2"/><path d="M8 7.2v4M8 4.9v.1"/>',
  stash: '<path d="M2.5 6.5h11v7h-11z"/><path d="M4 6.5l1.5-4h5l1.5 4"/>',
  fill: '<path d="M7 2.5l5.3 5.3-4.6 4.6a1.4 1.4 0 0 1-2 0L2.4 9.1a1.4 1.4 0 0 1 0-2z"/><path d="M2.6 8.1h9.4M13.4 10.4s1.1 1.5 1.1 2.3a1.1 1.1 0 0 1-2.2 0c0-.8 1.1-2.3 1.1-2.3z"/>',
  erase: '<path d="M9.4 2.9l3.7 3.7-6.5 6.5H3.9L2.3 11.5a1 1 0 0 1 0-1.4z"/><path d="M6.4 5.9l3.7 3.7M8.4 13.1h5.3"/>',
  warn: '<path d="M8 2.3l6.2 11H1.8z"/><path d="M8 6.6v3M8 11.6v.1"/>',
  eyeoff: '<path d="M2 2l12 12"/><path d="M6.4 3.8A6.6 6.6 0 0 1 8 3.5c4 0 6.5 4.5 6.5 4.5a11 11 0 0 1-1.9 2.4M10.3 11.6A6.5 6.5 0 0 1 8 12.5c-4 0-6.5-4.5-6.5-4.5a11 11 0 0 1 2.4-2.9"/>',
  flipv: '<path d="M1.5 8h13" stroke-dasharray="1.5 1.5"/><path d="M4 6L12 2.5V6zM4 10l8 3.5V10z"/>',
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
  renderView();
  renderSidebar();
  restorePendingFocus();
}
// Everything below the app bar: context bar, tool strip, document, panels, HUD and status bar.
function renderView() {
  const V = Views[ui.view] || Views.block;
  document.body.dataset.ws = curWs();
  renderToolbar();
  renderDocTabs();
  const main = $('#main');
  preserveFocus(main, () => { main.innerHTML = V.main(); });
  V.afterMain?.(main);
  qzAttach(main);
  renderStatus();
  dockRender();
  renderHud();
  document.body.classList.toggle('grayscale', !!ui.grayscale);
}
// Main canvas only, for live previews while a control in a panel is being dragged.
function renderMainOnly() {
  _Q = null;
  const V = Views[ui.view] || Views.block;
  $('#main').innerHTML = V.main();
  V.afterMain?.($('#main'));
  qzAttach($('#main'));
  renderStatus();
  renderHud();
}
// The panels (they only redraw what changed).
function renderInspector() {
  dockRender();
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
  $('#ws-tabs').innerHTML = VIEW_LIST.map((v, i) => {
    const on = tabOf(ui.view) === v.key;
    return `<button role="tab" id="ws-${v.key}" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-act="view" data-arg="${v.key}" title="${v.label} (${i + 1})"><span class="lbl">${v.label}</span><span class="lbl-short">${v.short || v.label}</span></button>`;
  }).join('');
  // the quilt's name, editable in place (it names saved files and the pattern)
  const slot = $('#doc-title-slot');
  if (document.activeElement?.id !== 'doc-title') slot.innerHTML = `<input id="doc-title" class="doc-title" type="text" data-bind="meta.title" value="${esc(doc.meta.title)}" aria-label="Quilt name" title="Quilt name" spellcheck="false">`;
  renderSaveState();
  $('#menubar').innerHTML = menubarHtml();
  for (const b of $$('#appbar [data-act="commandPalette"]')) b.innerHTML = `${icon('search')}<span class="bar-kbd">Ctrl K</span>`;
  for (const b of $$('#appbar [data-act="toggleDrawer"]')) b.innerHTML = icon(b.dataset.arg === 'left' ? 'panelLeft' : 'panelRight');
  for (const b of $$('#appbar [data-act="allMenus"]')) b.innerHTML = icon('menu');
}
function renderSaveState() {
  const el = $('#save-state'); if (!el) return;
  const bad = saveStatus.at && !saveStatus.ok;
  el.className = `save-state${bad ? ' bad' : ''}`;
  el.innerHTML = bad ? `${icon('warn', 14)}<span>Not saved</span>` : saveStatus.at ? `${icon('check', 14)}<span>Saved</span>` : '';
  el.title = bad ? "This browser couldn't save the design. Download a project file to keep it." : 'Your design is saved in this browser';
}
// Document tabs above the canvas: the documents of this workspace.
function renderDocTabs() {
  const V = Views[ui.view] || Views.block, docs = V.docs?.() || [];
  const el = $('#doctabs');
  el.innerHTML = docs.map(d => `<button role="tab" class="doctab" aria-selected="${!!d.on}" ${d.act ? `data-act="${d.act}" data-arg="${esc(d.arg ?? '')}"` : 'tabindex="-1"'}>${d.icon ? icon(d.icon, 14) : ''}<span>${esc(d.label)}</span></button>`).join('') + `<span class="grow"></span>${V.docTools?.() || ''}`;
  el.hidden = !docs.length;
}
// The status bar: the view's hint (moved in, so live updates keep working), then chips.
function renderStatus() {
  const bar = $('#statusbar');
  if (!bar.querySelector('.sb-l')) bar.innerHTML = '<div class="sb-l"></div><div class="sb-r"></div>';
  const left = bar.querySelector('.sb-l'), src = $('#main .status-bar');
  left.innerHTML = '';
  if (src) { src.classList.add('moved'); left.appendChild(src); }
  const issues = typeof issueCount === 'function' ? issueCount() : 0;
  bar.querySelector('.sb-r').innerHTML = `<span class="sb-pos" id="sb-pos" title="Pointer position, from the top left"></span>
    ${typeof dockSession !== 'undefined' && dockSession.hidden ? '<button class="sb-chip sb-hidden" data-act="toggleHidePanels" title="Show panels (Ctrl+.)">Panels hidden · show</button>' : ''}
    ${issues ? `<button class="sb-chip warn" data-act="openPanel" data-arg="issues" title="Things to check">${icon('warn', 13)} ${plural(issues, 'issue')}</button>` : ''}
    ${ui.view === 'block' ? `<button class="sb-chip" data-act="toggleSnap" aria-pressed="${!ui.snapOff}" title="Snap points to the grid">Snap ${ui.snapOff ? 'off' : 'on'}</button>` : ''}
    <button class="sb-chip" data-act="setUnits" data-arg="${ui.units === 'cm' ? 'in' : 'cm'}" title="Switch units">${ui.units === 'cm' ? 'cm' : 'inches'}</button>`;
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
  labelNextCommit(el);
  fn(el.dataset.arg, el, e);
});
// A name for the undo step a control makes (History panel): its label, title or text.
function labelNextCommit(el) {
  const lab = el.closest?.('label, .f'), field = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
  const labText = lab && (lab.firstChild?.nodeType === 3 ? lab.firstChild.textContent : lab.textContent);
  let t = el.getAttribute?.('aria-label') || (field && labText) || (el.tagName === 'BUTTON' && el.textContent.trim()) || el.title || labText || '';
  t = String(t).replace(/\s+/g, ' ').replace(/[…:]$/, '').trim().slice(0, 48);
  nextCommitLabel = t || null;
  setTimeout(() => { nextCommitLabel = null; }, 0);
}
document.addEventListener('change', e => {
  const el = e.target;
  labelNextCommit(el);
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
  if (type === 'len') v = parseLenExpr(v, getPath(path.startsWith('ui.') ? ui : doc, path.replace(/^ui\./, '')));
  else if (type === 'num' || type === 'int') v = parseFloat(v);
  if (type === 'len' || type === 'num' || type === 'int') {
    if (!Number.isFinite(v)) { if (type === 'len') lenFieldError(el, fieldValue(el)); else { toast('Please enter a number'); renderView(); } return; }
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
  const input = `<input type="text" inputmode="decimal" data-bind="${path}" data-type="len" value="${esc(inputLen(v))}"${opts.min !== undefined ? ` data-min="${opts.min}"` : ''}${opts.max !== undefined ? ` data-max="${opts.max}"` : ''} title="Accepts 4.5, 4 1/2, 4½, 11.4cm, sums like 3 + 1/4, or +1/4, *2, 50%">`;
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
let _sectionsOpen = false;   // set while drawing a part on its own (it's always shown open)
function section(title, body, opts = {}) {
  const key = opts.key || title;
  const collapsed = _sectionsOpen ? false : key in ui.collapsed ? ui.collapsed[key] : !!opts.closed;
  return `<section class="sec${collapsed ? ' closed' : ''}"><div class="sec-h" data-act="toggleSec" data-arg="${esc(key)}" data-def="${opts.closed ? 1 : 0}" role="button" tabindex="0" aria-expanded="${!collapsed}"><span class="tog">${icon(collapsed ? 'right' : 'down', 14)}</span><h3>${title}</h3>${opts.right ? `<span class="sec-r">${opts.right}</span>` : ''}</div>${collapsed ? '' : `<div class="sec-b">${body}</div>`}</section>`;
}
// The context bar (undo/redo, then the tool's options, the selection's commands and the step's
// actions) and the tool strip.
// Hand and Zoom: on every canvas, after the workspace's own tools.
const NAV_TOOLS = [{ key: 'hand', label: 'Hand', kb: 'H', icon: 'hand' }, { key: 'zoom', label: 'Zoom', kb: 'Z', icon: 'zoomin' }];
function renderToolbar() {
  const V = Views[ui.view] || Views.block;
  const undoRedo = `<div class="cz cz-hist"><button class="tool icon-only" data-act="undo" ${undoStack.past.length ? '' : 'disabled'} aria-label="Undo" title="Undo (Ctrl+Z)">${icon('undo')}</button><button class="tool icon-only" data-act="redo" ${undoStack.future.length ? '' : 'disabled'} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">${icon('redo')}</button></div>`;
  preserveFocus($('#ctxbar'), () => { $('#ctxbar').innerHTML = undoRedo + `<div class="cz cz-opts">${V.options?.() || ''}</div>`; });
  const T = V.tools?.();
  const strip = $('#toolstrip');
  requestAnimationFrame(() => { if (strip.scrollHeight > strip.clientHeight + 2) strip.classList.add('compact'); });
  strip.hidden = !T;
  if (T) preserveFocus(strip, () => {
    strip.classList.remove('compact');
    strip.innerHTML = T.list.map(t => t.sep ? '<span class="stool-sep" role="separator"></span>' : `<button class="stool" data-act="${T.act}" data-arg="${t.key}" aria-pressed="${T.active === t.key}" title="${t.label} (${t.kb})" aria-label="${t.label}" aria-keyshortcuts="${t.kb}">${icon(t.icon, 20)}<span class="stool-l">${t.label}</span>${t.badge || ''}</button>`).join('');
  });
}
// View switches shared by the canvas steps, at the right end of the tool row.
// How the canvas is shown: each switch as { label, act, arg, on, title, disabled }.
function viewToggleItems() {
  const v = ui.view, value = { label: 'Value', act: 'toggleUi', arg: 'grayscale', on: ui.grayscale, title: 'Value view: greys only (G)' };
  if (v === 'block' && activeBlock()?.kind === 'drawn') return [{ label: 'Seam lines', act: 'toggleSeamLines', on: ui.showSeamLines !== false }, { label: 'Cut pieces', act: 'toggleUi', arg: 'showPieces', on: ui.showPieces }, { label: 'Centre lines', act: 'toggleUi', arg: 'showCentre', on: ui.showCentre }, value];
  if (v === 'block') return [{ label: 'Cut pieces', act: 'toggleUi', arg: 'showPieces', on: ui.showPieces }, value];
  if (v === 'layout') return [{ label: 'Piece outlines', act: 'toggleUi', arg: 'seamLines', on: ui.seamLines }, value, { label: 'Quilting', act: 'toggleUi', arg: 'showQuilting', on: ui.showQuilting && doc.quilting.layers.length, disabled: !doc.quilting.layers.length }];
  if (v === 'quilting') return [...(ui.qSide === 'back' ? [] : [{ label: 'Fade quilt', act: 'toggleUi', arg: 'qFade', on: ui.qFade }]), value];
  return [];
}
function viewToggles() {
  return viewToggleItems().map(t => `<button class="tool toggle" data-act="${t.act}" ${t.arg ? `data-arg="${t.arg}"` : ''} aria-pressed="${!!t.on}"${t.title ? ` title="${t.title}"` : ''}${t.disabled ? ' disabled' : ''}>${t.label}</button>`).join('');
}
Actions.viewMenu = (a, el) => openMenu(el, viewToggleItems().map(t => ({ ...tick(t.label, t.act, t.arg, t.on), disabled: t.disabled })));

/* ---------- modals, menus, toasts ---------- */
let _modalClose = null, _modalReturn = null;
// Tab stays inside an open dialog
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !$('#modal-root').innerHTML) return;
  const f = [...$$('#modal-root .modal button, #modal-root .modal input, #modal-root .modal select, #modal-root .modal textarea')].filter(x => !x.disabled && x.offsetParent);
  if (!f.length) return;
  const i = f.indexOf(document.activeElement);
  if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
}, true);
function openModal(html, onClose) {
  closeMenu();
  _modalReturn = document.activeElement;
  $('#modal-root').innerHTML = `<div class="modal-back" data-act="modalBack"><div class="modal" role="dialog" aria-modal="true"><button class="x" data-act="closeModal" aria-label="Close">${icon('x')}</button>${html}</div></div>`;
  $('#app').inert = true;
  _modalClose = onClose || null;
  setTimeout(() => $('#modal-root .modal input, #modal-root .modal [data-act="confirmOk"], #modal-root .modal button.primary')?.focus(), 30);
}
function closeModal() {
  if (!$('#modal-root').innerHTML) return false;
  $('#modal-root').innerHTML = '';
  $('#app').inert = false;
  _modalReturn?.focus?.({ preventScroll: true }); _modalReturn = null;
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
let _menuReturn = null;
function openMenu(anchor, items, opts = {}) {
  closeMenu();
  _menuReturn = document.activeElement !== document.body ? document.activeElement : (anchor?.focus ? anchor : null);
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
function closeMenu(restore) { if (!_menuEl) return false; _menuEl.remove(); _menuEl = null; if (restore && _menuReturn?.isConnected) _menuReturn.focus(); return true; }
let _swallowClick = false;
document.addEventListener('pointerdown', e => {
  if (!_menuEl || _menuEl.contains(e.target)) return;
  const bar = e.target.closest?.('#menubar button, [aria-haspopup="menu"]');
  closeMenu();
  if (!bar) { e.preventDefault(); e.stopPropagation(); _swallowClick = true; }
}, true);
document.addEventListener('click', e => { if (_swallowClick) { _swallowClick = false; e.preventDefault(); e.stopPropagation(); } }, true);
document.addEventListener('click', e => { if (_menuEl && _menuEl.contains(e.target) && e.target.closest('[data-act]:not([disabled])')) setTimeout(closeMenu, 0); });

function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  const span = document.createElement('span'); span.textContent = msg; t.appendChild(span);
  $('#toast-root').appendChild(t);
  setTimeout(() => t.remove(), ms);
  return t;
}

/* ---------- global actions ---------- */
Actions.view = v => {
  if (v === 'cutting') { v = 'fabric'; ui.fabPane = 'cut'; }
  ui.view = v; ui.drawing = []; saveUi(); render(); $('#main').focus({ preventScroll: true }); document.body.classList.remove('show-sidebar', 'show-inspector'); };
Actions.undo = () => { if (!undo()) toast('Nothing to undo'); };
Actions.redo = () => { if (!redo()) toast('Nothing to redo'); };
Actions.toggleUnits = () => { ui.units = ui.units === 'cm' ? 'in' : 'cm'; saveUi(); render(); toast(ui.units === 'cm' ? 'Showing centimetres' : 'Showing inches'); };
Actions.toggleSec = (key, el) => { const cur = key in ui.collapsed ? ui.collapsed[key] : el?.dataset.def === '1'; ui.collapsed[key] = !cur; saveUi(); render(); };
Actions.setUi = (arg) => { const [k, v] = arg.split('='); ui[k] = v === 'true' ? true : v === 'false' ? false : v; saveUi(); render(); };
Actions.toggleUi = k => { ui[k] = !ui[k]; saveUi(); render(); };

Actions.fileMenu = (a, el) => openMenu(el, MENUS.file());   // the phone-width File button
Actions.newProject = () => confirmModal('Start a new project?', 'This replaces the current design in this browser. Save a project file first if you want to keep it.', 'Start new', () => {
  doc = newDoc(); ui.activeBlock = null; ui.projectId = null; ui.fabric = doc.fabrics[1].id; ui.view = 'block';
  addBlockToDoc(newDrawnBlock('My first block'));
  resetHistory(); saveNow(); render(); toast('New project started');
}, true);
Actions.loadSample = () => confirmModal('Load the sample quilt?', 'This replaces the current design in this browser. Save a project file first if you want to keep it.', 'Load sample', () => {
  ui.projectId = null; loadSampleProject(); toast('Sample quilt loaded');
});
Actions.loadTessSample = () => confirmModal('Load the Hexie Bloom sample?', 'This replaces the current design in this browser. Save a project file first if you want to keep it.', 'Load sample', () => {
  ui.projectId = null; loadTessSample().then(() => toast('Hexie Bloom loaded')).catch(err => toast(err.message));
});
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
        ui.projectId = null; closeModal();
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
  <p class="hint">Your work autosaves in this browser. File, Save keeps named copies here; File, Download project file makes a file you can move to another computer.</p>
  <div class="actions"><button class="btn" data-act="shortcuts">Keyboard shortcuts</button><button class="btn primary" data-act="closeModal">Close</button></div>`);
// The keyboard shortcut sheet lives in commands.js (one list for every binding).
Actions.about = () => openModal(`<h2>Quilt Designer ${APP_VERSION}</h2>
  <p>Design blocks, lay out a quilt, work out fabric and cutting, plan the quilting and print the pattern. Free.</p>
  <p>Your project saves in this browser. To keep a copy or move it to another computer, use File, Save project file.</p>
  <p><a href="https://github.com/Ackley14/quiltthing" target="_blank" rel="noopener">Source code on GitHub</a> · MIT licence · Uses <a href="https://github.com/mfogel/polygon-clipping" target="_blank" rel="noopener">polygon-clipping</a> (MIT).</p>
  <div class="actions"><button class="btn primary" data-act="closeModal">Close</button></div>`);

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t?.matches?.('[role="button"][data-act]')) { e.preventDefault(); t.click(); }
});
document.addEventListener('keydown', e => {
  const t = e.target;
  const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (closeMenu(true) || closeModal()) return;
    if (ui.fabPop) { Actions.closeFabricPopover(); return; }
    Views[ui.view]?.key?.(e);
    return;
  }
  if (ctrl && (e.key === 's' || e.key === 'S')) { e.preventDefault(); e.shiftKey ? Actions.saveBrowserAs() : Actions.saveBrowser(); return; }
  if (ctrl && (e.key === 'o' || e.key === 'O')) { e.preventDefault(); Actions.openBrowser(); return; }
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

// Split the HTML of a run of section() blocks into { key: html }, so one part can be shown alone.
function sectionsByKey(html) {
  const out = {};
  for (const part of html.split(/(?=<section class="sec)/)) {
    const m = part.match(/data-act="toggleSec" data-arg="([^"]+)"/);
    if (m) out[m[1]] = (out[m[1]] || '') + part;
  }
  return out;
}
function openSections(fn) { _sectionsOpen = true; try { return fn(); } finally { _sectionsOpen = false; } }
