/* STRIPES ON ANY LABEL (2026-10-10; the owner: "we need to get the labels to match the studio with the part pickers color
   stripes, also if we can manually select or add those stripes in the studio to any custom label that would be helpful").
   A classic script with no imports and no DOM, so node tests run it as the page does.

   A label's stripe is stored ON THE LABEL as `colours`, the same shape a Part Picker item's colours use:
       colours: { band: { colour: 'sky-blue', hex: '#56B4E9', label: 'Metric', pattern: 'solid' } }
   (label-list.js keeps unknown label keys verbatim, so saved sets, the autosave, set files and the planner's label list carry
   it with no change anywhere else). On a PART label it overrides the Part Picker's colours; `colours: null` there means
   "no stripe" (the part's own colours are not printed). Absent = an ordinary label has no stripe, a part label keeps the
   Part Picker's colours.

   The stripe itself is label-hardware.js's band: bandParts(position, colours) cuts the EdgeLabel body into base / band /
   accent pieces for ANY label (the accent piece takes the band's colour when there is no band_accent).

   WHERE AN ORDINARY LABEL'S STRIPE GOES. label-core.js lays words and an icon in the face less a 1.8 mm margin (x from
   -26.7, y from -11.7 to 11.7, the right edge the diagonal less 1.8 mm across); a part label's layout instead leaves the band
   and a 0.8 mm gap free. Measured with the label core's own geometry against each stripe's top face (test/label-stripes.test.mjs
   re-measures it; 580 labels, long and wrapped words, letters and icons up to 22 mm, bold, caps 2 to 6.5 mm):
     end    (x -28.5 .. -27.15)  ink never closer than 0.45 mm - text and icon are left-justified at x -26.7, by
                                 construction, even when the words overflow
     bottom (top face up to y -11.15, above the core's -11.7 floor)  ink lands ON the stripe (2 of 521 labels that fit)
     wedge  (along the diagonal: the 1.8 mm margin is measured across, about 1.3 mm square to the edge, less than the 1.35 mm
            stripe)  ink lands ON the stripe (5 of 521 labels that fit; every overflowing one)
   So an ordinary label always takes the END stripe (ORDINARY_POSITIONS); bottom and wedge stay for part labels, whose layout
   keeps the words clear of the band.

   GEN2LabelStripes.COLOURS                 the stripe colours offered: [{ colour, hex, label, name }] (name = the menu word)
   GEN2LabelStripes.stripe(key)              -> { band: {...} } for a colour key, or null
   GEN2LabelStripes.clean(c, { allowNone })  -> cleaned colours | null (allowNone and c === null: "no stripe") | undefined
   GEN2LabelStripes.positionFor(kind, setting) -> the position a label's stripe takes ('part' | 'ordinary'), null = none
   GEN2LabelStripes.partItem(item, override) -> the part item with the label's own stripe in place of its colours
   GEN2LabelStripes.nameOf(colours)          -> words for the stripe ('Metric', 'SAE / inch', 'Green' ...), '' for none
   GEN2LabelStripes.signature(colours)       -> a string that changes when the stripe does (layout caches) */
(function (root) {
'use strict';

// The Part Picker's palette (its js/labelstyle.js: sky-blue / red are the colour-blind-safe pair, every colour at least 3:1 on
// the charcoal label base) plus the yellow the export already orders (index.html BAND_ORDER). The stored label is the Part
// Picker's word where it has one, so a typed label's stripe and a part label's band share one line in the filament list.
const COLOURS = Object.freeze([
  Object.freeze({ colour: 'sky-blue', hex: '#56B4E9', label: 'Metric', name: 'Metric' }),
  Object.freeze({ colour: 'red', hex: '#D55E00', label: 'Inch (SAE)', name: 'SAE / inch' }),
  Object.freeze({ colour: 'yellow', hex: '#F0E442', label: 'Yellow', name: 'Yellow' }),
  Object.freeze({ colour: 'white', hex: '#F4F4F2', label: 'White', name: 'White' }),
  Object.freeze({ colour: 'green', hex: '#009E73', label: 'Green', name: 'Green' }),
  Object.freeze({ colour: 'purple', hex: '#CC79A7', label: 'Purple', name: 'Purple' }),
]);
const PART_POSITIONS = Object.freeze(['bottom', 'end', 'wedge']);
const ORDINARY_POSITIONS = Object.freeze(['end']);

function stripe(key) {
  const c = COLOURS.find(x => x.colour === key);
  return c ? { band: { colour: c.colour, hex: c.hex, label: c.label, pattern: 'solid' } } : null;
}

// one colour slot, by label-hardware.js colour()'s rules (it can come from a file or a link)
function slot(c) {
  if (!c || typeof c !== 'object' || typeof c.colour !== 'string' || !/^[a-z0-9-]{1,30}$/i.test(c.colour) ||
      typeof c.hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(c.hex)) return null;
  return { colour: c.colour, hex: c.hex, label: typeof c.label === 'string' ? c.label.slice(0, 40) : c.colour,
           pattern: c.pattern === 'dashed' ? 'dashed' : 'solid' };
}
function clean(c, opts) {
  if (c === null) return opts && opts.allowNone ? null : undefined;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return undefined;
  const band = slot(c.band);
  if (!band) return undefined;          // a stripe needs its colour
  const out = { band };
  const a = slot(c.band_accent);
  if (a) out.band_accent = a;
  return out;
}

function positionFor(kind, setting) {
  if (!PART_POSITIONS.includes(setting)) return null;           // 'off' (or unknown): no stripes
  if (kind === 'part') return setting;
  return ORDINARY_POSITIONS.includes(setting) ? setting : ORDINARY_POSITIONS[0];
}

function partItem(item, override) {
  if (override === undefined || !item || typeof item !== 'object') return item;
  const out = Object.assign({}, item);
  if (override === null) delete out.colours; else out.colours = override;
  return out;
}

function nameOf(cs) {
  const b = cs && cs.band;
  if (!b) return '';
  const known = COLOURS.find(x => x.colour === b.colour && x.hex.toLowerCase() === String(b.hex).toLowerCase());
  return known ? known.name : (b.label || b.colour);
}

function signature(cs) {
  if (cs === undefined) return '';
  if (cs === null) return 'none';
  const s = (c) => (c ? [c.colour, c.hex, c.label, c.pattern].join(',') : '-');
  return s(cs.band) + '/' + s(cs.band_accent);
}

root.GEN2LabelStripes = { version: 1, COLOURS, PART_POSITIONS, ORDINARY_POSITIONS, stripe, clean, positionFor, partItem, nameOf, signature };
})(typeof globalThis !== 'undefined' ? globalThis : this);
