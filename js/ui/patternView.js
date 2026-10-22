/* Pattern view: live preview of the printable pattern + cover details. */

Views.pattern = {
  tools() { return { act: 'docTool', active: ui.docTool || 'pointer', list: [{ key: 'pointer', label: 'Select', kb: 'S', icon: 'pointer' }, { key: 'hand', label: 'Hand', kb: 'H', icon: 'hand' }, { key: 'zoom', label: 'Zoom', kb: 'Z', icon: 'zoomin' }] }; },
  docs() { return [{ label: `${doc.meta.title || 'Quilt'} · pattern`, on: true, icon: 'pages' }]; },
  options() {
    const a4 = ui.patternPage === 'a4';
    // before printing: anything that would make a poor pattern
    const Q = Qnow(), warn = [...Q.warnings, ...seamWarnings(), ...(doc.meta.title === 'Untitled quilt' ? ['The quilt has no name yet. Name it in Properties.'] : [])];
    return `<button class="btn primary small" data-act="printPattern" title="In the print dialog: Save as PDF for a file, scale 100%, background graphics on">${icon('print', 14)} Print pattern</button><span class="sep"></span>
      <span class="tb-label">Paper</span>
      <div class="seg" role="group" aria-label="Paper size"><button aria-pressed="${!a4}" data-act="setUi" data-arg="patternPage=letter">US Letter</button><button aria-pressed="${a4}" data-act="setUi" data-arg="patternPage=a4">A4</button></div>
      ${warn.length ? `<span class="sep"></span><span class="tb-warn" title="${esc(warn.join(' '))}">${esc(warn[0])}${warn.length > 1 ? ` (+${warn.length - 1})` : ''}</span>` : ''}
`;
  },
  main() {
    const a4 = ui.patternPage === 'a4';
    return `<div class="pattern-preview" id="pattern-preview">${renderPatternDoc().replace(/class="page /g, `class="page ${a4 ? 'a4 ' : ''}`)}</div>`;
  },
  afterMain(el) {
    const pv = el.querySelector('#pattern-preview');
    if (!pv) return;
    pv.style.zoom = '';
    paginatePattern(pv);
    const pageW = (ui.patternPage === 'a4' ? 8.27 : 8.5) * 96;
    const z = Math.min(1, (el.clientWidth - 32) / pageW) * docZoom();
    pv.style.zoom = Math.abs(z - 1) > 1e-3 ? String(round(z, 3)) : '';
    // after a redraw, stay on the same page at the same place (pages are rebuilt, so the old scroll position is meaningless)
    const a = _patAnchor, pg = a && pv.querySelectorAll('.page')[a.i];
    if (pg) el.scrollTop += pg.getBoundingClientRect().top - el.getBoundingClientRect().top + a.f * pg.getBoundingClientRect().height;
  },
  props() { return Views.pattern.inspector(); },
  inspector() {
    const m = doc.meta;
    let h = '';
    h += section('Cover', `
      <label class="f">Quilt name<input type="text" data-bind="meta.title" value="${esc(m.title)}"></label>
      <label class="f">Designer<input type="text" data-bind="meta.designer" value="${esc(m.designer)}" placeholder="Your name"></label>`, { key: 'cover' });
    h += section('Description and skill level', `
      <label class="f">Description<textarea data-bind="meta.description">${esc(m.description)}</textarea></label>
      ${selectField('Skill level', 'meta.skill', [['auto', 'Automatic'], ['Beginner', 'Beginner'], ['Confident beginner', 'Confident beginner'], ['Intermediate', 'Intermediate'], ['Advanced', 'Advanced']])}`, { key: 'cover2', closed: true });
    return h;
  },
};

/* ---------- pagination ----------
   Each pattern section is written as one page; anything longer is split here into sheet-sized
   pages, so the preview and the printout show the same sheets. Lists, cutting cards, template
   groups and grids split between their items; a heading never ends a page on its own. */
