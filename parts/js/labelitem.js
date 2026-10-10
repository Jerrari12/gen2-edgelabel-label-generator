// The printable LABEL ITEM of a part record (2026-10-05, Astra: "Demonstrate one complete pinned-field workflow from
// saved/exported record to generated label"). Pure and read-only: the record is never changed, and nothing it holds is
// lost when a field is left off a label.
//
// Every attribute string carries the FIELD PATH it came from ('head', 'material.finish', ...) - the stable id a pin
// names, never the printed words - so the label engine (MODULITH icons-v1/printtest_v1.fields_value) is told which
// strings MUST print (the pins) and which are optional, and the preview can say "Not shown on label: BLK OX".
// A pinned field with nothing to print is listed in `pinned_unprinted` with the reason, never invented.
//
// The short forms are PROPOSED print forms (MODULITH known-gaps.md: "Print short forms for the picker's attribute lines
// are proposed, not decided"). They reuse the label tests' vocabulary where it has one (SHCS, BHCS, NUT,
// BLK OX, ZINC, A2).
import { threadText, lengthText, isUnified } from './units.js';
import { pinsOf } from './labelpins.js';
import { labelColours } from './labelstyle.js';

export const LABEL_ITEM_SCHEMA = 'part-picker-label-item/1';

// Every form below was measured to fit, with STEEL beside it, at the 4.7 mm attribute minimum on the EdgeLabel face
// (printtest_v1.fields_value, 2026-10-05). The bottom attribute row is about 28 mm wide there: CHEESE HEAD, SPLIT WASHER
// and TOOTH WASHER do not fit even alone, so they are CHEESE HD, SPLIT LW and TOOTH LW.
export const TYPE_SHORT = {
  screw: { 'socket-cap': 'SHCS', button: 'BHCS', countersunk: 'FHCS', hex: 'HEX BOLT', pan: 'PAN HEAD', cheese: 'CHEESE HD' },
  // nylon-insert locknuts are NYLOC and THIN NYLOC (2026-10-06, Astra: "Thin and regular nylon-insert nuts need a visible
  // distinction ... both shouldn't simply say LOCKNUT"). Measured on the engine with STEEL / A2 / SS pinned at M5, M8,
  // #10-32, 1/4-20, 1/2-13 and 5/16-18: THIN LOCKNUT fits NONE of them, THIN NYLOC and NYLOC fit all (MODULITH
  // icons-v1/colour-bank). NYLOC is the picker's own name for the type ('Nyloc, thin' / 'Nyloc, regular').
  // Flange nuts print FLG NUT: FLANGE NUT (38.4 mm at 4.7 mm caps) fits beside no value from 1/4-20 up even alone, FLG
  // NUT (25.0 mm) fits with STEEL at all ten measured sizes. WORDING_STATUS says which of these are trials.
  nut: { hex: 'NUT', thin: 'JAM NUT', 'nylon-thin': 'THIN NYLOC', 'nylon-regular': 'NYLOC', flange: 'FLG NUT',
    style2: 'NUT', 'thin-unchamfered': 'JAM NUT', square: 'SQ NUT', 'square-thin': 'THIN SQ NUT', 'flange-plain': 'FLG NUT',
    cap: 'CAP NUT' },
  washer: { plain: 'WASHER', large: 'LG WASHER', 'extra-large': 'XL WASHER', spring: 'SPLIT LW', 'plain-c': 'WASHER',
    chamfered: 'WASHER', small: 'SM WASHER', 'tooth-internal': 'TOOTH LW' },
  setscrew: { 'hex-socket-set': 'SET SCREW' },
  insert: { 'heat-set': 'INSERT', 'press-in': 'INSERT', 'self-tapping': 'INSERT' },
};
// Every short form is a proposal (decisions.md, "What a hardware label prints"). These carry a stronger note, shown beside
// the printed form in the label words so the wording is never quietly made permanent (Astra 2026-10-06):
//   trial    - approved as a TRIAL abbreviation ("Approve FLG NUT as a trial abbreviation ... Keep 'Flange nut' in the
//              picker and record; show the abbreviation in the label preview")
//   proposed - a proposed change to wording used before (NYLOC / THIN NYLOC replace LOCKNUT, the v5 test labels' word:
//              "Treat it as a proposed short form rather than silently making it the permanent vocabulary")
export const WORDING_STATUS = {
  'nut:flange': { status: 'trial', note: 'trial abbreviation, approved for trial 2026-10-06' },
  'nut:flange-plain': { status: 'trial', note: 'trial abbreviation, approved for trial 2026-10-06' },
  'nut:nylon-thin': { status: 'proposed', note: 'proposed wording - replaces LOCKNUT, not decided' },
  'nut:nylon-regular': { status: 'proposed', note: 'proposed wording - replaces LOCKNUT, not decided' },
};
const BASE_SHORT = { steel: 'STEEL', stainless: 'SS', brass: 'BRASS', copper: 'COPPER', nylon: 'NYLON', aluminium: 'ALU', titanium: 'TI' };
// 'plain' prints nothing: it is the absence of a treatment, and a label reads it as noise
const FINISH_SHORT = { plain: null, zinc: 'ZINC', 'zinc flake': 'ZN FLAKE', 'black oxide': 'BLK OX', 'hot-dip galvanized': 'HDG',
  nickel: 'NICKEL', passivated: 'PASSIVATED', anodized: 'ANODIZED' };
