// The Part Picker's flow (2026-10-14, docs/FLOW-REFINE-2026-10-14.md): the stages a family's sections fall into, what an
// add needs before it can go, and the words of the bar that sends it. Pure - no page, no data files: js/ui.js draws from
// it and test/flow.test.mjs pins it.
import { DATA_FAMILY } from './families-data.js';
import { STATUS, getPath } from './fields.js';
import { valueMissing } from './labelitem.js';

export const STAGE_ORDER = ['family', 'type', 'size', 'lengths', 'details', 'part'];
const STAGE_TITLE = { family: 'Family', type: 'Type', size: 'Size', lengths: 'Lengths', details: 'Details', part: 'The part' };

// A section's stage, by its PLAN key (js/ui.js; a data family's field keys too). Type holds what says WHICH part it is,
// Size the size (or the sizes, when the batch runs over them), Lengths the lengths; anything not named lands in Details
// rather than vanishing. "Other part" has one stage of its own after the family: The part.
const TYPE_KEYS = new Set(['head', 'point', 'profile', 'slot', 'rtype', 'series']);
const SIZE_KEYS = new Set(['thread', 'pitch', 'sizes', 'tube-a', 'diameter', 'size', 'positions']);
const LENGTH_KEYS = new Set(['lengths', 'rlength']);
// entry: { key, multi, noun } - multi = the family's batch field (several parts at once)
export function stageOfEntry(family, entry) {
  if (entry.key === 'family') return 'family';
  if (family === 'other') return 'part';
  if (TYPE_KEYS.has(entry.key)) return 'type';
  if (LENGTH_KEYS.has(entry.key)) return 'lengths';
  if (entry.multi) return entry.noun === 'lengths' ? 'lengths' : 'size';
  if (SIZE_KEYS.has(entry.key)) return 'size';
  return 'details';
}
// [{ id, title, keys, multi }] in stage order; Family first, empty stages left out
export function stagesFor(family, entries) {
  const out = [{ id: 'family', title: STAGE_TITLE.family, keys: ['family'], multi: false }];
  for (const e of entries) {
    const id = stageOfEntry(family, e);
    let s = out.find((x) => x.id === id);
    if (!s) out.push(s = { id, title: STAGE_TITLE[id], keys: [], multi: false });
    s.keys.push(e.key);
    if (e.multi) s.multi = true;
  }
  // a batch over sizes reads Sizes; a connector's batch is its position counts
  for (const s of out) if (s.id === 'size' && s.multi) s.title = s.keys.includes('positions') ? 'Positions' : 'Sizes';
  return out.sort((a, b) => STAGE_ORDER.indexOf(a.id) - STAGE_ORDER.indexOf(b.id));
}
export const stageIndex = (stages, id) => stages.findIndex((s) => s.id === id);
export function nextStage(stages, id) { const i = stageIndex(stages, id); return i >= 0 && i < stages.length - 1 ? stages[i + 1].id : null; }
export function prevStage(stages, id) { const i = stageIndex(stages, id); return i > 0 ? stages[i - 1].id : null; }
// Hold opens the stage BEFORE the batch stage: the next batch is usually another size (screws) or another type (nuts)
export function stageBeforeBatch(stages) {
  const i = stages.findIndex((s) => s.multi);
  return i > 0 ? stages[i - 1].id : (stages[1] || stages[0]).id;
}
// A single-choice pick that completes its stage moves on: no multi-select in it, and every choice in it answered.
// sections: [{ multi, known }]
export function shouldAdvance(sections) {
  return sections.length > 0 && !sections.some((s) => s.multi) && sections.every((s) => s.known);
}

