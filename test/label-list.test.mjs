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

test('LL-14: inside a build (compact) there is no part photo but the uploaded icon IS kept (label content); a standalone project (the full backup) keeps both, style and output', () => {
  const svg = '<svg viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
  const part = { schema: 'part-record/1', family: 'washer', photo: 'data:image/jpeg;base64,' + 'A'.repeat(50000) };
  const doc = { format: 'modulith-labels', version: 1, style: { capMm: 5, depth: 99 }, output: { printer: 'xl' },
    labels: [{ text: 'Custom', badge: { type: 'icon', svg } }, { text: 'Washers', part }] };
  const b = L.cleanLabelList(doc, { inBuild: true });
  assert.deepEqual(b.labels[0].badge, { type: 'icon', svg }, 'an uploaded icon is label content: a build keeps it (Astra 2026-10-06)');
  assert.equal(b.labels[1].part.photo, undefined); assert.equal(b.labels[1].part.family, 'washer');
  assert.equal(b.style, undefined); assert.equal(b.output, undefined);
  const s = L.cleanLabelList(doc);
  assert.deepEqual(s.labels[0].badge, { type: 'icon', svg });
  assert.deepEqual(s.style, { capMm: 5 }, 'an out-of-range value is dropped, never clamped');
  assert.deepEqual(s.output, { printer: 'xl' });
  assert.equal(s.labels[1].part.photo, part.photo, 'the FULL project (the backup) keeps the photo (Astra: never discarded silently)');
  assert.deepEqual(L.validateLabelList(doc).filter((m) => /Label 2/.test(m)), [], 'a 50 KB JPEG data URL is a valid photo');
  // a malformed photo: the part record is kept, the photo is left out, and validation says so
  const badPhoto = { format: 'modulith-labels', version: 1, labels: [{ text: 'W', part: { schema: 'part-record/1', family: 'washer', photo: 'http://x/y.jpg' } }] };
  const bp = L.cleanLabelList(badPhoto);
  assert.equal(bp.labels[0].part.family, 'washer'); assert.equal(bp.labels[0].part.photo, undefined);
  assert.ok(L.validateLabelList(badPhoto).some((m) => /Label 1: the part's photo must be/.test(m)));
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
    /Assignment "0": a drawer id/, /drawer 5: label 2 is empty \(no words and no icon\)/, /drawer 6: no label has the id "zzzzzzzzzzzz"/]) assert.match(p, re);
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

/* ---------------------------------------------------------------- icon-only labels (Astra 2026-10-06) */

test('LL-18: text only, icon only, and text with an icon are labels; neither is EMPTY and is never assigned', () => {
  const st = { list: L.cleanLabelList({ labels: [
    { id: 'iiiiiiiiiiii', text: '', badge: { type: 'icon', value: 'nut' } },
    { id: 'jjjjjjjjjjjj', text: '', badge: { type: 'char', value: 'M3' } },
    { id: 'kkkkkkkkkkkk', text: '', badge: { type: 'none' } },
    { id: 'llllllllllll', text: '   ' },
    { id: 'mmmmmmmmmmmm', text: 'Nuts', badge: { type: 'icon', value: 'nut' } },
  ] }, { inBuild: true }), assignments: {} };
  for (const id of ['iiiiiiiiiiii', 'jjjjjjjjjjjj', 'mmmmmmmmmmmm']) assert.equal(L.assign(st, 1, id).ok, true, id);
  for (const id of ['kkkkkkkkkkkk', 'llllllllllll']) assert.match(L.assign(st, 1, id).reason, /empty label/, id);
  const svgOnly = { text: '', badge: { type: 'icon', svg: '<svg/>' } };
  assert.equal(L.iconOnly(svgOnly), true, 'in a full project an uploaded icon with no words is icon-only');
  assert.equal(L.isEmpty(svgOnly, { inBuild: true }), false, 'a build keeps the uploaded icon (label content), so it is icon-only there too');
  assert.deepEqual(L.validateLabelList({ format: 'modulith-labels', version: 1, labels: [{ id: 'nnnnnnnnnnnn', ...svgOnly }], assignments: { 2: 'nnnnnnnnnnnn' } }), []);
});

test('LL-19: an icon-only drawer survives reconciling: older tools cannot show it, so a mirror without words keeps it; words typed there are an edit', () => {
  const list = { format: 'modulith-labels', version: 1, labels: [{ id: 'oooooooooooo', text: '', badge: { type: 'icon', value: 'washer' } }] };
  const kept = L.reconcile([U(1, 0, 0)], list, { 1: 'oooooooooooo' });
  assert.deepEqual(kept.changes, []); assert.equal(kept.assignments['1'], 'oooooooooooo');
  assert.deepEqual(L.mirrorOf(kept.list, kept.assignments), {}, 'no mirror: an older tool shows an empty drawer');
  const typed = L.reconcile([U(1, 0, 0, 'Washers')], list, { 1: 'oooooooooooo' });
  assert.equal(typed.changes[0].kind, 'edited');
  assert.equal(typed.list.labels.find((l) => l.id === typed.assignments['1']).text, 'Washers');
  assert.ok(typed.list.labels.some((l) => l.id === 'oooooooooooo'), 'the icon-only label is kept');
});

test('LL-20: editing a label to icon only keeps it on its drawers; editing it to empty unassigns it', () => {
  const st = { list: L.cleanLabelList({ labels: [{ id: 'pppppppppppp', text: 'Nuts', badge: { type: 'icon', value: 'nut' } }] }, { inBuild: true }), assignments: { 1: 'pppppppppppp' } };
  assert.equal(L.editLabel(st, 'pppppppppppp', { text: '' }, 'all').state.assignments['1'], 'pppppppppppp');
  assert.equal(L.editLabel(st, 'pppppppppppp', { text: '', badge: { type: 'none' } }, 'all').state.assignments['1'], undefined);
});

test('LL-21: an old build never had an icon-only drawer - a unit carrying a badge without words converts to NO label (the drawer stays empty)', () => {
  // the planner drops such a badge on load (cleanLabelBadge lives and dies with the words); a raw one is ignored here too
  const c = L.fromLegacyUnits([{ id: 1, x: 0, y: 0, labelBadge: { type: 'icon', value: 'nut' } }, U(2, 1, 0, 'Bolts')]);
  assert.deepEqual(c.list.labels.map((l) => l.text), ['Bolts']);
  assert.equal(c.assignments['1'], undefined);
});

test('LL-22: a custom uploaded icon in a build survives reconciling; older tools see the words with no badge (their own prediction)', () => {
  const svg = '<svg viewBox="0 0 1 1"><circle r="1"/></svg>';
  const list = { format: 'modulith-labels', version: 1, labels: [
    { id: 'ssssssssssss', text: 'Logo bits', badge: { type: 'icon', svg } }, { id: 'tttttttttttt', text: '', badge: { type: 'icon', svg } }] };
  const assign = { 1: 'ssssssssssss', 2: 'tttttttttttt' };
  const st = L.cleanLabelList(list, { inBuild: true });
  assert.deepEqual(st.labels[0].badge, { type: 'icon', svg });
  assert.deepEqual(L.mirrorOf(st, assign), { 1: { label: 'Logo bits' } }, 'the mirror carries the words only; the icon-only label has none');
  const r = L.reconcile([U(1, 0, 0, 'Logo bits'), U(2, 1, 0)], list, assign);
  assert.deepEqual(r.changes, []);
  assert.deepEqual(r.list.labels.map((l) => l.badge), [{ type: 'icon', svg }, { type: 'icon', svg }]);
  const picked = L.reconcile([U(1, 0, 0, 'Logo bits', { type: 'icon', value: 'star' }), U(2, 1, 0)], list, assign);
  assert.equal(picked.changes[0].kind, 'edited', 'an older tool picking a built-in icon there is an edit');
});

/* ---- label tool step 3: hardware labels, the planner's in-place edit, imports ---- */
const ITEM = { schema: 'part-picker-label-item/1', id: 'rec_m5x20', family: 'screw', fields: ['M5', '× 20'],
  attributes: [{ path: 'head', text: 'SHCS', meaning: 'Socket head cap' }, { path: 'material.base', text: 'A2' }],
  pinned: ['head'], optional: ['material.base'], value_missing: [] };

test('LL-23: a hardware label keeps its item verbatim in a build; a malformed item is dropped and the words stay', () => {
  const st = L.cleanLabelList({ labels: [{ id: 'hhhhhhhhhhhh', text: 'M5 × 20 · SHCS', hardware: ITEM }] }, { inBuild: true });
  assert.deepEqual(st.labels[0].hardware, ITEM);
  assert.ok(L.isHardware(st.labels[0]));
  const bad = [
    Object.assign({}, ITEM, { schema: 'part-record/1' }),
    Object.assign({}, ITEM, { pinned: ['nowhere'] }),
    Object.assign({}, ITEM, { optional: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'head'] }),
    Object.assign({}, ITEM, { attributes: [{ path: 'head', text: 'X'.repeat(61) }] }),
    Object.assign({}, ITEM, { fields: [1, 2] }),
  ];
  for (const h of bad) {
    const c = L.cleanLabel({ text: 'M5 × 20', hardware: h }, { inBuild: true });
    assert.equal(c.hardware, undefined, JSON.stringify(h).slice(0, 80));
    assert.equal(c.text, 'M5 × 20', 'the label stays as words');
    assert.ok(L.validateLabelList({ format: 'modulith-labels', version: 1, labels: [{ text: 'x', hardware: h }] }).some((m) => /"hardware" must be/.test(m)));
  }
});

test('LL-24: reconcile with editInPlace - a plain label carried by one drawer takes the edit; shared, hardware and part labels never change', () => {
  const list = { format: 'modulith-labels', version: 1, labels: [
    { id: 'aaaaaaaaaaaa', text: 'Filters' },
    { id: 'bbbbbbbbbbbb', text: 'Shared' },
    { id: 'cccccccccccc', text: 'M5 × 20 · SHCS', hardware: ITEM }] };
  const assign = { 1: 'aaaaaaaaaaaa', 2: 'bbbbbbbbbbbb', 3: 'bbbbbbbbbbbb', 4: 'cccccccccccc' };
  const units = [U(1, 0, 0, 'Coffee filters', { type: 'icon', value: 'star' }), U(2, 1, 0, 'Shared, edited'), U(3, 2, 0, 'Shared'), U(4, 3, 0, 'Typed over')];
  const r = L.reconcile(units, list, assign, { editInPlace: true });
  const byId = new Map(r.list.labels.map((l) => [l.id, l]));
  assert.equal(r.assignments['1'], 'aaaaaaaaaaaa', 'the sole-carrier plain label keeps its id');
  assert.deepEqual([byId.get('aaaaaaaaaaaa').text, byId.get('aaaaaaaaaaaa').badge], ['Coffee filters', { type: 'icon', value: 'star' }]);
  assert.notEqual(r.assignments['2'], 'bbbbbbbbbbbb', 'a shared label: the edited drawer gets its own label');
  assert.equal(r.assignments['3'], 'bbbbbbbbbbbb', 'its other drawer keeps the shared one');
  assert.equal(byId.get('bbbbbbbbbbbb').text, 'Shared');
  assert.notEqual(r.assignments['4'], 'cccccccccccc', 'a hardware label is never edited by typing over its words');
  assert.deepEqual(byId.get('cccccccccccc').hardware, ITEM, 'and keeps its item, unassigned (back in the tray)');
  assert.equal(L.assignedUnits({ list: r.list, assignments: r.assignments }, 'cccccccccccc').length, 0);
  assert.deepEqual(r.changes.map((c) => c.kind), ['edited-in-place', 'edited', 'edited']);
  // without the option it is the spec's load-time rule: always a new label
  const spec = L.reconcile(units, list, assign);
  assert.notEqual(spec.assignments['1'], 'aaaaaaaaaaaa');
  // and a second pass changes nothing
  const again = L.reconcile(units, r.list, r.assignments, { editInPlace: true });
  assert.deepEqual(again.changes, []);
  assert.equal(JSON.stringify(again.list), JSON.stringify(r.list));
});

test('LL-25: appendLabels - an import keeps free ids, renames colliding ones, drops non-labels, keeps hardware items', () => {
  const st = { list: L.cleanLabelList({ labels: [{ id: 'aaaaaaaaaaaa', text: 'Existing' }] }, { inBuild: true }), assignments: { 1: 'aaaaaaaaaaaa' } };
  const r = L.appendLabels(st, [
    { id: 'aaaaaaaaaaaa', text: 'Same id, different label', hardware: ITEM },
    { id: 'dddddddddddd', text: 'Free id' },
    { text: 'No id' },
    { nope: true },
  ]);
  assert.equal(r.remapped, 1);
  assert.equal(r.dropped, 1);
  assert.equal(r.added.length, 3);
  assert.equal(r.state.list.labels[0].text, 'Existing', 'the existing label is untouched');
  assert.equal(r.state.assignments['1'], 'aaaaaaaaaaaa');
  const ids = r.state.list.labels.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicate ids');
  assert.ok(ids.includes('dddddddddddd'));
  assert.deepEqual(r.state.list.labels[1].hardware, ITEM);
  assert.notEqual(r.state.list.labels[1].id, 'aaaaaaaaaaaa');
  assert.deepEqual(st.list.labels.length, 1, 'the input state is not mutated');
});

test('LL-24b: reconcile with editInPlace keeps an UPLOADED icon through a word edit; a built-in icon follows the mirror', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
  const list = { format: 'modulith-labels', version: 1, labels: [
    { id: 'svglabel0001', text: 'Bolts', badge: { type: 'icon', svg } },
    { id: 'nutlabel0002', text: 'Nuts', badge: { type: 'icon', value: 'nut' } },
    { id: 'bothlabel003', text: 'Washers', badge: { type: 'icon', value: 'washer', svg } }] };
  const assign = { 1: 'svglabel0001', 2: 'nutlabel0002', 3: 'bothlabel003' };
  // the drawers' new words; drawer 2 still shows its nut (the mirror carries it), drawer 3 had its icon removed in an older tool
  const units = [{ id: 1, x: 0, y: 0, label: 'Bolts M5' }, { id: 2, x: 1, y: 0, label: 'Nuts M5', labelBadge: { type: 'icon', value: 'nut' } },
    { id: 3, x: 2, y: 0, label: 'Washers M5' }];
  const r = L.reconcile(units, list, assign, { editInPlace: true });
  const by = (id) => r.list.labels.find((l) => l.id === id);
  assert.equal(by('svglabel0001').text, 'Bolts M5');
  assert.deepEqual(by('svglabel0001').badge, { type: 'icon', svg }, 'the uploaded icon survives the edit');
  assert.deepEqual(by('nutlabel0002').badge, { type: 'icon', value: 'nut' });
  assert.equal(by('bothlabel003').badge, undefined, 'an icon the mirror DID carry and no longer shows was removed: it goes');
  assert.deepEqual(r.changes.map((c) => c.kind), ['edited-in-place', 'edited-in-place', 'edited-in-place']);
});

