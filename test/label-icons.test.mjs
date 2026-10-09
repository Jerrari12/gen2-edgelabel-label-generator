// The label icon catalog (label-icons.js, 2026-10-09): what the menu offers, which drawing a badge prints, and the
// rule agreed with Joey - a word that predicts an icon today keeps that same icon (Sol 01a122f1 reviewed the design).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
require('../label-core.js');
require('../label-core-classicpro.js');
require('../label-icon-art.js');
require('../label-icons.js');
const EL = globalThis.GEN2EdgeLabelCore.create({ THREE: {} });
const CP = globalThis.GEN2ClassicProCore.create({ THREE: {} });
const ART = globalThis.GEN2LabelIconArt;
const LI = globalThis.GEN2LabelIcons.create({ core: EL, art: ART });
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ICON_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;   // label-list.js: the shared format's icon id shape (max 40)

// Real drawer labels, of the kinds the planner and the generator see, plus every core keyword in three forms.
const LABELS = [
  'M3 SCREWS', 'Torx Bits', 'Washers', 'Spare nozzles', 'Coffee filters', 'Resistors 10k', 'AA batteries',
  'Drill bits HSS 1-6 mm', 'SD cards', 'Zip ties', 'Heat-set inserts M3 x 5.7', 'Gears', 'Flush cutters', 'Fuses',
  'A very long label that will need wrapping across lines', 'x', '12', 'Ø 8 mm bearings', 'Glue sticks', 'Misc',
  'M3 x 8 SHCS', 'M4 x 12 socket head cap screws', 'M5 hex nuts', 'M3 nyloc', 'M3 nylock', 'M4 lock nuts', 'M5 washers',
  'Phillips screws', 'Slotted screws', 'Wood screws', 'Drywall screws', 'Self-tapping screws', 'Machine screws', 'Bolts',
  'Carriage bolts', 'Hex bolts M8', 'Cap screws', 'Allen bolts', 'Allen keys', 'Hex keys', 'Allen wrench set', 'Spanners',
  'Wrenches', 'Screwdrivers', 'Precision screwdrivers', 'Bit drivers', 'Pliers', 'Needle nose pliers', 'Wire cutters',
  'Side cutters', 'Snips', 'Nippers', 'Step drills', 'Countersink bits', 'Nozzles 0.4', 'Hotends', 'Hot ends', 'Heatbreaks',
  'Heat break', 'Thermistors', 'Heater cartridges', 'PTFE tube', 'Bowden couplers', 'Filament scraps', 'Build plates',
  'Resistors', 'Capacitors', 'Ceramic caps', 'Electrolytic caps', 'Diodes', 'LEDs', 'LED strips', 'Transistors', 'MOSFETs',
  'Microcontrollers', 'Arduino Nano', 'ESP32 boards', 'Raspberry Pi', 'ICs', 'Chips', 'Batteries', 'Coin cells',
  'CR2032', '18650 cells', 'LiPo', '9V batteries', 'AAA batteries', 'SD cards', 'Micro SD cards', 'Memory cards',
  'USB cables', 'Cables', 'Power supply', 'Chargers', 'Extension cords', 'Power', 'Fuses 5A', 'Wire connectors',
  'JST connectors', 'Dupont connectors', 'JST XH', 'Crimp connectors', 'Terminal blocks', 'Header pins', 'Jumper wires',
  'Heat shrink', 'Solder', 'Flux', 'Scissors', 'Sewing needles', 'Needles', 'Embroidery needles', 'Thread', 'Buttons',
  'Pins', 'Safety pins', 'Paper clips', 'Paperclips', 'Binder clips', 'Rubber bands', 'Staples', 'Push pins', 'Pens',
  'Pencils', 'Markers', 'Sticky notes', 'Tape', 'Glue', 'Storage', 'Spares', 'Spare parts', 'Odds and ends',
  'Miscellaneous', 'Junction box', 'Box cutters', 'Printer clips', 'Clips', 'Bulldog clips', 'Cable ties', 'Velcro',
  'Magnets', 'Bearings', 'Springs', 'O-rings', 'Gaskets', 'Shims', 'Spacers', 'Standoffs', 'Rivets', 'T-nuts',
  'Heat set inserts', 'Threaded inserts', 'Dowel pins', 'Cotter pins', 'Hinges', 'Hooks', 'Nails', 'Tacks', 'Anchors',
  'Favorites', 'Favourites', 'Important', 'Star parts', 'Fishing hooks', 'Sandpaper', 'Brushes', 'Batteries AA', 'Tweezers',
  'Calipers', 'Hex bits', 'Torx', 'Phillips bits', 'Drill', 'Cogs', 'Pulleys', 'Belts', 'Gears GT2', 'SD', 'TF cards',
  'Microsd', 'Volts', 'Amps', 'Electrical tape', 'Bottle caps', 'Ink cartridges', 'Coffee', 'Tea', 'Spices', 'Keys',
];
const coreKeywordForms = EL.KEYWORD_ICONS.flatMap(([keys]) => keys.flatMap((k) => [k, k.toUpperCase(), `M3 ${k}s`]));
const CORPUS = [...new Set([...LABELS, ...coreKeywordForms])];

