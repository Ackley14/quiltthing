/* Panels available in every workspace: Fabric Properties, Palettes, Library, History, Issues and
   Navigator. */

/* ---------- Fabric Properties: the fabric editor as a panel (the swatch popover's pinned form) ---------- */
registerPanel('fabprops', {
  title: 'Fabric properties', short: 'Fabric', icon: 'swatch',
  render: () => { const f = selFabric(); return f ? `<div class="pad fabprops">${fabricEditor(f).replace(/<div class="pop-h">[\s\S]*?<\/div>/, `<div class="pop-h"><b>Fabric ${letterFor(doc.fabrics.indexOf(f))} · ${esc(f.name)}</b></div>`)}</div>` : panelNote('Pick a fabric in the Fabrics panel to edit it here.'); },
});
// the popover's pin docks it as the panel
Actions.pinFabricPanel = () => { ui.fabPop = null; renderFabricPopover(); Actions.openPanel('fabprops'); };

/* ---------- Palettes ---------- */
registerPanel('palettes', {
  title: 'Palettes', short: 'Palettes', icon: 'palette',
  render: () => {
    const tabs = [['builtin', 'Built-in'], ['mine', `Mine (${myPalettes().length})`], ['make', 'Make one']];
    return `<div class="pad"><div class="pal-quilt"><span class="muted">This quilt</span>${palStrip(paletteOrder())}</div>
      <div class="btn-row" style="margin:0 0 10px"><button class="btn small" data-act="palSaveQuilt">Save as a palette…</button></div>
      <div class="seg pal-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-act="palTab" data-arg="${k}" aria-pressed="${_palTab === k}">${l}</button>`).join('')}</div>
      <div class="pal-body in-panel">${palettesBody()}</div></div>`;
  },
});

/* ---------- Library: the block library, docked ---------- */
registerPanel('library', {
  title: 'Library', short: 'Library', icon: 'library', ws: ['block', 'layout'],
  render: () => `<div class="pad"><div class="lib-tools"><input type="text" placeholder="Search blocks" value="${esc(ui.libSearch)}" data-input="libSearch" aria-label="Search blocks"></div>
    <div class="lib-panel-folders">${libraryFolders()}</div><div class="blocks lib-grid in-panel">${libraryGrid()}</div></div>`,
  // the saved quilts are read once; then just this panel is redrawn
  after: () => { if (ui.libCat === 'mine' && !_savedLibLoaded) loadSavedBlocks().then(() => { for (const h of $$('[data-host="library"]')) dockSession.html.delete(h); dockRender(); }); },
});

/* ---------- History: the undo steps, named ---------- */
function historyPanel() {
  const past = histLabels.past, fut = histLabels.future, cur = undoStack.past.length;
  const rows = [`<button class="hist-row${cur === 0 ? ' on' : ''}" aria-current="${cur === 0}" data-act="histGo" data-arg="0"><span class="hist-n">${icon('history', 13)}</span><span>Start</span></button>`];
  past.forEach((l, i) => rows.push(`<button class="hist-row${cur === i + 1 ? ' on' : ''}" aria-current="${cur === i + 1}" data-act="histGo" data-arg="${i + 1}"><span class="hist-n">${i + 1}</span><span>${esc(l)}</span></button>`));
  for (let j = fut.length - 1, k = cur + 1; j >= 0; j--, k++) rows.push(`<button class="hist-row undone" data-act="histGo" data-arg="${k}" aria-label="${esc(fut[j])} (undone)"><span class="hist-n">${k}</span><span>${esc(fut[j])}</span></button>`);
  return `<div class="panel-tools"><span class="pt-note">${plural(past.length, 'step')}${fut.length ? ` · ${fut.length} undone` : ''}</span><span class="grow"></span>
    <button class="btn small quiet" data-act="undo" ${past.length ? '' : 'disabled'} title="Undo (Ctrl+Z)">${icon('undo', 14)}</button><button class="btn small quiet" data-act="redo" ${fut.length ? '' : 'disabled'} title="Redo (Ctrl+Shift+Z)">${icon('redo', 14)}</button></div>
    <div class="hist-list" aria-label="Undo history">${rows.join('')}</div>`;
}
registerPanel('history', { title: 'History', short: 'History', icon: 'history', render: historyPanel, after: host => host.querySelector('.hist-row.on')?.scrollIntoView({ block: 'nearest' }) });
Actions.histGo = n => {
  n = +n;
  const quiet = onDocChanged;
  onDocChanged = () => {};   // one redraw at the end, not one per step
  try {
    while (undoStack.past.length > n && undo());
    while (undoStack.past.length < n && redo());
  } finally { onDocChanged = quiet; }
  _Q = null; render();
};

/* ---------- Issues: every warning in one place ---------- */
let _issues = { key: '', list: [], pending: false };
// The last list worked out; a newer one is computed when the browser is idle, then the status chip
// and the Issues panel update.
function issueList() {
  const key = undoStack.current + '|' + ui.units;
  if (_issues.key !== key) {
    clearTimeout(_issues.timer);
    _issues.timer = setTimeout(() => (window.requestIdleCallback || (f => f()))(() => {
      if (undoStack.current + '|' + ui.units !== key) return;   // changed again: a newer timer will run
      const k = undoStack.current + '|' + ui.units, list = computeIssues();
      const changed = JSON.stringify(list) !== JSON.stringify(_issues.list);
      _issues = { ...(_issues), key: k, list };
      if (changed) { renderStatusChips(); dockRender(); }
    }, { timeout: 1500 }), 900);
  }
  return _issues.list;
}
function computeIssues() {
  const list = [];
  try {
    const Q = Qnow();
    for (const w of Q.warnings) list.push({ text: w, where: 'Layout', act: 'view', arg: 'layout' });
    for (const b of doc.blockOrder.map(id => doc.blocks[id]).filter(b => b?.kind === 'drawn' && blockUseCount(b.id))) {
      const kinds = new Set(pieceProblems(b, blockFrameSize(b)).map(p => p.kind));
      if (kinds.has('hole') || kinds.has('concave')) list.push({ text: `${b.name} needs set-in seams as drawn.`, where: 'Blocks', act: 'showSeamIssue', arg: b.id });
      if (kinds.has('curve')) list.push({ text: curveWarning(b), where: 'Blocks', act: 'showSeamIssue', arg: b.id });
    }
    for (const { b, n } of crumbBlocks(Q)) list.push({ text: crumbText(b, n), where: 'Blocks', act: b.kind === 'drawn' ? 'showSeamIssue' : 'blockOpen', arg: b.id });
    // grid squares that aren't whole eighths of an inch make cut sizes that are rounded, so the block can finish a little off
    for (const b of doc.blockOrder.map(id => doc.blocks[id]).filter(b => b?.kind === 'drawn' && !isHexBlock(b) && b.lattice !== 'tri' && blockUseCount(b.id))) {
      const S = blockFrameSize(b), u = S / b.n;
      if (Math.abs(u * 8 - Math.round(u * 8)) > 0.01) {
        const ok = [...Array(64).keys()].map(k => (k + 1) / 8 * b.n).filter(s => s >= S * 0.8 && s <= S * 1.3).sort((x, y) => Math.abs(x - S) - Math.abs(y - S))[0];
        list.push({ text: `${b.name}: its ${b.n} × ${b.n} grid makes ${u.toFixed(3).replace(/0+$/, '')}" squares, so cut sizes are rounded and the block may finish a little off.${ok ? ` A ${fmtLen(ok)} block works exactly.` : ''}`, where: 'Blocks', act: 'pickBlock', arg: b.id });
      }
    }
    const plan = cuttingPlan(Q);
    for (const w of plan.problems || []) list.push({ text: w, where: 'Fabric & cutting', act: 'view', arg: 'fabric' });
    if (doc.meta.title === 'Untitled quilt') list.push({ text: 'The quilt has no name yet. It goes on the pattern cover.', where: 'Pattern', act: 'focusTitle' });
    const bg = doc.layout.background;
    for (const f of doc.fabrics) if (f.id !== bg && blockUsesFabric(f.id) && contrastRatio(f.color, fabricHex(BG)) < 1.6) list.push({ text: `${f.name} has low contrast with the background.`, where: 'Fabrics', act: 'fabricPopover', arg: f.id });
  } catch (e) { console.error(e); }
  return list;
}
const blockUsesFabric = id => Object.values(doc.blocks).some(b => b.kind === 'drawn' && b.regions.some(r => r.fab === id));
function issueCount() { return issueList().length; }
registerPanel('issues', {
  title: 'Issues', short: 'Issues', icon: 'warn',
  render: () => { const list = issueList(); return list.length ? `<div class="issue-list">${list.map(x => `<div class="issue">${icon('warn', 14)}<div class="issue-t"><span>${esc(x.text)}</span><span class="muted">${esc(x.where)}</span></div><button class="btn small" data-act="${x.act}" ${x.arg !== undefined ? `data-arg="${esc(x.arg)}"` : ''}>Show me</button></div>`).join('')}</div>` : panelNote('Nothing to check. The quilt is ready to cut and print.'); },
});
Actions.showSeamIssue = id => { ui.activeBlock = id; ui.view = 'block'; ui.tool = 'seam'; saveUi(); render(); };
Actions.focusTitle = () => {
  const t = $('#doc-title');
  if (t && t.offsetParent !== null) { t.focus(); t.select(); return; }
  openModal(`<h2>Quilt name</h2><label class="f">Name<input type="text" id="rename-quilt" value="${esc(doc.meta.title)}"></label><div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="renameQuiltOk">Rename</button></div>`);
  setTimeout(() => { const i = $('#rename-quilt'); i?.select(); i?.addEventListener('keydown', e => { if (e.key === 'Enter') Actions.renameQuiltOk(); }); }, 30);
};
Actions.renameQuiltOk = () => { const v = $('#rename-quilt')?.value.trim(); closeModal(); if (v) { doc.meta.title = v; commit('Rename quilt'); } };

