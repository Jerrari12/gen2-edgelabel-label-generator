// The label icon catalog (label-icons.js, 2026-10-09): what the menu offers, which drawing a badge prints, and the
// guess - a word keeps the icon it predicts today unless it is on the documented corrections list (Sol 01a122f1 reviewed
// the design; the corrections follow ChatGPT's review, relayed by Joey; its second review put both drawings of each near
// twin in the menu, named apart, and asked for the corrections to be tested narrowly).

// Ids in the menu's order, group by group (the core's icons first, each family twin right after its partner).
const MENU_ORDER = [
  'bolt-hex-head', 'screw-hex-socket', 'screw-phillips-head', 'screw-slotted-head', 'screw-torx-head', 'screw-side',
  'nut', 'hex-nut', 'washer', 'flat-washer',
  'screw-driver', 'wrench-a', 'flush-cutter', 'drill-bit', 'nozzle', 'gear',
  'resistor', 'resistor-axial', 'capacitor', 'diode', 'ic-chip', 'battery', 'sd-card', 'lightning', 'wire-connector',
  'scissors', 'sewing-needle', 'paper-clip',
  'star', 'arrow', 'plus', 'storage-box',
];
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
  'Socket caps', 'Allen keys', 'Allen key set', 'Allen', 'Allen screws', 'Stepper drivers', 'Drivers', 'LED drivers',
  'Bolt cutters', 'Star bits', 'Star', 'Power tools', 'Power tool batteries', 'Cell phone chargers', 'Fishing gear',
  'Gear ties', 'Flush mount hinges', 'Cookie cutters', 'Box cutters', 'Bits and pieces', 'Nut drivers', 'Power banks', 'Caps',
];
const coreKeywordForms = EL.KEYWORD_ICONS.flatMap(([keys]) => keys.flatMap((k) => [k, k.toUpperCase(), `M3 ${k}s`]));
const CORPUS = [...new Set([...LABELS, ...coreKeywordForms])];

