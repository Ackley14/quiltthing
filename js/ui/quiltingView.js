/* Quilting view: stack of generated quilting-line layers previewed over the quilt. */

Views.quilting = {
  tools() { return { act: 'qTool', active: ui.qTool || 'hand', list: NAV_TOOLS }; },
  docs() { const back = ui.qSide === 'back'; return [{ label: 'Front', on: !back, act: 'qSide', arg: 'front', icon: 'quilt' }, { label: 'Back', on: back, act: 'qSide', arg: 'back', icon: 'quilt' }]; },
  options() {
    return `<button class="tool fab-drop" data-act="addLayerMenu" aria-haspopup="menu">${icon('plus', 14)} Add quilting ${icon('down', 12)}</button>`;
  },
  main() {
    const Q = Qnow();
    const layers = doc.quilting.layers;
    const stats = quiltingStats(Q);
    const back = ui.qSide === 'back';
    const bk = back ? cuttingPlan(Q).backing : null, bf = doc.layout.backing?.fabric;
    return `<div class="stage"><div class="canvas-wrap">${back ? quiltBackSvg(Q) : quiltSvg(Q, { faded: !!ui.qFade, quilting: quiltingSvg(Q) })}</div>
      <div class="status-bar">${back ? `Back of the quilt, stitching mirrored. ${bf ? esc(fabricLabel(bf)) : 'No backing fabric chosen'} · ${esc(bk.chosen.title.toLowerCase())}. <a href="#" data-act="goBacking">Backing settings</a>` : layers.length
        ? `About <b>${Math.round(stats.total / 36)} yd</b> of stitching · <b>${Math.ceil(stats.threadYds / 50) * 50} yd</b> of thread, top and bobbin`
        : 'No quilting yet.'}</div></div>`;
  },
  props() { return quiltLayerProps(); },
  inspector() { return quiltLayersPanel() + quiltLayerProps(); },
};
// The Layers panel: the quilting layers, top first (stitched first). Click one to open it in Properties.
function quiltLayersPanel() {
  const layers = doc.quilting.layers, open = layers.find(L => L.id === ui.qOpen) ? ui.qOpen : layers[0]?.id;
  const rows = layers.map((L, i) => {
    const t = quiltType(L.type), where = (QUILT_AREAS.find(([k]) => k === L.area) || [null, ''])[1];
    return `<div class="part-row layer${L.visible ? '' : ' hidden-layer'}" role="listitem" data-arg="${L.id}" data-li="${i}" draggable="true" aria-current="${L.id === open}">
      <button class="part-pick" data-act="qPick" data-arg="${L.id}" aria-current="${L.id === open}"><span class="part-ic"><span class="layer-sw" style="background:${L.color}"></span></span><span class="part-t"><b>${t.label}</b><span class="muted">${esc(where)}</span></span></button>
      <button class="icon-btn sm eye" data-act="qToggleShow" data-arg="${i}" title="${L.visible ? 'Hide' : 'Show'}" aria-label="${L.visible ? 'Hide' : 'Show'} ${t.label}" aria-pressed="${!!L.visible}">${icon(L.visible ? 'eye' : 'eyeoff', 14)}</button></div>`;
  }).join('');
  return `<div class="panel-tools"><span class="pt-note">${plural(layers.length, 'layer')}</span><span class="grow"></span><button class="btn small" data-act="addLayerMenu" aria-haspopup="menu">${icon('plus', 14)} Add ${icon('down', 12)}</button></div>
    ${layers.length ? `<div class="part-list" role="list" aria-label="Quilting layers, stitched in this order">${rows}</div>` : panelNote('No quilting planned yet.', ['addLayerMenu'], 'Add quilting')}`;
}
// Properties in Quilting: the layer picked in the Layers panel.
function quiltLayerProps() {
  const layers = doc.quilting.layers, Q = Qnow(), stats = quiltingStats(Q);
  const i = Math.max(0, layers.findIndex(L => L.id === ui.qOpen)), L = layers[i];
  if (!L) return panelNote('Add a quilting layer to plan the stitching.', ['addLayerMenu'], 'Add quilting');
  const t = quiltType(L.type), p = `quilting.layers.${i}`, len = stats.per[i]?.length || 0;
  return `<div class="props-head"><span class="layer-sw" style="background:${L.color}"></span><b>${t.label}</b><span class="grow"></span>
      <button class="icon-btn sm" data-act="qToggleShow" data-arg="${i}" title="${L.visible ? 'Hide' : 'Show'}" aria-label="${L.visible ? 'Hide' : 'Show'} ${t.label}">${icon(L.visible ? 'eye' : 'eyeoff', 14)}</button></div>
    <div class="pad">
        <div class="f-row"><label class="f">Pattern<select data-bind="${p}.type">${QUILT_TYPES.map(x => `<option value="${x.key}" ${x.key === L.type ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
        <label class="f">Where<select data-bind="${p}.area">${QUILT_AREAS.filter(([k]) => L.area === k || areaAvail(Q, k)).map(([k, l]) => `<option value="${k}" ${L.area === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        ${['panel', 'aroundPanel'].includes(L.area) && !Q.panels.length ? '<p class="hint warn">This quilt has no inset panel.</p>' : ''}
        ${t.noSpacing ? '' : lenField(L.type === 'spiral' ? 'Distance between turns' : 'Spacing', `${p}.spacing`, { min: 0.25, max: 24, step: L.spacing < 1 ? 0.125 : 0.25 })}
        ${['lines', 'crosshatch', 'diamonds', 'wavy', 'zigzag', 'spiral'].includes(L.type) ? `<label class="f">Angle <span class="muted">${Math.round(L.angle)}°</span><input type="range" min="0" max="180" step="5" value="${((L.angle % 180) + 180) % 180}" data-input="qAngleLive" data-change="qAngle" data-arg="${i}"></label>` : ''}
        ${t.wave ? `<div class="f-row">${lenField('Wave height', `${p}.amp`, { min: 0.1, max: 6 })}${lenField('Wave length', `${p}.wave`, { min: 0.5, max: 24 })}</div>` : ''}
        ${L.type === 'echo' ? numField('Outlines per block', `${p}.echoes`, { int: true, min: 1, max: 12 }) : ''}
        ${L.type === 'outline' ? numField('Lines per piece', `${p}.echoes`, { int: true, min: 1, max: 12 }) : ''}
        ${L.type === 'meander' ? `<div class="btn-row"><button class="btn small" data-act="qSeed" data-arg="${i}">Try another path</button></div>` : ''}
        ${L.type === 'faces' ? faceDirControls(L, p) : ''}
        ${appliquePolys(Q).length ? `<label class="check"><input type="checkbox" data-bind="${p}.skipApp" data-type="bool" ${L.skipApp !== false ? 'checked' : ''}> ${L.type === 'ditch' ? "Don't cross appliqué" : 'Go around appliqué'}</label>` : ''}
        ${L.type === 'ditch' && appliquePolys(Q).length ? `<label class="check"><input type="checkbox" data-bind="${p}.outlineApp" data-type="bool" ${L.outlineApp !== false ? 'checked' : ''}> Stitch around appliqué</label>` : ''}
        <p class="hint">${esc(t.help)} About ${Math.round(len / 36)} yd of stitching.</p>
        <div class="btn-row layer-actions"><label class="color-dot" title="Line colour on screen" style="background:${L.color}"><input type="color" value="${L.color}" data-change="qColor" data-arg="${i}" aria-label="Line colour"></label>
          <button class="icon-btn sm" data-act="qMove" data-arg="${i}|-1" ${i ? '' : 'disabled'} title="Move up" aria-label="Move up">${icon('up', 14)}</button><button class="icon-btn sm" data-act="qMove" data-arg="${i}|1" ${i < layers.length - 1 ? '' : 'disabled'} title="Move down" aria-label="Move down">${icon('down', 14)}</button>
          <span class="spacer"></span><button class="btn small quiet" data-act="qDup" data-arg="${i}">Duplicate</button><button class="btn small quiet danger" data-act="qDel" data-arg="${i}">Remove</button></div></div>`;
}
Actions.addLayerMenu = (a, el) => openMenu(el, QUILT_TYPES.map(t => ({ label: t.label, act: 'addQuiltType', arg: t.key })), { align: 'left' });
Actions.addQuiltType = type => Actions.addQuiltLayer(type, { value: '' });
Actions.qOpen = id => { ui.qOpen = ui.qOpen === id ? null : id; renderInspector(); };
Actions.qPick = id => { ui.qOpen = id; saveUi(); renderInspector(); renderHud(); };
Actions.qToggleShow = i => { const L = doc.quilting.layers[+i]; if (L) { L.visible = !L.visible; commit(); } };
// Only offer the "Where" choices this quilt has.
function areaAvail(Q, k) {
  if (['panel', 'aroundPanel'].includes(k)) return Q.panels.length > 0;
  if (k === 'blocks') return Q.cells.some(c => c.b);
  if (k === 'plain') return Q.cells.some(c => !c.b) || Q.tiles.some(t => /setting/.test(t.role || ''));
  if (k === 'sashing') return Q.patches.some(p => /^(sash|sashLong|corner)$/.test(p.role));
  return true;
}
Actions.qSeed = i => { const L = doc.quilting.layers[+i]; if (L) { L.seed = (L.seed || 1) + 1; commit(); } };
Actions.qSide = v => { ui.qSide = v === 'back' ? 'back' : 'front'; saveUi(); render(); };
// The backing settings: fabric, the width it's sold in, pieces you have, and how to make it.
function backingPanelHtml() {
  const plan = cuttingPlan(Qnow()), bk = plan.backing, bf = doc.layout.backing?.fabric;
  const mine = doc.stash.filter(x => x.backing);
  const auto = !doc.layout.backing?.method || !bk.options.some(o => o.id === doc.layout.backing.method);
  const cost = o => o.from === 'stash' ? 'nothing to buy' : `buy ${fmtYards(o.buyIn)}`;
  const w = doc.cutting.backingWidth || 42, widths = [42, 44, 60, 90, 108];
  const custom = !widths.includes(w) || ui.backWidthOther;
  return `${fabricPicker(bf, 'backingFab')}
    <div class="f-row">
      <label class="f">Backing fabric width<select data-change="backingWidthPick">${widths.map(x => `<option value="${x}" ${!custom && w === x ? 'selected' : ''}>${x}"</option>`).join('')}<option value="other" ${custom ? 'selected' : ''}>Other</option></select></label>
      ${custom ? lenField('Width', 'cutting.backingWidth', { min: 10, max: 140 }) : ''}</div>
    ${bk.options.length > 1 ? `<div class="sub-h">Make it</div>
    <label class="check opt"><input type="radio" name="bkm" data-change="backingMethod" value="auto" ${auto ? 'checked' : ''}> <span>${esc(bk.auto.title)} <span class="muted">· ${cost(bk.auto)}</span></span></label>
    ${bk.options.filter(o => o !== bk.auto).map(o => `<label class="check opt"><input type="radio" name="bkm" data-change="backingMethod" value="${o.id}" ${!auto && bk.chosen === o ? 'checked' : ''}> <span>${esc(o.title)} <span class="muted">· ${cost(o)}</span></span></label>`).join('')}`
    : `<p class="hint">${esc(bk.chosen.title)} · ${cost(bk.chosen)}</p>`}
    <div class="back-plan">${backingDiagramSvg(bk, bk.chosen, { width: 200 })}</div>
    <details class="more"><summary>Steps</summary><ol>${bk.chosen.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol></details>
    ${mine.length ? `<div class="sub-h">Pieces you have</div><div class="stash-row back-piece hdr"><span>Name</span><span>Width</span><span>Length</span><span></span></div>
    ${mine.map(p => `<div class="stash-row back-piece"><input type="text" value="${esc(p.label)}" data-change="stashLabel" data-arg="${p.id}" aria-label="Name">
      <input type="text" inputmode="decimal" value="${esc(inputLen(p.w))}" data-change="stashW" data-arg="${p.id}" aria-label="Width" title="Width">
      <input type="text" inputmode="decimal" value="${esc(inputLen(p.h))}" data-change="stashH" data-arg="${p.id}" aria-label="Length" title="Length">
      <button class="icon-btn sm" data-act="stashDel" data-arg="${p.id}" aria-label="Remove" title="Remove">${icon('x', 14)}</button></div>`).join('')}` : ''}
    <div class="btn-row"><button class="btn small quiet" data-act="backingPieceAdd">${icon('plus', 14)} Add a piece you own</button>${bf ? '<button class="btn small quiet" data-act="backingFab" data-arg="">No backing fabric</button>' : ''}</div>`;
}
Actions.backingWidthPick = v => {
  if (v === 'other') { ui.backWidthOther = true; renderInspector(); return; }
  ui.backWidthOther = false; doc.cutting.backingWidth = +v; commit();
};
Actions.backingWidth = w => { doc.cutting.backingWidth = +w; commit(); };
Actions.backingMethod = (v, el) => { if (!el.checked) return; doc.layout.backing = { ...(doc.layout.backing || {}) }; if (v === 'auto') delete doc.layout.backing.method; else doc.layout.backing.method = v; commit(); };
Actions.backingPieceAdd = () => {
  const bk = cuttingPlan(Qnow()).backing;
  doc.stash.push({ id: uid('s'), label: 'Backing piece', fabric: doc.layout.backing?.fabric || doc.layout.background, w: Math.min(42, Math.round(bk.w)), h: Math.round(bk.h * 1.5), backing: true });
  commit();
};
Actions.backingFab = id => { doc.layout.backing = { ...(doc.layout.backing || {}), fabric: id || null }; commit(); };

// Per-face line direction for dimensional quilting (orientation groups present in the tessellation).
function faceDirControls(L, p) {
  const tiles = Qnow().tiles.filter(t => t.orient != null);
  if (!tiles.length) return `<p class="hint">For tessellations only.</p>`;
  const groups = uniq(tiles.map(t => t.orient)).sort();
  const tum = doc.layout.mode === 'tess' && doc.layout.tess.shape === 'tumbling';
  const label = o => tum ? ['Top faces', 'Right faces', 'Left faces'][o] : `Shapes facing ${['one way', 'the other way', 'a third way'][o]}`;
  const opts = cur => [[0, 'Edge 1'], [1, 'Edge 2'], [-1, 'None']].map(([v, l]) => `<option value="${v}" ${(cur ?? 0) === v ? 'selected' : ''}>${l}</option>`).join('');
  return `<div class="f-row${groups.length > 2 ? ' three' : ''}">${groups.map(o => `<label class="f">${label(o)}<select data-bind="${p}.dirs.${o}" data-type="int">${opts(L.dirs?.[o])}</select></label>`).join('')}</div>
    <label class="check"><input type="checkbox" data-bind="${p}.grade" data-type="bool" ${L.grade !== false ? 'checked' : ''}> Denser lines on darker fabric</label>`;
}
Actions.addQuiltLayer = (type, el) => {
  if (!type) return;
  const L = newQuiltLayer(type);
  const palette = ['#c0392b', '#2471a3', '#1e8449', '#8e44ad', '#d35400', '#17202a'];
  L.color = palette[doc.quilting.layers.length % palette.length];
  doc.quilting.layers.push(L);
  el.value = '';
  ui.qOpen = L.id;
  commit();
  $(`[data-panel] [data-arg="${L.id}"]`)?.closest('.sec')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};
Actions.qAngleLive = (v, el) => { const L = doc.quilting.layers[+el.dataset.arg]; if (L) { L.angle = +v; renderMainOnly(); } };
Actions.qAngle = (v, el) => { const L = doc.quilting.layers[+el.dataset.arg]; if (L) { L.angle = +v; commit(); } };
Actions.qColor = (v, el) => { const L = doc.quilting.layers[+el.dataset.arg]; if (L) { L.color = v; commit(); } };
Actions.qDel = i => { doc.quilting.layers.splice(+i, 1); commit(); };
Actions.qDup = i => { const L = JSON.parse(JSON.stringify(doc.quilting.layers[+i])); L.id = uid('q'); doc.quilting.layers.splice(+i + 1, 0, L); commit(); };
Actions.qMove = arg => {
  const [i, d] = arg.split('|').map(Number), A = doc.quilting.layers;
  const j = i + d; if (j < 0 || j >= A.length) return;
  [A[i], A[j]] = [A[j], A[i]]; commit();
};

registerPanel('layers', { title: 'Layers', short: 'Layers', icon: 'layers', ws: ['quilting'], render: quiltLayersPanel });

Actions.qTool = t => { ui.qTool = t; saveUi(); renderView(); };

// drag a layer row onto another to move it there (Move up/down in Properties does the same)
let _layerDrag = null;
document.addEventListener('dragstart', e => { const r = e.target.closest?.('.part-row.layer[data-li]'); if (r) { _layerDrag = +r.dataset.li; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'layer'); } });
// the pointer's half of the row says above or below it, and the line is drawn there
const layerDropAt = (e, r) => +r.dataset.li + (e.clientY > r.getBoundingClientRect().top + r.offsetHeight / 2 ? 1 : 0);
document.addEventListener('dragover', e => {
  const r = _layerDrag != null && e.target.closest?.('.part-row.layer[data-li]'); if (!r) return;
  e.preventDefault();
  const below = layerDropAt(e, r) > +r.dataset.li;
  $$('.part-row.layer').forEach(x => { x.classList.toggle('drop-here', x === r && !below); x.classList.toggle('drop-below', x === r && below); });
});
document.addEventListener('drop', e => {
  const r = _layerDrag != null && e.target.closest?.('.part-row.layer[data-li]'); if (!r) return;
  e.preventDefault();
  const from = _layerDrag, L = doc.quilting.layers; let to = layerDropAt(e, r); _layerDrag = null;
  if (to > from) to--;
  if (from === to) return;
  const [m] = L.splice(from, 1); L.splice(to, 0, m);
  commit('Reorder quilting layers');
});
document.addEventListener('dragend', () => { _layerDrag = null; $$('.part-row.layer').forEach(x => x.classList.remove('drop-here', 'drop-below')); });
document.addEventListener('keydown', e => {
  const r = e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.target.closest?.('.part-row.layer[data-li]'); if (!r) return;
  e.preventDefault();
  const i = +r.dataset.li, j = i + (e.key === 'ArrowUp' ? -1 : 1), L = doc.quilting.layers;
  if (j < 0 || j >= L.length) return;
  [L[i], L[j]] = [L[j], L[i]]; commit('Reorder quilting layers');
  setTimeout(() => $(`.part-row.layer[data-li="${j}"] .part-pick`)?.focus(), 0);
});

Actions.goBacking = () => { Actions.view('fabric'); Actions.openPanel('backing'); };
