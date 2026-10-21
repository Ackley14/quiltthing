/* Left column (Blocks and Layout only): the fabric swatches and My blocks. A fabric is edited in
   a popover from its swatch; the block library opens as a picker. */

function renderSidebar() {
  if (SIDEBAR_VIEWS.includes(ui.view)) preserveFocus($('#sidebar'), () => { $('#sidebar').innerHTML = fabricsSection() + myBlocksSection(); });
  else $('#sidebar').innerHTML = '';
  renderFabricPopover();
}

/* ---------- fabrics ---------- */
const PRINT_LABELS = { solid: 'Solid', dots: 'Polka dot', speckle: 'Speckle', stripes: 'Stripe', gingham: 'Gingham', mottled: 'Mottled or batik', floral: 'Small floral' };

function fabricsSection() {
  const bgId = doc.layout.background;
  let chips = '';
  doc.fabrics.forEach((f, i) => {
    chips += `<button class="fab-chip${f.id === bgId ? ' is-bg' : ''}" aria-pressed="${ui.fabric === f.id}" data-act="pickFabric" data-arg="${f.id}" title="${esc(f.name)} (${letterFor(i)})${f.id === bgId ? ' · background' : ''}. Double-click to edit.">
      ${swatchHtml(f.id, 40)}<span class="lt" style="color:${inkOn(f.color)};text-shadow:0 0 2px ${inkOn(f.color) === '#ffffff' ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.9)'}">${letterFor(i)}</span>${ui.grayscale ? `<span class="val">${valueLetter(f.color)}</span>` : ''}</button>`;
  });
  chips += `<button class="fab-chip add" data-act="addFabric" title="Add a fabric" aria-label="Add a fabric">${icon('plus', 18)}</button>`;
  // painting with "Background" lets pieces follow whatever the quilt background is
  if (ui.view === 'block') chips += `<button class="fab-chip bgpaint" aria-pressed="${ui.fabric === BG}" data-act="pickFabric" data-arg="${BG}" title="Background: pieces follow the quilt's background fabric">BG</button>`;
  const f = selFabric();
  const right = f ? `<button class="icon-btn sm" data-act="fabricPopover" data-arg="${f.id}" title="Edit ${esc(f.name)}" aria-label="Edit ${esc(f.name)}">${icon('edit', 14)}</button>` : '';
  return section('Fabrics', `<div class="fabrics">${chips}</div>`, { key: 'fabrics', right });
}

// How this fabric comes (its own width, precuts, or pieces of a set size); default = the shared setting.
function fabricFormatFields(f) {
  const i = doc.fabrics.indexOf(f), fm = f.format;
  return `<label class="f">Bought as<select data-change="fabFormat">${formatOptionsHtml(fm, true)}</select></label>
    ${fm?.kind === 'yardage' ? lenField('Usable width', `fabrics.${i}.format.width`, { min: 5, max: 140 }) : ''}
    ${fm?.kind === 'piece' ? `<div class="f-row">${lenField('Piece width', `fabrics.${i}.format.w`, { min: 1, max: 140 })}${lenField('Piece length', `fabrics.${i}.format.h`, { min: 1, max: 400 })}</div>` : ''}`;
}
Actions.fabFormat = v => {
  const f = doc.fabrics.find(x => x.id === (ui.fabPop || ui.fabric)); if (!f) return;
  const fm = formatFromChoice(v, f.format);
  if (fm) f.format = fm; else delete f.format;
  commit();
};

