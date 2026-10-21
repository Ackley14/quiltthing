/* Document state, undo/redo history and persistence.
   `doc` is the undoable, saved, exportable project. `ui` holds view state (not undoable). */

const STORE_DOC = 'quiltthing.v3.doc';
const STORE_UI = 'quiltthing.v3.ui';
const BG = 'bg';   // pseudo-fabric id meaning "the quilt background fabric"

let doc = null;
let ui = null;

const PRINT_KINDS = ['solid', 'dots', 'speckle', 'stripes', 'gingham', 'mottled', 'floral'];

function makeFabric(color, name, print) {
  return {
    id: uid('f'),
    name: name || colorName(color),
    color: normHex(color) || '#888888',
    print: { kind: 'solid', color2: mix(color, '#ffffff', 0.55), scale: 1, ...(print || {}) },
    directional: false,
  };
}

function defaultFabrics() {
  return [
    makeFabric('#f3ead8', 'Cream'),
    makeFabric('#1f3a5f', 'Navy'),
    makeFabric('#e0a930', 'Mustard'),
    makeFabric('#b5482f', 'Rust'),
    makeFabric('#8fa98b', 'Sage', { kind: 'speckle', color2: '#6f8a6b', scale: 1 }),
    makeFabric('#e9b7a9', 'Blush', { kind: 'dots', color2: '#ffffff', scale: 0.75 }),
  ];
}

function newDoc() {
  const fabrics = defaultFabrics();
  const [cream, navy, mustard, rust, sage] = fabrics.map(f => f.id);
  return {
    app: 'quiltthing',
    version: 3,
    meta: { title: 'Untitled quilt', designer: '', description: '', skill: 'auto' },
    fabrics,
    blocks: {},
    blockOrder: [],
    layout: {
      mode: 'grid',
      blockSize: 12,
      background: cream,
      grid: { rows: 4, cols: 4, cells: Array(16).fill(null),
        sashing: { width: 0, fabric: cream, cornerstones: false, cornerFabric: mustard, outer: false } },
      onpoint: { rows: 3, cols: 3, cells: {}, fill: cream },
      tess: { shape: 'hex', size: 3, ratio: 0.5, lean: 0.5, orient: 0, width: 48, height: 60,
        edge: 'trim', fill: cream, base: sage, colors: {}, blocks: {}, seed: 1, snap: true, faces: null, cutEdges: false },
      borders: [],
      binding: { width: 2.25, fabric: navy },
      backing: { fabric: null },
      panels: [],             // inset panels: framed squares set into the centre (any setting)
    },
    quilting: { layers: [] },
    cutting: { seam: 0.25, wof: 42, extra: 10, roundTo: 'eighth', backingWidth: 42, overhang: 4, appMethod: 'turned', defaultFormat: { kind: 'yardage' } },
    stash: [],
  };
}

function defaultUi() {
  return {
    view: 'block',
    units: 'in',
    activeBlock: null,
    fabric: null,           // selected fabric id (paint colour)
    tool: 'paint',
    selRegion: null,
    selEdge: null,          // {r, e}
    drawing: [],            // in-progress polygon (grid coords)
    placeRot: 0,
    placeFlip: false,
    selCell: null,          // layout cell key
    seamLines: false,
    showPieces: false,
    grayscale: false,
    showQuilting: false,
    libCat: 'all',
    libSearch: '',
    collapsed: {},
    tessPaintSet: null,     // fabric ids used by tile fill patterns
    patternPage: 'letter',
    seenTour: false,
  };
}

/* ---------- lookups ---------- */
function fabricById(id) {
  if (id === BG) id = doc.layout.background;
  return doc.fabrics.find(f => f.id === id) || doc.fabrics[0];
}
function resolveFab(id) { return id === BG ? doc.layout.background : id; }
function fabricIndex(id) { return doc.fabrics.findIndex(f => f.id === resolveFab(id)); }
function activeBlock() { return doc.blocks[ui.activeBlock] || null; }

/* ---------- history ---------- */
const undoStack = { past: [], future: [], current: null, max: 200 };
let onDocChanged = () => {};          // set by the app shell (re-render + caches)

function snapshot() { return JSON.stringify(doc); }
// Called whenever the project is replaced, so it also forgets pictures of blocks that are gone.
function resetHistory() { undoStack.past = []; undoStack.future = []; undoStack.current = snapshot(); pruneRefs(); }

// Record the current doc as a new history step (no-op if nothing changed).
function commit() {
  const s = snapshot();
  if (s === undoStack.current) { onDocChanged(false); return; }
  if (undoStack.current !== null) undoStack.past.push(undoStack.current);
  if (undoStack.past.length > undoStack.max) undoStack.past.shift();
  undoStack.future = [];
  undoStack.current = s;
  scheduleSave();
  onDocChanged(true);
}
function undo() {
  if (!undoStack.past.length) return false;
  undoStack.future.push(undoStack.current);
  undoStack.current = undoStack.past.pop();
  doc = JSON.parse(undoStack.current);
  sanitizeUi();
  scheduleSave();
  onDocChanged(true);
  return true;
}
function redo() {
  if (!undoStack.future.length) return false;
  undoStack.past.push(undoStack.current);
  undoStack.current = undoStack.future.pop();
  doc = JSON.parse(undoStack.current);
  sanitizeUi();
  scheduleSave();
  onDocChanged(true);
  return true;
}

