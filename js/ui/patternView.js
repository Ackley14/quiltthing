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
    let h = section('Print', `<button class="btn primary block" data-act="printPattern">🖨 Print / Save as PDF</button>
      <p class="hint">In the print dialog choose <b>Save as PDF</b> to get a file. Keep scale at <b>100%</b> (or "Actual size") so templates print true to size, and turn on <b>Background graphics</b> so fabric colours print.</p>
      ${selectField('Paper size', 'ui.patternPage', [['letter', 'US Letter'], ['a4', 'A4']])}`, { key: 'print' });
    h += section('Cover details', `
      <label class="f">Quilt name<input type="text" data-bind="meta.title" value="${esc(m.title)}"></label>
      <label class="f">Designer<input type="text" data-bind="meta.designer" value="${esc(m.designer)}" placeholder="Your name"></label>
      <label class="f">Description<textarea data-bind="meta.description" placeholder="A sentence or two about the quilt…">${esc(m.description)}</textarea></label>
      ${selectField('Skill level', 'meta.skill', [['auto', 'Automatic'], ['Beginner', 'Beginner'], ['Confident beginner', 'Confident beginner'], ['Intermediate', 'Intermediate'], ['Advanced', 'Advanced']])}`, { key: 'cover' });
    h += section('What’s inside', `<ul class="hint" style="padding-left:18px;margin:0">
      <li>Cover with finished size and skill level</li><li>Materials, fabric key and yardage</li><li>Cutting instructions for every fabric</li>
      <li>True-size templates (if any shapes need them)</li><li>Step-by-step diagrams for each block</li><li>Quilt top assembly and borders</li>
      <li>Quilting plan${doc.quilting.layers.length ? '' : ' (add one in Quilting)'}</li><li>Backing, basting, binding and finishing</li></ul>`, { key: 'inside' });
    return h;
  },
};
