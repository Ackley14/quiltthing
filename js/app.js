/* App entry: load the saved project (or the sample), wire history to rendering. */

function loadSampleProject() {
  doc = newDoc();
  const lib = id => LIBRARY.find(p => p.id === id);
  const star = instantiatePreset(lib('sawtooth-star'));
  const churn = instantiatePreset(lib('churn-dash'));
  const peel = instantiatePreset(lib('drunkards-path'));
  for (const b of [star, churn, peel]) addBlockToDoc(b, false);
  const [, navy, , rust, sage] = doc.fabrics.map(f => f.id);
  doc.layout.grid.cells = doc.layout.grid.cells.map((_, i) => {
    const r = Math.floor(i / 4), c = i % 4;
    return { b: (r + c) % 2 ? churn.id : star.id, r: 0, f: false };
  });
  doc.layout.borders = [{ width: 1.5, fabric: rust }, { width: 5, fabric: sage }];
  doc.layout.binding.fabric = navy;
  doc.quilting.layers = [
    { ...newQuiltLayer('ditch'), color: '#2471a3' },
    { ...newQuiltLayer('crosshatch'), area: 'center', spacing: 3, color: '#c0392b' },
    { ...newQuiltLayer('wavy'), area: 'borders', spacing: 1.5, color: '#1e8449' },
  ];
  doc.meta = { title: 'Starry Churn', designer: '', description: 'Sawtooth stars and churn dashes alternate in a classic checkerboard, framed by a narrow rust border and a wide sage one.', skill: 'auto' };
  ui.activeBlock = star.id;
  ui.fabric = navy;
  ui.view = 'layout';
  ui.selCell = null; ui.selRegion = null;
  resetHistory(); saveNow(); render();
}

function welcome() {
  openModal(`<h2>Welcome to Quilt Designer</h2>
    <p>Design a quilt from first block to printed pattern. Everything is saved in this browser as you go.</p>
    <div class="welcome-steps">
      <div><b>Blocks</b>Draw blocks on a grid or start from 40+ classics.</div>
      <div><b>Layout</b>Grid, on point, or tessellated shapes like hexagons and lightning bolts.</div>
      <div><b>Quilting</b>Plan stitching lines — crosshatch, waves, spirals…</div>
      <div><b>Fabric & cutting</b>Yardage, cutting charts and stash checks.</div>
      <div><b>Pattern</b>Print a full step-by-step PDF pattern.</div>
    </div>
    <p class="hint">We've loaded a sample quilt to explore. Press <b>?</b> any time for help and shortcuts.</p>
    <div class="actions"><button class="btn" data-act="welcomeBlank">Start blank</button><button class="btn primary" data-act="closeModal">Explore the sample</button></div>`, () => { ui.seenTour = true; saveUi(); });
}
Actions.welcomeBlank = () => {
  closeModal();
  doc = newDoc();
  addBlockToDoc(newDrawnBlock('My first block'));
  ui.view = 'block'; ui.tool = 'rect'; ui.fabric = doc.fabrics[1].id;
  resetHistory(); saveNow(); render();
};

function init() {
  const { d, u } = loadStored();
  ui = { ...defaultUi(), ...(u || {}), drawing: [] };
  if (!Views[ui.view]) ui.view = 'layout';
  onDocChanged = () => { _Q = null; render(); };
  if (d) {
    doc = upgradeDoc(d);
    sanitizeUi();
    resetHistory();
    render();
  } else {
    loadSampleProject();
  }
  if (!ui.seenTour) welcome();
  // keep the "Saved" indicator fresh after debounced saves
  setInterval(() => { const el = $('.save-dot'); if (el && saveStatus.at) el.textContent = saveStatus.ok ? 'Saved' : 'Not saved!'; }, 1500);
  window.addEventListener('resize', debounce(() => { if (ui.view === 'pattern') Views.pattern.afterMain($('#main')); }, 150));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
