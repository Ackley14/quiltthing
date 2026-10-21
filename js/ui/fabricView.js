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
    let h = `<div class="docview"><h2>Fabric requirements</h2>
      <p class="sub">What to buy for <b>${esc(doc.meta.title)}</b> (${fmtSize(Q.W, Q.H)}). Yardage assumes ${fmtLen(doc.cutting.wof)} usable width, ${fmtLen(doc.cutting.seam)} seams, plus ${doc.cutting.extra}% extra.</p>
      <div class="cards">
        <div class="card"><div class="k">Finished quilt</div><div class="v">${fmtSize(Q.W, Q.H)}</div></div>
        <div class="card"><div class="k">Fabric to buy</div><div class="v">${fmtYards(totalBuy)} <small>incl. backing</small></div></div>
        <div class="card"><div class="k">Pieces to cut</div><div class="v">${plan.totalPieces}</div></div>
        <div class="card"><div class="k">Fabrics</div><div class="v">${plan.fabrics.length}</div></div>
      </div>`;
    if (!plan.fabrics.length) return h + `<div class="callout">Nothing to cut yet — place some blocks or shapes in the <a href="#" data-act="view" data-arg="layout">Layout</a>.</div></div>`;
    for (const w of [...Q.warnings, ...plan.problems]) h += `<div class="callout bad" style="margin-bottom:10px">${esc(w)}</div>`;
    h += `<table class="t"><thead><tr><th>Fabric</th><th>Used for</th><th class="num">Pieces</th><th class="num">Needed</th><th class="num">Buy</th><th>Your stash</th></tr></thead><tbody>`;
    for (const f of plan.fabrics) {
      const owned = doc.stash.filter(s => s.fabric === f.fab);
      let stash = '<span class="muted">—</span>';
      if (owned.length) {
        const fit = fitsInPieces(f, owned);
        stash = fit.ok ? `<span class="pill ok">✓ covered</span>` : `<span class="pill bad">${fit.short} of ${fit.total} cuts won't fit</span>`;
      }
      h += `<tr><td><div class="fabcell">${swatchHtml(f.fab, 26)}<div><b>${fabricLetter(f.fab)}</b> · ${esc(fabricLabel(f.fab))}${fabricById(f.fab).directional ? ' <span class="pill">directional</span>' : ''}</div></div></td>
        <td class="muted">${esc(f.sources.join(', '))}</td><td class="num">${f.pieces}</td><td class="num">${fmtYards(f.lengthIn)}</td>
        <td class="num"><b>${fmtYards(f.buyIn)}</b>${f.fq ? '<br><span class="pill info" title="Everything for this fabric fits in an 18 × 21 in fat quarter">fits a fat quarter</span>' : ''}</td><td>${stash}</td></tr>`;
    }
    const bk = plan.backing;
    const bf = doc.layout.backing?.fabric;
    h += `<tr><td><div class="fabcell">${bf ? swatchHtml(bf, 26) : '<span class="sw" style="--sw:26px;background:repeating-linear-gradient(135deg,#eee,#eee 4px,#ddd 4px,#ddd 8px)"></span>'}<div><b>Backing</b>${bf ? ` · ${esc(fabricLabel(bf))}` : ' <span class="muted">(choose in Quilting)</span>'}</div></div></td>
      <td class="muted">${fmtSize(bk.w, bk.h)}${bk.panels > 1 ? ` · ${bk.panels} panels, ${bk.seams} seams` : ' · one piece'}</td><td class="num">${bk.panels}</td><td class="num">${fmtYards(bk.len)}</td><td class="num"><b>${fmtYards(bk.buyIn)}</b><br><span class="muted">${fmtLen(bk.fabricWidth)} wide</span></td><td></td></tr>
      <tr><td><div class="fabcell"><span class="sw" style="--sw:26px;background:#fbf8f0"></span><b>Batting</b></div></td><td class="muted">${fmtSize(plan.batting.w, plan.batting.h)}</td><td></td><td></td><td></td><td></td></tr>`;
    h += `</tbody></table>`;

    const withStash = plan.fabrics.filter(f => doc.stash.some(s => s.fabric === f.fab));
    if (withStash.length) {
      h += `<h2 style="margin-top:26px">Stash check</h2><p class="sub">How the cuts for each fabric fit on the pieces you own (rotations allowed unless the fabric is directional).</p>`;
      for (const f of withStash) {
        const owned = doc.stash.filter(s => s.fabric === f.fab);
        const fit = fitsInPieces(f, owned);
        h += `<div class="fabcard"><div class="fabcard-h">${swatchHtml(f.fab, 22)}<h3>${fabricLetter(f.fab)} · ${esc(fabricLabel(f.fab))}</h3><div class="meta">${fit.ok ? '<span class="pill ok">Enough fabric</span>' : `<span class="pill bad">Short — ${fit.short} cuts left over</span>`}</div></div>
          <div class="stash-diags">${fit.bins.map(bn => `<figure><figcaption>${esc(bn.piece.label || 'Piece')} · ${fmtSize(bn.piece.w, bn.piece.h)} · ${bn.placed.length} cuts</figcaption>${packDiagram(bn, f.fab)}</figure>`).join('')}</div>
          ${fit.ok ? '' : `<p class="hint">Add another piece of this fabric in the panel on the right, or buy ${fmtYards(f.buyIn)}.</p>`}</div>`;
      }
    }
    return h + '</div>';
  },
  inspector() {
    const c = doc.cutting;
    let h = section('Cutting settings', `
      ${lenField('Seam allowance', 'cutting.seam', { min: 0, max: 1 })}
      <div class="btn-row"><button class="btn small" data-act="setSeam" data-arg="0.25">¼"</button><button class="btn small" data-act="setSeam" data-arg="0.375">⅜"</button><button class="btn small" data-act="setSeam" data-arg="0.5">½"</button><button class="btn small" data-act="setSeam" data-arg="0.3937">1 cm</button></div>
      ${lenField('Usable width of fabric (WOF)', 'cutting.wof', { min: 10, max: 120 })}
      <p class="hint">Quilting cotton is 42–44" wide; about 40–42" is usable after trimming selvages.</p>
      <div class="f-row">${numField('Extra %', 'cutting.extra', { min: 0, max: 50 })}
      ${selectField('Round up to', 'cutting.roundTo', [['eighth', '⅛ yard'], ['quarter', '¼ yard'], ['half', '½ yard'], ['none', "Don't round"]])}</div>
      ${selectField('Appliqué method', 'cutting.appMethod', [['turned', 'Turned edge (3/16" turn-under)'], ['fusible', 'Fusible web (reversed templates)']])}`, { key: 'cutset' });
    h += section('Backing & batting', `<div class="f-row">
      ${selectField('Backing fabric width', 'cutting.backingWidth', [[42, '42" quilting cotton'], [60, '60" fabric'], [108, '108" wide back']], { type: 'num' })}
      ${lenField('Overhang per side', 'cutting.overhang', { min: 0, max: 12 })}</div>`, { key: 'backing' });
    let rows = doc.stash.map(s => `<div class="list-item"><div class="stash-row">
        <input type="text" value="${esc(s.label)}" data-change="stashLabel" data-arg="${s.id}" aria-label="Name">
        <input type="text" inputmode="decimal" value="${esc(inputLen(s.w))}" data-change="stashW" data-arg="${s.id}" aria-label="Width" title="Width">
        <input type="text" inputmode="decimal" value="${esc(inputLen(s.h))}" data-change="stashH" data-arg="${s.id}" aria-label="Height" title="Height">
        <button class="btn small ghost" data-act="stashDel" data-arg="${s.id}" aria-label="Remove">✕</button>
        <div class="sel-fab">${swatchHtml(s.fabric, 18)}<select data-change="stashFab" data-arg="${s.id}" style="flex:1">${doc.fabrics.map(f => `<option value="${f.id}" ${f.id === s.fabric ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div></div></div>`).join('');
    h += section('My stash', `<p class="hint" style="margin-top:0">List fabric you already have to check whether it's enough. New pieces use the selected fabric (${esc(fabricLabel(ui.fabric === BG ? doc.layout.background : ui.fabric))}).</p>
      ${rows}<div class="btn-row">${STASH_PRESETS.map(([l, w, hh]) => `<button class="btn small" data-act="stashAdd" data-arg="${l}|${w}|${hh}">+ ${l}</button>`).join('')}</div>`, { key: 'stash' });
    return h;
  },
};
function packDiagram(bin, fab) {
  const W = bin.w || bin.piece.w, H = bin.h || bin.piece.h;
  const k = Math.min(330 / W, 220 / H);
  const col = fabricHex(fab), ink = inkOn(col);
  let s = `<svg width="${round(W * k, 1)}" height="${round(H * k, 1)}" viewBox="0 0 ${W} ${H}" style="background:repeating-linear-gradient(45deg,#fafafa,#fafafa 6px,#efefef 6px,#efefef 12px);border:1px solid #ccc">`;
  for (const p of bin.placed) {
    s += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="${col}" stroke="#fff" stroke-width="${0.6 / k}"><title>${esc(p.item.label)}</title></rect>`;
    if (p.w * k > 26 && p.h * k > 12) s += `<text x="${p.x + p.w / 2}" y="${p.y + p.h / 2}" font-size="${round(Math.min(10, p.h * k * .4) / k, 3)}" text-anchor="middle" dominant-baseline="central" fill="${ink}" font-family="system-ui">${shortLen(p.w, "up")}×${shortLen(p.h, "up")}</text>`;
  }
  return s + '</svg>';
}
Actions.setSeam = v => { doc.cutting.seam = +v; commit(); };
Actions.stashAdd = arg => {
  const [label, w, h] = arg.split('|');
  const fab = ui.fabric === BG || !doc.fabrics.some(f => f.id === ui.fabric) ? doc.layout.background : ui.fabric;
  doc.stash.push({ id: uid('s'), label: label.replace('…', ''), fabric: fab, w: +w, h: +h });
  commit();
};
Actions.stashDel = id => { doc.stash = doc.stash.filter(s => s.id !== id); commit(); };
Actions.stashLabel = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg); if (s) { s.label = v; commit(); } };
Actions.stashFab = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg); if (s) { s.fabric = v; commit(); } };
Actions.stashW = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg), n = parseLen(v); if (s && n > 0) { s.w = n; commit(); } else render(); };
Actions.stashH = (v, el) => { const s = doc.stash.find(x => x.id === el.dataset.arg), n = parseLen(v); if (s && n > 0) { s.h = n; commit(); } else render(); };
