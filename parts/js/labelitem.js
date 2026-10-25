// The printable LABEL ITEM of a part record (2026-10-05, design review: "Demonstrate one complete pinned-field workflow from
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
import { DATA_FAMILY, labelText, fmtNum } from './families-data.js';

export const LABEL_ITEM_SCHEMA = 'part-picker-label-item/1';

// Every form below was measured to fit, with STEEL beside it, at the 4.7 mm attribute minimum on the EdgeLabel face
// (printtest_v1.fields_value, 2026-10-05). The bottom attribute row is about 28 mm wide there: CHEESE HEAD, SPLIT WASHER
// and TOOTH WASHER do not fit even alone, so they are CHEESE HD, SPLIT LW and TOOTH LW.
export const TYPE_SHORT = {
  screw: { 'socket-cap': 'SHCS', button: 'BHCS', countersunk: 'FHCS', hex: 'HEX BOLT', pan: 'PAN HEAD', cheese: 'CHEESE HD' },
  // nylon-insert locknuts are NYLOC and THIN NYLOC (2026-10-06, design review: "Thin and regular nylon-insert nuts need a visible
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
  // Extrusion T-nuts (2026-10-24, Joey: an M4 drop-in T-nut's label read only "M4" - the family had no type word). The
  // insertion type prints as ONE word so the slot width (below) prints beside it: measured with the Label Studio's own
  // layout engine (hardware-layout.js, the EdgeLabel face) pinned beside STEEL at M3-M8, HAMMER T-NUT, DROP-IN T-NUT,
  // ROLL-IN T-NUT, SLIDING T-NUT, 2-HOLE T-NUT and HAMMER NUT fit at none of them; DROP-IN NUT, ROLL-IN NUT and SLIDING NUT
  // fit but shrink the value to 6.1-7.2 mm caps and push the slot off the label; DROP-IN, ROLL-IN, SLIDING and T-PLATE fit
  // WITH the slot at 8.9-9.9 mm caps (Terra 01a1703c preferred these: the slot is the interface distinction). T-PLATE is
  // the picker's own name for the two-hole type. The editor shows each word's full meaning ('Drop-in, hammer head').
  tnut: { 'drop-in-hammer': 'DROP-IN', 'roll-in': 'ROLL-IN', 'sliding-t': 'SLIDING', 'two-hole': 'T-PLATE' },
  // The ten families that had NO type word at all (2026-10-24, found while fixing the T-nut: a spring washer labelled
  // "M5 · STEEL" like a nut, a rod like a washer). Each word was measured with the Label Studio's engine pinned beside STEEL
  // (the rivet alone - it records no base material) at three or four typical values; the forms NOT taken did not fit:
  // F-F / M-F / M-M / HEX / RND STANDOFF, SHOULDER SCR / BOLT, SLOTTED PIN, COTTER PIN, RET RING EXT / INT, WAVE WASHER,
  // THREADED ROD, COUPLING NUT, THUMB / WING / KNOB SCREW, CRIMP HOUSING, PCB HEADER, CRIMP CONTACT, STRAIGHT M,
  // MALE STRAIGHT / ELBOW, FLANGE RIVET, LG FLG RIVET. So a standoff's gender (F-F, M-F, M-M) and its hex / round shape stay in
  // the record and the editor's meaning, not on the label: none of the seven forms tried that carry them fit. A thumb screw's
  // knurl height is a CHOICE: KNURLED HI (7.6 mm value caps) and KNURLED LO (6.3) fit, but drop the word screw and shrink the
  // value; THUMB SCR (8.1) prints for both heights (Sol 01a1705d caught the first comment saying they did not fit).
  standoff: { 'hex-ff': 'STANDOFF', 'hex-mf': 'STANDOFF', 'hex-mm': 'STANDOFF', 'round-ff': 'STANDOFF', spacer: 'SPACER' },
  shoulder: { 'socket-iso7379': 'SHOULDER' },
  pin: { dowel: 'DOWEL PIN', 'spring-slotted': 'SPRING PIN', 'spring-coiled': 'COILED PIN', clevis: 'CLEVIS PIN', split: 'SPLIT PIN' },
  ring: { external: 'EXT RING', internal: 'INT RING', 'e-clip': 'E-CLIP' },
  springwasher: { split: 'SPLIT LW', wave: 'WAVE LW', conical: 'CONICAL LW' },
  rod: { 'threaded-rod': 'THRD ROD', 'coupling-nut': 'CPLG NUT' },
  thumb: { 'knurled-high': 'THUMB SCR', 'knurled-low': 'THUMB SCR', wing: 'WING SCR', 'plastic-knob': 'KNOB SCR' },
  connector: { 'crimp-housing': 'HOUSING', header: 'HEADER', 'crimp-contact': 'CONTACT' },
  fitting: { 'straight-male': 'STR MALE', 'straight-union': 'UNION', 'reducing-union': 'REDUCER', 'elbow-male': 'ELBOW M', 'elbow-union': 'ELBOW',
    'tee-union': 'TEE', 'bulkhead-union': 'BULKHEAD', 'push-in-cartridge': 'CARTRIDGE', plug: 'PLUG' },
  rivet: { dome: 'DOME RIVET', countersunk: 'CSK RIVET', 'large-flange': 'FLG RIVET' },
};
// Every short form is a proposal (decisions.md, "What a hardware label prints"). These carry a stronger note, shown beside
// the printed form in the label words so the wording is never quietly made permanent (design review 2026-10-06):
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
// a T-nut's slot width prints as its own attribute: 5 MM SLOT (what tells a 2020 drawer from a 3030 one at the same thread)
const slotText = (v) => `${fmtNum(v)} MM SLOT`;