// ------------------------------------------------------------------ ready to add
// What a label's BIG text is made of beyond valueMissing() (the size, an inch part's threads per inch, a screw's length):
// the batch field is checked through the selection, so only the other fields are named here (labelRule.big in
// families-data.js; shortSpec() in ui.js for the rivet).
const BIG_KEYS = { shoulder: ['diameter'], pin: ['diameter'], connector: ['series'] };
function bigPaths(family) {
  if (family === 'rivet') return ['specific.rivet.diameter'];
  const df = DATA_FAMILY.get(family);
  return df && BIG_KEYS[family] ? BIG_KEYS[family].map((k) => df.fields.find((f) => f.key === k).path) : [];
}
const known = (f) => !!f && f.status !== STATUS.UNKNOWN && f.value !== null && f.value !== undefined && f.value !== '';
const NAME = { 'thread.diameter': 'Size', 'thread.tpi': 'Threads per inch', 'length.value': 'Length' };
function fieldName(path) {
  if (NAME[path]) return NAME[path];
  const last = path.split('.').pop();
  if (last === 'positions') return 'Position count';
  if (last === 'tube_a') return 'Tube size';
  return last[0].toUpperCase() + last.slice(1).replace(/_/g, ' ');
}
export function stageOfPath(path) {
  if (path === 'label') return 'part';
  if (/\.series$/.test(path)) return 'type';
  if (path === 'length.value' || /\.length$/.test(path)) return 'lengths';
  return 'size';
}
// the words name the control that answers it: a shoulder screw's Size stage holds "Shoulder diameter" AND "Thread", so its
// two reasons must not both read like "a size" (the stress test, 2026-10-14)
function missingText(path, varying) {
  const n = fieldName(path).toLowerCase();
  if (varying) return `Tick at least one ${n}`;
  if (path === 'thread.diameter') return 'Choose the thread size';
  if (path === 'thread.tpi') return 'Choose the threads per inch';
  return `Choose the ${n}`;
}
// { family, chosen, template, records, sel, explicit, varyPath, unsettable } -> { ready, missing: [{ path, stage, text }], warn: [text] }
//   records = what the add would make (the batch expanded, or the one part); explicit = paths set to Unknown ON PURPOSE.
//   A deliberate Unknown is an answer (it adds, with a warning: the label will not print until it is set); a field
//   nobody touched never is (docs/FLOW-REFINE-2026-10-14.md §5). unsettable = paths the page draws no control for in
//   this family (an inch nut's threads per inch: the data fills it per listed size, an own size leaves it Unknown) -
//   those warn rather than block, or the part could never be added (the code review, 2026-10-14).
export function readiness({ family, chosen = true, template, records, sel = [], explicit = new Set(), varyPath = null, unsettable = new Set() }) {
  if (!chosen) return { ready: false, missing: [{ path: 'family', stage: 'family', text: 'Choose a family' }], warn: [] };
  const missing = []; const warn = [];
  const seen = new Set();
  const note = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    const varying = path === varyPath;
    if (varying && sel.length) return;   // a ticked batch value is on every record it makes
    if (explicit.has(path) || unsettable.has(path)) warn.push(`${fieldName(path)} Unknown: this label will not print until it is set`);
    else missing.push({ path, stage: stageOfPath(path), text: missingText(path, varying) });
  };
  if (family === 'other') {
    const t = template || {};
    if (!(t.label && String(t.label).trim()) && !t.photo) missing.push({ path: 'label', stage: 'part', text: 'Name the part, or add a photo' });
    return { ready: !missing.length, missing, warn };
  }
  const recs = records && records.length ? records : [template];
  for (const r of recs) {
    for (const m of valueMissing(r)) note(m.path);
    for (const p of bigPaths(family)) if (!known(getPath(r, p))) note(p);
  }
  if (varyPath && !sel.length) note(varyPath);   // nothing ticked: the batch field is missing even where valueMissing has no rule for it
  return { ready: !missing.length, missing, warn };
}

// ------------------------------------------------------------------ the bar's words
// mode: 'planner' (?embed=planner), 'studio' (?embed=1), 'standalone'
const labels = (n) => `${n} ${n === 1 ? 'label' : 'labels'}`;
const partLabels = (n) => `${n} part ${n === 1 ? 'label' : 'labels'}`;
const parts = (n) => `${n} ${n === 1 ? 'part' : 'parts'}`;
export function primaryText({ mode, n, held = 0, editing = false, retry = false }) {
  if (editing) return mode === 'standalone' ? 'Save part' : 'Save and update the label';
  const total = n + held;
  if (mode === 'planner') return retry ? `Try again: add ${labels(total)}` : total ? `Add ${labels(total)} to the planner` : 'Add labels to the planner';
  if (mode === 'studio') return retry ? `Try again: add ${partLabels(total)}` : total ? `Add ${partLabels(total)}` : 'Add part labels';
  return total ? `Add ${parts(total)} to the list` : 'Add to the list';
}
// the wording Joey and Astra chose (2026-10-14): "Pick more first" promises nothing about where it goes and keeps "Add" on
// the one orange button; the parts it keeps are "pending" (not held, not waiting)
export const HOLD_TEXT = 'Pick more first';
export const heldText = (n) => `${n} ${n === 1 ? 'part' : 'parts'} pending`;
// List tools' "send every shown part" (the old Make labels button, id make-labels) inside the embeds
// perBuild: the planner named its build in the hello - "to this build" says where they land (they used to read as if
// they were already there: the list follows a browser, not a build)
export function addAllText(n, mode, perBuild = false) {
  const where = perBuild ? 'this build' : 'the planner';
  return mode === 'planner' ? (n ? `Add all ${n} to ${where}` : `Add all to ${where}`) : (n ? `Add all ${partLabels(n)}` : 'Add all part labels');
}
// The one line about label colours (Part details), by where the Picker runs: the stripe switch belongs to whatever prints
// the labels (the planner's Label settings since 2026-10-14; the Label Studio's Stripe position), never to the Picker
export function colourHint(mode) {
  if (mode === 'planner') return 'Fewer than three filament colours? Turn the stripe off in the planner\'s Label settings (or on the Label plate).';
  if (mode === 'studio') return 'Fewer than three filament colours? Turn the stripe off in Label settings › Stripe position.';
  return 'Fewer than three filament colours? Choose Off here; the Label Studio\'s Stripe position can also turn the stripe off.';
}
