/* Quilting view: stack of generated quilting-line layers previewed over the quilt. */

Views.quilting = {
  main() {
    const Q = Qnow();
    const layers = doc.quilting.layers;
    const stats = quiltingStats(Q);
    const back = ui.qSide === 'back';
    const bk = back ? cuttingPlan(Q).backing : null, bf = doc.layout.backing?.fabric;
    return `<div class="stage"><div class="toolbar"><b>Quilting plan</b>
        <div class="seg" role="group" aria-label="Side"><button aria-pressed="${!back}" data-act="qSide" data-arg="front">Front</button><button aria-pressed="${back}" data-act="qSide" data-arg="back" title="The back of the quilt: backing fabric with the stitching mirrored">Back</button></div><div class="spacer"></div>
        ${back ? '' : `<button class="tool" data-act="toggleUi" data-arg="qFade" aria-pressed="${!!ui.qFade}" title="Fade the quilt so lines stand out">Fade quilt</button>`}
        <button class="tool" data-act="toggleUi" data-arg="grayscale" aria-pressed="${!!ui.grayscale}">Value</button></div>
      <div class="canvas-wrap">${back ? quiltBackSvg(Q) : quiltSvg(Q, { faded: !!ui.qFade, quilting: quiltingSvg(Q) })}</div>
      <div class="status-bar">${back ? `<b>Back of the quilt</b> — turned over, so the stitching is mirrored left to right. ${bf ? `Backing: ${esc(fabricLabel(bf))} — ` : 'No backing fabric chosen yet (pick one on the right) · '}${esc(bk.chosen.title.toLowerCase())}, ${bk.chosen.from === 'stash' ? 'nothing to buy' : `${fmtYards(bk.buyIn)} to buy`}${bk.chosen.kind !== 'piece' && (bk.panels > 1 || bk.chosen.ana?.mode === 'cut') ? ' (seams dashed)' : ''}.` : ''}${back ? '' : layers.length
        ? `About <b>${Math.round(stats.total / 36)} yd</b> of stitching · allow ~<b>${Math.ceil(stats.threadYds / 50) * 50} yd</b> of thread (top + bobbin)`
        : 'Add a quilting layer on the right to plan your stitching lines. They appear in the printed pattern before the binding step.'}</div></div>`;
  },
  inspector() {
    const layers = doc.quilting.layers;
    const Q = Qnow();
    const stats = quiltingStats(Q);
    let h = section('Add quilting', `<label class="f">Pattern<select data-change="addQuiltLayer"><option value="">Choose a pattern…</option>${QUILT_TYPES.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}</select></label>
      <p class="hint">Layers stack — e.g. stitch in the ditch first, then a crosshatch in the centre and waves in the border.</p>`, { key: 'qadd' });
    layers.forEach((L, i) => {
      const t = quiltType(L.type);
      const p = `quilting.layers.${i}`;
      const len = stats.per[i]?.length || 0;
      h += section(`${i + 1}. ${t.label}`, `
        <div class="f-row"><label class="f">Pattern<select data-bind="${p}.type">${QUILT_TYPES.map(x => `<option value="${x.key}" ${x.key === L.type ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
        <label class="f">Where<select data-bind="${p}.area">${QUILT_AREAS.filter(([k]) => Q.panels.length || L.area === k || !['panel', 'aroundPanel'].includes(k)).map(([k, l]) => `<option value="${k}" ${L.area === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        ${['panel', 'aroundPanel'].includes(L.area) && !Q.panels.length ? '<p class="hint" style="color:var(--danger)">There are no inset panels in this layout, so this layer has nothing to stitch.</p>' : ''}
        ${t.noSpacing ? '' : lenField(L.type === 'spiral' ? 'Distance between turns' : 'Spacing', `${p}.spacing`, { min: 0.25, max: 24 })}
        ${['lines', 'crosshatch', 'diamonds', 'wavy', 'zigzag', 'spiral'].includes(L.type) ? `<label class="f">Rotation <span class="muted">${Math.round(L.angle)}°</span><input type="range" min="0" max="180" step="5" value="${((L.angle % 180) + 180) % 180}" data-input="qAngleLive" data-change="qAngle" data-arg="${i}"></label>` : ''}
        ${t.wave ? `<div class="f-row">${lenField('Wave height', `${p}.amp`, { min: 0.1, max: 6 })}${lenField('Wave length', `${p}.wave`, { min: 0.5, max: 24 })}</div>` : ''}
        ${L.type === 'echo' ? numField('Outlines per block', `${p}.echoes`, { int: true, min: 1, max: 12 }) : ''}
        ${L.type === 'faces' ? faceDirControls(L, p) : ''}
        <div class="f-row" style="align-items:end"><label class="f">Preview colour<input type="color" value="${L.color}" data-change="qColor" data-arg="${i}"></label>
          <label class="check"><input type="checkbox" data-bind="${p}.visible" data-type="bool" ${L.visible ? 'checked' : ''}> Show</label></div>
        <p class="hint">${esc(t.help)} ≈ ${Math.round(len / 36)} yd of stitching.</p>
        <div class="btn-row"><button class="btn small" data-act="qMove" data-arg="${i}|-1" ${i ? '' : 'disabled'}>↑</button><button class="btn small" data-act="qMove" data-arg="${i}|1" ${i < layers.length - 1 ? '' : 'disabled'}>↓</button><button class="btn small" data-act="qDup" data-arg="${i}">Duplicate</button><button class="btn small danger" data-act="qDel" data-arg="${i}">Remove</button></div>`,
      { key: 'ql-' + L.id, right: `<span class="layer-sw" style="background:${L.color}"></span>` });
    });
    h += section('Backing', backingPanelHtml(), { key: 'backing' });
    return h;
  },
};
Actions.qSide = v => { ui.qSide = v === 'back' ? 'back' : 'front'; saveUi(); render(); };
// The backing settings: fabric, the width it's sold in, pieces you have, and how to make it.
function backingPanelHtml() {
  const bk = cuttingPlan(Qnow()).backing, bf = doc.layout.backing?.fabric;
  const mine = doc.stash.filter(x => x.backing);
  const auto = !doc.layout.backing?.method || !bk.options.some(o => o.id === doc.layout.backing.method);
  const cost = o => o.from === 'stash' ? 'nothing to buy' : `buy ${fmtYards(o.buyIn)}`;
  return `<div class="hint" style="margin-top:0">Backing fabric</div>${fabricPicker(bf, 'backingFab')}
    <div class="btn-row"><button class="btn small" data-act="backingFab" data-arg="" ${bf ? '' : 'disabled'}>None chosen</button>${ui.qSide === 'back' ? '' : '<button class="btn small" data-act="qSide" data-arg="back">See the back</button>'}</div>
    <div class="f-row">${lenField('Width it\'s sold in', 'cutting.backingWidth', { min: 10, max: 140 })}${lenField('Extra all round', 'cutting.overhang', { min: 0, max: 12 })}</div>
    <div class="btn-row">${[42, 44, 60, 90, 108].map(w => `<button class="btn small" data-act="backingWidth" data-arg="${w}" aria-pressed="${(doc.cutting.backingWidth || 42) === w}">${w}"</button>`).join('')}</div>
    <h4>Pieces I have for the backing</h4>
    ${mine.map(p => `<div class="stash-row back-piece"><input type="text" value="${esc(p.label)}" data-change="stashLabel" data-arg="${p.id}" aria-label="Name">
      <input type="text" inputmode="decimal" value="${esc(inputLen(p.w))}" data-change="stashW" data-arg="${p.id}" aria-label="Width" title="Width">
      <input type="text" inputmode="decimal" value="${esc(inputLen(p.h))}" data-change="stashH" data-arg="${p.id}" aria-label="Length" title="Length">
      <button class="btn small ghost" data-act="stashDel" data-arg="${p.id}" aria-label="Remove">✕</button></div>`).join('') || '<p class="hint" style="margin-top:0">None yet — add a piece you own (measured after trimming selvages) and it\'s used if it can make the backing.</p>'}
    <div class="btn-row"><button class="btn small" data-act="backingPieceAdd">+ Add a piece I have</button></div>
    <h4>How to make it <span class="muted" style="font-weight:400">· ${fmtSize(bk.w, bk.h)}</span></h4>
    <label class="check opt"><input type="radio" name="bkm" data-change="backingMethod" value="auto" ${auto ? 'checked' : ''}> Best option <span class="muted">(${esc(bk.auto.title.toLowerCase())})</span></label>
    ${bk.options.map(o => `<label class="check opt"><input type="radio" name="bkm" data-change="backingMethod" value="${o.id}" ${!auto && bk.chosen === o ? 'checked' : ''}> ${esc(o.title)} <span class="muted">· ${cost(o)}</span></label>`).join('')}
    <div class="back-plan">${backingDiagramSvg(bk, bk.chosen, { width: 290 })}<ol>${bk.chosen.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol></div>`;
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
  if (!tiles.length) return `<p class="hint">Use this with a tessellation (Layout → Tessellation) — it fills each shape with its own lines.</p>`;
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
  ui.showQuilting = true;
  commit();
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
