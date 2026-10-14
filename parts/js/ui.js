// Part Picker v2 UI (2026-10-04): A's picture tiles, C's editable summary strip and per-part "Will add" rows.
// Direction chosen in design review from the design canvas; this file only draws. Every rule (menus, prefill, statuses, the
// drive-change standard drop and offer) is the v1 engine in picker.js / batch.js / fields.js, unchanged and tested.
// The v1 form (v1.html, a development page that is not published) shares this page's saved list.
// Published inside the Label Studio site under parts/ (2026-10-10); js/embed.js holds the contract with the Studio.
import { loadDataAsync } from './data.js';
import { isEmbedded, labelStudioUrl, addMessage, readReply, replyStatus, labelStudioProblem, labelsButtonText,
  LABEL_STUDIO_MAX_ITEMS, CUSTOM_TEXT_MAX, plannerAsked, readHello, readyMessage, addMessageFor, readPlannerReply } from './embed.js';
import { createPicker, FAMILIES, LABEL_WORD_MAX, pathDef as pathDefOf } from './picker.js';
import { expandBatch, listText, exportDoc, importDoc, fmtStandard, fmtStandardOf } from './batch.js';
import { STATUS, getPath, leaves, parseNumber, clone, upgradeRecord } from './fields.js';
import { glyph, FAMILY_GLYPH, headGlyph, DRIVE_GLYPH, POINT_GLYPH, nutTopGlyph } from './glyphs.js';
import { createHwImages, pictureColours, presetFor } from './hwimage.js';
import { DATA_FAMILIES, DATA_FAMILY, labelText } from './families-data.js';
import { isUnified, parseInch, fracInch } from './units.js';
import { PRESETS, cleanStyle, labelColours, colourChanges, sameStyle, SLOTS, SLOT_NAME } from './labelstyle.js';
import { isPinned, togglePin } from './labelpins.js';
import { labelItem } from './labelitem.js';
// a field value's full meaning for the label-words editor: a type id reads as its name ('tooth-internal' -> 'Internal
// tooth lock washer (DIN 6797 J)'); anything else as stored
function describeValue(path, value) {
  if (path === 'head') {
    const t = T();
    const own = D && D.own && D.own.heads.find((x) => x.family === t.family && x.id === value);
    // an INCH record names the standard it uses (an inch plain washer is ASME B18.22.1 N, not the label's ISO 7089); a
    // metric one keeps the label's own wording, which carries more than the table id (DIN 6797 J, DIN 985 / ISO 10511)
    if (own) return isUnified(t) && t.standard ? `${own.label.replace(/\s*\([^)]*\)\s*$/, '')} (${fmtStandardOf(t)})` : own.label;
    const df = DATA_FAMILY.get(t.family);
    const dh = df && df.heads.find((x) => x[0] === value);
    if (dh) return dh[1];
  }
  return String(value);
}

const $ = (id) => document.getElementById(id);
// Inside the Label Studio's sheet (?embed=1 in a same-origin frame): no header of its own, and the parts go to the Studio
// by message. Decided once, before the first render; index.html hid the header early and this settles it either way.
// Inside the MODULITH planner's modal (?embed=planner, another origin): the same look, but the parts go to the planner
// that says hello first (js/embed.js, the planner's embed); until then the add button waits.
const PLANNER = plannerAsked(window);
let planner = null;   // { origin, session } once the planner's hello passed
const EMBED = isEmbedded(window) || PLANNER;
document.documentElement.classList.toggle('embed', EMBED);
document.documentElement.classList.remove('embed-pending');
if (PLANNER) {
  window.addEventListener('message', (e) => {
    const h = readHello(e, window);
    if (!h || planner) return;   // the first hello that passes binds the session; a second one is not a new planner
    planner = h;
    try { e.source.postMessage(readyMessage(planner), planner.origin); } catch { /* the parent went away */ }
    if (state.template) render();   // the hello can arrive before the data is in; the first render then enables the button itself
  });
}
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const STORE = 'gen2-part-picker/1'; // the v1 form's key: both pages read and write the same list
const { LISTED, CUSTOM, UNKNOWN } = STATUS;
// fields a batch over THREAD SIZE fills per record from the data (the v1 form hides the same set)
const PER_SIZE = ['thread.pitch', 'thread.pitch_class', 'drive.tool_size', 'specific.washer.id', 'specific.washer.od',
  'specific.washer.thickness', 'specific.insert.outer_diameter', 'specific.insert.length', 'specific.height'];

const FAMILY_LABEL = { screw: 'Screws', nut: 'Nuts', washer: 'Washers', setscrew: 'Set screws', insert: 'Inserts',
  fitting: 'Tube fittings', tnut: 'T-nuts', rivet: 'Rivets', other: 'Other part' };
const NEW_FAMILIES = new Set(['fitting', 'tnut', 'rivet', 'other']);   // 2026-10-04: vocabulary families, generic sections
for (const df of DATA_FAMILIES) { FAMILY_LABEL[df.id] = df.short; NEW_FAMILIES.add(df.id); }   // the data families too
const HEAD_SHORT = {
  screw: { 'socket-cap': 'Socket cap', button: 'Button', countersunk: 'Countersunk', hex: 'Hex head' },
  nut: { hex: 'Hex', thin: 'Thin (jam)', 'nylon-thin': 'Nyloc, thin', 'nylon-regular': 'Nyloc, regular', flange: 'Flange',
    style2: 'Hex, style 2', 'thin-unchamfered': 'Thin, unchamfered', square: 'Square', 'square-thin': 'Square, thin',
    'flange-plain': 'Flange, plain', cap: 'Domed cap' },
  washer: { plain: 'Plain', large: 'Large', 'extra-large': 'Extra-large', spring: 'Spring lock',
    'plain-c': 'Plain, grade C', chamfered: 'Chamfered', small: 'Small', 'tooth-internal': 'Internal tooth' },
  setscrew: { 'hex-socket-set': 'Hex socket set screw' },
  insert: { 'heat-set': 'Heat-set', 'press-in': 'Press-in', 'self-tapping': 'Self-tapping' },
};
const DRIVE_SHORT = { 'hex-socket': 'Hex socket', 'external-hex': 'External hex', hexalobular: '6-lobe', phillips: 'Phillips',
  pozidriv: 'Pozidriv', slotted: 'Slotted', none: 'None' };
const TOOL_WORD = { 'hex-socket': (v) => `hex key ${v} mm`, 'external-hex': (v) => `${v} mm across flats`, hexalobular: (v) => `${v}` };

// The four status words, defined precisely (design review: keep the words, make the definitions exact).
const STATUS_INFO = {
  listed: { word: 'Listed', def: 'In the picker\'s reference data or vocabulary. The tier after it says how far that goes: documented = in '
    + 'the bd_warehouse library data; verified = two independent public sources agree; single = one source; conflict = sources '
    + 'disagree; unverified = our own tables, not checked. A term you pick from a list (a shape, a head style) is vocabulary, not '
    + 'data, and shows no tier. Listed does not mean independently verified.' },
  suggested: { word: 'Suggested', def: 'The data offers a value but does not fill it in for you (one source, sources that disagree, '
    + 'our own unchecked tables, or an ISO-or-DIN choice). Nothing is used until you press Use.' },
  custom: { word: 'Custom', def: 'Typed by you and not in the reference data. Allowed and kept exactly as typed; it simply has no data source.' },
  unknown: { word: 'Unknown', def: 'You do not know it. It stays empty and nothing fills it in later.' },
};

// family -> builder sections, in order: [key, title]
const PLAN = {
  screw: [['head', 'Head'], ['drive', 'Drive'], ['thread', 'Thread'], ['pitch', 'Pitch'], ['lengths', 'Lengths'], ['extent', 'Thread extent'], ['material', 'Material']],
  setscrew: [['point', 'Point'], ['drive', 'Drive'], ['thread', 'Thread'], ['pitch', 'Pitch'], ['lengths', 'Lengths'], ['material', 'Material']],
  nut: [['head', 'Type'], ['sizes', 'Thread sizes'], ['locking', 'Locking'], ['material', 'Material']],
  washer: [['head', 'Type'], ['sizes', 'Nominal sizes'], ['material', 'Material']],
  insert: [['head', 'Type'], ['sizes', 'Internal thread'], ['brand', 'Brand dataset'], ['material', 'Material']],
  // the vocabulary families (2026-10-04): { key, title, kind, path, hint } - drawn by the generic sections
  fitting: [{ key: 'head', title: 'Shape', kind: 'head' },
    { key: 'tube-a', title: 'Tube OD, end A', kind: 'batch', path: 'specific.fitting.tube_a', unit: 'mm', noun: 'tube sizes' },
    { key: 'tube-b', title: 'Tube OD, end B', kind: 'choice', path: 'specific.fitting.tube_b', hint: 'unions and reducers; leave Unknown for a male fitting' },
    { key: 'fthread', title: 'Thread designation', kind: 'choice', path: 'specific.fitting.thread', hint: 'the FULL designation: G1/8 (parallel) and R1/8 (taper) are different parts' },
    { key: 'construction', title: 'Construction', kind: 'choice', path: 'specific.fitting.construction', hint: 'tube stop, or pass-through (the tube runs right through)' },
    { key: 'material', title: 'Material', kind: 'material', paths: ['material.base', 'material.finish', 'material.colour'] }],
  tnut: [{ key: 'head', title: 'Insertion type', kind: 'head' },
    { key: 'profile', title: 'Profile / interface', kind: 'choice', path: 'specific.tnut.profile' },
    { key: 'slot', title: 'Slot width', kind: 'choice', path: 'specific.tnut.slot', unit: 'mm' },
    { key: 'sizes', title: 'Thread sizes', kind: 'sizes' },
    { key: 'spring', title: 'Spring / ball', kind: 'choice', path: 'specific.tnut.spring' },
    { key: 'material', title: 'Material', kind: 'material', paths: ['material.base', 'material.finish', 'material.colour'] }],
  rivet: [{ key: 'head', title: 'Head style', kind: 'head' },
    { key: 'diameter', title: 'Body diameter', kind: 'choice', path: 'specific.rivet.diameter', unit: 'mm' },
    { key: 'rlength', title: 'Body lengths', kind: 'batch', path: 'specific.rivet.length', unit: 'mm', noun: 'lengths', hint: 'common lengths to pick from - type any other' },
    { key: 'grip', title: 'Grip range', kind: 'grip', hint: 'from the package - kept separate from the body length, never worked out from it' },
    { key: 'rtype', title: 'Type', kind: 'choice', path: 'specific.rivet.type' },
    { key: 'body', title: 'Body material', kind: 'choice', path: 'specific.rivet.body_material' },
    { key: 'mandrel', title: 'Mandrel material', kind: 'choice', path: 'specific.rivet.mandrel_material', hint: 'aluminium / steel is not aluminium / aluminium' }],
  other: [],
};
// the data families' sections, from families-data.js: type, each field (a batch field as a batch), material
for (const df of DATA_FAMILIES) {
  PLAN[df.id] = [{ key: 'head', title: df.headTitle, kind: 'head' },
    ...df.fields.map((f) => (f.thread ? (f.batch ? { key: 'sizes', title: f.title, kind: 'sizes' }
      : { key: f.key, title: f.title, kind: 'choice', path: 'thread.diameter', hint: f.hint })
      : f.batch ? { key: f.key, title: f.title, kind: 'batch', path: f.path, unit: f.unit, noun: f.key === 'length' ? 'lengths' : 'sizes', hint: f.hint }
        : { key: f.key, title: f.title, kind: 'choice', path: f.path, unit: f.unit, hint: f.hint })),
    { key: 'material', title: 'Material', kind: 'material', paths: ['material.base', 'material.finish', 'material.colour'] }];
}
// every family ends with the record's own details: name, package text, supplier, photo, collections
for (const f of Object.keys(PLAN)) PLAN[f].push({ key: 'details', title: 'Name, package, supplier, photo', kind: 'details' });
const planKey = (e) => (Array.isArray(e) ? e[0] : e.key);
const planTitle = (e) => (Array.isArray(e) ? e[1] : e.title);
// paths the sections above edit; everything else in the family goes under "More detail"
const SECTION_PATHS = new Set(['head', 'thread.system', 'thread.diameter', 'thread.tpi', 'length.value', 'specific.thread_extent', 'specific.point_type',
  'specific.locking_feature', 'specific.insert.brand_dataset', 'material.base', 'material.stainless_group',
  'material.property_class', 'material.finish']);

let D; let P;
const state = {
  family: 'screw', template: null, records: [],
  sel: [],               // batch values of the family's varying field (numbers; listed or not is read from the menu)
  explicit: new Set(),   // paths the user set to Unknown on purpose (so a fresh record does not show Unknown as picked)
  section: 'head',       // the section being edited: its token in the summary strip is marked
  customOpen: null,      // path whose "your own value" box is open
  editing: null,         // record id being edited, or null (batch mode)
  saved: null,           // the batch builder parked while a record is edited
  offerKept: false,      // "Keep as a custom combination" pressed for the current drive change
  moreFine: false, moreOpen: false, textView: null,
  listFilter: null,      // a collection (tag) the list is filtered to, or null
  labelStyle: null,      // the collection's label colour scheme (labelstyle.js), saved with the list and the export
  importReview: null,    // an import whose colours would change, waiting for the person's decision
};
const T = () => state.template;
const fam = () => FAMILIES.get(state.family);
const varyPath = () => (fam().varying ? fam().varying.path : null);   // Other part has no batch
const batching = () => state.editing === null;

// ------------------------------------------------------------------ persistence
let storageWarned = false;
let labelsMsg = null; let labelsTimer = null;   // the Make labels status line (setLabelsStatus, under the list)
function save() {
  // a Make labels / Add part labels message describes the list as it was: any change to the list or the part clears it
  if (labelsMsg) { labelsMsg = null; clearTimeout(labelsTimer); }
  try { localStorage.setItem(STORE, JSON.stringify({ family: state.family, template: state.saved ? state.saved.template : state.template, records: state.records, label_style: state.labelStyle })); storageWarned = false; }
  catch {
    // private mode, blocked storage - or FULL: photos are kept in the records, and the browser allows ~5 MB. Say so once,
    // so a long session is not lost silently.
    if (!storageWarned) { storageWarned = true; setTimeout(() => setStatus('The browser would not save the list (storage blocked or full - photos take space). Export JSON to keep it.', 'err'), 0); }
  }
}
// The WORKSHOP scheme (design review 2026-10-06: "the working default should still be your agreed workshop-wide scheme"): one
// per browser, the scheme a new or cleared list starts with. A list keeps its own (saved with it and with its export).
// A browser that has never chosen one starts with the combined scheme (Jerrari 2026-10-07: labels include the colour
// accents - metric blue / SAE red, the material as the band accent); choosing "off" as the workshop scheme is stored
// as null, so it stays off.
const WORKSHOP_STYLE = 'gen2-part-picker/workshop-label-style';
function workshopStyle() {
  let raw = null;
  try { raw = localStorage.getItem(WORKSHOP_STYLE); } catch { /* storage blocked: the default */ }
  if (raw === null) return JSON.parse(JSON.stringify(PRESETS.combined));
  try { return cleanStyle(JSON.parse(raw)) || null; } catch { return null; }
}
function setWorkshopStyle(style) {
  try { localStorage.setItem(WORKSHOP_STYLE, JSON.stringify(style || null)); return true; }
  catch { return false; }
}
function restore() {
  state.labelStyle = workshopStyle();
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!s || !Array.isArray(s.records)) return;
    state.records = s.records.map(upgradeRecord);
    // a list saved before label colours existed has no label_style key: it takes the workshop scheme
    if ('label_style' in s) state.labelStyle = cleanStyle(s.label_style) || null;
    if (s.template && FAMILIES.has(s.template.family) && s.template.id === 'template') { state.template = upgradeRecord(s.template); state.family = s.template.family; }
  } catch { /* ignore */ }
}

