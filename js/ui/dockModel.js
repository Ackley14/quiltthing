/* Dock layout model: pure data, no DOM (tested in Node).
   A workspace layout is
     { left: Column[], right: Column[], bottom: { h, groups: Group[] }, floating: Float[] }
     Column = { w, collapsed, groups: Group[] }      a vertical stack of panel groups
     Group  = { tabs: panelId[], active: panelId, h } h is a share of the column's height
     Float  = { tabs, active, x, y, w, h }           a group in its own window
   Panels not in the layout are closed. Every change goes through these functions, and the
   view (dock.js) redraws from the result. */

const DOCK_VERSION = 1;
const DOCK_MIN = { colW: 220, colMaxW: 520, groupH: 0.08, floatW: 220, floatH: 140, bottomH: 120, bottomMaxH: 480 };

const dockClone = L => JSON.parse(JSON.stringify(L));
const emptyLayout = () => ({ left: [], right: [], bottom: { h: 220, groups: [] }, floating: [] });

// Every group in a layout, with where it lives.
function dockGroups(L) {
  const out = [];
  for (const side of ['left', 'right']) L[side].forEach((c, ci) => c.groups.forEach((g, gi) => out.push({ g, zone: side, ci, gi })));
  L.bottom.groups.forEach((g, gi) => out.push({ g, zone: 'bottom', gi }));
  L.floating.forEach((g, fi) => out.push({ g, zone: 'float', fi }));
  return out;
}
function dockFind(L, id) { return dockGroups(L).find(x => x.g.tabs.includes(id)) || null; }
const dockOpenIds = L => dockGroups(L).flatMap(x => x.g.tabs);

// Remove empty groups and columns, fix actives, spread heights so each column's shares sum to 1.
function dockTidy(L) {
  for (const side of ['left', 'right']) {
    for (const c of L[side]) {
      c.groups.forEach((g, i) => {
        if (g.tabs.length || !(g.h > 0)) return;
        const nb = (c.groups[i - 1]?.tabs.length ? c.groups[i - 1] : null) || c.groups.slice(i + 1).find(x => x.tabs.length) || c.groups.slice(0, i).reverse().find(x => x.tabs.length);
        if (nb) nb.h = (nb.h > 0 ? nb.h : 0) + g.h;
        g.h = 0;
      });
      c.groups = c.groups.filter(g => g.tabs.length);
      for (const g of c.groups) if (!g.tabs.includes(g.active)) g.active = g.tabs[0];
      const sum = c.groups.reduce((s, g) => s + (g.h > 0 ? g.h : 0), 0);
      for (const g of c.groups) g.h = sum > 0 && g.h > 0 ? g.h / sum : 1 / c.groups.length;
      // every group keeps at least a usable share of the column
      const minH = Math.min(0.12, 1 / c.groups.length);
      if (c.groups.some(g => g.h < minH - 1e-9)) {
        for (const g of c.groups) g.h = Math.max(g.h, minH);
        const s2 = c.groups.reduce((s, g) => s + g.h, 0);
        for (const g of c.groups) g.h /= s2;
      }
      c.w = Math.max(DOCK_MIN.colW, Math.min(DOCK_MIN.colMaxW, +c.w || 280));
      c.collapsed = !!c.collapsed;
    }
    L[side] = L[side].filter(c => c.groups.length);
  }
  L.bottom.groups = L.bottom.groups.filter(g => g.tabs.length);
  for (const g of L.bottom.groups) if (!g.tabs.includes(g.active)) g.active = g.tabs[0];
  // an empty bottom dock opens at a useful height when a panel is first put there
  L.bottom.h = L.bottom.groups.length ? Math.max(DOCK_MIN.bottomH, Math.min(DOCK_MIN.bottomMaxH, +L.bottom.h || 220)) : 220;
  L.floating = L.floating.filter(g => g.tabs.length);
  for (const g of L.floating) {
    if (!g.tabs.includes(g.active)) g.active = g.tabs[0];
    g.w = Math.max(DOCK_MIN.floatW, +g.w || 300); g.h = Math.max(DOCK_MIN.floatH, +g.h || 320);
    g.x = +g.x || 80; g.y = +g.y || 80;
  }
  return L;
}

// Take a panel out of wherever it is. Returns the layout (changed in place).
function dockRemove(L, id) {
  for (const x of dockGroups(L)) {
    const i = x.g.tabs.indexOf(id);
    if (i >= 0) { x.g.tabs.splice(i, 1); if (x.g.active === id) x.g.active = x.g.tabs[Math.min(i, x.g.tabs.length - 1)]; }
  }
  return dockTidy(L);
}

/* Move a panel. target:
     { zone: 'left'|'right', col, group, how: 'tab' }          join that group's tabs
     { zone: 'left'|'right', col, group, how: 'above'|'below' } a new group in that column
     { zone: 'left'|'right', col, how: 'newcol', at: 'before'|'after' } a new column
     { zone: 'left'|'right', how: 'edge' }                      a new outermost column
     { zone: 'bottom', group?, how: 'tab'|'new', side?: 'before'|'after' }  the bottom dock (new: beside that group)
     { zone: 'float', x, y, w, h }                              its own window
   A 'tab' target may carry index: where among the tabs it goes (dropping on its own group reorders). */
