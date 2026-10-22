/* Command search (Ctrl+K) and the keyboard shortcut sheet.
   The palette searches every menu command for the workspace you're in (the menus are the command
   registry: each item has a label, an action and a shortcut), plus workspaces, panels, blocks and
   fabrics. The shortcut sheet below is the one list of key bindings, grouped by where they work. */

// words quilters use that aren't in the command names
const CMD_SYNONYMS = { stitch: 'quilting', stitching: 'quilting', turn: 'rotate', spin: 'rotate', mirror: 'flip', hst: 'half square triangle seam', qst: 'quarter square triangle', yardage: 'fabric buy shopping', cut: 'cutting plan', binding: 'binding', pdf: 'print pattern', colour: 'color fabric palette', color: 'colour fabric palette', recolour: 'palette', undo: 'history', layer: 'quilting', applique: 'appliqué', sashing: 'sashing', border: 'border', zoom: 'zoom fit', dark: 'theme', light: 'theme' };
function commandList() {
  const out = [], seen = new Set();
  const add = c => { const k = c.label + '|' + c.act + '|' + (c.arg ?? ''); if (!seen.has(k)) { seen.add(k); out.push(c); } };
  for (const [k, name] of BAR_MENUS) {
    let items = [];
    try { items = MENUS[k](); } catch { items = []; }
    let head = '';
    for (const it of items) {
      if (it === '-') { head = ''; continue; }
      if (!it) continue;
      if (it.header) { head = it.header.replace(/<[^>]+>/g, ''); continue; }
      if (!it.act) continue;
      add({ label: it.label.replace(/<[^>]+>/g, '').trim(), path: `${name}${head ? ` › ${head}` : ''}`, act: it.act, arg: it.arg, kb: it.kb, checked: it.checked, disabled: !!it.disabled });
    }
  }
  VIEW_LIST.forEach((v, i) => add({ label: `Go to ${v.label}`, path: 'Workspace', act: 'view', arg: v.key, kb: String(i + 1) }));
  for (const [id, P] of Object.entries(Panels)) add({ label: `${dockFind(wsLayout(), id) ? 'Show' : 'Open'} the ${P.title} panel`, path: 'Window', act: 'openPanel', arg: id });
  for (const p of (typeof quiltParts === 'function' ? quiltParts() : [])) add({ label: `${p.label} (quilt)`, path: 'Layout › Quilt panel', act: 'goQuiltPart', arg: p.key });
  if (ui.view === 'layout' && ui.selCell && cellContent(ui.selCell)?.b) for (const [l, a] of [['Rotate the selected block', 'cellRotate'], ['Flip the selected block', 'cellFlip'], ['Clear the selected position', 'cellClear']]) add({ label: l, path: 'Layout › selected position', act: a });
  for (const [l, a, arg] of [['Rotate shapes 90°', 'selRotate', 'cw'], ['Flip shapes horizontally', 'selMirror', 'h'], ['Flip shapes vertically', 'selMirror', 'v'], ['Duplicate shapes', 'selDup'], ['Delete shapes', 'selDelete']]) if (ui.view === 'block' && selList().length) add({ label: l, path: 'Blocks › selection', act: a, arg });
  for (const id of doc.blockOrder) add({ label: `Open block: ${doc.blocks[id].name}`, path: 'Blocks', act: 'pickBlock', arg: id });
  doc.fabrics.forEach((f, i) => add({ label: `Fabric ${letterFor(i)}: ${f.name}`, path: 'Fabrics', act: 'fabricPopover', arg: f.id }));
  return out;
}
// Every word must match the command's name or menu path, directly or through one of its synonyms.
function scoreCommand(c, q) {
  if (!q) return c.disabled ? 0 : 1;
  // words that say what to do rather than what to find
  q = q.split(/\s+/).filter(w => !['open', 'show', 'go', 'to', 'the', 'a', 'an', 'add', 'new', 'make', 'my', 'panel'].includes(w)).join(' ') || q;
  const label = c.label.toLowerCase(), path = c.path.toLowerCase(), wordStart = (t, w) => t.split(/[^a-z0-9½¼¾"]+/).some(x => x.startsWith(w));
  let s = 0;
  for (const w of q.split(/\s+/).filter(Boolean)) {
    const syns = (CMD_SYNONYMS[w] || '').split(' ').filter(Boolean);
    if (label.startsWith(w)) s += 8;
    else if (wordStart(label, w)) s += 5;
    else if (syns.some(x => wordStart(label, x))) s += 3;
    else if (wordStart(path, w)) s += 1;
    else return 0;
  }
  return s;
}
let _pal = { list: [], i: 0, recent: [] };
try { _pal.recent = JSON.parse(localStorage.getItem('quiltthing.v4.recentCmds') || '[]'); } catch {}
Actions.commandPalette = () => {
  closeMenu();
  openModal(`<div class="palette"><div class="pal-in">${icon('search', 16)}<input type="text" id="pal-q" role="combobox" aria-expanded="true" aria-haspopup="listbox" aria-autocomplete="list" placeholder="Search commands, panels, blocks, fabrics…" aria-label="Search commands" aria-controls="pal-list" autocomplete="off" spellcheck="false"><kbd>Esc</kbd></div><div class="pal-list" id="pal-list" role="listbox" aria-label="Results"></div></div>`);
  $('#modal-root .modal').classList.add('palette-modal');
  const q = $('#pal-q');
  q.addEventListener('input', () => paletteFill(q.value));
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); _pal.i = clamp(_pal.i < 0 ? 0 : _pal.i + (e.key === 'ArrowDown' ? 1 : -1), 0, _pal.list.length - 1); paletteDraw(); }
    if (e.key === 'Enter') { e.preventDefault(); paletteRun(_pal.i); }
  });
  paletteFill('');
  setTimeout(() => q.focus(), 10);
};
function paletteFill(text) {
  const q = text.trim().toLowerCase(), all = commandList();
  let list = all.map(c => ({ c, s: scoreCommand(c, q) })).filter(x => x.s > 0);
  if (!q) { const r = _pal.recent.map(k => all.find(c => c.label === k)).filter(Boolean); list = [...r.map(c => ({ c, s: 99, recent: true })), ...list.filter(x => !r.includes(x.c))]; }
  list.sort((a, b) => b.s - a.s);
  _pal.list = list.slice(0, 60).map(x => ({ ...x.c, recent: x.recent }));
  _pal.i = q ? 0 : -1;
  paletteDraw();
}
function paletteDraw() {
  const el = $('#pal-list'); if (!el) return;
  el.innerHTML = _pal.list.length ? _pal.list.map((c, i) => `<div class="pal-item${i === _pal.i ? ' on' : ''}${c.disabled ? ' off' : ''}" role="option" id="pal-o${i}" aria-selected="${i === _pal.i}" aria-disabled="${!!c.disabled}" data-act="palRun" data-arg="${i}" title="${c.disabled ? 'Not available right now' : ''}"><span class="pal-l">${c.checked ? `${icon('check', 13)} ` : ''}${esc(c.label)}</span><span class="pal-p">${c.recent ? 'Recent · ' : ''}${esc(c.path)}</span>${c.kb ? `<kbd>${esc(c.kb)}</kbd>` : ''}</div>`).join('')
    : '<p class="hint pad">Nothing matches. Try other words, like "border", "print" or "yardage".</p>';
  $('#pal-q')?.setAttribute('aria-activedescendant', `pal-o${_pal.i}`);
  el.querySelector('.pal-item.on')?.scrollIntoView({ block: 'nearest' });
}
function paletteRun(i) {
  const c = _pal.list[+i]; if (!c) return;
  if (c.disabled) { toast(`${c.label} isn't available right now`); return; }
  _pal.recent = [c.label, ..._pal.recent.filter(x => x !== c.label)].slice(0, 6);
  try { localStorage.setItem('quiltthing.v4.recentCmds', JSON.stringify(_pal.recent)); } catch {}
  closeModal();
  const fn = Actions[c.act];
  if (fn) { nextCommitLabel = c.label; fn(c.arg, $('#ctxbar'), null); setTimeout(() => { nextCommitLabel = null; }, 0); }
}
Actions.palRun = i => paletteRun(i);
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if ($('.palette')) closeModal(); else Actions.commandPalette(); }
}, true);

