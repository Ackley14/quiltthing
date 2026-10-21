/* Left sidebar: fabric palette (with editor) and blocks (mine + library). */

function renderSidebar() {
  preserveFocus($('#sidebar'), () => {
    $('#sidebar').innerHTML = fabricsSection() + myBlocksSection() + librarySection();
  });
}

/* ---------- fabrics ---------- */
const PRINT_LABELS = { solid: 'Solid', dots: 'Polka dot', speckle: 'Speckle', stripes: 'Stripe', gingham: 'Gingham', mottled: 'Mottled / batik', floral: 'Small floral' };

function fabricsSection() {
  const bgId = doc.layout.background;
  let chips = '';
  doc.fabrics.forEach((f, i) => {
    chips += `<button class="fab-chip" aria-pressed="${ui.fabric === f.id}" data-act="pickFabric" data-arg="${f.id}" title="${esc(f.name)} (${letterFor(i)}) · ${valueClass(f.color)} value">
      ${swatchHtml(f.id, 40)}<span class="lt" style="color:${inkOn(f.color)};text-shadow:0 0 2px ${inkOn(f.color) === "#ffffff" ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.9)"}">${letterFor(i)}</span><span class="val">${valueLetter(f.color)}</span>${f.id === bgId ? '<span class="bgtag">BG</span>' : ''}</button>`;
  });
  chips += `<button class="fab-chip add" data-act="addFabric" title="Add a fabric" aria-label="Add a fabric">+</button>`;
  // last, so the fabric swatches sit in the same place on every tab
  if (ui.view === 'block') chips += `<button class="fab-chip bgpaint" aria-pressed="${ui.fabric === BG}" data-act="pickFabric" data-arg="${BG}" title="Quilt background — follows whatever fabric is set as the background">Quilt<br>BG</button>`;
  const sorted = doc.fabrics.slice().sort((a, b) => hexToLab(b.color)[0] - hexToLab(a.color)[0]);
  const valueBar = `<div class="valuebar" title="Your fabrics from lightest to darkest — good quilts usually have a spread of values">${sorted.map(f => `<span style="background:${f.color}" title="${esc(f.name)}"></span>`).join('')}</div>`;
  const body = `<div class="fabrics">${chips}</div>${valueBar}${fabricEditor()}`;
  return section('Fabrics', body, { key: 'fabrics' });
}

// How this fabric comes (its own width, precuts, or pieces of a set size); default = the shared setting.
function fabricFormatFields(f) {
  const i = doc.fabrics.indexOf(f), fm = f.format;
  // the extra fields share one fixed-height slot so the panels below don't jump
  return `<label class="f">Comes as<select data-change="fabFormat">${formatOptionsHtml(fm, true)}</select></label>
    <div class="fmt-extra">${fm?.kind === 'yardage' ? lenField('Usable width', `fabrics.${i}.format.width`, { min: 5, max: 140 }) : ''}
    ${fm?.kind === 'piece' ? `<div class="f-row">${lenField('Piece width', `fabrics.${i}.format.w`, { min: 1, max: 140 })}${lenField('Piece length', `fabrics.${i}.format.h`, { min: 1, max: 400 })}</div>` : ''}
    ${!fm ? '<p class="hint" style="margin:6px 0 0">How you buy this fabric. The default is set in Fabric → Cutting settings; fabric you already own goes in Your stash.</p>' : fm.kind === 'precut' ? '<p class="hint" style="margin:6px 0 0">Bought as precut pieces — cuts too big for them come from yardage.</p>' : ''}</div>`;
}
Actions.fabFormat = v => {
  const f = doc.fabrics.find(x => x.id === ui.fabric); if (!f) return;
  const fm = formatFromChoice(v, f.format);
  if (fm) f.format = fm; else delete f.format;
  commit();
};

