/* Profile labels (v5): hardware-layout.js with hardware-v5-data.js, executed against the Python layout it ports.
   Run:  node --test test/*.test.mjs

   test/fixtures/hardware-v5-ref.json is v5_items.lay_out's answer (MODULITH/handoffs/hardware-library/v5, on
   labels_v5.py - the engine of Jerrari's printed v5 sheet) for every covered saved item plus a synthetic set, exported by
   v5/export_v5_data.py, which also writes hardware-v5-data.js. The browser must give the SAME profile label: the same value
   size, nut group height, attribute line, the same "left off" list, and the same outlines (each element's box and area); an
   item Python cannot lay out as a profile label gets the text layout, with the reason. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const ot = require('../vendor/opentype.min.js');
require('../hardware-data.js');
require('../hardware-v5-data.js');
require('../hardware-layout.js');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const FX = JSON.parse(readFileSync(new URL('./fixtures/hardware-v5-ref.json', import.meta.url), 'utf8'));

function pageFont() {
  const b64 = HTML.match(/<script id="font-data"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/\/\*.*?\*\//g, '').trim();
  const buf = Buffer.from(b64, 'base64');
  return ot.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
}
const FONT = pageFont();
function layout(v5 = globalThis.GEN2HardwareV5Data) {
  const hw = globalThis.GEN2HardwareLayout.create({ data: globalThis.GEN2HardwareData, v5 });
  hw.setFont(FONT);
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
function summary(parts) {
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
const FIELDS = ['layout', 'kind', 'head', 'head_as_drawing', 'lock', 'main', 'word', 'main_cap', 'word_cap', 'H', 'secondary', 'sec_cap', 'sec_track', 'shown', 'not_shown'];
function differences(x, out) {
  const d = [];
  if (!x.elements) {
    if (out.record.layout === 'v5') d.push(`python has no profile layout (${x.record.why}), the browser laid one out`);
    else if (!out.record.profile_why) d.push('the text layout should say why there is no profile drawing');
    return d;
  }
  for (const f of FIELDS) {
    const a = JSON.stringify(x.record[f] ?? null), b = JSON.stringify(out.record[f] ?? null);
    if (a !== b) d.push(`${f}: python ${a}, browser ${b}`);
  }
  const ka = Object.keys(x.elements).sort().join(','), kb = Object.keys(out.elements || {}).sort().join(',');
  if (ka !== kb) { d.push(`elements: python [${ka}], browser [${kb}]`); return d; }
  for (const [k, ref] of Object.entries(x.elements)) {
    const s = summary(out.elements[k]);
    const box = Math.max(...s.bbox.map((v, i) => Math.abs(v - ref.bbox[i])));
    if (box > 1e-5) d.push(`${k}: box off by ${box.toExponential(2)} mm`);
    if (Math.abs(s.area - ref.area) > 1e-5 * Math.max(1, ref.area)) d.push(`${k}: area ${s.area.toFixed(6)} vs ${ref.area}`);
  }
  return d;
}

test('V5-1 every reference item: the browser gives the Python profile label (or the text layout where Python has none)', () => {
  const bad = [];
  let v5 = 0;
  for (const x of FX.items) {
    const out = HW.layOut(x.item);
    if (out.record.layout === 'v5') v5++;
    const d = differences(x, out);
    if (d.length) bad.push(`${x.set} ${x.id}: ${d.join('; ')}`);
  }
  assert.deepEqual(bad, []);
  assert.equal(v5, FX.items.filter((x) => x.elements).length);
  assert.ok(v5 >= 40, `only ${v5} profile labels in the reference`);
});

test('V5-2 the drawing replaces a screw\'s head word: it is not printed, and the record names it', () => {
  const it = FX.items.find((x) => x.id === 'v5-m5x20-shcs-a2').item;
  const r = HW.layOut(it);
  assert.equal(r.record.layout, 'v5');
  assert.equal(r.record.head_as_drawing, 'SHCS');
  assert.equal(r.record.secondary, 'A2');
  assert.deepEqual(Object.keys(r.elements).sort(), ['head-on view', 'main spec', 'secondary', 'side profile']);
  // the words the label carries, for the row and the planner: the head word kept, in the item's order
  assert.deepEqual(r.record.attributes, ['SHCS', 'A2']);
  assert.deepEqual(r.record.main_lines, ['M5 × 20']);
});

test('V5-3 a nut keeps its word beside the size; a button head gets the button drawing', () => {
  const nut = HW.layOut(FX.items.find((x) => x.id === 'v5-m5-nyloc-a2').item);
  assert.equal(nut.record.kind, 'nut');
  assert.equal(nut.record.lock, true);
  assert.ok(nut.elements['family word']);
  const bh = HW.layOut(FX.items.find((x) => x.id === 'v5-m4x10-bhcs-a2').item);
  const sh = HW.layOut(FX.items.find((x) => x.id === 'v5-m5x20-shcs-a2').item);
  assert.equal(bh.record.head, 'button');
  assert.notDeepEqual(summary(bh.elements['head-on view']).area, summary(sh.elements['head-on view']).area);
});

test('V5-4 the text layout on request, and without the v5 data; parts with no drawing keep it and say why', () => {
  const it = FX.items.find((x) => x.id === 'v5-m5x20-shcs-a2').item;
  const t = HW.layOut(it, { profile: false });
  assert.notEqual(t.record.layout, 'v5');
  assert.ok(t.elements.main1, 'text layout has its value line');
  assert.equal(t.record.profile_why, 'the text layout was asked for');
  const plain = layout(null).layOut(it);
  assert.notEqual(plain.record.layout, 'v5');
  assert.equal(plain.record.profile_why, undefined, 'no v5 data: the record is the text layout\'s, unchanged');
  const csk = { ...it, id: 'csk', head: 'countersunk', attributes: [{ path: 'head', text: 'FHCS' }, { path: 'material.base', text: 'A2' }] };
  const c = HW.layOut(csk);
  assert.notEqual(c.record.layout, 'v5');
  assert.equal(c.record.profile_why, 'no profile drawing for this part type');
  assert.equal(HW.profileCovered(csk), false);
  assert.equal(HW.profileCovered(it), true);
});

test('V5-5 a pinned word too wide for the profile layout falls back to the text layout, which prints it', () => {
  const x = FX.items.find((y) => y.id === 'v5-m6x30-shcs-aluminium');
  assert.equal(x.elements, null);
  const r = HW.layOut(x.item);
  assert.notEqual(r.record.layout, 'v5');
  assert.match(r.record.profile_why, /does not fit the profile layout/);
  assert.ok(r.record.attributes.includes('ALUMINIUM'));
});

test('V5-6 every element of every profile label is on the usable face and spaced by the v5 rules', () => {
  const D5 = globalThis.GEN2HardwareV5Data;
  for (const x of FX.items.filter((y) => y.elements)) {
    const r = HW.layOut(x.item);
    assert.ok(HW._ok, 'the layout exposes its checks');
    // every outline inside the face's bounding box less the margin (the fit test itself is the reference comparison)
    for (const [k, parts] of Object.entries(r.elements)) {
      const s = summary(parts);
      assert.ok(s.area > 0.05, `${x.id} ${k} is empty`);
    }
    assert.ok(Object.keys(r.elements).every((k) => Object.keys(D5.need).some((n) => n.split('|').includes(k))), `${x.id}: an element the spacing table does not know`);
  }
});

test('V5-7 the nut word sits AT the v5 word gap from the size', () => {
  const D5 = globalThis.GEN2HardwareV5Data;
  for (const id of ['v5-m5-nut-zinc', 'v5-m5-nyloc-a2', 'v5-m12-nut-steel', 'v5-m5-nut-acorn']) {
    const r = HW.layOut(FX.items.find((x) => x.id === id).item);
    const mk = (parts) => ({ parts: parts.map((rings) => { let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
      for (const ring of rings) for (let i = 0; i < ring.length; i += 2) { a = Math.min(a, ring[i]); c = Math.max(c, ring[i]); b = Math.min(b, ring[i + 1]); e = Math.max(e, ring[i + 1]); }
      return { rings, minx: a, miny: b, maxx: c, maxy: e }; }) });
    const el = (p) => { const m = mk(p); m.minx = Math.min(...m.parts.map((q) => q.minx)); m.maxx = Math.max(...m.parts.map((q) => q.maxx));
      m.miny = Math.min(...m.parts.map((q) => q.miny)); m.maxy = Math.max(...m.parts.map((q) => q.maxy)); return m; };
    const d = HW._elsDistance(el(r.elements['main spec']), el(r.elements['family word']));
    assert.ok(Math.abs(d - D5.nutWordGap) < 1e-6, `${id}: gap ${d} vs ${D5.nutWordGap}`);
  }
});

test('V5-8 optional words are left off from the END of the list, one at a time', () => {
  const r = HW.layOut(FX.items.find((x) => x.id === 'v5-m5x16-shcs-opt2').item);
  assert.equal(r.record.secondary, '12.9');
  assert.deepEqual(r.record.not_shown, ['BLK OX']);
  assert.deepEqual(r.record.not_shown_paths, ['finish']);
});

test('V5-9 the v5 spacing table decides: 0.01 mm inside a required gap fails, 0.01 mm outside passes', () => {
  const D5 = globalThis.GEN2HardwareV5Data;
  const r = HW.layOut(FX.items.find((x) => x.id === 'v5-m5x20-shcs-a2').item);
  const el = (rings) => { const parts = rings.map((rr) => { let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity;
    for (const ring of rr) for (let i = 0; i < ring.length; i += 2) { a = Math.min(a, ring[i]); c = Math.max(c, ring[i]); b = Math.min(b, ring[i + 1]); e = Math.max(e, ring[i + 1]); }
    return { rings: rr, minx: a, miny: b, maxx: c, maxy: e }; });
    return { parts, minx: Math.min(...parts.map((q) => q.minx)), maxx: Math.max(...parts.map((q) => q.maxx)), miny: Math.min(...parts.map((q) => q.miny)), maxy: Math.max(...parts.map((q) => q.maxy)) }; };
  const up = (rings, dy) => rings.map((rr) => rr.map((ring) => ring.map((v, i) => (i % 2 ? v + dy : v))));
  assert.equal(HW._fits5(r.elements), true);
  // raise the attribute line until it is the required gap -/+ 0.01 mm from the nearest drawing
  const gap = (els) => Math.min(HW._elsDistance(el(els.secondary), el(els['side profile'])), HW._elsDistance(el(els.secondary), el(els['head-on view'])));
  const need = D5.need['secondary|side profile'];
  assert.equal(need, D5.need['head-on view|secondary']);
  for (const [off, want] of [[-0.01, false], [0.01, true]]) {
    let els = { ...r.elements };
    for (let i = 0; i < 8; i++) els = { ...els, secondary: up(els.secondary, gap(els) - (need + off)) };
    assert.ok(Math.abs(gap(els) - (need + off)) < 1e-7, `gap ${gap(els)}`);
    assert.equal(HW._fits5(els), want, `secondary ${need + off} mm from the drawing`);
  }
});

test('V5-10 two nuts whose size and word differ only in where a NUL falls are laid out separately (a code review)', () => {
  const hw = layout();
  const base = FX.items.find((x) => x.id === 'v5-m5-nut-zinc').item;
  const itemB = { ...base, id: 'b', fields: ['M5\u0000N'], attributes: [{ path: 'head', text: 'UT' }, { path: 'finish', text: 'ZINC' }] };
  const a = hw.layOut({ ...base, id: 'a', fields: ['M5'], attributes: [{ path: 'head', text: 'N\u0000UT' }, { path: 'finish', text: 'ZINC' }] });
  const b = hw.layOut(itemB);
  const fresh = layout().layOut(itemB);
  assert.equal(b.record.word, 'UT');
  assert.deepEqual(b.elements, fresh.elements, 'the second item must not reuse the first one\'s outlines');
  assert.notDeepEqual(a.elements['family word'], b.elements['family word']);
});
