// DATA-DRIVEN FAMILIES (2026-10-04, Astra's library expansion brief). One entry per family: its types (heads), fields,
// glyphs, label rule and picture paths. picker.js registers them, ui.js draws them with the generic sections, batch.js
// describes them, glyphs.js draws their symbols, hwimage.js finds their rendered pictures. A family added here needs no
// edit anywhere else.
//
// Every option list is VOCABULARY (what a person picks from a package or a drawer), never an inference; any field takes
// a typed Custom value. Where a standard documents a size range, the hint says so - the list is not a claim that every
// value exists in every material. Sources for the documented ranges: the MODULITH hardware library's render-v2
// research-batch1-2026-10-04.md.

import { STATUS } from './fields.js';

const LENGTHS = [3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 25, 26, 28, 30, 32, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100, 120];
const CONN_CODE = { 'jst-xh': 'XH', 'jst-ph': 'PH', 'jst-sh': 'SH', 'jst-gh': 'GH', 'molex-kk254': 'KK 254', 'molex-microfit': 'Micro-Fit',
  'dupont-2.54': '2.54' };
const n = (x) => (x === null || x === undefined ? '?' : String(+(+x).toFixed(3)));

// field helpers: key -> { path, title, ... }. numeric fields hold numbers; 'thread' uses the picker's thread sizes.
const F = (ns, key, title, opts = {}) => ({ key, path: `specific.${ns}.${key}`, title, ...opts });

