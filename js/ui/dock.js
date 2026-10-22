/* Docks: the panels around the canvas. Each workspace (step) has its own arrangement of panel
   groups in the left and right docks, an optional bottom dock and floating windows. The layout
   data and every change to it live in dockModel.js; this file draws it and handles the mouse and
   keyboard: tabs, folding, the ⋯ menu, splitters, icon strips with fly-out panels, drag-to-dock
   and floating windows. Layouts are saved in quiltthing.v4.layout. */

const DOCK_KEY = 'quiltthing.v4.layout';
let dockState = (() => {
  try { const s = JSON.parse(localStorage.getItem(DOCK_KEY) || 'null'); if (s && s.version === DOCK_VERSION && s.ws) { for (const L of Object.values(s.ws)) if (L) delete L.__ok; return { seen: [], ...s }; } } catch {}   // stored layouts are always checked again
  return { version: DOCK_VERSION, ws: {}, seen: [] };
})();
if (/[?&]resetLayout\b/.test(location.search)) dockState = { version: DOCK_VERSION, ws: {}, seen: [] };
// session-only state: hidden panels, the open fly-out, the open drawer (small screens), columns the
// window is too narrow for (shown as icon strips until the person expands them), float stacking
const dockSession = { hidden: false, flyout: null, drawer: null, html: new Map(), sig: '', expanded: new Set(), zTop: 30 };
const curWs = () => tabOf(ui.view);
const dockKnown = () => Object.keys(Panels);
function wsLayout(ws = curWs()) {
  if (!dockState.ws[ws] || !dockState.ws[ws].__ok) {
    const L = dockLoad(dockState.ws[ws], DOCK_DEFAULTS[ws] || emptyLayout(), dockKnown(), dockState.seen);
    L.__ok = true; dockState.ws[ws] = L;
  }
  return dockState.ws[ws];
}
function saveDock() {
  try {
    for (const ws of Object.keys(dockState.ws)) for (const id of dockOpenIds(dockState.ws[ws])) if (!dockState.seen.includes(id)) dockState.seen.push(id);
    localStorage.setItem(DOCK_KEY, JSON.stringify(dockState, (k, v) => k === '__ok' ? undefined : v));
  } catch {}
}
function setLayout(L) { L.__ok = true; dockState.ws[curWs()] = L; saveDock(); dockSession.sig = ''; render(); }
const dockLocked = () => !!prefs.lockLayout;
// Narrow windows: side columns start as icon strips (left first) so the canvas keeps its room.
function autoCollapsed(zone, ci) {
  if (dockSession.expanded.has(`${curWs()}|${zone}|${ci}`) || innerWidth <= 900) return false;
  return innerWidth < 1000 || (innerWidth < 1100 && zone === 'left');
}
const colCollapsed = (c, zone, ci) => c.collapsed || autoCollapsed(zone, ci);

