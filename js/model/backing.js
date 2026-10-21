/* Backing: how to get a piece big enough for the back of the quilt (quilt + overhang all round).
   Several ways are worked out and compared; the best is used unless you pick another:
     - yardage joined in panels (lengthwise or crosswise seams)
     - yardage cut on the diagonal and slid ("cut & slide"): one seam and a little scrap, but a
       wider, shorter piece from narrow fabric, so often less to buy
     - pieces you already have (stash pieces marked for the backing): as they are, cut & slid,
       cut into panels, or two of them joined side by side
   Cut & slide maths from Ackley14/diagonalbackingCut: cutting a sw × sh rectangle corner to
   corner and sliding one half along the cut gives any c × d with c/sw + d/sh ≤ 2k, where
   k = 1 − s·diagonal/(sw·sh) allows for the seam s sewn along the diagonal. */

const BACK_SEAM = 0.5;      // backing seams are sewn at ½"
const BACK_SELVAGE = 1;     // trimmed from each selvage of bought yardage

// Can a sw × sh piece make c × d (either way round)? The best result, or { feasible: false }.
function slideFit(a, b, c, d, s) {
  if (!(a > 0 && b > 0 && c > 0 && d > 0)) return { feasible: false };
  const EPS = 1e-9;
  const tryOrientation = (sw, sh, rotated) => {
    if (c <= sw + EPS && d <= sh + EPS) {
      return { feasible: true, mode: 'noCut', rotated, sourceW: sw, sourceH: sh, targetW: c, targetH: d, achievedW: sw, achievedH: sh, slideDist: 0, scrapArea: sw * sh - c * d };
    }
    const diag = Math.hypot(sw, sh), k = 1 - s * diag / (sw * sh);
    if (k <= EPS) return null;
    const limit = 2 * k;
    if (c / sw + d / sh > limit + EPS) return null;
    let achievedW, achievedH, slideDir;
    if (c > sw + EPS) { achievedW = c; achievedH = sh * (limit - c / sw); slideDir = 'widen'; }
    else { achievedW = sw * (limit - d / sh); achievedH = d; slideDir = 'heighten'; }
    return { feasible: true, mode: 'cut', rotated, sourceW: sw, sourceH: sh, targetW: c, targetH: d, achievedW, achievedH, slideDir,
      slideDist: Math.hypot(achievedW - sw, achievedH - sh), scrapArea: sw * sh - c * d };
  };
  const cands = [tryOrientation(a, b, false), tryOrientation(b, a, true)].filter(Boolean);
  if (!cands.length) return { feasible: false };
  cands.sort((x, y) => (x.mode !== y.mode ? (x.mode === 'noCut' ? -1 : 1) : x.scrapArea - y.scrapArea || (x.rotated ? 1 : -1)));
  return cands[0];
}
// Shortest length of `width`-wide fabric that cuts & slides to c × d (or null).
function minSlideLength(width, c, d, s) {
  let hi = 4 * (c + d) + 100;
  if (!slideFit(width, hi, c, d, s).feasible) return null;
  let lo = 1;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (slideFit(width, mid, c, d, s).feasible) hi = mid; else lo = mid; }
  return Math.ceil(hi * 8) / 8;
}
// n panels of `w`-wide fabric side by side, joined with ½" seams, to span `across`.
const panelsAcross = (across, w) => across <= w + 1e-9 ? 1 : Math.ceil((across - 2 * BACK_SEAM) / (w - 2 * BACK_SEAM) - 1e-9);

