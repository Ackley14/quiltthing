/* Cutting view: per-fabric cutting instructions with strip diagrams and templates. */

Views.cutting = {
  main() {
    const Q = Qnow(), plan = cuttingPlan(Q);
    let h = `<div class="docview"><h2>Cutting plan</h2>
      <p class="sub">Cut strips selvage to selvage across the ${fmtLen(doc.cutting.wof)} width of fabric, then sub-cut. All sizes include ${fmtLen(doc.cutting.seam)} seam allowances and are rounded up to the nearest ⅛".</p>`;
    if (!plan.fabrics.length) return h + `<div class="callout">Nothing to cut yet — place some blocks or shapes in the <a href="#" data-act="view" data-arg="layout">Layout</a>.</div></div>`;
    let tid = 0;
    for (const f of plan.fabrics) {
      h += `<div class="fabcard" id="cut-${f.fab}"><div class="fabcard-h">${swatchHtml(f.fab, 26)}<h3>${fabricLetter(f.fab)} · ${esc(fabricLabel(f.fab))}</h3>
        <div class="meta"><span class="pill">${f.pieces} pieces</span><span class="pill info">buy ${fmtYards(f.buyIn)}</span>${f.fq ? '<span class="pill ok">fits a fat quarter</span>' : ''}</div></div><ul class="cutrows">`;
      for (const row of fabricInstructions(f)) {
        let diag = '';
        if (ui.cutDiagrams !== false) {
          if (row.kind === 'strip') diag = stripGroupDiagram(row.group, f.fab);
          else if (row.kind === 'angled') diag = angledDiagram(row.a, f.fab);
        }
        let extra = '';
        if (row.kind === 'template') {
          tid++;
          extra = `<div class="tpl-grid"><div class="tpl-card" data-act="tplDetail" data-arg="${f.fab}|${esc(row.r.recipe.key)}">${templateThumb(row.r.recipe, f.fab, 90)}T${tid} · ${fmtSize(row.r.recipe.w, row.r.recipe.h, 'up')}</div></div>`;
        }
        h += `<li><div class="head">${row.head}</div><div class="parts">${row.parts.map(esc).join('<br>')}</div>${diag ? `<div class="stripdiag">${diag}</div>` : ''}${extra}</li>`;
      }
      h += '</ul>';
      if (f.tplPack.placed.length && ui.cutDiagrams !== false) {
        h += `<div class="hint" style="margin-top:8px">Template pieces laid out on the fabric (${fmtLen(f.tplPack.usedH, 'up')} of yardage):</div><div class="stripdiag">${templatePackDiagram(f)}</div>`;
      }
      h += '</div>';
    }
    return h + '</div>';
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

function stripGroupDiagram(g, fab) {
  const wof = doc.cutting.wof, PX = 560, k = PX / wof;
  const col = fabricHex(fab), light = mix(col, '#ffffff', 0.72), ink = inkOn(col);
  const sh = clamp(g.w * k, 16, 64);
  const runs = [];
  for (const st of g.strips) {
    const sig = st.cuts.map(c => c.len + c.r.recipe.key).join();
    const last = runs[runs.length - 1];
    if (last && last.sig === sig) last.n++; else runs.push({ sig, st, n: 1 });
  }
  const shown = runs.slice(0, 4);
  const H = shown.length * (sh + 8);
  let s = `<svg width="${PX + 60}" height="${H}" viewBox="0 0 ${PX + 60} ${H}" font-family="system-ui" font-size="10">`;
  shown.forEach((run, i) => {
    const y = i * (sh + 8);
    s += `<rect x="0" y="${y}" width="${PX}" height="${sh}" fill="url(#hatch)" stroke="#bbb"/>`;
    let x = 0;
    for (const c of run.st.cuts) {
      const w = c.len * k;
      s += `<rect x="${round(x, 2)}" y="${y}" width="${round(w, 2)}" height="${sh}" fill="${col}" stroke="#fff" stroke-width="1.2"/>`;
      const cut = c.r.recipe.cut;
      if (cut === 'diag' || cut === 'diagL' || cut === 'cross') s += `<line x1="${round(x, 2)}" y1="${y}" x2="${round(x + w, 2)}" y2="${y + sh}" stroke="${ink}" stroke-opacity=".7" stroke-dasharray="3 2"/>`;
      if (cut === 'diagR' || cut === 'cross') s += `<line x1="${round(x + w, 2)}" y1="${y}" x2="${round(x, 2)}" y2="${y + sh}" stroke="${ink}" stroke-opacity=".7" stroke-dasharray="3 2"/>`;
      if (w > 24 && sh >= 16 && cut !== 'diag' && cut !== 'cross') s += `<text x="${round(x + w / 2, 2)}" y="${y + sh / 2}" text-anchor="middle" dominant-baseline="central" fill="${ink}">${shortLen(c.len, "up")}</text>`;
      x += w;
    }
    const left = wof - run.st.used;
    if (left > 1.5) s += `<text x="${round(x + (PX - x) / 2, 2)}" y="${y + sh / 2}" text-anchor="middle" dominant-baseline="central" fill="#777">${shortLen(left)} left</text>`;
    s += `<text x="${PX + 6}" y="${y + sh / 2}" dominant-baseline="central" fill="#333" font-weight="700">${run.n > 1 ? `× ${run.n}` : ''}</text>`;
  });
  s += `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="${light}"/><line y2="6" stroke="#fff" stroke-width="2"/></pattern></defs></svg>`;
  if (runs.length > shown.length) s += `<div class="hint">…and ${runs.length - shown.length} more strip layouts.</div>`;
  return s;
}
function angledDiagram(a, fab) {
  const wof = doc.cutting.wof, PX = 560, k = PX / wof;
  const col = fabricHex(fab);
  const r = a.recipe, sh = clamp(r.w * k, 16, 64);
  // horizontal run of each angled cut across the (displayed) strip height
  const lean = (r.hand === 'L' ? -1 : 1) * sh / Math.tan(r.angle * Math.PI / 180);
  const start = Math.max(0, lean) + 2;
  let s = `<svg width="${PX}" height="${sh}" viewBox="0 0 ${PX} ${sh}"><rect width="${PX}" height="${sh}" fill="${mix(col, '#fff', .75)}" stroke="#bbb"/>`;
  for (let i = 0; i < a.perStrip; i++) {
    const xa = start + i * r.step * k, xb = xa + r.step * k;
    const pts = [[xa, 0], [xb, 0], [xb - lean, sh], [xa - lean, sh]].map(p => `${round(p[0], 2)},${round(p[1], 2)}`).join(' ');
    s += `<polygon points="${pts}" fill="${col}" stroke="#fff" stroke-width="1.2"/>`;
  }
  return s + '</svg>';
}
function templateThumb(recipe, fab, px) {
  const sa = doc.cutting.seam;
  const out = inflate(recipe.outline, sa), bb = bounds(out);
  const k = px / Math.max(bb.w, bb.h);
  return `<svg width="${round(bb.w * k, 1)}" height="${round(bb.h * k, 1)}" viewBox="${bb.x} ${bb.y} ${bb.w} ${bb.h}"><path d="${polyToPath(out)}" fill="${mix(fabricHex(fab), '#fff', .7)}" stroke="#555" stroke-width="${1 / k}" stroke-dasharray="${3 / k} ${2 / k}"/><path d="${polyToPath(recipe.outline)}" fill="${fabricFill(fab)}" stroke="#333" stroke-width="${1 / k}"/></svg>`;
}
function templatePackDiagram(f) {
  const wof = doc.cutting.wof, H = f.tplPack.usedH, k = Math.min(560 / wof, 300 / H);
  const col = fabricHex(f.fab);
  let s = `<svg width="${round(wof * k, 1)}" height="${round(H * k, 1)}" viewBox="0 0 ${wof} ${H}" style="background:${mix(col, '#fff', .82)};border:1px solid #ccc">`;
  for (const p of f.tplPack.placed) {
    if (p.poly) { s += `<path d="${polyToPath(p.poly)}" fill="${col}" stroke="#fff" stroke-width="${1 / k}"/>`; continue; }
    let o = p.item.r.recipe.cutBox.outline;
    if (p.rot) o = translatePoly(rotatePoly(o, Math.PI / 2), p.item.r.recipe.cutBox.h, 0);
    s += `<path d="${polyToPath(translatePoly(o, p.x, p.y))}" fill="${col}" stroke="#fff" stroke-width="${1 / k}"/>`;
  }
  return s + '</svg>';
}
Actions.tplDetail = arg => {
  const [fab, key] = arg.split('|');
  const f = cuttingPlan(Qnow()).fabrics.find(x => x.fab === fab);
  const r = f?.templates.find(t => t.recipe.key === key);
  if (!r) return;
  const sa = r.recipe.applique ? 0.1875 : doc.cutting.seam;
  const pts = r.recipe.outline, cut = inflate(pts, sa), bb = bounds(cut);
  const k = Math.min(520 / bb.w, 420 / bb.h), pad = 30 / k;
  const angs = interiorAngles(pts);
  let s = `<svg width="${round((bb.w + 2 * pad) * k)}" height="${round((bb.h + 2 * pad) * k)}" viewBox="${bb.x - pad} ${bb.y - pad} ${bb.w + 2 * pad} ${bb.h + 2 * pad}" font-family="system-ui">
    <path d="${polyToPath(cut)}" fill="${mix(fabricHex(fab), '#fff', .8)}" stroke="#444" stroke-width="${1.2 / k}" stroke-dasharray="${5 / k} ${3 / k}"/>
    <path d="${polyToPath(pts)}" fill="${fabricFill(fab)}" fill-opacity=".85" stroke="#222" stroke-width="${1.6 / k}"/>`;
  if (!r.recipe.curved) {
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
    <p class="hint">Solid line = sewing line (blue numbers: finished side lengths, red: angles). Dashed line = cutting line with ${fmtLen(sa)} ${r.recipe.applique ? 'turn-under' : 'seam'} allowance. The Pattern view prints this at true size.</p>
    <div class="actions"><button class="btn" data-act="closeModal">Close</button><button class="btn primary" data-act="view" data-arg="pattern">Go to pattern</button></div>`);
};