let statusTimer = null;
function setStatus(msg, cls = '') {
  const el = $('status'); if (!el) return;
  el.textContent = msg; el.className = 'status ' + cls;
  clearTimeout(statusTimer);
  if (msg && cls !== 'err') statusTimer = setTimeout(() => { el.textContent = ''; }, 6000);
}

// ------------------------------------------------------------------ small readers
const fmtNum = (v) => (typeof v === 'number' ? String(+v.toFixed(3)) : String(v));
function headLabel(rec, short = true) {
  if (rec.family === 'other') return rec.label || null;
  const f = rec.head;
  if (f.status === UNKNOWN) return null;
  if (f.status === CUSTOM) return String(f.value);
  const s = short && HEAD_SHORT[rec.family] && HEAD_SHORT[rec.family][f.value];
  if (s) return s;
  if (NEW_FAMILIES.has(rec.family)) return optLabel('head', f.value, rec);
  return (D.head(rec.family, f.value) || { label: f.value }).label;
}
// a field's value as a person reads it: the vocabulary label, the number with its unit, or null when Unknown
function fieldText(rec, path, unit = '') {
  const f = getPath(rec, path);
  if (!f || f.status === UNKNOWN) return null;
  const t = f.status === LISTED ? optLabel(path, f.value, rec) : String(f.value);
  return unit ? `${t} ${unit}` : t;
}
// the vocabulary families' spec line and tags (screws and nuts keep shortSpec / their own rows)
function specNew(rec) {
  const sp = rec.specific;
  if (rec.family === 'fitting') {
    const a = fieldText(rec, 'specific.fitting.tube_a'); const b = fieldText(rec, 'specific.fitting.tube_b');
    return `${a || '?'}${b ? ' / ' + b : ''} mm` + (fieldText(rec, 'specific.fitting.thread') ? ` · ${fieldText(rec, 'specific.fitting.thread')}` : '');
  }
  if (rec.family === 'tnut') return `${threadText(rec)} T-nut`;
  if (rec.family === 'rivet') return `${fieldText(rec, 'specific.rivet.diameter') || '?'} × ${fieldText(rec, 'specific.rivet.length') || '?'}`;
  if (DATA_FAMILY.has(rec.family)) return labelText(rec, headLabel(rec)).big;
  return rec.label || 'Other part';
}
function tagsNew(rec) {
  const t = (p, u) => fieldText(rec, p, u);
  if (rec.family === 'fitting') return [headLabel(rec), t('specific.fitting.construction')];
  if (rec.family === 'tnut') return [t('specific.tnut.profile'), headLabel(rec), t('specific.tnut.slot', 'mm slot'), t('specific.tnut.spring')];
  if (rec.family === 'rivet') {
    const gmin = t('specific.rivet.grip_min'); const gmax = t('specific.rivet.grip_max');
    const bm = t('specific.rivet.body_material'); const mm = t('specific.rivet.mandrel_material');
    return [headLabel(rec), (gmin || gmax) ? `grip ${gmin || '?'}–${gmax || '?'} mm` : null, (bm || mm) ? `${bm || '?'} / ${mm || '?'}` : null];
  }
  if (DATA_FAMILY.has(rec.family)) return labelText(rec, headLabel(rec)).small;
  return [rec.meta && rec.meta.package_text];
}
function driveLabel(f) {
  if (!f || f.status === UNKNOWN) return null;
  if (f.status === CUSTOM) return DRIVE_SHORT[f.value] || String(f.value);
  return DRIVE_SHORT[f.value] || ((D.driveType(f.value) || {}).label || f.value);
}
function toolText(rec) {
  if (!rec.drive) return null;
  const f = rec.drive.tool_size;
  if (f.status === UNKNOWN) return null;
  if (isUnified(rec)) return rec.drive.type.status === LISTED && rec.drive.type.value === 'hex-socket' ? `hex key ${f.value}` : String(f.value);
  const w = rec.drive.type.status === LISTED && TOOL_WORD[rec.drive.type.value];
  return w ? w(fmtNum(f.value)) : fmtNum(f.value);
}
function threadText(rec) {
  if (!rec.thread) return '';
  const d = rec.thread.diameter;
  if (isUnified(rec)) {                  // an inch thread is size-TPI: #10-24, 1/4-20 (never an M size)
    // an inch WASHER is its size alone: 1/4" or #10 (2026-10-05)
    if (rec.thread.tpi === null) return d.status === UNKNOWN ? '?' : (String(d.value).startsWith('#') ? String(d.value) : `${d.value}"`);
    const tpi = rec.thread.tpi && rec.thread.tpi.status !== UNKNOWN ? rec.thread.tpi.value : '?';
    return `${d.status === UNKNOWN ? '?' : d.value}-${tpi}`;
  }
  return d.status === UNKNOWN ? 'M?' : `M${fmtNum(d.value)}`;
}
// a TICKED size, as the record will read it: M5 (metric), #10 or 1/4 (an inch nut - its threads per inch come per row),
// 1/4" or #10 (an inch washer). Never an M on an inch designation (2026-10-05)
function selSize(x) {
  const t = T();
  if (!isUnified(t)) return `M${fmtNum(x)}`;
  return t.thread.tpi === null && !String(x).startsWith('#') ? `${x}"` : String(x);
}
// a length in the record's own unit: 20 (mm) or 1-1/4" (an inch record)
const fmtLen = (rec, v) => (isUnified(rec) ? `${fracInch(v)}"` : fmtNum(v));
function fine(rec) {
  const p = rec.thread && rec.thread.pitch;
  return p && p.status !== UNKNOWN && !(rec.thread.pitch_class.status === LISTED && rec.thread.pitch_class.value === 'coarse');
}
// "M5 × 16", "M5 × 0.5 × 16", "M5"
function shortSpec(rec) {
  if (NEW_FAMILIES.has(rec.family)) return specNew(rec);
  let s = threadText(rec);
  if (fine(rec)) s += ` × ${fmtNum(rec.thread.pitch.value)}`;
  if (rec.length) s += ' × ' + (rec.length.value.status === UNKNOWN ? '?' : fmtLen(rec, rec.length.value.value));
  return s;
}
function stdText(rec) {
  if (NEW_FAMILIES.has(rec.family)) return rec.head.status === CUSTOM ? 'custom type' : '';
  if (rec.standard) return fmtStandardOf(rec);
  if (rec.standard_changed_from) return `custom combination (was ${fmtStandard(rec.standard_changed_from)})`;
  if (rec.head.status === CUSTOM) return 'custom type';
  return '';
}
function materialText(rec, withFinish = false) {
  const m = rec.material; const bits = [];
  if (m.base.status !== UNKNOWN) bits.push(String(m.base.value));
  if (m.stainless_group.status !== UNKNOWN) bits.push(String(m.stainless_group.value));
  if (m.property_class.status !== UNKNOWN) bits.push(`class ${m.property_class.value}`);
  if (withFinish && m.finish.status !== UNKNOWN) bits.push(String(m.finish.value));
  if (withFinish && m.colour && m.colour.status !== UNKNOWN) bits.push(String(m.colour.value));
  return bits.join(' ');
}
function primaryGlyph(rec) {
  if (rec.family === 'other') return 'part-other';
  if (rec.head.status === UNKNOWN) return NEW_FAMILIES.has(rec.family) ? FAMILY_GLYPH[rec.family] : 'unknown';
  if (rec.head.status === CUSTOM) return 'custom';
  if (rec.family === 'setscrew') {
    const pt = rec.specific.point_type;
    return (pt.status === LISTED && POINT_GLYPH[pt.value]) || 'point-flat';
  }
  return headGlyph(rec.family, rec.head.value) || 'unknown';
}
function secondaryGlyph(rec) {
  if (rec.family === 'screw' || rec.family === 'setscrew') {
    const d = rec.drive.type;
    if (d.status === LISTED && DRIVE_GLYPH[d.value]) return DRIVE_GLYPH[d.value];
    return null;
  }
  if (rec.family === 'nut' && rec.head.status === LISTED) return nutTopGlyph(rec.head.value);
  return null;
}

// ------------------------------------------------------------------ status words
function statusKey(f) { return !f ? 'unknown' : f.status; }
function statusChip(f, opts = {}) {
  const k = opts.suggested ? 'suggested' : statusKey(f);
  const info = STATUS_INFO[k];
  const tier = k === 'listed' && f.source ? f.source.tier : null;
  return h('span', { class: `st st-${k}`, title: info.def + (tier ? `\n\nThis value: ${tier}.` : '') },
    h('span', { class: 'mk', 'aria-hidden': 'true' }), info.word,
    tier && !['documented', 'verified', 'vocabulary'].includes(tier) ? h('span', { class: 'tier' }, tier) : null);
}

// ------------------------------------------------------------------ changes
function afterChange() { save(); render(); }
function apply(section, path, input) {
  try {
    state.template = P.set(T(), path, input);
    state.section = section;
    if (input.mode === UNKNOWN) state.explicit.add(path); else state.explicit.delete(path);
    state.customOpen = null;
    if (path === 'drive.type') state.offerKept = false;
    setStatus('');
    afterChange();
  } catch (e) { setStatus(e.message, 'err'); }
}
const pick = (section, path, value) => apply(section, path, { mode: LISTED, value });

// A fresh record on the head's OWN standard, carrying over the thread, pitch, extent and point. Used before any drive
// change so the engine's standard-drop rule always starts from the head's standard (the engine only drops a standard it
// has a table for, so an accepted lists-only offer such as ISO 14579 would otherwise stick to a later drive).
function rebaseOnHead(t) {
  if (t.head.status !== LISTED) return t;
  let r = P.set(t, 'head', { mode: LISTED, value: t.head.value });
  // length.value matters while editing one part (a batch keeps its lengths in state.sel)
  for (const path of ['specific.point_type', 'thread.diameter', 'thread.pitch', 'specific.thread_extent', 'length.value']) {
    const f = getPath(t, path);
    if (f && f.status !== UNKNOWN && getPath(r, path)) r = P.set(r, path, { mode: f.status === CUSTOM ? CUSTOM : LISTED, value: f.value });
  }
  return r;
}
function headStdOf(t) {
  if (t.head.status !== LISTED) return null;
  const hd = D.head(t.family, t.head.value);
  return hd && hd.standard ? hd.standard : null;
}
function chooseDrive(id) {
  try {
    let t = T();
    const own = headStdOf(t);
    if (own && t.standard !== own) t = rebaseOnHead(t);
    const already = t.drive.type.status === LISTED && t.drive.type.value === id;
    state.template = already ? t : P.set(t, 'drive.type', { mode: LISTED, value: id });
    state.section = 'drive'; state.offerKept = false; state.customOpen = null; state.explicit.delete('drive.type');
    afterChange();
  } catch (e) { setStatus(e.message, 'err'); }
}

// Each family keeps its OWN draft (design review, 2026-10-04): browsing from an unfinished screw to the rivets and back restores the
// screw, and no screw field can ride into a rivet record. A fresh draft takes only the material fields the new family
// SHOWS - a value the user cannot see on the form must not be saved with the part.
const drafts = {};
function switchFamily(id) {
  if (id === state.family) return;
  if (!D || !T()) return;   // the data is not in yet: the tiles are disabled until then, and a click that slips through does nothing (2026-10-13)
  const old = T();
  drafts[state.family] = { template: old, sel: state.sel, explicit: [...state.explicit] };
  if (drafts[id]) {
    const d = drafts[id];
    let t = d.template;
    if (old.tags) t = P.setMeta(t, { tags: old.tags });
    state.template = t; state.family = id; state.sel = d.sel; state.explicit = new Set(d.explicit);
    state.customOpen = null; state.offerKept = false; state.section = planKey(PLAN[id][0]);
    afterChange();
    return;
  }
  let t = P.newRecord(id, { id: 'template' });
  for (const k of Object.keys(t.material)) {          // only what the new family's form shows
    if (FAMILIES.get(id).paths.some((d) => d.path === `material.${k}`)) t.material[k] = clone(old.material[k]);
  }
  if (t.material.base.value !== 'stainless') t.material.stainless_group = { value: null, status: UNKNOWN, source: null };
  t.notes = old.notes;
  if (old.tags) t = P.setMeta(t, { tags: old.tags });   // collections are sticky for a session; name, photo and package are per bag
  const hasHead = FAMILIES.get(id).paths.some((d) => d.path === 'head');
  const heads = hasHead ? P.optionsFor(t, 'head').options : [];
  if (heads.length === 1) t = P.set(t, 'head', { mode: LISTED, value: heads[0].value }); // set screws: one head, the point is the choice
  state.template = t; state.family = id;
  state.sel = []; state.explicit.clear(); state.customOpen = null; state.offerKept = false;
  state.section = planKey(PLAN[id][0]);
  afterChange();
}

// ------------------------------------------------------------------ batch selection
function varyOptions() { return varyPath() ? P.optionsFor(T(), varyPath()).options : []; }
function toggleSel(v, section) {
  const i = state.sel.findIndex((x) => x === v);
  if (i >= 0) state.sel.splice(i, 1); else state.sel.push(v);
  state.sel.sort((a, b) => a - b);
  state.section = section || (varyPath() === 'length.value' ? 'lengths' : 'sizes');
  render();
}
function addCustomSel(text, label) {
  const inch = isUnified(T()) && varyPath() === 'length.value';
  const v = inch ? parseInch(text) : parseNumber(text);
  if (v === null || v <= 0) {
    setStatus(inch ? `${label}: "${text}" is not a length in inches. Type 1-1/4, 1 1/4 or 1.25.` : `${label}: "${text}" is not a number above zero.`, 'err');
    return false;
  }
  if (!state.sel.includes(v)) { state.sel.push(v); state.sel.sort((a, b) => a - b); }
  return true;
}
function previews() {
  const t = T();
  if (!batching() || !state.sel.length || !varyPath()) return [clone(t)];
  return expandBatch(P, t, state.sel);
}