export const DATA_FAMILIES = [
  {
    id: 'standoff', label: 'Standoffs & spacers', short: 'Standoffs', ns: 'standoff', glyph: 'standoff-ff', thread: 'pitch',
    headTitle: 'Type',
    heads: [['hex-ff', 'Hex, female-female', 'standoff-ff'], ['hex-mf', 'Hex, male-female', 'standoff-mf'],
      ['hex-mm', 'Hex, male-male', 'standoff-mm'], ['round-ff', 'Round, female-female', 'standoff-round'],
      ['spacer', 'Round spacer, unthreaded', 'spacer']],
    fields: [
      { key: 'thread', path: 'thread.diameter', title: 'Thread (a spacer: the screw it takes)', thread: true },
      F('standoff', 'length', 'Body length', { unit: 'mm', numeric: true, batch: true, options: [3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 60],
        hint: 'the body only - a male stud is extra' }),
      F('standoff', 'af', 'Across flats (hex)', { unit: 'mm', numeric: true, options: [4, 4.5, 5, 5.5, 6, 7, 8, 10],
        hint: 'the same thread comes in more than one AF (Würth M3: 5, 5.5 and 6)' }),
      F('standoff', 'stud', 'Male stud length', { unit: 'mm', numeric: true, options: [5, 6, 8, 10], hint: 'male ends only' }),
    ],
    picture: { d: 'thread.diameter', L: 'specific.standoff.length', prefix: 'M' },
    labelRule: { big: (g) => `${g('thread')} × ${g('length')}`, small: (g, head) => [head, g('af') ? `AF ${g('af')}` : null] },
  },
  {
    id: 'shoulder', label: 'Shoulder screws', short: 'Shoulder screws', ns: 'shoulder', glyph: 'shoulder', thread: 'pitch',
    headTitle: 'Type',
    heads: [['socket-iso7379', 'Hex socket, ISO 7379', 'shoulder']],
    fields: [
      F('shoulder', 'diameter', 'Shoulder diameter', { unit: 'mm', numeric: true, options: [4, 5, 6, 6.5, 8, 10, 12, 13, 16, 20, 25],
        hint: 'ISO 7379: 6.5 / 8 / 10 / 13 / 16 / 20 / 25 (M5 / M6 / M8 / M10 / M12 / M16 / M20); 4, 5, 6 and 12 are makers\' sizes' }),
      { key: 'thread', path: 'thread.diameter', title: 'Thread', thread: true },
      F('shoulder', 'length', 'Shoulder length', { unit: 'mm', numeric: true, batch: true,
        options: [4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 120], hint: 'the shoulder only, under the head' }),
    ],
    picture: { d: 'specific.shoulder.diameter', L: 'specific.shoulder.length', prefix: '⌀' },
    labelRule: { big: (g) => `⌀${g('diameter')} × ${g('length')}`, small: (g) => [g('thread'), 'shoulder'] },
  },
  {
    id: 'pin', label: 'Pins', short: 'Pins', ns: 'pin', glyph: 'pin-dowel', thread: null, headTitle: 'Type',
    heads: [['dowel', 'Dowel / parallel pin', 'pin-dowel'], ['spring-slotted', 'Spring pin, slotted', 'pin-spring'],
      ['spring-coiled', 'Spring pin, coiled', 'pin-coiled'], ['clevis', 'Clevis pin with head', 'pin-clevis'],
      ['split', 'Split (cotter) pin', 'pin-split']],
    fields: [
      F('pin', 'diameter', 'Diameter', { unit: 'mm', numeric: true, options: [0.6, 0.8, 1, 1.2, 1.5, 1.6, 2, 2.5, 3, 3.2, 3.5, 4, 4.5, 5, 6, 6.3, 8, 10, 12],
        hint: 'a split pin is sized by the HOLE it fits' }),
      F('pin', 'length', 'Length', { unit: 'mm', numeric: true, batch: true, options: LENGTHS }),
      F('pin', 'duty', 'Duty (spring pins)', { options: [['heavy', 'heavy (ISO 8752)'], ['light', 'light (ISO 13337)']],
        hint: 'slotted spring pins: heavy and light have different walls', identity: 'duty' }),
    ],
    picture: { d: 'specific.pin.diameter', L: 'specific.pin.length', prefix: '' },
    labelRule: { big: (g) => `${g('diameter')} × ${g('length')}`, small: (g, head) => [head, g('duty')] },
  },
  {
    id: 'ring', label: 'Retaining rings', short: 'Retaining rings', ns: 'ring', glyph: 'ring-external', thread: null, headTitle: 'Type',
    heads: [['external', 'External (shaft), DIN 471', 'ring-external'], ['internal', 'Internal (bore), DIN 472', 'ring-internal'],
      ['e-clip', 'E-clip, DIN 6799', 'eclip']],
    fields: [
      F('ring', 'size', 'Size: shaft, bore or groove', { unit: 'mm', numeric: true, batch: true,
        options: [1.2, 1.5, 1.9, 2.3, 3, 3.2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
        hint: 'DIN 471: the shaft; DIN 472: the bore; DIN 6799: the GROOVE diameter (a 5 mm groove fits 6-8 mm shafts)' }),
    ],
    picture: { d: 'specific.ring.size', L: null, prefix: '⌀' },
    labelRule: { big: (g, head, h) => `${h === 'e-clip' ? 'groove ' : '⌀'}${g('size')}`, small: (g, head) => [head] },
  },
  {
    id: 'springwasher', label: 'Spring & lock washers', short: 'Lock washers', ns: 'springwasher', glyph: 'washer-split', thread: 'nopitch',
    headTitle: 'Type',
    heads: [['split', 'Split (helical), DIN 127 B', 'washer-split'], ['wave', 'Wave (crinkle), DIN 137 B', 'washer-wave'],
      ['conical', 'Conical spring, DIN 6796', 'washer-conical']],
    fields: [{ key: 'thread', path: 'thread.diameter', title: 'Nominal size', thread: true, batch: true }],
    picture: { d: 'thread.diameter', L: null, prefix: 'M' },
    labelRule: { big: (g) => g('thread'), small: (g, head) => [head] },
  },
  {
    id: 'rod', label: 'Threaded rod & couplers', short: 'Threaded rod', ns: 'rod', glyph: 'rod', thread: 'pitch', headTitle: 'Type',
    heads: [['threaded-rod', 'Threaded rod, DIN 976-1', 'rod'], ['coupling-nut', 'Coupling nut, DIN 6334', 'coupling-nut']],
    fields: [
      { key: 'thread', path: 'thread.diameter', title: 'Thread', thread: true, batch: true },
      F('rod', 'length', 'Length', { unit: 'mm', numeric: true, options: [18, 24, 30, 36, 100, 200, 250, 300, 500, 1000],
        hint: 'a rod: its cut length; a DIN 6334 coupling nut: 3 d (18 / 24 / 30 / 36 for M6-M12)' }),
    ],
    picture: { d: 'thread.diameter', L: null, prefix: 'M' },
    labelRule: { big: (g) => g('thread'), small: (g, head) => [head, g('length') ? `${g('length')} mm` : null] },
  },
  {
    id: 'thumb', label: 'Thumb screws', short: 'Thumb screws', ns: 'thumb', glyph: 'thumb-high', thread: 'pitch', headTitle: 'Head',
    heads: [['knurled-high', 'Knurled, high (DIN 464)', 'thumb-high'], ['knurled-low', 'Knurled, low (DIN 653)', 'thumb-low'],
      ['wing', 'Wing (DIN 316)', 'thumb-wing'], ['plastic-knob', 'Plastic knob', 'thumb-knob']],
    fields: [
      { key: 'thread', path: 'thread.diameter', title: 'Thread', thread: true },
      F('thumb', 'length', 'Length', { unit: 'mm', numeric: true, batch: true, options: [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40] }),
      // batch 3 (2026-10-05): DIN 316 has two wing shapes; a form A record never shows a form D picture
      F('thumb', 'wing_form', 'Wing form (DIN 316)', { options: [['D', 'rounded wings (form D)'], ['A', 'rectangular wings (form A)']],
        hint: 'wing screws only', identity: 'form' }),
    ],
    picture: { d: 'thread.diameter', L: 'specific.thumb.length', prefix: 'M' },
    labelRule: { big: (g) => `${g('thread')} × ${g('length')}`, small: (g, head) => [head, g('wing_form')] },
  },
  {
    // batch 2 (2026-10-05): wire-to-board connectors. Series, component and POSITION COUNT are identity - a 4-way
    // picture is never shown for a 5-way record. Mating is not inferred from a series name (Astra: "mating needs
    // evidence"); a manufacturer name alone does not identify a series.
    id: 'connector', label: 'Connectors (wire-to-board)', short: 'Connectors', ns: 'connector', glyph: 'conn-housing', thread: null,
    headTitle: 'Component',
    heads: [['crimp-housing', 'Crimp housing (wire side)', 'conn-housing'], ['header', 'PCB header', 'conn-header'],
      ['crimp-contact', 'Crimp contact', 'conn-contact']],
    fields: [
      F('connector', 'series', 'Series', { options: [['jst-xh', 'JST XH (2.5)'], ['jst-ph', 'JST PH (2.0)'], ['jst-sh', 'JST SH (1.0)'],
        ['jst-gh', 'JST GH (1.25)'], ['molex-kk254', 'Molex KK 254 (2.54)'], ['molex-microfit', 'Molex Micro-Fit 3.0'],
        ['dupont-2.54', '2.54 "Dupont"-style']], identity: 'series',
        hint: 'the series printed on the bag or the part - a maker name alone does not identify a series' }),
      F('connector', 'positions', 'Positions', { numeric: true, batch: true, options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24],
        hint: 'cavities or pins; a dual-row part counts both rows' }),
      F('connector', 'entry', 'Header entry', { options: [['top', 'top entry (vertical)'], ['side', 'side entry (right angle)']], hint: 'headers only' }),
    ],
    picture: { d: 'specific.connector.positions', L: null, prefix: '', exact: true },
    // the large value is the series CODE and the count ("XH 4-way"); the full series name goes in the attributes
    labelRule: { big: (g, head, h, rv) => `${CONN_CODE[rv('series')] || g('series')} ${g('positions')}-way`, small: (g, head) => [g('series'), head, g('entry')] },
  },
];

