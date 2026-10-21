/* Cutting view: per-fabric cutting instructions with strip diagrams and templates. */

Views.cutting = {
  main() {
    const Q = Qnow(), plan = cuttingPlan(Q);
    let h = `<div class="docview wide"><h2>Cutting plan</h2>
      <p class="sub">Each fabric gets a numbered cutting order and a to-scale map of the fabric you'll buy — ${fmtLen(doc.cutting.wof)} wide, top to bottom in the order you cut. Sizes include ${fmtLen(doc.cutting.seam)} seam allowances and are rounded up to the nearest ⅛". Hover a step to find it on the map.</p>`;
    if (!plan.fabrics.length) return h + `<div class="callout">Nothing to cut yet — place some blocks or shapes in the <a href="#" data-act="view" data-arg="layout">Layout</a>.</div></div>`;
    let tid = 0;
    for (const f of plan.fabrics) {
      const sheet = fabricSheet(f);
      let steps = '';
      sheet.rows.forEach((row, i) => {
        const n = i + 1;
        const rec = row.group?.recipes || (row.a ? [row.a] : row.r ? [row.r] : []);
        const icons = rec.map(r => cutIconSvg(r.recipe, f.fab)).join('');
        const uses = [];
        for (const r of rec) for (const u of r.uses?.values() || []) if (!uses.some(x => (x.b || x.kind) === (u.b || u.kind))) uses.push(u);
        if (row.kind === 'joined') uses.push({ kind: row.j.src });
        let extra = '';
        if (row.kind === 'template') {
          tid++;
          extra = `<div class="tpl-grid"><div class="tpl-card" data-act="tplDetail" data-arg="${f.fab}|${esc(row.r.recipe.key)}">${templateThumb(row.r.recipe, f.fab, 80)}T${tid} · see true-size template</div></div>`;
        }
        steps += `<li data-step="${n}"><span class="stepno">${n}</span><div class="step-main"><div class="head">${row.head}</div>
          <div class="parts">${row.parts.map(esc).join('<br>')}</div>${extra}
          ${uses.length ? `<div class="uses"><span class="muted">Used for</span> ${uses.map(u => usageThumbSvg(u, 44)).join('')}</div>` : ''}</div>
          <div class="step-icons">${icons}</div></li>`;
      });
      h += `<div class="fabcard" id="cut-${f.fab}"><div class="fabcard-h">${swatchHtml(f.fab, 26)}<h3>${fabricLetter(f.fab)} · ${esc(fabricLabel(f.fab))}</h3>
        <div class="meta"><span class="pill">${f.pieces} pieces</span><span class="pill">${fmtYards(f.lengthIn)} used</span><span class="pill info">buy ${fmtYards(f.buyIn)}</span>${f.fq ? '<span class="pill ok">fits a fat quarter</span>' : ''}</div></div>
        <div class="cut-grid"><ol class="cutsteps">${steps}</ol>
        ${ui.cutDiagrams !== false ? `<div class="sheet-wrap"><div class="hint" style="margin:0 0 4px">Cutting map — ${fmtYards(f.buyIn)} of fabric</div>${fabricSheetSvg(sheet, f.fab, { width: 380 })}</div>` : ''}</div></div>`;
    }
    return h + '</div>';
  },
  afterMain(el) {
    // hovering a step lights up its cuts on the map, and vice versa
    const set = (card, n) => { for (const x of card.querySelectorAll('[data-step]')) x.classList.toggle('hl', n != null && x.dataset.step === n); };
    el.addEventListener('mouseover', e => { const t = e.target.closest('[data-step]'), card = e.target.closest('.fabcard'); if (card) set(card, t?.dataset.step); });
    el.addEventListener('mouseleave', () => $$('.fabcard [data-step].hl').forEach(x => x.classList.remove('hl')));
  },
  inspector() {
    const plan = cuttingPlan(Qnow());
    let h = section('Settings', `<dl class="kv"><dt>Seam allowance</dt><dd>${fmtLen(doc.cutting.seam)}</dd><dt>Width of fabric</dt><dd>${fmtLen(doc.cutting.wof)}</dd><dt>Extra</dt><dd>${doc.cutting.extra}%</dd></dl>
      <div class="btn-row"><button class="btn small" data-act="view" data-arg="fabric">Change in Fabric →</button></div>
      <label class="check"><input type="checkbox" ${ui.cutDiagrams !== false ? 'checked' : ''} data-change="cutDiagrams"> Show cutting diagrams</label>`, { key: 'cutsettings' });
    h += section('Fabrics', plan.fabrics.map(f => `<div class="region-row" data-act="jumpFab" data-arg="${f.fab}">${swatchHtml(f.fab, 18)}<span class="nm"><b>${fabricLetter(f.fab)}</b> ${esc(fabricLabel(f.fab))}</span><span class="muted">${fmtYards(f.buyIn)}</span></div>`).join('') || '<p class="hint">Nothing to cut yet.</p>', { key: 'cutfabs' });
    h += section('Tips', `<p class="hint" style="margin-top:0">Press fabric before cutting. Square up the fabric edge first, then cut the widest strips. Label each stack with its fabric letter and size. Directional prints keep their orientation in these plans.</p>`, { key: 'cuttips' });
    return h;
  },
};
Actions.cutDiagrams = v => { ui.cutDiagrams = !!v; saveUi(); render(); };
Actions.jumpFab = id => $(`#cut-${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function templateThumb(recipe, fab, px) {
  const g = templateGeom(recipe), out = g.cut, bb = bounds(out);
  const k = px / Math.max(bb.w, bb.h);
  const hd = list => list.map(h => polyToPath(h)).join('');
  return `<svg width="${round(bb.w * k, 1)}" height="${round(bb.h * k, 1)}" viewBox="${bb.x} ${bb.y} ${bb.w} ${bb.h}"><path d="${polyToPath(out)}${hd(g.cutHoles)}" fill="${mix(fabricHex(fab), '#fff', .7)}" fill-rule="evenodd" stroke="#555" stroke-width="${1 / k}" stroke-dasharray="${3 / k} ${2 / k}"/><path d="${polyToPath(g.pts)}${hd(g.holes)}" fill="${fabricFill(fab)}" fill-rule="evenodd" stroke="#333" stroke-width="${1 / k}"/></svg>`;
}
Actions.tplDetail = arg => {
  const [fab, key] = arg.split('|');
  const f = cuttingPlan(Qnow()).fabrics.find(x => x.fab === fab);
  const r = f?.templates.find(t => t.recipe.key === key);
  if (!r) return;
  const g = templateGeom(r.recipe), sa = g.sa;
  const pts = g.pts, cut = g.cut, bb = bounds(cut);
  const hd = list => list.map(h => polyToPath(h)).join('');
  const k = Math.min(520 / bb.w, 420 / bb.h), pad = 30 / k;
  const angs = interiorAngles(pts);
  let s = `<svg width="${round((bb.w + 2 * pad) * k)}" height="${round((bb.h + 2 * pad) * k)}" viewBox="${bb.x - pad} ${bb.y - pad} ${bb.w + 2 * pad} ${bb.h + 2 * pad}" font-family="system-ui">
    <path d="${polyToPath(cut)}${hd(g.cutHoles)}" fill="${mix(fabricHex(fab), '#fff', .8)}" fill-rule="evenodd" stroke="#444" stroke-width="${1.2 / k}" stroke-dasharray="${5 / k} ${3 / k}"/>
    <path d="${polyToPath(pts)}${hd(g.holes)}" fill="${fabricFill(fab)}" fill-rule="evenodd" fill-opacity=".85" stroke="#222" stroke-width="${1.6 / k}"/>`;
  if (!r.recipe.curved && pts.length <= 24) {
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length], L = dist(p, q);
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, c = centroid(pts);
      const dx = mx - c[0], dy = my - c[1], dl = Math.hypot(dx, dy) || 1;
      s += `<text x="${mx + dx / dl * 14 / k}" y="${my + dy / dl * 14 / k}" font-size="${12 / k}" text-anchor="middle" dominant-baseline="central" fill="#1f3a5f" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="${3 / k}">${fmtLen(L)}</text>`;
      const pr = pts[(i - 1 + pts.length) % pts.length];
      const bx = (pr[0] + q[0]) / 2 - p[0], by = (pr[1] + q[1]) / 2 - p[1], bl = Math.hypot(bx, by) || 1;
      s += `<text x="${p[0] + bx / bl * 22 / k}" y="${p[1] + by / bl * 22 / k}" font-size="${11 / k}" text-anchor="middle" dominant-baseline="central" fill="#b5482f" font-weight="700" paint-order="stroke" stroke="#fff" stroke-width="${3 / k}">${Math.round(angs[i])}°</text>`;
    });
  }
  s += '</svg>';
  openModal(`<h2>${esc(r.recipe.makes)} template</h2>
    <p class="muted">Fabric ${fabricLetter(fab)} · cut ${r.units} · finished ${fmtSize(bounds(pts).w, bounds(pts).h)} · cut box ${fmtSize(r.recipe.w, r.recipe.h, 'up')}</p>
    <div style="text-align:center">${s}</div>
    <p class="hint">${g.fusible ? 'Fusible appliqué: shown reversed, the way you trace it onto the paper side of fusible web — cut on the line, no allowance.' : `Solid line = sewing line (blue numbers: finished side lengths, red: angles). Dashed line = cutting line with ${fmtLen(sa)} ${r.recipe.applique ? 'turn-under' : 'seam'} allowance.`} The Pattern view prints this at true size.</p>
    <div class="actions"><button class="btn" data-act="closeModal">Close</button><button class="btn primary" data-act="view" data-arg="pattern">Go to pattern</button></div>`);
};
