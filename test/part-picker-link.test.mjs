/* The Part Picker sheet's contract (part-picker-link.js) - and that it is the SAME contract the published Part Picker speaks:
   parts/js/embed.js is the Part Picker's own side, copied in by its publish tool, so it is executed here against ours.
   Run:  node --test test/*.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
require('../part-picker-link.js');
const P = globalThis.GEN2PartPickerLink;
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const FX = JSON.parse(readFileSync(new URL('./fixtures/hardware-bands-ref.json', import.meta.url), 'utf8'));
const EMBED = new URL('../parts/js/embed.js', import.meta.url);

const item = (o = {}) => ({ schema: 'part-picker-label-item/1', id: 'r1', fields: ['M5', '20'], attributes: [{ path: 'head', text: 'SHCS' }], pinned: ['head'], ...o });
const FRAME = { name: 'the sheet frame' }, OTHER = { name: 'another window' };
const ORIGIN = 'https://labels.modulith.systems';
const ev = (data, o = {}) => ({ data, source: FRAME, origin: ORIGIN, ...o });

test('itemOk takes a Part Picker item and refuses one the layout cannot take (the checks a #hw= link has always had)', () => {
  assert.ok(P.itemOk(item()));
  assert.equal(FX.items.length, 32);
  for (const x of FX.items) assert.ok(P.itemOk(x.item), x.id);   // every reference part item (banded, solid and dashed)
  const bad = {
    'not an object': null, 'another schema': item({ schema: 'x' }), 'no id': item({ id: 7 }),
    'a field past 60 characters': item({ fields: ['x'.repeat(61)] }), 'seven fields': item({ fields: Array(7).fill('M5') }),
    'a printed word past 60': item({ attributes: [{ path: 'head', text: 'y'.repeat(61) }] }),
    '25 attributes': item({ attributes: Array.from({ length: 25 }, (_, i) => ({ path: 'a' + i, text: 'x' })), pinned: [] }),
    'nine printable': item({ attributes: Array.from({ length: 9 }, (_, i) => ({ path: 'a' + i, text: 'x' })), pinned: Array.from({ length: 9 }, (_, i) => 'a' + i) }),
    'a pin it does not carry': item({ pinned: ['material'] }),
    'pinned not a list': item({ pinned: 'head' }),
  };
  for (const [why, it] of Object.entries(bad)) assert.equal(P.itemOk(it), false, why);
});

test('readAdd takes only the sheet\'s own frame on this site, and only an add of 1 to 200 items', () => {
  const add = (items) => ({ gen2parts: 'add', v: 1, items });
  assert.deepEqual(P.readAdd(ev(add([item()])), FRAME, ORIGIN), { items: [item()], batch: undefined });
  // the batch id the Picker's flow refine mints per send is carried through, checked; a bad one is dropped, never refused
  assert.deepEqual(P.readAdd(ev({ ...add([item()]), batch: 'batch_0001-aB' }), FRAME, ORIGIN), { items: [item()], batch: 'batch_0001-aB' });
  assert.deepEqual(P.readAdd(ev({ ...add([item()]), batch: 'x y' }), FRAME, ORIGIN), { items: [item()], batch: undefined }, 'a malformed batch id is dropped');
  assert.deepEqual(P.readAdd(ev({ ...add([]), batch: 'batch_0001-aB' }), FRAME, ORIGIN), { refused: 'There were no part labels in it.', batch: 'batch_0001-aB' }, 'a refusal carries it too');
  assert.equal(P.readAdd(ev(add([item()]), { source: OTHER }), FRAME, ORIGIN), null, 'another window');
  assert.equal(P.readAdd(ev(add([item()]), { origin: 'https://evil.example' }), FRAME, ORIGIN), null, 'another origin');
  assert.equal(P.readAdd(ev(add([item()])), null, ORIGIN), null, 'no sheet open yet');
  assert.equal(P.readAdd(ev({ gen2label: 'hello' }), FRAME, ORIGIN), null, 'the planner link\'s messages are not ours');
  assert.equal(P.readAdd(ev({ gen2parts: 'add', v: 2, items: [] }), FRAME, ORIGIN), null, 'a newer version is ignored');
  assert.equal(P.readAdd(ev({ gen2parts: 'added', v: 1, count: 1 }), FRAME, ORIGIN), null, 'our own reply');
  assert.match(P.readAdd(ev(add([])), FRAME, ORIGIN).refused, /no part labels/);
  assert.match(P.readAdd(ev(add('x')), FRAME, ORIGIN).refused, /no part labels/);
  assert.match(P.readAdd(ev(add(Array(201).fill(item()))), FRAME, ORIGIN).refused, /up to 200/);
  assert.ok(P.readAdd(ev(add(Array(200).fill(item()))), FRAME, ORIGIN).items);
});

test('planAdd: new parts go to the end, a part already in the list is updated in place, a bad one is skipped and counted', () => {
  const a = item({ id: 'a' }), b = item({ id: 'b' }), c = item({ id: 'c' }), b2 = item({ id: 'b', fields: ['M6'] });
  const p = P.planAdd([null, 'b', null, 'x'], [a, b2, { schema: 'nope' }, c, item({ id: 'd', fields: ['z'.repeat(61)] })]);
  assert.deepEqual(p.add.map(i => i.id), ['a', 'c']);
  assert.deepEqual(p.update, [{ index: 1, item: b2 }]);
  assert.equal(p.skipped, 2);
  // a batch naming a part twice keeps the last, once; a list holding a part twice updates the first
  const q = P.planAdd(['a', 'a'], [b, item({ id: 'b', fields: ['M8'] }), item({ id: 'a', fields: ['M2'] })]);
  assert.deepEqual(q.add.map(i => i.fields[0]), ['M8']);
  assert.deepEqual(q.update.map(u => [u.index, u.item.fields[0]]), [[0, 'M2']]);
  assert.deepEqual(P.planAdd([], []), { add: [], update: [], skipped: 0 });
});

test('the replies are what the Part Picker reads', () => {
  assert.deepEqual(P.added(3, 1), { gen2parts: 'added', v: 1, count: 3, skipped: 1 });
  assert.deepEqual(P.refused('No.'), { gen2parts: 'refused', v: 1, reason: 'No.' });
  assert.equal(P.refused('x'.repeat(400)).reason.length, 300);
});

test('the published Part Picker (parts/js/embed.js) speaks this contract: its add is taken, our replies read, its limits ours', async (t) => {
  if (!existsSync(EMBED)) { t.skip('parts/ is not published here'); return; }
  const E = await import(EMBED.href);
  // Picker -> Studio
  const items = [item(), item({ id: 'r2' })];
  const msg = E.addMessage(items);   // a Picker from its flow refine on mints a batch id per send; an older one sends none: either way it comes back as sent
  const got = P.readAdd(ev(msg), FRAME, ORIGIN);
  assert.deepEqual(got.items, items);
  assert.equal(got.batch, msg.batch);
  assert.equal(E.PARTS_KEY, P.KEY); assert.equal(E.PARTS_V, P.V); assert.equal(E.LABEL_STUDIO_MAX_ITEMS, P.MAX_ITEMS);
  assert.deepEqual({ ...E.LABEL_STUDIO_LIMITS }, { ...P.LIMITS });
  // Studio -> Picker: its readReply takes our replies from its parent on its own origin
  const win = { parent: FRAME, location: { origin: ORIGIN } };
  assert.deepEqual(E.readReply({ data: P.added(5, 1), source: FRAME, origin: ORIGIN }, win), { kind: 'added', count: 5, skipped: 1 });
  assert.deepEqual(E.readReply({ data: P.refused('A reason.'), source: FRAME, origin: ORIGIN }, win), { kind: 'refused', reason: 'A reason.' });
  // its pre-check refuses exactly what ours refuses (so a batch it sends is taken whole)
  const cases = [item(), item({ fields: ['x'.repeat(61)] }), item({ pinned: ['material'] }), item({ fields: Array(7).fill('M5') }),
    item({ id: 3 }), item({ schema: 'x' }), item({ attributes: [{ path: 'head', text: 'y'.repeat(61) }] }), item({ pinned: undefined, optional: ['head'] })];
  for (const c of cases) assert.equal(E.labelStudioProblem(c) === null, P.itemOk(c), JSON.stringify(c).slice(0, 80));
});

test('parts/ is a publish of the Part Picker (SOURCE.json names its commit), opened by the sheet as parts/?embed=1', (t) => {
  const src = new URL('../parts/SOURCE.json', import.meta.url);
  if (!existsSync(src)) { t.skip('parts/ is not published here'); return; }
  const s = JSON.parse(readFileSync(src, 'utf8'));
  assert.match(s.commit, /^[0-9a-f]{40}$/, 'a clean publish of a commit, not of uncommitted work');
  assert.ok(existsSync(new URL('../parts/index.html', import.meta.url)));
  assert.ok(existsSync(new URL('../.nojekyll', import.meta.url)), 'GitHub Pages must not run Jekyll over the pictures');
});

test('the page: one item check for links, files and the sheet; the sheet listens only to its own frame and adds, never replaces', () => {
  assert.match(HTML, /return list\.every\(PPL\.itemOk\) \? list : null;/);
  assert.match(HTML, /PPL\.readAdd\(e, partsFrame\.contentWindow, location\.origin\)/);
  assert.match(HTML, /e\.source\.postMessage\(m\.batch \? \{ \.\.\.msg, batch: m\.batch \} : msg, location\.origin\)/, 'the reply goes to the frame on this origin, with the Picker\'s batch id echoed when it sent one');
  assert.doesNotMatch(HTML, /postMessage\([^)]*['"]\*['"]\)/, 'never posts to "*"');
  const add = HTML.slice(HTML.indexOf('function addPartItems('), HTML.indexOf('function addSavedLabels('));
  assert.ok(add.length > 100);
  assert.doesNotMatch(add, /clearLabelRows\(\)/, 'adding never clears the list');
  assert.match(add, /listUndo = \{ labels: before/);
  // a part row's shown words are derived by its layout (they follow the font and the settings): not part of "the list changed"
  assert.match(HTML, /const sigOf = \(labels\) => JSON\.stringify\(labels\.map\(l => \(l\.hw \? Object\.assign\(\{\}, l, \{ text: '' \}\) : l\)\)\);\nconst listSignature = \(\) => sigOf\(captureLabels\(false\)\);/);
  // a planner-linked tab greys the entries out and says why
  assert.match(HTML, /function partsBlockedReason\(\) \{\n  if \(typeof link !== 'undefined' && link\) return "Part labels can't go into a planner-linked list yet/);
});