/* ---------- the shortcut sheet: the one list of key bindings ---------- */
const SHORTCUTS = [
  ['Everywhere', [
    ['Ctrl K', 'Search commands, panels, blocks and fabrics'], ['1 – 5', 'Go to a workspace'], ['Ctrl Z', 'Undo'], ['Ctrl Shift Z  or  Ctrl Y', 'Redo'],
    ['Ctrl S', 'Save in this browser'], ['Ctrl Shift S', 'Save as'], ['Ctrl O', 'Open a saved quilt'], ['Ctrl P', 'Print the pattern'],
    ['G', 'Value view (greys only)'], ['Ctrl .', 'Hide or show panels'], ['F6  /  Shift F6', 'Move between the menus, tool options, tools, panels, canvas and status bar'], ['?', 'Help'], ['Alt + letter', 'Open a menu (Alt F = File…)'], ['Esc', 'Close a menu or dialog, cancel'],
  ]],
  ['Canvas (Blocks, Layout, Quilting)', [
    ['H', 'Hand tool: drag to move around'], ['Z', 'Zoom tool: click to zoom in, Alt-click to zoom out'], ['Ctrl + scroll', 'Zoom at the pointer'], ['+  −', 'Zoom in or out'], ['0  or  Shift 1', 'Fit'], ['Scroll', 'Pan when zoomed in'], ['Space + drag  or  middle drag', 'Pan'],
  ]],
  ['Blocks', [
    ['V', 'Paint'], ['F', 'Fill'], ['S', 'Select'], ['E', 'Eraser (with shapes selected: rotate)'], ['P', 'Shape'], ['R', 'Rectangle'], ['T', 'Triangle'], ['C', 'Quarter circle'], ['K', 'Seam line'], ['L', 'Text'],
    ['Enter', 'Finish a shape'], ['Backspace', 'Remove the last point'], ['Delete', 'Delete the selected shapes'], ['Arrow keys', 'Nudge the selection (Shift: half steps)'],
    ['Ctrl A', 'Select all shapes'], ['Ctrl C / Ctrl V', 'Copy, paste'], ['Ctrl D', 'Duplicate'], ['Q / E', 'Rotate the selection'], ['X / Y', 'Flip the selection'],
    ['Shift-click', 'Add to the selection'], ['Alt-click', 'Pick up a fabric (Paint)'], ['Alt-click an edge handle', 'Add a corner'], ['Double-click a corner', 'Remove it'], ['Shift', 'Half-grid steps while drawing'],
  ]],
  ['Layout', [
    ['B', 'Place'], ['V', 'Paint'], ['S', 'Select'], ['R', 'Turn the block under the pointer or selected (Shift R: other way)'], ['F', 'Flip it'], ['Delete', 'Clear it'], ['Shift-click', 'Place mirrored'], ['Right-click', 'Clear a position'],
  ]],
  ['Fabric & cutting, Pattern', [['V', 'Select (text on the page)'], ['H', 'Hand: drag the page'], ['Ctrl P', 'Print the pattern or save it as a PDF']]],
  ['Length boxes', [['↑ ↓', 'Step ⅛" (0.5 cm); Shift 1" (1 cm); Alt 1/16" (1 mm)'], ['Esc', 'Put the old value back'], ['2-1/2  or  3 1/2 + 1/4', 'Quilting fractions and sums work; +1/4, *2 and 50% change the current value']]],
  ['Panels', [['Arrow keys on a tab', 'Next or previous panel in the group'], ['Right-click a tab', 'Move, fold or close the panel'], ['Arrow keys on a divider', 'Resize (Enter or double-click resets)'], ['Ctrl .', 'Hide or show all panels']]],
];
Actions.shortcuts = () => {
  openModal(`<h2>Keyboard shortcuts</h2><input type="text" class="sc-search" placeholder="Filter" aria-label="Filter shortcuts" data-input="scFilter">
    <div class="shortcuts" id="sc-list">${shortcutsHtml('')}</div><div class="actions"><button class="btn primary" data-act="closeModal">Done</button></div>`);
  $('#modal-root .modal').classList.add('wide');
};
function shortcutsHtml(q) {
  q = q.trim().toLowerCase();
  return SHORTCUTS.map(([g, rows]) => { const r = rows.filter(([k, d]) => !q || k.toLowerCase().includes(q) || d.toLowerCase().includes(q) || g.toLowerCase().includes(q)); return r.length ? `<h4>${g}</h4>${r.map(([k, d]) => `<div><kbd>${esc(k)}</kbd><span>${esc(d)}</span></div>`).join('')}` : ''; }).join('') || '<p class="hint">No shortcut matches.</p>';
}
Actions.scFilter = v => { const el = $('#sc-list'); if (el) el.innerHTML = shortcutsHtml(v); };

Actions.goQuiltPart = k => { ui.quiltPart = k; ui.selCell = null; if (ui.view !== 'layout') ui.view = 'layout'; saveUi(); render(); Actions.openPanel('props'); };