// READING order: where the attributes read on the label, left to right, top to bottom
export const ATTRIBUTE_ORDER = ['head', 'specific.tnut.slot', 'material.base', 'material.property_class', 'material.finish',
  'material.colour', 'thread.series', 'specific.point_type'];
// KEEP priority, apart from the reading order (design review 2026-10-05): the optional attributes are offered to the engine in
// this order and it drops from the END - so the grade and the finish outrank the broad base material (STEEL), which a
// grade already implies. Pins always win: a pinned field prints or the label is a non-fit.
// A T-nut's slot outranks its material: the slot is what its drawer is for (2026-10-24).
export const KEEP_PRIORITY = ['head', 'specific.tnut.slot', 'material.property_class', 'material.finish', 'material.base',
  'material.colour', 'thread.series', 'specific.point_type'];

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
    case 'specific.tnut.slot': return Number.isFinite(Number(v)) ? slotText(Number(v)) : null;
    default: return null;
  }
}

// the value: '5/16-18' + '× 1-1/2"' (a screw: thread and length, each an unbreakable field), or 'M5' alone.
// NEVER a placeholder (2026-10-05, the first labels made from Jerrari's saved records printed 'M?'): a size that is not
// recorded gives no value at all, an inch thread with no threads per inch prints its designation alone, and an
// unrecorded length is left off - each one listed by valueMissing() so the preview says so.
// THE FAMILIES THAT KEEP THEIR SIZES IN specific.* (2026-10-15, the label-flow stress test: their labels went out with
// fields [] - a fitting, a rivet, a pin, a ring, a connector, an Other part - or with the thread alone - a standoff
// "M3" with no length). Their value is their label's BIG text: labelRule.big in families-data.js for the data
// families, the picker's spec line for a fitting and a rivet, the name for an Other part. Every part of it must be
// known, or no value is printed (never a placeholder) and valueMissing() names what is missing.
const DATA_BIG = { standoff: ['thread', 'length'], shoulder: ['diameter', 'length'], pin: ['diameter', 'length'], ring: ['size'],
  springwasher: ['thread'], rod: ['thread'], thumb: ['thread', 'length'], connector: ['series', 'positions'] };
const VOCAB_BIG = { fitting: ['specific.fitting.tube_a'], rivet: ['specific.rivet.diameter', 'specific.rivet.length'] };
export function bigPaths(rec) {
  const df = DATA_FAMILY.get(rec.family);
  if (df && DATA_BIG[rec.family]) return DATA_BIG[rec.family].map((k) => df.fields.find((f) => f.key === k).path);
  return VOCAB_BIG[rec.family] || [];
}
// "M3 × 10" -> ['M3', '× 10']: each part an unbreakable field, as a screw's thread and length are
const splitBig = (s) => s.split(' × ').map((x, i) => (i ? `× ${x}` : x));
const nameOf = (rec) => (rec.label && String(rec.label).trim()) || '';
function familyFields(rec) {
  if (rec.family === 'other') return nameOf(rec) ? [nameOf(rec)] : [];
  const paths = bigPaths(rec);
  if (!paths.length) return null;   // not one of these families
  if (paths.some((p) => !known(get(rec, p)))) return [];
  if (DATA_FAMILY.has(rec.family)) return splitBig(labelText(rec).big);
  if (rec.family === 'fitting') {
    const a = get(rec, 'specific.fitting.tube_a'); const b = get(rec, 'specific.fitting.tube_b');
    return [`${fmtNum(a.value)}${known(b) ? '/' + fmtNum(b.value) : ''} mm`];
  }
  return [fmtNum(get(rec, 'specific.rivet.diameter').value), `× ${fmtNum(get(rec, 'specific.rivet.length').value)}`];
}

export function valueFields(rec) {
  const fam = familyFields(rec);
  if (fam) return fam;
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
  if (rec.family === 'other') return nameOf(rec) ? [] : [{ path: 'label', why: 'name not recorded' }];
  const th = rec.thread;
  const out = [];
  if (th) {
    if (!known(th.diameter)) out.push({ path: 'thread.diameter', why: 'size not recorded' });
    else if (isUnified(rec) && th.tpi && !known(th.tpi)) out.push({ path: 'thread.tpi', why: 'threads per inch not recorded' });
    if (rec.length && !known(rec.length.value)) out.push({ path: 'length.value', why: 'length not recorded' });
  }
  // the specific.* parts of the big text (the thread is named above)
  for (const p of bigPaths(rec)) if (p !== 'thread.diameter' && !known(get(rec, p))) out.push({ path: p, why: `${p.split('.').pop().replace(/_/g, ' ')} not recorded` });
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
    // the pins in KEEP priority (2026-10-06, design review: on a non-fit "try prioritizing FLANGE NUT over generic STEEL, with the
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
