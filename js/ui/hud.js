/* The canvas HUD: small widgets in the corners of the canvas. Each widget can be shown or hidden
   and placed in any corner from View ▸ HUD ▸ Customise (no dragging needed); choices are kept
   in prefs.hud. Widgets only appear in the workspaces they apply to. */

const HUD_WIDGETS = {
  info: { label: 'Info line', corner: 'tl', ws: ['block', 'layout', 'quilting'], html: hudInfo },
  value: { label: 'Value view reminder', corner: 'tl', ws: [], html: () => ui.grayscale ? `<button class="hud-badge" data-act="toggleUi" data-arg="grayscale" title="Turn Value view off (G)">${icon('eye', 14)} Value view · G to turn off</button>` : '' },
  view: { label: 'View switches', corner: 'tr', ws: ['block', 'layout', 'quilting'], html: () => {
    const items = viewToggleItems(); if (!items.length) return '';
    // a narrow canvas gets one View button instead of a row of switches
    if (($('#docarea')?.clientWidth || 1000) < 820) return `<div class="hud-group"><button class="tool" data-act="viewMenu" aria-haspopup="menu">${icon('eye', 14)} View${items.some(t => t.on && t.arg !== 'grayscale') ? ' ·' : ''} ${icon('down', 12)}</button></div>`;
    return `<div class="hud-group" role="toolbar" aria-label="View">${viewToggles()}</div>`;
  } },
  zoom: { label: 'Zoom', corner: 'br', ws: ['block', 'layout', 'quilting'], html: hudZoom },
};
// Settings per workspace (prefs.hud[ws][id]); older settings saved for every workspace still count.
const hudPref = (id, ws = curWs()) => ({ show: true, corner: HUD_WIDGETS[id].corner, order: Object.keys(HUD_WIDGETS).indexOf(id), ...(prefs.hud?.[id] || {}), ...(prefs.hud?.[ws]?.[id] || {}) });
const hudFor = (ws = curWs()) => Object.keys(HUD_WIDGETS).filter(id => !HUD_WIDGETS[id].ws.length || HUD_WIDGETS[id].ws.includes(ws));
function hudInfo() {
  if (ui.view === 'block') {
    const b = activeBlock(); if (!b) return '';
    if (b.kind === 'compound') return `<div class="hud-info"><b>${esc(b.name)}</b> · ${fmtLen(doc.layout.blockSize)} combination block</div>`;
    const S = blockFrameSize(b);
    return `<div class="hud-info"><b>${esc(b.name)}</b> · ${isHexBlock(b) ? `hexagon ${fmtLen(S / 2)} sides` : `${fmtSize(S, S)} · ${b.n} × ${b.n} grid · ${fmtLen(S / b.n)} squares`}</div>`;
  }
  if (ui.view === 'layout') { const Q = Qnow(); return `<div class="hud-info"><b>${fmtSize(Q.W, Q.H)}</b> · ${esc(layoutCountText(Q))}</div>`; }
  if (ui.view === 'quilting') {
    const n = doc.quilting.layers.length, on = doc.quilting.layers.filter(l => l.visible !== false).length;
    return `<div class="hud-info"><b>${ui.qSide === 'back' ? 'Back' : 'Front'}</b> · ${n ? `${plural(n, 'quilting layer')}${on < n ? `, ${on} showing` : ''}` : 'no quilting yet'}</div>`;
  }
  return '';
}
function hudZoom() {
  const block = ui.view === 'block';
  if (block && activeBlock()?.kind !== 'drawn') return '';
  const z = block ? edZoom() : qzZoom(), act = block ? 'edZoomBy' : 'qZoomBy', id = block ? 'ed-zoom' : 'q-zoom';
  return `<div class="hud-group zoom-ctl" role="group" aria-label="Zoom"><button class="tool" data-act="${act}" data-arg="out" title="Zoom out (−)" aria-label="Zoom out">${icon('minus', 14)}</button><button class="tool zoom-pct" id="${id}" data-act="${act}" data-arg="fit" title="Fit (0)">${Math.round(z * 100)}%</button><button class="tool" data-act="${act}" data-arg="in" title="Zoom in (+)" aria-label="Zoom in">${icon('plus', 14)}</button></div>`;
}
function renderHud() {
  const hud = $('#hud'); if (!hud) return;
  const corners = { tl: [], tr: [], bl: [], br: [] };
  for (const id of hudFor().sort((x, y) => hudPref(x).order - hudPref(y).order)) {
    const p = hudPref(id);
    if (!p.show) continue;
    let h = '';
    try { h = HUD_WIDGETS[id].html(); } catch (e) { console.error(e); }
    if (h) corners[p.corner in corners ? p.corner : HUD_WIDGETS[id].corner].push(`<div class="hud-w" data-hud="${id}">${h}</div>`);
  }
  preserveFocus(hud, () => { hud.innerHTML = Object.entries(corners).map(([c, list]) => `<div class="hud-c ${c}">${list.join('')}</div>`).join(''); });
  hud.classList.toggle('with-rulers', !!prefs.rulers);
  if (typeof drawRulers === 'function') requestAnimationFrame(drawRulers);
}
Actions.hudCustomise = () => {
  const ids = hudFor().sort((x, y) => hudPref(x).order - hudPref(y).order);
  const row = (id, i) => { const p = hudPref(id); return `<div class="hud-row"><label class="check"><input type="checkbox" data-change="hudShow" data-arg="${id}" ${p.show ? 'checked' : ''}> ${HUD_WIDGETS[id].label}</label>
    <select data-change="hudCorner" data-arg="${id}" aria-label="Corner for ${HUD_WIDGETS[id].label}">${[['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']].map(([k, l]) => `<option value="${k}" ${p.corner === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <span class="hud-ord"><button class="icon-btn sm" data-act="hudOrder" data-arg="${id}|-1" ${i ? '' : 'disabled'} aria-label="Move ${HUD_WIDGETS[id].label} up" title="Earlier in its corner">${icon('up', 14)}</button><button class="icon-btn sm" data-act="hudOrder" data-arg="${id}|1" ${i < ids.length - 1 ? '' : 'disabled'} aria-label="Move ${HUD_WIDGETS[id].label} down" title="Later in its corner">${icon('down', 14)}</button></span></div>`; };
  openModal(`<h2>Customise the canvas HUD</h2><p class="hint">For the ${esc(wsLabel(curWs()))} workspace: which controls float over the canvas, in which corner and in what order.</p><div class="hud-rows">${ids.map(row).join('')}</div>
    <div class="actions"><button class="btn" data-act="hudReset">Reset</button><button class="btn" data-act="hudAll">Use for every workspace</button><span class="grow"></span><button class="btn primary" data-act="closeModal">Done</button></div>`);
};
const setHud = (id, patch) => { const ws = curWs(); prefs.hud = { ...(prefs.hud || {}), [ws]: { ...(prefs.hud?.[ws] || {}), [id]: { ...hudPref(id), ...patch } } }; savePrefs(); renderHud(); };
Actions.hudShow = (v, el) => setHud(el.dataset.arg, { show: !!v });
Actions.hudCorner = (v, el) => setHud(el.dataset.arg, { corner: v });
Actions.hudToggle = id => setHud(id, { show: !hudPref(id).show });
Actions.hudOrder = arg => {
  const [id, d] = arg.split('|'), ids = hudFor().sort((x, y) => hudPref(x).order - hudPref(y).order), i = ids.indexOf(id), j = i + +d;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  ids.forEach((x, k) => setHud(x, { order: k }));
  Actions.hudCustomise();
};
Actions.hudAll = () => { const cur = Object.fromEntries(Object.keys(HUD_WIDGETS).map(id => [id, hudPref(id)])); for (const v of VIEW_LIST) prefs.hud = { ...(prefs.hud || {}), [v.key]: cur }; savePrefs(); renderHud(); toast('Every workspace uses this HUD setup'); };
Actions.hudReset = () => { const ws = curWs(); if (prefs.hud) delete prefs.hud[ws]; savePrefs(); renderHud(); closeModal(); toast('The HUD is back to its starting setup here'); };