// Put a tab at a place among a group's tabs (the end when no index is given).
function dockInsertTab(g, id, index) {
  g.tabs.splice(index == null ? g.tabs.length : Math.max(0, Math.min(g.tabs.length, index)), 0, id); g.active = id;
}
// Within its own group: move the tab to the index (counted before it was taken out).
function dockReorder(g, id, index) {
  if (index == null) return;   // no place given: leave it as it is
  const from = g.tabs.indexOf(id);
  g.tabs.splice(from, 1); dockInsertTab(g, id, index > from ? index - 1 : index);
}
function dockMove(L, id, t) {
  // Find the target before taking the panel out: removing it can shift or delete groups and columns.
  const clampI = (i, n) => Math.max(0, Math.min(n - 1, i ?? 0));
  let tc = null, tg = null;
  if ((t.zone === 'left' || t.zone === 'right') && L[t.zone]?.length && t.how !== 'edge') {
    tc = L[t.zone][clampI(t.col, L[t.zone].length)];
    if (['tab', 'above', 'below'].includes(t.how)) tg = tc.groups[clampI(t.group, tc.groups.length)];
    // onto its own group as a tab: reorder; beside a group that holds only it: nothing changes
    if (tg && tg.tabs.includes(id) && t.how === 'tab') { dockReorder(tg, id, t.index); return dockTidy(L); }
    if (tg && tg.tabs.includes(id) && tg.tabs.length === 1) return dockTidy(L);
  }
  if (t.zone === 'bottom' && t.how === 'tab') { tg = L.bottom.groups[t.group ?? 0] || null; if (tg?.tabs.includes(id)) { dockReorder(tg, id, t.index); return dockTidy(L); } }
  // beside a bottom group: remember which one (it may move when the panel is taken out)
  const nb = t.zone === 'bottom' && t.how === 'new' && t.group != null ? L.bottom.groups[t.group] : null;
  if (nb && nb.tabs.length === 1 && nb.tabs[0] === id) return dockTidy(L);
  // joining a floating window's tabs (t.fi is the window)
  if (t.zone === 'float-join') {
    const f = L.floating[t.fi];
    if (!f) return dockTidy(L);
    if (f.tabs.includes(id)) { dockReorder(f, id, t.index); return dockTidy(L); }
    L = dockRemove(L, id);
    if (L.floating.includes(f)) { dockInsertTab(f, id, t.index); return dockTidy(L); }
    L.floating.push({ tabs: [id], active: id, x: 120, y: 120, w: 300, h: 340 });
    return dockTidy(L);
  }
  L = dockRemove(L, id);
  const grp = h => ({ tabs: [id], active: id, h: h ?? 0.5 });
  if (t.zone === 'float') { L.floating.push({ tabs: [id], active: id, x: t.x ?? 120, y: t.y ?? 120, w: t.w ?? 300, h: t.h ?? 340 }); return dockTidy(L); }
  if (t.zone === 'bottom') {
    if (tg && L.bottom.groups.includes(tg)) dockInsertTab(tg, id, t.index);
    else { const at = nb && L.bottom.groups.includes(nb) ? L.bottom.groups.indexOf(nb) + (t.side === 'after' ? 1 : 0) : L.bottom.groups.length; L.bottom.groups.splice(at, 0, grp(1)); }
    return dockTidy(L);
  }
  const cols = L[t.zone];
  if (!cols) return dockTidy(L);
  const c = tc && cols.includes(tc) ? tc : null;
  if (t.how === 'edge' || !cols.length || !c) {
    const nc = { w: 280, collapsed: false, groups: [grp(1)] };
    if (t.how === 'newcol' && cols.length) cols.splice(t.at === 'after' ? cols.length : 0, 0, nc);
    else if (t.zone === 'left') cols.unshift(nc); else cols.push(nc);
    return dockTidy(L);
  }
  if (t.how === 'newcol') {
    cols.splice(cols.indexOf(c) + (t.at === 'after' ? 1 : 0), 0, { w: 280, collapsed: false, groups: [grp(1)] });
    return dockTidy(L);
  }
  const gi = tg ? c.groups.indexOf(tg) : -1, g = gi >= 0 ? tg : null;
  if (t.how === 'tab' && g) { dockInsertTab(g, id, t.index); return dockTidy(L); }
  // a new group above or below: it takes half the height of the group it splits
  const half = g ? g.h / 2 : 1 / (c.groups.length + 1);
  if (g) g.h = half;
  c.groups.splice(g ? (t.how === 'above' ? gi : gi + 1) : c.groups.length, 0, grp(half));
  c.collapsed = false;
  return dockTidy(L);
}

