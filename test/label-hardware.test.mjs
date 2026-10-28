/* label-hardware.js - the part-label layout call, the ink, the colour-band pieces, the colours and the row note, moved out of
   index.html so the 3D Build Studio can share them byte for byte. Run:  node --test test/*.test.mjs

   That the move changed nothing the page exports is checked in a real browser (the exports before and after compared byte
   for byte); these tests pin the module's own contract: it reads no page, it lays out exactly what the hardware-layout
   instances give, it cleans colours as the page did, it cuts the label body for ANY label, and its geometry is in the label
   frame the header documents. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const THREE = require('../vendor/three.min.js');
const ot = require('../vendor/opentype.min.js');
require('../hardware-data.js');
require('../hardware-data-classicpro.js');
require('../hardware-v5-data.js');
require('../hardware-band-data.js');
require('../hardware-layout.js');
require('../label-hardware.js');
const G = globalThis;
const SRC = readFileSync(new URL('../label-hardware.js', import.meta.url), 'utf8');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const FX = JSON.parse(readFileSync(new URL('./fixtures/hardware-bands-ref.json', import.meta.url), 'utf8'));

function pageFont() {
  const b64 = HTML.match(/<script id="font-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/\/\*.*?\*\//g, '').trim();
  const buf = Buffer.from(b64, 'base64');
  return ot.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
}
const FONT = pageFont();
// label-core.js's mergeGeoms (concatenates non-indexed geometries), as the page hands it over
function mergeGeoms(geos) {
  let total = 0;
  for (const g of geos) total += g.getAttribute('position').array.length;
  const arr = new Float32Array(total);
  let o = 0;
  for (const g of geos) { const p = g.getAttribute('position').array; arr.set(p, o); o += p.length; }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  m.computeVertexNormals();
  return m;
}
const ALL = { THREE, data: G.GEN2HardwareData, v5: G.GEN2HardwareV5Data, classicpro: G.GEN2HardwareDataClassicPro, bands: G.GEN2HardwareBandData, mergeGeoms };
const LH = G.GEN2LabelHardware.create(ALL);
LH.setFont(FONT);
// the instances the page used to make itself, to compare against
const REF = {
  edgelabel: G.GEN2HardwareLayout.create({ data: G.GEN2HardwareData, v5: G.GEN2HardwareV5Data }),
  classicpro: G.GEN2HardwareLayout.create({ data: G.GEN2HardwareDataClassicPro, v5: G.GEN2HardwareV5Data }),   // drawings since 2026-10-27
};
for (const tr of Object.keys(G.GEN2HardwareBandData.treatments)) {
  REF[tr] = G.GEN2HardwareLayout.create({ data: { ...G.GEN2HardwareData, usable: G.GEN2HardwareBandData.treatments[tr].usable }, v5: G.GEN2HardwareV5Data });
}
Object.values(REF).forEach((h) => h.setFont(FONT));

const vol = (v, t) => { let s = 0; for (let i = 0; i < t.length; i += 3) { const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
  s += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]); } return s / 6; };
const geoVol = (g) => vol(g.getAttribute('position').array, g.getIndex().array);
const bbox = (g) => { g.computeBoundingBox(); const b = g.boundingBox; return [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]; };
const near = (a, b, tol = 1e-4) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
// a few distinct coloured items: solid and dashed bands, screws with drawings and items without
const SAMPLE = FX.items.filter((x, i) => i % 5 === 0).map((x) => x.item);

test('LH-1 a classic script that reads no page: it loads under node, and its code names no DOM, window or storage', () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  assert.doesNotMatch(code, /\b(document|window|localStorage|sessionStorage|location|navigator|addEventListener)\b/);
  assert.equal(typeof G.GEN2LabelHardware.create, 'function');
  for (const f of ['setFont', 'layOut', 'layoutFor', 'bandFor', 'typeSkips', 'colour', 'colours', 'meshes', 'inkGeometry', 'bandParts',
    'resetBandGeometry', 'noteText', 'noteDetail', 'bandNote']) assert.equal(typeof LH[f], 'function', f);
  assert.deepEqual(LH.treatments, ['bottom', 'end', 'wedge']);
  assert.equal(LH.bandNames.end, 'End stripe');
  assert.equal(LH.inkDepth, 0.45);
  assert.ok(LH.layouts.edgelabel && LH.layouts.classicpro && LH.layouts.bands.bottom && LH.layouts.bands.wedge);
});

test('LH-2 layOut gives exactly what the hardware-layout instance for the type, the drawing switch and the band position gives', () => {
  assert.ok(SAMPLE.length >= 6);
  for (const item of SAMPLE) for (const profile of [true, false]) {
    for (const tr of ['bottom', 'end', 'wedge']) {
      const r = LH.layOut(item, { type: 'edgelabel', profile, band: tr }), ref = REF[tr].layOut(item, { profile });
      assert.deepEqual(r.record, ref.record, `${item.id} ${tr} ${profile}`);
      assert.deepEqual(r.elements, ref.elements);
      assert.equal(r.band, ref.elements ? tr : undefined);
      if (ref.elements) assert.deepEqual(r.colours, LH.colours(item.colours));
      assert.equal(r.inkDepth, 0.45);
      assert.equal(r.typeSkips, undefined);
      assert.equal(r.covered, REF.edgelabel.profileCovered(item));
    }
    const off = LH.layOut(item, { type: 'edgelabel', profile, band: 'off' });
    assert.deepEqual(off.elements, REF.edgelabel.layOut(item, { profile }).elements, 'band off: the whole face');
    assert.equal(off.band, undefined);
    const cp = LH.layOut(item, { type: 'classicpro', profile, band: 'bottom' });
    assert.deepEqual(cp.elements, REF.classicpro.layOut(item, { profile }).elements, 'Classic Pro: its own face, never a band');
    assert.equal(cp.band, undefined);
    assert.equal(cp.inkDepth, G.GEN2HardwareDataClassicPro.rules.inkDepth);
    assert.deepEqual(cp.typeSkips, ['colour band'], 'Classic Pro skips the band only: its drawing prints (2026-10-27)');
  }
  // an item with no colours gets no band, whatever the setting
  const plain = { ...SAMPLE[0] }; delete plain.colours;
  assert.equal(LH.bandFor(plain, 'bottom'), null);
  assert.equal(LH.layOut(plain, { type: 'edgelabel', profile: true, band: 'bottom' }).band, undefined);
  assert.deepEqual(LH.layoutFor(SAMPLE[0], 'edgelabel', 'end'), { layout: LH.layouts.bands.end, band: 'end', inkDepth: 0.45 });
  assert.deepEqual(LH.layoutFor(SAMPLE[0], 'edgelabel', 'toString'), { layout: LH.layouts.edgelabel, band: null, inkDepth: 0.45 });
  // an item the layout cannot read is a row note, not a throw
  const bad = LH.layOut({ ...SAMPLE[0], pinned: ['no.such.path'] }, { type: 'edgelabel', profile: false, band: 'off' });
  assert.equal(bad.elements, null);
  assert.match(bad.record.not_ready, /^the label item could not be read \(/);
});

test('LH-3 colours are cleaned as the page cleaned them: a colour, null when unassigned or unreadable, undefined when absent', () => {
  assert.deepEqual(LH.colour({ colour: 'sky-blue', hex: '#56B4E9', label: 'Metric', pattern: 'solid', source: 'rule' }),
    { colour: 'sky-blue', hex: '#56B4E9', label: 'Metric', pattern: 'solid' });
  assert.deepEqual(LH.colour({ colour: 'red', hex: '#D55E00' }), { colour: 'red', hex: '#D55E00', label: 'red', pattern: 'solid' });
  assert.equal(LH.colour({ colour: 'red', hex: '#D55E00', pattern: 'dashed' }).pattern, 'dashed');
  assert.equal(LH.colour({ colour: 'red', hex: '#D55E00', pattern: 'wavy' }).pattern, 'solid');
  assert.equal(LH.colour({ colour: 'red', hex: '#D55E00', label: 'x'.repeat(90) }).label.length, 40);
  assert.equal(LH.colour(undefined), undefined);
  assert.equal(LH.colour(null), undefined);
  for (const bad of ['red', 7, { colour: 'red' }, { colour: 'red', hex: 'D55E00' }, { colour: 'r e d', hex: '#D55E00' }, { colour: 'red', hex: '#D55E0' }])
    assert.equal(LH.colour(bad), null, JSON.stringify(bad));
  assert.deepEqual(LH.colours({ band: { colour: 'red', hex: '#D55E00', label: 'SAE' } }),
    { band: { colour: 'red', hex: '#D55E00', label: 'SAE', pattern: 'solid' }, band_accent: undefined });
});

test('LH-4 bandParts cuts the EdgeLabel body for ANY label: three pieces that make the whole label, coloured from the colours given', () => {
  const V = JSON.parse(HTML.match(/const BASE_VERTS = (\[[^\]]*\])/)[1]), T = JSON.parse(HTML.match(/const BASE_TRIS = (\[[^\]]*\])/)[1]);
  const label = vol(V, T);
  const red = LH.colour({ colour: 'red', hex: '#D55E00', label: 'SAE' }), white = LH.colour({ colour: 'white', hex: '#F4F4F2', label: 'Stainless' });
  for (const tr of LH.treatments) {
    // an ordinary label's stripe: one colour, no accent slot -> the accent piece takes the band's colour
    const p = LH.bandParts(tr, { band: red });
    assert.deepEqual(p.map((x) => x.piece), ['base', 'band', 'accent']);
    assert.deepEqual(p.map((x) => x.colour), [null, red, red]);
    assert.ok(Math.abs(p.reduce((s, x) => s + geoVol(x.geo), 0) - label) < 2e-3, `${tr}: the pieces make the whole label`);
    for (const x of p) { const b = bbox(x.geo); assert.ok(b[0] >= -28.5 - 1e-6 && b[3] <= 28.5 + 1e-6 && b[1] >= -13.5 - 1e-6 && b[4] <= 13.5 + 1e-6 && b[2] >= -1e-6 && b[5] <= 4.5 + 1e-6, `${tr} ${x.piece} in the label frame`); }
    assert.ok(Math.abs(bbox(p[1].geo)[5] - 4.5) < 1e-6 && Math.abs(bbox(p[1].geo)[2] - G.GEN2HardwareBandData.treatments[tr].z0) < 1e-6, `${tr}: the band is the top layers`);
    // an accent of its own; an unassigned accent prints in the base colour
    assert.deepEqual(LH.bandParts(tr, { band: red, band_accent: white }).map((x) => x.colour), [null, red, white]);
    assert.deepEqual(LH.bandParts(tr, { band: red, band_accent: null }).map((x) => x.colour), [null, red, null]);
    assert.deepEqual(LH.bandParts(tr, { band: null }).map((x) => x.colour), [null, null, null]);
    // a dashed band is the dashed cut: less band, the same accent
    const d = LH.bandParts(tr, { band: { ...red, pattern: 'dashed' } });
    assert.ok(geoVol(d[1].geo) < 0.8 * geoVol(p[1].geo));
    assert.ok(Math.abs(geoVol(d[2].geo) - geoVol(p[2].geo)) < 1e-6);
  }
  for (const no of ['off', 'toString', '__proto__', null, undefined, 3]) assert.equal(LH.bandParts(no, { band: red }), null, String(no));
  // the same geometry until the caller has disposed it and resets
  const a = LH.bandParts('end', { band: red })[1].geo;
  assert.equal(LH.bandParts('end', { band: white })[1].geo, a);
  LH.resetBandGeometry();
  assert.notEqual(LH.bandParts('end', { band: red })[1].geo, a);
  // band pieces need no layout data and no mergeGeoms: only THREE and the band data
  const bare = G.GEN2LabelHardware.create({ THREE, bands: G.GEN2HardwareBandData });
  assert.equal(bare.layouts.edgelabel, null);
  assert.equal(bare.bandParts('bottom', { band: red }).length, 3);
});

test('LH-5 the ink is the layout\'s outlines extruded from z 0 to the ink depth, in the label frame; a banded label brings its pieces', () => {
  for (const item of SAMPLE.slice(0, 4)) {
    const r = LH.layOut(item, { type: 'edgelabel', profile: true, band: 'wedge' });
    assert.ok(r.elements && r.band === 'wedge', item.id);
    const m = LH.meshes(r, r.inkDepth);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const parts of Object.values(r.elements)) for (const rings of parts) for (const ring of rings)
      for (let i = 0; i < ring.length; i += 2) { x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); y0 = Math.min(y0, ring[i + 1]); y1 = Math.max(y1, ring[i + 1]); }
    assert.ok(near(bbox(m.textGeo), [x0, y0, 0, x1, y1, 0.45], 1e-4), `${item.id}: ${bbox(m.textGeo)} vs ${[x0, y0, x1, y1]}`);
    assert.equal(m.badgeGeo, null);
    assert.equal(m.textFits, true);
    assert.deepEqual(m.baseParts.map((p) => [p.piece, p.colour]), LH.bandParts('wedge', r.colours).map((p) => [p.piece, p.colour]));
    const plain = LH.meshes(LH.layOut(item, { type: 'edgelabel', profile: true, band: 'off' }), 0.45);
    assert.equal(plain.baseParts, null, 'no band: the plain label body');
  }
});

test('LH-6 the row note: the band named, Classic Pro\'s skips named, a part that cannot print says so', () => {
  const item = SAMPLE.find((x) => x.colours.band_accent);
  const r = LH.layOut(item, { type: 'edgelabel', profile: true, band: 'bottom' });
  const b = r.colours.band, a = r.colours.band_accent;
  assert.equal(LH.bandNote(r), ` ${b.label} band, ${a.label} accent.`);
  assert.ok(LH.noteText(r, true).includes(LH.bandNote(r)));
  assert.equal(LH.bandNote({ ...r, colours: { band: null, band_accent: undefined } }), ' band unassigned.');
  assert.equal(LH.bandNote({ ...r, colours: { band: b, band_accent: null } }), ` ${b.label} band, accent unassigned.`);
  assert.equal(LH.bandNote(LH.layOut(item, { type: 'edgelabel', profile: true, band: 'off' })), '');
  assert.match(LH.noteDetail(r), /^Main value [\d.]+ mm tall/);
  const cp = LH.layOut(item, { type: 'classicpro', profile: true, band: 'bottom' });
  assert.match(LH.noteText(cp, true), / on EdgeLabel only, for now\./);
  const nr = LH.layOut({ ...item, fields: [], value_missing: [{ why: 'size not recorded' }] }, { type: 'edgelabel', profile: true, band: 'bottom' });
  assert.equal(LH.noteText(nr, true), 'Not ready: size not recorded. Nothing is printed - complete the part record first.');
  assert.equal(LH.noteDetail(nr), '');
});

test('LH-7 the page lays out, builds and notes part labels through label-hardware.js, loaded after hardware-layout.js', () => {
  for (const gone of ['function hwColour(', 'function hwColours(', 'function bandGeo(', 'function bandParts(', 'function bandNote(',
    'function hwInPoly(', 'function hwPullIn(', 'function hardwareMeshes(', 'function hardwareNoteText(', 'function hardwareNoteDetail(',
    'function hwLayoutFor(', 'GEN2HardwareLayout.create('])
    assert.ok(!HTML.includes(gone), `index.html still has ${gone}`);
  assert.ok(HTML.includes('GEN2LabelHardware.create('));
  const order = [...HTML.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]);
  assert.equal(order.indexOf('label-hardware.js'), order.indexOf('hardware-layout.js') + 1);
});

test('LH-8 laying out needs no THREE; building geometry says what it needs', () => {
  const noThree = G.GEN2LabelHardware.create({ ...ALL, THREE: undefined });
  noThree.setFont(FONT);
  const r = noThree.layOut(SAMPLE[0], { type: 'edgelabel', profile: true, band: 'bottom' });
  assert.ok(r.elements && r.band === 'bottom');
  assert.throws(() => noThree.meshes(r, 0.45), /create\(\{ THREE \}\)/);
  assert.throws(() => noThree.bandParts('bottom', r.colours), /create\(\{ THREE \}\)/);
  const noMerge = G.GEN2LabelHardware.create({ ...ALL, mergeGeoms: undefined });
  assert.throws(() => noMerge.inkGeometry(r.elements, 0.45), /create\(\{ mergeGeoms \}\)/);
  assert.equal(noMerge.bandParts('bottom', r.colours).length, 3);
  const nothing = G.GEN2LabelHardware.create({ THREE });
  assert.deepEqual(nothing.treatments, []);
  assert.equal(nothing.layouts.classicpro, null);
  assert.match(nothing.layOut(SAMPLE[0], { type: 'classicpro' }).record.not_ready, /Classic Pro part-label layout did not load/);
});