function backingOptions(BW, BH) {
  const bw = doc.cutting.backingWidth || 42, usable = bw - 2 * BACK_SELVAGE;
  const round = len => roundYardIn(len, doc.cutting.roundTo);
  const opts = [];
  // bought yardage, joined in panels: whichever way round takes less
  const panel = (across, along, dir) => { const n = panelsAcross(across, usable); return { n, len: n * along, dir, along }; };
  const pv = panel(BW, BH, 'vertical'), ph = panel(BH, BW, 'horizontal');
  const best = pv.len <= ph.len ? pv : ph;
  opts.push({ id: 'panels', kind: 'panels', from: 'buy', buyIn: round(best.len), panels: best.n, seams: best.dir, along: best.along, width: usable,
    title: best.n === 1 ? `One piece of ${fmtLen(bw)}-wide fabric` : `${best.n} panels of ${fmtLen(bw)}-wide fabric`,
    steps: best.n === 1
      ? [`Buy ${fmtYards(round(best.len))} of ${fmtLen(bw)}-wide fabric and trim it to ${fmtSize(BW, BH)}.`]
      : [`Buy ${fmtYards(round(best.len))} of ${fmtLen(bw)}-wide fabric.`, `Cut it into ${best.n} lengths of ${fmtLen(best.along, 'up')}. Trim off the selvages.`, `Sew them together along the long edges with ½" seams (${best.dir} seams on the quilt) and press the seams open.`, `Trim to ${fmtSize(BW, BH)}.`] });
  // bought yardage, cut & slide: offered when one width isn't enough and it needs no more fabric
  // than joining panels (it's always possible with enough length, but not always sensible)
  if (best.n > 1) {
    const L = minSlideLength(usable, BW, BH, BACK_SEAM);
    const ana = L && slideFit(usable, L, BW, BH, BACK_SEAM);
    if (ana?.feasible && ana.mode === 'cut' && round(L) <= round(best.len)) opts.push({ id: 'slide', kind: 'slide', from: 'buy', buyIn: round(L), ana, length: L,
      title: `Cut & slide ${fmtLen(bw)}-wide fabric`, steps: slideSteps(ana, `Buy ${fmtYards(round(L))} of ${fmtLen(bw)}-wide fabric and trim off the selvages, leaving ${fmtSize(usable, L)}.`, BW, BH) });
  }
  // pieces you have for the backing
  const mine = doc.stash.filter(x => x.backing);
  const name = x => `your ${(x.label || 'piece').toLowerCase()}`;
  for (const p of mine) {
    const ana = slideFit(p.w, p.h, BW, BH, BACK_SEAM);
    if (ana.feasible && ana.mode === 'noCut') { opts.push({ id: 'p:' + p.id, kind: 'piece', from: 'stash', buyIn: 0, pieces: [p], ana, title: `Use ${name(p)} as it is`, steps: [`Trim ${name(p)} (${fmtSize(p.w, p.h)}) to ${fmtSize(BW, BH)}.`] }); continue; }
    // cut into panels and sewn side by side
    let pan = null;
    for (const [w, l] of [[p.w, p.h], [p.h, p.w]]) for (const [across, along, dir] of [[BW, BH, 'vertical'], [BH, BW, 'horizontal']]) {
      const n = panelsAcross(across, w);
      if (n >= 2 && n * along <= l + 1e-9 && (!pan || n < pan.n)) pan = { n, along, dir, w };
    }
    if (pan) { opts.push({ id: 'pp:' + p.id, kind: 'piece-panels', from: 'stash', buyIn: 0, pieces: [p], panels: pan.n, seams: pan.dir, along: pan.along, width: pan.w, title: `Cut ${name(p)} into ${pan.n} panels`,
      steps: [`Cut ${name(p)} (${fmtSize(p.w, p.h)}) into ${pan.n} lengths of ${fmtLen(pan.along, 'up')}.`, `Sew them together along the long edges with ½" seams and press open.`, `Trim to ${fmtSize(BW, BH)}.`] }); continue; }
    if (ana.feasible) opts.push({ id: 's:' + p.id, kind: 'slide', from: 'stash', buyIn: 0, pieces: [p], ana, title: `Cut & slide ${name(p)}`, steps: slideSteps(ana, `Start with ${name(p)} (${fmtSize(p.w, p.h)}).`, BW, BH) });
  }
  // two of your pieces joined side by side
  if (!opts.some(o => o.from === 'stash')) {
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
      const a = mine[i], b = mine[j];
      let ok = null;
      for (const [w1, l1] of [[a.w, a.h], [a.h, a.w]]) for (const [w2, l2] of [[b.w, b.h], [b.h, b.w]]) for (const [across, along, dir] of [[BW, BH, 'vertical'], [BH, BW, 'horizontal']]) {
        if (!ok && w1 + w2 - 2 * BACK_SEAM >= across - 1e-9 && l1 >= along - 1e-9 && l2 >= along - 1e-9) ok = { dir, along, w1, w2 };
      }
      if (ok) opts.push({ id: `j:${a.id}:${b.id}`, kind: 'pair', from: 'stash', buyIn: 0, pieces: [a, b], panels: 2, seams: ok.dir, along: ok.along, title: `Join ${name(a)} and ${name(b)}`,
        steps: [`Sew ${name(a)} and ${name(b)} together along their long edges with a ½" seam and press it open.`, `Trim to ${fmtSize(BW, BH)}.`] });
    }
  }
  return opts;
}
function slideSteps(ana, start, BW, BH) {
  if (ana.mode === 'noCut') return [start, `Trim to ${fmtSize(BW, BH)}.`];
  const sw = ana.sourceW, sh = ana.sourceH;
  return [start,
    `${ana.rotated ? 'Turn it so it’s ' : 'Lay it out '}${fmtLen(sw, 'up')} wide and ${fmtLen(sh, 'up')} long, then cut it from corner to corner on the diagonal (${fmtLen(Math.hypot(sw, sh), 'up')}).`,
    `Slide one half along the cut by ${fmtLen(ana.slideDist, 'up')}, so the piece becomes ${ana.slideDir === 'widen' ? 'wider and shorter' : 'longer and narrower'}.`,
    `Sew the diagonal seam with a ½" seam and press it open.`,
    `Trim to ${fmtSize(BW, BH)} (the corners left over are scrap).`];
}