// ------------------------------------------------------------------ building blocks
// Rendered pictures (v2, 2026-10-04): the MODULITH hardware visual library (its render-v2 library),
// synced into img/hw/v2/ (pictures + assets.json) by tools/sync_hw_assets.py. js/hwimage.js picks the asset for a
// record's type, drive, point, size, length and thread extent, and says when a picture is a stand-in (design review: a
// change of size, length or drive retrieves the corresponding asset, with a clear fallback when there isn't one).
// Tiles show the type's own picture (the Head section its head crop); drives keep their vector glyphs.
const IMG_NOTE = 'Rendered example - shape for recognition, illustrative finish';
let HW = createHwImages({ assets: [] });               // replaced once img/hw/v2/assets.json loads; empty = glyphs only
const tileImg = (p, head = false) => (p ? (head && p.srcHead) || p.src : null);
// one short visible line naming what the picture differs in; the source detail behind it (design review 2026-10-06)
const picTitle = (p) => [p.short || p.caption, ...(p.details || p.notes)].join('\n');
// a reference render, or a generic illustration (2026-10-05) - shown the same way, but never as exact
const hasPic = (p) => !!p && (p.kind === 'render' || p.kind === 'illustration');

function tile({ g, img, label, sub, on, onClick, size = 'md', title, tag, check, cls = '', disabled }) {
  const px = size === 'lg' ? 50 : size === 'sm' ? 30 : 40;
  return h('button', { type: 'button', class: `tile ${size} ${on ? 'on' : ''} ${img ? 'has-img' : ''} ${cls}`, 'aria-pressed': String(!!on), title, onclick: onClick, disabled },
    check ? h('span', { class: 'chk', 'aria-hidden': 'true' }, on ? '✓' : '') : null,
    img ? h('img', { class: 'timg', src: img, alt: '', width: 128, height: 128, loading: 'lazy', title: IMG_NOTE })
      : g ? h('span', { class: 'tg', html: glyph(g, px) }) : null,
    h('span', { class: 'tl' }, label),
    sub ? h('span', { class: 'ts' }, sub) : null,
    tag ? h('span', { class: 'tag' }, tag) : null);
}
function textBtn({ label, on, onClick, cls = '', title, check }) {
  return h('button', { type: 'button', class: `tb ${on ? 'on' : ''} ${cls}`, 'aria-pressed': String(!!on), onclick: onClick, title },
    check ? h('span', { class: 'chk', 'aria-hidden': 'true' }, on ? '✓' : '') : null, label);
}
// Unknown and "your own value" buttons for a single-value field
function stateButtons(section, path, { tiles = false, size = 'md', known = [] } = {}) {
  const f = getPath(T(), path);
  const unkOn = f.status === UNKNOWN && state.explicit.has(path);
  const own = f.status === CUSTOM && !known.includes(f.value); // a value typed by the user, not one of the tiles
  const cusOn = own || state.customOpen === path;
  const onUnk = () => apply(section, path, { mode: UNKNOWN });
  const onCus = () => { state.customOpen = state.customOpen === path ? null : path; state.section = section; render(); focusCustom(path); };
  if (tiles) {
    return [tile({ g: 'unknown', label: 'Unknown', on: unkOn, onClick: onUnk, size, cls: 'state', title: STATUS_INFO.unknown.def }),
      tile({ g: 'custom', label: own ? String(f.value) : 'Custom…', sub: own ? 'custom' : 'type your own',
        on: cusOn, onClick: onCus, size, cls: 'state', title: STATUS_INFO.custom.def })];
  }
  return [textBtn({ label: 'Unknown', on: unkOn, onClick: onUnk, cls: 'state', title: STATUS_INFO.unknown.def }),
    textBtn({ label: own ? `${f.value} (custom)` : 'Custom…', on: cusOn, onClick: onCus, cls: 'state', title: STATUS_INFO.custom.def })];
}
function focusCustom(key) {
  setTimeout(() => { const i = document.querySelector(`[data-custom="${CSS.escape(key)}"]`); if (i) i.focus(); }, 0);
}
// the "your own value" box for a single-value field (open while state.customOpen === path)
function customBox(section, path, label, numeric) {
  if (state.customOpen !== path) return null;
  const f = getPath(T(), path);
  const inchLen = isUnified(T()) && path === 'length.value';
  const inchSize = isUnified(T()) && path === 'thread.diameter';
  if (inchSize) numeric = false;
  // a typed value can print on the label, and the Label Studio takes at most CUSTOM_TEXT_MAX characters a word
  const inp = h('input', { type: 'text', 'data-custom': path, inputmode: numeric && !inchLen ? 'decimal' : 'text', 'aria-label': `${label}: your own value`,
    maxlength: String(CUSTOM_TEXT_MAX),
    placeholder: inchLen ? 'inches: 1-1/4, 1 1/4 or 1.25' : inchSize ? 'an inch size: #6, #10, 1/4' : numeric ? 'a number, e.g. 7' : 'describe it, e.g. pan head',
    value: f.status === CUSTOM ? (inchLen ? fracInch(f.value) : String(f.value)) : '' });
  const use = () => {
    const text = inp.value.trim();
    if (!text) { state.customOpen = null; render(); return; }
    if (text.length > CUSTOM_TEXT_MAX) { setStatus(`${label}: at most ${CUSTOM_TEXT_MAX} characters, so it fits a label.`, 'err'); return; }
    if (inchLen && parseInch(text) === null) { setStatus(`${label}: "${text}" is not a length in inches. Type 1-1/4, 1 1/4 or 1.25.`, 'err'); return; }
    if (numeric && !inchLen && parseNumber(text) === null) { setStatus(`${label}: "${text}" is not a number. Use a number, or choose Unknown.`, 'err'); return; }
    apply(section, path, { mode: CUSTOM, value: text });
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') use(); if (e.key === 'Escape') { state.customOpen = null; render(); } });
  return h('div', { class: 'custom-row' }, h('span', { class: 'cr-lab' }, `${label} - your own value`), inp,
    h('button', { type: 'button', class: 'btn', onclick: use }, 'Use'),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.customOpen = null; render(); } }, 'Cancel'),
    h('span', { class: 'cr-note' }, 'Saved as Custom: kept as typed, with no data source.'));
}
function optLabel(path, value, rec = T()) {
  try { const o = P.optionsFor(rec, path).options.find((x) => String(x.value) === String(value)); return o ? String(o.label) : fmtNum(value); }
  catch { return fmtNum(value); }
}
const suggText = (s, rec = T()) => (s.ambiguous ? `${fmtNum(s.value)} (${s.label})` : optLabel(s.path, s.value, rec) + (s.label ? ` (${s.label})` : ''));
const SUGG_NAME = { 'drive.tool_size': 'tool / wrench size', 'specific.height': 'height', 'specific.locking_feature': 'locking',
  'specific.washer.id': 'ID', 'specific.washer.od': 'OD', 'specific.washer.thickness': 'thickness', 'length.datum': 'length datum', 'drive.type': 'drive' };
function suggestionRows(section, path) {
  return P.suggestions(T()).filter((s) => s.path === path).map((s) =>
    h('div', { class: 'sugg' }, statusChip(null, { suggested: true }),
      h('span', {}, suggText(s)), h('span', { class: 'tier' }, s.tier),
      s.hint ? h('span', { class: 'muted' }, ` - ${s.hint}`) : null,
      h('button', { type: 'button', class: 'btn sm', onclick: () => { state.template = P.acceptSuggestion(T(), path, s.value); state.section = section; afterChange(); } }, 'Use')));
}
function notes(info) {
  const out = [];
  for (const m of info.flags || []) out.push(h('div', { class: 'note warn' }, '⚠ data flagged: ' + m));
  for (const m of info.corrections || []) out.push(h('div', { class: 'note corr' }, '✎ ' + m));
  return out;
}

// ------------------------------------------------------------------ sections
function sectionEl(key, idx, title, hint, ...body) {
  return h('section', { id: `sec-${key}`, class: `sec ${state.section === key ? 'editing' : ''}`, 'aria-labelledby': `sec-${key}-h` },
    h('h3', { id: `sec-${key}-h` }, h('span', { class: 'num' }, idx), title, hint ? h('span', { class: 'hint' }, hint) : null),
    ...body);
}

function headSection(key, idx, title) {
  const t = T();
  const opts = P.optionsFor(t, 'head').options;
  const pic = (id) => tileImg(HW.typePicture(t.family, id), true);
  const illus = (id) => { const p = HW.typePicture(t.family, id); return !!p && p.kind === 'illustration'; };
  const tiles = opts.map((o) => tile({ g: headGlyph(t.family, o.value), img: pic(o.value), label: (HEAD_SHORT[t.family] || {})[o.value] || o.label,
    sub: o.standard ? fmtStandard(o.standard) : (t.family === 'insert' || illus(o.value) ? 'generic illustration' : null), size: 'lg',
    on: t.head.status === LISTED && t.head.value === o.value, onClick: () => pick(key, 'head', o.value), title: o.label }));
  return sectionEl(key, idx, title, t.family === 'insert' ? 'pictures show the category, not a particular part' : null,
    h('div', { class: 'tiles cols-5' }, tiles, stateButtons(key, 'head', { tiles: true, size: 'lg' })),
    customBox(key, 'head', title, false));
}

function pointSection(key, idx) {
  const t = T();
  const opts = P.optionsFor(t, 'specific.point_type').options;
  const f = t.specific.point_type;
  return sectionEl(key, idx, 'Point', 'hex socket set screw · only a flat point is ISO 4026; the others borrow its table',
    h('div', { class: 'tiles cols-6' }, opts.map((o) => tile({ g: POINT_GLYPH[o.value], img: tileImg(HW.pointPicture(o.value)), label: o.label[0].toUpperCase() + o.label.slice(1),
      sub: o.standard ? fmtStandard(o.standard) : null, on: f.status === LISTED && f.value === o.value, onClick: () => pick(key, 'specific.point_type', o.value) })),
    stateButtons(key, 'specific.point_type', { tiles: true })),
    customBox(key, 'specific.point_type', 'Point', false));
}

function driveSection(key, idx) {
  const t = T();
  const own = headStdOf(t);
  const ownStd = D.std(own);
  const ownDrive = ownStd ? ownStd.drive_type : null;
  const headId = t.head.status === LISTED ? t.head.value : null;
  const offers = D.own.drive_offers.filter((o) => o.head === headId);
  const cur = t.drive.type;
  const mk = (d, sub, tag) => tile({ g: DRIVE_GLYPH[d.id], label: DRIVE_SHORT[d.id] || d.label, sub, tag,
    on: cur.status !== UNKNOWN && cur.value === d.id, onClick: () => chooseDrive(d.id), title: d.label });
  const body = [];
  if (ownDrive) {
    const docd = D.own.drive_types.filter((d) => d.id === ownDrive || offers.some((o) => o.drive === d.id));
    const rest = D.own.drive_types.filter((d) => !docd.includes(d));
    body.push(h('div', { class: 'group-lab' }, 'Listed for this head'),
      h('div', { class: 'tiles cols-6' }, docd.map((d) => {
        if (d.id === ownDrive) return mk(d, fmtStandard(own), 'standard');
        const o = offers.find((x) => x.drive === d.id);
        return mk(d, fmtStandard(o.standard), 'other standard');
      })),
      h('div', { class: 'group-lab' }, 'Other drives', h('span', { class: 'muted' }, ' - custom combination, no listed standard')),
      h('div', { class: 'tiles cols-6' }, rest.map((d) => mk(d, null, null)), stateButtons(key, 'drive.type', { tiles: true, known: D.own.drive_types.map((d) => d.id) })));
  } else {
    body.push(h('div', { class: 'note' }, t.head.status === LISTED ? 'This head has no drive in its standard.'
      : t.head.status === CUSTOM ? 'A head you typed has no listed standard, so no drive is marked as its standard.' : 'Pick a head to see which drives its standard lists.'),
      h('div', { class: 'tiles cols-6' }, D.own.drive_types.map((d) => mk(d, null, null)), stateButtons(key, 'drive.type', { tiles: true, known: D.own.drive_types.map((d) => d.id) })));
  }
  body.push(customBox(key, 'drive.type', 'Drive', false));
  const panel = driveChangePanel();
  if (panel) body.push(panel);
  return sectionEl(key, idx, 'Drive', 'looking down at the head', ...body);
}

// Shown when the drive no longer matches the head's standard. Makes the standard change explicit, and rechecks what a
// different standard would change BEFORE it is accepted (design review: never swap the standard number and keep incompatible picks).
function driveChangePanel() {
  const t = T();
  const own = headStdOf(t);
  if (t.standard && own && t.standard !== own) {
    return h('div', { class: 'note ok' }, statusChip(t.drive.type),
      ` Using ${fmtStandard(t.standard)} with ${driveLabel(t.drive.type) || 'this drive'} instead of ${fmtStandard(own)}. Lengths and tool size below come from ${fmtStandard(t.standard)}.`);
  }
  if (!t.standard_changed_from || t.standard !== null || state.offerKept) return null;
  const from = fmtStandard(t.standard_changed_from);
  const dname = driveLabel(t.drive.type) || 'this drive';
  const head = (headLabel(t, false) || 'this head').toLowerCase();
  const offer = P.driveOffer(t);
  const ownStd = D.std(t.standard_changed_from);
  const back = ownStd && ownStd.drive_type ? h('button', { type: 'button', class: 'btn ghost', onclick: () => chooseDrive(ownStd.drive_type) },
    `Go back to ${DRIVE_SHORT[ownStd.drive_type] || ownStd.drive_type} (${from})`) : null;
  if (!offer) {
    return h('div', { class: 'panel' }, statusChip({ status: CUSTOM }),
      h('p', {}, `${dname} is not the drive ${from} specifies, and no listed standard pairs a ${head} with it. `
        + 'The part is saved as a custom combination: no standard attached, the tool size stays Unknown, and the lengths are kept as Custom values.'),
      h('div', { class: 'row' }, back));
  }
  let after; try { after = P.acceptOffer(t); } catch { after = null; }
  const checks = [];
  if (after) {
    const tool = toolText(after);
    checks.push(h('li', {}, 'Tool size: ', tool ? h('b', {}, tool) : 'Unknown', ' ', statusChip(after.drive.tool_size)));
    if (t.length) {
      const opts = P.optionsFor(after, 'length.value').options.map((o) => o.value);
      const vals = batching() ? state.sel : (t.length.value.status !== UNKNOWN ? [t.length.value.value] : []);
      const inList = vals.filter((v) => opts.includes(v));
      const out = vals.filter((v) => !opts.includes(v));
      checks.push(h('li', {}, `Lengths: ${fmtStandard(offer.standard)} lists ${opts.length ? opts.join(', ') : 'none'}. `,
        vals.length ? `Of your ${vals.length} selected: ${inList.length ? inList.join(', ') + ' listed' : 'none listed'}`
          + (out.length ? `; ${out.join(', ')} not listed - would be saved as Custom.` : '.') : 'No lengths selected yet.'));
    }
    checks.push(h('li', {}, `Head (${headLabel(t)}) and thread (${threadText(t)}) stay as chosen.`));
  }
  return h('div', { class: 'panel' }, statusChip(null, { suggested: true }),
    h('p', {}, `${dname} is not the drive ${from} specifies, so ${from} is no longer attached. `,
      h('b', {}, offer.label), ` pairs this head with ${dname} (pairing from our own tables, ${offer.tier}).`),
    after ? h('div', {}, h('div', { class: 'muted' }, `If you use ${fmtStandard(offer.standard)}, recheck:`), h('ul', {}, checks)) : null,
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn primary', onclick: () => { state.template = P.acceptOffer(T()); afterChange(); setStatus(`${fmtStandard(offer.standard)} attached. Check the lengths below.`, 'ok'); } },
        `Use ${fmtStandard(offer.standard)}`),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.offerKept = true; render(); } }, 'Keep as a custom combination'),
      back));
}