const POINT_SHORT = { flat: 'FLAT PT', cup: 'CUP PT', cone: 'CONE PT', dog: 'DOG PT' };

// READING order: where the attributes read on the label, left to right, top to bottom
export const ATTRIBUTE_ORDER = ['head', 'material.base', 'material.property_class', 'material.finish', 'material.colour',
  'thread.series', 'specific.point_type'];
// KEEP priority, apart from the reading order (Astra 2026-10-05): the optional attributes are offered to the engine in
// this order and it drops from the END - so the grade and the finish outrank the broad base material (STEEL), which a
// grade already implies. Pins always win: a pinned field prints or the label is a non-fit.
export const KEEP_PRIORITY = ['head', 'material.property_class', 'material.finish', 'material.base', 'material.colour',
  'thread.series', 'specific.point_type'];

const known = (f) => f && f.status !== 'unknown' && f.value !== null && f.value !== undefined && f.value !== '';
const get = (rec, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), rec);

// the person's own wording for a field's printed form (record meta `label_words`, {path: text}), if any
export const customWord = (rec, path) => (rec && rec.label_words && typeof rec.label_words[path] === 'string' && rec.label_words[path]) || null;

// the printed string of one field, or null when the field prints nothing (unknown, 'plain', or no short form). Custom
// wording replaces the proposed short form of a recorded value; it never invents a value the record does not hold.
export function attributeText(rec, path) {
  const f = get(rec, path);
  if (!known(f)) return null;
  return customWord(rec, path) || standardText(rec, path);
}

// the proposed short form alone, ignoring any custom wording (the editor shows both)
export function standardText(rec, path) {
  const f = get(rec, path);
  if (!known(f)) return null;
  const v = f.value;
  switch (path) {
    case 'head': return f.status === 'custom' ? String(v).toUpperCase() : (TYPE_SHORT[rec.family] || {})[v] || null;
    case 'material.base': {
      const g = rec.material && rec.material.stainless_group;   // stainless prints its group when it is known: A2, A4
      return v === 'stainless' && known(g) ? String(g.value) : (BASE_SHORT[v] || String(v).toUpperCase());
    }
    case 'material.property_class': return String(v);
    case 'material.finish': return v in FINISH_SHORT ? FINISH_SHORT[v] : String(v).toUpperCase();
    case 'material.colour': return v === 'natural' ? null : String(v).toUpperCase();
    case 'thread.series': return String(v).toUpperCase();
    case 'specific.point_type': return POINT_SHORT[v] || null;
    default: return null;
  }
}

// the value: '5/16-18' + '× 1-1/2"' (a screw: thread and length, each an unbreakable field), or 'M5' alone.
// NEVER a placeholder (2026-10-05, the first labels made from Joey's saved records printed 'M?'): a size that is not
// recorded gives no value at all, an inch thread with no threads per inch prints its designation alone, and an
// unrecorded length is left off - each one listed by valueMissing() so the preview says so.
export function valueFields(rec) {
  const th = rec.thread;
  if (th && !known(th.diameter)) return [];
  let t = threadText(rec);
  if (!t) return [];
  if (th && isUnified(rec) && th.tpi && !known(th.tpi)) t = String(th.diameter.value);   // '1/4', not '1/4-?'
  const out = [t];      // an inch washer reads as its designation: 1/4" or #10 (units.threadText)
  if (rec.length && known(rec.length.value)) out.push(`× ${lengthText(rec, rec.length.value.value)}`);
  return out;
}

