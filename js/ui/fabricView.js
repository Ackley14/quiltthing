/* Fabric & cutting: what to buy (with your stash, backing and batting) and the cutting plan,
   one step with two panes. The default fabric and seam settings open from here or from Edit. */

const STASH_PRESETS = [
  ['Fat quarter', 21, 18], ['Fat eighth', 21, 9], ['¼ yard', 42, 9], ['½ yard', 42, 18], ['1 yard', 42, 36],
  ['Charm square', 5, 5], ['Layer cake', 10, 10], ['Jelly roll strip', 42, 2.5], ['Scrap', 12, 12],
];

// The fabric every colour starts from: how it's bought, its usable width, and the yardage margin.
function fabricDefaultsHtml() {
  const c = doc.cutting;
  return `<label class="f">Bought as<select data-change="defaultFormat">${formatOptionsHtml(c.defaultFormat?.kind === 'yardage' ? null : c.defaultFormat, false).replace('value="yardage"', `value="yardage" ${!c.defaultFormat || c.defaultFormat.kind === 'yardage' ? 'selected' : ''}`)}</select></label>
    ${lenField('Usable width (WOF)', 'cutting.wof', { min: 10, max: 140 })}
    <div class="f-row">${numField('Extra %', 'cutting.extra', { min: 0, max: 50 })}
    ${selectField('Round up to', 'cutting.roundTo', [['eighth', '⅛ yard'], ['quarter', '¼ yard'], ['half', '½ yard'], ['none', "Don't round"]])}</div>
    <p class="hint">Quilting cotton is usually 40–42" wide after trimming the selvages.</p>`;
}
// How pieces are sewn and cut: seam allowance, appliqué method, backing margin, edge pieces.
function seamSettingsHtml() {
  return `${lenField('Seam allowance', 'cutting.seam', { min: 0, max: 1 })}
    <div class="btn-row"><button class="btn small" data-act="setSeam" data-arg="0.25">¼"</button><button class="btn small" data-act="setSeam" data-arg="0.375">⅜"</button><button class="btn small" data-act="setSeam" data-arg="0.5">½"</button><button class="btn small" data-act="setSeam" data-arg="0.3937">1 cm</button></div>
    ${selectField('Appliqué', 'cutting.appMethod', [['turned', 'Turned edge, 3/16"'], ['fusible', 'Fusible web']])}
    ${lenField('Backing extra all round', 'cutting.overhang', { min: 0, max: 12 })}
    ${doc.layout.mode === 'tess' && doc.layout.tess.edge === 'trim' ? `<label class="check"><input type="checkbox" data-bind="layout.tess.cutEdges" data-type="bool" ${doc.layout.tess.cutEdges ? 'checked' : ''}> Cut edge pieces to shape</label>` : ''}
    ${doc.layout.mode !== 'tess' && Qnow().cells.some(cl => cl.b && cl.clip) ? partialToggle() : ''}`;
}

