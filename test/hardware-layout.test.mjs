/* The hardware-label layout (hardware-layout.js), executed against the Python print engine it ports.
   Run:  node --test test/*.test.mjs

   test/fixtures/hardware-ref.json is the Python engine's answer (label_from_items.lay_out, the engine every printed
   hardware plate was laid out with) for every saved label-items file - 65 items: Joey's own records, the inch bank, the pin
   demo, the first print and the colour bank - exported by D:/MODULITH/handoffs/hardware-library/icons-v1/export_hw_data.py
   (which also writes hardware-data.js). The browser layout must give the SAME label: the same value size, line split,
   attribute placement, icon and "not shown" list, and the same outlines (each element's box and area). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ot = require('../vendor/opentype.min.js');
require('../hardware-data.js');
require('../hardware-layout.js');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const FX = JSON.parse(readFileSync(new URL('./fixtures/hardware-ref.json', import.meta.url), 'utf8'));

// the page's own embedded font (Liberation Sans Narrow Bold - the same file the Python engine reads)
function pageFont() {
  const b64 = HTML.match(/<script id="font-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/\/\*.*?\*\//g, '').trim();
  const buf = Buffer.from(b64, 'base64');
  return ot.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
}
function layout(data = globalThis.GEN2HardwareData, font = pageFont()) {
  const hw = globalThis.GEN2HardwareLayout.create({ data });
  hw.setFont(font);
  return hw;
}
const HW = layout();

function ringArea(r) { let a = 0; for (let i = 0, n = r.length; i < n; i += 2) { const j = (i + 2) % n; a += r[i] * r[j + 1] - r[j] * r[i + 1]; } return Math.abs(a / 2); }
function inRing(x, y, r) {
  let inside = false;
  for (let i = 0, n = r.length, j = n - 2; i < n; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function summary(parts) {      // an element's box and even-odd area, as the fixture records them
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, area = 0;
  for (const rings of parts) {
    for (const r of rings) {
      for (let i = 0; i < r.length; i += 2) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]); }
      const depth = rings.filter((o) => o !== r && inRing(r[0], r[1], o)).length;
      area += (depth % 2 ? -1 : 1) * ringArea(r);
    }
  }
  return { bbox: [x0, y0, x1, y1], area };
}
const FIELDS = ['main_lines', 'main_cap', 'attributes', 'attribute_places', 'not_shown', 'icon'];
// every difference between a layout and the Python engine's, as readable lines
function differences(x, out) {
  const d = [];
  if (x.layout.not_ready) { if (!out.record.not_ready) d.push('should be NOT READY'); return d; }
  if (!!x.layout.nonfit !== !!out.record.nonfit) { d.push(`nonfit: python ${!!x.layout.nonfit}, browser ${!!out.record.nonfit}`); return d; }
  for (const f of FIELDS) {
    const a = JSON.stringify(x.layout[f] ?? null), b = JSON.stringify(out.record[f] ?? null);
    if (a !== b) d.push(`${f}: python ${a}, browser ${b}`);
  }
  if (x.elements) {
    const ka = Object.keys(x.elements).sort().join(','), kb = Object.keys(out.elements || {}).sort().join(',');
    if (ka !== kb) { d.push(`elements: python [${ka}], browser [${kb}]`); return d; }
    for (const [k, ref] of Object.entries(x.elements)) {
      const s = summary(out.elements[k]);
      const box = Math.max(...s.bbox.map((v, i) => Math.abs(v - ref.bbox[i])));
      if (box > 1e-5) d.push(`${k}: box off by ${box.toExponential(2)} mm`);
      if (Math.abs(s.area - ref.area) > 1e-5 * Math.max(1, ref.area)) d.push(`${k}: area ${s.area.toFixed(6)} vs ${ref.area}`);
    }
  }
  return d;
}

test('HL-1 the usable area is the measured face less 1.8 mm, and the face sits on the generator\'s own label mesh', () => {
  const D = globalThis.GEN2HardwareData;
  const V = JSON.parse(HTML.match(/const BASE_VERTS = (\[[^\]]*\])/)[1]);
  const top = []; for (let i = 0; i < V.length; i += 3) if (Math.abs(V[i + 2] - 4.5) < 1e-6) top.push([V[i], V[i + 1]]);
  let worst = 0;
  for (const p of D.face) worst = Math.max(worst, Math.min(...top.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1]))));
  assert.ok(worst < 0.06, `a face corner is ${worst.toFixed(3)} mm from the label mesh's top face`);
  assert.equal(D.rules.margin, 1.8);
  assert.deepEqual([HW.X0, HW.YTOP], [-26.7, 11.7]);   // the usable area's left and top edges (Python 1.8, 25.2)
});

test('HL-2 glyph positions are matplotlib 3.11\'s (advances and GPOS kerning rounded to 1/64 px)', () => {
  // matplotlib 3.11.2 _text_helpers.layout('AV TO') at 100 px, scaled to 6.0 mm caps (2026-10-06)
  const want = [0, 4.638655462184874, 9.408130819895526, 11.396320690438337, 15.641153758800817];
  const got = HW._penX('AV TO', 6.0);
  got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-12, `glyph ${i}: ${v} vs ${want[i]}`));
});

test('HL-3 glyph outlines are the Python engine\'s polygons (FreeType outline, agg curve flattening)', () => {
  // labelcore.text_geom('O', 6.0): 2 rings of 32 points, bounds (0.29434.., -0.08585.., 5.26413.., 6.08993..)
  const g = HW._glyphPart('O', 6.0);
  assert.deepEqual(g.rings.map((r) => r.length / 2), [32, 32]);
  const want = [0.2943447649330002, -0.08585055643879173, 5.264138087667499, 6.089938678173972];
  [g.minx, g.miny, g.maxx, g.maxy].forEach((v, i) => assert.ok(Math.abs(v - want[i]) < 1e-12, `${v} vs ${want[i]}`));
});

test('HL-4 every saved label item lays out exactly as the Python engine laid it out (65 items)', () => {
  assert.equal(FX.items.length, 65);
  const bad = [];
  for (const x of FX.items) {
    const d = differences(x, HW.layOut(x.item));
    if (d.length) bad.push(`${x.set} ${x.id}: ${d.join('; ')}`);
  }
  assert.deepEqual(bad, []);
});

test('HL-5 the comparison can fail: a wrong attribute size or no kerning is caught', () => {
  const D = globalThis.GEN2HardwareData;
  const mutants = {
    'attributes at 4.8 mm caps': layout({ ...D, rules: { ...D.rules, secCap: 4.8 } }),
    'kerning ignored': (() => { const f = pageFont(); f.getKerningValue = () => 0; return layout(D, f); })(),
  };
  for (const [name, hw] of Object.entries(mutants)) {
    const caught = FX.items.some((x) => differences(x, hw.layOut(x.item)).length);
    assert.ok(caught, `the mutant "${name}" agreed with the Python engine on every item`);
  }
});

test('HL-6 a non-fit prints nothing and names its pins; the proposal leaves off the fewest lowest-priority pins', () => {
  const nonfits = FX.items.filter((x) => x.layout.nonfit);
  assert.equal(nonfits.length, 2);
  for (const x of nonfits) {
    const r = HW.layOut(x.item);
    assert.equal(r.elements, null);
    for (const p of x.item.pinned) assert.ok(r.record.nonfit.includes(HW.printable(x.item.attributes.find((a) => a.path === p).text)), p);
    const pr = HW.propose(x.item);
    if (x.proposal.none) { assert.equal(pr.elements, null); assert.equal(pr.record.why, x.proposal.none); }
    else {
      assert.deepEqual(pr.record.omit_paths, x.proposal.omit_paths);
      assert.equal(pr.record.main_cap, x.proposal.main_cap);
      assert.deepEqual(pr.record.attributes, x.proposal.attributes);
    }
  }
});

test('HL-7 a record without a size is NOT READY: nothing printed, never a placeholder', () => {
  const nr = FX.items.filter((x) => x.layout.not_ready);
  assert.equal(nr.length, 2);
  for (const x of nr) {
    const r = HW.layOut(x.item);
    assert.equal(r.elements, null);
    assert.match(r.record.not_ready, /not recorded/);
  }
});
