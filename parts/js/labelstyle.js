// A COLLECTION'S label colour scheme (2026-10-06, design review: "Color should come from a collection's styling rules, not become
// another manually maintained part specification. The part already knows its thread system, material, and finish. The
// generator should map those fields to colors ... Save that mapping with the collection so reopening or importing it
// doesn't change its meaning. Allow an intentional manual override. Unknown values should remain visibly unassigned
// rather than acquire a guessed color.")
//
// At most two characteristics (design review: "initially I'd encode only two characteristics"): a broad BAND for the primary
// one and, optionally, a small BAND ACCENT - a patch at the start of the band - for the secondary one. The band accent is
// part of the printed label; it is NOT the faceplate's removable accent panel (design review: "Keep those names distinct").
// The schemes below are PROPOSED presets, not a universal colour standard - a collection chooses its scheme, the scheme
// travels in the saved file (batch.js exportDoc / importDoc `label_style`), and the picker keeps a workshop default.
//
// Pure and read-only: the record is never changed. Material and finish stay separate fields; a RULE may match a
// combination of them ("zinc-plated steel") without merging them in the record.
import { isUnified } from './units.js';

export const LABEL_STYLE_SCHEMA = 'label-style/1';
export const SLOTS = ['band', 'band_accent'];
export const SLOT_NAME = { band: 'band', band_accent: 'band accent' };

const known = (f) => f && f.status !== 'unknown' && f.value !== null && f.value !== undefined && f.value !== '';
const deepFreeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); };

// Colours are named keys; `palette` gives each a nominal sRGB swatch (every one at least 3:1 against the charcoal label
// base #2D2D30 - MODULITH v4 STRIPES-A2.md: Okabe-Ito blue #0072B2 fails on charcoal, sky blue passes). Printed filament
// colours differ from the nominal hex; the person picks real spools.
// red = Okabe-Ito vermillion #D55E00 (3.5:1 on the charcoal; sky blue and vermillion are the colour-blind-safe pair)
const PALETTE = { 'sky-blue': '#56B4E9', red: '#D55E00', white: '#F4F4F2', green: '#009E73', purple: '#CC79A7' };
const MATERIAL_RULES = [
  { when: { base: 'stainless' }, colour: 'white', label: 'Stainless' },
  { when: { base: 'steel', finish: 'zinc' }, colour: 'green', label: 'Zinc-plated steel' },
  { when: { base: 'steel', finish: 'black oxide' }, colour: 'purple', label: 'Black-oxide steel' },
];

// COMBINED: the band shows the thread system - metric blue, inch (SAE) red, both solid (Jerrari 2026-10-07: "blue is metric,
// red is SAE, but I also like the dashed line, we could use that in some other way"; the 2026-10-06 proposal was inch
// yellow dashed) - the band accent the
// material and finish
export const COMBINED_PRESET = deepFreeze({
  schema: LABEL_STYLE_SCHEMA,
  preset: 'thread system + material (2026-10-07)',
  band: {
    characteristic: 'thread system',
    rules: [
      { when: { system: 'metric' }, colour: 'sky-blue', label: 'Metric', pattern: 'solid' },
      { when: { system: 'inch' }, colour: 'red', label: 'Inch (SAE)', pattern: 'solid' },
    ],
  },
  band_accent: { characteristic: 'material and finish', rules: MATERIAL_RULES },
  palette: PALETTE,
});
// MATERIAL ONLY (design review 2026-10-06: compare material-first against system-first "using the same band geometry"): the
// whole band shows the material and finish; there is no band accent
export const MATERIAL_PRESET = deepFreeze({
  schema: LABEL_STYLE_SCHEMA,
  preset: 'material only (proposed, 2026-10-06)',
  band: { characteristic: 'material and finish', rules: MATERIAL_RULES },
  palette: { white: PALETTE.white, green: PALETTE.green, purple: PALETTE.purple },
});
export const PRESETS = Object.freeze({ combined: COMBINED_PRESET, material: MATERIAL_PRESET });

// the facts a rule can match, read from the record: null where the record does not hold them
export function styleFacts(rec) {
  const th = rec && rec.thread;
  const system = th && known(th.diameter) ? (isUnified(rec) ? 'inch' : 'metric') : null;
  const m = rec && rec.material;
  return { system, base: m && known(m.base) ? m.base.value : null, finish: m && known(m.finish) ? m.finish.value : null };
}

function match(rules, facts) {
  // every key a rule names must be KNOWN and equal: a rule never matches on a value the record does not hold
  return (rules || []).find((r) => Object.entries(r.when).every(([k, v]) => facts[k] !== null && facts[k] === v)) || null;
}

const FACT_NAME = { system: 'thread system', base: 'material', finish: 'finish' };
// why no rule of a slot matched: the facts its rules read, not the slot's name, decide the reason
function why(rules, facts) {
  const used = [...new Set(rules.flatMap((r) => Object.keys(r.when)))];
  for (const k of ['system', 'base']) if (used.includes(k) && facts[k] === null) return `${FACT_NAME[k]} not recorded`;
  // a rule that agrees with everything the record holds but needs a fact it does not hold (steel, finish not recorded)
  const near = rules.find((r) => Object.entries(r.when).every(([k, v]) => facts[k] === null || facts[k] === v)
    && Object.keys(r.when).some((k) => facts[k] === null));
  if (near) return `${FACT_NAME[Object.keys(near.when).find((k) => facts[k] === null)]} not recorded`;
  return `no colour in this scheme for ${used.map((k) => facts[k]).filter((v) => v !== null).join(', ')}`;
}

