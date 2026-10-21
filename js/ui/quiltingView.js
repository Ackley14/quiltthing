/* Quilting view: stack of generated quilting-line layers previewed over the quilt. */

Views.quilting = {
  main() {
    const Q = Qnow();
    const layers = doc.quilting.layers;
    const stats = quiltingStats(Q);
    const back = ui.qSide === 'back';
    const bk = back ? cuttingPlan(Q).backing : null, bf = doc.layout.backing?.fabric;
    return `<div class="stage"><div class="toolbar">
        <div class="seg" role="group" aria-label="Side"><button aria-pressed="${!back}" data-act="qSide" data-arg="front">Front</button><button aria-pressed="${back}" data-act="qSide" data-arg="back">Back</button></div><div class="spacer"></div>
        ${back ? '' : `<button class="tool" data-act="toggleUi" data-arg="qFade" aria-pressed="${!!ui.qFade}">Fade quilt</button>`}
        <button class="tool" data-act="toggleUi" data-arg="grayscale" aria-pressed="${!!ui.grayscale}" title="Value view (G)">Value</button></div>
      <div class="canvas-wrap">${back ? quiltBackSvg(Q) : quiltSvg(Q, { faded: !!ui.qFade, quilting: quiltingSvg(Q) })}</div>
      <div class="status-bar">${back ? `Back of the quilt, stitching mirrored. ${bf ? esc(fabricLabel(bf)) : 'No backing fabric chosen'} · ${esc(bk.chosen.title.toLowerCase())}. <a href="#" data-act="view" data-arg="fabric">Backing settings</a>` : layers.length
        ? `About <b>${Math.round(stats.total / 36)} yd</b> of stitching · <b>${Math.ceil(stats.threadYds / 50) * 50} yd</b> of thread, top and bobbin`
        : 'Add a quilting pattern on the right.'}</div></div>`;
  },
  inspector() {
    const layers = doc.quilting.layers;
    const Q = Qnow();
    const stats = quiltingStats(Q);
    const open = layers.find(L => L.id === ui.qOpen) ? ui.qOpen : null;
    let h = `<section class="sec add-q"><label class="f">Add quilting<select data-change="addQuiltLayer"><option value="">Choose a pattern…</option>${QUILT_TYPES.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}</select></label></section>`;
    layers.forEach((L, i) => {
      const t = quiltType(L.type);
      const p = `quilting.layers.${i}`;
      const len = stats.per[i]?.length || 0;
      const where = (QUILT_AREAS.find(([k]) => k === L.area) || [null, ''])[1];
      const head = `<div class="layer-row"><span class="layer-sw" style="background:${L.color}"></span><span class="nm"><b>${t.label}</b> <span class="muted">${esc(where.toLowerCase())}</span></span>
        <button class="icon-btn sm" data-act="qToggleShow" data-arg="${i}" title="${L.visible ? 'Hide' : 'Show'}" aria-label="${L.visible ? 'Hide' : 'Show'} ${t.label}">${icon(L.visible ? 'eye' : 'x', 14)}</button></div>`;
      if (L.id !== open) { h += `<section class="sec layer closed"><div class="sec-h" data-act="qOpen" data-arg="${L.id}" role="button" aria-expanded="false">${head}</div></section>`; return; }
      h += `<section class="sec layer"><div class="sec-h" data-act="qOpen" data-arg="${L.id}" role="button" aria-expanded="true">${head}</div><div class="sec-b">
        <div class="f-row"><label class="f">Pattern<select data-bind="${p}.type">${QUILT_TYPES.map(x => `<option value="${x.key}" ${x.key === L.type ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
        <label class="f">Where<select data-bind="${p}.area">${QUILT_AREAS.filter(([k]) => L.area === k || areaAvail(Q, k)).map(([k, l]) => `<option value="${k}" ${L.area === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        ${['panel', 'aroundPanel'].includes(L.area) && !Q.panels.length ? '<p class="hint warn">This quilt has no inset panel.</p>' : ''}
        ${t.noSpacing ? '' : lenField(L.type === 'spiral' ? 'Distance between turns' : 'Spacing', `${p}.spacing`, { min: 0.25, max: 24 })}
        ${['lines', 'crosshatch', 'diamonds', 'wavy', 'zigzag', 'spiral'].includes(L.type) ? `<label class="f">Angle <span class="muted">${Math.round(L.angle)}°</span><input type="range" min="0" max="180" step="5" value="${((L.angle % 180) + 180) % 180}" data-input="qAngleLive" data-change="qAngle" data-arg="${i}"></label>` : ''}
        ${t.wave ? `<div class="f-row">${lenField('Wave height', `${p}.amp`, { min: 0.1, max: 6 })}${lenField('Wave length', `${p}.wave`, { min: 0.5, max: 24 })}</div>` : ''}
        ${L.type === 'echo' ? numField('Outlines per block', `${p}.echoes`, { int: true, min: 1, max: 12 }) : ''}
        ${L.type === 'outline' ? numField('Lines per piece', `${p}.echoes`, { int: true, min: 1, max: 12 }) : ''}
        ${L.type === 'meander' ? `<div class="btn-row"><button class="btn small" data-act="qSeed" data-arg="${i}">Try another path</button></div>` : ''}
        ${L.type === 'faces' ? faceDirControls(L, p) : ''}
        ${L.type !== 'ditch' && appliquePolys(Q).length ? `<label class="check"><input type="checkbox" data-bind="${p}.skipApp" data-type="bool" ${L.skipApp !== false ? 'checked' : ''}> Go around appliqué</label>` : ''}
        <p class="hint">${esc(t.help)} About ${Math.round(len / 36)} yd of stitching.</p>
        <div class="btn-row layer-actions"><input type="color" value="${L.color}" data-change="qColor" data-arg="${i}" aria-label="Line colour" title="Line colour on screen">
          <button class="icon-btn sm" data-act="qMove" data-arg="${i}|-1" ${i ? '' : 'disabled'} title="Move up" aria-label="Move up">${icon('up', 14)}</button><button class="icon-btn sm" data-act="qMove" data-arg="${i}|1" ${i < layers.length - 1 ? '' : 'disabled'} title="Move down" aria-label="Move down">${icon('down', 14)}</button>
          <span class="spacer"></span><button class="btn small quiet" data-act="qDup" data-arg="${i}">Duplicate</button><button class="btn small quiet danger" data-act="qDel" data-arg="${i}">Remove</button></div></div></section>`;
    });
    if (layers.length > 1) h += `<p class="hint" style="padding:8px 16px 0">Stitch from the top of the list down.</p>`;
    return h + nextStep('fabric', 'Fabric & cutting');
  },
};
Actions.qOpen = id => { ui.qOpen = ui.qOpen === id ? null : id; renderInspector(); };
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
  return `<label class="f">Backing fabric</label>${fabricPicker(bf, 'backingFab')}
    ${bf ? '<div class="btn-row"><button class="btn small quiet" data-act="backingFab" data-arg="">Clear backing fabric</button></div>' : ''}
    <div class="f-row">${lenField('Fabric width', 'cutting.backingWidth', { min: 10, max: 140 })}${lenField('Extra all round', 'cutting.overhang', { min: 0, max: 12 })}</div>
    <div class="btn-row">${[42, 44, 60, 90, 108].map(w => `<button class="btn small" data-act="backingWidth" data-arg="${w}" aria-pressed="${(doc.cutting.backingWidth || 42) === w}">${w}"</button>`).join('')}</div>
    <div class="sub-h">Pieces you have</div>
    ${mine.length ? `<div class="stash-row back-piece hdr"><span>Name</span><span>Width</span><span>Length</span><span></span></div>` : ''}
    ${mine.map(p => `<div class="stash-row back-piece"><input type="text" value="${esc(p.label)}" data-change="stashLabel" data-arg="${p.id}" aria-label="Name">
      <input type="text" inputmode="decimal" value="${esc(inputLen(p.w))}" data-change="stashW" data-arg="${p.id}" aria-label="Width" title="Width">
      <input type="text" inputmode="decimal" value="${esc(inputLen(p.h))}" data-change="stashH" data-arg="${p.id}" aria-label="Length" title="Length">
      <button class="icon-btn sm" data-act="stashDel" data-arg="${p.id}" aria-label="Remove" title="Remove">${icon('x', 14)}</button></div>`).join('')}
    <div class="btn-row"><button class="btn small" data-act="backingPieceAdd">${icon('plus', 14)} Add a piece</button></div>
    <div class="sub-h">How to make it <span class="muted" style="font-weight:400">· ${fmtSize(bk.w, bk.h)}</span></div>
    <label class="check opt"><input type="radio" name="bkm" data-change="backingMethod" value="auto" ${auto ? 'checked' : ''}> ${esc(bk.auto.title)} <span class="muted">· ${cost(bk.auto)} · recommended</span></label>
    ${bk.options.filter(o => o !== bk.auto).map(o => `<label class="check opt"><input type="radio" name="bkm" data-change="backingMethod" value="${o.id}" ${!auto && bk.chosen === o ? 'checked' : ''}> ${esc(o.title)} <span class="muted">· ${cost(o)}</span></label>`).join('')}
    <div class="back-plan">${backingDiagramSvg(bk, bk.chosen, { width: 270 })}<ol>${bk.chosen.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>
    <p class="hint">Batting: at least ${fmtSize(plan.batting.w, plan.batting.h)}.</p>`;
}
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
  ui.showQuilting = true; ui.qOpen = L.id;
  commit();
  $(`#inspector [data-arg="${L.id}"]`)?.closest('.sec')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
