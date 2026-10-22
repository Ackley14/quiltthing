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
  L = dockRemove(L, id);
  const grp = () => ({ tabs: [id], active: id, h: 0.5 });
  if (t.zone === 'float') { L.floating.push({ tabs: [id], active: id, x: t.x ?? 120, y: t.y ?? 120, w: t.w ?? 300, h: t.h ?? 340 }); return dockTidy(L); }
  if (t.zone === 'bottom') {
    const g = t.how === 'tab' ? L.bottom.groups[t.group ?? 0] : null;
    if (g) { g.tabs.push(id); g.active = id; } else L.bottom.groups.push(grp());
    return dockTidy(L);
  }
  const cols = L[t.zone];
  if (!cols) return dockTidy(L);
  if (t.how === 'edge' || !cols.length) {
    const c = { w: 280, collapsed: false, groups: [grp()] };
    if (t.zone === 'left') cols.unshift(c); else cols.push(c);
    return dockTidy(L);
  }
  const c = cols[Math.max(0, Math.min(cols.length - 1, t.col ?? 0))];
  if (t.how === 'newcol') {
    const ci = cols.indexOf(c) + (t.at === 'after' ? 1 : 0);
    cols.splice(ci, 0, { w: 280, collapsed: false, groups: [grp()] });
    return dockTidy(L);
  }
  const gi = Math.max(0, Math.min(c.groups.length - 1, t.group ?? 0)), g = c.groups[gi];
  if (t.how === 'tab' && g) { g.tabs.splice(t.index ?? g.tabs.length, 0, id); g.active = id; return dockTidy(L); }
  // a new group above or below: it takes half the height of the group it splits
  const half = g ? g.h / 2 : 0.5;
  if (g) g.h = half;
  c.groups.splice(t.how === 'above' ? gi : gi + 1, 0, { tabs: [id], active: id, h: half });
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
    if (L[home.zone].length) return dockMove(L, id, { zone: home.zone, col: home.zone === 'left' ? 0 : L[home.zone].length - 1, group: 99, how: 'below' });
    return dockMove(L, id, { zone: home.zone, how: 'edge' });
  }
  return L.right.length ? dockMove(L, id, { zone: 'right', col: L.right.length - 1, group: 99, how: 'below' }) : dockMove(L, id, { zone: 'right', how: 'edge' });
}
function dockActivate(L, id) { const at = dockFind(L, id); if (at) at.g.active = id; return L; }

if (typeof module !== 'undefined') module.exports = { DOCK_VERSION, DOCK_MIN, emptyLayout, dockGroups, dockFind, dockOpenIds, dockTidy, dockRemove, dockMove, dockLoad, dockOpen, dockActivate, dockClone };