// The fabric popover: everything about one fabric, opened from its swatch.
function fabricEditor(f) {
  const p = f.print || { kind: 'solid' };
  const isBg = f.id === doc.layout.background;
  const contrast = contrastRatio(f.color, fabricHex(BG));
  return `<div class="pop-h"><b>Fabric ${letterFor(doc.fabrics.indexOf(f))}</b><button class="icon-btn sm" data-act="closeFabricPopover" aria-label="Close">${icon('x', 14)}</button></div>
    <div class="row"><input type="text" value="${esc(f.name)}" data-change="fabName" aria-label="Fabric name">
      <input type="color" value="${f.color}" data-input="fabColorLive" data-change="fabColor" aria-label="Colour"></div>
    <div class="f-row">
      <label class="f">Hex<input type="text" value="${f.color}" data-change="fabHex" maxlength="7" spellcheck="false"></label>
      <label class="f">Print<select data-change="fabPrint">${PRINT_KINDS.map(k => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${PRINT_LABELS[k]}</option>`).join('')}</select></label>
    </div>
    ${p.kind !== 'solid' ? `<div class="f-row">
      <label class="f">Print colour<input type="color" value="${p.color2 || '#ffffff'}" data-input="fabColor2Live" data-change="fabColor2"></label>
      <label class="f">Print scale<input type="range" min="0.3" max="3" step="0.1" value="${p.scale || 1}" data-input="fabScaleLive" data-change="fabScale"></label>
    </div>` : ''}
    <label class="check"><input type="checkbox" ${f.directional ? 'checked' : ''} data-change="fabDir"> Directional print</label>
    ${fabricFormatFields(f)}
    ${!isBg && contrast < 1.6 ? '<p class="hint warn">Low contrast with the background.</p>' : ''}
    <div class="sub-h">Goes well with</div>
    <div class="harm">${harmonies(f.color).map(h => `<button style="background:${h.hex}" data-act="addFabricColor" data-arg="${h.hex}" title="Add ${colorName(h.hex)}" aria-label="Add ${h.label}"></button>`).join('')}</div>
    <div class="btn-row">
      ${isBg ? '<span class="muted">Quilt background</span>' : `<button class="btn small" data-act="setBackground" data-arg="${f.id}">Use as background</button>`}
      <button class="btn small" data-act="dupFabric" data-arg="${f.id}">Duplicate</button>
      <button class="btn small quiet danger" data-act="deleteFabric" data-arg="${f.id}">Delete</button>
    </div>`;
}
function renderFabricPopover() {
  let pop = $('#fab-pop');
  const f = ui.fabPop && doc.fabrics.find(x => x.id === ui.fabPop);
  if (!f) { pop?.remove(); ui.fabPop = null; return; }
  if (!pop) { pop = document.createElement('div'); pop.id = 'fab-pop'; pop.className = 'popover'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Edit fabric'); document.body.appendChild(pop); }
  preserveFocus(pop, () => { pop.innerHTML = fabricEditor(f); });
  // beside its swatch when the swatches are showing, otherwise near the top left of the page
  const chip = $(`#sidebar .fab-chip[data-arg="${CSS.escape(f.id)}"]`), side = $('#sidebar').getBoundingClientRect();
  const top = chip ? chip.getBoundingClientRect().top - 8 : 70;
  pop.style.left = `${chip ? side.right + 8 : 24}px`;
  pop.style.top = `${clamp(top, 60, window.innerHeight - pop.offsetHeight - 12)}px`;
}
Actions.fabricPopover = id => { ui.fabPop = ui.fabPop === id ? null : id; if (ui.fabPop) ui.fabric = id; renderSidebar(); };
Actions.closeFabricPopover = () => { ui.fabPop = null; renderFabricPopover(); };
document.addEventListener('dblclick', e => { const c = e.target.closest?.('.fab-chip[data-act="pickFabric"]'); if (c && c.dataset.arg !== BG) Actions.fabricPopover(c.dataset.arg); });
document.addEventListener('pointerdown', e => {
  if (!ui?.fabPop || e.target.closest?.('#fab-pop, .fab-chip, .menu, #modal-root .modal, [data-act="fabricPopover"]')) return;
  ui.fabPop = null; renderFabricPopover();
}, true);

