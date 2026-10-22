/* The canvas HUD: small widgets in the corners of the canvas. Each widget can be shown or hidden
   and placed in any corner from View ▸ HUD ▸ Customise (no dragging needed); choices are kept
   in prefs.hud. Widgets only appear in the workspaces they apply to. */

const HUD_WIDGETS = {
  info: { label: 'Info line', corner: 'tl', ws: ['block', 'layout', 'quilting'], html: hudInfo },
  value: { label: 'Value view reminder', corner: 'tl', ws: [], html: () => ui.grayscale ? `<button class="hud-badge" data-act="toggleUi" data-arg="grayscale" title="Turn Value view off (G)">${icon('eye', 14)} Value view · G to turn off</button>` : '' },
  view: { label: 'View switches', corner: 'tr', ws: ['block', 'layout', 'quilting'], html: () => { const h = viewToggles(); return h ? `<div class="hud-group" role="toolbar" aria-label="View">${h}</div>` : ''; } },
  zoom: { label: 'Zoom', corner: 'br', ws: ['block', 'layout', 'quilting'], html: hudZoom },
};
const hudPref = id => ({ show: true, corner: HUD_WIDGETS[id].corner, ...(prefs.hud?.[id] || {}) });
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
  const corners = { tl: [], tr: [], bl: [], br: [] }, ws = curWs();
  for (const [id, w] of Object.entries(HUD_WIDGETS)) {
    const p = hudPref(id);
    if (!p.show || (w.ws.length && !w.ws.includes(ws))) continue;
    let h = '';
    try { h = w.html(); } catch (e) { console.error(e); }
    if (h) corners[p.corner in corners ? p.corner : w.corner].push(`<div class="hud-w" data-hud="${id}">${h}</div>`);
  }
  preserveFocus(hud, () => { hud.innerHTML = Object.entries(corners).map(([c, list]) => `<div class="hud-c ${c}">${list.join('')}</div>`).join(''); });
  hud.classList.toggle('with-rulers', !!prefs.rulers);
  if (typeof drawRulers === 'function') requestAnimationFrame(drawRulers);
}
Actions.hudCustomise = () => {
  const row = id => { const p = hudPref(id); return `<div class="hud-row"><label class="check"><input type="checkbox" data-change="hudShow" data-arg="${id}" ${p.show ? 'checked' : ''}> ${HUD_WIDGETS[id].label}</label>
    <select data-change="hudCorner" data-arg="${id}" aria-label="Corner for ${HUD_WIDGETS[id].label}">${[['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']].map(([k, l]) => `<option value="${k}" ${p.corner === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`; };
  openModal(`<h2>Customise the canvas HUD</h2><p class="hint">Choose which controls float over the canvas, and in which corner.</p><div class="hud-rows">${Object.keys(HUD_WIDGETS).map(row).join('')}</div>
    <div class="actions"><button class="btn" data-act="hudReset">Reset</button><button class="btn primary" data-act="closeModal">Done</button></div>`);
};
const setHud = (id, patch) => { prefs.hud = { ...(prefs.hud || {}), [id]: { ...hudPref(id), ...patch } }; savePrefs(); renderHud(); };
Actions.hudShow = (v, el) => setHud(el.dataset.arg, { show: !!v });
Actions.hudCorner = (v, el) => setHud(el.dataset.arg, { corner: v });
Actions.hudToggle = id => setHud(id, { show: !hudPref(id).show });
Actions.hudReset = () => { prefs.hud = {}; savePrefs(); renderHud(); closeModal(); toast('The HUD is back to its starting setup'); };