function circlePx(d) { return Math.round(Math.min(56, 6 + 11 * Math.log(d + 1))); }
function threadButton(o, on, onClick, check) {
  const d = typeof o.value === 'number' ? o.value : (o.major_in || 0.2) * 25.4;   // an inch size is drawn at its major diameter
  return h('button', { type: 'button', class: `thr ${on ? 'on' : ''}`, 'aria-pressed': String(on), onclick: onClick, title: `${o.label} - ${o.tier}` },
    check ? h('span', { class: 'chk', 'aria-hidden': 'true' }, on ? '✓' : '') : null,
    h('span', { class: 'circ', 'aria-hidden': 'true', style: `width:${circlePx(d)}px;height:${circlePx(d)}px` }),
    h('span', { class: 'tl mono' }, o.label));
}
// Metric or inch (2026-10-05). Switching starts the thread and the lengths over - nothing is converted, so an M6 never
// becomes a 1/4-20 and a 25 mm length never becomes 1" - and clears the ticked lengths for the same reason.
function systemRow(key) {
  const t = T();
  if (!fam().units) return null;
  const uni = isUnified(t);
  // 2026-10-05: nuts and washers too. A washer is a size designation alone (#10, 1/4) - no threads per inch, no length
  const washer = t.family === 'washer';
  const lengths = !!t.length;
  const go = (value) => {
    if ((value === 'unified') === uni) return;
    state.sel = [];
    apply(key, 'thread.system', { mode: LISTED, value });
    setStatus(value === 'unified' ? (washer ? 'Inch size: pick the size (#10, 1/4 ...).'
      : `Inch thread: pick the size, then the threads per inch.${lengths ? ' Lengths are in inches.' : ''}`) : 'Metric.', 'ok');
  };
  return h('div', { class: 'row wrap' }, h('span', { class: 'muted' }, 'Units '),
    textBtn({ label: 'Metric (M)', on: !uni, onClick: () => go('metric') }),
    textBtn({ label: washer ? 'Inch (#10, 1/4 ...)' : 'Inch (UNC / UNF)', on: uni, onClick: () => go('unified') }),
    h('span', { class: 'muted small' }, uni ? ` switching back starts the ${washer ? 'size' : 'thread'}${lengths ? ' and lengths' : ''} over`
      : (washer ? ' an inch washer is its size, e.g. #10 or 1/4' : ' an inch thread is size-TPI, e.g. #10-24')));
}
function threadSection(key, idx) {
  const t = T();
  const info = P.optionsFor(t, 'thread.diameter');
  const f = t.thread.diameter;
  const uni = isUnified(t);
  return sectionEl(key, idx, 'Thread', uni ? 'inch sizes; circles are an illustration of relative size, not a gauge' : 'circles are an illustration of relative size, not a gauge',
    systemRow(key),
    h('div', { class: `thr-row${uni ? ' inch' : ''}` }, info.options.map((o) => threadButton(o, f.status === LISTED && f.value === o.value, () => pick(key, 'thread.diameter', o.value))),
      stateButtons(key, 'thread.diameter', { numeric: !uni })),
    customBox(key, 'thread.diameter', uni ? 'Thread size (inch)' : 'Thread diameter (mm)', !uni));
}

// nuts, washers, inserts: the batch varies the thread size (single choice while editing one part)
function sizesSection(key, idx, title) {
  const t = T();
  const info = P.optionsFor(t, 'thread.diameter');
  const vals = info.options.map((o) => o.value);
  const uni = isUnified(t);
  const row = `thr-row${uni ? ' inch' : ''}`;
  if (!batching()) {
    const f = t.thread.diameter;
    return sectionEl(key, idx, title, 'one part', systemRow(key),
      h('div', { class: row }, info.options.map((o) => threadButton(o, f.status === LISTED && f.value === o.value, () => pick(key, 'thread.diameter', o.value))),
        stateButtons(key, 'thread.diameter', { numeric: !uni })),
      customBox(key, 'thread.diameter', uni ? `${title} (inch)` : title, !uni));
  }
  const off = state.sel.filter((v) => !vals.includes(v));
  const offLabel = (v) => (uni ? String(v) : `M${fmtNum(v)}`);
  const body = [systemRow(key), h('div', { class: row },
    info.options.map((o) => threadButton(o, state.sel.includes(o.value), () => toggleSel(o.value), true)),
    off.map((v) => h('button', { type: 'button', class: 'thr on off', 'aria-pressed': 'true', title: 'not listed for this type: saved as Custom. Click to remove.', onclick: () => toggleSel(v) },
      h('span', { class: 'chk' }, '✓'), h('span', { class: 'tl mono' }, offLabel(v)), h('span', { class: 'ts' }, 'custom'))))];
  body.push(selTools(key, 'size', vals));
  if (off.length) body.push(h('div', { class: 'note' }, `Not listed for this type: ${off.map(offLabel).join(', ')} - saved as Custom.`));
  if (vals.length && PER_SIZE.some((p) => fam().paths.some((d) => d.path === p))) {
    body.push(h('div', { class: 'note' }, `${uni ? (t.thread.tpi === null ? 'Dimensions are' : 'Threads per inch (UNC first), wrench size and dimensions are')
      : 'Pitch (coarse), wrench size and dimensions are'} filled per part from the data - see each row under Will add.`));
  }
  return sectionEl(key, idx, title, 'tick several - one part each', ...body);
}

// All / None / your own value, for a batch
function selTools(section, noun, vals) {
  const box = h('input', { type: 'text', inputmode: 'decimal', 'data-custom': `sel:${section}`, 'aria-label': `your own ${noun}`,
    maxlength: String(CUSTOM_TEXT_MAX), placeholder: noun === 'length' ? (isUnified(T()) ? 'your own length, e.g. 5/8' : 'your own length, e.g. 33') : 'your own size, e.g. 5.5' });
  const add = () => { if (box.value.trim() && addCustomSel(box.value, noun === 'length' ? 'Length' : 'Size')) { state.section = section; render(); focusCustom(`sel:${section}`); } };
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  return h('div', { class: 'row tools' },
    h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { state.sel = [...new Set([...state.sel, ...vals])].sort((a, b) => a - b); state.section = section; render(); } }, 'All'),
    h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { state.sel = []; state.section = section; render(); } }, 'None'),
    h('span', { class: 'spacer' }), box, h('button', { type: 'button', class: 'btn sm', onclick: add }, `Add ${noun}`));
}

function tpiSection(key, idx) {
  const t = T();
  const info = P.optionsFor(t, 'thread.tpi');
  const f = t.thread.tpi;
  const btn = (o) => h('button', { type: 'button', class: `pitch ${f.status === LISTED && f.value === o.value ? 'on' : ''}`,
    'aria-pressed': String(f.status === LISTED && f.value === o.value), onclick: () => pick(key, 'thread.tpi', o.value), title: `${o.tier}: ${o.ref}` },
    h('span', { class: 'tg', html: glyph(o.series === 'UNF' ? 'fine' : 'coarse', 28) }),
    h('span', {}, `${o.series || 'other'} `, h('span', { class: 'mono' }, `${o.value} TPI`)));
  const body = [h('div', { class: 'row wrap' }, info.options.map(btn), stateButtons(key, 'thread.tpi', { numeric: true }))];
  if (info.reason) body.push(h('div', { class: 'note' }, info.reason));
  body.push(customBox(key, 'thread.tpi', 'Threads per inch', true));
  if (f.status !== UNKNOWN) body.push(h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Threads per inch '), statusChip(f),
    t.thread.series.status !== UNKNOWN ? h('span', { class: 'muted' }, ` · ${t.thread.series.value}`) : h('span', { class: 'muted' }, ' · series Unknown (a custom TPI is not given a series)')));
  return sectionEl(key, idx, 'Threads per inch', 'UNC (coarse) is the usual default', ...body);
}
function pitchSection(key, idx) {
  const t = T();
  if (isUnified(t)) return tpiSection(key, idx);
  const info = P.optionsFor(t, 'thread.pitch');
  const f = t.thread.pitch;
  const btn = (o) => h('button', { type: 'button', class: `pitch ${f.status === LISTED && f.value === o.value ? 'on' : ''}`,
    'aria-pressed': String(f.status === LISTED && f.value === o.value), onclick: () => pick(key, 'thread.pitch', o.value), title: `${o.tier}: ${o.ref}` },
    h('span', { class: 'tg', html: glyph(o.pitch_class === 'fine' ? 'fine' : 'coarse', 28) }),
    h('span', {}, o.pitch_class === 'fine' ? 'fine ' : 'coarse ', h('span', { class: 'mono' }, fmtNum(o.value))));
  const coarse = info.options.filter((o) => o.group === 'coarse');
  const sel = info.options.filter((o) => o.group === 'iso262');
  const more = info.options.filter((o) => o.group === 'more');
  const body = [h('div', { class: 'row wrap' }, coarse.map(btn), sel.map(btn),
    more.length && !state.moreFine ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { state.moreFine = true; render(); } }, `More fine pitches (${more.length})`) : null,
    state.moreFine ? more.map(btn) : null, stateButtons(key, 'thread.pitch', { numeric: true }))];
  if (info.reason) body.push(h('div', { class: 'note' }, info.reason));
  body.push(customBox(key, 'thread.pitch', 'Pitch (mm)', true), ...notes(info));
  if (f.status !== UNKNOWN) body.push(h('div', { class: 'row' }, h('span', { class: 'muted' }, 'Pitch '), statusChip(f)));
  return sectionEl(key, idx, 'Pitch', 'coarse is the usual default', ...body);
}

function lengthsSection(key, idx) {
  const t = T();
  const info = P.optionsFor(t, 'length.value');
  const opts = info.options;
  const vals = opts.map((o) => o.value);
  const maxL = Math.max(1, ...vals, ...state.sel);
  const bar = (v, on) => h('span', { class: `bar ${on ? 'on' : ''}`, 'aria-hidden': 'true', style: `width:${Math.max(6, Math.round((v / maxL) * 100))}%` });
  const stdName = fmtStandard(t.standard || t.table_basis);
  const body = [];
  if (!batching()) {
    const f = t.length.value;
    body.push(h('div', { class: `len-grid${isUnified(t) ? ' inch' : ''}` }, opts.map((o) => {
      const on = f.status === LISTED && f.value === o.value;
      return h('button', { type: 'button', class: `len ${on ? 'on' : ''}`, 'aria-pressed': String(on), onclick: () => pick(key, 'length.value', o.value), title: `${o.tier}` },
        h('span', { class: 'mono' }, fmtLen(t, o.value)), bar(o.value, on));
    })), h('div', { class: 'row' }, stateButtons(key, 'length.value', { numeric: true })), customBox(key, 'length.value', isUnified(t) ? 'Length (inches)' : 'Length (mm)', true));
  } else {
    const off = state.sel.filter((v) => !vals.includes(v));
    body.push(h('div', { class: `len-grid${isUnified(t) ? ' inch' : ''}` },
      opts.map((o) => {
        const on = state.sel.includes(o.value);
        return h('button', { type: 'button', class: `len ${on ? 'on' : ''}`, 'aria-pressed': String(on), onclick: () => toggleSel(o.value), title: `${o.tier}` },
          h('span', { class: 'chk', 'aria-hidden': 'true' }, on ? '✓' : ''), h('span', { class: 'mono' }, fmtLen(t, o.value)), bar(o.value, on));
      }),
      off.map((v) => h('button', { type: 'button', class: 'len on off', 'aria-pressed': 'true', onclick: () => toggleSel(v), title: 'not listed here: saved as Custom. Click to remove.' },
        h('span', { class: 'chk' }, '✓'), h('span', { class: 'mono' }, fmtLen(t, v)), h('span', { class: 'ts' }, 'custom')))),
    selTools(key, 'length', vals));
    if (off.length) {
      body.push(h('div', { class: 'note' }, `Not in our reference list${stdName ? ' (bd_warehouse lengths for ' + stdName + ' ' + threadText(t) + ')' : ''}: ${off.map((v) => fmtLen(t, v)).join(', ')} - saved as Custom. That says nothing about whether the standard lists it. `,
        h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { state.sel = state.sel.filter((v) => vals.includes(v)); render(); } }, 'Remove these')));
    }
  }
  if (opts.length) body.push(h('div', { class: 'note' }, `Our reference list${stdName ? ' for ' + stdName : ''} ${threadText(t)} (bd_warehouse) - the library's coverage, not every length made or listed by the standard.`
    + (info.note ? ' ' + info.note + '.' : '')));
  else body.push(h('div', { class: 'note' }, info.note || 'No listed lengths for this selection: add your own.'));
  body.push(...notes(info));
  return sectionEl(key, idx, 'Lengths', batching() ? 'tick several - one part each · bars show relative length' : 'one part', ...body);
}

function choiceSection(key, idx, title, path, hint, labelOf = (o) => o.label) {
  const t = T();
  const info = P.optionsFor(t, path);
  const f = getPath(t, path);
  const def = fam().paths.find((d) => d.path === path);
  return sectionEl(key, idx, title, hint,
    h('div', { class: 'row wrap' }, info.options.map((o) => textBtn({ label: labelOf(o), on: f.status === LISTED && f.value === o.value, onClick: () => pick(key, path, o.value) })),
      stateButtons(key, path)),
    customBox(key, path, title, !!(def && def.numeric)), ...suggestionRows(key, path),
    info.note ? h('div', { class: 'note' }, info.note) : null,
    f.status !== UNKNOWN ? h('div', { class: 'row' }, statusChip(f)) : null);
}