test('LL-26: reconcile with editInPlace - clearing a sole plain label deletes it; a shared, hardware or part label is only unassigned', () => {
  const list = { format: 'modulith-labels', version: 1, labels: [
    { id: 'aaaaaaaaaaaa', text: 'Filters' },
    { id: 'bbbbbbbbbbbb', text: 'Shared' },
    { id: 'cccccccccccc', text: 'M5 × 20 · SHCS', hardware: ITEM },
    { id: 'dddddddddddd', text: 'Unassigned, kept' }] };
  const assign = { 1: 'aaaaaaaaaaaa', 2: 'bbbbbbbbbbbb', 3: 'bbbbbbbbbbbb', 4: 'cccccccccccc' };
  const units = [U(1, 0, 0, ''), U(2, 1, 0, ''), U(3, 2, 0, 'Shared'), U(4, 3, 0, '')];
  const r = L.reconcile(units, list, assign, { editInPlace: true });
  const ids = r.list.labels.map((l) => l.id);
  assert.deepEqual(ids, ['bbbbbbbbbbbb', 'cccccccccccc', 'dddddddddddd'], 'only the sole plain label is gone; an unassigned one is untouched');
  assert.deepEqual(r.assignments, { 3: 'bbbbbbbbbbbb' });
  assert.deepEqual(r.changes.map((c) => c.kind), ['removed-in-place', 'cleared', 'cleared']);
  // the load-time rule (no option) keeps every label
  const spec = L.reconcile(units, list, assign);
  assert.equal(spec.list.labels.length, 4);
  assert.deepEqual(spec.changes.map((c) => c.kind), ['cleared', 'cleared', 'cleared']);
});
