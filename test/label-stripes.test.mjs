/* Stripes on any label (label-stripes.js) - and the measurement behind where a TYPED label's stripe may go.
   Run:  node --test test/*.test.mjs

   A typed label's words and icon come from label-core.js (a 1.8 mm margin all round, the right edge the diagonal less 1.8 mm
   across); a stripe is label-hardware.js's band, cut from the label body for one of three positions. Here every position's
   stripe (its band and accent pieces' top face) is measured against the ink of typed labels built by the label core itself:
   the END stripe is never reached, the bottom and 45 degree ones are - so a typed label takes the end stripe only. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const THREE = require('../vendor/three.min.js');
globalThis.THREE = THREE;
require('../vendor/SVGLoader.js');
const ot = require('../vendor/opentype.min.js');
require('../label-core.js'); require('../label-icon-art.js'); require('../label-icons.js');
require('../hardware-data.js'); require('../hardware-v5-data.js'); require('../hardware-band-data.js'); require('../hardware-layout.js');
require('../label-hardware.js'); require('../label-stripes.js');
const G = globalThis, S = G.GEN2LabelStripes, B = G.GEN2HardwareBandData;
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const b64 = HTML.match(/<script id="font-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/\/\*.*?\*\//g, '').trim();
const buf = Buffer.from(b64, 'base64');
const FONT = ot.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const C = G.GEN2EdgeLabelCore.create({ THREE });
C.setFont(FONT);
const LI = G.GEN2LabelIcons.create({ core: C, art: G.GEN2LabelIconArt });
const LH = G.GEN2LabelHardware.create({ THREE, data: G.GEN2HardwareData, v5: G.GEN2HardwareV5Data, bands: B, mergeGeoms: (g) => C.mergeGeoms(g) });
LH.setFont(FONT);

test('the colours on offer: the Part Picker\'s metric blue and SAE red, then yellow, white, green, purple', () => {
  assert.deepEqual(S.COLOURS.map(c => [c.colour, c.hex, c.name]), [['sky-blue', '#56B4E9', 'Metric'], ['red', '#D55E00', 'SAE / inch'],
    ['yellow', '#F0E442', 'Yellow'], ['white', '#F4F4F2', 'White'], ['green', '#009E73', 'Green'], ['purple', '#CC79A7', 'Purple']]);
  // the stored label is the Part Picker's word for the two it has, so a typed stripe and a part's band share a filament line
  assert.deepEqual(S.stripe('sky-blue'), { band: { colour: 'sky-blue', hex: '#56B4E9', label: 'Metric', pattern: 'solid' } });
  assert.deepEqual(S.stripe('red').band.label, 'Inch (SAE)');
  assert.equal(S.stripe('orange'), null);
  // every key is one the export orders (index.html BAND_ORDER)
  const order = JSON.parse(HTML.match(/const BAND_ORDER = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
  for (const c of S.COLOURS) assert.ok(order.includes(c.colour), c.colour);
});

test('clean: a stripe as label-hardware.js reads a colour; "none" only where asked for; nothing else gets through', () => {
  const sky = S.stripe('sky-blue');
  assert.deepEqual(S.clean(sky), sky);
  assert.deepEqual(S.clean({ band: { ...sky.band, label: 'x'.repeat(50) } }).band.label, 'x'.repeat(40));
  assert.deepEqual(S.clean({ band: sky.band, band_accent: { colour: 'white', hex: '#F4F4F2', label: 'Stainless' } }).band_accent.label, 'Stainless');
  assert.equal(S.clean(null), undefined);
  assert.equal(S.clean(null, { allowNone: true }), null);
  for (const bad of [undefined, 'red', [], {}, { band: null }, { band: { colour: 'red' } }, { band: { colour: 'red', hex: 'red' } }, { band: { colour: 'a b', hex: '#000000' } }])
    assert.equal(S.clean(bad, { allowNone: true }), undefined, JSON.stringify(bad));
  // the same slot rules as label-hardware.js colour()
  for (const c of [sky.band, { colour: 'x', hex: '#ABCDEF', pattern: 'dashed' }, { colour: 'y', hex: '#123456', label: 7 }])
    assert.deepEqual(S.clean({ band: c }).band, LH.colour(c));
});

test('positionFor: a part label takes the setting, a typed label the end stripe; Off is off for both', () => {
  assert.deepEqual(S.ORDINARY_POSITIONS, ['end']);
  for (const set of ['bottom', 'end', 'wedge']) {
    assert.equal(S.positionFor('part', set), set);
    assert.equal(S.positionFor('ordinary', set), 'end');
  }
  assert.equal(S.positionFor('part', 'off'), null);
  assert.equal(S.positionFor('ordinary', 'off'), null);
  assert.equal(S.positionFor('ordinary', 'sideways'), null);
  assert.deepEqual([...S.PART_POSITIONS].sort(), Object.keys(B.treatments).sort(), 'every position the band data cuts');
});

test('partItem: a part label\'s own stripe replaces its Part Picker colours; null takes them off; undefined keeps them', () => {
  const item = { id: 'x', colours: { band: { colour: 'red', hex: '#D55E00' } } };
  assert.equal(S.partItem(item, undefined), item);
  assert.deepEqual(S.partItem(item, null), { id: 'x' });
  assert.deepEqual(S.partItem(item, S.stripe('green')).colours, S.stripe('green'));
  assert.deepEqual(item.colours.band.colour, 'red', 'the item itself is not changed');
  assert.equal(S.nameOf(S.stripe('red')), 'SAE / inch');
  assert.equal(S.nameOf({ band: { colour: 'white', hex: '#FFFFFF', label: 'Stainless' } }), 'Stainless');
  assert.equal(S.nameOf(null), '');
  assert.notEqual(S.signature(S.stripe('red')), S.signature(S.stripe('green')));
  assert.deepEqual(new Set([S.signature(undefined), S.signature(null), S.signature(S.stripe('red'))]).size, 3);
});

// ---- the measurement ----------------------------------------------------------------------------------------------------
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const bbox = (t) => [Math.min(...t.map(p => p[0])), Math.min(...t.map(p => p[1])), Math.max(...t.map(p => p[0])), Math.max(...t.map(p => p[1]))];
function inTri(p, t) { const d1 = cross(t[0], t[1], p), d2 = cross(t[1], t[2], p), d3 = cross(t[2], t[0], p); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); }
function segDist(a, b, c, d) {
  const o1 = cross(a, b, c), o2 = cross(a, b, d), o3 = cross(c, d, a), o4 = cross(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return 0;
  const ps = (p, q, r) => { const dx = q[0] - p[0], dy = q[1] - p[1], L = dx * dx + dy * dy || 1e-18; const u = Math.max(0, Math.min(1, ((r[0] - p[0]) * dx + (r[1] - p[1]) * dy) / L)); return Math.hypot(p[0] + u * dx - r[0], p[1] + u * dy - r[1]); };
  return Math.min(ps(a, b, c), ps(a, b, d), ps(c, d, a), ps(c, d, b));
}
function triDist(s, t) {
  if (Math.abs(cross(s[0], s[1], s[2])) > 1e-12 && Math.abs(cross(t[0], t[1], t[2])) > 1e-12) {
    for (const p of s) if (inTri(p, t)) return 0;
    for (const p of t) if (inTri(p, s)) return 0;
  }
  let m = Infinity;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m = Math.min(m, segDist(s[i], s[(i + 1) % 3], t[j], t[(j + 1) % 3]));
  return m;
}
// the closest the ink (triangles of its top cap) comes to the stripe (its pieces' top-face triangles); 0 = on it
function minDist(ink, stripe) {
  const sb = stripe.map(t => ({ t, b: bbox(t) }));
  let m = Infinity;
  for (const s of ink) {
    const ib = bbox(s);
    for (const { t, b } of sb) {
      if (Math.hypot(Math.max(0, b[0] - ib[2], ib[0] - b[2]), Math.max(0, b[1] - ib[3], ib[1] - b[3])) >= m) continue;
      m = Math.min(m, triDist(s, t));
      if (m === 0) return 0;
    }
  }
  return m;
}
const capTris = (g, z) => {
  const pos = g.getAttribute('position'), idx = g.getIndex(), n = idx ? idx.count : pos.count, out = [];
  const at = (i) => { const k = idx ? idx.getX(i) : i; return [pos.getX(k), pos.getY(k), pos.getZ(k)]; };
  for (let i = 0; i < n; i += 3) { const p = [at(i), at(i + 1), at(i + 2)]; if (p.every(q => Math.abs(q[2] - z) < 1e-4)) out.push(p.map(q => [q[0], q[1]])); }
  return out;
};
// a position's stripe: the band and accent pieces' top face (z 4.5, the label's top), from the pieces bandParts hands any label
const stripeTop = (pos) => LH.bandParts(pos, { band: S.stripe('red').band }).filter(p => p.piece !== 'base').flatMap(p => capTris(p.geo, 4.5));
function ink(c) {
  const d = C.prepareLabel(c.text, LI.resolveBadge(c.badge || { type: 'none' }, c.bsize || 14), c.caps !== false);
  const m = C.buildLabelMeshes(d, c.cap || 5, 0.6, c.bsize || 14, !!c.bold);
  return { tris: [...(m.textGeo ? capTris(m.textGeo, 0.6) : []), ...(m.badgeGeo ? capTris(m.badgeGeo, 0.6) : [])], fits: m.textFits };
}
// long and wrapped words, descenders, letters and icons up to the largest badge, bold, the smallest and largest text, overflow
const LABELS = [
  { text: 'M3' }, { text: 'M3', cap: 2 }, { text: 'Screws M3x10', badge: { type: 'icon', value: 'screw-hex-socket' } },
  { text: 'Assorted stainless steel socket head cap screws', cap: 6.5 }, { text: 'Supercalifragilisticexpialidocious', cap: 2 },
  { text: 'gypsy jpg yy gg pp qq', caps: false, cap: 6.5 }, { text: 'WWWW WWWW WWWW WWWW WWWW', badge: { type: 'char', value: 'M3' }, bsize: 22 },
  { text: 'Allen keys and bits jjj', badge: { type: 'icon', value: 'nut' }, bsize: 22, bold: true },
  { text: 'A B C D E F G H I J K L M N O P Q R S T U', cap: 6.5 },
  // found by a 580-label random search (scratch clearance.mjs): ink on the bottom stripe, ink on the 45 degree one
  { text: 'Qq socket jpg MMMM 10kΩ zip Allen', cap: 6.5, badge: { type: 'char', value: 'M3' }, bsize: 18, caps: false },
  { text: 'keys Battery MMMM Qq M3 cap zip', cap: 6, badge: { type: 'char', value: 'W' }, bsize: 22, caps: false },
];
const BUILT = LABELS.map(c => ({ c, ...ink(c) }));

test('a typed label never puts ink on the END stripe: 0.45 mm clear, by construction (left-justified at the 1.8 mm margin)', () => {
  const end = stripeTop('end');
  assert.ok(end.length > 0);
  for (const b of BUILT) {
    const d = minDist(b.tris, end);
    assert.ok(d >= 0.449, `${JSON.stringify(b.c)}: ${d.toFixed(3)} mm`);
  }
});

test('a typed label CAN put ink on the bottom and the 45 degree stripes - so those stay for part labels', () => {
  for (const [pos, which] of [['bottom', 9], ['wedge', 10]]) {
    const b = BUILT[which];
    assert.ok(b.fits, `${pos}: a label that fits, not one held at the minimum size`);
    assert.equal(minDist(b.tris, stripeTop(pos)), 0, `${pos}: ink on the stripe`);
  }
  // the reason in numbers: the bottom stripe's top face reaches above the label core's text floor (y -11.7)
  const yTop = Math.max(...stripeTop('bottom').flat().map(p => p[1]));
  assert.ok(yTop > C.AREA_BOTTOM, `bottom stripe to y ${yTop.toFixed(3)} > ${C.AREA_BOTTOM}`);
  const xIn = Math.max(...stripeTop('end').flat().map(p => p[0]));
  assert.ok(C.AREA_LEFT - xIn > 0.449, `end stripe to x ${xIn.toFixed(3)}, text from ${C.AREA_LEFT}`);
});

test('a typed label\'s stripe is the whole label body cut in three, the band and its patch in the stripe\'s colour', () => {
  const parts = LH.bandParts(S.positionFor('ordinary', 'bottom'), LH.colours(S.stripe('green')));
  assert.deepEqual(parts.map(p => [p.piece, p.colour && p.colour.colour]), [['base', null], ['band', 'green'], ['accent', 'green']]);
  const vol = (g) => { const v = g.getAttribute('position').array, t = g.getIndex().array; let s = 0;
    for (let i = 0; i < t.length; i += 3) { const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
      s += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]); } return s / 6; };
  assert.ok(Math.abs(parts.reduce((s, p) => s + vol(p.geo), 0) - B.labelVolume) < 0.5, 'the three pieces are the label');
});

test('the page: typed stripes go to the end, both kinds feed one filament plan, the stripe rides the label everywhere', () => {
  assert.match(HTML, /<script src="label-stripes\.js\?v=[0-9a-f]{8}"><\/script>/);
  assert.match(HTML, /const position = LS\.positionFor\('ordinary', hwBandSetting\(\)\);\n\s+if \(position\) d\.stripe = \{ position, colours: LH\.colours\(row\._stripe\) \};/);
  assert.match(HTML, /if \(data\.stripe\) m\.baseParts = LH\.bandParts\(data\.stripe\.position, data\.stripe\.colours\);/);
  const plan = HTML.slice(HTML.indexOf('function filamentPlan('), HTML.indexOf('function partExtruder('));
  assert.match(plan, /const bd = bandOf\(d\);/);
  assert.doesNotMatch(plan, /d\.hardware\.band/, 'no part-label-only check left in the plan');
  assert.match(HTML, /if \(row\._stripe !== undefined\) o\.colours = row\._stripe;/, 'saved sets, the autosave and set files');
  assert.match(HTML, /if \(row\._stripe !== undefined\) l\.colours = row\._stripe;/, 'Add to planner build');
  assert.match(HTML, /STL is one colour: the stripes print in the base colour/);
  assert.match(HTML, /<span>Stripe position<\/span>/);
  // a part label's own stripe takes over its layout (the cache knows it)
  assert.match(HTML, /const item = LS \? LS\.partItem\(row\._hwItem, row\._stripe\) : row\._hwItem;/);
  assert.match(HTML, /'\|' \+ \(LS \? LS\.signature\(row\._stripe\) : ''\);/);
  // a linked tab says, beside Send, that stripes stay here
  assert.match(HTML, /Send to planner does not carry stripes yet/);
});