function fabricEditor() {
  const f = doc.fabrics.find(x => x.id === ui.fabric);
  if (!f) {
    if (ui.fabric === BG) return `<p class="hint fab-edit">Painting with <b>Quilt background</b>: pieces follow the quilt's background fabric (<b>${esc(fabricLabel(BG))}</b>), so you can change it for every block at once.</p>`;
    return '';
  }
  const p = f.print || { kind: 'solid' };
  const isBg = f.id === doc.layout.background;
  const contrast = contrastRatio(f.color, fabricHex(BG));
  return `<div class="fab-edit">
    <div class="row"><input type="text" value="${esc(f.name)}" data-change="fabName" aria-label="Fabric name">
      <input type="color" value="${f.color}" data-input="fabColorLive" data-change="fabColor" aria-label="Fabric colour" title="Pick colour"></div>
    <div class="f-row">
      <label class="f">Hex<input type="text" value="${f.color}" data-change="fabHex" maxlength="7" spellcheck="false"></label>
      <label class="f">Print<select data-change="fabPrint">${PRINT_KINDS.map(k => `<option value="${k}" ${p.kind === k ? 'selected' : ''}>${PRINT_LABELS[k]}</option>`).join('')}</select></label>
    </div>
    <div class="f-row${p.kind === 'solid' ? ' off' : ''}" ${p.kind === 'solid' ? 'title="Choose a print above to set these"' : ''}>
      <label class="f">Print colour<input type="color" value="${p.color2 || '#ffffff'}" data-input="fabColor2Live" data-change="fabColor2" ${p.kind === 'solid' ? 'disabled' : ''}></label>
      <label class="f">Print scale<input type="range" min="0.3" max="3" step="0.1" value="${p.scale || 1}" data-input="fabScaleLive" data-change="fabScale" ${p.kind === 'solid' ? 'disabled' : ''}></label>
    </div>
    <label class="check"><input type="checkbox" ${f.directional ? 'checked' : ''} data-change="fabDir"> Directional print (don't rotate when cutting)</label>
    ${fabricFormatFields(f)}
    <p class="hint">${esc(colorName(f.color))} · <b>${valueClass(f.color)}</b> value${isBg ? ' · <b>quilt background</b>' : ` · contrast with background ${contrast.toFixed(1)}:1${contrast < 1.6 ? ' — <b>low</b>, may blend in' : ''}`}</p>
    <div class="hint" style="margin-top:8px">Suggestions — click to add:</div>
    <div class="harm">${harmonies(f.color).map(h => `<button style="background:${h.hex}" data-act="addFabricColor" data-arg="${h.hex}" title="${h.label} · ${colorName(h.hex)}" aria-label="Add ${h.label}"></button>`).join('')}</div>
    <div class="btn-row">
      ${isBg ? '' : `<button class="btn small" data-act="setBackground" data-arg="${f.id}" title="Make this the quilt background fabric">Use as background</button>`}
      <button class="btn small" data-act="dupFabric" data-arg="${f.id}">Duplicate</button>
      <button class="btn small danger" data-act="deleteFabric" data-arg="${f.id}">Delete</button>
    </div>
  </div>`;
}