function computeBacking(Q) {
  const oh = doc.cutting.overhang ?? 4;
  const BW = Q.W + 2 * oh, BH = Q.H + 2 * oh;
  const options = backingOptions(BW, BH);
  const want = doc.layout.backing?.method;
  // automatic: your own pieces first (simplest), otherwise the least to buy (panels on a tie)
  const rank = o => [o.from === 'stash' ? 0 : 1, o.from === 'stash' ? ['piece', 'piece-panels', 'pair', 'slide'].indexOf(o.kind) : o.buyIn, o.kind === 'slide' ? 1 : 0];
  const auto = options.slice().sort((a, b) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; })[0];
  const chosen = options.find(o => o.id === want) || auto;
  return { w: BW, h: BH, fabricWidth: doc.cutting.backingWidth || 42, options, chosen, auto, buyIn: chosen.buyIn,
    panels: chosen.panels || 1, seams: chosen.seams || 'vertical', len: chosen.buyIn };
}

/* ---------- diagrams ---------- */
// Cut & slide: the piece with its diagonal cut, then the two halves slid and the trim.
function slideDiagramSvg(ana, fab, opts = {}) {
  const sw = ana.sourceW, sh = ana.sourceH, tw = ana.targetW, th = ana.targetH;
  const aw = ana.achievedW, ah = ana.achievedH;
  const fill = fabricFill(fab), light = mix(fabricHex(fab), '#ffffff', 0.55);
  const cut = ana.mode === 'cut';
  const bb = !cut ? { x0: 0, x1: sw, y0: 0, y1: sh } : ana.slideDir === 'widen' ? { x0: 0, x1: aw, y0: Math.min(0, ah - sh), y1: sh } : { x0: Math.min(0, aw - sw), x1: sw, y0: 0, y1: ah };
  const gap = Math.max(sw, bb.x1 - bb.x0) * 0.22, ox = sw + gap - bb.x0;
  const top = Math.max(sh, bb.y1), bottom = Math.min(0, bb.y0), H = top - bottom, W = ox + bb.x1;
  const pad = Math.max(W, H) * 0.08, fs = Math.max(W, H) * 0.035, hair = Math.max(W, H) * 0.004;
  const P = (pts, dx) => pts.map(([x, y]) => `${round(x + dx, 3)},${round(top - y, 3)}`).join(' ');
  let s = `<svg class="${opts.cls || 'back-diag'}" viewBox="${round(-pad, 3)} ${round(-pad, 3)} ${round(W + 2 * pad, 3)} ${round(H + 2 * pad + fs * 2, 3)}" width="${opts.width || 320}" font-family="system-ui,sans-serif">`;
  // 1: the piece, with the cut
  s += `<polygon points="${P([[0, 0], [sw, 0], [sw, sh], [0, sh]], 0)}" fill="${light}" stroke="#2b3a4a" stroke-width="${hair}"/>`;
  if (cut) s += `<line x1="${round(sw, 3)}" y1="${round(top, 3)}" x2="0" y2="${round(top - sh, 3)}" stroke="#b5482f" stroke-width="${hair * 2}" stroke-dasharray="${hair * 6} ${hair * 4}"/>`;
  s += `<text x="${round(sw / 2, 3)}" y="${round(H + fs * 1.4, 3)}" font-size="${round(fs, 3)}" text-anchor="middle" fill="#3a4754">1 · ${cut ? 'cut' : 'piece'} ${esc(shortLen(sw, 'up'))}×${esc(shortLen(sh, 'up'))}</text>`;
  // 2: slid (or as is), with the backing outlined; everything outside it is trimmed off
  if (cut) {
    s += `<polygon points="${P([[0, 0], [sw, 0], [0, sh]], ox)}" fill="${light}" stroke="#2b3a4a" stroke-width="${hair}"/>`;
    s += `<polygon points="${P([[aw, ah], [aw - sw, ah], [aw, ah - sh]], ox)}" fill="${light}" stroke="#b5482f" stroke-width="${hair}"/>`;
  } else s += `<polygon points="${P([[0, 0], [sw, 0], [sw, sh], [0, sh]], ox)}" fill="${light}" stroke="#2b3a4a" stroke-width="${hair}"/>`;
  s += `<polygon points="${P([[0, 0], [tw, 0], [tw, th], [0, th]], ox)}" fill="${fill}" fill-opacity=".85" stroke="#1f3a5f" stroke-width="${hair * 2.5}"/>`;
  if (cut) s += `<line x1="${round(ox + sw, 3)}" y1="${round(top, 3)}" x2="${round(ox, 3)}" y2="${round(top - sh, 3)}" stroke="#b5482f" stroke-width="${hair * 1.5}"/>`;
  s += `<text x="${round(ox + (bb.x0 + bb.x1) / 2, 3)}" y="${round(H + fs * 1.4, 3)}" font-size="${round(fs, 3)}" text-anchor="middle" fill="#3a4754">2 · ${cut ? `slide ${esc(shortLen(ana.slideDist, 'up'))}, ` : ''}trim to ${esc(shortLen(tw, 'up'))}×${esc(shortLen(th, 'up'))}</text>`;
  return s + '</svg>';
}
// Panels joined side by side, trimmed to the backing.
function panelsDiagramSvg(o, BW, BH, fab, opts = {}) {
  const n = o.panels || 1, vertical = o.seams !== 'horizontal';
  const across = vertical ? BW : BH, along = vertical ? BH : BW, pw = o.width ? Math.min(o.width, across) : across / n;
  const total = n * pw - (n - 1) * 2 * BACK_SEAM;
  const W = vertical ? Math.max(total, BW) : BW, H = vertical ? BH : Math.max(total, BH);
  const pad = Math.max(W, H) * 0.06, fs = Math.max(W, H) * 0.04, hair = Math.max(W, H) * 0.004;
  const fill = fabricFill(fab), light = mix(fabricHex(fab), '#ffffff', 0.55);
  let s = `<svg class="${opts.cls || 'back-diag'}" viewBox="${round(-pad, 3)} ${round(-pad, 3)} ${round(W + 2 * pad, 3)} ${round(H + 2 * pad + fs * 2, 3)}" width="${opts.width || 220}" font-family="system-ui,sans-serif">`;
  for (let k = 0; k < n; k++) {
    const o0 = k * (pw - 2 * BACK_SEAM);
    s += vertical ? `<rect x="${round(o0, 3)}" y="0" width="${round(pw, 3)}" height="${round(along, 3)}" fill="${light}" stroke="#2b3a4a" stroke-width="${hair}"/>`
      : `<rect x="0" y="${round(o0, 3)}" width="${round(along, 3)}" height="${round(pw, 3)}" fill="${light}" stroke="#2b3a4a" stroke-width="${hair}"/>`;
  }
  s += `<rect x="0" y="0" width="${round(BW, 3)}" height="${round(BH, 3)}" fill="${fill}" fill-opacity=".85" stroke="#1f3a5f" stroke-width="${hair * 2.5}"/>`;
  for (let k = 1; k < n; k++) {
    const v = round(k * (pw - 2 * BACK_SEAM) + BACK_SEAM, 3);
    s += vertical ? `<line x1="${v}" y1="0" x2="${v}" y2="${round(BH, 3)}" stroke="#b5482f" stroke-width="${hair * 1.5}" stroke-dasharray="${hair * 6} ${hair * 4}"/>`
      : `<line x1="0" y1="${v}" x2="${round(BW, 3)}" y2="${v}" stroke="#b5482f" stroke-width="${hair * 1.5}" stroke-dasharray="${hair * 6} ${hair * 4}"/>`;
  }
  s += `<text x="${round(W / 2, 3)}" y="${round(H + fs * 1.4, 3)}" font-size="${round(fs, 3)}" text-anchor="middle" fill="#3a4754">${n > 1 ? `${n} panels, ` : ''}trim to ${esc(shortLen(BW, 'up'))}×${esc(shortLen(BH, 'up'))}</text>`;
  return s + '</svg>';
}
function backingDiagramSvg(bk, opt = bk.chosen, opts = {}) {
  const fab = doc.layout.backing?.fabric || doc.layout.background;
  return opt.ana && opt.kind !== 'piece-panels' ? slideDiagramSvg(opt.ana, fab, opts) : panelsDiagramSvg(opt, bk.w, bk.h, fab, opts);
}
