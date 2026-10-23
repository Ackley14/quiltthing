/* App entry: load the saved project (or the sample), wire history to rendering. */

/* ---------- sample quilts ---------- */
// "Midnight Bullseye": a straight set showing library blocks recoloured, a custom curved block
// turned four ways into a bullseye, borders, quilting and a backing.
// A sample (or a new blank quilt) just as it was started, with nothing done to it since. It isn't
// listed in My quilts until it's changed. Its fingerprint is taken when it's started (the undo
// history can't tell: it isn't always stored).
const isPristineSample = () => !!ui?.sampleSig && hashStr(snapshot()) === ui.sampleSig && !Object.keys(refImgs).length && !undoStack.past.length && !undoStack.future.length;
function loadSampleProject() {
  leaveQuilt();
  doc = newDoc();
  doc.fabrics = [
    makeFabric('#1c2541', 'Midnight'),
    makeFabric('#f3ead8', 'Cream'),
    makeFabric('#e3a83a', 'Mustard'),
    makeFabric('#b5482f', 'Rust'),
    makeFabric('#2f7f86', 'Teal', { kind: 'speckle', color2: '#235f65', scale: 1 }),
    makeFabric('#e9b7a9', 'Blush', { kind: 'dots', color2: '#ffffff', scale: 0.75 }),
  ];
  const [mid, cream, mustard, rust, teal, blush] = doc.fabrics.map(f => f.id);
  doc.layout.background = mid;
  // settings this sample doesn't use still need fabrics from its palette
  Object.assign(doc.layout.grid.sashing, { fabric: cream, cornerFabric: mustard });
  doc.layout.onpoint.fill = mid; Object.assign(doc.layout.tess, { fill: cream, base: teal });
  const lib = id => LIBRARY.find(p => p.id === id);
  // library blocks come in the palette's order (slot 1 = cream, 2 = mustard, 3 = rust); recolour copies
  const recolor = (b, name, map) => { b.name = name; for (const r of b.regions) r.fab = map[r.fab] ?? r.fab; return b; };
  const starA = recolor(instantiatePreset(lib('sawtooth-star')), 'Cream Star', { [mustard]: rust });
  const starB = recolor(instantiatePreset(lib('sawtooth-star')), 'Gold Star', { [cream]: mustard, [mustard]: teal });
  const lemoyne = recolor(instantiatePreset(lib('lemoyne-star')), 'Corner LeMoyne', { [cream]: mustard, [rust]: cream });
  // a quarter bullseye: three pieced quarter-circle rings in one corner
  const quarter = newDrawnBlock('Bullseye Quarter', 4);
  const pie = (r, fab) => ({ pts: [[0, 0], [r, 0], [0, r]], b: [0, -QUARTER_BULGE, 0], fab });
  quarter.regions = [pie(3.6, rust), pie(2.6, mustard), pie(1.6, cream)];
  for (const b of [quarter, starA, starB, lemoyne]) addBlockToDoc(b, false);
  const g = doc.layout.grid;
  const at = (r, c) => r * 4 + c;
  g.cells = Array(16).fill(null);
  for (const [r, c] of [[0, 0], [0, 3], [3, 0], [3, 3]]) g.cells[at(r, c)] = { b: lemoyne.id, r: 0, f: false };
  // the four quarters turn so their rings meet in the middle
  for (const [r, c, rot] of [[1, 1, 2], [1, 2, 3], [2, 1, 1], [2, 2, 0]]) g.cells[at(r, c)] = { b: quarter.id, r: rot, f: false };
  [[0, 1, starA], [0, 2, starB], [1, 3, starA], [2, 3, starB], [3, 2, starA], [3, 1, starB], [2, 0, starA], [1, 0, starB]]
    .forEach(([r, c, b]) => { g.cells[at(r, c)] = { b: b.id, r: 0, f: false }; });
  doc.layout.borders = [{ width: 1, fabric: mustard }, { width: 5, fabric: teal }];
  doc.layout.binding.fabric = rust;
  doc.layout.backing = { fabric: blush };
  doc.quilting.layers = [
    { ...newQuiltLayer('ditch'), color: '#9fb3c8' },
    { ...newQuiltLayer('circles'), area: 'center', spacing: 1.5, color: '#f2b134' },
    { ...newQuiltLayer('wavy'), area: 'borders', spacing: 1.25, amp: 0.5, wave: 3, color: '#f3ead8' },
  ];
  doc.meta = { title: 'Midnight Bullseye', designer: '', description: 'A curved-pieced bullseye in rust, mustard and cream glows in a midnight sky, ringed by sawtooth stars in two colourways with LeMoyne stars in the corners. Concentric quilting ripples out from the centre.', skill: 'auto' };
  ui.activeBlock = ui.placeBlock = quarter.id; ui.fabric = mustard; ui.view = 'layout'; ui.layoutTool = 'place';
  ui.selCell = null; ui.selRegion = null;
  resetHistory(); ui.sampleSig = hashStr(snapshot()); enterQuilt(); saveNow(); render();
}