const selFabric = () => doc.fabrics.find(x => x.id === ui.fabric);
Actions.pickFabric = id => { ui.fabric = id; saveUi(); Views[ui.view]?.onFabricPick?.(id); render(); };
Actions.addFabric = () => {
  const base = selFabric()?.color || '#1f3a5f';
  const [h, s, l] = hexToHsl(base);
  const f = makeFabric(hslToHex([h + 137.5, clamp(s, 0.35, 0.7), clamp(l, 0.35, 0.65)]));
  doc.fabrics.push(f); ui.fabric = f.id; commit();
};
Actions.addFabricColor = hex => { const f = makeFabric(hex); doc.fabrics.push(f); ui.fabric = f.id; commit(); toast(`Added ${f.name}`); };
Actions.dupFabric = id => { const f = { ...JSON.parse(JSON.stringify(fabricById(id))), id: uid('f') }; f.name += ' 2'; doc.fabrics.splice(fabricIndex(id) + 1, 0, f); ui.fabric = f.id; commit(); };
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
function myBlocksSection() {
  const fillingSlot = ui.view === 'block' && activeBlock()?.kind === 'compound' && ui.activeSlot != null;
  let grid = '';
  for (const id of doc.blockOrder) {
    const b = doc.blocks[id];
    if (!b) continue;
    const n = blockUseCount(id);
    const target = fillingSlot && id !== ui.activeBlock && !wouldCycle(ui.activeBlock, id) && !isHexBlock(b);
    grid += `<button class="blk${target ? ' target' : ''}" aria-pressed="${ui.activeBlock === id}" data-act="pickBlock" data-arg="${id}" title="${esc(b.name)}${n ? ` — used ${n}×` : ''}">
      ${blockThumb(b, 72)}<div class="nm">${esc(b.name)}</div>${n ? `<span class="use">${n}</span>` : ''}</button>`;
  }
  const right = `<button class="btn small ghost" data-act="newBlock" title="Draw a new block">+ New</button><button class="btn small ghost" data-act="newHexBlock" title="A hexagon block for hexagon tessellations">+ Hex</button><button class="btn small ghost" data-act="newCompound" title="A block made of other blocks">+ Combo</button><button class="btn small ghost" data-act="blockFileMenu" title="Import or export blocks" aria-label="Import or export blocks">⇅</button>`;
  const hint = fillingSlot ? `<div class="callout">Pick a block to put in slot ${ui.activeSlot + 1}.</div>` : '';
  return section('My blocks', `${hint}${grid ? `<div class="blocks">${grid}</div>` : '<p class="empty">No blocks yet. Draw one, or pick from the library below.</p>'}`, { key: 'myblocks', right });
}
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
  ui.activeBlock = id; ui.selRegion = null; ui.selEdge = null; ui.drawing = []; ui.activeSlot = null;
  if (ui.view !== 'layout' && ui.view !== 'block') ui.view = 'block';
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
Actions.blockFileMenu = (a, el) => openMenu(el, [
  ...(activeBlock() ? [{ label: `Export “${esc(activeBlock().name)}”…`, act: 'exportBlocks', arg: 'one' }] : []),
  { label: `Export all my blocks (${doc.blockOrder.length})`, act: 'exportBlocks', arg: 'all' },
  { label: 'Import blocks from file…', act: 'importBlocks' },
]);
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

/* ---------- library ---------- */
function librarySection() {
  const q = ui.libSearch.trim().toLowerCase();
  const list = LIBRARY.filter(p => (ui.libCat === 'all' || p.cat === ui.libCat) && (!q || p.name.toLowerCase().includes(q)));
  const tools = `<div class="lib-tools"><input type="text" placeholder="Search blocks…" value="${esc(ui.libSearch)}" data-input="libSearch" aria-label="Search library">
    <select data-change="libCat" aria-label="Category">${LIB_CATEGORIES.map(([k, l]) => `<option value="${k}" ${ui.libCat === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
  const grid = list.length ? `<div class="blocks" id="lib-grid">${list.map(p => `<button class="blk" data-act="useLibrary" data-arg="${p.id}" title="Add ${esc(p.name)} to My blocks">${blockThumb(presetPreviewBlock(p), 72)}<div class="nm">${esc(p.name)}</div></button>`).join('')}</div>` : `<p class="empty">No blocks match.</p>`;
  return section('Block library', `${tools}${grid}<p class="hint">Click a block to copy it into My blocks — it picks up your fabrics, and you can edit it freely.</p>`, { key: 'library' });
}
Actions.libSearch = v => {
  ui.libSearch = v; saveUi();
  const sec = $('#lib-grid')?.closest('.sec') || $$('#sidebar .sec').pop();
  // hold the section's height while filtering so the column (and the box being typed in) doesn't move
  sec.style.minHeight = v.trim() ? `${Math.max(sec.offsetHeight, parseFloat(sec.style.minHeight) || 0)}px` : '';
  const tmp = document.createElement('div');
  tmp.innerHTML = librarySection();
  preserveFocus(sec, () => { sec.innerHTML = tmp.firstElementChild.innerHTML; });
};
Actions.libCat = v => { ui.libCat = v; saveUi(); renderSidebar(); };
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
    ui.activeBlock = b.id; ui.selRegion = null; ui.drawing = [];
    if (ui.view !== 'layout') ui.view = 'block';
  }
  commit();
  toast(`${p.name} added to My blocks`);
};