export const DATA_FAMILY = new Map(DATA_FAMILIES.map((f) => [f.id, f]));

// Screen glyphs for the data families (48 x 48, stroked): side views for long parts, top views for rings and washers.
export const DATA_GLYPHS = {
  'standoff-ff': '<rect x="15" y="6" width="18" height="36" rx="1"/><path d="M21 6V42M27 6V42M22 10h4M22 38h4"/>',
  'standoff-mf': '<rect x="15" y="4" width="18" height="25" rx="1"/><path d="M21 4V29M27 4V29M22 8h4"/><path d="M20 29V44M28 29V44M20 32l8 3M20 37l8 3"/>',
  'standoff-mm': '<path d="M20 4V14M28 4V14M20 7l8 3"/><rect x="15" y="14" width="18" height="20" rx="1"/><path d="M21 14V34M27 14V34"/><path d="M20 34V44M28 34V44M20 37l8 3"/>',
  'standoff-round': '<rect x="15" y="6" width="18" height="36" rx="4"/><path d="M22 10h4M22 38h4"/>',
  'spacer': '<ellipse cx="24" cy="11" rx="10" ry="4"/><ellipse cx="24" cy="11" rx="4" ry="1.6"/><path d="M14 11V37M34 11V37M14 37a10 4 0 0 0 20 0"/>',
  'shoulder': '<rect x="13" y="4" width="22" height="9" rx="2"/><path d="M18 13V33M30 13V33M18 33h12"/><path d="M21 33V44M27 33V44M21 36l6 2M21 40l6 2"/>',
  'pin-dowel': '<path d="M9 18H39L42 21V27L39 30H9L6 27V21Z"/>',
  'pin-spring': '<path d="M9 18H39L42 21V27L39 30H9L6 27V21Z"/><path d="M9 23H39M9 25.5H39"/>',
  'pin-coiled': '<path d="M9 18H39L42 21V27L39 30H9L6 27V21Z"/><path d="M24 24m-3 0a3 3 0 1 0 6 0a5 5 0 1 0-10 0"/>',
  'pin-clevis': '<rect x="6" y="14" width="6" height="20" rx="1"/><path d="M12 19H38L41 22V26L38 29H12"/><circle cx="34" cy="24" r="2"/>',
  'pin-split': '<circle cx="11" cy="24" r="5"/><path d="M16 21H42M16 27H37"/>',
  'ring-external': '<path d="M16.5 37.5A15 15 0 1 1 31.5 37.5"/><path d="M19 30.5A8.5 8.5 0 1 1 29 30.5"/><circle cx="15" cy="40" r="3"/><circle cx="33" cy="40" r="3"/>',
  'ring-internal': '<path d="M16 39A16 16 0 1 1 32 39"/><path d="M16 39l3-6M32 39l-3-6"/><circle cx="19.5" cy="31" r="2.5"/><circle cx="28.5" cy="31" r="2.5"/>',
  'eclip': '<path d="M17.2 38.5A16 16 0 1 1 30.8 38.5L27.8 32.2A9 9 0 1 0 20.2 32.2Z"/><path d="M24 15V18.5M17.1 29.8L19.4 27.9M30.9 29.8L28.6 27.9"/>',
  'washer-split': '<path d="M39.45 19.86A16 16 0 1 0 39.94 25.39L30.76 25.81A7 7 0 1 1 30.97 23.39Z"/>',      // the slanted cut at the side: a gap at the top read as a power symbol
  'washer-wave': '<path d="M6 25c4-6 8-6 12 0s8 6 12 0 8-6 12 0"/><path d="M6 21c4-6 8-6 12 0s8 6 12 0 8-6 12 0"/>',
  'washer-conical': '<path d="M6 30L20 21M42 30L28 21M6 34L20 25M42 34L28 25M6 30v4M42 30v4M20 21v4M28 21v4"/>',
  'rod': '<path d="M4 20H44M4 28H44"/><path d="M8 20l3 8M14 20l3 8M20 20l3 8M26 20l3 8M32 20l3 8M38 20l3 8"/>',
  'coupling-nut': '<rect x="7" y="14" width="34" height="20" rx="1"/><path d="M7 21H41M7 27H41"/>',
  'thumb-high': '<rect x="8" y="4" width="32" height="8" rx="1"/><path d="M12 4v8M16 4v8M20 4v8M24 4v8M28 4v8M32 4v8M36 4v8"/><rect x="17" y="12" width="14" height="6"/><path d="M20 18V44M28 18V44M20 24l8 3M20 29l8 3M20 34l8 3M20 39l8 3"/>',
  'thumb-low': '<rect x="8" y="8" width="32" height="8" rx="1"/><path d="M12 8v8M16 8v8M20 8v8M24 8v8M28 8v8M32 8v8M36 8v8"/><path d="M20 16V44M28 16V44M20 24l8 3M20 29l8 3M20 34l8 3M20 39l8 3"/>',
  'thumb-wing': '<path d="M8 6c4 0 10 4 12 10h8c2-6 8-10 12-10-1 6-6 12-12 12h-8C14 18 9 12 8 6z"/><path d="M20 18V44M28 18V44M20 24l8 3M20 29l8 3M20 34l8 3M20 39l8 3"/>',
  'conn-housing': '<rect x="8" y="14" width="32" height="20" rx="2"/><rect x="12" y="18" width="5" height="5"/><rect x="21.5" y="18" width="5" height="5"/><rect x="31" y="18" width="5" height="5"/><path d="M14 34v8M24 34v8M34 34v8"/>',
  'conn-header': '<path d="M8 18v16h32V18"/><path d="M8 18h3M37 18h3"/><path d="M14 10v28M24 10v28M34 10v28"/><path d="M14 38v4M24 38v4M34 38v4"/>',
  'conn-contact': '<path d="M8 22h14l4-3h10l4 3v4l-4 3H26l-4-3H8z"/><path d="M40 24h4"/>',
  'thumb-knob': '<path d="M10 14c0-6 6-10 14-10s14 4 14 10-6 6-14 6-14 0-14-6z"/><path d="M20 20V44M28 20V44M20 26l8 3M20 31l8 3M20 36l8 3"/>',
};