function materialSection(key, idx, only = null) {
  const t = T();
  const row = (label, path, hint) => {
    if (only && !only.includes(path)) return null;
    const info = P.optionsFor(t, path);
    if (!info.enabled) return null;
    const f = getPath(t, path);
    let options = info.options; let note = null;
    if (path === 'material.colour') {
      // Jerrari 2026-10-08: offer only the colours that pick a picture (nylon; anodized aluminium). The record still
      // accepts any colour - this narrows the screen only. A colour already held stays visible, so nothing hidden
      // goes on affecting the picture or the label.
      const want = pictureColours(t.material);
      options = info.options.filter((o) => want.includes(o.value) || (f.status === LISTED && f.value === o.value));
      if (!want.length && f.status === UNKNOWN && state.customOpen !== path) {
        return h('div', { class: 'mat-row' }, h('div', { class: 'mat-lab' }, label),
          h('div', { class: 'muted' }, 'offered for nylon and anodized aluminium - the colours that have pictures'));
      }
      // say so only when the colour is what keeps a picture away (brass + yellow); a colour that changes nothing
      // (zinc + clear/blue), or whose picture would be the reference steel anyway (12.9), just stays visible
      const without = presetFor({ ...t.material, colour: { status: UNKNOWN, value: null } });
      if (f.status !== UNKNOWN && presetFor(t.material) === null && without !== null && without !== 'steel') {
        note = 'This colour has no picture for this material, so the picture shows the reference finish. Choose Unknown to clear it.';
      }
    }
    return h('div', { class: 'mat-row' }, h('div', { class: 'mat-lab' }, label, hint ? h('span', { class: 'muted' }, hint) : null),
      h('div', { class: 'row wrap' }, options.map((o) => textBtn({ label: String(o.label), on: f.status === LISTED && f.value === o.value, onClick: () => pick(key, path, o.value) })),
        stateButtons(key, path), f.status !== UNKNOWN ? statusChip(f) : null),
      note ? h('div', { class: 'note' }, note) : null,
      customBox(key, path, label, false));
  };
  return sectionEl(key, idx, 'Material', only ? 'kept when you switch family' : 'separate fields - none is inferred from another (black is not black oxide); kept when you switch family',
    row('Base', 'material.base'), row('Stainless group', 'material.stainless_group'),
    row('Grade / property class', 'material.property_class', ' steel 4.8-12.9 · stainless 50/70/80'), row('Finish / treatment', 'material.finish'),
    row('Colour', 'material.colour', ' as read off the part or package'));
}

// ---- generic sections for the vocabulary families (2026-10-04)
// a batch over any vocabulary field (fitting tube sizes, rivet lengths); one part while editing
function batchSection(e, idx) {
  const t = T();
  const info = P.optionsFor(t, e.path);
  const vals = info.options.map((o) => o.value);
  const u = e.unit ? ` ${e.unit}` : '';
  if (!batching()) return choiceSection(e.key, idx, e.title, e.path, 'one part', (o) => o.label + u);
  const off = state.sel.filter((x) => !vals.includes(x));
  const body = [h('div', { class: 'row wrap' },
    info.options.map((o) => textBtn({ label: o.label + u, on: state.sel.includes(o.value), check: true, onClick: () => toggleSel(o.value, e.key) })),
    off.map((x) => textBtn({ label: `${fmtNum(x)}${u} (custom)`, on: true, check: true, cls: 'off', title: 'not in the list - saved as Custom. Click to remove.',
      onClick: () => toggleSel(x, e.key) })))];
  body.push(selTools(e.key, e.noun === 'lengths' ? 'length' : 'size', vals));
  if (off.length) body.push(h('div', { class: 'note' }, `Not in the list: ${off.map(fmtNum).join(', ')}${u} - saved as Custom.`));
  return sectionEl(e.key, idx, e.title, e.hint || 'tick several - one part each', ...body);
}
// rivet grip range: two typed numbers, never derived from the body length (design review)
function gripSection(e, idx) {
  const t = T();
  if (batching() && state.sel.length > 1) {
    return sectionEl(e.key, idx, e.title, e.hint, h('div', { class: 'note' },
      `${state.sel.length} lengths are ticked, and each length has its own grip range: add them, then set the grip on each part (Edit in the list).`));
  }
  const one = (path, label) => {
    const f = getPath(t, path);
    const inp = h('input', { type: 'text', inputmode: 'decimal', class: 'num', 'aria-label': `grip range ${label}`, placeholder: label,
      maxlength: String(CUSTOM_TEXT_MAX), value: f.status === UNKNOWN ? '' : String(f.value) });
    inp.addEventListener('change', () => {
      const txt = inp.value.trim();
      if (!txt) { apply(e.key, path, { mode: UNKNOWN }); return; }
      if (parseNumber(txt) === null) { setStatus(`Grip ${label}: "${txt}" is not a number.`, 'err'); return; }
      apply(e.key, path, { mode: CUSTOM, value: txt });
    });
    return h('label', { class: 'grip' }, h('span', { class: 'muted' }, label), inp, h('span', { class: 'muted' }, 'mm'), f.status !== UNKNOWN ? statusChip(f) : null);
  };
  return sectionEl(e.key, idx, e.title, e.hint, h('div', { class: 'row wrap' }, one('specific.rivet.grip_min', 'min'), h('span', { class: 'muted' }, 'to'), one('specific.rivet.grip_max', 'max')));
}
// a phone photo, downscaled to 320 px JPEG so it can live in the record (and export with it)
function readPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 320 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}
// the record's own details: name, package text, dimensions, supplier, part number, collections, photo (every family)
function detailsSection(e, idx) {
  const t = T(); const m = t.meta || {};
  const isOther = t.family === 'other';
  // typing does not re-render the builder (focus would jump); only the summary card follows
  const quiet = (changes) => { state.template = P.setMeta(T(), changes); state.section = e.key; save(); renderSide(); };
  const loud = (changes) => { state.template = P.setMeta(T(), changes); state.section = e.key; afterChange(); };
  const field = (label, val, onSet, ph, wide) => {
    const i = h(wide ? 'textarea' : 'input', { type: wide ? null : 'text', rows: wide ? 2 : null, placeholder: ph, 'aria-label': label });
    i.value = val || '';
    i.addEventListener('change', () => onSet(i.value));
    return h('label', { class: 'dl' }, h('span', { class: 'dl-k' }, label), i);
  };
  const metaSet = (k) => (val) => quiet({ meta: { ...(T().meta || {}), [k]: val } });
  const photoIn = h('input', { type: 'file', accept: 'image/*', hidden: true });
  photoIn.addEventListener('change', async () => {
    const file = photoIn.files[0]; if (!file) return;
    try { loud({ photo: await readPhoto(file) }); } catch { setStatus('Could not read that image.', 'err'); }
  });
  const tagsIn = h('input', { type: 'text', placeholder: 'e.g. 3D printer, Voron', 'aria-label': 'Collections' });
  tagsIn.value = (t.tags || []).join(', ');
  tagsIn.addEventListener('change', () => loud({ tags: tagsIn.value.split(',') }));
  const known = [...new Set(state.records.flatMap((r) => r.tags || []))].filter((x) => !(t.tags || []).includes(x));
  return sectionEl(e.key, idx, isOther ? 'The part' : e.title,
    isOther ? 'save it now and give it a family later - it keeps its id, name and photo'
      : 'optional - shared by every part in this batch; cleared after Add, except collections',
    h('div', { class: 'details' },
      h('div', { class: 'photo-box' },
        t.photo ? h('img', { class: 'photo', src: t.photo, alt: 'photo of the part', width: 160, height: 160 })
          : h('div', { class: 'photo none', html: glyph(primaryGlyph(t), 64) }),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn sm', onclick: () => photoIn.click() }, t.photo ? 'Replace photo' : 'Add a photo'),
          t.photo ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => loud({ photo: null }) }, 'Remove') : null),
        photoIn),
      h('div', { class: 'dl-grid' },
        field(isOther ? 'Name' : 'Name (optional)', t.label, (val) => quiet({ label: val }), isOther ? 'what you call it, e.g. "blue push fitting"' : 'e.g. "Voron frame screws"'),
        field('Package text', m.package_text, metaSet('package_text'), 'copy what the bag says', true),
        field('Dimensions', m.dimensions, metaSet('dimensions'), 'anything you measured'),
        field('Supplier', m.supplier, metaSet('supplier'), 'shop or brand'),
        field('Supplier part number', m.supplier_part, metaSet('supplier_part'), 'from the label'),
        h('label', { class: 'dl' }, h('span', { class: 'dl-k' }, 'Collections'), tagsIn),
        known.length ? h('div', { class: 'row wrap' }, h('span', { class: 'muted small' }, 'used before:'),
          known.map((k) => h('button', { type: 'button', class: 'btn sm ghost', onclick: () => loud({ tags: [...(T().tags || []), k] }) }, '+ ' + k))) : null)));
}

// every other field of the family, as compact menus
function detailSection() {
  const t = T();
  if (NEW_FAMILIES.has(t.family)) return null;   // the vocabulary families draw every field in their own sections
  // a field the record does not carry is not drawn: an inch record has no pitch class, a metric one no thread series
  const defs = fam().paths.filter((d) => !SECTION_PATHS.has(d.path) && getPath(t, d.path)
    && !(['screw', 'setscrew'].includes(t.family) && ['drive.type', 'thread.pitch'].includes(d.path))
    && !(batching() && varyPath() === 'thread.diameter' && PER_SIZE.includes(d.path)));
  if (!defs.length) return null;
  const det = h('details', { class: 'more', open: state.moreOpen || null });
  det.addEventListener('toggle', () => { state.moreOpen = det.open; });
  det.append(h('summary', {}, `More detail (${defs.length})`, h('span', { class: 'muted' }, ' - tool size, datum and the like; prefilled from the standard where the data is documented or verified')));
  for (const d of defs) det.append(detailField(d));
  return det;
}
function detailField(def) {
  const t = T();
  const f = getPath(t, def.path);
  const info = P.optionsFor(t, def.path);
  const sel = h('select', { disabled: !info.enabled || null, 'aria-label': def.label });
  sel.append(h('option', { value: '' }, 'Unknown'));
  for (const o of info.options) sel.append(h('option', { value: String(o.value) }, o.label + (o.tier !== 'documented' && o.tier !== 'verified' ? ` [${o.tier}]` : '')));
  sel.append(h('option', { value: '__custom' }, 'Custom…'));
  sel.value = f.status === CUSTOM || state.customOpen === def.path ? '__custom' : f.status === LISTED ? String(f.value) : '';
  sel.addEventListener('change', () => {
    if (sel.value === '') apply('more', def.path, { mode: UNKNOWN });
    else if (sel.value === '__custom') { state.customOpen = def.path; render(); focusCustom(def.path); }
    else { const o = info.options.find((x) => String(x.value) === sel.value); pick('more', def.path, o ? o.value : sel.value); }
  });
  return h('div', { class: 'det' }, h('label', { class: 'det-lab' }, def.label), sel, statusChip(f),
    info.reason ? h('span', { class: 'muted' }, info.reason) : null,
    customBox('more', def.path, def.label, def.numeric), ...suggestionRows('more', def.path), ...notes(info));
}

// ------------------------------------------------------------------ summary strip (C's tokens, used as navigation)
function tokens() {
  const t = T();
  const list = [{ key: 'family', k: 'FAMILY', v: FAMILY_LABEL[t.family], g: FAMILY_GLYPH[t.family], st: null }];
  const sel = state.sel;
  const vopts = (() => { try { return varyOptions(); } catch { return []; } })();
  // a batch token reads Listed only when every ticked value is in the menu, with the weakest tier among them
  const RANK = ['documented', 'verified', 'single', 'unverified', 'conflict'];
  const batchSt = () => {
    if (!sel.length) return { status: UNKNOWN };
    const os = sel.map((v) => vopts.find((o) => o.value === v));
    if (os.some((o) => !o)) return { status: CUSTOM };
    const tier = os.map((o) => o.tier).sort((a, b) => RANK.indexOf(b) - RANK.indexOf(a))[0];
    return { status: LISTED, source: { tier } };
  };
  for (const entry of PLAN[t.family]) {
    let v = null; let st = null; let g = null;
    if (!Array.isArray(entry)) {                       // the generic entries (vocabulary families, and Details everywhere)
      const e = entry;
      if (e.kind === 'details') {
        if (t.family === 'other' || t.label || t.photo) list.push({ key: e.key, k: 'NAME', v: t.label || (t.photo ? 'photo only' : null), st: null, g: null });
        continue;
      }
      const u = e.unit ? ` ${e.unit}` : '';
      if (e.kind === 'head') { v = headLabel(t); st = t.head; g = t.head.status === LISTED ? headGlyph(t.family, t.head.value) : null; }
      else if (e.kind === 'batch' && batching()) { v = sel.length ? (sel.length <= 3 ? sel.map((x) => fmtNum(x) + u).join(', ') : `${sel.length} ${e.noun}`) : null; st = batchSt(); }
      else if (e.kind === 'batch' || e.kind === 'choice') { v = fieldText(t, e.path, e.unit); st = getPath(t, e.path); }
      else if (e.kind === 'sizes' && batching()) { v = sel.length ? (sel.length <= 3 ? sel.map(selSize).join(', ') : `${sel.length} sizes`) : null; st = batchSt(); }
      else if (e.kind === 'sizes') { v = t.thread.diameter.status === UNKNOWN ? null : threadText(t); st = t.thread.diameter; }
      else if (e.kind === 'grip') {
        const a = fieldText(t, 'specific.rivet.grip_min'); const b = fieldText(t, 'specific.rivet.grip_max');
        v = a || b ? `${a || '?'}–${b || '?'} mm` : null; st = getPath(t, a ? 'specific.rivet.grip_min' : 'specific.rivet.grip_max');
      } else if (e.kind === 'material') { v = [fieldText(t, 'material.base'), fieldText(t, 'material.finish'), fieldText(t, 'material.colour')].filter(Boolean).join(' · ') || null; st = t.material.base; }
      list.push({ key: e.key, k: e.title.toUpperCase(), v, st, g });
      continue;
    }
    const [key, title] = entry;
    switch (key) {
      case 'head': v = headLabel(t); st = t.head; g = t.head.status === LISTED ? headGlyph(t.family, t.head.value) : null; break;
      case 'point': v = t.specific.point_type.status === UNKNOWN ? null : String(t.specific.point_type.value); st = t.specific.point_type; g = POINT_GLYPH[t.specific.point_type.value] || null; break;
      case 'drive': v = driveLabel(t.drive.type); st = t.drive.type; g = DRIVE_GLYPH[t.drive.type.value] || null; break;
      case 'thread': v = t.thread.diameter.status === UNKNOWN ? null : threadText(t); st = t.thread.diameter; break;
      case 'pitch':
        if (isUnified(t) && t.thread.tpi) {
          v = t.thread.tpi.status === UNKNOWN ? null : `${t.thread.tpi.value} TPI${t.thread.series.status !== UNKNOWN ? ' ' + t.thread.series.value : ''}`;
          st = t.thread.tpi; g = t.thread.series.value === 'UNF' ? 'fine' : 'coarse';
          list.push({ key, k: 'TPI', v, st, g }); continue;
        }
        v = t.thread.pitch.status === UNKNOWN ? null : `${fmtNum(t.thread.pitch.value)}${t.thread.pitch_class.status === LISTED ? ' ' + t.thread.pitch_class.value : ''}`; st = t.thread.pitch; g = fine(t) ? 'fine' : 'coarse'; break;
      case 'lengths':
        if (batching()) { v = sel.length ? (sel.length <= 4 ? sel.map((x) => fmtLen(t, x)).join(', ') : `${sel.length} lengths`) : null; st = batchSt(); }
        else { v = t.length.value.status === UNKNOWN ? null : fmtLen(t, t.length.value.value); st = t.length.value; }
        g = 'length'; break;
      case 'sizes':
        if (batching()) { v = sel.length ? (sel.length <= 3 ? sel.map(selSize).join(', ') : `${sel.length} sizes`) : null; st = batchSt(); }
        else { v = t.thread.diameter.status === UNKNOWN ? null : threadText(t); st = t.thread.diameter; }
        break;
      case 'extent': v = t.specific.thread_extent.status === UNKNOWN ? null : String(t.specific.thread_extent.value); st = t.specific.thread_extent; break;
      case 'locking': v = t.specific.locking_feature.status === UNKNOWN ? null : String(t.specific.locking_feature.value); st = t.specific.locking_feature; break;
      case 'brand': v = t.specific.insert.brand_dataset.status === UNKNOWN ? null : String(t.specific.insert.brand_dataset.value); st = t.specific.insert.brand_dataset; break;
      case 'material': v = materialText(t) || null; st = t.material.base; break;
      default: break;
    }
    list.push({ key, k: title.toUpperCase(), v, st, g });
  }
  if (!NEW_FAMILIES.has(t.family)) {
    list.push({ key: 'material', sub: 'finish', k: 'FINISH', v: t.material.finish.status === UNKNOWN ? null : String(t.material.finish.value), st: t.material.finish, g: null });
    if (t.material.colour && t.material.colour.status !== UNKNOWN) list.push({ key: 'material', sub: 'colour', k: 'COLOUR', v: String(t.material.colour.value), st: t.material.colour, g: null });
  }
  return list;
}
function tokenStrip() {
  const wrap = h('nav', { class: 'tokens', 'aria-label': 'Part so far - choose a field to change it' });
  for (const tk of tokens()) {
    const editing = state.section === tk.key && !tk.sub;
    const btn = h('button', { type: 'button', class: `tok ${editing ? 'editing' : ''} ${tk.v ? 'set' : 'empty'}`, 'aria-current': editing ? 'true' : null,
      onclick: () => goSection(tk.key) },
      tk.g ? h('span', { class: 'tg', html: glyph(tk.g, 28) }) : h('span', { class: 'tg blank' }),
      h('span', { class: 'tk' }, h('span', { class: 'tk-k' }, tk.k, editing ? h('span', { class: 'tk-edit' }, ' · editing') : null),
        h('span', { class: 'tk-v', title: tk.v || null }, tk.v || '-'),
        tk.st && tk.key !== 'family' ? statusChip(tk.st) : null));
    wrap.append(btn);
  }
  return wrap;
}
function goSection(key) {
  state.section = key;
  render();
  const el = $(`sec-${key}`);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); const b = el.querySelector('button, input, select'); if (b) setTimeout(() => b.focus({ preventScroll: true }), 300); }
}