/* ---------- Navigator: zoom for the canvas ---------- */
registerPanel('navigator', {
  title: 'Navigator', short: 'Zoom', icon: 'search', ws: ['block', 'layout', 'quilting'],
  render: () => {
    const block = ui.view === 'block', ok = block ? activeBlock()?.kind === 'drawn' : ['layout', 'quilting'].includes(ui.view);
    if (!ok) return panelNote('Zoom works on the block, layout and quilting canvases.');
    const z = block ? edZoom() : qzZoom(), act = block ? 'edZoomBy' : 'qZoomBy';
    return `<div class="pad"><div class="nav-row"><button class="btn small" data-act="${act}" data-arg="out" aria-label="Zoom out">${icon('minus', 14)}</button>
      <input type="range" min="0" max="100" step="1" value="${Math.round(Math.log(z) / Math.log(block ? 16 : 12) * 100)}" data-input="navZoom" aria-label="Zoom">
      <button class="btn small" data-act="${act}" data-arg="in" aria-label="Zoom in">${icon('plus', 14)}</button></div>
      <div class="btn-row"><button class="btn small" data-act="${act}" data-arg="fit">Fit</button><span class="muted">${Math.round(z * 100)}%</span></div></div>`;
  },
});
Actions.navZoom = v => {
  const block = ui.view === 'block', z = Math.pow(block ? 16 : 12, +v / 100);
  if (block) setZoom(z); else qzSet(z);
};
