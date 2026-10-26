/* My quilts: every quilt is kept in this browser, in IndexedDB (far roomier than localStorage), with
   a small picture. The open quilt belongs to one record (ui.projectId) and saves into it about a
   second after each change, and when the page is hidden or closed. A new blank quilt or a sample
   gets its record only once it's changed, so untouched ones don't fill the list. Nothing replaces
   anything: New quilt, a sample, a quilt from the list or a project file just switch to it.
   The open design is still written to localStorage (quiltthing.v3.doc) on every change, for crash
   safety and for v3; quiltthing.v4.open says which record that design belongs to. */

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
  _projectDb.catch(() => { _projectDb = null; });   // try again next time
  return _projectDb;
}
async function projectTx(mode, fn) {
  const db = await projectDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(PROJECT_STORE, mode), st = tx.objectStore(PROJECT_STORE);
    const rq = fn(st);
    tx.oncomplete = () => res(rq?.result);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('The save was cancelled.'));
  });
}
const listProjects = () => projectTx('readonly', st => st.getAll()).then(l => (l || []).sort((a, b) => b.savedAt - a.savedAt));
const getProject = id => projectTx('readonly', st => st.get(id));
const putProject = rec => projectTx('readwrite', st => st.put(rec));
const deleteProject = id => projectTx('readwrite', st => st.delete(id));