/* ---------- drawing ---------- */
const panelTitle = id => Panels[id]?.title || id;
function dockTabHtml(id, active, where) {
  return `<div class="dtab${active ? ' on' : ''}" data-dtab="${id}" ${where}><button class="dtab-b" role="tab" id="dtab-${where.replace(/\D+/g, '-')}-${id}" tabindex="${active ? 0 : -1}" aria-selected="${active}" data-act="dockTab" data-arg="${id}">${esc(panelTitle(id))}</button><button class="dtab-x" data-act="dockClose" data-arg="${id}" aria-label="Close the ${esc(panelTitle(id))} panel" title="Close" tabindex="-1">${icon('x', 12)}</button></div>`;
}
function dockGroupHtml(g, zone, ci, gi, flex) {
  const where = `data-zone="${zone}" data-ci="${ci}" data-gi="${gi}"`;
  return `<section class="dgroup${g.folded ? ' folded' : ''}" ${where} style="${flex}" role="group" aria-label="${esc(g.tabs.map(panelTitle).join(', '))}">
    <div class="dtabs"><div class="dtab-strip" role="tablist" aria-label="${esc(g.tabs.map(panelTitle).join(', '))} panels">${g.tabs.map(id => dockTabHtml(id, id === g.active, where)).join('')}</div>
      ${dockLocked() ? `<span class="dlock" title="Layout locked (Window ▸ Lock layout)">${icon('lock', 12)}</span>` : ''}
      <button class="dbtn" data-act="dockGroupMenu" data-arg="${zone}|${ci}|${gi}" aria-haspopup="menu" aria-label="Panel options" title="Panel options">${icon('more', 14)}</button>
      <button class="dbtn" data-act="dockFold" data-arg="${zone}|${ci}|${gi}" aria-expanded="${!g.folded}" aria-label="${g.folded ? 'Unfold' : 'Fold'}" title="${g.folded ? 'Unfold' : 'Fold'}">${icon(g.folded ? 'right' : 'down', 14)}</button></div>
    ${g.folded ? '' : `<div class="dbody" role="tabpanel" aria-labelledby="dtab-${where.replace(/\D+/g, '-')}-${g.active}" data-host="${g.active}" data-panel="${g.active}"></div>`}</section>`;
}
function dockColumnHtml(c, zone, ci) {
  if (colCollapsed(c, zone, ci)) {
    const ids = c.groups.flatMap(g => g.tabs);
    return `<div class="dstrip" data-zone="${zone}" data-ci="${ci}" role="toolbar" aria-orientation="vertical" aria-label="Collapsed panels">
      <button class="dstrip-b expand" data-act="dockExpand" data-arg="${zone}|${ci}" title="Expand panels" aria-label="Expand panels">${icon(zone === 'left' ? 'right' : 'left', 14)}</button>
      ${ids.map(id => `<button class="dstrip-b" data-act="dockFlyout" data-arg="${id}" aria-pressed="${dockSession.flyout === id}" aria-expanded="${dockSession.flyout === id}" title="${esc(panelTitle(id))}">${icon(Panels[id]?.icon || 'more', 18)}<span>${esc(Panels[id]?.short || panelTitle(id))}</span></button>`).join('')}</div>`;
  }
  let h = '';
  c.groups.forEach((g, gi) => {
    const open = c.groups.filter(x => !x.folded), flex = g.folded ? 'flex:none' : `flex:${(g.h / (open.reduce((s, x) => s + x.h, 0) || 1)).toFixed(4)} 1 0`;
    if (gi) h += `<div class="dsplit-h" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="Height of ${esc(panelTitle(c.groups[gi - 1].active))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(c.groups[gi - 1].h * 100)}" data-split="group" data-zone="${zone}" data-ci="${ci}" data-gi="${gi - 1}"></div>`;
    h += dockGroupHtml(g, zone, ci, gi, flex);
  });
  return `<div class="dcol" data-zone="${zone}" data-ci="${ci}" style="width:${c.w}px">${h}</div>`;
}
function dockSideHtml(zone, cols) {
  if (!cols.length) return '';
  const parts = cols.map((c, ci) => dockColumnHtml(c, zone, ci));
  const sp = ci => `<div class="dsplit-v" role="separator" aria-orientation="vertical" tabindex="0" aria-label="Width of the ${zone} panels" aria-valuemin="${DOCK_MIN.colW}" aria-valuemax="${DOCK_MIN.colMaxW}" aria-valuenow="${cols[ci].w}" data-split="col" data-zone="${zone}" data-ci="${ci}"></div>`;
  // the splitter sits on the canvas side of each column
  return zone === 'left' ? parts.map((p, ci) => p + (colCollapsed(cols[ci], zone, ci) ? '' : sp(ci))).join('') : parts.map((p, ci) => (colCollapsed(cols[ci], zone, ci) ? '' : sp(ci)) + p).join('');
}
// Empty docks offer the panels this workspace usually has, so a closed panel is one click away.
function closedPanelsHtml(zone) {
  const L = wsLayout(), def = DOCK_DEFAULTS[curWs()] || emptyLayout(), open = new Set(dockOpenIds(L));
  const ids = def[zone].flatMap(c => c.groups.flatMap(g => g.tabs)).filter(id => !open.has(id));
  return ids.length ? `<div class="dempty"><p>Closed panels</p>${ids.map(id => `<button class="btn small" data-act="openPanel" data-arg="${id}">${icon(Panels[id]?.icon || 'more', 14)} ${esc(panelTitle(id))}</button>`).join('')}</div>` : '';
}
function dockRender() {
  const L = wsLayout(), hidden = dockSession.hidden;
  const sig = JSON.stringify([curWs(), hidden, dockSession.flyout, L.left, L.right, L.bottom, L.floating.map(({ z, ...f }) => f), prefs.lockLayout, innerWidth < 1000 ? 0 : innerWidth < 1280 ? 1 : 2, [...dockSession.expanded]]);
  if (sig !== dockSession.sig) {
    dockSession.sig = sig; dockSession.html.clear();
    const left = $('#dock-left'), right = $('#dock-right'), bottom = $('#dock-bottom');
    const side = zone => hidden ? '' : L[zone].length ? dockSideHtml(zone, L[zone]) : closedPanelsHtml(zone);
    left.innerHTML = side('left'); right.innerHTML = side('right');
    bottom.innerHTML = hidden || !L.bottom.groups.length ? '' : `<div class="dsplit-b" role="separator" aria-orientation="horizontal" tabindex="0" aria-label="Height of the bottom panels" aria-valuemin="${DOCK_MIN.bottomH}" aria-valuemax="${DOCK_MIN.bottomMaxH}" aria-valuenow="${L.bottom.h}" data-split="bottom"></div><div class="dbottom-row" style="height:${L.bottom.h}px">${L.bottom.groups.map((g, gi) => dockGroupHtml(g, 'bottom', 0, gi, 'flex:1 1 0')).join('')}</div>`;
    left.classList.toggle('empty', !left.innerHTML); right.classList.toggle('empty', !right.innerHTML);
    bottom.classList.toggle('empty', !bottom.innerHTML);
    $('#float-layer').innerHTML = hidden ? '' : L.floating.map((f, fi) => `<div class="dfloat" role="dialog" aria-label="${esc(f.tabs.map(panelTitle).join(', '))}" data-fi="${fi}" style="${(b => `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`)(floatBox(f))};z-index:${30 + (f.z || 0)}">${dockGroupHtml(f, 'float', 0, fi, 'flex:1 1 0').replace('<button class="dbtn" data-act="dockFold"', `<button class="dbtn" data-act="dockFloatClose" data-arg="${fi}" aria-label="Close this window" title="Close this window">${icon('x', 14)}</button><button class="dbtn" data-act="dockFold"`)}<div class="dfloat-grip" data-fgrip="${fi}" aria-hidden="true"></div></div>`).join('');
    const fly = dockSession.flyout && !hidden ? dockFind(L, dockSession.flyout) : null;
    $('#flyout-layer').innerHTML = fly ? `<div class="dflyout ${fly.zone}" role="dialog" aria-label="${esc(panelTitle(dockSession.flyout))}"><div class="dtabs"><div class="dtab-strip"><div class="dtab on"><span class="dtab-l">${esc(panelTitle(dockSession.flyout))}</span></div></div><button class="dbtn" data-act="dockFlyout" data-arg="" aria-label="Close" title="Close">${icon('x', 14)}</button></div><div class="dbody" data-host="${dockSession.flyout}" data-panel="${dockSession.flyout}"></div></div>` : '';
    if (fly) placeFlyout();
    document.body.classList.toggle('panels-hidden', hidden);
    document.body.classList.toggle('layout-locked', !!prefs.lockLayout);
  }
  requestAnimationFrame(markTabOverflow);
  // panel contents: only visible panels, and only when their content changed
  for (const host of $$('[data-host]')) {
    const id = host.dataset.host, P = Panels[id];
    let html;
    try { html = P ? P.render(host) : `<p class="hint pad">This panel isn't available.</p>`; } catch (e) { console.error(e); html = `<p class="hint pad warn">This panel hit a problem: ${esc(e.message)}</p>`; }
    if (dockSession.html.get(host) === html) continue;
    dockSession.html.set(host, html);
    preserveFocus(host, () => { host.innerHTML = html; });
    P?.after?.(host);
  }
}
// a fly-out opens beside its strip button, inside the window
function placeFlyout() {
  const el = $('#flyout-layer .dflyout'), btn = $(`.dstrip-b[data-arg="${CSS.escape(dockSession.flyout || '')}"]`);
  if (!el || !btn) return;
  const strip = btn.closest('.dstrip').getBoundingClientRect(), top = $('#body').getBoundingClientRect();
  el.style.top = `${top.top + 4}px`; el.style.bottom = `${innerHeight - top.bottom + 4}px`;
  if (el.classList.contains('left')) el.style.left = `${strip.right + 4}px`; else el.style.right = `${innerWidth - strip.left + 4}px`;
}
// Where a floating window is drawn: wholly inside the browser window (shrunk if it has to be).
// The saved size and place stay as they were, so a bigger window brings them back.
function floatBox(f) {
  const W = innerWidth, H = innerHeight, minY = ($('#ctxbar')?.getBoundingClientRect().bottom || 80) + 4;
  const w = Math.max(DOCK_MIN.floatW, Math.min(f.w, W - 16)), h = Math.max(DOCK_MIN.floatH, Math.min(f.h, H - minY - 8));
  return { x: clamp(f.x, 0, Math.max(0, W - w)), y: clamp(f.y, minY, Math.max(minY, H - h)), w, h };
}
window.addEventListener('resize', debounce(() => { dockSession.sig = ''; render(); }, 150));