// Each NEW rule's phrases, both ways (Sol, finding 7): what it must catch and what it must leave alone.
const EXAMPLES = {
  'screw-hex-socket': { yes: ['Cap screws', 'M4 socket cap screws', 'Socket cap M3'], no: ['Capacitors', 'Socket caps'] },
  'nut': { yes: ['M3 nylock', 'Lock nuts', 'Nylon insert nuts M4'], no: ['Lockers'] },
  'wrench-a': { yes: ['Hex keys', 'Hex keys metric'], no: ['Keys'] },
  'screw-driver': { yes: ['Screwdrivers', 'Precision screw drivers', 'Bit drivers'], no: ['Screws'] },
  'flush-cutter': { yes: ['Pliers', 'Needle nose pliers', 'Nippers'], no: ['Tweezers'] },
  'drill-bit': { yes: ['Step drills', 'Countersink bits'], no: ['Countersunk screws'] },
  'nozzle': { yes: ['Hotends', 'Hot ends', 'Heatbreaks'], no: ['Heaters'] },
  'ic-chip': { yes: ['Microcontrollers', 'ESP32 boards', 'Arduino Nano', 'ICs', 'MOSFETs', 'Raspberry Pi'], no: ['Electronics', 'Music'] },
  'battery': { yes: ['Coin cell', 'CR2032', '9V'], no: ['9 volts'] },
  'sd-card': { yes: ['Memory cards', 'TF cards'], no: ['Cards'] },
  'lightning': { yes: ['USB cables', 'Power supplies', 'Chargers', 'Extension cords', 'PSU'], no: ['Cable ties', 'Charge'] },
  'star': { yes: ['Favorites', 'Favourites'], no: ['Flavors'] },
  'wire-connector': { yes: ['JST connectors', 'Dupont', 'Wire connectors', 'Crimp connectors', 'JST XH'], no: ['Connectors', 'Pipe connectors'] },
  'scissors': { yes: ['Scissors'], no: ['Shears'] },
  'sewing-needle': { yes: ['Sewing needles', 'Embroidery needles', 'Hand needles'], no: ['Needles', 'Needle nose pliers', 'Needle bearings'] },
  'paper-clip': { yes: ['Paper clips', 'Paperclips', 'Binder clips'], no: ['Clips', 'Printer clips', 'Bulldog clips'] },
  'storage-box': { yes: ['Misc', 'Miscellaneous', 'Spare parts', 'Odds and ends', 'Storage'], no: ['Junction box', 'Boxes', 'Box cutters'] },
};