// Keep UI references valid after undo/import/delete.
function sanitizeUi() {
  if (!doc.blocks[ui.activeBlock]) ui.activeBlock = doc.blockOrder[0] || null;
  if (!doc.fabrics.some(f => f.id === ui.fabric)) ui.fabric = doc.fabrics[1]?.id || doc.fabrics[0]?.id;
  const b = activeBlock();
  if (!b || b.kind !== 'drawn' || !b.regions[ui.selRegion]) { ui.selRegion = null; ui.selEdge = null; }
  ui.selRegions = (ui.selRegions || []).filter(i => b?.kind === 'drawn' && b.regions[i]);
  ui.drawing = [];
}

/* ---------- persistence ---------- */
let saveStatus = { at: null, ok: true };
const scheduleSave = debounce(saveNow, 400);
function saveNow() {
  try {
    localStorage.setItem(STORE_DOC, snapshot());
    saveStatus = { at: Date.now(), ok: true };
  } catch (e) {
    saveStatus = { at: Date.now(), ok: false };
    console.warn('save failed', e);
  }
}
const saveUi = debounce(() => {
  try { localStorage.setItem(STORE_UI, JSON.stringify({ ...ui, drawing: [] })); } catch {}
}, 300);

/* ---------- reference pictures ----------
   Tracing pictures behind blocks in the editor, keyed by block id. Kept out of `doc` so big
   images don't bloat the undo history; saved in their own storage slot and carried inside
   project and block files. { src (JPEG data URL), ar (width ÷ height), op, sc, dx, dy, on } */
const STORE_REFS = 'quiltthing.v3.refs';
let refImgs = {};
function loadRefs() {
  try { refImgs = JSON.parse(localStorage.getItem(STORE_REFS) || '{}') || {}; } catch { refImgs = {}; }
}
function saveRefs() {
  try { localStorage.setItem(STORE_REFS, JSON.stringify(refImgs)); return true; } catch (e) { console.warn('picture save failed', e); return false; }
}
const saveRefsSoon = debounce(saveRefs, 400);
function pruneRefs() {
  const before = Object.keys(refImgs).length;
  for (const id of Object.keys(refImgs)) if (!doc.blocks[id]) delete refImgs[id];
  if (Object.keys(refImgs).length !== before) saveRefs();
}
const refsFor = ids => Object.fromEntries(ids.filter(id => refImgs[id]).map(id => [id, refImgs[id]]));

function loadStored() {
  loadRefs();
  let d = null, u = null;
  try { d = JSON.parse(localStorage.getItem(STORE_DOC) || 'null'); } catch {}
  try { u = JSON.parse(localStorage.getItem(STORE_UI) || 'null'); } catch {}
  return { d: validDoc(d) ? d : null, u };
}
function validDoc(d) {
  return d && d.app === 'quiltthing' && d.version === 3 && Array.isArray(d.fabrics) && d.fabrics.length && d.layout && d.blocks;
}
// Fill any fields added after a project was saved, so older v3 files keep loading.
function upgradeDoc(d) {
  // inset panels used to belong to tessellations only
  if (d.layout && !d.layout.panels && d.layout.tess?.panels) d.layout.panels = d.layout.tess.panels;
  if (d.layout?.tess) delete d.layout.tess.panels;
  const base = newDoc();
  for (const k of Object.keys(base)) if (d[k] === undefined) d[k] = base[k];
  for (const k of Object.keys(base.layout)) if (d.layout[k] === undefined) d.layout[k] = base.layout[k];
  for (const k of Object.keys(base.cutting)) if (d.cutting[k] === undefined) d.cutting[k] = base.cutting[k];
  for (const k of Object.keys(base.layout.tess)) if (d.layout.tess[k] === undefined) d.layout.tess[k] = base.layout.tess[k];
  const g = d.layout.grid;
  if (!Array.isArray(g.cells) || g.cells.length !== g.rows * g.cols) g.cells = Array(g.rows * g.cols).fill(null);
  if (!d.layout.grid.sashing.outer) d.layout.grid.sashing.outer = false;
  return d;
}

function exportProject() {
  const name = slugify(doc.meta.title) + '.quilt.json';
  const refs = refsFor(Object.keys(doc.blocks));
  const out = Object.keys(refs).length ? { ...doc, refImages: refs } : doc;
  downloadBlob(name, new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
}
function parseProjectFile(text) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error("That file isn't valid JSON."); }
  if (!validDoc(d)) {
    if (d && (d.version === 1 || d.version === 2)) throw new Error('This design was saved by an older version of Quilt Designer (v1/v2), which version 3 no longer opens.');
    throw new Error("That doesn't look like a Quilt Designer v3 project file.");
  }
  if (d.refImages) { Object.assign(refImgs, d.refImages); delete d.refImages; saveRefs(); }
  return upgradeDoc(d);
}