/* ---------- commands ---------- */
const dockArgs = a => { const [zone, ci, gi] = String(a).split('|'); return { zone, ci: +ci, gi: +gi }; };
function dockGroupAt({ zone, ci, gi }, L = wsLayout()) {
  return zone === 'bottom' ? L.bottom.groups[gi] : zone === 'float' ? L.floating[gi] : L[zone]?.[ci]?.groups[gi];
}
Actions.dockTab = id => {
  const L = dockClone(wsLayout()); dockActivate(L, id); setLayout(L);
  setTimeout(() => $(`[data-dtab="${CSS.escape(id)}"] .dtab-b`)?.focus(), 0);
};
let _closeToast = null;
Actions.dockClose = (id, el, e) => {
  e?.stopPropagation();
  const ws = curWs(), before = dockClone(wsLayout()), after = dockRemove(dockClone(wsLayout()), id), afterSig = JSON.stringify(after);
  setLayout(after);
  _closeToast?.remove();
  // Undo puts the panel back in the workspace it was closed in: exactly where it was if nothing has
  // changed since, otherwise beside its old neighbours
  _closeToast = toastAction(`${panelTitle(id)} closed`, 'Undo', dockSession.reopen = () => {
    dockSession.reopen = null;
    const cur = dockState.ws[ws] || wsLayout(ws), same = JSON.stringify(dockClone(cur)) === afterSig;
    const L = same ? before : dockOpen(dockClone(cur), id, before);
    L.__ok = true; dockState.ws[ws] = L; saveDock(); dockSession.sig = '';
    if (curWs() !== ws) Actions.view(ws); else render();
  });
};
Actions.dockFold = a => {
  const at = dockArgs(a), L = dockClone(wsLayout()), g = dockGroupAt(at, L), col = L[at.zone]?.[at.ci];
  if (!g) return;
  if (col && !g.folded && col.groups.every(x => x === g || x.folded)) { col.collapsed = true; dockSession.expanded.delete(`${curWs()}|${at.zone}|${at.ci}`); setLayout(L); return; }
  g.folded = !g.folded; setLayout(L);
};
Actions.dockExpand = a => {
  const at = dockArgs(a), L = dockClone(wsLayout());
  dockSession.expanded.add(`${curWs()}|${at.zone}|${at.ci}`);
  if (L[at.zone][at.ci]) L[at.zone][at.ci].collapsed = false;
  dockSession.flyout = null; setLayout(L);
};
Actions.dockCollapse = a => { const at = dockArgs(a), L = dockClone(wsLayout()); dockSession.expanded.delete(`${curWs()}|${at.zone}|${at.ci}`); if (L[at.zone][at.ci]) L[at.zone][at.ci].collapsed = true; setLayout(L); };
Actions.dockFlyout = id => {
  const was = dockSession.flyout, opener = $(`.dstrip-b[data-arg="${CSS.escape(id || was || '')}"]`);
  dockSession.flyout = id && dockSession.flyout !== id ? id : null; dockSession.sig = ''; render();
  if (dockSession.flyout) setTimeout(() => $('#flyout-layer .dbody :is(button, input, select, [tabindex="0"])')?.focus(), 0);
  else setTimeout(() => $(`.dstrip-b[data-arg="${CSS.escape(was || '')}"]`)?.focus() || opener?.focus(), 0);
};
Actions.openPanel = id => {
  if (!Panels[id]) return;
  dockSession.hidden = false;
  const L = dockClone(wsLayout()), at = dockFind(L, id);
  if (!at) { setLayout(dockOpen(L, id, DOCK_DEFAULTS[curWs()] || emptyLayout())); }
  else {
    dockActivate(L, id); at.g.folded = false;
    const collapsed = (at.zone === 'left' || at.zone === 'right') && colCollapsed(L[at.zone][at.ci], at.zone, at.ci);
    if (collapsed) dockSession.flyout = id;
    setLayout(L);
  }
  setTimeout(() => { $(`[data-host="${CSS.escape(id)}"]`)?.scrollIntoView?.({ block: 'nearest' }); ($(`#flyout-layer [data-host="${CSS.escape(id)}"] :is(button, input, select)`) || $(`[data-dtab="${CSS.escape(id)}"] .dtab-b`))?.focus(); }, 0);
};
Actions.togglePanel = id => {
  const at = dockFind(wsLayout(), id);
  const visible = at && at.g.active === id && !at.g.folded && !dockSession.hidden && !((at.zone === 'left' || at.zone === 'right') && colCollapsed(wsLayout()[at.zone][at.ci], at.zone, at.ci));
  if (visible) Actions.dockClose(id); else Actions.openPanel(id);
};
Actions.dockMoveTo = arg => {
  if (dockLocked()) { toast('The layout is locked (Window ▸ Lock layout)'); return; }
  const [id, to] = String(arg).split('|'), L = dockClone(wsLayout());
  const t = to === 'float' ? { zone: 'float', ...nextFloatSpot(L) } : to === 'bottom' ? { zone: 'bottom', how: L.bottom.groups.length ? 'tab' : 'new', group: 0 } : null;
  setLayout(t ? dockMove(L, id, t) : L[to].length ? dockAddToColumn(dockRemove(L, id), id, to, to === 'left' ? 0 : L[to].length - 1) : dockMove(L, id, { zone: to, how: 'edge' }));
  announce(`${panelTitle(id)} moved`);
};
// new windows cascade instead of landing exactly on top of each other
function nextFloatSpot(L, w = 300, h = 340) {
  const d = $('#docarea')?.getBoundingClientRect() || { left: 200, top: 120, right: innerWidth - 200, bottom: innerHeight - 40 };
  const clash = (x, y) => L.floating.some(f => x < f.x + f.w + 8 && x + w + 8 > f.x && y < f.y + f.h + 8 && y + h + 8 > f.y);
  // across the canvas from the right, then down; otherwise cascade from the centre
  const top0 = ($('#docwrap')?.getBoundingClientRect().top || d.top) + (parseFloat($('#docwrap')?.style.getPropertyValue('--hud-top')) || 28) + 8;
  for (let y = top0; y + h <= d.bottom; y += 60) for (let x = d.right - w - 16; x >= d.left + 8; x -= w + 16) if (!clash(x, y)) return { x: Math.round(x), y: Math.round(y) };
  let x = Math.round(innerWidth / 2 - w / 2), y = 140;
  while (L.floating.some(f => Math.abs(f.x - x) < 30 && Math.abs(f.y - y) < 30)) { x += 48; y += 40; }
  return { x, y };
}
Actions.dockShift = arg => {   // move a group up or down within its column
  if (dockLocked()) return;
  const [a, dir] = String(arg).split('#'), at = dockArgs(a), L = dockClone(wsLayout()), col = L[at.zone]?.[at.ci];
  if (!col) return;
  const j = at.gi + +dir;
  if (j < 0 || j >= col.groups.length) return;
  [col.groups[at.gi], col.groups[j]] = [col.groups[j], col.groups[at.gi]];
  setLayout(L);
};
Actions.dockWidth = arg => { const [a, w] = String(arg).split('#'), at = dockArgs(a), L = dockClone(wsLayout()); if (L[at.zone]?.[at.ci]) { L[at.zone][at.ci].w = +w; setLayout(L); } };
Actions.dockFloatSize = arg => { const [fi, s] = String(arg).split('#'), L = dockClone(wsLayout()), f = L.floating[+fi]; if (f) { Object.assign(f, { S: { w: 260, h: 280 }, M: { w: 340, h: 420 }, L: { w: 440, h: 600 } }[s]); setLayout(L); } };
Actions.dockGroupMenu = (a, el) => {
  const at = dockArgs(a), g = dockGroupAt(at); if (!g) return;
  const id = g.active, col = at.zone === 'left' || at.zone === 'right' ? wsLayout()[at.zone][at.ci] : null, locked = dockLocked();
  const moves = [['left', 'Left dock'], ['right', 'Right dock'], ['bottom', 'Bottom dock'], ['float', 'its own window']].filter(([z]) => z !== at.zone).map(([z, l]) => ({ label: `Move to ${l}`, act: 'dockMoveTo', arg: `${id}|${z}`, disabled: locked }));
  openMenu(el.getBoundingClientRect ? el : { x: el.x, y: el.y }, [
    ...(g.tabs.length > 1 ? [{ header: 'Panels here' }, ...g.tabs.map(t => tick(esc(panelTitle(t)), 'dockTab', t, t === id)), '-'] : []),
    { header: esc(panelTitle(id)) + (locked ? ' · layout locked' : '') },
    ...moves,
    ...(col ? [{ label: 'Move up', act: 'dockShift', arg: `${a}#-1`, disabled: locked || at.gi === 0 }, { label: 'Move down', act: 'dockShift', arg: `${a}#1`, disabled: locked || at.gi === col.groups.length - 1 }] : []),
    ...(col && col.groups.length > 1 ? [{ label: 'Taller', act: 'dockHeight', arg: `${a}#1` }, { label: 'Shorter', act: 'dockHeight', arg: `${a}#-1` }] : []),
    '-',
    ...(col ? [{ header: 'Column width' }, ...[['Narrow', 240], ['Medium', 300], ['Wide', 380]].map(([l, w]) => tick(l, 'dockWidth', `${a}#${w}`, Math.abs(col.w - w) < 20)), { label: 'Collapse to icons', act: 'dockCollapse', arg: a }, '-'] : []),
    ...(at.zone === 'float' ? [{ header: 'Window size' }, ...['S', 'M', 'L'].map(s => ({ label: { S: 'Small', M: 'Medium', L: 'Large' }[s], act: 'dockFloatSize', arg: `${at.gi}#${s}` })), '-'] : []),
    { label: g.folded ? 'Unfold' : 'Fold', act: 'dockFold', arg: a },
    { label: `Close ${esc(panelTitle(id))}`, act: 'dockClose', arg: id },
  ]);
};
// right-click a tab: the same menu, for that tab's group
document.addEventListener('contextmenu', e => {
  const tab = e.target.closest?.('.dtab[data-dtab]');
  if (!tab) return;
  e.preventDefault(); e.stopPropagation();
  Actions.dockTab(tab.dataset.dtab);
  setTimeout(() => Actions.dockGroupMenu(`${tab.dataset.zone}|${tab.dataset.ci}|${tab.dataset.gi}`, { x: e.clientX, y: e.clientY }), 0);
}, true);
Actions.resetLayout = which => {
  if (which === 'all') dockState.ws = {}; else delete dockState.ws[curWs()];
  dockSession.flyout = null; dockSession.hidden = false; dockSession.expanded.clear(); saveDock(); dockSession.sig = ''; render();
  toast(which === 'all' ? 'Every workspace is back to its starting layout' : 'This workspace is back to its starting layout');
};
Actions.toggleHidePanels = () => { dockSession.hidden = !dockSession.hidden; dockSession.sig = ''; render(); announce(dockSession.hidden ? 'Panels hidden. Ctrl+. shows them.' : 'Panels shown'); };
Actions.toggleLockLayout = () => { prefs.lockLayout = !prefs.lockLayout; savePrefs(); dockSession.sig = ''; render(); toast(prefs.lockLayout ? 'Layout locked: panels can be resized and folded but not moved' : 'Layout unlocked'); };
Actions.toggleDrawer = side => {
  dockSession.drawer = dockSession.drawer === side ? null : side; document.body.dataset.drawer = dockSession.drawer || '';
  for (const b of $$('[data-act="toggleDrawer"]')) b.setAttribute('aria-expanded', b.dataset.arg === dockSession.drawer);
  if (dockSession.drawer) setTimeout(() => $(`#dock-${side} :is(.dtab-b[aria-selected="true"], button, input)`)?.focus(), 0);
  else $(`[data-act="toggleDrawer"][data-arg="${side}"]`)?.focus();
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && dockSession.drawer && e.target.closest?.('.dock-side')) { e.stopPropagation(); Actions.toggleDrawer(dockSession.drawer); } }, true);
document.addEventListener('pointerdown', e => {   // a tap outside a drawer or fly-out closes it, and does nothing else
  if (dockSession.drawer && !e.target.closest('.dock-side, [data-act="toggleDrawer"], .menu, .modal-back')) { dockSession.drawer = null; document.body.dataset.drawer = ''; }
  if (dockSession.flyout && !e.target.closest('#flyout-layer, .dstrip, .menu, .modal-back, .popover')) {
    const onCanvas = !!e.target.closest('#main');
    if (onCanvas) { e.preventDefault(); e.stopPropagation(); _swallowClick = true; setTimeout(() => { _swallowClick = false; }, 300); }
    dockSession.flyout = null; dockSession.sig = ''; setTimeout(render, 0);
  }
}, true);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === '.') { e.preventDefault(); Actions.toggleHidePanels(); }
  if (e.key === 'Escape' && dockSession.flyout && $('#flyout-layer').contains(document.activeElement)) { Actions.dockFlyout(''); return; }
  // arrow keys move between the tabs of a group (APG tabs)
  const t = e.target.closest?.('.dtab');
  if (t && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    const tabs = [...t.parentElement.querySelectorAll('.dtab')], i = tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1);
    if (tabs[i]) { e.preventDefault(); Actions.dockTab(tabs[i].dataset.dtab); }
  }
  // splitters: arrow keys resize, Enter resets
  const sp = e.target.closest?.('[data-split]');
  if (sp && /^Arrow|^Enter$/.test(e.key)) { e.preventDefault(); splitterKey(sp, e.key); }
});

