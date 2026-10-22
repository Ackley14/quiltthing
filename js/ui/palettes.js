/* Palettes window: built-in palettes, your own, and a generator. Using a palette recolours the
   quilt in place (undoable); the window stays open so palettes can be compared. */

let _palTab = 'builtin';
const _gen = { base: '#2f6f8f', scheme: 'analog', n: 10, seed: 1, colors: null };
const genColors = () => _gen.colors || (_gen.colors = generatePalette(_gen.base, _gen.scheme, _gen.n, _gen.seed));

function palStrip(colors, values) {
  return `<div class="pal-strip">${colors.map(c => `<span style="background:${c.color}" title="${esc(c.name)}">${values ? `<i style="color:${inkOn(c.color)}">${valueLetter(c.color)}</i>` : ''}</span>`).join('')}</div>`;
}
function palRow(p, mine) {
  const using = paletteInUse(p);
  return `<div class="pal-row${using ? ' current' : ''}">
    <div class="pal-meta"><b>${esc(p.name)}</b><span class="muted">${plural(p.colors.length, 'fabric')}</span></div>
    ${palStrip(p.colors)}
    <div class="pal-acts"><button class="btn small" data-act="usePalette" data-arg="${p.id}" ${using ? 'disabled' : ''}>${using ? 'In use' : 'Use'}</button>${mine ? `<button class="btn small quiet danger" data-act="deletePalette" data-arg="${p.id}" aria-label="Delete ${esc(p.name)}" title="Delete">${icon('trash', 14)}</button>` : ''}</div></div>`;
}
function palettesBody() {
  if (_palTab === 'mine') {
    const mine = myPalettes();
    return mine.length ? mine.map(p => palRow(p, true)).join('') : '<p class="hint">No palettes of your own yet. Save this quilt\'s fabrics, or make one.</p>';
  }
  if (_palTab === 'make') {
    return `<div class="f-row"><label class="f">Start from<input type="color" value="${_gen.base}" data-change="palBase"></label>
      <label class="f">Fabrics<input type="number" min="3" max="20" value="${_gen.n}" data-change="palCount"></label></div>
      <div class="seg pal-schemes" role="group" aria-label="Colour scheme">${PALETTE_SCHEMES.map(([k, l]) => `<button data-act="palScheme" data-arg="${k}" aria-pressed="${_gen.scheme === k}">${l}</button>`).join('')}</div>
      <div class="pal-gen">${palStrip(genColors(), true)}</div>
      <p class="hint">L, M and D mark light, medium and dark. The order matches the built-in palettes.</p>
      <div class="btn-row"><button class="btn" data-act="palShuffle">Shuffle</button><span class="grow"></span><button class="btn" data-act="palGenSave">Save to my palettes</button><button class="btn primary" data-act="palGenUse">Use in this quilt</button></div>`;
  }
  return BUILTIN_PALETTES.map(p => palRow(p, false)).join('');
}
function renderPalettes() {
  const tabs = [['builtin', 'Built-in'], ['mine', `Mine (${myPalettes().length})`], ['make', 'Make one']];
  openModal(`<h2>Palettes</h2>
    <div class="pal-quilt"><span class="muted">This quilt</span>${palStrip(paletteOrder())}<button class="btn small" data-act="palSaveQuilt">Save as a palette…</button></div>
    <div class="seg pal-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-act="palTab" data-arg="${k}" aria-pressed="${_palTab === k}">${l}</button>`).join('')}</div>
    <div class="pal-body">${palettesBody()}</div>
    <p class="hint">The first colour goes to the background, the rest to your fabrics in order. To swap two fabrics, drag one swatch onto another in the Fabrics panel, or right-click it.</p>
    <div class="actions"><button class="btn primary" data-act="closeModal">Done</button></div>`);
  $('#modal-root .modal').classList.add('wide');
}
// keep the scroll position when the window redraws after a change
function refreshPalettes() {
  const body = $('#modal-root .pal-body'), top = body?.scrollTop || 0;
  if (!body) { renderInspector(); return; }
  renderPalettes();
  const nb = $('#modal-root .pal-body'); if (nb) nb.scrollTop = top;
}
Actions.palettes = () => (Panels.palettes ? Actions.openPanel('palettes') : renderPalettes());
Actions.palTab = t => { _palTab = t; refreshPalettes(); };
Actions.usePalette = id => {
  const p = findPalette(id); if (!p) return;
  applyPalette(p); commit(); refreshPalettes();
  toast(`Using ${p.name}. Ctrl+Z undoes it.`);
};
Actions.deletePalette = id => {
  const p = myPalettes().find(x => x.id === id); if (!p) return;
  confirmModal('Delete this palette?', `“${esc(p.name)}” is removed from this browser. Quilts that use its colours keep them.`, 'Delete', () => { saveMyPalettes(myPalettes().filter(x => x.id !== id)); refreshPalettes(); }, true);
};
// name a new palette, then go back to the Palettes window
function askPaletteName(suggest, onSave) {
  openModal(`<h2>Save palette</h2><label class="f">Name<input type="text" id="pal-name" value="${esc(suggest)}"></label>
    <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="palNameOk">Save</button></div>`);
  Actions.palNameOk = () => { onSave($('#pal-name')?.value.trim() || suggest); _palTab = 'mine'; closeModal(); refreshPalettes(); };
  setTimeout(() => { const i = $('#pal-name'); i?.select(); i?.addEventListener('keydown', e => { if (e.key === 'Enter') Actions.palNameOk(); }); }, 40);
}
Actions.palSaveQuilt = () => askPaletteName(doc.meta.title === 'Untitled quilt' ? 'My palette' : doc.meta.title, name => saveMyPalettes([paletteFromQuilt(name), ...myPalettes()]));
Actions.palGenSave = () => askPaletteName(`${colorName(_gen.base)} ${PALETTE_SCHEMES.find(x => x[0] === _gen.scheme)[1].toLowerCase()}`, name => saveMyPalettes([{ id: uid('pal'), name, colors: genColors() }, ...myPalettes()]));
Actions.palGenUse = () => { applyPalette({ colors: genColors() }); commit(); refreshPalettes(); toast('Palette applied. Ctrl+Z undoes it.'); };
Actions.palBase = v => { if (normHex(v)) { _gen.base = normHex(v); _gen.colors = null; refreshPalettes(); } };
Actions.palCount = v => { _gen.n = clamp(parseInt(v, 10) || 10, 3, 20); _gen.colors = null; refreshPalettes(); };
Actions.palScheme = k => { _gen.scheme = k; _gen.colors = null; refreshPalettes(); };
Actions.palShuffle = () => { _gen.seed = (_gen.seed * 7919 + 13) >>> 0; _gen.colors = null; refreshPalettes(); };

/* ---------- swapping two fabrics ---------- */
Actions.swapFabrics = arg => {
  const [a, b] = String(arg).split('|');
  if (!fabricById(a) || !fabricById(b) || a === b) return;
  const na = fabricLabel(a), nb = fabricLabel(b);
  swapFabrics(a, b); commit(`Swap ${na} and ${nb}`);
  toast(`Swapped ${na} and ${nb}`);
};
// opened from a right-click menu: wait for that menu to close, then open where it was
Actions.swapFabricMenu = (id, el) => {
  const r = el?.getBoundingClientRect?.(), at = r ? { x: r.left, y: r.top } : { x: innerWidth / 2, y: innerHeight / 3 };
  setTimeout(() => openMenu(at, [{ header: `Swap ${esc(fabricLabel(id))} with` }, ...doc.fabrics.filter(f => f.id !== id).map(f => ({ label: `${swatchHtml(f.id, 14)} ${esc(f.name)}`, act: 'swapFabrics', arg: `${id}|${f.id}` }))]), 20);
};
// drop one swatch on another to swap them
document.addEventListener('dragover', e => { if (dragFabricId && e.target.closest?.('[data-panel="fabrics"] .fab-chip[data-act="pickFabric"]:not(.bgpaint)')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } });
document.addEventListener('drop', e => {
  const el = e.target.closest?.('[data-panel="fabrics"] .fab-chip[data-act="pickFabric"]:not(.bgpaint)');
  if (!dragFabricId || !el || el.dataset.arg === dragFabricId) return;
  e.preventDefault();
  Actions.swapFabrics(`${dragFabricId}|${el.dataset.arg}`);
});
