/* The label list (label-list.js), executed. Spec: D:/MODULITH/handoffs/label-release/LABEL-LIST-FORMAT.md.
   Run:  node --test test/

   The rules under test, from Joey and Astra (vault decisions.md, "The label tool"):
   - old builds convert WITHOUT changing their appearance: words, an explicit "no icon", an absent (predicted) badge;
   - identical labels are NOT deduplicated;
   - removing a drawer removes its assignment, not the label; a label with no words cannot be assigned;
   - editing a shared label offers this-drawer-only or all-linked; independent drawers never change;
   - the mirror an older tool edits is reconciled per drawer, in the planner's drawer order (Sol 01a11238). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const L = require('../label-list.js');

// the planner's unit shape after its sanitizer: label trimmed and cut to 40, a badge only with words
const U = (id, x, y, label, labelBadge) => {
  const u = { id, x, y, w: 1, hh: 2, fill: 'decor', shelves: 0 };
  if (label) u.label = label;
  if (label && labelBadge) u.labelBadge = labelBadge;
  return u;
};
const mirrorOfUnits = (units) => {   // what the planner wrote: { id: { label, labelBadge? } } for labelled drawers
  const out = {};
  for (const u of units) if (u.label) out[String(u.id)] = u.labelBadge ? { label: u.label, labelBadge: u.labelBadge } : { label: u.label };
  return out;
};

// a seeded PRNG (mulberry32) so the random sweep is the same every run
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const WORDS = ['Nuts', 'Bolts', 'M5 × 20', 'Coffee filters', 'Spare', 'M3 SHCS A2', 'Torx bits', 'Nuts'];
const BADGES = [undefined, { type: 'none' }, { type: 'icon', value: 'nut' }, { type: 'icon', value: 'screw-torx-head' }, { type: 'char', value: 'A' }, { type: 'char', value: 'M3' }];
function randomUnits(r) {
  const n = 1 + Math.floor(r() * 12); const units = []; const used = new Set();
  for (let i = 0; i < n; i++) {
    let x, y; do { x = Math.floor(r() * 6); y = Math.floor(r() * 4) * 2; } while (used.has(x + ',' + y));
    used.add(x + ',' + y);
    const label = r() < 0.75 ? WORDS[Math.floor(r() * WORDS.length)] : undefined;
    units.push(U(100 + i * 7, x, y, label, BADGES[Math.floor(r() * BADGES.length)]));
  }
  return units.sort(() => r() - 0.5);   // the units array is in no particular order
}

/* ---------------------------------------------------------------- conversion keeps the appearance */

test('LL-1: an old build converts with its appearance unchanged - 500 random builds: words, explicit none, absent badge', () => {
  const r = rng(20261006);
  for (let k = 0; k < 500; k++) {
    const units = randomUnits(r);
    const c = L.fromLegacyUnits(units);
    assert.deepEqual(L.mirrorOf(c.list, c.assignments), mirrorOfUnits(units), `build ${k}`);
    // and a second load changes nothing (the round trip is stable)
    const again = L.reconcile(units, c.list, c.assignments);
    assert.deepEqual(again.changes, [], `build ${k}: a reload changed something`);
    assert.deepEqual(again.list, c.list); assert.deepEqual(again.assignments, c.assignments);
  }
});

test('LL-2: no deduplication - two drawers that both say "Nuts" get two labels', () => {
  const c = L.fromLegacyUnits([U(1, 0, 0, 'Nuts'), U(2, 1, 0, 'Nuts')]);
  assert.equal(c.list.labels.length, 2);
  assert.notEqual(c.assignments['1'], c.assignments['2']);
});

test('LL-3: the planner\'s drawer order (y, then x) decides the list order, not the units array', () => {
  const c = L.fromLegacyUnits([U(9, 1, 2, 'C'), U(4, 1, 0, 'B'), U(7, 0, 2, 'X'), U(2, 0, 0, 'A')]);
  assert.deepEqual(c.list.labels.map((l) => l.text), ['A', 'B', 'X', 'C']);
});

test('LL-4: an absent badge stays absent (predict), an explicit none stays none, a drawer without words gets no label', () => {
  const c = L.fromLegacyUnits([U(1, 0, 0, 'Bolts'), U(2, 1, 0, 'Nuts', { type: 'none' }), U(3, 2, 0)]);
  const byText = Object.fromEntries(c.list.labels.map((l) => [l.text, l]));
  assert.equal('badge' in byText.Bolts, false);
  assert.deepEqual(byText.Nuts.badge, { type: 'none' });
  assert.equal(c.assignments['3'], undefined);
});

