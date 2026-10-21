/* Saved projects in this browser. Each save keeps the whole design (and its tracing pictures) under
   a name, with a small picture, in IndexedDB, which holds far more than localStorage. The design
   you're working on is still autosaved separately; these are the named copies you choose to keep. */

const PROJECT_DB = 'quiltthing', PROJECT_STORE = 'projects';
let _projectDb = null;
function projectDb() {
  if (_projectDb) return _projectDb;
  _projectDb = new Promise((res, rej) => {
    const rq = indexedDB.open(PROJECT_DB, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return _projectDb;
}
async function projectTx(mode, fn) {
  const db = await projectDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(PROJECT_STORE, mode), st = tx.objectStore(PROJECT_STORE);
    const rq = fn(st);
    tx.oncomplete = () => res(rq?.result);
    tx.onerror = () => rej(tx.error);
  });
}
const listProjects = () => projectTx('readonly', st => st.getAll()).then(l => (l || []).sort((a, b) => b.savedAt - a.savedAt));
const getProject = id => projectTx('readonly', st => st.get(id));
const putProject = rec => projectTx('readwrite', st => st.put(rec));
const deleteProject = id => projectTx('readwrite', st => st.delete(id));

// A small picture of the quilt for the Open list.
function projectThumb() {
  return new Promise(resolve => {
    try {
      const Q = buildQuilt(), k = 180 / Math.max(Q.W, Q.H), W = Math.round(Q.W * k), H = Math.round(Q.H * k);
      flatFills = true;
      let svg;
      try { svg = quiltSvg(Q, { idp: 'th', size: [W, H] }); } finally { flatFills = false; }
      const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url); resolve(c.toDataURL('image/png')); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch { resolve(null); }
  });
}
async function saveProjectAs(name, id = uid('proj')) {
  doc.meta.title = name;
  const Q = buildQuilt(), thumb = await projectThumb();
  await putProject({ id, name, savedAt: Date.now(), size: fmtSize(Q.W, Q.H), thumb, doc: JSON.parse(snapshot()), refs: refsFor(Object.keys(doc.blocks)) });
  ui.projectId = id; saveUi();
  commit(); saveNow(); render();
  toast(`Saved “${name}”`);
}

// File › Save: back into the same saved copy, or ask for a name the first time.
Actions.saveBrowser = async () => {
  const cur = ui.projectId && await getProject(ui.projectId).catch(() => null);
  if (cur) await saveProjectAs(doc.meta.title || cur.name, cur.id).catch(err => toast(`Couldn't save: ${err.message}`));
  else Actions.saveBrowserAs();
};
Actions.saveBrowserAs = () => {
  openModal(`<h2>Save in this browser</h2><label class="f">Name<input type="text" id="save-name" value="${esc(doc.meta.title === 'Untitled quilt' ? '' : doc.meta.title)}" placeholder="My quilt"></label>
    <p class="hint">Saved copies stay in this browser. To move a quilt to another computer, use File, Download project file.</p>
    <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="saveBrowserAsOk">Save</button></div>`);
  setTimeout(() => $('#save-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') Actions.saveBrowserAsOk(); }), 40);
};
Actions.saveBrowserAsOk = () => {
  const name = $('#save-name')?.value.trim() || 'My quilt';
  closeModal();
  saveProjectAs(name).catch(err => toast(`Couldn't save: ${err.message}`));
};

// File › Open: the saved copies, newest first.
Actions.openBrowser = async () => {
  const list = await listProjects().catch(() => []);
  const when = t => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  openModal(`<h2>Open a saved quilt</h2>
    ${list.length ? `<div class="proj-list">${list.map(p => `<div class="proj${p.id === ui.projectId ? ' current' : ''}">
      <button class="proj-open" data-act="openSaved" data-arg="${p.id}" title="Open ${esc(p.name)}">${p.thumb ? `<img src="${p.thumb}" alt="">` : '<span class="proj-noimg"></span>'}</button>
      <div class="proj-meta"><b>${esc(p.name)}</b><span class="muted">${esc(p.size || '')} · saved ${esc(when(p.savedAt))}</span></div>
      <div class="proj-acts"><button class="btn small primary" data-act="openSaved" data-arg="${p.id}">Open</button><button class="btn small quiet" data-act="renameSaved" data-arg="${p.id}">Rename</button><button class="btn small quiet danger" data-act="deleteSaved" data-arg="${p.id}">Delete</button></div></div>`).join('')}</div>`
      : '<p class="hint">No saved quilts yet. Use File, Save to keep one here.</p>'}
    <div class="actions"><button class="btn" data-act="openProject">Open a file from your computer…</button><button class="btn" data-act="closeModal">Close</button></div>`);
  $('#modal-root .modal').classList.add('wide');
};
Actions.openSaved = async id => {
  const rec = await getProject(id);
  if (!rec) return;
  const go = () => {
    closeModal();
    if (rec.refs) { Object.assign(refImgs, rec.refs); saveRefs(); }
    doc = upgradeDoc(JSON.parse(JSON.stringify(rec.doc)));
    ui.projectId = rec.id; sanitizeUi();
    resetHistory(); saveNow(); render();
    toast(`Opened “${rec.name}”`);
  };
  // the open design is autosaved, but it's replaced: check it's kept somewhere first
  const cur = ui.projectId && await getProject(ui.projectId).catch(() => null);
  if (cur && JSON.stringify(cur.doc) === snapshot()) go();
  else confirmModal('Open this quilt?', `The design you have open now${cur ? ' has changes that aren\'t saved' : ' isn\'t saved in this browser'}. Opening “${esc(rec.name)}” replaces it.`, 'Open', go);
};
Actions.renameSaved = async id => {
  const rec = await getProject(id); if (!rec) return;
  openModal(`<h2>Rename</h2><label class="f">Name<input type="text" id="rename-saved" value="${esc(rec.name)}"></label>
    <div class="actions"><button class="btn" data-act="openBrowser">Cancel</button><button class="btn primary" data-act="renameSavedOk" data-arg="${id}">Rename</button></div>`);
};
Actions.renameSavedOk = async id => {
  const rec = await getProject(id), name = $('#rename-saved')?.value.trim();
  if (rec && name) { rec.name = name; rec.doc.meta.title = name; await putProject(rec); if (ui.projectId === id) { doc.meta.title = name; commit(); } }
  Actions.openBrowser();
};
Actions.deleteSaved = async id => {
  const rec = await getProject(id); if (!rec) return;
  confirmModal('Delete this saved quilt?', `“${esc(rec.name)}” is removed from this browser. This can't be undone.`, 'Delete', async () => {
    await deleteProject(id);
    if (ui.projectId === id) { ui.projectId = null; saveUi(); }
    Actions.openBrowser();
  }, true);
};