// "Hexie Bloom": a hexagon tessellation with colour rings, custom hexagon blocks, an inset panel
// holding appliqué lettering, edge pieces cut to shape, and area-specific quilting.
async function loadTessSample() {
  const font = await loadFont('lobster');
  leaveQuilt();
  doc = newDoc();
  doc.fabrics = [
    makeFabric('#f6efe2', 'Linen'),
    makeFabric('#2f7f86', 'Teal'),
    makeFabric('#8fa98b', 'Sage', { kind: 'speckle', color2: '#6f8a6b', scale: 1 }),
    makeFabric('#e3a83a', 'Mustard'),
    makeFabric('#e07a5f', 'Coral'),
    makeFabric('#6d3b5e', 'Plum'),
    makeFabric('#f2c4b3', 'Peach', { kind: 'dots', color2: '#ffffff', scale: 0.75 }),
  ];
  const [linen, teal, sage, mustard, coral, plum, peach] = doc.fabrics.map(f => f.id);
  doc.layout.background = linen;
  Object.assign(doc.layout.grid.sashing, { fabric: linen, cornerFabric: mustard });
  doc.layout.onpoint.fill = linen; doc.layout.tess.fill = linen;
  const t = doc.layout.tess;
  Object.assign(t, { shape: 'hex', size: 3, orient: 0, width: 54, height: 60, edge: 'trim', cutEdges: true, base: sage, colors: {}, blocks: {}, snap: true, faces: null });
  const h = TRI_H, P = pts => pts.map(([x, y]) => [round(x, 6), round(y, 6)]);
  // a six-pointed star on the 60° lattice: centre hexagon and six points
  const star = newDrawnBlock('Hexie Star', 6, 'hex');
  const ctr = P([[2, 3], [2.5, 3 - h], [3.5, 3 - h], [4, 3], [3.5, 3 + h], [2.5, 3 + h]]);
  const apex = P([[3, 3 - 2 * h], [4.5, 3 - h], [4.5, 3 + h], [3, 3 + 2 * h], [1.5, 3 + h], [1.5, 3 - h]]);
  star.regions = [{ pts: ctr, fab: mustard }, ...apex.map((a, i) => ({ pts: [ctr[(i + 1) % 6], a, ctr[(i + 2) % 6]], fab: coral }))];
  // a 3D cube: three diamonds meeting in the middle
  const cube = newDrawnBlock('Hexie Cube', 6, 'hex');
  const V = hexFrame(6), C = [3, 3];
  cube.regions = [{ pts: [C, V[0], V[1], V[2]], fab: mustard }, { pts: [C, V[2], V[3], V[4]], fab: coral }, { pts: [C, V[4], V[5], V[0]], fab: plum }];
  // the panel: "Bloom" in appliqué lettering on teal
  const bloom = newDrawnBlock('Bloom', 12);
  bloom.regions = [{ pts: [[0, 0], [12, 0], [12, 12], [0, 12]], fab: teal }];
  for (const b of [star, cube, bloom]) addBlockToDoc(b, false);
  const tid = uid('t');
  bloom.texts = { [tid]: { str: 'Bloom', font: 'lobster', h: 2.6 } };
  bloom.regions.push(...textRegions(font, 'Bloom', 2.6 / (doc.layout.blockSize / 12), [6, 6.3], mustard).regions.map(r => ({ ...r, txt: tid })));
  const sg = seamSuggestions(star);
  star.seams = [...sg.required, ...sg.optional];
  doc.layout.panels = [{ id: uid('p'), size: 15, dx: 0, dy: 0, b: bloom.id, r: 0, f: false, fab: null, frames: [{ width: 0.75, fabric: mustard }, { width: 1.25, fabric: plum }] }];
  doc.layout.mode = 'tess';
  // colour rings radiating from the panel, then hexagon blocks scattered through them
  ui.tessPaintSet = [teal, sage, peach, linen];
  _Q = null;
  const Q0 = buildQuilt(), R0 = rng(5), cx = Q0.W / 2, cy = Q0.H / 2;
  for (const tile of Q0.tiles.filter(x => x.tkey)) {
    const [x, y] = centroid(tile.pts), ring = Math.floor(Math.hypot(x - cx, y - cy) / (t.size * 1.5));
    t.colors[tile.tkey] = ui.tessPaintSet[(ring + (R0() < 0.15 ? 1 : 0)) % 4];
  }
  const R = rng(11);
  for (const tile of buildQuilt().tiles.filter(x => x.tkey && x.whole)) {
    const v = R();
    if (v < 0.14) setCellContent(tile.key, { b: star.id, r: 0, f: false });
    else if (v < 0.2) setCellContent(tile.key, { b: cube.id, r: Math.floor(R() * 3) * 2, f: false });
  }
  doc.layout.borders = [{ width: 1, fabric: plum }, { width: 4.5, fabric: sage }];
  doc.layout.binding.fabric = plum;
  doc.layout.backing = { fabric: peach };
  doc.quilting.layers = [
    { ...newQuiltLayer('ditch'), color: '#6d3b5e' },
    { ...newQuiltLayer('echo'), area: 'aroundPanel', spacing: 0.5, echoes: 2, color: '#e07a5f' },
    { ...newQuiltLayer('circles'), area: 'panel', spacing: 1, color: '#e3a83a' },
    { ...newQuiltLayer('zigzag'), area: 'borders', spacing: 1, amp: 0.4, wave: 2, color: '#2f7f86' },
  ];
  doc.meta = { title: 'Hexie Bloom', designer: '', description: 'Hexagons ripple out in rings of teal, sage and peach from a framed "Bloom" panel, sprinkled with pieced hexie stars and 3D cubes. The edge pieces are cut to shape, and the panel and the hexagons are quilted differently.', skill: 'auto' };
  ui.activeBlock = ui.placeBlock = star.id; ui.fabric = coral; ui.view = 'layout'; ui.layoutTool = 'place'; ui.selCell = null; ui.selRegion = null;
  resetHistory(); ui.sampleSig = hashStr(snapshot()); enterQuilt(); saveNow(); render();
}

