/* Shared SVG diagrams for the Cutting view and the printed pattern:
   the true-scale cutting map, cut icons, "used for" thumbnails, and unit how-to sketches. */

/* ---------- cutting map ---------- */
// opts: { width: number, unit: 'px'|'in', idp }
function fabricSheetSvg(sheet, fab, opts = {}) {
  const W = sheet.W, need = sheet.H, H = Math.max(need, sheet.buyIn || 0, 1);
  const fs = W * 0.026;
  const ML = W * 0.07, MR = W * 0.11, MT = W * 0.06, MB = W * 0.02;
  const col = fabricHex(fab), ink = inkOn(col), tint = mix(col, '#ffffff', 0.84);
  const idp = (opts.idp || 'sh') + '-' + fab;
  const hair = W * 0.0025;
  const vbW = W + ML + MR, vbH = H + MT + MB;
  const scale = (opts.width || 520) / vbW;
  const u = opts.unit || 'px';
  let s = `<svg class="sheet" viewBox="${-ML} ${-MT} ${round(vbW, 3)} ${round(vbH, 3)}" width="${round(vbW * scale, 2)}${u === 'in' ? 'in' : ''}" height="${round(vbH * scale, 2)}${u === 'in' ? 'in' : ''}" font-family="system-ui, sans-serif">`;
  s += `<defs><pattern id="${idp}-scrap" width="${W * .02}" height="${W * .02}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${W * .02}" height="${W * .02}" fill="${tint}"/><line y2="${W * .02}" stroke="#fff" stroke-width="${W * .006}"/></pattern></defs>`;
  // the fabric itself (scrap shows as hatched), and the extra length to buy
  s += `<rect x="0" y="0" width="${W}" height="${need}" fill="url(#${idp}-scrap)" stroke="#9aa3ad" stroke-width="${hair}"/>`;
  if (H > need + 0.01) {
    s += `<rect x="0" y="${need}" width="${W}" height="${round(H - need, 3)}" fill="none" stroke="#9aa3ad" stroke-width="${hair}" stroke-dasharray="${hair * 6} ${hair * 4}"/>`;
    if (H - need > fs * 1.4) s += `<text x="${W / 2}" y="${need + (H - need) / 2}" font-size="${fs * .9}" text-anchor="middle" dominant-baseline="central" fill="#6b7785">extra to buy (shrinkage, mistakes, rounding)</text>`;
  }
  s += `<text x="${W / 2}" y="${-MT * .45}" font-size="${fs}" text-anchor="middle" fill="#4f5d6b">${esc(opts.title || `← ${fmtLen(W)} width of fabric (selvage to selvage) →`)}</text>`;
  // length ruler on the right: every ¼ yd (or 10 cm)
  const tick = displayUnits === 'cm' ? 10 / CM_PER_IN : 9;
  for (let t = 0, k = 0; t <= H + 1e-6; t += tick, k++) {
    const major = displayUnits === 'cm' ? k % 10 === 0 : k % 4 === 0;
    s += `<line x1="${W}" y1="${round(t, 3)}" x2="${W + (major ? MR * .35 : MR * .18)}" y2="${round(t, 3)}" stroke="#8a94a0" stroke-width="${hair}"/>`;
    if (major && t > 0) s += `<text x="${W + MR * .4}" y="${round(t, 3)}" font-size="${fs * .85}" dominant-baseline="central" fill="#4f5d6b">${displayUnits === 'cm' ? `${Math.round(t * CM_PER_IN / 100)} m` : `${Math.round(t / 36)} yd`}</text>`;
  }
  const badge = (x, y, n, r) => `<g class="sb" data-step="${n}"><circle cx="${round(x, 3)}" cy="${round(y, 3)}" r="${round(r, 3)}" fill="#fff" stroke="#1f3a5f" stroke-width="${hair}"/><text x="${round(x, 3)}" y="${round(y, 3)}" font-size="${round(r * 1.25, 3)}" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="#1f3a5f">${n}</text></g>`;
  // light fabrics get a dark outline so cuts stay visible against the pale scrap hatching
  const edge = luminance(col) > 0.55 ? '#7a8590' : '#fff';
  const poly = (pts, step, extra = '') => `<path data-step="${step}" d="${polyToPath(pts)}" fill="${fabricFill(fab)}" stroke="${edge}" stroke-width="${hair * 1.4}"${extra}/>`;
  let lastStep = null;
  for (const b of sheet.bands) {
    const { y, h } = b;
    if (b.step !== lastStep) { s += badge(-ML / 2, y + Math.min(h, W * .08) / 2, b.step, Math.min(ML * .36, fs * .95)); lastStep = b.step; }
    s += `<line x1="0" y1="${round(y + h, 3)}" x2="${W}" y2="${round(y + h, 3)}" stroke="#6b7785" stroke-width="${hair}" stroke-dasharray="${hair * 4} ${hair * 3}"/>`;
    if (b.kind === 'strip') {
      for (const c of b.cuts) {
        s += poly(rectPts(c.x, y, c.w, h), b.step);
        const cut = c.recipe.cut;
        const ln = (x1, y1, x2, y2) => `<line x1="${round(x1, 3)}" y1="${round(y1, 3)}" x2="${round(x2, 3)}" y2="${round(y2, 3)}" stroke="${ink}" stroke-opacity=".75" stroke-width="${hair * 1.2}" stroke-dasharray="${hair * 5} ${hair * 3}" pointer-events="none"/>`;
        if (cut === 'diag' || cut === 'diagR' || cut === 'cross' || cut === 'stitch') s += ln(c.x, y, c.x + c.w, y + h);
        if (cut === 'diagL' || cut === 'cross') s += ln(c.x + c.w, y, c.x, y + h);
        if (Math.min(c.w, h) > fs * 2.4) s += `<text x="${round(c.x + c.w / 2, 3)}" y="${round(y + h / 2, 3)}" font-size="${fs * .85}" text-anchor="middle" dominant-baseline="central" fill="${ink}" pointer-events="none">${esc(shortLen(c.w, 'up'))}${Math.abs(c.w - h) > 1e-3 ? `×${esc(shortLen(h, 'up'))}` : ''}</text>`;
      }
    } else if (b.kind === 'angled') {
      const r = b.recipe, lean = (r.hand === 'L' ? -1 : 1) * h / Math.tan(r.angle * Math.PI / 180), x0 = Math.max(0, lean);
      for (let i = 0; i < b.n; i++) { const xa = x0 + i * r.step; s += poly([[xa, y], [xa + r.step, y], [xa + r.step - lean, y + h], [xa - lean, y + h]], b.step); }
    } else if (b.kind === 'trap') {
      const r = b.recipe, A = r.a, B = r.b, d = (A - B) / 2;
      for (let i = 0; i < b.n; i++) {
        const m = Math.floor(i / 2), o = m * (A + B);
        const p = !r.alternate ? [[i * A + d, y], [i * A + d + B, y], [i * A + A, y + h], [i * A, y + h]]
          : i % 2 === 0 ? [[o + d, y], [o + d + B, y], [o + A, y + h], [o, y + h]]
          : [[o + d + B, y], [o + d + B + A, y], [o + A + B, y + h], [o + A, y + h]];
        s += poly(p, b.step);
      }
    } else if (b.kind === 'tri60') {
      const Bw = h * 2 / Math.sqrt(3);
      for (let i = 0; i < b.n; i++) {
        const x = Math.floor(i / 2) * Bw + (i % 2 ? Bw / 2 : 0);
        s += poly(i % 2 ? [[x, y], [x + Bw, y], [x + Bw / 2, y + h]] : [[x, y + h], [x + Bw / 2, y], [x + Bw, y + h]], b.step);
      }
    } else if (b.kind === 'joined') {
      s += poly(rectPts(0, y, W, h), b.step);
      if (h > fs * 1.2) s += `<text x="${W / 2}" y="${round(y + h / 2, 3)}" font-size="${fs * .85}" text-anchor="middle" dominant-baseline="central" fill="${ink}" pointer-events="none">${esc(b.label.toLowerCase())} strip</text>`;
    }
  }
  // shorter strips cut from leftovers, with their step number at the start
  for (const ps of sheet.partials || []) {
    s += `<rect x="${round(ps.x, 3)}" y="${round(ps.y, 3)}" width="${round(ps.w, 3)}" height="${round(ps.h, 3)}" fill="none" stroke="#6b7785" stroke-width="${hair}" stroke-dasharray="${hair * 4} ${hair * 3}"/>`;
    for (const c of ps.cuts) {
      s += poly(rectPts(c.x, ps.y, c.w, ps.h), ps.step);
      if (Math.min(c.w, ps.h) > fs * 2.4) s += `<text x="${round(c.x + c.w / 2, 3)}" y="${round(ps.y + ps.h / 2, 3)}" font-size="${fs * .85}" text-anchor="middle" dominant-baseline="central" fill="${ink}" pointer-events="none">${esc(shortLen(c.w, 'up'))}${Math.abs(c.w - ps.h) > 1e-3 ? `×${esc(shortLen(ps.h, 'up'))}` : ''}</text>`;
    }
    s += badge(ps.x + fs * 0.9, ps.y + Math.min(ps.h / 2, fs * 0.9), ps.step, fs * 0.7);
  }
  if (sheet.tpl) {
    const t = sheet.tpl;
    if (sheet.H > t.y + 1e-6) s += badge(-ML / 2, t.y + fs, t.placed.find(p => p.y >= t.y - 1e-6)?.step || t.placed[0]?.step || '', Math.min(ML * .36, fs * .95));
    const marked = new Set();
    for (const p of t.placed) {
      // pieces placed in leftovers get their step number beside the first one
      if (p.from && !marked.has(p.step + '|' + p.from)) { marked.add(p.step + '|' + p.from); s += badge(p.x + fs * 0.8, p.y + fs * 0.8, p.step, fs * 0.7); }
      let o;
      if (p.poly) o = p.poly;
      else {
        o = p.item.r.recipe.cutBox.outline;
        if (p.rot) o = translatePoly(rotatePoly(o, Math.PI / 2), p.item.r.recipe.cutBox.h, 0);
        o = translatePoly(o, p.x, p.y);
      }
      s += poly(t.abs ? o : translatePoly(o, 0, t.y), p.step);
    }
  }
  return s + '</svg>';
}

