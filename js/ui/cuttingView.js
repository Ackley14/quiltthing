/* Cutting plan: per-fabric cutting instructions with strip diagrams and templates. */

// The cutting plan pane of Fabric & cutting: per fabric, a numbered cutting order beside a
// to-scale map of each piece of fabric (stash first, then what you buy).
function cuttingPlanHtml(plan) {
  let h = `<p class="hint" style="margin:-8px 0 12px">Sizes include ${fmtLen(doc.cutting.seam)} seams. Point at a step to find it on the map.</p>`;
  let tid = 0;
  for (const f of plan.fabrics) {
    const sheet = fabricSheet(f);
    let steps = '';
    const fb = fallbackInfo(f), split = fb && sheet.rows.some(r => r.fallback) && sheet.rows.some(r => !r.fallback);
    sheet.rows.forEach((row, i) => {
      const n = i + 1;
      if (split && (i === 0 || row.fallback !== sheet.rows[i - 1].fallback)) steps += `<li class="src-h${row.fallback ? ' fallback' : ''}">${row.fallback ? `From ${fmtLen(fb.width)} yardage: ${esc(fallbackReason(fb, true))}` : `From ${esc(f.format.name.toLowerCase())}s`}</li>`;
      const rec = row.group?.recipes || (row.a ? [row.a] : row.r ? [row.r] : []);
      const icons = rec.map(r => cutIconSvg(r.recipe, f.fab)).join('');
      const uses = [];
      for (const r of rec) for (const u of r.uses?.values() || []) if (!uses.some(x => (x.b || x.kind) === (u.b || u.kind))) uses.push(u);
      if (row.kind === 'joined') uses.push({ kind: row.j.src });
      let extra = '';
      if (row.kind === 'template') {
        tid++;
        extra = `<div class="tpl-grid"><div class="tpl-card" data-act="tplDetail" data-arg="${f.fab}|${esc(row.r.recipe.key)}">${templateThumb(row.r.recipe, f.fab, 80)}Template T${tid}</div></div>`;
      }
      steps += `<li data-step="${n}"><span class="stepno">${n}</span><div class="step-main"><div class="head">${row.head}</div>
        <div class="parts">${row.parts.map(esc).join('<br>')}</div>${extra}
        ${uses.length ? `<div class="uses"><span class="muted">For</span> ${uses.map(u => usageThumbSvg(u, 44)).join('')}</div>` : ''}</div>
        <div class="step-icons">${icons}</div></li>`;
    });
    const st = stashUseText(f);
    const maps = fabricSheets(f).map((sh, i) => `<div class="hint" style="margin:${i ? '12px' : 0} 0 4px">${sh.src.kind === 'stash' ? `Your ${esc(sh.src.name.toLowerCase())}: ${piecesText(sh.src.pieces)}` : sh.src.kind === 'precut' ? `${esc(sh.src.name)}: ${piecesText(sh.src.pieces)}` : sh.src.fallback ? `Yardage for ${esc(fallbackInfo(f) ? fallbackReason(fallbackInfo(f), false) : 'the larger cuts')}: ${fmtYards(f.buyIn)}` : st ? `Yardage for the rest: ${fmtYards(f.buyIn)}` : `${fmtYards(f.buyIn)} of ${esc(formatLabel(f.format))}`}</div>${fabricSheetSvg(sh, f.fab, { width: 380, idp: 'cv' + i, title: sh.title })}`).join('');
    h += `<div class="fabcard" id="cut-${f.fab}"><div class="fabcard-h">${swatchHtml(f.fab, 26)}<h3>${fabricLetter(f.fab)} ${esc(fabricLabel(f.fab))}</h3>
      <div class="meta">${plural(f.pieces, 'piece')} · buy ${buyText(f)}${st ? ` · uses ${esc(st)}` : ''}</div></div>
      ${hasStashFor(f.fab) ? `<label class="check" style="margin:-4px 0 8px"><input type="checkbox" data-change="toggleStashUse" data-arg="${f.fab}" ${fabricById(f.fab).skipStash ? '' : 'checked'}> Cut from my stash first</label>` : ''}
      <div class="cut-grid"><ol class="cutsteps">${steps}</ol>
      ${ui.cutDiagrams !== false ? `<div class="sheet-wrap">${maps}</div>` : ''}</div></div>`;
  }
  return h;
}
// Pointing at a step lights up its cuts on the map, and the other way round.
function cuttingAfterMain(el) {
  const set = (card, n) => { for (const x of card.querySelectorAll('[data-step]')) x.classList.toggle('hl', n != null && x.dataset.step === n); };
  if (el._cutHover) return; el._cutHover = true;
  el.addEventListener('mouseover', e => { const t = e.target.closest('[data-step]'), card = e.target.closest('.fabcard'); if (card) set(card, t?.dataset.step); });
  el.addEventListener('mouseleave', () => $$('.fabcard [data-step].hl').forEach(x => x.classList.remove('hl')));
}
Actions.toggleStashUse = (v, el) => { const fb = doc.fabrics.find(x => x.id === el.dataset.arg); if (fb) { if (v) delete fb.skipStash; else fb.skipStash = true; commit(); } };
Actions.cutDiagrams = v => { ui.cutDiagrams = !!v; saveUi(); render(); };

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
    <p class="muted">Fabric ${fabricLetter(fab)} · cut ${r.units} · finished ${fmtSize(bounds(pts).w, bounds(pts).h)} · fits in ${fmtSize(r.recipe.w, r.recipe.h, 'up')}</p>
    <div style="text-align:center">${s}</div>
    <p class="hint">${g.fusible ? 'Shown reversed, ready to trace onto fusible web. Cut on the line.' : `Solid line: sewing line, with finished lengths in blue and angles in red. Dashed line: cutting line, ${fmtLen(sa)} outside.`} The pattern prints it at full size.</p>
    <div class="actions"><button class="btn primary" data-act="closeModal">Close</button></div>`);
};