// ------------------------------------------------------------------ part summary + will add
function factRow(label, field, text, opts = {}) {
  return h('div', { class: 'fact' }, h('span', { class: 'f-k' }, label), h('span', { class: 'f-v' }, text || (field && field.status === UNKNOWN ? '-' : '')),
    field ? statusChip(field) : null, ...(opts.sugg || []), opts.pin ? pinButton(opts.pin, label) : null);
}
// pin a field to the printed label (2026-10-05): a pinned field must appear, or the label preview reports a non-fit;
// unpinned fields go on while they fit and the preview lists the rest as "Not shown on label". The record keeps every field.
function pinButton(path, label) {
  const t = T(); const on = isPinned(t, path);
  return h('button', { type: 'button', class: `pin ${on ? 'on' : ''}`, 'aria-pressed': String(on),
    title: on ? `${label} is pinned: it must appear on the label` : `Pin ${label.toLowerCase()} to the label`,
    onclick: () => { state.template = P.setMeta(t, { label_pins: togglePin(t, path) }); save(); render(); } }, on ? 'pinned' : 'pin');
}
function summaryCard() {
  const t = T();
  const perSize = batching() && varyPath() === 'thread.diameter';
  const g1 = primaryGlyph(t); const g2 = secondaryGlyph(t);
  const n = batching() ? state.sel.length : 1;
  const entryOf = PLAN[t.family].find((x) => !Array.isArray(x) && x.kind === 'batch');
  let headline;
  if (NEW_FAMILIES.has(t.family)) {
    const noun = entryOf ? entryOf.noun : 'sizes';
    headline = t.family === 'other' ? (t.label || 'Other part') : (batching() && n > 1 ? `${n} ${noun} selected` : shortSpec(previews()[0]));
  } else if (varyPath() === 'length.value') {
    headline = threadText(t) + (fine(t) ? ` × ${fmtNum(t.thread.pitch.value)}` : '')
      + (batching() ? (n > 1 ? ` · ${n} lengths selected` : n === 1 ? ` × ${fmtLen(t, state.sel[0])}` : ' × ?') : ` × ${t.length.value.status === UNKNOWN ? '?' : fmtLen(t, t.length.value.value)}`);
  } else {
    headline = batching() ? (n > 1 ? `${n} sizes selected` : n === 1 ? selSize(state.sel[0]) : (isUnified(t) ? '?' : 'M?')) : threadText(t);
  }
  const card = h('section', { class: 'card summary', 'aria-label': 'Part summary' });
  card.append(h('div', { class: 'card-k' }, 'PART SUMMARY', h('span', { class: 'muted' }, ' - what will be saved, not the printed label')));
  // the picture follows what will be SAVED: with lengths or sizes selected, the first record the batch will add
  const pic = t.photo ? null : HW.resolve(previews()[0] || t);
  card.append(h('div', { class: 'glyphs' },
    // the bag's own photo first, then the rendered asset for this record, then the glyph
    t.photo ? h('img', { class: 'gimg', src: t.photo, alt: 'photo of the part', width: 152, height: 152 })
      : hasPic(pic) ? h('img', { class: `gimg ${pic.exact ? '' : 'approx'}${pic.kind === 'illustration' ? ' illus' : ''}`, src: pic.src, alt: '', width: 152, height: 152, title: picTitle(pic) })
        : h('span', { class: 'gbox', html: glyph(g1, 76) }),
    g2 ? h('span', { class: 'gbox', html: glyph(g2, 76) }) : null));
  if (pic) {                 // one visible line naming every difference - or, when no picture would be honest, why not;
    //                          the standard, geometry, checks and the full sentence behind "Source"
    card.append(h('div', { class: 'imgcap muted' }, h('div', { class: 'picshort' }, pic.short || pic.caption),
      hasPic(pic) && pic.details && pic.details.length
        ? h('details', { class: 'picsrc' }, h('summary', {}, 'Source'), ...pic.details.map((x) => h('div', {}, x))) : null,
      n > 1 ? h('div', {}, `Picture: the first of ${n} selected`) : null));
  }
  card.append(h('div', { class: 'headline mono' }, headline));
  card.append(h('div', { class: 'typeline' }, t.family === 'other' ? 'Other part - give it a family later from the list'
    : [headLabel(t, false) || `${FAMILY_LABEL[t.family]} - type unknown`, stdText(t)].filter(Boolean).join(' · '),
    t.family === 'other' ? null : pinButton('head', 'Type')));
  const facts = h('div', { class: 'facts' });
  if (NEW_FAMILIES.has(t.family)) {          // every typed field, by its own label (the batch field shows in Will add)
    for (const d of fam().paths) {
      if (d.path === 'head' || (batching() && d.path === varyPath())) continue;
      const e = PLAN[t.family].find((x) => !Array.isArray(x) && x.path === d.path);
      // a data family's units come from its own field data: a thread reads M6 and a position count 4, never "mm"
      const dfd = DATA_FAMILY.get(t.family); const ff = dfd ? dfd.fields.find((x) => x.path === d.path) : null;
      const unit = dfd ? (ff ? ff.unit : undefined) : (d.numeric ? 'mm' : (e && e.unit));
      facts.append(factRow(d.label.replace(/ \(mm\)$/, ''), getPath(t, d.path), fieldText(t, d.path, unit), { pin: d.path }));
    }
    const mm = t.meta || {};
    for (const [k, lbl] of [['package_text', 'Package'], ['supplier', 'Supplier'], ['supplier_part', 'Part no.']]) if (mm[k]) facts.append(factRow(lbl, null, mm[k]));
    if (t.tags && t.tags.length) facts.append(factRow('Collections', null, t.tags.join(', ')));
    card.append(facts);
    return summaryTail(card);
  }
  const sugg = (path) => P.suggestions(t).filter((s) => s.path === path).map((s) =>
    h('button', { type: 'button', class: 'btn sm', title: `${s.tier}${s.hint ? ' - ' + s.hint : ''}`, onclick: () => { state.template = P.acceptSuggestion(T(), path, s.value); afterChange(); } }, `Use ${suggText(s)}`));
  if (t.drive && ['screw', 'setscrew'].includes(t.family)) {
    facts.append(factRow('Drive', t.drive.type, driveLabel(t.drive.type), { pin: 'drive.type' }));
    facts.append(factRow('Tool', t.drive.tool_size, toolText(t), { sugg: sugg('drive.tool_size') }));
  }
  if (t.thread.pitch && !perSize) facts.append(factRow('Pitch', t.thread.pitch, t.thread.pitch.status === UNKNOWN ? null : `${fmtNum(t.thread.pitch.value)} mm`));
  if (isUnified(t) && t.thread.tpi) {         // an inch washer has no threads per inch
    facts.append(factRow('TPI', t.thread.tpi, t.thread.tpi.status === UNKNOWN ? null : `${t.thread.tpi.value} threads per inch`, { pin: 'thread.tpi' }));
    facts.append(factRow('Series', t.thread.series, t.thread.series.status === UNKNOWN ? null : String(t.thread.series.value), { pin: 'thread.series' }));
  }
  if (t.family === 'nut') facts.append(factRow('Locking', t.specific.locking_feature, t.specific.locking_feature.status === UNKNOWN ? null : String(t.specific.locking_feature.value), { sugg: sugg('specific.locking_feature'), pin: 'specific.locking_feature' }));
  if (t.family === 'screw') facts.append(factRow('Extent', t.specific.thread_extent, t.specific.thread_extent.status === UNKNOWN ? null : `${t.specific.thread_extent.value} thread`, { pin: 'specific.thread_extent' }));
  if (t.family === 'insert') facts.append(factRow('Brand data', t.specific.insert.brand_dataset, t.specific.insert.brand_dataset.status === UNKNOWN ? null : String(t.specific.insert.brand_dataset.value)));
  const m = t.material;
  facts.append(factRow('Material', m.base, m.base.status === UNKNOWN ? null : String(m.base.value) + (m.stainless_group.status !== UNKNOWN ? ' ' + m.stainless_group.value : ''), { pin: 'material.base' }));
  facts.append(factRow('Grade', m.property_class, m.property_class.status === UNKNOWN ? null : `class ${m.property_class.value}`, { pin: 'material.property_class' }));
  facts.append(factRow('Finish', m.finish, m.finish.status === UNKNOWN ? null : String(m.finish.value), { pin: 'material.finish' }));
  if (m.colour) facts.append(factRow('Colour', m.colour, m.colour.status === UNKNOWN ? null : String(m.colour.value), { pin: 'material.colour' }));
  const mm = t.meta || {};
  for (const [k, lbl] of [['package_text', 'Package'], ['supplier', 'Supplier'], ['supplier_part', 'Part no.']]) if (mm[k]) facts.append(factRow(lbl, null, mm[k]));
  if (t.tags && t.tags.length) facts.append(factRow('Collections', null, t.tags.join(', ')));
  card.append(facts);
  return summaryTail(card);
}
function summaryTail(card) {
  if (T().family !== 'other') {
    card.append(h('div', { class: 'pinnote muted' }, 'Pinned fields must appear on the label: one that does not fit is reported as a non-fit. ',
      'Other fields go on while they fit; the label preview lists the rest as "Not shown on label". The record keeps every field.'));
  }
  // LABEL WORDS (design review 2026-10-05: "Keep the short forms provisional ... Show their full meanings in the editor and
  // allow custom wording"): every field that prints, its printed form beside its full meaning, and the person's own word
  if (T().family !== 'other') {
    const it = labelItem(T(), { describe: describeValue });
    if (it.attributes.length) {
      const rows = it.attributes.map((a) => {
        const def = pathDefOf(T().family, a.path);
        const inp = h('input', { type: 'text', maxlength: String(LABEL_WORD_MAX), value: a.custom ? a.text : '', placeholder: a.custom ? a.proposed : a.text,
          'aria-label': `Label wording for ${def ? def.label.toLowerCase() : a.path} (blank = ${a.custom ? a.proposed : a.text})`,
          onchange: (e) => { state.template = P.setMeta(T(), { label_words: { [a.path]: e.target.value } }); save(); render(); } });
        return h('div', { class: 'lw-row' }, h('span', { class: 'lw-k' }, def ? def.label : a.path),
          h('b', { class: 'lw-t' }, a.text), h('span', { class: 'muted lw-m' }, a.custom ? `your word for ${a.meaning} (proposed: ${a.proposed})` : `= ${a.meaning}`,
            a.wording_note ? h('span', { class: `lw-note ${a.wording}` }, ` - ${a.wording_note}`) : null), inp);
      });
      card.append(h('details', { class: 'lw' }, h('summary', {}, 'Label words - what prints, and your own wording'),
        h('div', { class: 'muted pinnote' }, 'The short forms are proposals. Type your own word to print instead; leave it blank to use the proposal.'),
        ...rows));
    }
    const lc = labelColoursBox(); if (lc) card.append(lc);
  }
  // a family change removed pins this family has no field for (design review 2026-10-05: flag them, never carry them blindly)
  const gone = T().label_pins_removed;
  if (gone && gone.length) {
    const fam = (P.FAMILIES.get(T().family) || {}).label || T().family;
    card.append(h('div', { class: 'pinnote warn', role: 'status' },
      `Unpinned when the part changed family: ${gone.map((g) => g.path).join(', ')} - ${fam} have no such field. `,
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.template = P.setMeta(T(), { label_pins_removed: null }); save(); render(); } }, 'OK')));
  }
  // Will add: one row per part, so a batch can never read as one part spec (design review)
  const recs = previews();
  const add = h('div', { class: 'willadd' }, h('div', { class: 'card-k' }, batching() ? `WILL ADD · ${recs.length}` : 'WILL SAVE'));
  for (const r of recs) add.append(willRow(r));
  card.append(add);
  const vp = varyPath();
  const verb = PLANNER ? 'Queue' : 'Add';   // inside the planner the list is a queue for Add N labels to the planner
  const label = !batching() ? 'Save part' : recs.length > 1 ? `${verb} ${recs.length} parts`
    : (state.sel.length || !vp ? `${verb} 1 part` : `${verb} 1 part (${vp === 'length.value' || vp === 'specific.rivet.length' ? 'length' : 'size'} Unknown)`);
  // inside the Label Studio the one orange button is Add part labels (end-to-end check 2026-10-10: this one only fills the
  // Picker's own list, and read as the next thing to press)
  card.append(h('button', { type: 'button', class: EMBED ? 'btn big' : 'btn primary big', onclick: batching() ? addParts : saveEdit }, label));
  if (!batching()) card.append(h('button', { type: 'button', class: 'btn ghost', onclick: cancelEdit }, 'Cancel editing'));
  card.append(h('div', { id: 'status', class: 'status', role: 'status' }));
  return card;
}
function willRow(r) {
  const vp = varyPath();
  const vf = vp ? getPath(r, vp) : null;
  const tags = [];
  if (NEW_FAMILIES.has(r.family)) {
    tags.push(...tagsNew(r).filter(Boolean));
    const fin = [fieldText(r, 'material.base'), fieldText(r, 'material.finish')].filter(Boolean).join(' ');
    if (fin && r.family !== 'rivet') tags.push(fin);
  } else if (vp === 'thread.diameter') {
    if (r.thread.pitch && r.thread.pitch.status !== UNKNOWN) tags.push(`pitch ${fmtNum(r.thread.pitch.value)}`);
    // an inch wrench size carries its own unit ('7/16 in'); a metric one is a number of mm
    if (r.drive && r.drive.tool_size.status !== UNKNOWN) {
      const v = r.drive.tool_size.value;
      tags.push(typeof v === 'string' && / in$/.test(v) ? `${v} AF` : `${fmtNum(v)} mm AF`);
    }
    if (r.specific.height && r.specific.height.status !== UNKNOWN) tags.push(`height ${fmtNum(r.specific.height.value)} mm`);
    if (r.specific.washer) {
      const w = r.specific.washer; const v = (f) => (f.status === UNKNOWN ? '?' : fmtNum(f.value));
      tags.push(`ID ${v(w.id)} · OD ${v(w.od)} · thickness ${v(w.thickness)} mm`);
    }
  } else {
    const tool = toolText(r); if (tool) tags.push(tool);
  }
  if (!NEW_FAMILIES.has(r.family)) { const mat = materialText(r, true); if (mat) tags.push(mat); }
  const suggs = [...new Set(P.suggestions(r).map((x) => SUGG_NAME[x.path] || x.path))];
  return h('div', { class: 'wrow' },
    h('span', { class: 'wg', html: glyph(primaryGlyph(r), 26) }),
    h('span', { class: 'mono wspec' }, shortSpec(r)),
    h('span', { class: 'wtags' }, tags.join(' · ')),
    vf && vf.status !== LISTED ? statusChip(vf) : null,
    suggs.length ? h('span', { class: 'muted small', title: STATUS_INFO.suggested.def }, `suggested: ${suggs.join(', ')}`) : null);
}