/* ---------- splitters ---------- */
function splitterKey(sp, key) {
  const L = dockClone(wsLayout()), z = sp.dataset.zone, ci = +sp.dataset.ci, kind = sp.dataset.split;
  if (kind === 'col') {
    const c = L[z][ci], grow = (key === 'ArrowRight') === (z === 'left') ? 16 : key === 'ArrowLeft' || key === 'ArrowRight' ? -16 : 0;
    c.w = key === 'Enter' ? ((DOCK_DEFAULTS[curWs()] || emptyLayout())[z]?.[ci]?.w || 280) : c.w + grow;
  } else if (kind === 'group') {
    const c = L[z][ci], gi = +sp.dataset.gi, a = c.groups[gi], b = c.groups[gi + 1], d = key === 'ArrowDown' ? 0.04 : key === 'ArrowUp' ? -0.04 : 0;
    if (key === 'Enter') { const s = (a.h + b.h) / 2; a.h = b.h = s; } else if (a.h + d > 0.12 && b.h - d > 0.12) { a.h += d; b.h -= d; }
  } else if (kind === 'bottom') L.bottom.h += key === 'ArrowUp' ? 16 : key === 'ArrowDown' ? -16 : 0;
  setLayout(dockTidy(L));
  setTimeout(() => $(`[data-split="${kind}"]${kind === 'bottom' ? '' : `[data-zone="${z}"][data-ci="${ci}"]`}${kind === 'group' ? `[data-gi="${sp.dataset.gi}"]` : ''}`)?.focus(), 0);
}
document.addEventListener('dblclick', e => { const sp = e.target.closest?.('[data-split]'); if (sp) splitterKey(sp, 'Enter'); });
document.addEventListener('pointerdown', e => {
  const sp = e.target.closest?.('[data-split]');
  if (!sp || e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();   // a divider press never reaches the tab-drag code
  const kind = sp.dataset.split, z = sp.dataset.zone, ci = +sp.dataset.ci, gi = +sp.dataset.gi, L = dockClone(wsLayout());
  const x0 = e.clientX, y0 = e.clientY;
  const col = kind === 'bottom' ? null : L[z][ci];
  const colEl = kind === 'group' ? sp.closest('.dcol') : kind === 'col' ? $(`.dcol[data-zone="${z}"][data-ci="${ci}"]`) : null;
  const w0 = col?.w, h0 = L.bottom.h, colH = colEl?.getBoundingClientRect().height || 1;
  const g0 = kind === 'group' ? [col.groups[gi].h, col.groups[gi + 1].h] : null;
  let moved = false;
  document.body.classList.add('dock-resizing');
  sp.setPointerCapture(e.pointerId);
  const move = ev => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 2) return;
    moved = true;
    if (kind === 'col') { col.w = clamp(w0 + (z === 'left' ? 1 : -1) * (ev.clientX - x0), DOCK_MIN.colW, DOCK_MIN.colMaxW); colEl.style.width = col.w + 'px'; }
    else if (kind === 'bottom') { L.bottom.h = clamp(h0 - (ev.clientY - y0), DOCK_MIN.bottomH, DOCK_MIN.bottomMaxH); $('#dock-bottom .dbottom-row').style.height = L.bottom.h + 'px'; }
    else {
      const open = col.groups.filter(g => !g.folded).reduce((s, g) => s + g.h, 0), d = (ev.clientY - y0) / colH * open, sum = g0[0] + g0[1];
      col.groups[gi].h = clamp(g0[0] + d, 0.12 * open, sum - 0.12 * open); col.groups[gi + 1].h = sum - col.groups[gi].h;
      const secs = colEl.querySelectorAll(':scope > .dgroup');
      secs[gi].style.flex = `${col.groups[gi].h} 1 0`; secs[gi + 1].style.flex = `${col.groups[gi + 1].h} 1 0`;
    }
  };
  const up = () => {
    sp.removeEventListener('pointermove', move); sp.removeEventListener('pointerup', up); sp.removeEventListener('pointercancel', up);
    document.body.classList.remove('dock-resizing');
    if (moved) { setLayout(dockTidy(L)); refitCanvas(); }   // a plain click leaves it alone (so double-click can reset)
  };
  sp.addEventListener('pointermove', move); sp.addEventListener('pointerup', up); sp.addEventListener('pointercancel', up);
}, true);

