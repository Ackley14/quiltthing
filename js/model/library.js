/* Block library. Presets are authored as real piecing layouts (each region is a piece a
   quilter would cut), so their cut lists and sewing steps come out right.
   Fabric "slots": 0 = quilt background, 1..5 = the palette's 1st..5th non-background fabric. */

const LIB_CATEGORIES = [
  ['all', 'All'], ['classic', 'Classic'], ['star', 'Stars'], ['tri', 'Geese & triangles'],
  ['strip', 'Strips & logs'], ['curve', 'Curves'], ['modern', 'Modern & pictures'], ['app', 'Appliqué'],
];

const LIBRARY = (() => {
  const L = [];
  const add = (id, name, cat, n, regions, extra = {}) => L.push({ id, name, cat, n, regions, ...extra });

  // ----- builders (grid units) -----
  const R = (x1, y1, x2, y2, s) => ({ pts: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], s });
  const P = (pts, s, b) => (b ? { pts, s, b } : { pts, s });
  const C = (x, y, s) => ({ tl: [x, y], tr: [x + s, y], br: [x + s, y + s], bl: [x, y + s] });
  // half-square triangle unit; triangle A contains `corner`
  const HST = (x, y, s, corner, sA, sB) => {
    const k = C(x, y, s);
    const halves = {
      tl: [[k.tl, k.tr, k.bl], [k.tr, k.br, k.bl]],
      tr: [[k.tl, k.tr, k.br], [k.tl, k.br, k.bl]],
      br: [[k.tr, k.br, k.bl], [k.tl, k.tr, k.bl]],
      bl: [[k.tl, k.br, k.bl], [k.tl, k.tr, k.br]],
    }[corner];
    return [P(halves[0], sA), P(halves[1], sB)];
  };
  // quarter-square triangle unit; fabrics [top, right, bottom, left]
  const QST = (x, y, s, f) => {
    const k = C(x, y, s), c = [x + s / 2, y + s / 2];
    return [P([k.tl, k.tr, c], f[0]), P([k.tr, k.br, c], f[1]), P([k.br, k.bl, c], f[2]), P([k.bl, k.tl, c], f[3])];
  };
  // flying-goose unit in rect; dir = where the goose points
  const GOOSE = (x, y, w, h, dir, g, sky) => {
    const tl = [x, y], tr = [x + w, y], br = [x + w, y + h], bl = [x, y + h];
    const tm = [x + w / 2, y], bm = [x + w / 2, y + h], lm = [x, y + h / 2], rm = [x + w, y + h / 2];
    const m = {
      up: [[bl, br, tm], [tl, tm, bl], [tm, tr, br]],
      down: [[tl, tr, bm], [tl, bm, bl], [tr, br, bm]],
      right: [[tl, rm, bl], [tl, tr, rm], [bl, rm, br]],
      left: [[tr, br, lm], [tl, tr, lm], [lm, br, bl]],
    }[dir];
    return [P(m[0], g), P(m[1], sky), P(m[2], sky)];
  };
  // stitch-and-flip ("snowball") square: main fabric with corner triangles of leg `leg`
  const SNOW = (x, y, s, leg, main, cornerFab, corners) => {
    const k = C(x, y, s);
    const pts = [];
    const tri = [];
    const step = {
      tl: [[x, y + leg], [x + leg, y]], tr: [[x + s - leg, y], [x + s, y + leg]],
      br: [[x + s, y + s - leg], [x + s - leg, y + s]], bl: [[x + leg, y + s], [x, y + s - leg]],
    };
    for (const c of ['tl', 'tr', 'br', 'bl']) {
      if (corners.includes(c)) { pts.push(...step[c]); tri.push(P([k[c], ...step[c]], cornerFab)); }
      else pts.push(k[c]);
    }
    return [P(pts, main), ...tri];
  };
  // four-patch unit
  const FOUR = (x, y, s, a, b) => [R(x, y, x + s / 2, y + s / 2, a), R(x + s / 2, y, x + s, y + s / 2, b), R(x, y + s / 2, x + s / 2, y + s, b), R(x + s / 2, y + s / 2, x + s, y + s, a)];
  // bulge that makes the arc A→B bow away from point P
  const away = (A, B, Pt, mag = QUARTER_BULGE) => {
    const dx = B[0] - A[0], dy = B[1] - A[1], nx = -dy, ny = dx;
    const mx = (A[0] + B[0]) / 2 - Pt[0], my = (A[1] + B[1]) / 2 - Pt[1];
    return nx * mx + ny * my > 0 ? mag : -mag;
  };
  // quarter-circle pie radius r at corner of square (x,y,s)
  const PIE = (x, y, s, corner, r, f) => {
    const k = C(x, y, s), o = k[corner];
    const sx = corner === 'tl' || corner === 'bl' ? 1 : -1, sy = corner === 'tl' || corner === 'tr' ? 1 : -1;
    const A = [o[0] + sx * r, o[1]], B = [o[0], o[1] + sy * r];
    return P([o, A, B], f, [0, away(A, B, o), 0]);
  };
  const polar = (c, r, deg) => [c[0] + r * Math.cos(deg * Math.PI / 180), c[1] + r * Math.sin(deg * Math.PI / 180)];

  /* ===== Classic ===== */
  add('four-patch', 'Four Patch', 'classic', 2, [R(0, 0, 1, 1, 1), R(1, 0, 2, 1, 0), R(0, 1, 1, 2, 0), R(1, 1, 2, 2, 1)]);
  add('nine-patch', 'Nine Patch', 'classic', 3,
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => R(i % 3, Math.floor(i / 3), i % 3 + 1, Math.floor(i / 3) + 1, i % 2 === 0 ? 1 : 0)));
  add('sixteen-patch', 'Sixteen Patch', 'classic', 4,
    Array.from({ length: 16 }, (_, i) => R(i % 4, Math.floor(i / 4), i % 4 + 1, Math.floor(i / 4) + 1, (i % 4 + Math.floor(i / 4)) % 2 ? 4 : 1)));
  add('double-four-patch', 'Double Four Patch', 'classic', 4,
    [...FOUR(0, 0, 2, 1, 0), R(2, 0, 4, 2, 4), R(0, 2, 2, 4, 4), ...FOUR(2, 2, 2, 1, 0)]);
  add('irish-chain', 'Irish Chain', 'classic', 5, Array.from({ length: 25 }, (_, i) => {
    const c = i % 5, r = Math.floor(i / 5);
    const s = (c === r || c + r === 4) ? 1 : ((c === 2 && (r === 0 || r === 4)) || (r === 2 && (c === 0 || c === 4))) ? 2 : 0;
    return R(c, r, c + 1, r + 1, s);
  }));
  add('churn-dash', 'Churn Dash', 'classic', 6, [
    ...HST(0, 0, 2, 'tl', 0, 1), ...HST(4, 0, 2, 'tr', 0, 1), ...HST(4, 4, 2, 'br', 0, 1), ...HST(0, 4, 2, 'bl', 0, 1),
    R(2, 0, 4, 1, 0), R(2, 1, 4, 2, 1), R(2, 4, 4, 5, 1), R(2, 5, 4, 6, 0),
    R(0, 2, 1, 4, 0), R(1, 2, 2, 4, 1), R(4, 2, 5, 4, 1), R(5, 2, 6, 4, 0), R(2, 2, 4, 4, 0)]);
  add('shoo-fly', 'Shoo Fly', 'classic', 3, [
    ...HST(0, 0, 1, 'tl', 0, 3), ...HST(2, 0, 1, 'tr', 0, 3), ...HST(2, 2, 1, 'br', 0, 3), ...HST(0, 2, 1, 'bl', 0, 3),
    R(1, 0, 2, 1, 0), R(0, 1, 1, 2, 0), R(2, 1, 3, 2, 0), R(1, 2, 2, 3, 0), R(1, 1, 2, 2, 3)]);
  add('jacobs-ladder', "Jacob's Ladder", 'classic', 6, [
    ...FOUR(0, 0, 2, 1, 0), ...HST(2, 0, 2, 'tr', 0, 2), ...FOUR(4, 0, 2, 1, 0),
    ...HST(0, 2, 2, 'tr', 0, 2), ...FOUR(2, 2, 2, 1, 0), ...HST(4, 2, 2, 'tr', 0, 2),
    ...FOUR(0, 4, 2, 1, 0), ...HST(2, 4, 2, 'tr', 0, 2), ...FOUR(4, 4, 2, 1, 0)]);
  add('snowball', 'Snowball', 'classic', 3, SNOW(0, 0, 3, 1, 3, 0, ['tl', 'tr', 'br', 'bl']));
  add('bow-tie', 'Bow Tie', 'classic', 4, [
    R(0, 0, 2, 2, 1), ...SNOW(2, 0, 2, 1, 0, 1, ['bl']), ...SNOW(0, 2, 2, 1, 0, 1, ['tr']), R(2, 2, 4, 4, 1)]);
  add('square-in-square', 'Square in a Square', 'classic', 4, [
    P([[0, 0], [2, 0], [0, 2]], 0), P([[2, 0], [4, 0], [4, 2]], 0), P([[4, 2], [4, 4], [2, 4]], 0), P([[0, 2], [2, 4], [0, 4]], 0),
    P([[1, 1], [2, 0], [3, 1]], 1), P([[3, 1], [4, 2], [3, 3]], 1), P([[3, 3], [2, 4], [1, 3]], 1), P([[1, 3], [0, 2], [1, 1]], 1),
    R(1, 1, 3, 3, 2)], { seams: [] });
  add('diamond-in-square', 'Diamond in a Square', 'classic', 2, [
    P([[0, 0], [1, 0], [0, 1]], 0), P([[1, 0], [2, 0], [2, 1]], 0), P([[2, 1], [2, 2], [1, 2]], 0), P([[0, 1], [1, 2], [0, 2]], 0),
    P([[1, 0], [2, 1], [1, 2], [0, 1]], 1)]);
  add('hourglass', 'Hourglass', 'classic', 1, QST(0, 0, 1, [1, 0, 1, 0]));
  add('hst', 'Half-Square Triangle', 'classic', 1, HST(0, 0, 1, 'tl', 1, 0));
  add('plain', 'Plain Square', 'classic', 1, [R(0, 0, 1, 1, 1)]);

  /* ===== Stars ===== */
  add('sawtooth-star', 'Sawtooth Star', 'star', 4, [
    R(0, 0, 1, 1, 0), R(3, 0, 4, 1, 0), R(0, 3, 1, 4, 0), R(3, 3, 4, 4, 0),
    ...GOOSE(1, 0, 2, 1, 'down', 0, 1), ...GOOSE(3, 1, 1, 2, 'left', 0, 1),
    ...GOOSE(1, 3, 2, 1, 'up', 0, 1), ...GOOSE(0, 1, 1, 2, 'right', 0, 1), R(1, 1, 3, 3, 2)]);
  add('ohio-star', 'Ohio Star', 'star', 3, [
    R(0, 0, 1, 1, 0), R(2, 0, 3, 1, 0), R(0, 2, 1, 3, 0), R(2, 2, 3, 3, 0),
    ...QST(1, 0, 1, [0, 1, 2, 1]), ...QST(2, 1, 1, [1, 0, 1, 2]), ...QST(1, 2, 1, [2, 1, 0, 1]), ...QST(0, 1, 1, [1, 2, 1, 0]),
    R(1, 1, 2, 2, 2)]);
  add('friendship-star', 'Friendship Star', 'star', 3, [
    R(0, 0, 1, 1, 0), R(2, 0, 3, 1, 0), R(0, 2, 1, 3, 0), R(2, 2, 3, 3, 0),
    ...HST(1, 0, 1, 'bl', 1, 0), ...HST(2, 1, 1, 'tl', 1, 0), ...HST(1, 2, 1, 'tr', 1, 0), ...HST(0, 1, 1, 'br', 1, 0),
    R(1, 1, 2, 2, 1)]);
  add('pinwheel', 'Pinwheel', 'star', 2, [
    ...HST(0, 0, 1, 'tr', 1, 0), ...HST(1, 0, 1, 'br', 1, 0), ...HST(1, 1, 1, 'bl', 1, 0), ...HST(0, 1, 1, 'tl', 1, 0)]);
  add('dutchmans-puzzle', "Dutchman's Puzzle", 'star', 8, [
    ...GOOSE(0, 0, 4, 2, 'up', 1, 0), ...GOOSE(0, 2, 4, 2, 'up', 3, 0),
    ...GOOSE(4, 0, 2, 4, 'right', 1, 0), ...GOOSE(6, 0, 2, 4, 'right', 3, 0),
    ...GOOSE(4, 4, 4, 2, 'down', 3, 0), ...GOOSE(4, 6, 4, 2, 'down', 1, 0),
    ...GOOSE(2, 4, 2, 4, 'left', 1, 0), ...GOOSE(0, 4, 2, 4, 'left', 3, 0)]);
  {
    // LeMoyne star: eight 45° diamonds, corner squares and side triangles (set-in seams)
    const n = 4, c = [2, 2], d = n / (2 + Math.SQRT2), tip = d * 2 * Math.cos(Math.PI / 8);
    const regs = [];
    for (let k = 0; k < 8; k++) {
      const a = 22.5 + k * 45;
      regs.push(P([c, polar(c, d, a - 22.5), polar(c, tip, a), polar(c, d, a + 22.5)].map(p => p.map(v => round(v, 6))), k % 2 ? 1 : 3));
    }
    const q = d * Math.SQRT1_2;
    regs.push(R(2 + q, 2 + q, 4, 4, 0), R(0, 2 + q, 2 - q, 4, 0), R(0, 0, 2 - q, 2 - q, 0), R(2 + q, 0, 4, 2 - q, 0));
    for (let k = 0; k < 4; k++) {
      const a = k * 90;
      regs.push(P([polar(c, d, a), polar(c, tip, a + 22.5), polar(c, tip, a - 22.5)].map(p => p.map(v => round(v, 6))), 0));
    }
    add('lemoyne-star', 'LeMoyne Star', 'star', n, regs);
  }

  /* ===== Geese & triangles ===== */
  add('flying-geese', 'Flying Geese', 'tri', 4, [
    ...[0, 1, 2, 3].flatMap(r => GOOSE(0, r, 2, 1, 'up', [1, 2, 3, 4][r], 0)),
    ...[0, 1, 2, 3].flatMap(r => GOOSE(2, r, 2, 1, 'up', [3, 4, 1, 2][r], 0))]);
  add('chevron', 'Chevron', 'tri', 4, (() => {
    const stripe = k => [1, 0, 2, 0, 1][k];
    const out = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out.push(...HST(c, r, 1, c < 2 ? 'tr' : 'tl', stripe(r), stripe(r + 1)));
    return out;
  })());
  add('hst-zigzag', 'Zigzag', 'tri', 4, (() => {
    const out = [];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) out.push(...HST(c, r, 1, c % 2 ? 'tl' : 'tr', r % 2 ? 0 : 3, r % 2 ? 3 : 0));
    return out;
  })());
  add('broken-dishes', 'Broken Dishes', 'tri', 2, [
    ...HST(0, 0, 1, 'bl', 1, 0), ...HST(1, 0, 1, 'tl', 1, 0), ...HST(1, 1, 1, 'tr', 1, 0), ...HST(0, 1, 1, 'br', 1, 0)]);

  /* ===== Strips & logs ===== */
  add('rail-fence', 'Rail Fence', 'strip', 3, [R(0, 0, 3, 1, 1), R(0, 1, 3, 2, 2), R(0, 2, 3, 3, 3)]);
  {
    const logs = [], courthouse = [];
    let box = [3, 3, 4, 4];
    logs.push(R(...box, 3));
    const sides = ['r', 'b', 'l', 't'];
    for (let k = 0; k < 12; k++) {
      const [x1, y1, x2, y2] = box, s = sides[k % 4], light = Math.floor(k / 2) % 2 === 0;
      const f = light ? 0 : 1;
      if (s === 'r') { logs.push(R(x2, y1, x2 + 1, y2, f)); box = [x1, y1, x2 + 1, y2]; }
      if (s === 'b') { logs.push(R(x1, y2, x2, y2 + 1, f)); box = [x1, y1, x2, y2 + 1]; }
      if (s === 'l') { logs.push(R(x1 - 1, y1, x1, y2, f)); box = [x1 - 1, y1, x2, y2]; }
      if (s === 't') { logs.push(R(x1, y1 - 1, x2, y1, f)); box = [x1, y1 - 1, x2, y2]; }
    }
    add('log-cabin', 'Log Cabin', 'strip', 7, logs);
    box = [3, 3, 4, 4];
    courthouse.push(R(...box, 3));
    for (let k = 0; k < 6; k++) {
      const [x1, y1, x2, y2] = box;
      if (k % 2 === 0) { courthouse.push(R(x1, y1 - 1, x2, y1, 0), R(x1, y2, x2, y2 + 1, 0)); box = [x1, y1 - 1, x2, y2 + 1]; }
      else { courthouse.push(R(x1 - 1, y1, x1, y2, 1), R(x2, y1, x2 + 1, y2, 1)); box = [x1 - 1, y1, x2 + 1, y2]; }
    }
    add('courthouse-steps', 'Courthouse Steps', 'strip', 7, courthouse);
  }
  add('roman-stripe', 'Roman Stripe', 'strip', 4, [
    P([[0, 0], [1, 0], [0, 1]], 1), P([[1, 0], [2, 0], [0, 2], [0, 1]], 2), P([[2, 0], [3, 0], [0, 3], [0, 2]], 3),
    P([[3, 0], [4, 0], [0, 4], [0, 3]], 4), P([[4, 0], [4, 4], [0, 4]], 0)]);
  add('strip-set', 'Strip Set', 'strip', 5, [1, 2, 3, 4, 5].map((s, i) => R(i, 0, i + 1, 5, s)));

  /* ===== Curves ===== */
  add('drunkards-path', "Drunkard's Path", 'curve', 4, [R(0, 0, 4, 4, 2), PIE(0, 0, 4, 'tl', 3, 1)]);
  add('drunkards-circle', "Drunkard's Circle", 'curve', 8, [
    R(0, 0, 8, 8, 0), PIE(0, 0, 4, 'br', 3, 1), PIE(4, 0, 4, 'bl', 3, 1), PIE(4, 4, 4, 'tl', 3, 1), PIE(0, 4, 4, 'tr', 3, 1)],
  { seams: [[[4, 0], [4, 8]], [[0, 4], [8, 4]]] });
  add('drunkards-wave', "Drunkard's Wave", 'curve', 8, [
    R(0, 0, 8, 8, 0), PIE(0, 0, 4, 'tl', 3, 1), PIE(4, 0, 4, 'br', 3, 1), PIE(4, 4, 4, 'tl', 3, 1), PIE(0, 4, 4, 'br', 3, 1)],
  { seams: [[[4, 0], [4, 8]], [[0, 4], [8, 4]]] });
  add('rainbow', 'Rainbow Arcs', 'curve', 4, [R(0, 0, 4, 4, 0), PIE(0, 0, 4, 'bl', 3.5, 1), PIE(0, 0, 4, 'bl', 2.5, 2), PIE(0, 0, 4, 'bl', 1.5, 3), PIE(0, 0, 4, 'bl', 0.75, 4)]);

  /* ===== Modern & pictures ===== */
  add('plus', 'Plus', 'modern', 5, [
    R(0, 0, 5, 1, 0), R(0, 4, 5, 5, 0), R(0, 1, 1, 4, 0), R(4, 1, 5, 4, 0),
    R(1, 1, 2, 2, 0), R(3, 1, 4, 2, 0), R(1, 3, 2, 4, 0), R(3, 3, 4, 4, 0),
    R(2, 1, 3, 4, 3), R(1, 2, 2, 3, 3), R(3, 2, 4, 3, 3)]);
  add('house', 'House', 'modern', 8, [
    P([[0, 0], [4, 0], [0, 4]], 0), P([[4, 0], [8, 0], [8, 4]], 0), P([[0, 4], [4, 0], [8, 4]], 3),
    R(0, 4, 3, 5, 5), R(0, 5, 1, 6, 5), R(1, 5, 2, 6, 2), R(2, 5, 3, 6, 5), R(0, 6, 3, 8, 5),
    R(3, 4, 5, 5, 5), R(3, 5, 5, 8, 1),
    R(5, 4, 8, 5, 5), R(5, 5, 6, 6, 5), R(6, 5, 7, 6, 2), R(7, 5, 8, 6, 5), R(5, 6, 8, 8, 5)]);
  add('heart', 'Heart', 'modern', 4, [
    ...HST(0, 0, 1, 'tl', 0, 3), ...HST(1, 0, 1, 'tr', 0, 3), ...HST(2, 0, 1, 'tl', 0, 3), ...HST(3, 0, 1, 'tr', 0, 3),
    R(0, 1, 4, 2, 3),
    ...HST(0, 2, 1, 'bl', 0, 3), R(1, 2, 3, 3, 3), ...HST(3, 2, 1, 'br', 0, 3),
    R(0, 3, 1, 4, 0), ...HST(1, 3, 1, 'bl', 0, 3), ...HST(2, 3, 1, 'br', 0, 3), R(3, 3, 4, 4, 0)]);
  add('arrow', 'Arrow', 'modern', 4, [
    ...GOOSE(0, 0, 4, 2, 'up', 1, 0), R(0, 2, 1, 4, 0), R(1, 2, 3, 4, 1), R(3, 2, 4, 4, 0)]);
  add('wonky-cross', 'Cross Roads', 'modern', 6, [
    R(0, 0, 2, 2, 0), R(2, 0, 4, 2, 4), R(4, 0, 6, 2, 0),
    R(0, 2, 2, 4, 4), R(2, 2, 4, 4, 2), R(4, 2, 6, 4, 4),
    R(0, 4, 2, 6, 0), R(2, 4, 4, 6, 4), R(4, 4, 6, 6, 0)]);

  /* ===== Appliqué ===== */
  {
    const lens = P([[0, 0], [4, 4]], 1, [QUARTER_BULGE, QUARTER_BULGE]); lens.app = true;
    add('orange-peel', 'Orange Peel', 'app', 4, [R(0, 0, 4, 4, 0), lens]);
    const dot = P([[0.75, 2], [3.25, 2]], 3, [1, 1]); dot.app = true;
    add('circle', 'Circle', 'app', 4, [R(0, 0, 4, 4, 0), dot]);
    const hex = P(Array.from({ length: 6 }, (_, k) => polar([2, 2], 1.5, -90 + k * 60).map(v => round(v, 6))), 4); hex.app = true;
    add('hexagon', 'Hexagon', 'app', 4, [R(0, 0, 4, 4, 0), hex]);
  }
  return L;
})();

// Map library slots onto the project's fabrics: slot k → k-th non-background fabric (cycling).
function slotFabric(slot) {
  if (!slot) return BG;
  const others = doc.fabrics.filter(f => f.id !== doc.layout.background);
  if (!others.length) return BG;
  return others[(slot - 1) % others.length].id;
}
function instantiatePreset(p) {
  const block = newDrawnBlock(p.name, p.n);
  block.regions = p.regions.map(r => {
    const reg = { pts: r.pts.map(q => [q[0], q[1]]), fab: slotFabric(r.s) };
    if (r.b) reg.b = r.b.slice();
    if (r.app) reg.app = true;
    return reg;
  });
  block.seams = (p.seams || []).map(s => s.map(q => q.slice()));
  block.src = p.id;
  return block;
}
const _previewCache = new Map();
function presetPreviewBlock(p) {
  const key = p.id + '|' + doc.fabrics.map(f => f.id).join(',') + '|' + doc.layout.background;
  if (!_previewCache.has(key)) { if (_previewCache.size > 200) _previewCache.clear(); _previewCache.set(key, { ...instantiatePreset(p), id: 'preview-' + p.id }); }
  return _previewCache.get(key);
}
