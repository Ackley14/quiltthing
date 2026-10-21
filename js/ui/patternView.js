/* Pattern view: live preview of the printable pattern + cover details. */

Views.pattern = {
  main() {
    const a4 = ui.patternPage === 'a4';
    return `<div class="pattern-preview" id="pattern-preview">${renderPatternDoc().replace(/class="page /g, `class="page ${a4 ? 'a4 ' : ''}`)}</div>`;
  },
  afterMain(el) {
    const pv = el.querySelector('#pattern-preview');
    if (!pv) return;
    const pageW = (ui.patternPage === 'a4' ? 8.27 : 8.5) * 96;
    const z = Math.min(1, (el.clientWidth - 32) / pageW);
    pv.style.zoom = z < 1 ? String(round(z, 3)) : '';
  },
  inspector() {
    const m = doc.meta;
    let h = section('Print', `<button class="btn primary block" data-act="printPattern">${icon('print')} Print pattern</button>
      ${selectField('Paper size', 'ui.patternPage', [['letter', 'US Letter'], ['a4', 'A4']])}
      <p class="hint">In the print dialog: Save as PDF for a file, scale 100%, background graphics on.</p>`, { key: 'print' });
    h += section('Cover', `
      <label class="f">Quilt name<input type="text" data-bind="meta.title" value="${esc(m.title)}"></label>
      <label class="f">Designer<input type="text" data-bind="meta.designer" value="${esc(m.designer)}" placeholder="Your name"></label>`, { key: 'cover' });
    h += section('Description and skill level', `
      <label class="f">Description<textarea data-bind="meta.description">${esc(m.description)}</textarea></label>
      ${selectField('Skill level', 'meta.skill', [['auto', 'Automatic'], ['Beginner', 'Beginner'], ['Confident beginner', 'Confident beginner'], ['Intermediate', 'Intermediate'], ['Advanced', 'Advanced']])}`, { key: 'cover2', closed: true });
    return h;
  },
};
