/* The raised ink of every reference part label is a closed solid (every edge shared by exactly two triangles), built by the
   page's own hardwareMeshes (taken from index.html and run with the vendored three.js). The '#' glyph's centre hole sits
   on the line of its bars, and three's triangulator dropped those collinear points: 8 open edges on "#10-24" until holes
   were pulled in by 0.00001 mm (hwPullIn). Run:  node --test test/*.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const THREE = require('../vendor/three.min.js');
const ot = require('../vendor/opentype.min.js');
require('../hardware-data.js');
require('../hardware-v5-data.js');
require('../hardware-layout.js');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
function fnSrc(name) {
  const i = HTML.indexOf(`function ${name}(`);
  assert.ok(i >= 0, name);
  let depth = 0;
  for (let k = HTML.indexOf('{', i); k < HTML.length; k++) {
    if (HTML[k] === '{') depth++;
    else if (HTML[k] === '}' && --depth === 0) return HTML.slice(i, k + 1);
  }
  throw new Error(name);
}
// the page's functions; mergeGeoms stands in as "keep the pieces" so each extruded piece is checked on its own
const hardwareMeshes = new Function('THREE', 'LabelCore', 'bandParts',
  `${fnSrc('hwInPoly')}\n${fnSrc('hwPullIn')}\n${fnSrc('hardwareMeshes')}\nreturn hardwareMeshes;`)(THREE, { mergeGeoms: (g) => g.map((x) => x.clone()) }, null);

function pageFont() {
  const b64 = HTML.match(/<script id="font-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/\/\*.*?\*\//g, '').trim();
  const buf = Buffer.from(b64, 'base64');
  return ot.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
}
const HW = globalThis.GEN2HardwareLayout.create({ data: globalThis.GEN2HardwareData, v5: globalThis.GEN2HardwareV5Data });
HW.setFont(pageFont());
function openEdges(geo) {
  const pos = geo.getAttribute('position'), e = new Map(), key = (i) => [pos.getX(i), pos.getY(i), pos.getZ(i)].map((c) => c.toFixed(4)).join(',');
  for (let i = 0; i < pos.count; i += 3) for (const [u, w] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
    const s = [key(u), key(w)].sort().join('|'); e.set(s, (e.get(s) || 0) + 1);
  }
  return [...e.values()].filter((n) => n !== 2).length;
}
const items = [];
for (const f of ['hardware-ref.json', 'hardware-v5-ref.json', 'hardware-bands-ref.json']) {
  const fx = JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));
  for (const x of (fx.items || fx)) if (x.item && x.item.fields && x.item.fields.length) items.push(x.item);
}

test('INK-1 the ink of every reference part label (text layout and profile layout) is a closed solid', () => {
  const bad = [];
  const seen = new Set();
  for (const it of items) {
    const key = JSON.stringify([it.fields, it.head, it.family, it.attributes.map((a) => a.text), it.pinned, it.optional]);
    if (seen.has(key)) continue;
    seen.add(key);
    for (const profile of [true, false]) {
      const r = HW.layOut(it, { profile });
      if (!r.elements) continue;
      const { textGeo } = hardwareMeshes({ elements: r.elements }, 0.45);
      const open = (textGeo || []).reduce((n, g) => n + openEdges(g), 0);
      if (open) bad.push(`${it.fields.join(' ')} (${profile ? 'profile' : 'text'}): ${open} open edges`);
    }
  }
  assert.ok(seen.size >= 60, `${seen.size} distinct items`);
  assert.deepEqual(bad, []);
});

test('INK-2 the # glyph: closed with the pull-in, open without it (the check can fail)', () => {
  const g = HW._glyphPart('#', 6.4);
  const els = { 'main spec': [g.rings] };
  const withFix = hardwareMeshes({ elements: els }, 0.45).textGeo.reduce((n, x) => n + openEdges(x), 0);
  const noFix = new Function('THREE', 'LabelCore', 'bandParts',
    `${fnSrc('hwInPoly')}\nfunction hwPullIn(L) { return L; }\n${fnSrc('hardwareMeshes')}\nreturn hardwareMeshes;`)(THREE, { mergeGeoms: (x) => x }, null)({ elements: els }, 0.45)
    .textGeo.reduce((n, x) => n + openEdges(x), 0);
  assert.equal(withFix, 0);
  assert.ok(noFix > 0, 'without the pull-in the # ink has open edges');
});
