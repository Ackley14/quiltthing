/* App shell: render orchestration, delegated actions, field binding, menus, modals,
   toasts, keyboard shortcuts, export and print. Views register in `Views`. */

const Actions = {};
const Views = {};
const VIEW_LIST = [
  { key: 'block', label: 'Blocks' },
  { key: 'layout', label: 'Layout' },
  { key: 'quilting', label: 'Quilting' },
  { key: 'fabric', label: 'Fabric' },
  { key: 'cutting', label: 'Cutting' },
  { key: 'pattern', label: 'Pattern' },
];

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
  const main = $('#main'), insp = $('#inspector');
  preserveFocus(main, () => { main.innerHTML = V.main(); });
  V.afterMain?.(main);
  preserveFocus(insp, () => { insp.innerHTML = V.inspector(); });
  document.body.classList.toggle('grayscale', !!ui.grayscale);
  if (ui.grayscale) main.insertAdjacentHTML('afterbegin', `<button class="gs-banner" data-act="toggleUi" data-arg="grayscale" title="Turn the value check off (G)">Value check on — showing greys · turn off</button>`);
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
    `<button role="tab" aria-selected="${ui.view === v.key}" data-act="view" data-arg="${v.key}" title="${v.label} (${i + 1})"><span class="n">${i + 1}</span><span class="lbl">${v.label}</span></button>`).join('');
  const saved = saveStatus.at ? (saveStatus.ok ? 'Saved' : 'Not saved!') : '';
  $('#top-actions').innerHTML = `
    <span class="save-dot hide-sm" title="Your project is saved in this browser automatically">${saved}</span>
    <button class="icon-btn" data-act="undo" ${undoStack.past.length ? '' : 'disabled'} aria-label="Undo" title="Undo (Ctrl+Z)">↶</button>
    <button class="icon-btn" data-act="redo" ${undoStack.future.length ? '' : 'disabled'} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">↷</button>
    <button class="icon-btn" data-act="fileMenu" aria-haspopup="menu" title="Project, save, open, export">File ▾</button>
    <button class="icon-btn hide-sm" data-act="toggleUnits" title="Measurements in inches or centimetres — click to switch">Units: ${ui.units === 'cm' ? 'cm' : 'in'}</button>
    <button class="icon-btn hide-sm" data-act="help" aria-label="Help and shortcuts" title="Help & shortcuts">?</button>
    <button class="icon-btn hide-sm" data-act="about" aria-label="About" title="About">i</button>`;
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
function lenField(label, path, opts = {}) {
  const v = getPath(doc, path);
  return `<label class="f">${label}${opts.suffix ? ` <span class="muted">${opts.suffix}</span>` : ''}<input type="text" inputmode="decimal" data-bind="${path}" data-type="len" value="${esc(inputLen(v))}"${opts.min !== undefined ? ` data-min="${opts.min}"` : ''}${opts.max !== undefined ? ` data-max="${opts.max}"` : ''} title="Accepts 4.5, 4 1/2, 4½ or 11.4cm"></label>`;
}
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
function section(title, body, opts = {}) {
  const key = opts.key || title;
  const collapsed = ui.collapsed[key];
  return `<section class="sec"><div class="sec-h"><h3>${title}</h3>${opts.right || ''}<button class="tog" data-act="toggleSec" data-arg="${esc(key)}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${esc(title)}">${collapsed ? '▸' : '▾'}</button></div>${collapsed ? '' : body}</section>`;
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
function openMenu(anchor, items) {
  closeMenu();
  const m = document.createElement('div');
  m.className = 'menu';
  m.setAttribute('role', 'menu');
  m.innerHTML = items.map(it => it === '-' ? '<hr>' : `<button role="menuitem" class="${it.danger ? 'danger' : ''}" data-act="${it.act}" ${it.arg !== undefined ? `data-arg="${esc(it.arg)}"` : ''}>${it.label}${it.kb ? `<span class="kb">${it.kb}</span>` : ''}</button>`).join('');
  document.body.appendChild(m);
  const mw = m.offsetWidth, mh = m.offsetHeight;
  if (anchor.getBoundingClientRect) {
    const r = anchor.getBoundingClientRect();
    m.style.top = `${r.bottom + 6}px`;
    m.style.left = `${clamp(r.right - mw, 8, window.innerWidth - mw - 8)}px`;
  } else {
    m.style.top = `${clamp(anchor.y, 8, window.innerHeight - mh - 8)}px`;
    m.style.left = `${clamp(anchor.x, 8, window.innerWidth - mw - 8)}px`;
  }
  _menuEl = m;
  setTimeout(() => m.querySelector('button')?.focus(), 10);
}
function closeMenu() { if (!_menuEl) return false; _menuEl.remove(); _menuEl = null; return true; }
document.addEventListener('pointerdown', e => { if (_menuEl && !_menuEl.contains(e.target)) closeMenu(); }, true);
document.addEventListener('click', e => { if (_menuEl && _menuEl.contains(e.target) && e.target.closest('[data-act]')) setTimeout(closeMenu, 0); });

function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toast-root').appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- global actions ---------- */
Actions.view = v => {
  // gentle reminder when leaving a block that still has unsewable pieces
  if (ui.view === 'block' && v !== 'block' && typeof _seamState !== 'undefined') {
    const b = activeBlock();
    if (b && _seamState.block === b.id && _seamState.key === blockKey(b) && _seamState.s?.required.length && !seamDismissed(b)) {
      toast(`“${b.name}” has ${plural(_seamState.s.reqPieces, 'piece')} that need seams — see the suggestion in Blocks`, 4200);
    }
  }
  ui.view = v; ui.drawing = []; saveUi(); render(); $('#main').focus({ preventScroll: true }); document.body.classList.remove('show-sidebar', 'show-inspector'); };
Actions.undo = () => { if (!undo()) toast('Nothing to undo'); };
Actions.redo = () => { if (!redo()) toast('Nothing to redo'); };
Actions.toggleUnits = () => { ui.units = ui.units === 'cm' ? 'in' : 'cm'; saveUi(); render(); toast(ui.units === 'cm' ? 'Showing centimetres' : 'Showing inches'); };
Actions.toggleSec = key => { ui.collapsed[key] = !ui.collapsed[key]; saveUi(); render(); };
Actions.toggleDrawer = which => {
  const cls = which === 'sidebar' ? 'show-sidebar' : 'show-inspector';
  const on = !document.body.classList.contains(cls);
  document.body.classList.remove('show-sidebar', 'show-inspector');
  document.body.classList.toggle(cls, on);
};
Actions.setUi = (arg) => { const [k, v] = arg.split('='); ui[k] = v === 'true' ? true : v === 'false' ? false : v; saveUi(); render(); };
Actions.toggleUi = k => { ui[k] = !ui[k]; saveUi(); render(); };

Actions.fileMenu = (a, el) => openMenu(el, [
  { label: 'New blank project…', act: 'newProject' },
  { label: 'Load sample: Midnight Bullseye (straight set)…', act: 'loadSample' },
  { label: 'Load sample: Hexie Bloom (tessellation)…', act: 'loadTessSample' },
  '-',
  { label: 'Open project file…', act: 'openProject', kb: 'Ctrl+O' },
  { label: 'Save project file', act: 'saveProject', kb: 'Ctrl+S' },
  '-',
  { label: 'Import blocks from file…', act: 'importBlocks' },
  { label: 'Export all blocks…', act: 'exportBlocks', arg: 'all' },
  '-',
  { label: 'Export picture (PNG)…', act: 'exportPngDialog' },
  { label: 'Export vector (SVG)', act: 'exportSvg' },
  { label: 'Print pattern / Save as PDF', act: 'printPattern', kb: 'Ctrl+P' },
  '-',
  { label: 'Help & shortcuts', act: 'help', kb: '?' },
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
  img.onerror = () => { URL.revokeObjectURL(url); toast('Export failed — try SVG instead'); };
  img.src = url;
};

/* ---------- print ---------- */
function preparePrint() {
  const cls = ui.patternPage === 'a4' ? 'a4' : '';
  flatFills = true;
  let html;
  try { html = renderPatternDoc(); } finally { flatFills = false; }
  $('#print-root').innerHTML = html.replace(/class="page /g, `class="page ${cls} `);
  $('#page-size').textContent = `@page { size: ${ui.patternPage === 'a4' ? 'A4' : 'letter'} portrait; margin: 0.5in; }`;
}
Actions.printPattern = () => { preparePrint(); setTimeout(() => window.print(), 50); };
window.addEventListener('beforeprint', preparePrint);

/* ---------- help & about ---------- */
Actions.help = () => openModal(`<h2>How Quilt Designer works</h2>
  <div class="welcome-steps">
    <div><b>1 · Blocks</b>Draw your own blocks or start from the library. Paint pieces with fabrics.</div>
    <div><b>2 · Layout</b>Arrange blocks in a grid or on point, or build a tessellation of shapes. Add sashing, borders, binding.</div>
    <div><b>3 · Quilting</b>Plan the stitching lines: straight, crosshatch, waves, spirals and more.</div>
    <div><b>4 · Fabric & Cutting</b>See what to buy and exactly how to cut it — or check against fabric you already own.</div>
    <div><b>5 · Pattern</b>Print a complete step-by-step pattern or save it as a PDF.</div>
  </div>
  <h3>Shortcuts</h3>
  <div class="shortcuts">
    <h4>Everywhere</h4>
    <div><kbd>1</kbd>–<kbd>6</kbd> switch view</div>
    <div><kbd>Ctrl Z</kbd> undo · <kbd>Ctrl Shift Z</kbd> redo</div>
    <div><kbd>Ctrl S</kbd> save project file</div>
    <div><kbd>Ctrl P</kbd> print pattern</div>
    <div><kbd>G</kbd> value check (grayscale)</div>
    <h4>Block editor</h4>
    <div><kbd>V</kbd> paint · <kbd>S</kbd> select</div>
    <div><kbd>P</kbd> polygon · <kbd>R</kbd> rectangle</div>
    <div><kbd>T</kbd> half-square triangle · <kbd>K</kbd> seam</div>
    <div><kbd>Enter</kbd> close shape · <kbd>Backspace</kbd> undo point</div>
    <div><kbd>Esc</kbd> cancel · <kbd>Delete</kbd> delete selected</div>
    <div>Drag a shape to move it · arrows nudge</div>
    <div><kbd>Shift</kbd>-click / <kbd>Ctrl</kbd>-drag select several</div>
    <div><kbd>Ctrl D</kbd> duplicate · <kbd>Ctrl C</kbd>/<kbd>V</kbd> copy, paste</div>
    <div><kbd>Q</kbd>/<kbd>E</kbd> rotate · <kbd>X</kbd>/<kbd>Y</kbd> mirror</div>
    <div>Right-click a shape for options</div>
    <div>Double-click a corner to remove it · <kbd>Alt</kbd>-click an edge handle to add one</div>
    <div><kbd>Shift</kbd> snap to half grid · <kbd>Alt</kbd>-click pick fabric</div>
    <h4>Layout</h4>
    <div>Click / drag to place · right-click to clear</div>
    <div><kbd>R</kbd> rotate · <kbd>F</kbd> mirror selected</div>
    <div>Click a placed block again to rotate it</div>
    <div><kbd>Shift</kbd> place mirrored · <kbd>Shift</kbd>-click flips a placed block</div>
  </div>
  <div class="actions"><button class="btn primary" data-act="closeModal">Got it</button></div>`);
Actions.about = () => openModal(`<h2>Quilt Designer ${APP_VERSION}</h2>
  <p>A free tool to design blocks, lay out quilts, calculate fabric and cutting, plan quilting, and print complete patterns.</p>
  <p>Your project is saved automatically in this browser. Use <b>File → Save project file</b> to keep a copy or move it to another computer.</p>
  <p><a href="https://github.com/Ackley14/quiltthing" target="_blank" rel="noopener">Source code on GitHub</a> · MIT licence · Uses <a href="https://github.com/mfogel/polygon-clipping" target="_blank" rel="noopener">polygon-clipping</a> (MIT).</p>
  <div class="actions"><button class="btn primary" data-act="closeModal">Close</button></div>`);

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  const t = e.target;
  const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (closeMenu() || closeModal()) return;
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
  if (!ctrl && !e.altKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); Actions.view(VIEW_LIST[+e.key - 1].key); return; }
  if (!ctrl && (e.key === 'g' || e.key === 'G')) { Actions.toggleUi('grayscale'); return; }
  if (e.key === '?') { Actions.help(); return; }
  Views[ui.view]?.key?.(e);
});

/* ---------- pointer → svg coordinates ---------- */
function svgPoint(svg, e) {
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  return [pt.x, pt.y];
}