/* ---------- pictures for the list ---------- */
// Drawn now (it needs the quilt as it is), turned into a PNG later.
function thumbSvg() {
  try {
    const Q = buildQuilt(), k = 180 / Math.max(Q.W, Q.H), W = Math.round(Q.W * k), H = Math.round(Q.H * k);
    flatFills = true;
    try { return { svg: quiltSvg(Q, { idp: 'th', size: [W, H] }), W, H, size: fmtSize(Q.W, Q.H) }; } finally { flatFills = false; }
  } catch { return null; }
}
function rasterThumb(t) {
  return new Promise(resolve => {
    if (!t) return resolve(null);
    const img = new Image(), url = URL.createObjectURL(new Blob([t.svg], { type: 'image/svg+xml' }));
    img.onload = () => { const c = document.createElement('canvas'); c.width = t.W; c.height = t.H; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, t.W, t.H); x.drawImage(img, 0, 0, t.W, t.H); URL.revokeObjectURL(url); resolve(c.toDataURL('image/png')); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* ---------- the open quilt's record ---------- */
const SAVE_DELAY = 1000, THUMB_EVERY = 30000;
const TAB_ID = uid('tab');
// listed: its record exists. state: idle (nothing to save yet), pending, saved or failed.
let _proj = { listed: false, state: 'idle', err: '', thumb: null, size: '', thumbSig: null, thumbAt: 0, dirtyWhilePaused: false };
let _projTimer = null, _projChain = Promise.resolve(), _projStarting = false;
const quiltName = () => (doc.meta.title || '').trim() || 'Untitled quilt';
// A quilt with nothing in it (how v3 and older versions started a new one).
const isEmptyQuilt = () => doc.blockOrder.every(id => doc.blocks[id]?.kind === 'drawn' && !doc.blocks[id].regions.length)
  && !doc.layout.borders.length && !doc.quilting.layers.length && !Object.keys(refImgs).length && quiltName() === 'Untitled quilt';
// worth keeping: already in the list, or changed since it was started
const wantsRecord = () => _proj.listed || !isPristineSample();
const errText = err => err?.name === 'QuotaExceededError' ? 'This browser is out of storage space.' : `${(err?.message || 'This browser is blocking storage.').replace(/\.?$/, '.')}`;

// The open quilt is now this record (a new id for a quilt that isn't listed yet).
function enterQuilt(id = uid('proj'), listed = false, rec = null) {
  clearTimeout(_projTimer); _projTimer = null;
  ui.projectId = id;
  _proj = { listed, state: listed ? 'saved' : 'idle', err: '', thumb: rec?.thumb || null, size: rec?.size || '', thumbSig: null, thumbAt: 0, dirtyWhilePaused: false };
  savePaused = false; $('#tab-guard')?.remove();
  if (typeof _savedLibLoaded !== 'undefined') _savedLibLoaded = false;   // My blocks leaves out the open quilt
  saveUi();
  if (typeof renderSaveState === 'function') renderSaveState();
}

// Everything the record needs, taken now. thumb: 'force', 'stale' (if changed), 'auto' (if changed
// and not refreshed for a while) or 'none'.
function captureQuilt(thumb = 'auto') {
  const s = snapshot(), sig = hashStr(s);
  const rec = { id: ui.projectId, name: quiltName(), savedAt: Date.now(), size: _proj.size, thumb: _proj.thumb, doc: JSON.parse(s), refs: refsFor(Object.keys(doc.blocks)) };
  const changed = sig !== _proj.thumbSig;
  const need = thumb === 'force' || (thumb !== 'none' && (!_proj.thumb || (changed && (thumb === 'stale' || Date.now() - _proj.thumbAt > THUMB_EVERY))));
  let t = null;
  if (need) { t = thumbSvg(); _proj.thumbSig = sig; _proj.thumbAt = Date.now(); if (t) { rec.size = _proj.size = t.size; } }
  return { rec, t };
}
// Writes go one after another, so an older version never lands after a newer one.
function writeQuilt(cap) {
  const id = cap.rec.id;
  const job = _projChain.then(async () => {
    if (cap.t) { const url = await rasterThumb(cap.t); if (url) { cap.rec.thumb = url; if (ui.projectId === id) _proj.thumb = url; } }
    else if (ui.projectId === id && _proj.thumb) cap.rec.thumb = _proj.thumb;   // a picture made by an earlier write
    await putProject(cap.rec);
  });
  _projChain = job.catch(() => {});
  return job;
}

// Called on every change (state.js): save about a second after the last one.
function projectSaveSoon() {
  if (savePaused) { _proj.dirtyWhilePaused = true; return; }
  if (!_proj.listed && isPristineSample()) return;
  clearTimeout(_projTimer);
  _projTimer = setTimeout(() => { _projTimer = null; projectSaveNow('auto'); }, SAVE_DELAY);
  if (_proj.state !== 'pending') { _proj.state = 'pending'; renderSaveState(); }
}
onSaveScheduled = projectSaveSoon;

// Save the open quilt into its record now. force: even an untouched new quilt or sample (Ctrl+S).
// Resolves true once it's written.
function projectSaveNow(thumb = 'auto', force = false) {
  clearTimeout(_projTimer); _projTimer = null;
  if (_projStarting) { _projTimer = setTimeout(() => { _projTimer = null; projectSaveNow(thumb, force); }, 200); return Promise.resolve(false); }
  if (savePaused) return Promise.resolve(false);
  if (!force && !wantsRecord()) { if (_proj.state === 'pending') { _proj.state = 'idle'; renderSaveState(); } return Promise.resolve(false); }
  if (!ui.projectId) { ui.projectId = uid('proj'); saveUi(); }
  const cap = captureQuilt(thumb), id = cap.rec.id;
  if (_proj.state !== 'pending') { _proj.state = 'pending'; renderSaveState(); }
  return writeQuilt(cap).then(() => {
    _projBc?.postMessage({ type: 'saved', id, tab: TAB_ID });
    if (ui.projectId !== id) return true;
    _proj.listed = true;
    if (!_projTimer) { _proj.state = 'saved'; _proj.err = ''; }
    renderSaveState();
    return true;
  }, err => {
    console.warn('quilt save failed', err);
    if (ui.projectId === id) { _proj.state = 'failed'; _proj.err = errText(err); renderSaveState(); }
    else toast(`Couldn't save “${cap.rec.name}”. ${errText(err)}`, 6000);
    return false;
  });
}

// What the app bar shows: paused, failed, pending, saved or idle (nothing to save yet).
function projectSaveState() {
  if (savePaused) return { kind: 'paused' };
  if (_proj.state === 'failed') return { kind: 'failed', why: _proj.err };
  return { kind: _proj.state };
}

// Another quilt is about to open: save this one (with a fresh picture) and let go of it.
// Returns its name if it's in My quilts, so a message can say where it went.
function leaveQuilt() {
  if (!doc || !ui.projectId) return null;
  let name = null;
  if (savePaused) {
    // another tab saved this quilt: keep this tab's changes too, as a copy
    if (_proj.dirtyWhilePaused) {
      savePaused = false;
      const cap = captureQuilt('force');
      cap.rec.id = uid('proj'); cap.rec.name = cap.rec.doc.meta.title = `Copy of ${cap.rec.name}`;
      writeQuilt(cap).catch(err => toast(`Couldn't save “${cap.rec.name}”. ${errText(err)}`, 6000));
      name = cap.rec.name;
    }
  } else if (wantsRecord()) { projectSaveNow('stale'); name = quiltName(); }
  ui.projectId = null; savePaused = false; $('#tab-guard')?.remove();
  return name;
}
const inList = name => name ? ` “${name}” is in My quilts.` : '';

// Open a record (the quilt that was open has already been let go).
function openRecord(rec) {
  if (rec.refs) Object.assign(refImgs, rec.refs);
  doc = upgradeDoc(JSON.parse(JSON.stringify(rec.doc)));
  doc.meta.title = rec.name;
  ui.sampleSig = null;
  sanitizeUi();
  resetHistory();
  enterQuilt(rec.id, true, rec);
  if (rec.thumb) _proj.thumbSig = hashStr(snapshot());
  _qz.layout = { z: 1 }; _qz.quilting = { z: 1 }; ed.zoom = 1;   // a quilt opens fitted
  saveNow(); render();
}

// First load: which record does the design in localStorage belong to? Nothing a person had may
// disappear, so a design with no record (from before every quilt was listed) gets one.
async function projectsStart() {
  let open = null;
  try { open = JSON.parse(localStorage.getItem(STORE_OPEN) || 'null'); } catch {}
  // trusted: written together with this exact design (v3 doesn't know about it)
  const trusted = !!open?.id && open.sig === hashStr(localStorage.getItem(STORE_DOC) || '');
  const cand = open?.id || ui.projectId;
  _projStarting = true;
  let rec = null;
  try { rec = cand ? await getProject(cand) : null; }
  catch (err) { _projStarting = false; enterQuilt(cand || undefined, false); _proj.state = 'failed'; _proj.err = errText(err); renderSaveState(); return; }
  _projStarting = false;
  // without the marker, only a record with the same name is taken to be this design
  if (rec && (trusted || rec.name === doc.meta.title || rec.doc?.meta?.title === doc.meta.title)) {
    const same = JSON.stringify(rec.doc) === snapshot();
    // the record is newer (saved later in another tab, or the design was too big for localStorage)
    if (!same && trusted && rec.savedAt > (open.at || 0)) { openRecord(rec); return; }
    for (const [id, r] of Object.entries(rec.refs || {})) if (!refImgs[id] && doc.blocks[id]) refImgs[id] = r;
    enterQuilt(rec.id, true, rec);
    if (!trusted) saveNow();
    if (!same) projectSaveNow('stale');   // changes that didn't reach it before the page closed
    return;
  }
  enterQuilt(trusted && !rec ? open.id : undefined, false);
  saveNow();   // remember the id with the design
  if (!isPristineSample() && !isEmptyQuilt()) projectSaveNow('force');
}

// leaving the page: write what's waiting (a picture too while the page is only hidden)
window.addEventListener('pagehide', () => { if (_projTimer) projectSaveNow('none'); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && ui?.projectId && (_projTimer || (_proj.listed && hashStr(snapshot()) !== _proj.thumbSig))) projectSaveNow('stale');
});

/* ---------- two tabs ---------- */
const _projBc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('quiltthing.quilts') : null;
if (_projBc) _projBc.onmessage = e => {
  const m = e.data || {};
  if (m.tab === TAB_ID || !ui) return;
  if (m.type === 'saved' && m.id === ui.projectId && _proj.listed) otherTabChanged();
};
// Saving here stops, so this tab doesn't write over the other one's work until the person chooses.
function otherTabChanged() {
  _proj.dirtyWhilePaused = !!_projTimer;   // changes here that hadn't been written yet
  clearTimeout(_projTimer); _projTimer = null;
  savePaused = true;
  let bar = $('#tab-guard');
  if (!bar) { bar = document.createElement('div'); bar.id = 'tab-guard'; bar.setAttribute('role', 'status'); document.body.appendChild(bar); }
  bar.innerHTML = `${icon('warn', 16)}<span>This quilt was changed in another tab. Reload it?</span><button class="btn small primary" data-act="tabGuardLoad">Reload</button><button class="btn small" data-act="tabGuardKeep">Keep this version</button>`;
  renderSaveState();
}
Actions.tabGuardLoad = async () => {
  const rec = await getProject(ui.projectId).catch(() => null);
  savePaused = false; $('#tab-guard')?.remove();
  if (rec) { openRecord(rec); toast(`Reloaded “${rec.name}”`); } else renderSaveState();
};
Actions.tabGuardKeep = () => { $('#tab-guard')?.remove(); savePaused = false; saveNow(); saveRefs(); projectSaveNow('none', true); toast('Saving this version again'); };

/* ---------- File menu actions ---------- */
// Ctrl+S: people press it out of habit. Save now and say so.
Actions.saveQuilt = async () => {
  if (savePaused) { toast('Saving is paused because this quilt was changed in another tab'); return; }
  const f = document.activeElement;   // a name being typed in the title counts
  if (f?.matches?.('input[data-bind]')) f.dispatchEvent(new Event('change', { bubbles: true }));
  saveNow();
  const ok = await projectSaveNow('stale', true);
  toast(ok ? 'Saved' : `Couldn't save. ${_proj.err} Download a project file to keep this quilt.`, ok ? 1200 : 6000);
};

// File › My quilts: every quilt, newest first.
Actions.openBrowser = async () => {
  // the open quilt's picture up to date
  if (ui.projectId && _proj.listed && !savePaused && (_projTimer || hashStr(snapshot()) !== _proj.thumbSig)) await projectSaveNow('stale');
  const list = await listProjects().catch(err => { toast(`Couldn't read My quilts. ${errText(err)}`, 6000); return null; });
  if (!list) return;
  const when = t => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const row = p => {
    const cur = p.id === ui.projectId;
    return `<div class="proj${cur ? ' current' : ''}">
      <button class="proj-open" data-act="openSaved" data-arg="${p.id}" title="${cur ? 'Open now' : `Open ${esc(p.name)}`}">${p.thumb ? `<img src="${p.thumb}" alt="">` : '<span class="proj-noimg"></span>'}</button>
      <div class="proj-meta"><b>${esc(p.name)}</b><span class="muted">${p.size ? `${esc(p.size)} · ` : ''}edited ${esc(when(p.savedAt))}</span>${cur ? '<span class="proj-now">Open now</span>' : ''}</div>
      <div class="proj-acts">${cur ? '' : `<button class="btn small primary" data-act="openSaved" data-arg="${p.id}">Open</button>`}<button class="btn small quiet" data-act="renameSaved" data-arg="${p.id}">Rename</button><button class="btn small quiet" data-act="makeCopy" data-arg="${p.id}">Make a copy</button><button class="btn small quiet danger" data-act="deleteSaved" data-arg="${p.id}">Delete</button></div></div>`;
  };
  openModal(`<h2>My quilts</h2>
    ${list.length ? `<div class="proj-list">${list.map(row).join('')}</div>` : '<p class="hint proj-list">Nothing here yet. A quilt is listed here as soon as you change it.</p>'}
    <p class="hint">Your quilts save as you work, in this browser. Clearing this browser's data removes them. Download a project file to back one up or move it to another computer.</p>
    <div class="actions"><button class="btn" data-act="newProject">New quilt</button><button class="btn" data-act="openProject">Open project file…</button><span class="grow"></span><button class="btn" data-act="closeModal">Close</button></div>`);
  $('#modal-root .modal').classList.add('wide');
};
Actions.openSaved = async id => {
  if (id === ui.projectId) { closeModal(); return; }
  const rec = await getProject(id).catch(() => null);
  if (!rec) { toast("Couldn't find that quilt"); return; }
  closeModal();
  const was = leaveQuilt();
  openRecord(rec);
  toast(`Opened “${rec.name}”.${was !== rec.name ? inList(was) : ''}`, was ? 4000 : 2600);
};
Actions.renameSaved = async id => {
  const rec = await getProject(id).catch(() => null); if (!rec) return;
  openModal(`<h2>Rename</h2><label class="f">Name<input type="text" id="rename-saved" value="${esc(rec.name)}"></label>
    <div class="actions"><button class="btn" data-act="openBrowser">Cancel</button><button class="btn primary" data-act="renameSavedOk" data-arg="${id}">Rename</button></div>`);
  setTimeout(() => $('#rename-saved')?.addEventListener('keydown', e => { if (e.key === 'Enter') Actions.renameSavedOk(id); }), 40);
};
Actions.renameSavedOk = async id => {
  const name = $('#rename-saved')?.value.trim();
  if (name && id === ui.projectId) { doc.meta.title = name; commit('Rename quilt'); await projectSaveNow('none'); }
  else if (name) {
    const rec = await getProject(id).catch(() => null);
    if (rec) {
      rec.name = name; rec.doc.meta.title = name;
      await (_projChain = _projChain.then(() => putProject(rec)).then(() => _projBc?.postMessage({ type: 'saved', id, tab: TAB_ID }), err => toast(`Couldn't rename it. ${errText(err)}`)));
    }
  }
  Actions.openBrowser();
};

// File › Make a copy (the open quilt), or Make a copy in the list (any quilt). The copy opens.
Actions.makeCopy = async id => {
  const src = id && id !== ui.projectId ? await getProject(id).catch(() => null) : null;
  const name = src ? src.name : quiltName();
  openModal(`<h2>Make a copy</h2><label class="f">Name of the copy<input type="text" id="copy-name" value="${esc(`Copy of ${name}`)}"></label>
    <p class="hint">The copy opens. “${esc(name)}” stays as it is${src || wantsRecord() ? ' in My quilts' : ''}.</p>
    <div class="actions"><button class="btn" data-act="closeModal">Cancel</button><button class="btn primary" data-act="makeCopyOk" data-arg="${src ? src.id : ''}">Make a copy</button></div>`);
  setTimeout(() => $('#copy-name')?.addEventListener('keydown', e => { if (e.key === 'Enter') Actions.makeCopyOk(src ? src.id : ''); }), 40);
};
Actions.makeCopyOk = async srcId => {
  const typed = $('#copy-name')?.value.trim();
  closeModal();
  let orig, listed;
  if (srcId) {
    const src = await getProject(srcId).catch(() => null); if (!src) return;
    orig = src.name; listed = true;
    leaveQuilt();
    openRecord({ ...src, id: uid('proj'), name: typed || `Copy of ${orig}` });
    _proj.listed = false;
  } else {
    orig = quiltName(); listed = wantsRecord();
    leaveQuilt();
    doc.meta.title = typed || `Copy of ${orig}`;
    ui.sampleSig = null; resetHistory(); enterQuilt();
    saveNow(); render();
  }
  const ok = await projectSaveNow('force', true);
  if (ok) toast(`Now working on ${quiltName()}.${listed ? ` ${orig} is in My quilts.` : ''}`, 4000);
};

Actions.deleteSaved = async id => {
  const open = id === ui.projectId, rec = await getProject(id).catch(() => null);
  if (!rec && !open) return;
  const name = rec?.name || quiltName();
  confirmModal(`Delete “${esc(name)}”?`, open ? "It's removed from this browser. A new blank quilt opens." : "It's removed from this browser. This can't be undone.", 'Delete', async () => {
    if (open) { clearTimeout(_projTimer); _projTimer = null; ui.projectId = null; savePaused = false; }
    try { await (_projChain = _projChain.then(() => deleteProject(id))); } catch (err) { toast(`Couldn't delete it. ${errText(err)}`, 6000); return; }
    _projBc?.postMessage({ type: 'deleted', id, tab: TAB_ID });
    if (open) { startBlank(); toast(`Deleted “${name}”. A new blank quilt is open.`, 3500); }
    else Actions.openBrowser();
  }, true);
};