/* ---------------------------------------------------------------- an older tool edited the mirror */

function shared() {   // a 60-character part label shared by drawers 1 and 2, an unassigned label, drawer 3 independent
  const part = { schema: 'part-record/1', family: 'screw', head: { status: 'listed', value: 'socket-cap' } };
  const text = 'M5 × 20 SOCKET HEAD CAP SCREW, A2 STAINLESS STEEL, FULL THREAD';
  const list = { format: 'modulith-labels', version: 1, labels: [
    { id: 'aaaaaaaaaaaa', text, part, pins: ['thread.diameter'] },
    { id: 'bbbbbbbbbbbb', text: 'Spare' },
    { id: 'cccccccccccc', text: 'Washers', badge: { type: 'icon', value: 'washer' } },
  ] };
  const assignments = { 1: 'aaaaaaaaaaaa', 2: 'aaaaaaaaaaaa', 3: 'cccccccccccc' };
  const cut = text.slice(0, 40);
  const units = [U(1, 0, 0, cut), U(2, 1, 0, cut), U(3, 2, 0, 'Washers', { type: 'icon', value: 'washer' })];
  return { list, assignments, units, cut };
}

test('LL-5: a label longer than 40 compares on its first 40 - an untouched mirror keeps the part label, sharing and the unassigned label', () => {
  const s = shared();
  const r = L.reconcile(s.units, s.list, s.assignments);
  assert.deepEqual(r.changes, []);
  assert.equal(r.list.labels.length, 3, 'the unassigned "Spare" label is kept');
  assert.equal(r.assignments['1'], 'aaaaaaaaaaaa'); assert.equal(r.assignments['2'], 'aaaaaaaaaaaa');
  assert.ok(r.list.labels[0].part, 'the part record survives');
});

test('LL-6: an older tool EDITED drawer 2 - the mirror wins for drawer 2 only; drawer 1 keeps the shared part label', () => {
  const s = shared();
  s.units[1].label = 'M5 × 25';
  const r = L.reconcile(s.units, s.list, s.assignments);
  assert.equal(r.assignments['1'], 'aaaaaaaaaaaa', 'drawer 1 is untouched');
  const nl = r.list.labels.find((l) => l.id === r.assignments['2']);
  assert.equal(nl.text, 'M5 × 25'); assert.equal(nl.part, undefined, 'the new label comes from the mirror, nothing more');
  assert.equal(r.list.labels[r.list.labels.length - 1].id, nl.id, 'appended at the end');
  assert.deepEqual(r.changes, [{ unit: 2, kind: 'edited', from: 'aaaaaaaaaaaa', label: nl.id }]);
});

test('LL-7: an older tool changed only the BADGE of drawer 3 - that counts as an edit too', () => {
  const s = shared();
  s.units[2].labelBadge = { type: 'none' };
  const r = L.reconcile(s.units, s.list, s.assignments);
  assert.notEqual(r.assignments['3'], 'cccccccccccc');
  assert.deepEqual(r.list.labels.find((l) => l.id === r.assignments['3']).badge, { type: 'none' });
  assert.ok(r.list.labels.some((l) => l.id === 'cccccccccccc'), 'the old label is kept (unassigned now)');
});

test('LL-8: an older tool CLEARED drawer 1 - unassigned, and the label stays in the list', () => {
  const s = shared();
  delete s.units[0].label;
  const r = L.reconcile(s.units, s.list, s.assignments);
  assert.equal(r.assignments['1'], undefined);
  assert.equal(r.assignments['2'], 'aaaaaaaaaaaa');
  assert.equal(r.list.labels.length, 3);
});

test('LL-9: an older tool ADDED a label to a new drawer 4 - a new label, assigned; drawers it removed lose only their assignment', () => {
  const s = shared();
  s.units = [s.units[0], U(4, 3, 0, 'Springs')];        // drawers 2 and 3 removed, drawer 4 added
  const r = L.reconcile(s.units, s.list, s.assignments);
  assert.equal(r.assignments['2'], undefined); assert.equal(r.assignments['3'], undefined);
  assert.equal(r.list.labels.find((l) => l.id === r.assignments['4']).text, 'Springs');
  assert.ok(r.list.labels.some((l) => l.id === 'cccccccccccc'), 'a removed drawer\'s label is kept');
});

/* ---------------------------------------------------------------- editing */