// Load a saved layout safely: unknown panels dropped, panels the user has never seen added at
// their default spot, broken data replaced by the default.
function dockLoad(saved, def, known, seen = []) {
  let L;
  try {
    if (!saved || typeof saved !== 'object') throw 0;
    L = { left: Array.isArray(saved.left) ? saved.left : [], right: Array.isArray(saved.right) ? saved.right : [], bottom: saved.bottom && Array.isArray(saved.bottom.groups) ? saved.bottom : { h: 220, groups: [] }, floating: Array.isArray(saved.floating) ? saved.floating : [] };
    L = dockClone(L);
    const ok = new Set(known), once = new Set();
    for (const x of dockGroups(L)) {
      if (!Array.isArray(x.g.tabs)) x.g.tabs = [];
      x.g.tabs = x.g.tabs.filter(id => typeof id === 'string' && ok.has(id) && !once.has(id) && once.add(id));
    }
    dockTidy(L);
    // panels added to the default after this layout was saved
    const have = new Set(dockOpenIds(L)), seenSet = new Set(seen);
    for (const x of dockGroups(def)) for (const id of x.g.tabs) {
      if (have.has(id) || seenSet.has(id)) continue;
      const near = x.g.tabs.find(o => have.has(o)), at = near && dockFind(L, near);
      if (at) { at.g.tabs.push(id); have.add(id); continue; }
      L = dockMove(L, id, x.zone === 'float' ? { zone: 'float' } : x.zone === 'bottom' ? { zone: 'bottom', how: 'new' } : { zone: x.zone, how: 'edge' });
      have.add(id);
    }
    return dockTidy(L);
  } catch { return dockTidy(dockClone(def)); }
}

// Move several panels (a whole group or window) to one place, keeping them together as tabs.
function dockMoveMany(L, ids, t, active) {
  if (!ids.length) return L;
  if (ids.length === 1) return dockMove(L, ids[0], t);
  // a whole group dropped on itself (its own tabs, above or below it, beside it) stays as it is
  const home = dockFind(L, ids[0]);
  if (home && ids.every(id => home.g.tabs.includes(id)) && home.g.tabs.length === ids.length) {
    const tg = t.zone === 'float-join' ? L.floating[t.fi] : t.zone === 'bottom' ? L.bottom.groups[t.group ?? 0] : (t.zone === 'left' || t.zone === 'right') && t.how !== 'edge' && t.how !== 'newcol' ? L[t.zone]?.[t.col ?? 0]?.groups[t.group ?? 0] : null;
    if (tg === home.g) return dockTidy(L);
  }
  // the first goes to the drop place; each of the others right after the one before, so they stay together
  L = dockMove(L, ids[0], t);
  for (let k = 1; k < ids.length; k++) {
    const at = dockFind(L, ids[0]); if (!at) break;
    const index = at.g.tabs.indexOf(ids[k - 1]) + 1;
    L = dockMove(L, ids[k], at.zone === 'float' ? { zone: 'float-join', fi: at.fi, index } : at.zone === 'bottom' ? { zone: 'bottom', group: at.gi, how: 'tab', index } : { zone: at.zone, col: at.ci, group: at.gi, how: 'tab', index });
  }
  const at = dockFind(L, active || ids[0]); if (at) at.g.active = active || ids[0];
  return L;
}

// Re-open a closed panel where the default layout has it (next to a default neighbour if that
// neighbour is open), otherwise as a new group in the right dock.
function dockOpen(L, id, def) {
  if (dockFind(L, id)) return L;
  const home = dockFind(def, id);
  if (home) {
    for (const nb of home.g.tabs) { const at = nb !== id && dockFind(L, nb); if (at) { at.g.tabs.push(id); at.g.active = id; return dockTidy(L); } }
    if (home.zone === 'bottom') return dockMove(L, id, { zone: 'bottom', how: 'new' });
    if (home.zone === 'float') return dockMove(L, id, { zone: 'float' });
    if (L[home.zone].length) return dockAddToColumn(L, id, home.zone, home.zone === 'left' ? 0 : L[home.zone].length - 1);
    return dockMove(L, id, { zone: home.zone, how: 'edge' });
  }
  return L.right.length ? dockAddToColumn(L, id, 'right', L.right.length - 1) : dockMove(L, id, { zone: 'right', how: 'edge' });
}
// Add a panel to a column: a new group at the bottom while there's room, otherwise a tab in the last group.
function dockAddToColumn(L, id, zone, ci) {
  const c = L[zone][ci];
  const gi = c.groups.reduce((b, g, i) => (g.h > c.groups[b].h ? i : b), 0), big = c.groups[gi];
  const crowded = c.groups.length >= 3 || (big && big.h < 0.3);
  return dockMove(L, id, { zone, col: ci, group: gi, how: crowded ? 'tab' : 'below' });
}
function dockActivate(L, id) { const at = dockFind(L, id); if (at) at.g.active = id; return L; }

if (typeof module !== 'undefined') module.exports = { DOCK_VERSION, DOCK_MIN, emptyLayout, dockGroups, dockFind, dockOpenIds, dockTidy, dockRemove, dockMove, dockLoad, dockOpen, dockActivate, dockClone, dockAddToColumn, dockMoveMany };