function addParts() {
  const recs = state.sel.length ? expandBatch(P, T(), state.sel) : [(() => { const r = clone(T()); r.id = P.idgen(); return r; })()];
  state.records.push(...recs);
  state.sel = [];
  // name, photo, package text and supplier describe ONE bag: clear them so the next bag cannot inherit them (collections stay)
  if (T().label || T().photo || T().meta) state.template = P.setMeta(T(), { label: null, photo: null, meta: null });
  save(); render();
  setStatus(recs.length === 1 ? `Added ${shortSpec(recs[0])}.` : `Added ${recs.length} parts: ${recs.map(shortSpec).join(', ')}.`, 'ok');
}
function editRecord(id) {
  const rec = state.records.find((r) => r.id === id); if (!rec) return;
  if (!state.saved) state.saved = { template: state.template, family: state.family, sel: state.sel, section: state.section };
  const t = clone(rec); t.id = 'template';
  state.template = t; state.family = rec.family; state.sel = []; state.editing = id;
  state.explicit = new Set(rec.user_unknown || []); state.customOpen = null; state.section = planKey(PLAN[rec.family][0]);
  render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function saveEdit() {
  const i = state.records.findIndex((r) => r.id === state.editing);
  const r = clone(T()); r.id = state.editing;
  if (i >= 0) state.records[i] = r;
  leaveEdit();
  setStatus(`Saved ${shortSpec(r)}.`, 'ok'); // after the re-render, which rebuilds the status line
}
function cancelEdit() { leaveEdit(); }
function leaveEdit() {
  const s = state.saved; state.saved = null; state.editing = null;
  if (s) { state.template = s.template; state.family = s.family; state.sel = s.sel; state.section = s.section; }
  state.explicit.clear(); state.customOpen = null;
  save(); render();
}

// ------------------------------------------------------------------ the list
function tally(rec) {
  let custom = 0; let unknown = 0;
  for (const [, f] of leaves(rec)) { if (f.status === UNKNOWN) unknown++; else if (f.status === CUSTOM) custom++; }
  return { custom, unknown };
}
function listCard() {
  const card = h('section', { class: 'card list', 'aria-label': 'On the list' });
  card.append(h('div', { class: 'card-k' }, `ON THE LIST · ${state.records.length}`));
  if (!state.records.length) card.append(h('div', { class: 'muted' }, 'Nothing yet. Pick a family and type, tick the lengths or sizes, then Add.'));
  // collections are a FILTER over one list, never copies (design review)
  const tags = [...new Set(state.records.flatMap((r) => r.tags || []))].sort();
  if (state.listFilter && !tags.includes(state.listFilter)) state.listFilter = null;
  if (tags.length) {
    card.append(h('div', { class: 'row wrap filters' }, h('span', { class: 'muted small' }, 'Show:'),
      [null, ...tags].map((tg) => textBtn({ label: tg || 'All', on: state.listFilter === tg, cls: 'sm', onClick: () => { state.listFilter = tg; renderSide(); } }))));
  }
  state.records.forEach((r, i) => {
    if (state.listFilter && !(r.tags || []).includes(state.listFilter)) return;
    const c = tally(r);
    const sub = [headLabel(r), stdText(r), toolText(r), materialText(r, true)].filter(Boolean).join(' · ');
    const g2 = secondaryGlyph(r);
    const lp = r.photo ? null : HW.resolve(r);
    card.append(h('div', { class: `lrow ${state.editing === r.id ? 'editing' : ''}` },
      h('span', { class: 'lidx' }, i + 1),
      r.photo ? h('img', { class: 'limg', src: r.photo, alt: 'photo of the part', width: 64, height: 64, loading: 'lazy' })
        : hasPic(lp) ? h('img', { class: `limg ${lp.exact ? '' : 'approx'}${lp.kind === 'illustration' ? ' illus' : ''}`, src: lp.srcSm, alt: '', width: 64, height: 64, loading: 'lazy', title: picTitle(lp) })
          : h('span', { class: 'lg', html: glyph(primaryGlyph(r), 26) + (g2 ? glyph(g2, 26) : '') }),
      h('span', { class: 'lmain' }, h('span', { class: 'mono lspec' }, shortSpec(r)), h('span', { class: 'lsub' }, sub || FAMILY_LABEL[r.family]),
        r.tags && r.tags.length ? h('span', { class: 'ltags' }, r.tags.join(' · ')) : null,
        h('span', { class: 'lst' }, c.custom ? `${c.custom} custom` : null, c.custom && c.unknown ? ' · ' : null, c.unknown ? `${c.unknown} unknown` : null)),
      h('span', { class: 'lact' },
        h('button', { type: 'button', class: 'btn sm ghost', onclick: () => editRecord(r.id), disabled: state.editing === r.id || null }, 'Edit'),
        h('button', { type: 'button', class: 'btn sm ghost', title: 'duplicate', onclick: () => { const x = clone(r); x.id = P.idgen(); state.records.splice(i + 1, 0, x); save(); render(); } }, 'Copy'),
        h('button', { type: 'button', class: 'btn sm ghost danger', onclick: () => { if (state.editing === r.id) leaveEdit(); state.records.splice(i, 1); save(); render(); } }, 'Remove'),
        r.family === 'other' && state.editing === null ? reassignControl(r) : null)));
  });
  let armed = false;
  const clearBtn = h('button', { type: 'button', class: 'btn sm ghost danger', onclick: () => {
    if (!armed) { armed = true; clearBtn.textContent = 'Really clear?'; setTimeout(() => { armed = false; clearBtn.textContent = 'Clear all'; }, 3000); return; }
    state.records = []; if (state.editing) leaveEdit();
    const ws = workshopStyle(); const reset = !sameStyle(ws, state.labelStyle); state.labelStyle = ws;
    save(); render();
    if (reset) setStatus(`List cleared. Label colours are back to the workshop scheme (${styleName(ws)}).`, 'ok');
  } }, 'Clear all');
  const imp = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  imp.addEventListener('change', async () => {
    const file = imp.files[0]; if (!file) return;
    try {
      const { records, problems, labelStyle } = importDoc(await file.text());
      imp.value = '';
      // The list's scheme decides the colours of what it holds. When the file's scheme would print any of its parts in
      // other colours than their existing labels, nothing is applied until the person has seen which ones (design review
      // 2026-10-06: "Import review should show that consequence before applying it")
      const changes = sameStyle(labelStyle, state.labelStyle) ? [] : colourChanges(records, labelStyle, state.labelStyle);
      if (changes.length) { state.importReview = { records, problems, fileStyle: labelStyle, changes, name: file.name }; render(); return; }
      applyImport(records, problems, labelStyle, false);
    } catch (err) { setStatus(`Import failed: ${err.message}`, 'err'); }
  });
  const labelsBtn = h('button', { type: 'button', class: EMBED ? 'btn primary' : 'btn sm', id: 'make-labels', disabled: !shownRecords().length || (PLANNER && !planner) || null, onclick: makeLabels,
      title: PLANNER ? (planner ? 'Add a part label for every part shown here (the collection filter applies) to your planner build.' : 'Waiting for the planner to connect.')
        : EMBED ? 'Add a part label for every part shown here (the collection filter applies) to the end of your list in the Label Studio.'
        : 'Open the Label Studio with a part label for every part shown here (the collection filter applies): preview them, export a 3MF, or add them to a planner build.' },
    labelsButtonText(shownRecords().length, EMBED, PLANNER));
  const labelsStatus = h('div', { id: 'labels-status', class: `status ${labelsMsg ? labelsMsg.cls : ''}`, role: 'status' }, labelsMsg ? labelsMsg.text : '');
  card.append(h('div', { class: 'row wrap list-tools' },
    h('button', { type: 'button', class: 'btn sm ghost', onclick: () => copyText(listText(P, state.records), 'List') }, 'Copy list as text'),
    h('button', { type: 'button', class: 'btn sm ghost', onclick: () => {
      const blob = new Blob([exportDoc(P, state.records, { labelStyle: state.labelStyle })], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'part-records.json' }); document.body.append(a); a.click(); a.remove();
      setStatus(`Exported ${state.records.length} parts.`, 'ok');
    } }, 'Export JSON'),
    h('button', { type: 'button', class: 'btn sm ghost', onclick: () => imp.click() }, 'Import JSON'),
    EMBED ? null : labelsBtn,
    clearBtn, imp, styleControl()));
  // inside the Label Studio: Add part labels and what it did sit in a bar pinned to the bottom, always in reach (on a phone the
  // button used to sit below a long list)
  if (EMBED) card.append(h('div', { class: 'embed-addbar' }, labelsBtn, labelsStatus));
  else card.append(labelsStatus);
  if (state.textView) card.append(h('textarea', { readonly: true, rows: 10, class: 'textview' }, state.textView));
  if (state.importReview) card.append(importReviewBox());
  return card;
}
/* MAKE LABELS: the parts shown in the list (the collection filter applies) as part labels (part-picker-label-items/1, the
   Label Studio's own import; at most 200). Inside the Label Studio's sheet they are POSTED to the Studio, which adds them
   to the end of its list and answers 'added' or 'refused' (js/embed.js has the contract). Opened on its own (the site's
   parts/ page) it opens the Label Studio at the same site, '../#hw=...', in a new tab; ?labelgen=http://localhost:PORT/
   points that at a local Label Studio for development. */
