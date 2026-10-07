/* Colour bands on part labels: hardware-band-data.js and the layout inside the face less the band, executed against the
   Python layout. Run:  node --test test/*.test.mjs

   test/fixtures/hardware-bands-ref.json is v5/export_bands.py's reference: every coloured test item (the colour bank, the
   first print and the v5 synthetic set) laid out per band position - the v5 profile layout first, the text layout where
   it has none - inside the usable face less the band and its 0.8 mm gap. The browser must give the same label with the
   band position's own layout instance (hardware-layout.js created with that position's usable area). The cut pieces must
   add up to the generator's own label. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ot = require('../vendor/opentype.min.js');
require('../hardware-data.js');
require('../hardware-v5-data.js');
require('../hardware-band-data.js');
require('../hardware-layout.js');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const FX = JSON.parse(readFileSync(new URL('./fixtures/hardware-bands-ref.json', import.meta.url), 'utf8'));
const B = globalThis.GEN2HardwareBandData;

function pageFont() {
  const b64 = HTML.match(/<script id="font-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/\/\*.*?\*\//g, '').trim();
  const buf = Buffer.from(b64, 'base64');
  return ot.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
}
const FONT = pageFont();
const INST = {};
for (const tr of Object.keys(B.treatments)) {
  INST[tr] = globalThis.GEN2HardwareLayout.create({ data: { ...globalThis.GEN2HardwareData, usable: B.treatments[tr].usable }, v5: globalThis.GEN2HardwareV5Data });
  INST[tr].setFont(FONT);
}

function ringArea(r) { let a = 0; for (let i = 0, n = r.length; i < n; i += 2) { const j = (i + 2) % n; a += r[i] * r[j + 1] - r[j] * r[i + 1]; } return Math.abs(a / 2); }
function inRing(x, y, r) {
  let inside = false;
  for (let i = 0, n = r.length, j = n - 2; i < n; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function summary(parts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, area = 0;
  for (const rings of parts) for (const r of rings) {
    for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); }
    const depth = rings.filter((o) => o !== r && inRing(r[0], r[1], o)).length;
    area += (depth % 2 ? -1 : 1) * ringArea(r);
  }
  return { bbox: [x0, y0, x1, y1], area };
}
const V5F = ['kind', 'head', 'lock', 'main', 'word', 'main_cap', 'word_cap', 'H', 'secondary', 'shown', 'not_shown'];
const V1F = ['main_lines', 'main_cap', 'attributes', 'attribute_places', 'not_shown', 'icon'];
function differences(lay, out) {
  const d = [];
  if (lay.kind === 'not_ready') return out.record.not_ready ? d : ['should be not ready'];
  if ((lay.kind === 'v5') !== (out.record.layout === 'v5')) return [`python ${lay.kind}, browser ${out.record.layout === 'v5' ? 'v5' : 'v1'}`];
  if (lay.kind === 'v1' && !!lay.record.nonfit !== !!out.record.nonfit) return [`nonfit: python ${!!lay.record.nonfit}, browser ${!!out.record.nonfit}`];
  for (const f of lay.kind === 'v5' ? V5F : V1F) {
    const a = JSON.stringify(lay.record[f] ?? null), b = JSON.stringify(out.record[f] ?? null);
    if (a !== b) d.push(`${f}: python ${a}, browser ${b}`);
  }
  if (lay.elements) {
    const ka = Object.keys(lay.elements).sort().join(','), kb = Object.keys(out.elements || {}).sort().join(',');
    if (ka !== kb) return [...d, `elements: python [${ka}], browser [${kb}]`];
    for (const [k, ref] of Object.entries(lay.elements)) {
      const s = summary(out.elements[k]);
      const box = Math.max(...s.bbox.map((v, i) => Math.abs(v - ref.bbox[i])));
      if (box > 1e-5) d.push(`${k}: box off by ${box.toExponential(2)} mm`);
      if (Math.abs(s.area - ref.area) > 1e-5 * Math.max(1, ref.area)) d.push(`${k}: area ${s.area.toFixed(6)} vs ${ref.area}`);
    }
  }
  return d;
}

test('BD-1 every coloured item, every band position: the browser gives the Python layout inside the face less the band', () => {
  const bad = [];
  let n = 0;
  for (const x of FX.items) for (const [tr, lay] of Object.entries(x.layouts)) {
    n++;
    const d = differences(lay, INST[tr].layOut(x.item));
    if (d.length) bad.push(`${x.set} ${x.id} [${tr}]: ${d.join('; ')}`);
  }
  assert.deepEqual(bad, []);
  assert.ok(n >= 80, `${n} layouts`);
});

test('BD-2 the cut pieces of every position add up to the generator\'s own label, and the usable area keeps the gap', () => {
  const V = JSON.parse(HTML.match(/const BASE_VERTS = (\[[^\]]*\])/)[1]), T = JSON.parse(HTML.match(/const BASE_TRIS = (\[[^\]]*\])/)[1]);
  const vol = (v, t) => { let s = 0; for (let i = 0; i < t.length; i += 3) { const a = t[i] * 3, b = t[i + 1] * 3, c = t[i + 2] * 3;
    s += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]); } return s / 6; };
  const label = vol(V, T);
  assert.ok(Math.abs(label - B.labelVolume) < 1e-3, `the data was cut from this label (${label} vs ${B.labelVolume})`);
  for (const [tr, t] of Object.entries(B.treatments)) {
    for (const kind of ['solid', 'dashed']) {
      const s = ['base', 'band', 'accent'].reduce((a, k) => a + vol(t[kind][k].v, t[kind][k].t), 0);
      assert.ok(Math.abs(s - label) < 2e-3, `${tr} ${kind}: ${s} vs ${label}`);
      assert.ok(vol(t[kind].band.v, t[kind].band.t) > 1 && vol(t[kind].accent.v, t[kind].accent.t) > 1, `${tr} ${kind}: band and accent are solids`);
    }
    const du = globalThis.GEN2HardwareData.usable;
    const area = (p) => Math.abs(p.reduce((a, q, i) => a + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1], 0) / 2);
    assert.ok(area(t.usable) < area(du), `${tr}: the band takes face away from the text`);
  }
});

test('BD-3 a dashed band leaves gaps; a solid one does not', () => {
  for (const t of Object.values(B.treatments)) {
    const vol = (m) => { let s = 0; for (let i = 0; i < m.t.length; i += 3) { const a = m.t[i] * 3, b = m.t[i + 1] * 3, c = m.t[i + 2] * 3, v = m.v;
      s += v[a] * (v[b + 1] * v[c + 2] - v[b + 2] * v[c + 1]) - v[a + 1] * (v[b] * v[c + 2] - v[b + 2] * v[c]) + v[a + 2] * (v[b] * v[c + 1] - v[b + 1] * v[c]); } return s / 6; };
    assert.ok(vol(t.dashed.band) < 0.8 * vol(t.solid.band), 'the dashes are a fraction of the band');
    assert.ok(Math.abs(vol(t.dashed.accent) - vol(t.solid.accent)) < 1e-6, 'the accent is the same patch');
  }
});