Views.fabric = {
  tools() { return { act: 'docTool', active: ui.docTool || 'pointer', list: [{ key: 'pointer', label: 'Select', kb: 'S', icon: 'pointer' }, { key: 'hand', label: 'Hand', kb: 'H', icon: 'hand' }, { key: 'zoom', label: 'Zoom', kb: 'Z', icon: 'zoomin' }] }; },
  docs() { const cut = ui.fabPane === 'cut'; return [{ label: 'Shopping list', on: !cut, act: 'fabPane', arg: 'shop', icon: 'list' }, { label: 'Cutting plan', on: cut, act: 'fabPane', arg: 'cut', icon: 'cut' }]; },
  docTools() { return ui.fabPane === 'cut' ? `<button class="tool toggle small" data-act="toggleCutMaps" aria-pressed="${ui.cutDiagrams !== false}">Cutting maps</button>` : ''; },
  options() {
    const Q = Qnow(), plan = cuttingPlan(Q), pre = precutSummary(plan.fabrics);
    return `<span class="tb-label">${fmtSize(Q.W, Q.H)} · buy <b>${fmtYards(sum(plan.fabrics, f => f.buyIn) + plan.backing.buyIn)}</b>${pre ? ` + ${esc(pre)}` : ''} · ${plural(plan.totalPieces, 'piece')}</span>
`;
  },
  main() {
    const Q = Qnow(), plan = cuttingPlan(Q);
    const cut = ui.fabPane === 'cut';
    const totalBuy = sum(plan.fabrics, f => f.buyIn) + plan.backing.buyIn;
    const precutText = precutSummary(plan.fabrics);
    let h = `<div class="docview wide">
`;
    if (!plan.fabrics.length) return h + `<div class="empty-state"><p>Nothing to cut yet. Place some blocks in the layout first.</p><button class="btn" data-act="view" data-arg="layout">Go to Layout</button></div></div>`;
    for (const w of [...Q.warnings, ...seamWarnings(), ...plan.problems]) h += `<div class="callout bad" style="margin-bottom:10px">${esc(w)}</div>`;
    return h + (cut ? cuttingPlanHtml(plan) : shoppingListHtml(plan)) + '</div>';
  },
  afterMain(el) { if (ui.fabPane === 'cut') cuttingAfterMain(el); applyDocZoom(el); },
  // Properties in Fabric & cutting: how fabric is bought and how pieces are sewn (the two
  // settings dialogs, always at hand here); Stash and Backing are panels of their own.
  props() {
    return `${section('Default fabric', fabricDefaultsHtml(), { key: 'fabdefaults' })}${section('Seams and appliqué', seamSettingsHtml(), { key: 'sewing' })}`;
  },
  inspector() { return Views.fabric.props(); },
};
function stashPanel() {
  const rows = doc.stash.filter(s => !s.backing).map(s => `<div class="list-item"><div class="stash-row">
      <input type="text" value="${esc(s.label)}" data-change="stashLabel" data-arg="${s.id}" aria-label="Name">
      <input type="text" inputmode="decimal" value="${esc(inputLen(s.w))}" data-change="stashW" data-arg="${s.id}" aria-label="Width" title="Width">
      <input type="text" inputmode="decimal" value="${esc(inputLen(s.h))}" data-change="stashH" data-arg="${s.id}" aria-label="Length" title="Length">
      <button class="icon-btn sm" data-act="stashDel" data-arg="${s.id}" aria-label="Remove" title="Remove">${icon('x', 14)}</button>
      <div class="sel-fab">${swatchHtml(s.fabric, 18)}<select data-change="stashFab" data-arg="${s.id}" style="flex:1" aria-label="Fabric">${doc.fabrics.map(f => `<option value="${f.id}" ${f.id === s.fabric ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div></div></div>`).join('');
  const n = doc.stash.filter(s => !s.backing).length;
  return `<div class="panel-tools"><span class="pt-note">${n ? plural(n, 'piece') : 'Nothing yet'}</span><span class="grow"></span><button class="btn small" data-act="stashMenu" data-arg="${stashFabric()}">${icon('plus', 14)} Add a piece</button></div>
    <div class="pad"><p class="hint">Fabric you already have. It's cut first, so you only buy the rest.</p>
    ${rows ? `<div class="stash-row hdr"><span>Name</span><span>Width</span><span>Length</span><span></span></div>${rows}` : ''}</div>`;
}
registerPanel('stash', { title: 'Stash', short: 'Stash', icon: 'stash', ws: ['fabric'], render: stashPanel });
registerPanel('backing', { title: 'Backing', short: 'Backing', icon: 'layers', ws: ['fabric'], render: () => `<div class="pad">${backingPanelHtml()}</div>` });
Actions.fabPane = v => { ui.fabPane = v === 'cut' ? 'cut' : 'shop'; saveUi(); render(); };

function shoppingListHtml(plan) {
  let h = `<table class="t"><thead><tr><th>Fabric</th><th>Used for</th><th class="num">Pieces</th><th class="num">Needed</th><th class="num">Buy</th><th>Stash</th><th></th></tr></thead><tbody>`;
  for (const f of plan.fabrics) {
    let stash = `<button class="btn small quiet" data-act="stashMenu" data-arg="${f.fab}" title="Add a piece of this fabric you already have">${icon('plus', 14)} Add</button>`;
    if (hasStashFor(f.fab)) {
      const used = (f.layouts || []).filter(x => x.stash), unused = used.filter(x => !x.used).length;
      stash = (fabricById(f.fab).skipStash ? '<span class="muted">not used</span>'
        : `<span title="${sum(used, x => x.pieces)} of ${f.pieces} pieces come from your stash">${esc(stashUseText(f) || 'none of it')}</span>${unused ? ` <span class="muted">(${unused} spare)</span>` : ''}`) + ' ' + stash;
    }
    const fb = fallbackInfo(f);
    const fmt = fb ? '' : !f.format.yardage || f.format.width !== defaultFormat().width ? `<br><span class="muted">${esc(formatLabel(f.format))}</span>` : '';
    h += `<tr><td><div class="fabcell">${swatchHtml(f.fab, 26)}<div><b>${fabricLetter(f.fab)}</b> ${esc(fabricLabel(f.fab))}${fabricById(f.fab).directional ? ' <span class="pill">directional</span>' : ''}</div></div></td>
      <td class="used">${esc(f.sources.join(', '))}</td><td class="num">${f.pieces}</td><td class="num">${neededText(f)}</td>
      <td class="num">${fb ? buySplitHtml(f, fb) : `<b>${buyText(f)}</b>`}${fmt}</td><td>${stash}</td>
      <td><button class="icon-btn sm" data-act="fabRowMenu" data-arg="${f.fab}" aria-haspopup="menu" aria-label="More for ${esc(fabricLabel(f.fab))}">${icon('more')}</button></td></tr>`;
  }
  const bk = plan.backing, bf = doc.layout.backing?.fabric;
  const bt = battingBuy(plan.batting.w, plan.batting.h);
  h += `<tr><td><div class="fabcell">${bf ? swatchHtml(bf, 26) : '<span class="sw" style="--sw:26px;background:repeating-linear-gradient(135deg,#eee,#eee 4px,#ddd 4px,#ddd 8px)"></span>'}<div><b>Backing</b>${bf ? ` ${esc(fabricLabel(bf))}` : ''}</div></div></td>
      <td class="used">${fmtSize(bk.w, bk.h)} · ${esc(bk.chosen.title.toLowerCase())}</td><td class="num">${bk.panels}</td><td class="num">${bk.chosen.from === 'stash' ? '—' : fmtYards(bk.len)}</td><td class="num"><b>${bk.chosen.from === 'stash' ? 'nothing' : fmtYards(bk.buyIn)}</b>${bk.chosen.from === 'stash' ? '<br><span class="muted">from your stash</span>' : `<br><span class="muted">${fmtLen(bk.fabricWidth)} wide</span>`}</td><td></td><td></td></tr>
    <tr><td><div class="fabcell"><span class="sw" style="--sw:26px;background:#f7f5ef"></span><b>Batting</b></div></td><td class="used">${fmtSize(plan.batting.w, plan.batting.h)}</td><td></td><td></td><td class="num">${esc(bt.pack ? bt.pack.replace(/^a /, '').replace(/ \(.*\)$/, '') : bt.byYard)}</td><td></td><td></td></tr>`;
  return h + `</tbody></table>`;
}
// Row menu: other ways to buy this fabric, and its settings.
// A precut fabric that also needs yardage: the precuts, then the yardage and why.
function buySplitHtml(f, fb) {
  if (fb.none) return `<span class="fallback" title="${esc(fallbackReason(fb, true))}"><b>${fmtYards(f.buyIn)}</b></span><br><span class="muted small">${esc(fallbackReason(fb, false))}</span>`;
  return `<b>${plural2(f.buyPieces, f.format.name)}</b><br><span class="fallback" title="${esc(fallbackReason(fb, true))}"><b>+ ${fmtYards(f.buyIn)}</b> yardage</span><br><span class="muted small">${esc(fallbackReason(fb, false))}</span>`;
}
// Other ways to buy a fabric, and its settings (the row's ⋯ button and right-click).
function fabRowItems(fab) {
  const f = cuttingPlan(Qnow()).fabrics.find(x => x.fab === fab);
  const fb = fabricById(fab);
  const opts = f && !f.stashOwned ? formatOptions(f) : [];
  return [
    { header: esc(fabricLabel(fab)) },
    ...opts.map(o => ({ label: `Buy as ${o.label}`, act: 'useFormat', arg: `${fab}|${o.key}` })),
    ...(fb.format ? [{ label: 'Buy as yardage', act: 'useFormat', arg: `${fab}|` }] : []),
    ...(opts.length || fb.format ? ['-'] : []),
    { label: 'Add a stash piece…', act: 'stashMenuAt', arg: fab },
    { label: 'Fabric settings…', act: 'fabricPopover', arg: fab },
  ];
}
Actions.fabRowMenu = (fab, el) => openMenu(el, fabRowItems(fab));
Actions.stashMenuAt = fab => { ui.stashFab = fab; Actions.stashPicker(); };
Actions.defaultFormat = v => { const fm = formatFromChoice(v, doc.cutting.defaultFormat); doc.cutting.defaultFormat = fm && fm.kind !== 'yardage' ? fm : { kind: 'yardage' }; commit(); };
Actions.useFormat = (arg, el, e) => {
  e?.preventDefault?.();
  const [fab, key] = arg.split('|'), fb = doc.fabrics.find(x => x.id === fab);
  if (!fb) return;
  if (key) fb.format = { kind: 'precut', key }; else delete fb.format;
  commit();
  toast(key ? `${fabricLabel(fab)}: ${PRECUTS.find(x => x.key === key).name.toLowerCase()}s` : `${fabricLabel(fab)}: yardage`);
};
Actions.setSeam = v => { doc.cutting.seam = +v; commit(); };
// The fabric new stash pieces are for: the one picked last, else the first fabric the quilt uses.
function stashFabric() {
  if (doc.fabrics.some(f => f.id === ui.stashFab)) return ui.stashFab;
  return cuttingPlan(Qnow()).fabrics[0]?.fab || doc.fabrics[0].id;
}
Actions.stashMenu = (fab, el) => openMenu(el, STASH_PRESETS.map(([l, w, h]) => ({ label: `${l} of ${esc(fabricLabel(fab))} <span class="kb">${fmtSize(w, h)}</span>`, act: 'stashAdd', arg: `${l}|${w}|${h}|${fab}` })));
Actions.stashAdd = arg => {
  const [label, w, h, forFab] = arg.split('|');
  const fab = doc.fabrics.some(f => f.id === forFab) ? forFab : stashFabric();
  ui.stashFab = fab;
  doc.stash.push({ id: uid('s'), label, fabric: fab, w: +w, h: +h });
  ui.collapsed.stash = false;
  commit();
};
Actions.stashDel = id => { doc.stash = doc.stash.filter(s => s.id !== id); commit(); };
Actions.stashLabel = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg); if (s) { s.label = v; commit(); } };
Actions.stashFab = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg); if (s) { s.fabric = v; ui.stashFab = v; commit(); } };
Actions.stashW = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg), n = parseLen(v); if (s && n > 0) { s.w = n; commit(); } else render(); };
Actions.stashH = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg), n = parseLen(v); if (s && n > 0) { s.h = n; commit(); } else render(); };