const LABEL_ITEMS_SCHEMA = 'part-picker-label-items/1';
const LABEL_STUDIO_URL = labelStudioUrl(location);
const shownRecords = () => state.records.filter((r) => !state.listFilter || (r.tags || []).includes(state.listFilter));
let addWait = null;       // a batch posted to the Label Studio and not answered yet: { missingNote, timer }
// What Make labels / Add part labels did, on its own status line right under the button: the summary card's status line
// is out of sight above a long list. Kept across re-renders of the list card; 'ok' fades, 'err' stays.
function setLabelsStatus(text, cls = '') {
  labelsMsg = text ? { text, cls } : null;
  const el = $('labels-status');
  if (el) { el.textContent = text; el.className = `status ${cls}`; }
  clearTimeout(labelsTimer);
  if (text && cls !== 'err') labelsTimer = setTimeout(() => setLabelsStatus(''), 6000);
}
function makeLabels() {
  const recs = shownRecords();
  if (!recs.length) return;
  if (recs.length > LABEL_STUDIO_MAX_ITEMS) { setLabelsStatus(`The Label Studio takes up to ${LABEL_STUDIO_MAX_ITEMS} labels at once; ${recs.length} are shown. Filter to a collection first.`, 'err'); return; }
  const items = recs.map((r) => labelItem(r, { describe: describeValue, style: state.labelStyle }));
  // one item the Studio cannot take would cost the whole batch: name it here instead, and send nothing
  for (let i = 0; i < items.length; i++) {
    const why = labelStudioProblem(items[i]);
    if (why) { setLabelsStatus(`Part ${state.records.indexOf(recs[i]) + 1} (${shortSpec(recs[i])}) cannot become a label: ${why}. Edit it, then try again.`, 'err'); return; }
  }
  const missing = items.filter((it) => it.value_missing && it.value_missing.length).length;
  const missingNote = missing ? ` ${missing} ${missing === 1 ? 'is' : 'are'} missing a size and will not print until completed.` : '';
  const n = `${items.length} part label${items.length === 1 ? '' : 's'}`;
  if (EMBED) {
    if (PLANNER) {
      if (!planner) { setLabelsStatus('The planner has not connected yet; try again in a moment.', 'err'); return; }
      window.parent.postMessage(addMessageFor(items, planner), planner.origin);
    } else window.parent.postMessage(addMessage(items), location.origin);
    if (addWait) clearTimeout(addWait.timer);
    addWait = { missingNote, timer: setTimeout(() => { addWait = null;
      setLabelsStatus(PLANNER ? 'The planner did not answer, so the labels may not have been added. Check its label list.' : 'The Label Studio did not answer, so the labels may not have been added. Check your list there.', 'err'); }, 5000) };
    setLabelsStatus(PLANNER ? `Adding ${n} to your build…` : `Adding ${n} to your list…`);
    return;
  }
  const doc = { schema: LABEL_ITEMS_SCHEMA, items };
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(doc))));
  window.open(LABEL_STUDIO_URL + '#hw=' + encodeURIComponent(b64), '_blank', 'noopener');
  setLabelsStatus(`Opened the Label Studio with ${n}` + (state.listFilter ? ` (${state.listFilter})` : '') + '.' + missingNote, missing ? 'err' : 'ok');
}
// the Label Studio's answer to a posted batch (only from the parent frame, same origin: js/embed.js readReply)
if (EMBED) {
  window.addEventListener('message', (e) => {
    const r = PLANNER ? readPlannerReply(e, window, planner) : readReply(e, window);
    if (!r) return;
    const note = addWait && r.kind === 'added' && r.count ? addWait.missingNote : '';
    if (addWait) { clearTimeout(addWait.timer); addWait = null; }
    const s = replyStatus(r);
    setLabelsStatus(s.text + note, note ? 'err' : s.cls);
  });
}
const styleName = (st) => (!st ? 'no colours' : st.preset || 'a scheme from a file');
const colourText = (c) => (!c ? 'none' : c.colour ? `${c.label}${c.pattern === 'dashed' ? ', dashed' : ''}` : `unassigned (${c.unassigned})`);
function applyImport(records, problems, fileStyle, adoptFileStyle) {
  let note = '';
  if (adoptFileStyle) { state.labelStyle = fileStyle; note = ` The list now uses the file's label colours (${styleName(fileStyle)}).`; }
  else if (fileStyle && !sameStyle(fileStyle, state.labelStyle)) note = ` Label colours follow this list's scheme (${styleName(state.labelStyle)}).`;
  state.records.push(...records); state.importReview = null; save(); render();
  setStatus(`Imported ${records.length} part${records.length === 1 ? '' : 's'}.${note}` + (problems.length ? ` ${problems.length} structural problem(s): ${problems[0]}` : ''), problems.length ? 'err' : 'ok');
}
// Which imported labels would print in other colours, and the explicit choices: nothing is applied from here silently
function importReviewBox() {
  const R = state.importReview;
  const byRec = new Map();
  for (const c of R.changes) { if (!byRec.has(c.index)) byRec.set(c.index, []); byRec.get(c.index).push(c); }
  const rows = [...byRec].map(([i, cs]) => {
    const r = R.records[i];
    return h('li', {}, h('b', {}, r.label || shortSpec(r)), ': ',
      cs.map((c) => `${SLOT_NAME[c.slot]} ${colourText(c.from)} -> ${colourText(c.to)}`).join('; '));
  });
  const box = h('div', { class: 'import-review', role: 'alertdialog', 'aria-label': 'Import review' },
    h('div', { class: 'card-k' }, 'IMPORT REVIEW · LABEL COLOURS'),
    h('p', {}, `${R.name}: ${R.records.length} part${R.records.length === 1 ? '' : 's'}, ${R.fileStyle ? `coloured with ${styleName(R.fileStyle)}` : 'saved without label colours'}. `,
      `This list uses ${styleName(state.labelStyle)}. Imported, ${byRec.size} of them would print in other colours than labels already made from the file:`),
    h('ul', { class: 'small' }, rows),
    h('div', { class: 'row wrap' },
      h('button', { type: 'button', class: 'btn sm', onclick: () => applyImport(R.records, R.problems, R.fileStyle, false) },
        `Import - use this list's colours (${byRec.size === 1 ? '1 label changes' : `${byRec.size} labels change`} colour)`),
      // switching the whole list is offered only while the list is empty: it would recolour the parts already on it
      !state.records.length && R.fileStyle ? h('button', { type: 'button', class: 'btn sm ghost', onclick: () => applyImport(R.records, R.problems, R.fileStyle, true) },
        'Import - switch this list to the file\'s colours') : null,
      h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { state.importReview = null; render(); setStatus('Import cancelled - nothing changed.', 'ok'); } }, 'Cancel')));
  return box;
}
// The list's label colour scheme (2026-10-06, design review: "Users should choose a scheme for a collection, with the mapping
// staying consistent thereafter"). Off, one of the proposed presets, or a scheme read from a file, kept as it is; and
// the workshop scheme a new or cleared list starts with.
function styleControl() {
  const wrap = h('span', { class: 'label-style-ctl' });
  const sel = h('select', { class: 'label-style', 'aria-label': 'Label colours for this list' });
  const ws = workshopStyle();
  const presetKey = Object.keys(PRESETS).find((k) => sameStyle(PRESETS[k], state.labelStyle));
  const tag = (st) => (sameStyle(st, ws) ? ' (workshop)' : '');
  sel.append(h('option', { value: 'off' }, `Label colours: off${tag(null)}`));
  for (const [k, st] of Object.entries(PRESETS)) sel.append(h('option', { value: k }, `Label colours: ${st.preset}${tag(st)}`));
  if (state.labelStyle && !presetKey) sel.append(h('option', { value: 'own' }, `Label colours: ${styleName(state.labelStyle)}${tag(state.labelStyle)}`));
  sel.value = !state.labelStyle ? 'off' : presetKey || 'own';
  sel.addEventListener('change', () => {
    if (sel.value === 'own') return;
    const next = sel.value === 'off' ? null : clone(PRESETS[sel.value]);
    // changing the scheme of a list that holds parts recolours their labels: say how many
    const n = new Set(colourChanges(state.records, state.labelStyle, next).map((c) => c.index)).size;
    state.labelStyle = next; save(); render();
    setStatus(`Label colours for this list: ${styleName(next)} (saved with the list and its export).` +
      (n ? ` ${n} part(s) on the list now print in other colours than before.` : ''), 'ok');
  });
  wrap.append(sel);
  if (!sameStyle(ws, state.labelStyle)) {
    wrap.append(h('button', { type: 'button', class: 'btn sm ghost', title: 'A new or cleared list starts with the workshop scheme',
      onclick: () => { const ok = setWorkshopStyle(state.labelStyle ? clone(state.labelStyle) : null); render();
        setStatus(ok ? `Workshop label colours: ${styleName(state.labelStyle)}.` : 'Could not save the workshop scheme (browser storage is blocked).', ok ? 'ok' : 'err'); } },
      'Make it the workshop scheme'));
  }
  return wrap;
}
// The label colours of the part being edited, under the list's scheme. A colour set by hand is marked as such, with what
// the legend would give, so it never quietly contradicts the legend (design review 2026-10-06).
function labelColoursBox() {
  const st = state.labelStyle; if (!st) return null;
  const t = T(); const cols = labelColours(t, st);
  const rows = SLOTS.filter((slot) => st[slot] || (t.label_colours && t.label_colours[slot])).map((slot) => {
    const c = cols[slot];
    const sel = h('select', { 'aria-label': `${SLOT_NAME[slot]} colour for this part` },
      h('option', { value: '' }, 'follow the scheme'),
      ...Object.keys(st.palette).map((k) => h('option', { value: k }, `set by hand: ${k}`)));
    sel.value = c && c.source === 'override' ? c.colour : '';
    sel.addEventListener('change', () => { state.template = P.setMeta(T(), { label_colours: { [slot]: sel.value || null } }); save(); render(); });
    const sw = c && c.colour ? h('span', { class: 'sw', style: `background:${c.hex}` }) : h('span', { class: 'sw none' });
    const what = !c ? 'not used by this scheme' : !c.colour ? `unassigned - ${c.unassigned}`
      : c.source === 'override' ? `${c.colour}, SET BY HAND - the legend gives ${c.rule || 'no colour'} here` : `${c.label}${c.pattern === 'dashed' ? ' (dashed)' : ''}`;
    return h('div', { class: `lc-row${c && c.source === 'override' ? ' override' : ''}` }, h('span', { class: 'lw-k' }, SLOT_NAME[slot]), sw, h('span', {}, what), sel);
  });
  return h('details', { class: 'lw lc' }, h('summary', {}, `Label colours - ${styleName(st)}`), ...rows);
}
// "Make it a ..." on an Other part (design review): same record id, so its label and drawer association survive
function reassignControl(r) {
  const sel = h('select', { class: 'reassign', 'aria-label': `Give ${r.label || 'this part'} a family` });
  sel.append(h('option', { value: '' }, 'Make it a…'));
  for (const f of FAMILIES.values()) if (f.id !== 'other') sel.append(h('option', { value: f.id }, FAMILY_LABEL[f.id] || f.label));
  sel.addEventListener('change', () => {
    if (!sel.value) return;
    const i = state.records.findIndex((x) => x.id === r.id);
    state.records[i] = P.reassignFamily(r, sel.value);
    save(); editRecord(r.id);
    setStatus(`${r.label || 'The part'} is now a ${FAMILY_LABEL[sel.value]} record (same id) - fill in what you know, then Save part.`, 'ok');
  });
  return sel;
}
async function copyText(text, title) {
  try { await navigator.clipboard.writeText(text); setStatus(`${title} copied.`, 'ok'); }
  catch { state.textView = text; render(); setStatus('Clipboard blocked: the text is below the list - select and copy it.'); }
}

// ------------------------------------------------------------------ page
let LEGEND = null;        // built once: in the header on its own page, at the top of the builder inside the Label Studio
function legend() {
  const det = h('details', { class: EMBED ? 'legend embed-legend' : 'legend' });
  det.append(h('summary', {}, 'What the status words mean'));
  for (const k of ['listed', 'suggested', 'custom', 'unknown']) {
    det.append(h('div', { class: 'lg-row' }, h('span', { class: `st st-${k}` }, h('span', { class: 'mk' }), STATUS_INFO[k].word), h('span', {}, STATUS_INFO[k].def)));
  }
  return det;
}
function familyTiles() {
  return h('div', { class: 'tiles cols-5 fam' }, [...FAMILIES.values()].map((f) => tile({ g: FAMILY_GLYPH[f.id], img: tileImg(HW.familyPicture(f.id)), label: FAMILY_LABEL[f.id] || f.label, disabled: !D || null,
    on: f.id === state.family, onClick: () => switchFamily(f.id), disabled: !batching() && f.id !== state.family ? true : null,
    title: !batching() && f.id !== state.family ? 'Finish or cancel editing first' : f.label })));
}

function render() {
  const t = T();
  const left = $('builder'); const right = $('side');
  const y = window.scrollY;
  left.innerHTML = ''; right.innerHTML = '';
  if (!batching()) {
    const i = state.records.findIndex((r) => r.id === state.editing);
    left.append(h('div', { class: 'edit-banner', role: 'status' }, `Editing part ${i + 1} - change any field, then Save part on the right.`,
      h('button', { type: 'button', class: 'btn sm', onclick: saveEdit }, 'Save part'), h('button', { type: 'button', class: 'btn sm ghost', onclick: cancelEdit }, 'Cancel')));
  }
  if (EMBED && LEGEND) left.append(LEGEND);       // the same element each time, so an open legend stays open
  left.append(tokenStrip());
  left.append(sectionEl('family', 1, 'Family', null, familyTiles()));
  let n = 2;
  for (const entry of PLAN[t.family]) {
    let el = null;
    if (!Array.isArray(entry)) {                 // the generic entries
      const e = entry;
      if (e.kind === 'head') el = headSection(e.key, n, e.title);
      else if (e.kind === 'choice') el = choiceSection(e.key, n, e.title, e.path, e.hint, (o) => o.label + (e.unit ? ` ${e.unit}` : ''));
      else if (e.kind === 'batch') el = batchSection(e, n);
      else if (e.kind === 'sizes') el = sizesSection(e.key, n, e.title);
      else if (e.kind === 'grip') el = gripSection(e, n);
      else if (e.kind === 'material') el = materialSection(e.key, n, e.paths);
      else if (e.kind === 'details') el = detailsSection(e, n);
      if (el) { left.append(el); n++; }
      continue;
    }
    const [key, title] = entry;
    switch (key) {
      case 'head': el = headSection(key, n, title); break;
      case 'point': el = pointSection(key, n); break;
      case 'drive': el = driveSection(key, n); break;
      case 'thread': el = threadSection(key, n); break;
      case 'pitch': el = pitchSection(key, n); break;
      case 'lengths': el = lengthsSection(key, n); break;
      case 'sizes': el = sizesSection(key, n, title); break;
      case 'extent': el = choiceSection(key, n, 'Thread extent', 'specific.thread_extent', 'full or partial thread', (o) => `${o.label} thread`); break;
      case 'locking': el = choiceSection(key, n, 'Locking', 'specific.locking_feature', 'the type suggests one; nothing is assumed'); break;
      case 'brand': el = choiceSection(key, n, 'Brand dataset', 'specific.insert.brand_dataset', 'optional - lists outside diameter and length for that brand'); break;
      case 'material': el = materialSection(key, n); break;
      default: break;
    }
    if (el) { left.append(el); n++; }
  }
  const more = detailSection();
  if (more) left.append(more);
  right.append(summaryCard(), listCard());
  window.scrollTo(0, y);
}
// only the right-hand cards (typing in Details must not rebuild - and unfocus - the builder)
function renderSide() {
  const right = $('side'); const y = right.scrollTop;
  right.innerHTML = ''; right.append(summaryCard(), listCard()); right.scrollTop = y;
}

async function main() {
  LEGEND = legend();
  if (!EMBED) $('header-extra').append(LEGEND);
  // Feedback & support (design review 2026-10-10): the shared MODULITH dialog. Not when embedded - the Label Studio around it has its own
  if (!EMBED && !$('feedback-btn')) $('header-extra').append(h('button', { type: 'button', id: 'feedback-btn', class: 'btn sm ghost', 'aria-haspopup': 'dialog',
    onclick: () => (window.MODULITHFeedback ? window.MODULITHFeedback.open({ tool: 'Part Picker' })
      : (location.href = 'mailto:support@jerrari3d.com?subject=' + encodeURIComponent('[MODULITH Part Picker]'))) }, 'Feedback'));
  try {
    D = await loadDataAsync((name) => fetch('data/' + name).then((r) => { if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`); return r.text(); }));
  } catch (e) {
    $('builder').textContent = location.protocol === 'file:'
      ? `Could not load the data files (${e.message}). Serve this folder with: python serve.py`
      : `Could not load the part data (${e.message}). Reload the page to try again.`;
    return;
  }
  try {                      // the rendered pictures are optional: without them every tile keeps its glyph
    const idx = await fetch('img/hw/v2/assets.json').then((r) => (r.ok ? r.json() : null));
    if (idx) HW = createHwImages(idx, { heads: D.own.heads, families: DATA_FAMILY });
  } catch (e) { console.warn('img/hw/v2/assets.json not loaded:', e.message); }
  P = createPicker(D);
  state.template = P.newRecord('screw', { id: 'template' });
  restore();
  if (!state.template || state.template.id !== 'template') state.template = P.newRecord(state.family, { id: 'template' });
  state.section = planKey(PLAN[state.family][0]);
  render();
  window.__PICKER__ = { P, D, state, render }; // dev console and browser checks
}
main();