/* ---------- what a cut looks like (small icon) ---------- */
function cutIconSvg(recipe, fab, px = 34) {
  const col = fabricFill(fab), ink = inkOn(fabricHex(fab));
  const box = (w, h) => {
    const k = 28 / Math.max(w, h), W = w * k, H = h * k, x = (32 - W) / 2, y = (32 - H) / 2;
    return { x, y, W, H, r: `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${col}" stroke="#2b3a4a" stroke-width="1"/>` };
  };
  let inner = '';
  const dl = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="1.2" stroke-dasharray="2.5 1.5"/>`;
  if (recipe.method === 'strip') {
    const b = box(recipe.sub, recipe.w);
    inner = b.r;
    if (['diag', 'diagR', 'cross', 'stitch'].includes(recipe.cut)) inner += dl(b.x, b.y, b.x + b.W, b.y + b.H);
    if (recipe.cut === 'diagL' || recipe.cut === 'cross') inner += dl(b.x + b.W, b.y, b.x, b.y + b.H);
  } else if (recipe.method === 'angled') {
    inner = `<path d="M10,6H30L22,26H2Z" fill="${col}" stroke="#2b3a4a"/>`;
  } else if (recipe.method === 'trap') {
    inner = `<path d="M9,8H23L30,24H2Z" fill="${col}" stroke="#2b3a4a"/>`;
  } else if (recipe.method === 'tri60') {
    inner = `<path d="M16,4L30,28H2Z" fill="${col}" stroke="#2b3a4a"/>`;
  } else if (recipe.outline) {
    const bb = bounds(recipe.outline), k = 28 / Math.max(bb.w, bb.h);
    inner = `<path d="${polyToPath(translatePoly(scalePts(recipe.outline, k), (32 - bb.w * k) / 2, (32 - bb.h * k) / 2))}" fill="${col}" stroke="#2b3a4a"/>`;
  } else {
    inner = `<rect x="2" y="12" width="28" height="8" fill="${col}" stroke="#2b3a4a"/>`;
  }
  return `<svg class="cut-icon" viewBox="0 0 32 32" width="${px}" height="${px}">${inner}</svg>`;
}
const scalePts = (p, k) => p.map(([x, y]) => [x * k, y * k]);

/* ---------- where a cut is used: block with those pieces highlighted ---------- */
function usageThumbSvg(use, px = 54, unit = 'px') {
  if (!use.b) return `<span class="pill">${esc(use.kind)}</span>`;
  const block = doc.blocks[use.b];
  if (!block) return '';
  const S = 12;
  const pieces = blockPieces(block, S, S);
  let over = '';
  pieces.forEach((p, i) => {
    if (use.idx.has(i)) over += `<path d="${polyToPath(p.pts)}" fill="none" stroke="#f2b134" stroke-width="0.55" stroke-linejoin="round"/>`;
    else over += `<path d="${polyToPath(p.pts)}${p.holes.map(h => polyToPath(h)).join('')}" fill="#fff" fill-opacity=".72" fill-rule="evenodd"/>`;
  });
  const sz = unit === 'in' ? `${px}in` : px;
  return `<svg class="use-thumb" viewBox="-0.4 -0.4 12.8 12.8" width="${sz}" height="${sz}"><title>${esc(block.name)}</title>${blockSvg(block, S, S)}${over}</svg>`;
}

/* ---------- how to make a unit (pattern illustrations) ---------- */
// Small 3-panel sketches; fabrics: a = first/light, b = second/dark.
function unitHowToSvg(type, a, b, widthIn = 2.9) {
  const A = fabricFill(a), B = fabricFill(b), ink = '#2b3a4a';
  const arrow = x => `<path d="M${x},20h7m-3,-3l3,3l-3,3" fill="none" stroke="${ink}" stroke-width="1"/>`;
  const st = 'stroke="#2b3a4a" stroke-width=".8"';
  const dash = (x1, y1, x2, y2, c = ink) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width=".8" stroke-dasharray="2 1.4"/>`;
  let g = '';
  if (type === 'hst') {
    g = `<rect x="4" y="6" width="28" height="28" fill="${B}" ${st}/><rect x="2" y="4" width="28" height="28" fill="${A}" ${st}/>
      ${dash(2, 4, 30, 32)}<line x1="5" y1="4" x2="30" y2="29" stroke="#c0392b" stroke-width=".7"/><line x1="2" y1="7" x2="27" y2="32" stroke="#c0392b" stroke-width=".7"/>
      ${arrow(36)}
      <rect x="48" y="6" width="22" height="22" fill="${A}" ${st}/><path d="M48,6L70,28H48Z" fill="${B}" ${st}/>
      <rect x="74" y="12" width="22" height="22" fill="${A}" ${st}/><path d="M74,12L96,34H74Z" fill="${B}" ${st}/>`;
  } else if (type === 'goose') {
    g = `<rect x="2" y="4" width="30" height="30" fill="${A}" ${st}/><rect x="2" y="20" width="14" height="14" fill="${B}" ${st}/><rect x="18" y="4" width="14" height="14" fill="${B}" ${st}/>
      ${dash(2, 34, 32, 4)}${arrow(36)}
      <rect x="48" y="12" width="24" height="12" fill="${B}" ${st}/><path d="M48,24L60,12L72,24Z" fill="${A}" ${st}/>
      <rect x="76" y="12" width="24" height="12" fill="${B}" ${st}/><path d="M76,24L88,12L100,24Z" fill="${A}" ${st}/>
      <text x="74" y="34" font-size="5" text-anchor="middle" fill="${ink}">×4 per big square</text>`;
  } else if (type === 'snowball') {
    g = `<rect x="2" y="4" width="30" height="30" fill="${A}" ${st}/><rect x="2" y="4" width="11" height="11" fill="${B}" ${st}/>${dash(13, 4, 2, 15, '#c0392b')}
      ${arrow(36)}<rect x="48" y="4" width="30" height="30" fill="${A}" ${st}/><path d="M48,4H59L48,15Z" fill="${B}" ${st}/>
      <text x="63" y="38" font-size="5" text-anchor="middle" fill="${ink}">sew on the line, trim, press</text>`;
  } else if (type === 'qst') {
    g = `<rect x="2" y="4" width="28" height="28" fill="${A}" ${st}/><path d="M2,4L30,32H2Z" fill="${B}" ${st}/>${dash(30, 4, 2, 32)}
      ${arrow(36)}<rect x="48" y="8" width="24" height="24" fill="${A}" ${st}/><path d="M48,8L60,20L48,32Z M72,8L60,20L72,32Z" fill="${B}" ${st}/>
      <rect x="76" y="8" width="24" height="24" fill="${B}" ${st}/><path d="M76,8L88,20L76,32Z M100,8L88,20L100,32Z" fill="${A}" ${st}/>`;
  } else if (type === 'curved') {
    g = `<path d="M2,4H22A20,20 0 0 1 2,24Z" fill="${B}" ${st}/><path d="M26,4H40V38H8V30A24,24 0 0 0 26,4Z" fill="${A}" ${st}/>
      ${arrow(44)}<rect x="56" y="4" width="34" height="34" fill="${A}" ${st}/><path d="M56,4H78A22,22 0 0 1 56,26Z" fill="${B}" ${st}/>`;
  } else return '';
  return `<svg class="howto" viewBox="0 0 104 40" width="${widthIn}in" height="${round(widthIn * 40 / 104, 3)}in" font-family="system-ui,sans-serif">${g}</svg>`;
}