test('LL-10: assign refuses a label with no words; replacing reports the displaced label', () => {
  const s = shared();
  let st = { list: L.cleanLabelList(s.list, { inBuild: true }), assignments: s.assignments };
  st = L.addLabel(st, { text: '   ' }).state;
  const empty = st.list.labels[st.list.labels.length - 1].id;
  assert.equal(L.assign(st, 5, empty).ok, false);
  const r = L.assign(st, 3, 'bbbbbbbbbbbb');
  assert.equal(r.ok, true); assert.equal(r.replaced, 'cccccccccccc');
});

test('LL-11: editing a shared label - "this drawer only" clones it; "all linked drawers" changes both; others never change', () => {
  const s = shared();
  const st = { list: L.cleanLabelList(s.list, { inBuild: true }), assignments: s.assignments };
  const one = L.editLabel(st, 'aaaaaaaaaaaa', { text: 'M5 × 20 A4' }, 'this', 2);
  assert.equal(one.cloned, true);
  assert.equal(one.state.assignments['1'], 'aaaaaaaaaaaa');
  assert.notEqual(one.state.assignments['2'], 'aaaaaaaaaaaa');
  assert.equal(one.state.list.labels.find((l) => l.id === 'aaaaaaaaaaaa').text, s.list.labels[0].text, 'the original is untouched');
  const all = L.editLabel(st, 'aaaaaaaaaaaa', { text: 'M5 × 20 A4' }, 'all');
  assert.equal(all.cloned, false);
  assert.equal(all.state.assignments['1'], 'aaaaaaaaaaaa'); assert.equal(all.state.assignments['2'], 'aaaaaaaaaaaa');
  assert.equal(all.state.list.labels.find((l) => l.id === 'aaaaaaaaaaaa').text, 'M5 × 20 A4');
  assert.equal(all.state.assignments['3'], 'cccccccccccc');
  assert.equal(st.list.labels[0].text, s.list.labels[0].text, 'the input state is never mutated');
});

test('LL-12: removing a drawer keeps its label; editing a label to no words unassigns it everywhere', () => {
  const s = shared();
  const st = { list: L.cleanLabelList(s.list, { inBuild: true }), assignments: s.assignments };
  const rm = L.removeDrawer(st, 3).state;
  assert.equal(rm.assignments['3'], undefined);
  assert.ok(rm.list.labels.some((l) => l.id === 'cccccccccccc'));
  const blank = L.editLabel(st, 'aaaaaaaaaaaa', { text: '' }, 'all').state;
  assert.equal(blank.assignments['1'], undefined); assert.equal(blank.assignments['2'], undefined);
  assert.ok(blank.list.labels.some((l) => l.id === 'aaaaaaaaaaaa'), 'kept, unassigned');
});

/* ---------------------------------------------------------------- cleaning and validation */

test('LL-13: cleanLabelList drops malformed labels, mints ids for missing / duplicate ones, keeps unknown keys', () => {
  const c = L.cleanLabelList({ format: 'x', version: 9, extra: { a: 1 }, labels: [
    { id: 'dddddddddddd', text: 'One', future: [1, 2] }, { id: 'dddddddddddd', text: 'Two' }, { text: 'Three' }, 'junk', { text: 42 }, { text: 'x'.repeat(201) },
  ] });
  assert.equal(c.format, 'modulith-labels'); assert.equal(c.version, 1);
  assert.deepEqual(c.extra, { a: 1 });
  assert.deepEqual(c.labels.map((l) => l.text), ['One', 'Two', 'Three']);
  assert.equal(c.labels[0].id, 'dddddddddddd'); assert.deepEqual(c.labels[0].future, [1, 2]);
  assert.notEqual(c.labels[1].id, 'dddddddddddd'); assert.match(c.labels[2].id, L.ID_RE);
});