test('the catalog: the 23 core icons first by group, then the MODULITH family; ids unique and in the label-list id format', () => {
  const ids = LI.icons.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(ICON_ID_RE.test(id) && id.length <= 40, id);
  for (const it of EL.ICON_LIBRARY) assert.ok(LI.find(it.id) && LI.find(it.id).core, `core icon ${it.id} in the catalog`);
  assert.equal(LI.icons.filter((i) => i.core).length, 23);
  assert.deepEqual(LI.icons.filter((i) => !i.core).map((i) => i.id),
    ['screw-side', 'hex-nut', 'flat-washer', 'wire-connector', 'resistor-axial', 'scissors', 'sewing-needle', 'paper-clip', 'storage-box']
      .sort((a, b) => LI.GROUPS.findIndex((g) => g.id === LI.find(a).group) - LI.GROUPS.findIndex((g) => g.id === LI.find(b).group)));
  for (const ic of LI.icons) assert.ok(LI.GROUPS.some((g) => g.id === ic.group), `${ic.id} in a known group`);
  for (const id of Object.keys(globalThis.GEN2LabelIcons.LEGACY)) assert.ok(EL.ICON_LIBRARY.some((i) => i.id === id), `LEGACY ${id} is a core icon`);
  // menu order follows GROUPS
  const order = LI.icons.map((i) => LI.GROUPS.findIndex((g) => g.id === i.group));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test('the coffee filter is in no menu, never guessed and resolves to nothing (text-only until a blind test)', () => {
  assert.ok(ART.icons.some((i) => i.id === 'coffee-filter'), 'the art still carries it, staged');
  assert.equal(LI.find('coffee-filter'), null);
  assert.ok(!LI.icons.some((i) => i.id === 'coffee-filter'));
  for (const t of ['Coffee filters', 'Coffee filter', 'coffee']) assert.notEqual(LI.guessIconId(t), 'coffee-filter');
  const b = { type: 'icon', value: 'coffee-filter' };
  assert.equal(LI.resolveBadge(b, 14), b);
  assert.equal(LI.svgFor('coffee-filter', 14), null);
});

test('resolveBadge: an upload wins; a core icon is left as it is; a family icon gets its drawing; unknown ids and non-icons pass through', () => {
  const up = { type: 'icon', value: 'hex-nut', svg: '<svg/>' };
  assert.equal(LI.resolveBadge(up, 14), up);
  const coreB = { type: 'icon', value: 'nut' };
  assert.equal(LI.resolveBadge(coreB, 14), coreB, 'core icons take the unchanged path: no svg added');
  const fam = { type: 'icon', value: 'hex-nut' };
  const r = LI.resolveBadge(fam, 14);
  assert.notEqual(r, fam, 'a new object');
  assert.deepEqual(fam, { type: 'icon', value: 'hex-nut' }, 'the argument is not mutated');
  assert.equal(r.svg, LI.find('hex-nut').svg);
  assert.equal(r.value, 'hex-nut');
  const unk = { type: 'icon', value: 'no-such-icon' };
  assert.equal(LI.resolveBadge(unk, 14), unk);
  for (const b of [null, undefined, { type: 'none' }, { type: 'char', value: 'A' }, { type: 'icon' }]) assert.equal(LI.resolveBadge(b, 14), b);
});

test('svgFor: the standard drawing from its threshold up, the compact one below it (one rule, on the stored Badge size)', () => {
  for (const a of ART.icons.filter((i) => i.selectable)) {
    const ic = LI.find(a.id);
    assert.equal(LI.svgFor(a.id, a.std.from), ic.svg, `${a.id} at exactly ${a.std.from} mm`);
    assert.equal(LI.svgFor(a.id, a.std.from + 0.5), ic.svg);
    assert.equal(LI.svgFor(a.id, a.std.from - 0.01), ic.svgCompact, `${a.id} just below`);
    assert.equal(LI.svgFor(a.id, 4), ic.svgCompact);
    assert.equal(LI.svgFor(a.id, '14'), ic.svg, 'a string setting value reads as its number');
  }
  for (const it of EL.ICON_LIBRARY) for (const mm of [4, 9, 14, 22]) assert.equal(LI.svgFor(it.id, mm), it.svg, 'a core icon has one drawing');
  // the default Badge size (14 mm) prints every family icon's standard drawing
  for (const a of ART.icons.filter((i) => i.selectable)) assert.ok(a.std.from <= 14, `${a.id} std from ${a.std.from}`);
});

test('a word that predicts an icon today keeps that same icon (the core\'s guess first, over the whole corpus)', () => {
  let kept = 0, gained = 0;
  for (const t of CORPUS) {
    const old = EL.guessIconId(t);
    const now = LI.guessIconId(t);
    if (old) { assert.equal(now, old, `"${t}": was ${old}, now ${now}`); kept++; }
    else if (now) gained++;
    assert.equal(CP.guessIconId(t), old, `the Classic Pro core guesses as EdgeLabel's: "${t}"`);
  }
  assert.ok(kept > 100 && gained > 40, `kept ${kept}, gained ${gained}`);
});

test('every new rule: its examples match it, its counter-examples do not; it never guesses an icon that is not to be guessed', () => {
  for (const [id, { yes, no }] of Object.entries(EXAMPLES)) {
    for (const t of yes) assert.equal(LI.guessIconId(t), id, `"${t}" -> ${id}`);
    for (const t of no) assert.notEqual(LI.guessIconId(t), id, `"${t}" must not -> ${id}`);
  }
  // every new phrase reaches its own icon (none is dead behind a core rule or an earlier new rule)
  for (const [keys, id] of LI.RULES) for (const k of keys) assert.equal(LI.guessIconId(k), id, `the phrase "${k}" reaches ${id}`);
  // every new rule's icon has examples, and points at a guessable catalog icon
  for (const [, id] of LI.RULES) {
    assert.ok(EXAMPLES[id], `examples for ${id}`);
    const ic = LI.find(id);
    assert.ok(ic && ic.predict, `${id} is a guessable icon`);
  }
  for (const t of CORPUS) {
    const g = LI.guessIconId(t);
    if (g) assert.notEqual(g, 'screw-side', `"${t}"`);   // Joey: the generic screw is never put on a label by itself
  }
  assert.equal(LI.guessIconId('screws'), null, 'a plain "screw" still maps to nothing');
});

test('search finds icons by name, group and the words that predict them', () => {
  assert.equal(LI.search('').length, LI.icons.length);
  const ids = (q) => LI.search(q).map((i) => i.id);
  assert.ok(ids('nut').includes('nut') && ids('nut').includes('hex-nut'));
  assert.ok(ids('allen').includes('screw-hex-socket'), 'by a predicting word');
  assert.ok(ids('electronics').includes('capacitor'), 'by group name');
  assert.ok(ids('paper clip').includes('paper-clip'));
  assert.deepEqual(ids('zzzz'), []);
});

test('the page builds every label through LabelIcons.resolveBadge, guesses with LabelIcons and offers its icons to planner jobs', () => {
  assert.match(HTML, /<script src="label-icon-art.js"><\/script>\n<script src="label-icons.js"><\/script>/);
  assert.match(HTML, /prepareLabel\(text, LabelIcons \? LabelIcons\.resolveBadge\(badge, getBadgeSize\(\)\) : badge, capsOn\(\)\)/);
  assert.equal((HTML.match(/prepareLabel\(/g) || []).length, 1, 'one label build path in the page');
  assert.match(HTML, /const guessIconId = \(text\) => \(LabelIcons \? LabelIcons\.guessIconId\(text\) : null\);/);
  assert.match(HTML, /const iconIds = \(\) => \(LabelIcons \? LabelIcons\.icons\.map\(i => i\.id\) : \[\]\);/);
  assert.doesNotMatch(HTML, /ICON_LIBRARY/, 'the page reads icons only through the catalog');
});

test('the art is the icon family\'s drawings, re-encoded losslessly (when the vault is here)', (t) => {
  const SVG = 'D:/MODULITH/handoffs/hardware-library/icons-v1/svg/';
  if (!existsSync(SVG)) { t.skip('no icon family checkout'); return; }
  const nums = (s) => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const pathOf = (svg) => svg.match(/ d="([^"]+)"/)[1];
  for (const a of ART.icons) {
    for (const [k, size] of [['std', 24], ['compact', 16]]) {
      const src = readFileSync(`${SVG}${a.family}-${size}.svg`, 'utf8');
      assert.deepEqual(nums(pathOf(a[k].svg)), nums(pathOf(src)), `${a.id} ${k}`);
      assert.equal(pathOf(a[k].svg).replace(/[^MLZ]/g, ''), pathOf(src).replace(/[^MLZ]/g, ''));
    }
  }
});