const selFabric = () => doc.fabrics.find(x => x.id === ui.fabric);
Actions.pickFabric = id => { ui.fabric = id; if (ui.fabPop && id !== BG) ui.fabPop = id; saveUi(); Views[ui.view]?.onFabricPick?.(id); render(); };
Actions.addFabric = () => {
  const base = selFabric()?.color || '#1f3a5f';
  const [h, s, l] = hexToHsl(base);
  const f = makeFabric(hslToHex([h + 137.5, clamp(s, 0.35, 0.7), clamp(l, 0.35, 0.65)]));
  doc.fabrics.push(f); ui.fabric = ui.fabPop = f.id; commit();
};
Actions.addFabricColor = hex => { const f = makeFabric(hex); doc.fabrics.push(f); ui.fabric = f.id; if (ui.fabPop) ui.fabPop = f.id; commit(); toast(`Added ${f.name}`); };
Actions.dupFabric = id => { const f = { ...JSON.parse(JSON.stringify(fabricById(id))), id: uid('f') }; f.name += ' 2'; doc.fabrics.splice(fabricIndex(id) + 1, 0, f); ui.fabric = f.id; if (ui.fabPop) ui.fabPop = f.id; commit(); };
Actions.fabName = v => { const f = selFabric(); if (f) { f.name = v.trim() || colorName(f.color); commit(); } };
Actions.fabColorLive = v => { const f = selFabric(); if (f && normHex(v)) { f.color = normHex(v); updateFabricDefs(); renderMainOnly(); } };
Actions.fabColor = v => {
  const f = selFabric(); if (!f || !normHex(v)) return;
  // keep auto-generated names in sync with the colour, but never overwrite a name the user typed
  const prev = JSON.parse(undoStack.current || 'null')?.fabrics?.find(x => x.id === f.id);
  const auto = prev && f.name === colorName(prev.color);
  f.color = normHex(v);
  if (auto) f.name = colorName(f.color);
  commit();
};
Actions.fabHex = v => { const h = normHex(v); if (!h) { toast('Use a hex colour like #c44536'); render(); return; } Actions.fabColor(h); };
Actions.fabPrint = kind => { const f = selFabric(); if (!f) return; f.print = { ...(f.print || {}), kind }; if (!f.print.color2) f.print.color2 = mix(f.color, '#ffffff', .55); if (kind === 'stripes') f.directional = true; commit(); };
Actions.fabColor2Live = v => { const f = selFabric(); if (f) { f.print.color2 = v; updateFabricDefs(); renderMainOnly(); } };
Actions.fabColor2 = v => { const f = selFabric(); if (f) { f.print.color2 = v; commit(); } };
Actions.fabScaleLive = v => { const f = selFabric(); if (f) { f.print.scale = +v; updateFabricDefs(); renderMainOnly(); } };
Actions.fabScale = v => { const f = selFabric(); if (f) { f.print.scale = +v; commit(); } };
Actions.fabDir = v => { const f = selFabric(); if (f) { f.directional = !!v; commit(); } };
Actions.setBackground = id => { doc.layout.background = id; commit(); toast(`${fabricLabel(id)} is now the quilt background`); };