/* ---------- floating windows: front on click, move by the tab bar, resize by the corner ---------- */
document.addEventListener('pointerdown', e => {
  const win = e.target.closest?.('.dfloat');
  if (win) {   // bring it to the front, and remember that
    const L = wsLayout(), f = L.floating[+win.dataset.fi], top = Math.max(0, ...L.floating.map(x => x.z || 0));
    if (f && (f.z || 0) < top || (f && !f.z)) { f.z = top + 1; win.style.zIndex = 30 + f.z; saveDock(); }
  }
  if (e.button !== 0) return;
  const bar = e.target.closest?.('.dfloat .dtabs');
  if (bar && !e.target.closest('button, .dtab')) {
    const fi = +win.dataset.fi, L = dockClone(wsLayout()), f = Object.assign(L.floating[fi], floatBox(L.floating[fi])), x0 = e.clientX - f.x, y0 = e.clientY - f.y;
    const minY = ($('#ctxbar')?.getBoundingClientRect().bottom || 80) + 4;
    e.preventDefault(); bar.setPointerCapture(e.pointerId);
    const before = dockClone(wsLayout()), ids = [...f.tabs];
    let target = null;
    win.style.pointerEvents = 'none';   // so what's under the window can be found
    $('#drop-layer').innerHTML = `<div class="drop-ghost"></div><div class="drop-hl" hidden></div>`;
    const mv = ev => {
      f.x = clamp(ev.clientX - x0, -f.w + 80, innerWidth - 80); f.y = clamp(ev.clientY - y0, minY, innerHeight - 40); win.style.left = f.x + 'px'; win.style.top = f.y + 'px';
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      const dockable = over?.closest?.('.dock-side, #dock-bottom, .dstrip, .dfloat .dtabs');
      const t = dockLocked() || ev.ctrlKey || !dockable ? null : dockDropTarget(ev.clientX, ev.clientY);
      target = t && t.zone !== 'float' && !(t.zone === 'float-join' && t.fi === fi) ? t : null;   // over the canvas it's just moving
      win.classList.toggle('docking', !!target);
      if (target) showDropTarget(target, ids.map(panelTitle).join(', '), ev); else { const hl = $('#drop-layer .drop-hl'), gh = $('#drop-layer .drop-ghost'); if (hl) hl.hidden = true; if (gh) gh.textContent = ''; }
    };
    const esc = ke => { if (ke.key !== 'Escape') return; ke.stopPropagation(); target = null; up({ type: 'pointercancel' }); };
    document.addEventListener('keydown', esc, true);
    const up = e2 => {
      document.removeEventListener('keydown', esc, true);
      if (e2.type === 'pointercancel') { Object.assign(f, before.floating[fi]); win.style.left = f.x + 'px'; win.style.top = f.y + 'px'; win.classList.remove('docking'); }
      bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', up);
      win.style.pointerEvents = ''; $('#drop-layer').innerHTML = '';
      if (target && e2.type !== 'pointercancel') { setLayout(dockMoveMany(before, ids, target, f.active)); announce(`${ids.map(panelTitle).join(', ')} docked`); }
      else setLayout(L);
    };
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', up);
    return;
  }
  const grip = e.target.closest?.('[data-fgrip]');
  if (grip) {
    const fi = +grip.dataset.fgrip, L = dockClone(wsLayout()), f = Object.assign(L.floating[fi], floatBox(L.floating[fi])), x0 = e.clientX, y0 = e.clientY, w0 = f.w, h0 = f.h;
    e.preventDefault(); grip.setPointerCapture(e.pointerId);
    const mv = ev => { f.w = Math.max(DOCK_MIN.floatW, w0 + ev.clientX - x0); f.h = Math.max(DOCK_MIN.floatH, h0 + ev.clientY - y0); win.style.width = f.w + 'px'; win.style.height = f.h + 'px'; };
    const up = () => { grip.removeEventListener('pointermove', mv); grip.removeEventListener('pointerup', up); grip.removeEventListener('pointercancel', up); setLayout(L); };
    grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', up); grip.addEventListener('pointercancel', up);
  }
});

