/* Smaller pieces of the v4 interface: the welcome screen, the second-tab guard, F6 region
   cycling, length fields that step and explain mistakes, the cursor position in the status bar,
   and the selection-size HUD widget. */

/* ---------- welcome: one screen for new people and for v3 users ---------- */
function welcomeV4() {
  const v3 = !!localStorage.getItem('quiltthing.v3.ui');
  const theme = t => `<button class="btn${prefs.theme === t ? ' primary' : ''}" data-act="welcomeTheme" data-arg="${t}" aria-pressed="${prefs.theme === t}">${t === 'dark' ? 'Dark' : 'Light'}</button>`;
  openModal(`<h2>${v3 ? 'Welcome to the new Quilt Designer' : 'Quilt Designer'}</h2>
    <p>${v3 ? 'Everything you had is here, in a new layout. Your quilts, fabrics and saved designs carry over.' : 'Design blocks, lay out a quilt and print the pattern. Your work saves in this browser.'}</p>
    ${v3 ? `<div class="moved"><h4>Where things moved</h4><ul>
      <li><b>Steps</b> are the tabs at the top: Blocks, Layout, Quilting, Fabric &amp; cutting, Pattern.</li>
      <li><b>Tools</b> are the strip down the left; their options are in the bar above the canvas.</li>
      <li><b>Fabrics and blocks</b> are panels on the left; <b>settings</b> are in Properties on the right.</li>
      <li>Layout's borders, sashing, binding and panels are listed in the <b>Quilt</b> panel.</li>
      <li>Panels can be moved, folded or closed. <b>Window</b> brings any panel back and resets the layout.</li>
      <li>Press <kbd>Ctrl K</kbd> to search for any command.</li></ul></div>` : ''}
    <div class="welcome-prefs"><span>Look</span><div class="btn-row" style="margin:0">${theme('dark')}${theme('light')}</div>
      <label class="f" style="margin:0">Around the quilt<select data-change="setSurround">${Object.entries(SURROUNDS).map(([k, [l]]) => `<option value="${k}" ${prefs.surround === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="check" style="margin:0"><input type="checkbox" data-change="welcomeLarge" ${prefs.density === 'large' ? 'checked' : ''}> Larger text</label></div>
    <div class="actions welcome-actions"><button class="btn" data-act="welcomeBlank">Start blank</button><button class="btn" data-act="welcomeClassic">Start from a classic block</button><span class="grow"></span><button class="btn primary" data-act="closeModal">${v3 ? 'Carry on' : 'Explore the sample'}</button></div>`,
    () => { prefs.welcomed = true; ui.seenTour = true; savePrefs(); saveUi(); });
  $('#modal-root .modal').classList.add('wide');
}
Actions.welcomeTheme = t => { prefs.theme = t; savePrefs(); applyPrefs(); render(); welcomeV4(); };
Actions.welcomeLarge = v => { prefs.density = v ? 'large' : 'standard'; savePrefs(); applyPrefs(); render(); };
Actions.whatsNew = () => { const w = prefs.welcomed; welcomeV4(); prefs.welcomed = w; };

/* ---------- second tab: warn when the design changes somewhere else ---------- */
window.addEventListener('storage', e => {
  if (e.key !== 'quiltthing.v3.doc' || !e.newValue || e.newValue === snapshot()) return;
  let bar = $('#tab-guard');
  if (!bar) { bar = document.createElement('div'); bar.id = 'tab-guard'; bar.setAttribute('role', 'alert'); document.body.appendChild(bar); }
  bar.innerHTML = `${icon('warn', 16)}<span>This design was changed in another tab or window. Saving here would replace that work.</span><button class="btn small primary" data-act="tabGuardLoad">Load the other version</button><button class="btn small" data-act="tabGuardKeep">Keep this one</button>`;
});
Actions.tabGuardLoad = () => location.reload();
Actions.tabGuardKeep = () => { $('#tab-guard')?.remove(); saveNow(); toast('Kept this version'); };

/* ---------- F6: jump between regions (app bar, tool options, tools, panels, canvas, status) ---------- */
const REGIONS = ['#appbar', '#ctxbar', '#toolstrip', '#dock-left', '#docarea', '#dock-right', '#dock-bottom', '#float-layer', '#statusbar'];
document.addEventListener('keydown', e => {
  if (e.key !== 'F6' || $('#modal-root').innerHTML) return;
  e.preventDefault();
  const live = REGIONS.map(s => $(s)).filter(el => el && el.offsetParent !== null && el.querySelector('button, input, select, [tabindex]'));
  if (!live.length) return;
  const i = live.findIndex(el => el.contains(document.activeElement));
  const next = live[(i + (e.shiftKey ? -1 : 1) + live.length) % live.length];
  // the selected tab or pressed tool first, else the first visible control
  const shown = sel => [...next.querySelectorAll(sel)].find(x => x.offsetParent !== null && !x.disabled);
  const target = next.id === 'docarea' ? $('#main') : shown('[aria-selected="true"][tabindex="0"]') || shown('[aria-pressed="true"]') || shown('button, input, select, [tabindex="0"]');
  target?.focus();
  announce(next.getAttribute('aria-label') || next.id.replace(/^dock-/, '') + ' panels');
});

/* ---------- length fields: arrow keys step, Esc puts the old value back, mistakes shown on the field ---------- */
document.addEventListener('focusin', e => { const el = e.target; if (el.matches?.('input[data-type="len"]')) el.dataset.was = el.value; });
document.addEventListener('keydown', e => {
  const el = e.target;
  if (!el.matches?.('input[data-type="len"]')) return;
  if (e.key === 'Escape') { el.value = el.dataset.was ?? el.value; el.classList.remove('invalid'); el.nextElementSibling?.classList?.contains('field-err') && el.nextElementSibling.remove(); el.blur(); e.stopPropagation(); return; }
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
  e.preventDefault();
  const path = el.dataset.bind, cur = parseLenExpr(el.value, getPath(doc, path));
  if (!Number.isFinite(cur)) return;
  const step = (e.shiftKey ? 1 : e.altKey ? 1 / 16 : 1 / 8) * (ui.units === 'cm' ? 2.54 / 2.54 : 1);
  const lo = el.dataset.min !== undefined ? +el.dataset.min : 0, hi = el.dataset.max !== undefined ? +el.dataset.max : Infinity;
  const v = clamp(Math.round((cur + (e.key === 'ArrowUp' ? step : -step)) / step) * step, lo, hi);
  el.value = inputLen(v);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, true);
// a length that can't be read: say so on the field and keep the old value
function lenFieldError(el, raw) {
  el.classList.add('invalid');
  let msg = el.parentElement.querySelector('.field-err');
  if (!msg) { msg = document.createElement('div'); msg.className = 'field-err'; msg.setAttribute('role', 'alert'); el.insertAdjacentElement('afterend', msg); }
  msg.textContent = `Couldn't read "${raw}". Try 4.5, 4 1/2, 4-1/2, 4½ or 11cm.`;
  el.value = el.dataset.was ?? el.value;
  setTimeout(() => el.focus(), 0);
}

/* ---------- cursor position in the status bar ---------- */
document.addEventListener('pointermove', e => {
  const chip = $('#sb-pos'); if (!chip) return;
  const svg = e.target.closest?.('#main svg.editor, #main svg.quilt-svg');
  if (!svg) { chip.textContent = ''; return; }
  let x, y;
  try {
    if (svg.classList.contains('editor')) { const b = activeBlock(); if (!b || b.kind !== 'drawn') return; const g = evtGrid(e, b), k = blockFrameSize(b) / b.n; [x, y] = [g[0] * k, g[1] * k]; }
    else [x, y] = svgPoint(svg, e);
  } catch { return; }
  chip.textContent = `${fmtLen(Math.max(0, x))}, ${fmtLen(Math.max(0, y))}`;
}, { passive: true });

/* ---------- HUD: size of the selected shape ---------- */
HUD_WIDGETS.selsize = {
  label: 'Selected shape size', corner: 'bl', ws: ['block'],
  html: () => {
    const b = activeBlock(); if (!b || b.kind !== 'drawn' || ui.tool !== 'select') return '';
    const sel = selList(); if (!sel.length) return '';
    const k = blockFrameSize(b) / b.n, pts = sel.flatMap(i => b.regions[i].pts), bb = bounds(pts);
    const name = sel.length === 1 ? regionName(b, b.regions[sel[0]]) : plural(sel.length, 'shape');
    return `<div class="hud-info"><b>${esc(name)}</b> · ${fmtSize(bb.w * k, bb.h * k)} finished</div>`;
  },
};