// A new blank quilt. The one that was open is saved and stays in My quilts.
function startBlank() {
  leaveQuilt();
  ui.snapOff = false;
  doc = newDoc();
  addBlockToDoc(newDrawnBlock('My first block'));
  ui.view = 'block'; ui.tool = 'rect'; ui.fabric = doc.fabrics[1].id;
  resetHistory(); ui.sampleSig = hashStr(snapshot()); enterQuilt(); saveNow(); render();
}
Actions.welcomeBlank = () => { closeModal(); startBlank(); };
// A new quilt that starts with a block from the library.
Actions.welcomeClassic = () => {
  closeModal();
  leaveQuilt();
  doc = newDoc(); ui.activeBlock = ui.placeBlock = null; ui.view = 'block'; ui.fabric = doc.fabrics[1].id;
  resetHistory(); ui.sampleSig = hashStr(snapshot()); enterQuilt(); saveNow(); render();
  Actions.libraryPicker();
};

function init() {
  const { d, u } = loadStored();
  ui = { ...defaultUi(), ...(u || {}), drawing: [] };
  if (ui.view === 'cutting') { ui.view = 'fabric'; ui.fabPane = 'cut'; }   // Cutting is now part of Fabric & cutting
  if (!Views[ui.view]) ui.view = 'layout';
  onDocChanged = () => { _Q = null; render(); };
  if (d) {
    doc = upgradeDoc(d);
    sanitizeUi();
    resetHistory();
    restoreHistory();
    render();
    projectsStart();   // find (or make) its record in My quilts
  } else {
    loadSampleProject();
  }
  if (!prefs.welcomed) welcomeV4();
  // keep the "Saved" indicator fresh after debounced saves
  setInterval(renderSaveState, 1500);
  // the canvas area changes size when panels open, close or are resized, not only with the window
  new ResizeObserver(debounce(refitCanvas, 120)).observe($('#docwrap'));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