const PAGE_FLOW_IN = 9.3;                       // usable height inside the 0.5in margins, less the footer
const SPLITTABLE = el => el.matches('ol, ul, .cut-fab, .cut-cols, .tpls, .piece-key, .atlas');
const isHeading = el => /^H[1-4]$/.test(el.tagName);
// Splits `node` so its part above `limit` (px, viewport) stays; returns the part to move, 'all', or null.
function splitAt(node, limit) {
  const r = node.getBoundingClientRect();
  if (r.bottom <= limit + 1) return null;
  if (!SPLITTABLE(node) || r.top >= limit - 48) return 'all';
  const kids = [...node.children];
  if (node.matches('.cut-cols')) {
    // the cutting list splits; the map beside it stays with the first part
    const list = kids.find(k => k.matches('ol'));
    if (kids.some(k => k !== list && k.getBoundingClientRect().bottom > limit + 1)) return 'all';   // the map doesn't fit
    const part = list && splitAt(list, limit);
    if (!part || part === 'all') return part === null ? null : 'all';
    const shell = node.cloneNode(false);
    shell.appendChild(part);
    return shell;
  }
  const k = kids.findIndex(c => c.getBoundingClientRect().bottom > limit + 1);
  if (k < 0) return null;
  let cut = k, part = splitAt(kids[k], limit);
  if (part === 'all') part = null; else if (part) cut = k + 1;
  // keep a heading with what follows it
  while (cut > 0 && !part && isHeading(kids[cut - 1])) cut--;
  if (cut === 0 && !part) return 'all';
  const shell = node.cloneNode(false);
  if (node.tagName === 'OL') shell.setAttribute('start', (+node.getAttribute('start') || 1) + cut);
  if (part) shell.appendChild(part);
  for (const c of kids.slice(part ? k + 1 : cut)) shell.appendChild(c);
  return shell;
}
function paginatePattern(root) {
  let guard = 400;
  for (let page = root.querySelector('.page'); page && guard--; page = page.nextElementSibling) {
    if (!page.classList.contains('page')) continue;
    // measured from the content box: the print styles drop the page padding (the paper margin replaces it)
    const top = page.getBoundingClientRect().top + parseFloat(getComputedStyle(page).paddingTop);
    const limit = top + (PAGE_FLOW_IN + (ui.patternPage === 'a4' ? 0.69 : 0)) * 96;
    const foot = page.querySelector(':scope > footer');
    const kids = [...page.children].filter(c => c !== foot);
    let i = kids.findIndex(c => c.getBoundingClientRect().bottom > limit + 1);
    if (i < 0) continue;
    const moved = [];
    let part = splitAt(kids[i], limit);
    if (part === 'all' || part === null) { part = null; while (i > 0 && isHeading(kids[i - 1])) i--; moved.push(...kids.slice(i)); }
    else moved.push(part, ...kids.slice(i + 1));
    if (!moved.length || (moved.length === kids.length && !part)) continue;   // a single block bigger than a page: leave it
    const next = page.cloneNode(false);
    next.classList.remove('cover');
    for (const m of moved) next.appendChild(m);
    if (foot) next.appendChild(foot.cloneNode(true));
    page.after(next);
  }
}

/* ---------- the Pages panel: the pattern's pages, by section ---------- */
// A page without its own heading continues the section before it.
function patternPages() {
  let last = 'Cover';
  return $$('#pattern-preview .page').map((pg, i) => {
    const h = i === 0 ? 'Cover' : pg.querySelector('h1, h2')?.textContent.trim();
    if (h) last = h;
    return { i, title: last, cont: !h };
  });
}
function pagesPanel() {
  if (ui.view !== 'pattern') return panelNote('The pattern\'s pages show here in the Pattern workspace.', ['view', 'pattern'], 'Go to Pattern');
  const pages = patternPages();
  if (!pages.length) return panelNote('Building the pages…');
  // one row a section, with its page range (a section that runs over several pages is one row)
  const groups = [];
  for (const p of pages) if (p.cont && groups.length) groups[groups.length - 1].to = p.i; else groups.push({ from: p.i, to: p.i, title: p.title });
  let h = '';
  for (const g of groups) {
    const range = g.to > g.from ? `${g.from + 1}–${g.to + 1}` : `${g.from + 1}`;
    h += `<button class="page-row" data-act="goPage" data-arg="${g.from}" data-page="${g.from}" data-to="${g.to}" aria-label="${g.to > g.from ? `Pages ${range}` : `Page ${range}`}: ${esc(g.title)}"><span class="pg-n">${range}</span><span class="pg-t">${esc(g.title)}</span></button>`;
  }
  return `<div class="panel-tools"><span class="pt-note">${plural(pages.length, 'page')} · ${ui.patternPage === 'a4' ? 'A4' : 'US Letter'}</span></div><div class="page-list" aria-label="Pages">${h}</div>`;
}
Actions.goPage = i => { $$('#pattern-preview .page')[+i]?.scrollIntoView({ block: 'start' }); markCurrentPage(); };
// highlight the page in view, and say "Page n of N" in the status bar
function markCurrentPage() {
  const pages = $$('#pattern-preview .page'), box = $('#main').getBoundingClientRect();
  let cur = 0;
  pages.forEach((pg, i) => { if (pg.getBoundingClientRect().top < box.top + box.height / 3) cur = i; });
  $$('.page-row').forEach(r => r.setAttribute('aria-current', cur >= +r.dataset.page && cur <= +(r.dataset.to ?? r.dataset.page)));
  const st = $('#statusbar .sb-l');
  if (st && ui.view === 'pattern') st.textContent = pages.length ? `Page ${cur + 1} of ${pages.length}` : '';
}
$('#main')?.addEventListener('scroll', debounce(() => { if (ui.view === 'pattern') markCurrentPage(); }, 60));
// which page is at the top of the view, and how far into it (as a fraction, so a zoom change keeps the place)
let _patAnchor = null;
$('#main')?.addEventListener('scroll', () => {
  if (ui.view !== 'pattern') return;
  const top = $('#main').getBoundingClientRect().top, pages = $$('#pattern-preview .page'), i = pages.findIndex(p => p.getBoundingClientRect().bottom > top + 1);
  if (i >= 0) { const r = pages[i].getBoundingClientRect(); _patAnchor = { i, f: (top - r.top) / (r.height || 1) }; }
}, { passive: true });
registerPanel('pages', { title: 'Pages', short: 'Pages', icon: 'pages', ws: ['pattern'], render: pagesPanel, after: () => markCurrentPage() });
