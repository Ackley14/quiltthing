/* Fabric view: shopping list, backing/batting, and "will my stash cover it?" checks.
   Cutting settings (seam allowance, WOF, rounding) live here — and only here. */

const STASH_PRESETS = [
  ['Fat quarter', 21, 18], ['Fat eighth', 10.5, 18], ['¼ yard', 42, 9], ['½ yard', 42, 18], ['1 yard', 42, 36],
  ['Charm square', 5, 5], ['Layer cake', 10, 10], ['Jelly roll strip', 42, 2.5], ['Scrap…', 12, 12],
];

Views.fabric = {
  main() {
    const Q = Qnow(), plan = cuttingPlan(Q);
    const totalBuy = sum(plan.fabrics, f => f.buyIn) + plan.backing.buyIn;
    const precutText = precutSummary(plan.fabrics);
    let h = `<div class="docview"><h2>Fabric requirements</h2>
      <p class="sub">What to buy for <b>${esc(doc.meta.title)}</b> (${fmtSize(Q.W, Q.H)}). Fabric comes as ${esc(formatLabel(defaultFormat()))} unless a fabric says otherwise; ${fmtLen(doc.cutting.seam)} seams, plus ${doc.cutting.extra}% extra on yardage.</p>
      <div class="cards">
        <div class="card"><div class="k">Finished quilt</div><div class="v">${fmtSize(Q.W, Q.H)}</div></div>
        <div class="card"><div class="k">Fabric to buy</div><div class="v">${fmtYards(totalBuy)} <small>incl. backing${precutText ? ` · + ${esc(precutText)}` : ''}</small></div></div>
        <div class="card"><div class="k">Pieces to cut</div><div class="v">${plan.totalPieces}</div></div>
        <div class="card"><div class="k">Fabrics</div><div class="v">${plan.fabrics.length}</div></div>
      </div>`;
    if (!plan.fabrics.length) return h + `<div class="callout">Nothing to cut yet — place some blocks or shapes in the <a href="#" data-act="view" data-arg="layout">Layout</a>.</div></div>`;
    for (const w of [...Q.warnings, ...plan.problems]) h += `<div class="callout bad" style="margin-bottom:10px">${esc(w)}</div>`;
    h += `<table class="t"><thead><tr><th>Fabric</th><th>Used for</th><th class="num">Pieces</th><th class="num">Needed</th><th class="num">Buy</th><th>Your stash</th></tr></thead><tbody>`;
    for (const f of plan.fabrics) {
      let stash = `<button class="btn small ghost" data-act="stashMenu" data-arg="${f.fab}" title="Add a piece of this fabric you already have">+ Add</button>`;
      if (hasStashFor(f.fab)) {
        const used = (f.layouts || []).filter(x => x.stash), unused = used.filter(x => !x.used).length;
        stash = (fabricById(f.fab).skipStash ? '<span class="pill">stash not used</span>'
          : `<span class="pill ok" title="${sum(used, x => x.pieces)} of ${f.pieces} pieces are cut from your stash">uses ${esc(stashUseText(f) || 'none of it')}</span>${unused ? ` <span class="muted">(${unused} not needed)</span>` : ''}`) + ' ' + stash;
      }
      h += `<tr><td><div class="fabcell">${swatchHtml(f.fab, 26)}<div><b>${fabricLetter(f.fab)}</b> · ${esc(fabricLabel(f.fab))}${fabricById(f.fab).directional ? ' <span class="pill">directional</span>' : ''}</div></div></td>
        <td class="muted">${esc(f.sources.join(', '))}</td><td class="num">${f.pieces}</td><td class="num">${neededText(f)}</td>
        <td class="num"><b>${buyText(f)}</b>${!f.format.yardage || f.format.width !== defaultFormat().width ? `<br><span class="muted">${esc(formatLabel(f.format))}</span>` : ''}${(() => { const o = f.stashOwned ? [] : formatOptions(f); return o.length ? `<br><span class="muted">or ${o.map(x => `<a href="#" data-act="useFormat" data-arg="${f.fab}|${x.key}">${esc(x.label)}</a>`).join(' · ')}</span>` : ''; })()}${f.fq && !f.stashOwned ? '<br><span class="pill info" title="Everything for this fabric fits in an 18 × 21 in fat quarter">fits a fat quarter</span>' : ''}</td><td>${stash}</td></tr>`;
    }
    const bk = plan.backing;
    const bf = doc.layout.backing?.fabric;
    h += `<tr><td><div class="fabcell">${bf ? swatchHtml(bf, 26) : '<span class="sw" style="--sw:26px;background:repeating-linear-gradient(135deg,#eee,#eee 4px,#ddd 4px,#ddd 8px)"></span>'}<div><b>Backing</b>${bf ? ` · ${esc(fabricLabel(bf))}` : ' <span class="muted">(choose in Quilting)</span>'}</div></div></td>
      <td class="muted">${fmtSize(bk.w, bk.h)} · ${esc(bk.chosen.title.toLowerCase())}</td><td class="num">${bk.panels}</td><td class="num">${bk.chosen.from === 'stash' ? '—' : fmtYards(bk.len)}</td><td class="num"><b>${bk.chosen.from === 'stash' ? 'nothing (stash)' : fmtYards(bk.buyIn)}</b>${bk.chosen.from === 'stash' ? '' : `<br><span class="muted">${fmtLen(bk.fabricWidth)} wide</span>`}</td><td><a href="#" data-act="view" data-arg="quilting">options…</a></td></tr>
      <tr><td><div class="fabcell"><span class="sw" style="--sw:26px;background:#fbf8f0"></span><b>Batting</b></div></td><td class="muted">${fmtSize(plan.batting.w, plan.batting.h)}</td><td></td><td></td><td></td><td></td></tr>`;
    h += `</tbody></table>`;

    if (doc.stash.length) h += `<p class="hint" style="margin-top:14px">Your stash is cut first: the <b>Buy</b> column is what's still needed after it, and the <a href="#" data-act="view" data-arg="cutting">Cutting</a> view shows a map for each stash piece. Untick "Cut from my stash first" on a fabric in Cutting to compare.</p>`;
    return h + '</div>';
  },
  inspector() {
    const c = doc.cutting;
    let h = section('Cutting settings', `
      ${lenField('Seam allowance', 'cutting.seam', { min: 0, max: 1 })}
      <div class="btn-row"><button class="btn small" data-act="setSeam" data-arg="0.25">¼"</button><button class="btn small" data-act="setSeam" data-arg="0.375">⅜"</button><button class="btn small" data-act="setSeam" data-arg="0.5">½"</button><button class="btn small" data-act="setSeam" data-arg="0.3937">1 cm</button></div>
      <label class="f">Fabric comes as (default)<select data-change="defaultFormat">${formatOptionsHtml(doc.cutting.defaultFormat?.kind === 'yardage' ? null : doc.cutting.defaultFormat, false).replace('value="yardage"', `value="yardage" ${!doc.cutting.defaultFormat || doc.cutting.defaultFormat.kind === 'yardage' ? 'selected' : ''}`)}</select></label>
      ${lenField('Usable width of yardage (WOF)', 'cutting.wof', { min: 10, max: 140 })}
      <p class="hint" style="margin-top:2px">Change how a single fabric comes (another width, fat quarters…) in its settings in the Fabrics panel on the left.</p>
      <p class="hint">Quilting cotton is 42–44" wide; about 40–42" is usable after trimming selvages.</p>
      <div class="f-row">${numField('Extra %', 'cutting.extra', { min: 0, max: 50 })}
      ${selectField('Round up to', 'cutting.roundTo', [['eighth', '⅛ yard'], ['quarter', '¼ yard'], ['half', '½ yard'], ['none', "Don't round"]])}</div>
      ${selectField('Appliqué method', 'cutting.appMethod', [['turned', 'Turned edge (3/16" turn-under)'], ['fusible', 'Fusible web (reversed templates)']])}`, { key: 'cutset' });
    h += section('Backing & batting', backingPanelHtml(), { key: 'backing' });
    let rows = doc.stash.filter(s => !s.backing).map(s => `<div class="list-item"><div class="stash-row">
        <input type="text" value="${esc(s.label)}" data-change="stashLabel" data-arg="${s.id}" aria-label="Name">
        <input type="text" inputmode="decimal" value="${esc(inputLen(s.w))}" data-change="stashW" data-arg="${s.id}" aria-label="Width" title="Width">
        <input type="text" inputmode="decimal" value="${esc(inputLen(s.h))}" data-change="stashH" data-arg="${s.id}" aria-label="Height" title="Height">
        <button class="btn small ghost" data-act="stashDel" data-arg="${s.id}" aria-label="Remove">✕</button>
        <div class="sel-fab">${swatchHtml(s.fabric, 18)}<select data-change="stashFab" data-arg="${s.id}" style="flex:1">${doc.fabrics.map(f => `<option value="${f.id}" ${f.id === s.fabric ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div></div></div>`).join('');
    const sf = stashFabric();
    h += section('My stash', `<p class="hint" style="margin-top:0">Fabric you already have. It's cut first (in this order), and you only buy what's still needed.</p>
      ${rows}<label class="f">Add a piece of<div class="sel-fab">${swatchHtml(sf, 18)}<select data-change="stashFabPick" style="flex:1">${doc.fabrics.map(f => `<option value="${f.id}" ${f.id === sf ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div></label>
      <div class="btn-row">${STASH_PRESETS.map(([l, w, hh]) => `<button class="btn small" data-act="stashAdd" data-arg="${l}|${w}|${hh}|${sf}">+ ${l}</button>`).join('')}</div>`, { key: 'stash' });
    return h;
  },
};
Actions.defaultFormat = v => { const fm = formatFromChoice(v, doc.cutting.defaultFormat); doc.cutting.defaultFormat = fm && fm.kind !== 'yardage' ? fm : { kind: 'yardage' }; commit(); };
Actions.useFormat = (arg, el, e) => { e?.preventDefault?.(); const [fab, key] = arg.split('|'); const fb = doc.fabrics.find(x => x.id === fab); if (fb) { fb.format = { kind: 'precut', key }; commit(); toast(`${fabricLabel(fab)} now comes as ${PRECUTS.find(x => x.key === key).name.toLowerCase()}s`); } };
Actions.setSeam = v => { doc.cutting.seam = +v; commit(); };
// The fabric new stash pieces are for: the one picked in the stash panel, else the first fabric the quilt uses.
function stashFabric() {
  if (doc.fabrics.some(f => f.id === ui.stashFab)) return ui.stashFab;
  return cuttingPlan(Qnow()).fabrics[0]?.fab || doc.fabrics[0].id;
}
Actions.stashFabPick = v => { ui.stashFab = v; saveUi(); renderInspector(); };
Actions.stashMenu = (fab, el) => openMenu(el, STASH_PRESETS.map(([l, w, h]) => ({ label: `${l} (${fmtSize(w, h)})`, act: 'stashAdd', arg: `${l}|${w}|${h}|${fab}` })));
Actions.stashAdd = arg => {
  const [label, w, h, forFab] = arg.split('|');
  const fab = doc.fabrics.some(f => f.id === forFab) ? forFab : stashFabric();
  ui.stashFab = fab;
  doc.stash.push({ id: uid('s'), label: label.replace('…', ''), fabric: fab, w: +w, h: +h });
  commit();
};
Actions.stashDel = id => { doc.stash = doc.stash.filter(s => s.id !== id); commit(); };
Actions.stashLabel = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg); if (s) { s.label = v; commit(); } };
Actions.stashFab = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg); if (s) { s.fabric = v; commit(); } };
Actions.stashW = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg), n = parseLen(v); if (s && n > 0) { s.w = n; commit(); } else render(); };
Actions.stashH = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg), n = parseLen(v); if (s && n > 0) { s.h = n; commit(); } else render(); };