// The colours one record takes under a collection's style: {band, band_accent}, each
//   {colour, hex, label, pattern?, source: 'rule'}
//   {colour, hex, label, source: 'override', rule: <what the legend says, or null>}   - a hand-set colour, visibly so
//   {colour: null, unassigned: why}
//   null - the scheme has no such slot (and the record sets no override for it)
// A per-record override (record meta `label_colours`: {band?, band_accent?}, a colour key of the style's palette) is
// an intentional choice and wins over the rule; an override naming a colour the palette lacks, or a slot the scheme
// does not use, is reported, never used.
export function labelColours(rec, style) {
  if (!style) return { band: null, band_accent: null };
  const facts = styleFacts(rec);
  const out = {};
  for (const slot of SLOTS) {
    const g = style[slot];
    const r = g ? match(g.rules, facts) : null;
    const ov = rec && rec.label_colours && rec.label_colours[slot];
    if (ov) {
      out[slot] = !g ? { colour: null, unassigned: `override "${ov}": this scheme has no ${SLOT_NAME[slot]}` }
        : Object.prototype.hasOwnProperty.call(style.palette, ov)
          ? { colour: ov, hex: style.palette[ov], label: `${ov} (set by hand)`, source: 'override', rule: r ? r.label : null }
          : { colour: null, unassigned: `override "${ov}" is not a colour of this scheme` };
      continue;
    }
    if (!g) { out[slot] = null; continue; }
    out[slot] = r ? { colour: r.colour, hex: style.palette[r.colour], label: r.label, ...(r.pattern ? { pattern: r.pattern } : {}), source: 'rule' }
      : { colour: null, unassigned: why(g.rules, facts) };
  }
  return out;
}

// What would print differently if records coloured under `from` were coloured under `to` (either may be null: no
// colours). The import review shows this BEFORE an import is applied (design review 2026-10-06: keeping the destination scheme
// "can recolor imported labels that already exist physically. Import review should show that consequence before
// applying it"). Compares what prints - swatch and pattern - not colour names. -> [{index, slot, from, to}]
export function colourChanges(records, from, to) {
  const printed = (c) => (c && c.colour ? `${c.hex.toUpperCase()}|${c.pattern || 'solid'}` : 'none');
  const out = [];
  records.forEach((rec, index) => {
    const a = labelColours(rec, from); const b = labelColours(rec, to);
    for (const slot of SLOTS) if (printed(a[slot]) !== printed(b[slot])) out.push({ index, slot, from: a[slot], to: b[slot] });
  });
  return out;
}

// two schemes mean the same thing (key order aside)
export function sameStyle(a, b) {
  const norm = (s) => (s ? JSON.stringify(s, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v)) : null);
  return norm(a) === norm(b);
}

// The legend of a style: one line per rule, in order
export function legendOf(style) {
  if (!style) return [];
  return SLOTS.flatMap((slot) => (style[slot] ? style[slot].rules : []).map((r) => ({
    slot, characteristic: style[slot].characteristic, colour: r.colour, hex: style.palette[r.colour], label: r.label,
    ...(r.pattern ? { pattern: r.pattern } : {}) })));
}

// a style read from a file: the shape is checked, an unusable one is refused (never half-applied). A file is untrusted:
// its swatches end up in SVG fills and legend styles, so each must be a #RRGGBB colour, every rule must name only facts
// a record has (system / base / finish) and a colour the palette holds, and every printed word is a bounded string
const HEX = /^#[0-9a-f]{6}$/i;
const WHEN_KEYS = ['system', 'base', 'finish'];
const word = (t, max = 60) => typeof t === 'string' && t.length > 0 && t.length <= max;
const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
export function cleanStyle(s) {
  if (!plain(s) || s.schema !== LABEL_STYLE_SCHEMA || !plain(s.palette)) return null;
  if (!Object.entries(s.palette).every(([k, v]) => word(k, 24) && typeof v === 'string' && HEX.test(v))) return null;
  if (s.preset !== undefined && !word(s.preset, 80)) return null;
  if (!SLOTS.some((slot) => s[slot] !== undefined)) return null;          // a scheme with nothing to colour
  if (s.accent !== undefined) return null;                                 // the pre-rename key: never silently dropped
  for (const slot of SLOTS) {
    if (s[slot] === undefined) continue;
    const g = s[slot];
    if (!plain(g) || !Array.isArray(g.rules) || (g.characteristic !== undefined && !word(g.characteristic))) return null;
    const ok = g.rules.every((r) => plain(r) && plain(r.when) && Object.keys(r.when).length
      && Object.entries(r.when).every(([k, v]) => WHEN_KEYS.includes(k) && word(v))
      && word(r.colour, 24) && Object.prototype.hasOwnProperty.call(s.palette, r.colour)
      && (r.label === undefined || word(r.label)) && (r.pattern === undefined || ['solid', 'dashed'].includes(r.pattern)));
    if (!ok) return null;
  }
  return s;
}
