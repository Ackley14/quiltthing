/* Panels: the modules that live in the docks. Each one is
     { title, short (icon-strip label), icon, ws (workspaces it belongs to; empty = every one),
       render(host) → HTML, after?(host) }
   Any panel can be docked anywhere; the Window menu lists the ones that belong to the current
   workspace first. DOCK_DEFAULTS is the arrangement each workspace starts with (and returns to on
   Window ▸ Reset). */

const Panels = {};
function registerPanel(id, def) { Panels[id] = { ws: [], icon: 'more', ...def }; }

// Starting layouts: calm by default (one or two groups per side), more is one step away in Window.
const col = (w, ...groups) => ({ w, collapsed: false, groups: groups.map(([tabs, h]) => ({ tabs, active: tabs[0], h })) });
const DOCK_DEFAULTS = {
  block: { left: [col(272, [['fabrics'], 0.34], [['blocks', 'shapes'], 0.66])], right: [col(312, [['props'], 1])], bottom: { h: 220, groups: [] }, floating: [] },
  layout: { left: [col(272, [['fabrics'], 0.34], [['blocks'], 0.66])], right: [col(312, [['quilt'], 0.46], [['props'], 0.54])], bottom: { h: 220, groups: [] }, floating: [] },
  quilting: { left: [], right: [col(312, [['layers'], 0.36], [['props'], 0.64])], bottom: { h: 220, groups: [] }, floating: [] },
  fabric: { left: [col(256, [['fabrics'], 1])], right: [col(312, [['props', 'stash', 'backing'], 1])], bottom: { h: 220, groups: [] }, floating: [] },
  pattern: { left: [col(232, [['pages'], 1])], right: [col(312, [['props'], 1])], bottom: { h: 220, groups: [] }, floating: [] },
};
const wsLabel = ws => VIEW_LIST.find(v => v.key === ws)?.label || ws;
const panelBelongs = (id, ws = curWs()) => !Panels[id].ws.length || Panels[id].ws.includes(ws);
// A short line shown when a panel has nothing to show in this workspace.
const panelNote = (msg, act, label) => `<div class="panel-empty"><p>${msg}</p>${act ? `<button class="btn small" data-act="${act[0]}"${act[1] !== undefined ? ` data-arg="${esc(act[1])}"` : ''}>${label}</button>` : ''}</div>`;

// Properties: whatever the current workspace says is selected or open.
registerPanel('props', { title: 'Properties', short: 'Props', icon: 'sliders', render: () => { const V = Views[ui.view] || Views.block; return (V.props || V.inspector)?.() || panelNote('Nothing to set here.'); } });
