/* Quilting lines (v1): generated stitch paths, like toolpaths on a 3-D printer.
   Each layer = a pattern type + spacing + rotation, applied to the whole quilt, just the
   centre, or just the borders. Lines are clipped to the chosen area and measured so the
   pattern can estimate thread. */

const QUILT_TYPES = [
  { key: 'lines', label: 'Straight lines', angle: 90, help: 'Parallel straight lines. 90° = vertical, 0° = horizontal, 45° = diagonal.' },
  { key: 'crosshatch', label: 'Crosshatch', angle: 45, help: 'Two sets of straight lines at right angles, forming squares or diamonds.' },
  { key: 'diamonds', label: 'Diamond hatch', angle: 90, help: 'Two sets of lines 60° apart, forming elongated diamonds.' },
  { key: 'wavy', label: 'Wavy lines', angle: 0, help: 'Gentle parallel waves.', wave: true },
  { key: 'zigzag', label: 'Zigzag / chevron', angle: 0, help: 'Parallel zigzags.', wave: true },
  { key: 'spiral', label: 'Spiral', angle: 0, help: 'One continuous spiral from the centre outward.' },
  { key: 'circles', label: 'Concentric circles', angle: 0, help: 'Rings around the centre ("baptist fan" look when trimmed by the edges).' },
  { key: 'squares', label: 'Concentric squares', angle: 0, help: 'Nested rectangles echoing the quilt outline.' },
  { key: 'ditch', label: 'In the ditch', angle: 0, help: 'Stitches right along the seams between blocks, sashing and borders.', noSpacing: true },
  { key: 'echo', label: 'Echo each block', angle: 0, help: 'Outlines inside every block or tile, repeated inward at the spacing.' },
];
const quiltType = k => QUILT_TYPES.find(t => t.key === k) || QUILT_TYPES[0];

function newQuiltLayer(type = 'crosshatch') {
  const t = quiltType(type);
  return { id: uid('q'), type, spacing: 2, angle: t.angle, area: 'all', amp: 0.75, wave: 4, color: '#c0392b', visible: true, echoes: 2 };
}

function quiltAreaRects(Q, area) {
  const outer = { x: 0, y: 0, w: Q.W, h: Q.H };
  if (area === 'center') return { outer: Q.inner, inner: null };
  if (area === 'borders') return doc.layout.borders.some(b => b.width > 0) ? { outer, inner: Q.inner } : null;
  return { outer, inner: null };
}

// Raw (unclipped) polylines covering a rect, rotated by `angle` about its centre.
function parallelLines(R, spacing, angle, shape = 'line', amp = 0, wave = 4) {
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
  const half = Math.hypot(R.w, R.h) / 2 + spacing + amp;
  const a = angle * Math.PI / 180;
  const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;   // line direction & normal
  const out = [];
  const n = Math.ceil(half / spacing);
  for (let k = -n; k <= n; k++) {
    const o = k * spacing;
    const pts = [];
    if (shape === 'line') {
      pts.push([cx + nx * o - ux * half, cy + ny * o - uy * half], [cx + nx * o + ux * half, cy + ny * o + uy * half]);
    } else {
      const step = shape === 'zigzag' ? wave / 2 : wave / 16;
      for (let t = -half; t <= half + 1e-9; t += step) {
        let d;
        if (shape === 'zigzag') d = (Math.round((t + half) / step) % 2 ? amp : -amp);
        else d = amp * Math.sin(2 * Math.PI * t / wave);
        pts.push([cx + nx * (o + d) + ux * t, cy + ny * (o + d) + uy * t]);
      }
    }
    out.push(pts);
  }
  return out;
}

