/* Fabric fills: solid colours or simple printed textures rendered as SVG <pattern>s.
   Patterns use inches as user units, so a 1" polka dot looks the same in every view. */

function fabricHex(id) { return fabricById(id).color; }
// Printed copies draw fabrics as flat colour: PDF output re-embeds a pattern fill every time it's
// used, which made printed patterns tens of megabytes. (The colour key still shows each print.)
let flatFills = false;
function fabricFill(id) {
  const f = fabricById(id);
  return f.print && f.print.kind !== 'solid' && !flatFills ? `url(#fp-${f.id})` : f.color;
}
function fabricLabel(id) { return fabricById(id).name; }

function hashStr(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

function printPatternSvg(f) {
  const p = f.print || {};
  if (!p.kind || p.kind === 'solid') return '';
  const t = Math.max(0.2, +p.scale || 1);
  const c1 = f.color, c2 = p.color2 || mix(f.color, '#ffffff', 0.5);
  const R = rng(hashStr(f.id));
  let inner = `<rect width="${t}" height="${t}" fill="${c1}"/>`;
  let transform = '';
  switch (p.kind) {
    case 'dots':
      inner += `<circle cx="${t * .25}" cy="${t * .25}" r="${t * .11}" fill="${c2}"/><circle cx="${t * .75}" cy="${t * .75}" r="${t * .11}" fill="${c2}"/>`;
      break;
    case 'speckle':
      for (let i = 0; i < 14; i++) inner += `<circle cx="${round(R() * t)}" cy="${round(R() * t)}" r="${round(t * (0.015 + R() * 0.03))}" fill="${c2}" opacity="${round(0.6 + R() * 0.4, 2)}"/>`;
      break;
    case 'stripes':
      inner += `<rect y="${t * .5}" width="${t}" height="${t * .5}" fill="${c2}"/>`;
      if (p.angle) transform = ` patternTransform="rotate(${p.angle})"`;
      break;
    case 'gingham':
      inner += `<rect width="${t / 2}" height="${t}" fill="${c2}" opacity=".45"/><rect width="${t}" height="${t / 2}" fill="${c2}" opacity=".45"/>`;
      break;
    case 'mottled':
      for (let i = 0; i < 7; i++) inner += `<ellipse cx="${round(R() * t)}" cy="${round(R() * t)}" rx="${round(t * (.12 + R() * .2))}" ry="${round(t * (.08 + R() * .15))}" fill="${c2}" opacity="${round(.18 + R() * .22, 2)}"/>`;
      break;
    case 'floral': {
      const fl = (cx, cy, r) => {
        let s = '';
        for (let k = 0; k < 5; k++) {
          const a = k * Math.PI * 2 / 5;
          s += `<circle cx="${round(cx + Math.cos(a) * r)}" cy="${round(cy + Math.sin(a) * r)}" r="${round(r * .62)}" fill="${c2}"/>`;
        }
        return s + `<circle cx="${cx}" cy="${cy}" r="${round(r * .45)}" fill="${mix(c1, '#000', .25)}"/>`;
      };
      inner += fl(t * .28, t * .3, t * .1) + fl(t * .75, t * .74, t * .08);
      break;
    }
  }
  return `<pattern id="fp-${f.id}" patternUnits="userSpaceOnUse" width="${t}" height="${t}"${transform}>${inner}</pattern>`;
}

// All print patterns for the current palette — inlined into exported SVGs, and kept
// once in a hidden <svg> in the page so every on-screen drawing can reference them.
function fabricDefs() { return doc.fabrics.map(printPatternSvg).join(''); }

function swatchHtml(id, size = 18, extraClass = '') {
  const f = fabricById(id);
  const inner = f.print && f.print.kind !== 'solid'
    ? `<svg viewBox="0 0 2 2" preserveAspectRatio="xMidYMid slice"><rect width="2" height="2" fill="url(#fp-${f.id})"/></svg>` : '';
  return `<span class="sw ${extraClass}" style="--sw:${size}px;background:${f.color}" title="${esc(f.name)}">${inner}</span>`;
}

// Letter key (A, B, C…) for fabrics in palette order — used in diagrams and the pattern.
function fabricLetter(id) { const i = fabricIndex(id); return i >= 0 ? letterFor(i) : '?'; }