// what the value would need and the record does not hold: [{path, why}]
export function valueMissing(rec) {
  const th = rec.thread;
  if (!th) return [];
  const out = [];
  if (!known(th.diameter)) out.push({ path: 'thread.diameter', why: 'size not recorded' });
  else if (isUnified(rec) && th.tpi && !known(th.tpi)) out.push({ path: 'thread.tpi', why: 'threads per inch not recorded' });
  if (rec.length && !known(rec.length.value)) out.push({ path: 'length.value', why: 'length not recorded' });
  return out;
}

// describe(path, value) -> the field's full meaning for the editor and the preview (the picker passes its type labels:
// 'tooth-internal' -> 'Internal tooth lock washer (DIN 6797 J)'); by default the stored value itself.
// style: the collection's label colour scheme (labelstyle.js); with one, the item carries its band and band-accent colours
export function labelItem(rec, { describe = (path, value) => String(value), style = null } = {}) {
  const pins = pinsOf(rec);
  const attrs = [];
  for (const path of [...ATTRIBUTE_ORDER, ...pins.filter((p) => !ATTRIBUTE_ORDER.includes(p))]) {
    const text = attributeText(rec, path);
    // the label prints ALL CAPS, so a custom 'steel' beside STEEL is the same word: compare without case
    if (text && !attrs.some((a) => a.text.toUpperCase() === text.toUpperCase())) {
      const f = get(rec, path);
      const ws = path === 'head' && !customWord(rec, path) ? WORDING_STATUS[`${rec.family}:${f.value}`] : null;
      attrs.push({ path, text, meaning: describe(path, f.value), ...(customWord(rec, path) ? { custom: true, proposed: standardText(rec, path) } : {}),
        ...(ws ? { wording: ws.status, wording_note: ws.note } : {}) });
    }
  }
  const printable = new Set(attrs.map((a) => a.path));
  const rank = (p) => { const i = KEEP_PRIORITY.indexOf(p); return i < 0 ? KEEP_PRIORITY.length : i; };
  return {
    schema: LABEL_ITEM_SCHEMA,
    id: rec.id, family: rec.family, head: rec.head && rec.head.value, units: isUnified(rec) ? 'in' : 'mm',
    fields: valueFields(rec),
    value_missing: valueMissing(rec),   // empty fields + a missing size = not ready to print, never a placeholder
    attributes: attrs,              // [{path, text, meaning, custom?, proposed?}] in READING order - every field that prints
    pinned: attrs.filter((a) => pins.includes(a.path)).map((a) => a.path),
    // the pins in KEEP priority (2026-10-06, Astra: on a non-fit "try prioritizing FLANGE NUT over generic STEEL, with the
    // omission shown for approval. Don't silently remove a pinned field"): the engine may PROPOSE leaving off the last
    // ones, never print without them until the person approves (unpins)
    pinned_by_priority: attrs.filter((a) => pins.includes(a.path)).map((a) => a.path).sort((x, y) => rank(x) - rank(y)),
    // in KEEP priority: the engine drops from the end
    optional: attrs.filter((a) => !pins.includes(a.path)).map((a) => a.path).sort((x, y) => rank(x) - rank(y)),
    // pinned, but nothing prints: not recorded, or a value with no print form (a plain finish)
    pinned_unprinted: pins.filter((p) => !printable.has(p))
      .map((p) => ({ path: p, why: known(get(rec, p)) ? `${get(rec, p).value} prints nothing` : 'not recorded' })),
    pins_explicit: Array.isArray(rec.label_pins),
    // {band, band_accent}: a colour from the collection's scheme (or one set by hand, marked so), {colour: null,
    // unassigned: why}, or null where the scheme has no such slot - never a guessed colour
    ...(style ? { colours: labelColours(rec, style) } : {}),
  };
}