/* ---------- dragging tabs to dock them somewhere else ---------- */
let dockDrag = null;
document.addEventListener('pointerdown', e => {
  if (e.button !== 0 || dockLocked() || e.target.closest?.('.dtab-x, [data-split], #flyout-layer')) return;
  const tab = e.target.closest?.('.dtab[data-dtab]');
  if (tab) { dockDrag = { id: tab.dataset.dtab, ids: [tab.dataset.dtab], x: e.clientX, y: e.clientY, on: false }; return; }
  // the empty part of a docked group's tab bar moves the whole group
  const bar = e.target.closest?.('.dock-side .dtabs, #dock-bottom .dtabs');
  if (bar && !e.target.closest('button')) {
    const g = bar.closest('.dgroup'), ids = [...g.querySelectorAll('.dtab[data-dtab]')].map(t => t.dataset.dtab);
    e.preventDefault();
    dockDrag = { id: g.querySelector('.dtab.on')?.dataset.dtab || ids[0], ids, x: e.clientX, y: e.clientY, on: false };
  }
});
document.addEventListener('pointermove', e => {
  if (!dockDrag) return;
  if (!dockDrag.on) {
    if (Math.hypot(e.clientX - dockDrag.x, e.clientY - dockDrag.y) < 8) return;
    dockDrag.on = true; document.body.classList.add('dock-dragging');
    $('#drop-layer').innerHTML = `<div class="drop-ghost"></div><div class="drop-hl" hidden></div>`;
  }
  dockDrag.target = dockDropTarget(e.clientX, e.clientY);
  showDropTarget(dockDrag.target, dockDrag.ids.map(panelTitle).join(', '), e);
});
// the ghost label beside the pointer (kept on screen) and the outline of where the drop goes
function showDropTarget(t, name, e) {
  const ghost = $('#drop-layer .drop-ghost'), hl = $('#drop-layer .drop-hl'); if (!ghost) return;
  ghost.textContent = `${name}${t?.label ? ` → ${t.label}` : ''}`;
  const gw = ghost.offsetWidth, gh = ghost.offsetHeight;
  const gx = e.clientX + 12 + gw > innerWidth - 4 ? e.clientX - 12 - gw : e.clientX + 12, gy = Math.min(e.clientY + 10, innerHeight - gh - 4);
  ghost.style.transform = `translate(${Math.max(4, gx)}px, ${gy}px)`;
  if (t?.rect) { hl.hidden = false; hl.classList.toggle('caret', t.rect.width <= 4); Object.assign(hl.style, { left: t.rect.left + 'px', top: t.rect.top + 'px', width: t.rect.width + 'px', height: t.rect.height + 'px' }); }
  else hl.hidden = true;
}
const endDockDrag = e => {
  if (!dockDrag) return;
  const d = dockDrag; dockDrag = null;
  document.body.classList.remove('dock-dragging'); $('#drop-layer').innerHTML = '';
  if (!d.on) return;
  _swallowClick = true; setTimeout(() => { _swallowClick = false; }, 0);
  if (!d.target || e.type === 'pointercancel') { announce('Panel left where it was'); return; }
  setLayout(dockMoveMany(dockClone(wsLayout()), d.ids, d.target, d.id));
  announce(`${d.ids.map(panelTitle).join(', ')} moved`);
};
document.addEventListener('pointerup', endDockDrag);
document.addEventListener('pointercancel', endDockDrag);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && dockDrag?.on) { e.stopPropagation(); dockDrag = null; document.body.classList.remove('dock-dragging'); $('#drop-layer').innerHTML = ''; } }, true);
// Where among a tab strip's tabs a drop at x lands: the index and a thin caret to show it.
function tabSlot(strip, x) {
  const tabs = [...strip.querySelectorAll('.dtab')], rs = tabs.map(t => t.getBoundingClientRect());
  let i = rs.findIndex(r => x < r.left + r.width / 2); if (i < 0) i = tabs.length;
  const sr = strip.getBoundingClientRect(), cx = i < rs.length ? rs[i].left : (rs.length ? rs[rs.length - 1].right : sr.left);
  return { index: i, rect: { left: cx - 1, top: sr.top + 3, width: 3, height: sr.height - 6 } };
}
// What dropping at (x, y) would do, the rectangle to light up and a few words for the ghost.
function dockDropTarget(x, y) {
  const L = wsLayout(), el = document.elementFromPoint(x, y);
  if (!el) return null;
  const R = n => n.getBoundingClientRect();
  const body = R($('#body')), doc = R($('#docarea'));
  // an icon strip: join its column
  const strip = el.closest('.dstrip');
  if (strip) { const zone = strip.dataset.zone, ci = +strip.dataset.ci, c = L[zone]?.[ci]; if (c) return { zone, col: ci, group: c.groups.length - 1, how: 'tab', label: 'these panels', rect: R(strip) }; }
  // a panel group: join its tabs, or stack above or below it
  const tabs0 = el.closest('.dtabs'), grp0 = el.closest('.dgroup');
  if (grp0 && !grp0.closest('#flyout-layer')) {
    const zone = grp0.dataset.zone, ci = +grp0.dataset.ci, gi = +grp0.dataset.gi;
    if (tabs0) {
      const slot = tabSlot(tabs0.querySelector('.dtab-strip') || tabs0, x), own = (dockDrag?.ids || []).some(id => grp0.querySelector(`[data-dtab="${CSS.escape(id)}"]`));
      return { zone: zone === 'float' ? 'float-join' : zone, col: ci, group: gi, how: 'tab', index: slot.index, rect: slot.rect, fi: gi, label: own ? 'here' : 'join these tabs' };
    }
    if (zone === 'bottom') {   // the outer quarters: beside this group; the middle: join it
      const r = R(grp0), q = r.width / 4;
      if (x < r.left + q) return { zone: 'bottom', group: gi, how: 'new', side: 'before', label: 'beside this panel', rect: { left: r.left, top: r.top, width: r.width / 2, height: r.height } };
      if (x > r.right - q) return { zone: 'bottom', group: gi, how: 'new', side: 'after', label: 'beside this panel', rect: { left: r.left + r.width / 2, top: r.top, width: r.width / 2, height: r.height } };
      return { zone: 'bottom', group: gi, how: 'tab', rect: R(grp0), label: 'join these tabs' };
    }
    if (zone === 'float') return { zone: 'float-join', fi: gi, how: 'tab', rect: R(grp0), label: 'this window' };
    const r = R(grp0), top = y < r.top + r.height / 2;
    return { zone, col: ci, group: gi, how: top ? 'above' : 'below', label: top ? 'above this panel' : 'below this panel', rect: { left: r.left, width: r.width, top: top ? r.top : r.top + r.height / 2, height: r.height / 2 } };
  }
  // the edges: outside the docks (over the tool strip or the window edge) and the canvas's own edges make new columns
  const EDGE = 40, strip0 = R($('#toolstrip'));
  for (const zone of ['left', 'right']) {
    const outer = zone === 'left' ? x < Math.max(strip0.right, body.left + 12) : x > body.right - 12;
    const inner = zone === 'left' ? x >= doc.left && x < doc.left + EDGE : x <= doc.right && x > doc.right - EDGE;
    if ((outer || inner) && y > body.top && y < body.bottom) {
      const cols = L[zone];
      if (inner && cols.length) {
        const ci = zone === 'left' ? cols.length - 1 : 0;
        return { zone, how: 'newcol', col: ci, at: zone === 'left' ? 'after' : 'before', label: 'a new column', rect: { left: zone === 'left' ? doc.left : doc.right - EDGE, top: body.top, width: EDGE, height: body.height } };
      }
      return { zone, how: 'edge', label: `a new ${zone} column`, rect: { left: zone === 'left' ? body.left : body.right - 12, top: body.top, width: zone === 'left' ? Math.max(12, strip0.right - body.left) : 12, height: body.height } };
    }
  }
  const bt = R($('#statusbar'));
  if (y > doc.bottom - 48 && y < bt.top && x > doc.left && x < doc.right) return { zone: 'bottom', how: L.bottom.groups.length ? 'tab' : 'new', group: 0, label: 'the bottom dock', rect: { left: doc.left, top: doc.bottom - 48, width: doc.width, height: 48 } };
  // anywhere else on the canvas: its own window, where it was dropped
  if (x > doc.left && x < doc.right && y > doc.top && y < doc.bottom) return { zone: 'float', x: x - 150, y: y - 16, label: 'its own window', rect: { left: x - 150, top: y - 16, width: 300, height: 340 } };
  return null;
}
/* ---------- helpers used by panels ---------- */
function refitCanvas() { if (ui.view === 'pattern') Views.pattern.afterMain?.($('#main')); if (typeof renderHud === 'function' && hudSession.compact) renderHud(); }
function announce(msg) { const el = $('#sr-live'); if (!el) return; el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 30); }
function toastAction(msg, label, fn) {
  for (const old of $$('#toast-root .toast.has-act')) old.remove();
  const t = toast(msg, 10000);
  t?.classList.add('has-act');
  if (t && label) { const b = document.createElement('button'); b.className = 'toast-act'; b.textContent = label; b.onclick = () => { fn(); t.remove(); }; t.appendChild(b); }
  return t;
}

