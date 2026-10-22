/* Dock layout model: pure data, no DOM (tested in Node).
   A workspace layout is
     { left: Column[], right: Column[], bottom: { h, groups: Group[] }, floating: Float[] }
     Column = { w, collapsed, groups: Group[] }      a vertical stack of panel groups
     Group  = { tabs: panelId[], active: panelId, h } h is a share of the column's height
     Float  = { tabs, active, x, y, w, h }           a group in its own window
   Panels not in the layout are closed. Every change goes through these functions, and the
   view (dock.js) redraws from the result. */

const DOCK_VERSION = 1;
const DOCK_MIN = { colW: 180, colMaxW: 520, groupH: 0.08, floatW: 220, floatH: 140, bottomH: 64, bottomMaxH: 320 };

const dockClone = L => JSON.parse(JSON.stringify(L));
const emptyLayout = () => ({ left: [], right: [], bottom: { h: 76, groups: [] }, floating: [] });

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
  L.bottom.h = Math.max(DOCK_MIN.bottomH, Math.min(DOCK_MIN.bottomMaxH, +L.bottom.h || 76));
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
     { zone: 'bottom', group?, how: 'tab'|'new' }               the bottom dock
     { zone: 'float', x, y, w, h }                              its own window */
function dockMove(L, id, t) {
  // Find the target before taking the panel out: removing it can shift or delete groups and columns.
  const clampI = (i, n) => Math.max(0, Math.min(n - 1, i ?? 0));
  let tc = null, tg = null;
  if ((t.zone === 'left' || t.zone === 'right') && L[t.zone]?.length && t.how !== 'edge') {
    tc = L[t.zone][clampI(t.col, L[t.zone].length)];
    if (['tab', 'above', 'below'].includes(t.how)) tg = tc.groups[clampI(t.group, tc.groups.length)];
    // onto its own group as a tab, or beside a group that holds only it: nothing changes
    if (tg && tg.tabs.includes(id) && (t.how === 'tab' || tg.tabs.length === 1)) return dockTidy(L);
  }
  if (t.zone === 'bottom' && t.how === 'tab') { tg = L.bottom.groups[t.group ?? 0] || null; if (tg?.tabs.includes(id)) return dockTidy(L); }
  // joining a floating window's tabs (t.fi is the window)
  if (t.zone === 'float-join') {
    const f = L.floating[t.fi];
    if (!f || f.tabs.includes(id)) return dockTidy(L);
    L = dockRemove(L, id);
    if (L.floating.includes(f)) { f.tabs.push(id); f.active = id; return dockTidy(L); }
    L.floating.push({ tabs: [id], active: id, x: 120, y: 120, w: 300, h: 340 });
    return dockTidy(L);
  }
  L = dockRemove(L, id);
  const grp = h => ({ tabs: [id], active: id, h: h ?? 0.5 });
  if (t.zone === 'float') { L.floating.push({ tabs: [id], active: id, x: t.x ?? 120, y: t.y ?? 120, w: t.w ?? 300, h: t.h ?? 340 }); return dockTidy(L); }
  if (t.zone === 'bottom') {
    if (tg && L.bottom.groups.includes(tg)) { tg.tabs.push(id); tg.active = id; } else L.bottom.groups.push(grp(1));
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
  if (t.how === 'tab' && g) { g.tabs.splice(t.index ?? g.tabs.length, 0, id); g.active = id; return dockTidy(L); }
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
    L = { left: Array.isArray(saved.left) ? saved.left : [], right: Array.isArray(saved.right) ? saved.right : [], bottom: saved.bottom && Array.isArray(saved.bottom.groups) ? saved.bottom : { h: 76, groups: [] }, floating: Array.isArray(saved.floating) ? saved.floating : [] };
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
  const c = L[zone][ci], last = c.groups[c.groups.length - 1];
  const crowded = c.groups.length >= 3 || (last && last.h < 0.3);
  return dockMove(L, id, { zone, col: ci, group: c.groups.length - 1, how: crowded ? 'tab' : 'below' });
}
function dockActivate(L, id) { const at = dockFind(L, id); if (at) at.g.active = id; return L; }

if (typeof module !== 'undefined') module.exports = { DOCK_VERSION, DOCK_MIN, emptyLayout, dockGroups, dockFind, dockOpenIds, dockTidy, dockRemove, dockMove, dockLoad, dockOpen, dockActivate, dockClone, dockAddToColumn };