// The label rule's text for a record (Astra: "large value plus attributes"): { big, small[] }. Pure: it reads the
// record's own values - a thread as M<d>, a number as typed, a vocabulary value by its label - and the type's label.
export function labelText(rec, headLabel) {
  const fam = DATA_FAMILY.get(rec.family);
  if (!fam) return null;
  const byKey = new Map(fam.fields.map((f) => [f.key, f]));
  const raw = (f) => {
    let x = rec;
    for (const k of f.path.split('.')) x = x === null || x === undefined ? undefined : x[k];
    return x && x.status !== STATUS.UNKNOWN && x.value !== null && x.value !== undefined ? x.value : null;
  };
  const text = (f, x) => (f.thread ? `M${n(x)}` : f.numeric ? n(x)
    : ((f.options || []).find((o) => Array.isArray(o) && o[0] === x) || [x, String(x)])[1]);
  const gq = (key) => { const f = byKey.get(key); const x = f ? raw(f) : null; return x === null ? null : text(f, x); };
  const g = (key) => { const t = gq(key); return t === null ? (byKey.get(key) && byKey.get(key).thread ? 'M?' : '?') : t; };
  const h = rec.head && rec.head.status !== STATUS.UNKNOWN ? rec.head.value : null;
  const hl = headLabel || (h ? ((fam.heads.find((x) => x[0] === h) || [h, String(h)])[1]) : null);
  const rv = (key) => { const f = byKey.get(key); return f ? raw(f) : null; };      // a field's raw value, for codes
  return { big: fam.labelRule.big(g, hl, h, rv), small: fam.labelRule.small(gq, hl, h, rv).filter(Boolean) };
}
export const fmtNum = n;