function fabricUsage(id) {
  let n = 0;
  for (const b of Object.values(doc.blocks)) if (b.kind === 'drawn') for (const r of b.regions) if (r.fab === id) n++;
  const L = doc.layout;
  const refs = [L.background, L.grid.sashing.fabric, L.grid.sashing.cornerFabric, L.onpoint.fill, L.tess.fill, L.tess.base, L.binding.fabric, L.backing?.fabric, ...L.borders.map(b => b.fabric),
    ...Object.values(L.tess.faces || {}), ...(L.panels || []).flatMap(p => [p.fab, ...(p.frames || []).map(f => f.fabric)])];
  n += refs.filter(r => r === id).length;
  n += Object.values(L.tess.colors).filter(r => r === id).length;
  return n;
}
function replaceFabric(oldId, newId) {
  for (const b of Object.values(doc.blocks)) if (b.kind === 'drawn') for (const r of b.regions) if (r.fab === oldId) r.fab = newId;
  const L = doc.layout;
  const swap = v => v === oldId ? newId : v;
  L.background = swap(L.background);
  L.grid.sashing.fabric = swap(L.grid.sashing.fabric);
  L.grid.sashing.cornerFabric = swap(L.grid.sashing.cornerFabric);
  L.onpoint.fill = swap(L.onpoint.fill);
  L.tess.fill = swap(L.tess.fill); L.tess.base = swap(L.tess.base);
  L.binding.fabric = swap(L.binding.fabric);
  for (const b of L.borders) b.fabric = swap(b.fabric);
  for (const k of Object.keys(L.tess.colors)) L.tess.colors[k] = swap(L.tess.colors[k]);
  L.grid.cells = L.grid.cells.map(c => c?.fab === oldId ? { fab: newId } : c);
  for (const k of Object.keys(L.grid.hidden || {})) if (L.grid.hidden[k]?.fab === oldId) L.grid.hidden[k] = { fab: newId };
  for (const k of Object.keys(L.onpoint.cells)) if (L.onpoint.cells[k]?.fab === oldId) L.onpoint.cells[k] = { fab: newId };
  for (const s of doc.stash) s.fabric = swap(s.fabric);
  if (L.backing) L.backing.fabric = swap(L.backing.fabric);
  if (L.tess.faces) for (const k of Object.keys(L.tess.faces)) L.tess.faces[k] = swap(L.tess.faces[k]);
  for (const p of L.panels || []) { p.fab = swap(p.fab); for (const fr of p.frames || []) fr.fabric = swap(fr.fabric); }
}
Actions.deleteFabric = id => {
  if (doc.fabrics.length <= 2) { toast('Keep at least two fabrics'); return; }
  const others = doc.fabrics.filter(f => f.id !== id);
  const uses = fabricUsage(id);
  openModal(`<h2>Delete “${esc(fabricLabel(id))}”?</h2>
    <p>${uses ? `It's used in ${plural(uses, 'place')}. Those will switch to:` : 'It isn’t used anywhere yet.'}</p>
    ${uses ? `<select id="repl-fab">${others.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select>` : ''}
    <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn danger" data-act="confirmDeleteFabric" data-arg="${id}">Delete fabric</button></div>`);
};
Actions.confirmDeleteFabric = id => {
  const repl = $('#repl-fab')?.value || doc.fabrics.find(f => f.id !== id).id;
  closeModal();
  replaceFabric(id, repl);
  doc.fabrics = doc.fabrics.filter(f => f.id !== id);
  ui.fabric = repl;
  commit();
};

/* ---------- my blocks ---------- */
function blockUseCount(id) {
  const L = doc.layout;
  let n = L.grid.cells.filter(c => c?.b === id).length + Object.values(L.onpoint.cells).filter(c => c?.b === id).length;
  n += Object.values(L.tess.blocks || {}).filter(c => c?.b === id).length + (L.panels || []).filter(p => p.b === id).length;
  for (const b of Object.values(doc.blocks)) if (b.kind === 'compound') n += b.slots.filter(s => s?.b === id).length;
  return n;
}
let dragBlockId = null;   // a My blocks thumbnail being dragged onto the layout
document.addEventListener('dragstart', e => {
  const el = e.target.closest?.('.blk[data-act="pickBlock"]');
  dragBlockId = el?.dataset.arg || null;
  if (dragBlockId) { e.dataTransfer.setData('text/plain', doc.blocks[dragBlockId]?.name || ''); e.dataTransfer.effectAllowed = 'copy'; }
});
document.addEventListener('dragend', () => { dragBlockId = null; });
function myBlocksSection() {
  const fillingSlot = ui.view === 'block' && activeBlock()?.kind === 'compound' && ui.activeSlot != null;
  let grid = '';
  for (const id of doc.blockOrder) {
    const b = doc.blocks[id];
    if (!b) continue;
    const n = blockUseCount(id);
    const target = fillingSlot && id !== ui.activeBlock && !wouldCycle(ui.activeBlock, id) && !isHexBlock(b);
    grid += `<button class="blk${target ? ' target' : ''}" draggable="${ui.view === 'layout'}" aria-pressed="${(ui.view === 'layout' ? placeBlock()?.id : ui.activeBlock) === id}" data-act="pickBlock" data-arg="${id}" title="${esc(b.name)}${n ? ` · used ${n}×` : ''}">
      ${blockThumb(b, 72)}<div class="nm">${esc(b.name)}</div></button>`;
  }
  const right = `<button class="btn small" data-act="addBlockMenu" aria-haspopup="menu">${icon('plus', 14)} Add</button>`;
  const hint = fillingSlot ? `<p class="hint">Pick a block for slot ${ui.activeSlot + 1}.</p>` : '';
  return section('My blocks', `${hint}${grid ? `<div class="blocks">${grid}</div>` : `<div class="empty-state"><p>No blocks yet.</p><button class="btn primary" data-act="libraryPicker">Browse classic blocks</button></div>`}`, { key: 'myblocks', right });
}
Actions.addBlockMenu = (a, el) => openMenu(el, [
  { label: 'Classic block from the library…', act: 'libraryPicker' },
  { label: 'Draw a new block', act: 'newBlock' },
  { label: 'Hexagon block', act: 'newHexBlock' },
  { label: 'Combination of blocks', act: 'newCompound' },
  '-',
  { label: 'Import blocks…', act: 'importBlocks' },
  ...(activeBlock() ? [{ label: `Export ${esc(activeBlock().name)}…`, act: 'exportBlocks', arg: 'one' }] : []),
  ...(doc.blockOrder.length > 1 ? [{ label: `Export all ${doc.blockOrder.length} blocks…`, act: 'exportBlocks', arg: 'all' }] : []),
]);
Actions.pickBlock = id => {
  const host = activeBlock();
  if (ui.view === 'block' && host?.kind === 'compound' && ui.activeSlot != null && id !== host.id) {
    if (wouldCycle(host.id, id)) { toast("A block can't contain itself"); return; }
    if (isHexBlock(doc.blocks[id])) { toast('Hexagon blocks go in hexagon tessellations, not combination blocks'); return; }
    host.slots[ui.activeSlot] = { b: id, r: host.slots[ui.activeSlot]?.r || 0, f: false };
    ui.activeSlot = nextEmptySlot(host, ui.activeSlot);
    commit();
    return;
  }
  // in Layout a pick only chooses what to place; the editor keeps its block
  if (ui.view === 'layout') { ui.placeBlock = id; saveUi(); render(); return; }
  ui.activeBlock = ui.placeBlock = id; ui.selRegion = null; ui.selEdge = null; ui.drawing = []; ui.activeSlot = null;
  if (ui.view !== 'block') ui.view = 'block';
  saveUi(); render();
};
function nextEmptySlot(host, from) {
  for (let k = 1; k <= host.slots.length; k++) { const i = (from + k) % host.slots.length; if (!host.slots[i]) return i; }
  return null;
}
/* ---------- block files (share blocks between projects or people) ---------- */
// A block file carries the blocks, any blocks they contain (combination blocks), and the
// fabrics they use, so it looks the same when imported elsewhere.
function blockBundle(ids) {
  const all = new Set();
  const visit = id => {
    const b = doc.blocks[id];
    if (!b || all.has(id)) return;
    all.add(id);
    if (b.kind === 'compound') for (const s of b.slots) if (s?.b) visit(s.b);
  };
  ids.forEach(visit);
  const blocks = doc.blockOrder.filter(id => all.has(id)).map(id => doc.blocks[id]);
  const fabIds = new Set();
  for (const b of blocks) if (b.kind === 'drawn') for (const r of b.regions) if (r.fab !== BG) fabIds.add(r.fab);
  const refs = refsFor(blocks.map(b => b.id));
  return { app: 'quiltthing', kind: 'blocks', version: 3, blocks, fabrics: doc.fabrics.filter(f => fabIds.has(f.id)), ...(Object.keys(refs).length ? { refImages: refs } : {}) };
}
Actions.exportBlocks = which => {
  const ids = which === 'one' && activeBlock() ? [activeBlock().id] : doc.blockOrder.slice();
  if (!ids.length) { toast('No blocks to export'); return; }
  const bundle = blockBundle(ids);
  const name = which === 'one' ? slugify(activeBlock().name) : slugify(doc.meta.title) + '-blocks';
  downloadBlob(`${name}.qblocks.json`, new Blob([JSON.stringify(bundle, null, 1)], { type: 'application/json' }));
  toast(`Exported ${plural(bundle.blocks.length, 'block')}`);
};
Actions.importBlocks = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = () => inp.files[0]?.text().then(text => {
    let data;
    try { data = JSON.parse(text); } catch { toast("That file isn't valid JSON"); return; }
    // accept block files, and also whole project files (import their blocks)
    const ok = data?.app === 'quiltthing' && data.version === 3 && (data.kind === 'blocks' ? Array.isArray(data.blocks) : data.blocks && data.blockOrder);
    if (!ok) { openModal(`<h2>Couldn't import blocks</h2><p>That doesn't look like a Quilt Designer block file or project.</p><div class="actions"><button class="btn primary" data-act="closeModal">OK</button></div>`); return; }
    const blocks = data.kind === 'blocks' ? data.blocks : data.blockOrder.map(id => data.blocks[id]).filter(Boolean);
    // fabrics: reuse an existing fabric with the same colour and name, otherwise add it
    const fabMap = new Map();
    let addedFabs = 0;
    for (const f of data.fabrics || []) {
      const hit = doc.fabrics.find(x => x.color === f.color && x.name === f.name) || doc.fabrics.find(x => x.color === f.color);
      if (hit) fabMap.set(f.id, hit.id);
      else { const nf = { ...JSON.parse(JSON.stringify(f)), id: uid('f') }; doc.fabrics.push(nf); fabMap.set(f.id, nf.id); addedFabs++; }
    }
    const fab = id => id === BG ? BG : fabMap.get(id) || (doc.fabrics.some(x => x.id === id) ? id : BG);
    // fresh block ids, with combination-block references remapped
    const idMap = new Map(blocks.map(b => [b.id, uid('b')]));
    for (const b of blocks) {
      const c = JSON.parse(JSON.stringify(b));
      c.id = idMap.get(b.id);
      if (c.kind === 'drawn') for (const r of c.regions) r.fab = fab(r.fab);
      else if (c.kind === 'compound') c.slots = c.slots.map(s => s && idMap.has(s.b) ? { ...s, b: idMap.get(s.b) } : null);
      doc.blocks[c.id] = c;
      doc.blockOrder.push(c.id);
    }
    // tracing pictures travel with their blocks
    let pics = 0;
    for (const [old, r] of Object.entries(data.refImages || {})) if (idMap.has(old)) { refImgs[idMap.get(old)] = r; pics++; }
    if (pics) saveRefs();
    if (blocks.length) ui.activeBlock = idMap.get(blocks[blocks.length - 1].id);
    commit();
    toast(`Imported ${plural(blocks.length, 'block')}${addedFabs ? ` and ${plural(addedFabs, 'new fabric')}` : ''}`);
  });
  inp.click();
};
Actions.newBlock = () => { addBlockToDoc(newDrawnBlock(`Block ${doc.blockOrder.length + 1}`)); ui.view = 'block'; ui.tool = 'rect'; commit(); };
Actions.newHexBlock = () => {
  addBlockToDoc(newDrawnBlock(`Hexagon ${doc.blockOrder.length + 1}`, 6, 'hex'));
  ui.view = 'block'; ui.tool = 'tri';
  commit();
  if (!(doc.layout.mode === 'tess' && doc.layout.tess.shape === 'hex')) toast('Hexagon blocks fill the shapes of a Hexagons tessellation (Layout → Tessellation)', 4500);
};
Actions.newCompound = () => { addBlockToDoc(newCompoundBlock(`Combo ${doc.blockOrder.length + 1}`)); ui.view = 'block'; ui.activeSlot = 0; commit(); };