test('LL-14: inside a build there is no uploaded SVG and no part photo; a standalone project keeps the SVG, style and output', () => {
  const svg = '<svg viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
  const part = { schema: 'part-record/1', family: 'washer', photo: 'data:image/jpeg;base64,' + 'A'.repeat(50000) };
  const doc = { format: 'modulith-labels', version: 1, style: { capMm: 5, depth: 99 }, output: { printer: 'xl' },
    labels: [{ text: 'Custom', badge: { type: 'icon', svg } }, { text: 'Washers', part }] };
  const b = L.cleanLabelList(doc, { inBuild: true });
  assert.equal(b.labels[0].badge, undefined, 'an svg-only icon becomes absent (predict) in a build');
  assert.equal(b.labels[1].part.photo, undefined); assert.equal(b.labels[1].part.family, 'washer');
  assert.equal(b.style, undefined); assert.equal(b.output, undefined);
  const s = L.cleanLabelList(doc);
  assert.deepEqual(s.labels[0].badge, { type: 'icon', svg });
  assert.deepEqual(s.style, { capMm: 5 }, 'an out-of-range value is dropped, never clamped');
  assert.deepEqual(s.output, { printer: 'xl' });
  assert.equal(s.labels[1].part, undefined, 'a part with its photo is over the size bound outside a build: dropped, and validation says so');
  assert.ok(L.validateLabelList(doc).some((m) => /Label 2: "part"/.test(m)));
});

test('LL-15: validateLabelList says what is wrong in plain words, and a good list has no problems', () => {
  const good = { format: 'modulith-labels', version: 1, labels: [{ id: 'eeeeeeeeeeee', text: 'Nuts', badge: { type: 'char', value: 'M3' }, copies: 2 }],
    assignments: { 4: 'eeeeeeeeeeee' } };
  assert.deepEqual(L.validateLabelList(good), []);
  const bad = { format: 'labels', version: 2, labels: [{ id: 'X', text: 7, badge: { type: 'char', value: 'TOOLONG' }, copies: 0, pins: ['Bad Path'] }, { id: 'ffffffffffff', text: ' ' }],
    style: { capMm: 9, colour: 'red' }, assignments: { 0: 'ffffffffffff', 5: 'ffffffffffff', 6: 'zzzzzzzzzzzz' } };
  const p = L.validateLabelList(bad).join('\n');
  for (const re of [/"format" must be/, /newer version \(2\)/, /Label 1: the id must be/, /Label 1: "text" must be a string/, /Label 1: the badge must be/,
    /Label 1: "copies"/, /Label 1: "pins"/, /Style "capMm" must be a number from 2 to 6.5/, /Style "colour" is not a label setting/,
    /Assignment "0": a drawer id/, /drawer 5: label 2 has no words/, /drawer 6: no label has the id "zzzzzzzzzzzz"/]) assert.match(p, re);
});

test('LL-16: cleanAssignments keeps only kept drawers, existing labels, and labels with words', () => {
  const list = L.cleanLabelList({ labels: [{ id: 'gggggggggggg', text: 'A' }, { id: 'hhhhhhhhhhhh', text: '' }] }, { inBuild: true });
  assert.deepEqual(L.cleanAssignments({ 1: 'gggggggggggg', 2: 'hhhhhhhhhhhh', 3: 'nope', 4: 'gggggggggggg', x: 'gggggggggggg' }, list, [1, 2, 3]),
    { 1: 'gggggggggggg' });
});

test('LL-17: a legacy generator project converts - predicted badges become absent, manual ones stay, settings split into style and output', () => {
  const svg = '<svg viewBox="0 0 1 1"/>';
  const proj = { fmt: 'gen2-edgelabel-project', v: 1, labels: [
    { text: 'Nuts', badge: { type: 'icon', value: 'nut' }, manual: false },
    { text: 'Bolts', badge: { type: 'icon', value: 'bolt-hex-head' }, manual: true },
    { text: 'Logo', badge: { type: 'icon', svg }, manual: true, u: 3, n: 1, held: true },
    { text: 'Plain', badge: { type: 'none' }, manual: true }],
    settings: { 'font-size': '5.5', 'text-depth': '0.6', 'badge-size': '40', 'bold-text': true, 'all-caps': false, 'predict-icons': true, 'printer-preset': 'xl', 'plate-w': '360' } };
  const c = L.fromGeneratorProject(proj);
  assert.equal(c.labels[0].badge, undefined, 'a predicted badge is not frozen');
  assert.deepEqual(c.labels[1].badge, { type: 'icon', value: 'bolt-hex-head' });
  assert.deepEqual(c.labels[2].badge, { type: 'icon', svg }); assert.equal(c.labels[2].u, undefined, 'link-only keys are not carried');
  assert.deepEqual(c.labels[3].badge, { type: 'none' });
  assert.deepEqual(c.style, { capMm: 5.5, depth: 0.6, bold: true, allCaps: false, predictIcons: true }, 'badgeSize 40 is out of range: dropped');
  assert.deepEqual(c.output, { 'printer-preset': 'xl', 'plate-w': '360' });
});