function quiltLayerPaths(Q, layer) {
  const A = quiltAreaRects(Q, layer.area);
  if (!A) return [];
  const R = A.outer, sp = Math.max(0.25, +layer.spacing || 2);
  const cx = R.x + R.w / 2, cy = R.y + R.h / 2, maxR = Math.hypot(R.w, R.h) / 2;
  let raw = [];
  switch (layer.type) {
    case 'lines': raw = parallelLines(R, sp, layer.angle); break;
    case 'crosshatch': raw = [...parallelLines(R, sp, layer.angle), ...parallelLines(R, sp, layer.angle + 90)]; break;
    case 'diamonds': raw = [...parallelLines(R, sp, layer.angle + 30), ...parallelLines(R, sp, layer.angle - 30)]; break;
    case 'wavy': raw = parallelLines(R, sp, layer.angle, 'wave', layer.amp, layer.wave); break;
    case 'zigzag': raw = parallelLines(R, sp, layer.angle, 'zigzag', layer.amp, layer.wave); break;
    case 'spiral': {
      const pts = [];
      const turns = maxR / sp;
      for (let th = 0; th <= turns * Math.PI * 2; th += Math.PI / 36) {
        const r = sp * th / (Math.PI * 2);
        const a = th + layer.angle * Math.PI / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      raw = [pts];
      break;
    }
    case 'circles':
      for (let r = sp; r <= maxR + sp; r += sp) {
        const pts = [];
        const steps = Math.max(24, Math.ceil(r * 6));
        for (let i = 0; i <= steps; i++) { const a = i / steps * Math.PI * 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        raw.push(pts);
      }
      break;
    case 'squares':
      for (let k = 0; ; k++) {
        const ins = sp / 2 + k * sp;
        const w = R.w - 2 * ins, h = R.h - 2 * ins;
        if (w <= 0 || h <= 0) break;
        const pts = rectPts(R.x + ins, R.y + ins, w, h);
        raw.push([...pts, pts[0]]);
      }
      break;
    case 'ditch': {
      const seen = new Set();
      const segs = [];
      const shapes = [...Q.cells.map(c => c.pts), ...Q.tiles.map(t => t.pts), ...Q.patches.map(p => p.pts)];
      for (const s of shapes) for (let i = 0; i < s.length; i++) {
        const a = s[i], b = s[(i + 1) % s.length];
        const k = [ptKey(a), ptKey(b)].sort().join('|');
        if (seen.has(k)) continue;
        seen.add(k);
        // skip the quilt's outer edge — that's the binding, not a ditch
        const onEdge = p => p[0] < 1e-6 || p[1] < 1e-6 || p[0] > Q.W - 1e-6 || p[1] > Q.H - 1e-6;
        if (onEdge(a) && onEdge(b) && (Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6)) continue;
        segs.push([a, b]);
      }
      raw = segs;
      break;
    }
    case 'echo': {
      const shapes = [...Q.cells.map(c => c.pts), ...Q.tiles.filter(t => t.whole).map(t => t.pts)];
      for (const s of shapes) {
        for (let k = 0; k < Math.max(1, layer.echoes || 1); k++) {
          const ins = inflate(s, -(sp / 2 + k * sp));
          if (polyArea(ins) < sp * sp * 0.1 || signedArea(ins) * signedArea(s) <= 0) break;
          raw.push([...ins, ins[0]]);
        }
      }
      break;
    }
  }
  const out = [];
  for (const pl of raw) for (const run of clipPolyline(pl, R, A.inner)) if (run.length > 1) out.push(run);
  return out;
}

function quiltingSvg(Q, layers = doc.quilting.layers, scaleHint = 1) {
  const w = Math.max(Q.W, Q.H) * 0.0022 * scaleHint;
  let s = '<g class="quilting" pointer-events="none" fill="none" stroke-linecap="round" stroke-linejoin="round">';
  for (const L of layers) {
    if (!L.visible) continue;
    const paths = quiltLayerPaths(Q, L);
    const d = paths.map(pl => 'M' + pl.map(([x, y]) => `${round(x, 3)},${round(y, 3)}`).join('L')).join('');
    s += `<path d="${d}" stroke="${L.color}" stroke-width="${round(w, 4)}" stroke-dasharray="${round(w * 3, 4)} ${round(w * 1.6, 4)}"/>`;
  }
  return s + '</g>';
}

function quiltingStats(Q) {
  let total = 0;
  const per = doc.quilting.layers.map(L => {
    const len = sum(quiltLayerPaths(Q, L), polylineLength);
    if (L.visible) total += len;
    return { layer: L, length: len };
  });
  // top + bobbin thread, plus ~15% for starts, stops and travel
  return { per, total, threadYds: total * 2 * 1.15 / 36 };
}

function quiltingInstructions(L) {
  const sp = fmtLen(L.spacing);
  const where = { all: 'across the whole quilt', center: 'in the quilt centre (inside the borders)', borders: 'in the borders only' }[L.area];
  const ang = Math.round(((L.angle % 180) + 180) % 180);
  const dirWord = ang === 90 ? 'vertical' : ang === 0 ? 'horizontal' : `${ang}°`;
  switch (L.type) {
    case 'lines': return `Stitch ${dirWord} straight lines ${sp} apart ${where}. Mark the first line through the centre with a hera marker or painter's tape, then work outward, alternating stitching direction to prevent drift. A walking foot helps.`;
    case 'crosshatch': return `Stitch a crosshatch ${where}: lines ${sp} apart at ${ang}° and again at ${(ang + 90) % 180}°. Stitch all lines in one direction first, then the second set.`;
    case 'diamonds': return `Stitch a diamond hatch ${where}: two sets of lines ${sp} apart, 60° to each other.`;
    case 'wavy': return `Stitch gentle wavy lines ${sp} apart ${where} (waves about ${fmtLen(L.wave)} long and ${fmtLen(L.amp)} high). Many machines have a serpentine stitch that does this with a walking foot.`;
    case 'zigzag': return `Stitch zigzag lines ${sp} apart ${where}, turning every ${fmtLen(L.wave / 2)}. Pivot with the needle down at each point.`;
    case 'spiral': return `Stitch a continuous spiral ${where}, starting at the centre with turns ${sp} apart. Begin with a small circle, then rotate the quilt as you go — a walking foot and slow speed give smooth curves.`;
    case 'circles': return `Stitch concentric circles ${sp} apart from the centre ${where}. Mark the circles with a string compass or circle template.`;
    case 'squares': return `Stitch nested rectangles ${sp} apart ${where}, starting ${fmtLen(L.spacing / 2)} in from the edge and working inward.`;
    case 'ditch': return `Stitch in the ditch ${where}: sew right in the seam lines between blocks, sashing and borders so the stitches disappear. Do this first to stabilise the quilt.`;
    case 'echo': return `Echo quilt ${where}: stitch ${plural(L.echoes || 1, 'outline')} inside each block or tile, ${sp} apart.`;
  }
  return '';
}