// Each NEW rule's phrases, both ways (Sol, finding 7): what it must catch and what it must leave alone.
const EXAMPLES = {
  'screw-hex-socket': { yes: ['Cap screws', 'M4 socket head screws'], no: ['Capacitors'] },
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
  assert.deepEqual(LI.icons.filter((i) => !i.core).map((i) => i.id).sort(),
    ['screw-side', 'hex-nut', 'flat-washer', 'wire-connector', 'resistor-axial', 'scissors', 'sewing-needle', 'paper-clip', 'storage-box'].sort());
  assert.deepEqual(ids, MENU_ORDER, 'the menu order: by group, the core first, a twin right after its partner');
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

// Does the label contain one of the documented corrections' phrases (whole words, as the guess matches)?
const corrected = (t) => LI.CORRECTIONS.some(([keys]) => keys.some((k) =>
  new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i').test(t)));

test('a word keeps the icon it predicts today unless it holds a documented correction (over the whole corpus)', () => {
  let kept = 0, gained = 0, fixed = 0;
  for (const t of CORPUS) {
    const old = EL.guessIconId(t);
    const now = LI.guessIconId(t);
    assert.equal(CP.guessIconId(t), old, `the Classic Pro core guesses as EdgeLabel's: "${t}"`);
    if (corrected(t)) { if (now !== old) fixed++; continue; }
    if (old) { assert.equal(now, old, `"${t}": was ${old}, now ${now} (not on the corrections list)`); kept++; }
    else if (now) gained++;
  }
  assert.ok(kept > 100 && gained > 40 && fixed >= 15, `kept ${kept}, gained ${gained}, fixed ${fixed}`);
});

test('the corrections: every phrase changes the core\'s guess to the listed icon (or to none), and the words around them still count', () => {
  for (const [keys, id] of LI.CORRECTIONS) {
    for (const k of keys) {
      assert.equal(LI.guessIconId(k), id, `"${k}" -> ${id}`);
      assert.notEqual(EL.guessIconId(k), id, `"${k}" changes the core's guess (${EL.guessIconId(k)}), so the entry is needed`);
    }
    if (id) assert.ok(LI.find(id) && LI.find(id).predict, `${id} is a guessable icon`);
  }
  const cases = {
    'Socket caps': 'screw-hex-socket', 'M3 socket caps': 'screw-hex-socket', 'Allen keys': 'wrench-a', 'Allen key set': 'wrench-a',
    'Stepper drivers': 'ic-chip', 'Bolt cutters': 'flush-cutter', 'Hex bits': 'screw-hex-socket', 'Star bits': 'screw-torx-head',
    'Bits and pieces': 'storage-box', 'Power banks': 'battery', 'Nut drivers': 'screw-driver',
    'Bottle caps': null, 'Power tools': null, 'Fishing gear': null, 'Gear ties': null, 'Flush mount hinges': null,
    'Cookie cutters': null, 'Cell phones': null,
    // the words around a removed phrase are still read
    'Cell phone chargers': 'lightning', 'Power tool batteries': 'battery', 'Fishing gear hooks': null,
    // the single words the corrections sit in front of keep the core's icon
    'Caps': 'capacitor', 'Ceramic caps': 'capacitor', 'Allen': 'screw-hex-socket', 'Allen bolts': 'screw-hex-socket',
    'Drivers': 'screw-driver', 'Torx bits': 'screw-torx-head', 'Drill bits': 'drill-bit', 'Gears': 'gear', 'Star': 'star',
    'Power': 'lightning', 'Flush cutters': 'flush-cutter', 'Hex nuts': 'nut', 'Bolts': 'bolt-hex-head', 'Cells': 'battery',
  };
  for (const [t, id] of Object.entries(cases)) assert.equal(LI.guessIconId(t), id, `"${t}" -> ${id}`);
});

test('near twins: both drawings in every menu, side by side and named apart; only the first is guessed; twinOf pairs them', () => {
  assert.deepEqual(LI.TWINS, [['nut', 'hex-nut'], ['washer', 'flat-washer'], ['resistor', 'resistor-axial']]);
  const menuIds = LI.menu().map((i) => i.id);
  assert.deepEqual(menuIds, LI.icons.map((i) => i.id), 'every selectable icon is offered');
  // the names: the same part first, then what tells the two drawings apart (ChatGPT's second review: "selectable now, with names")
  assert.deepEqual(LI.TWINS.map(([a, b]) => [LI.find(a).name, LI.find(b).name]),
    [['Hex nut, plain', 'Hex nut, chamfered'], ['Washer, wide ring', 'Washer, thin ring'], ['Resistor, plain', 'Resistor, banded']]);
  for (const [first, other] of LI.TWINS) {
    assert.equal(menuIds.indexOf(other), menuIds.indexOf(first) + 1, `${other} right after ${first}`);
    assert.equal(LI.twinOf(first), other);
    assert.equal(LI.twinOf(other), first);
    assert.notEqual(LI.resolveBadge({ type: 'icon', value: other }, 14).svg, undefined, `${other} prints its own drawing`);
    assert.ok(LI.search('').some((i) => i.id === other) && LI.search(LI.find(other).name).some((i) => i.id === other));
  }
  for (const id of ['star', 'no-such-icon', '', undefined]) assert.equal(LI.twinOf(id), null);
  // the guess keeps the first of each pair (today the core's drawings: no printed label changes)
  for (const t of CORPUS) {
    const g = LI.guessIconId(t);
    if (g) assert.ok(!LI.TWINS.some(([, o]) => o === g), `"${t}" never guesses the second drawing (${g})`);
  }
  for (const [t, id] of [['Hex nuts', 'nut'], ['M5 washers', 'washer'], ['Resistors 10k', 'resistor']]) assert.equal(LI.guessIconId(t), id);
  // every name in a menu is unique, so the caption tells any two icons apart
  const names = LI.menu().map((i) => i.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
});

test('the Label Studio keeps the drawing a row already wears when the guess would only swap it for its twin', () => {
  // autoAssignIcon (index.html): a later change of which twin the guess prefers must not redraw labels a set already holds
  assert.match(HTML, /if \(id && row\.dataset\.badgeType === 'icon' && LabelIcons && LabelIcons\.twinOf\(id\) === row\.dataset\.badgeIcon\) return;/);
  const auto = HTML.slice(HTML.indexOf('function autoAssignIcon(row) {'), HTML.indexOf('function applyPredictToggle()'));
  assert.ok(auto.indexOf('twinOf(id)') > 0 && auto.indexOf('twinOf(id)') < auto.indexOf("applyBadge(row, { type: 'icon', value: id })"),
    'the guard runs before the guess is applied');
});

test('the corrections stay narrow (ChatGPT\'s second review): each phrase works inside a longer label, a removed phrase predicts nothing of its own, the words beside it still count, and single words keep their old guess', () => {
  for (const [keys, id] of LI.CORRECTIONS) {
    for (const k of keys) {
      for (const t of [k, `M3 ${k}`, `${k} box`, k.toUpperCase(), k[0].toUpperCase() + k.slice(1)]) {
        assert.equal(LI.guessIconId(t), id, `"${t}" -> ${id}`);
      }
      if (id === null) assert.equal(LI.guessIconId(`${k} and ${k}`), null, `"${k}" twice is still nothing`);
    }
  }
  // a removed phrase gives way to the next word in the label - each pair chosen so the core alone gives the REMOVED word's icon
  // (its keyword comes first in the core's table), so the test fails if the phrase is not taken out
  const after = {
    'Bottle caps and LEDs': 'diode', 'Power tools favourite': 'star', 'Fishing gear and fuses': 'lightning',
    'Gear ties, fuses': 'lightning', 'Flush mount drills': 'drill-bit', 'Cell phone SD cards': 'sd-card',
    'Cookie cutters, drills': 'drill-bit', 'Lens caps and LEDs': 'diode', 'Safety gear fuses': 'lightning',
  };
  for (const [t, id] of Object.entries(after)) {
    assert.equal(LI.guessIconId(t), id, `"${t}" -> ${id}`);
    assert.notEqual(EL.guessIconId(t), id, `"${t}": the core alone gives ${EL.guessIconId(t)}, so the phrase removal is what is tested`);
  }
  // a correction beats a competing keyword later in the label; with two corrections, the first on the list wins
  const beside = {
    'Allen keys and bolts': 'wrench-a', 'Socket caps and nuts': 'screw-hex-socket', 'Stepper drivers and resistors': 'ic-chip',
    'Hex bits and nuts': 'screw-hex-socket', 'Star bits, drills': 'screw-torx-head', 'Bolt cutters and nuts': 'flush-cutter',
    'Power banks and cell phones': 'battery', 'Bolt cutters and allen keys': 'wrench-a', 'Bits and pieces, bolts': 'storage-box',
  };
  for (const [t, id] of Object.entries(beside)) assert.equal(LI.guessIconId(t), id, `"${t}" -> ${id}`);
  // single words: those the core guesses keep exactly that guess; those it does not still get nothing
  const guessed = ['caps', 'Caps', 'CAPS', 'allen', 'Allen', 'driver', 'Drivers', 'gear', 'Gears', 'bits', 'Bits', 'cutter', 'Cutters',
    'power', 'Power', 'cell', 'Cells', 'flush', 'bolt', 'star', 'nut', 'wrench'];
  for (const t of guessed) {
    const core = EL.guessIconId(t);
    assert.ok(core, `"${t}": the core guesses it`);
    assert.equal(LI.guessIconId(t), core, `"${t}" keeps the core's ${core}`);
  }
  const nothing = ['cap', 'socket', 'sockets', 'bit', 'phone', 'phones', 'tool', 'tools', 'mount', 'mounts', 'bank', 'banks', 'stepper',
    'motor', 'board', 'bottle', 'cookie', 'pizza', 'impact', 'pieces', 'bobs', 'tie', 'ties', 'camping', 'fishing', 'hiking', 'rain',
    'safety', 'pen', 'lens', 'end', 'key', 'keys', 'hex', 'climbing', 'bottles', 'phone case'];
  for (const t of nothing) assert.equal(LI.guessIconId(t), null, `"${t}" -> nothing`);
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
  assert.equal(LI.search('').length, LI.menu().length);
  const ids = (q) => LI.search(q).map((i) => i.id);
  assert.deepEqual(ids('nut').filter((id) => id === 'nut' || id === 'hex-nut'), ['nut', 'hex-nut'], 'both nuts, side by side');
  assert.deepEqual(ids('chamfered'), ['hex-nut']);
  assert.deepEqual(ids('banded'), ['resistor-axial']);
  LI.search('').length = 0;   // a caller cannot empty the catalog through what search returns
  LI.menu().length = 0;
  assert.equal(LI.menu().length, LI.icons.length);
  assert.ok(ids('allen').includes('screw-hex-socket'), 'by a predicting word');
  assert.ok(ids('allen').includes('wrench-a'), '"allen" finds the hex keys too');
  assert.ok(ids('electronics').includes('capacitor'), 'by group name');
  assert.ok(ids('paper clip').includes('paper-clip'));
  assert.deepEqual(ids('zzzz'), []);
});

test('the page builds every label through LabelIcons.resolveBadge, guesses with LabelIcons and offers its icons to planner jobs', () => {
  assert.match(HTML, /<script src="label-icon-art\.js(\?v=[0-9a-f]{8})?"><\/script>\r?\n<script src="label-icons\.js(\?v=[0-9a-f]{8})?"><\/script>/);
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