/* ---------- library picker ---------- */
function libraryGrid() {
  const q = ui.libSearch.trim().toLowerCase();
  const list = LIBRARY.filter(p => (ui.libCat === 'all' || p.cat === ui.libCat) && (!q || p.name.toLowerCase().includes(q)));
  return list.length ? list.map(p => `<button class="blk" data-act="useLibrary" data-arg="${p.id}" title="${esc(p.name)}">${blockThumb(presetPreviewBlock(p), 84)}<div class="nm">${esc(p.name)}</div></button>`).join('') : '<p class="empty">No blocks match.</p>';
}
Actions.libraryPicker = () => {
  openModal(`<h2>Classic blocks</h2>
    <div class="lib-tools"><input type="text" placeholder="Search" value="${esc(ui.libSearch)}" data-input="libSearch" aria-label="Search blocks">
      <select data-change="libCat" aria-label="Category">${LIB_CATEGORIES.map(([k, l]) => `<option value="${k}" ${ui.libCat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="blocks lib-grid" id="lib-grid">${libraryGrid()}</div>
    <p class="hint">Added blocks use your fabrics and can be edited.</p>`);
  $('#modal-root .modal').classList.add('wide');
};
Actions.libSearch = v => { ui.libSearch = v; const g = $('#lib-grid'); if (g) g.innerHTML = libraryGrid(); };
Actions.libCat = v => { ui.libCat = v; saveUi(); const g = $('#lib-grid'); if (g) g.innerHTML = libraryGrid(); };
Actions.useLibrary = pid => {
  const p = LIBRARY.find(x => x.id === pid);
  if (!p) return;
  const host = activeBlock();
  const b = instantiatePreset(p);
  addBlockToDoc(b, false);
  if (ui.view === 'block' && host?.kind === 'compound' && ui.activeSlot != null) {
    host.slots[ui.activeSlot] = { b: b.id, r: 0, f: false };
    ui.activeSlot = nextEmptySlot(host, ui.activeSlot);
  } else {
    ui.placeBlock = b.id;
    if (ui.view !== 'layout') { ui.activeBlock = b.id; ui.selRegion = null; ui.drawing = []; ui.view = 'block'; }
  }
  closeModal();
  commit();
  toast(`${p.name} added`);
};