Actions.dockHeight = arg => {
  const [a, dir] = String(arg).split('#'), at = dockArgs(a), L = dockClone(wsLayout()), c = L[at.zone]?.[at.ci];
  if (!c || c.groups.length < 2) return;
  const g = c.groups[at.gi], others = c.groups.filter(x => x !== g), d = 0.12 * +dir;
  const nh = clamp(g.h + d, 0.12, 1 - 0.12 * others.length), scale = (1 - nh) / (1 - g.h);
  for (const o of others) o.h *= scale;
  g.h = nh; setLayout(dockTidy(L));
};

Actions.dockFloatClose = fi => {
  const ws = curWs(), before = dockClone(wsLayout()), f = before.floating[+fi]; if (!f) return;
  const ids = [...f.tabs], names = ids.map(panelTitle).join(', ');
  let M = dockClone(before); for (const id of ids) M = dockRemove(M, id);
  setLayout(M); M = dockClone(wsLayout());
  _closeToast?.remove();
  const afterSig = JSON.stringify(M);
  _closeToast = toastAction(`${names} closed`, 'Undo', dockSession.reopen = () => {
    dockSession.reopen = null;
    const cur = dockClone(dockState.ws[ws] || wsLayout(ws)), same = JSON.stringify(cur) === afterSig;
    const L = same ? before : dockMoveMany(cur, ids.filter(id => !dockFind(cur, id)), { zone: 'float', x: f.x, y: f.y, w: f.w, h: f.h }, f.active);
    L.__ok = true; dockState.ws[ws] = L; saveDock(); dockSession.sig = '';
    if (curWs() !== ws) Actions.view(ws); else render();
  });
};
// N15: a group whose tabs don't all fit shows a » button listing them
function markTabOverflow() {
  for (const strip of $$('.dtab-strip')) {
    const over = strip.scrollWidth > strip.clientWidth + 2, grp = strip.closest('.dgroup');
    let b = grp?.querySelector('.dmore');
    if (over && !b && grp) { b = document.createElement('button'); b.className = 'dbtn dmore'; b.title = 'More panels here'; b.setAttribute('aria-label', 'More panels here'); b.dataset.act = 'dockGroupMenu'; b.dataset.arg = `${grp.dataset.zone}|${grp.dataset.ci}|${grp.dataset.gi}`; b.textContent = '»'; strip.after(b); }
    if (!over && b) b.remove();
  }
}

Actions.reopenPanel = () => { if (dockSession.reopen) { dockSession.reopen(); _closeToast?.remove(); } };
