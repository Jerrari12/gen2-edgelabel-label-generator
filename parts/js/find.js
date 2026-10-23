// FIND A PART: THE CLICKS (2026-10-17). A candidate from the reader (js/findparse.js) becomes the record the step clicks
// would make: the same engine calls in the page's own stage order (js/flow.js over js/plan.js) - Type, Size, Lengths,
// Details - so the drive comes last, and a batch's lengths (or sizes) are left to the bar's Add, as the tiles leave them.
// The order is not a detail: the record-path map (2026-10-17) found that a drive set before the size takes the thread from
// the coarse series instead of the head's table, and that an inch switch after the drive wipes it.
// The page's drive tile (chooseDriveOn) and its new-family draft (freshDraft) live here, and ui.js calls them, so the
// tiles and Find run one copy of each.
import { STATUS, getPath, clone } from './fields.js';
import { FAMILIES } from './picker.js';
import { PLAN, planKey, planEntries } from './plan.js';
import { stageOfEntry } from './flow.js';
import { expandBatch } from './batch.js';
import { isUnified } from './units.js';
import { FIND_NOUN, an } from './findparse.js';

const { LISTED, CUSTOM, UNKNOWN } = STATUS;

// ---------------------------------------------------------------- the page's own steps (moved here from ui.js)
// A new family's draft: only the material fields the new family SHOWS come along (a value the person cannot see must not be
// saved with the part), the notes and the collections; a family with exactly one type gets it (set screws).
export function freshDraft(P, id, old) {
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
  return t;
}
export function headStdOf(D, t) {
  if (t.head.status !== LISTED) return null;
  const hd = D.head(t.family, t.head.value);
  return hd && hd.standard ? hd.standard : null;
}
// A fresh record on the head's OWN standard, carrying over the thread, pitch, extent and point. Used before any drive
// change so the engine's standard-drop rule always starts from the head's standard (the engine only drops a standard it
// has a table for, so an accepted lists-only offer such as ISO 14579 would otherwise stick to a later drive).
export function rebaseOnHead(P, t) {
  if (t.head.status !== LISTED) return t;
  let r = P.set(t, 'head', { mode: LISTED, value: t.head.value });
  // length.value matters while editing one part (a batch keeps its lengths in state.sel)
  for (const path of ['specific.point_type', 'thread.diameter', 'thread.pitch', 'specific.thread_extent', 'length.value']) {
    const f = getPath(t, path);
    if (f && f.status !== UNKNOWN && getPath(r, path)) r = P.set(r, path, { mode: f.status === CUSTOM ? CUSTOM : LISTED, value: f.value });
  }
  return r;
}
// the drive tile: the record after choosing drive `id`
export function chooseDriveOn(P, D, t, id) {
  const own = headStdOf(D, t);
  if (own && t.standard !== own) t = rebaseOnHead(P, t);
  const already = t.drive.type.status === LISTED && t.drive.type.value === id;
  return already ? t : P.set(t, 'drive.type', { mode: LISTED, value: id });
}

// ---------------------------------------------------------------- a candidate, replayed
// where the reader's length goes in each family (its thread is thread.diameter; its own fields name their paths)
const LENGTH_PATH = { screw: 'length.value', setscrew: 'length.value', standoff: 'specific.standoff.length', thumb: 'specific.thumb.length',
  shoulder: 'specific.shoulder.length', pin: 'specific.pin.length' };
// the paths a section of the page edits (its plan.js entry): the order Find fills them in
function entryPaths(e) {
  if (Array.isArray(e)) {
    return { head: ['head'], point: ['specific.point_type'], thread: ['thread.system', 'thread.diameter'], sizes: ['thread.system', 'thread.diameter'],
      pitch: ['thread.pitch', 'thread.tpi'], lengths: ['length.value'], drive: ['drive.type'], extent: ['specific.thread_extent'] }[e[0]] || [];
  }
  if (e.kind === 'head') return ['head'];
  if (e.kind === 'sizes') return ['thread.system', 'thread.diameter'];
  return e.kind === 'choice' || e.kind === 'batch' ? [e.path] : [];
}
const STAGES = ['type', 'size', 'lengths', 'details'];
// the values a candidate gives, by the record's paths
function wanted(c) {
  const m = new Map();
  if (c.point) m.set('specific.point_type', c.point);
  if (c.thread !== null && c.thread !== undefined) m.set('thread.diameter', c.thread);
  if (LENGTH_PATH[c.family] && c.length !== null && c.length !== undefined) m.set(LENGTH_PATH[c.family], c.length);
  if (c.extent) m.set('specific.thread_extent', c.extent);
  for (const [k, v] of Object.entries(c.fields || {})) m.set(k, v);
  return m;
}
// what the page would refuse to type (ui.js addCustomSel and the custom boxes): a size or length of zero, or one no part has
function refusal(c) {
  const inch = c.system === 'unified';
  const L = c.length;
  if (L !== null && L !== undefined && !(L > 0)) return `${L} is not a length above zero.`;
  if (L !== null && L !== undefined && L >= (inch ? 400 : 10000)) return `${L} is not a length a part has. Check the number.`;
  if (typeof c.thread === 'number' && !(c.thread > 0 && c.thread < 10000)) return `M${c.thread} is not a size a part has. Check the number.`;
  for (const v of Object.values(c.fields || {})) if (typeof v === 'number' && !(v > 0 && v < 10000)) return `${v} is not a size a part has. Check the number.`;
  return null;
}

// start: the template the clicks would start from (the family's draft). -> { template, sel, touched, notes }
//   template  the part as the page holds it; sel: the batch's ticks (lengths, or sizes) - replaced, never added to: one
//   typed part is one fresh batch, as after an Add. touched: the paths it set (the page clears their "Unknown on purpose").
// Editing one part (batching false), the batch value goes into the template where its section is, as a pick there does.
export function applyFind(P, D, start, cand, { batching = true } = {}) {
  const fam = FAMILIES.get(cand.family);
  if (!fam) throw new Error(`no family ${cand.family}`);
  const why = refusal(cand);
  if (why) throw new RangeError(why);
  const vary = fam.varying ? fam.varying.path : null;
  const has = (path) => fam.paths.some((d) => d.path === path);
  const plan = PLAN[cand.family];
  const entries = planEntries(cand.family);
  const pitchSection = plan.some((e) => planKey(e) === 'pitch');
  const headSection = plan.some((e) => planKey(e) === 'head');
  const want = wanted(cand);
  let t = start; let sel = [];
  const touched = []; const notes = [];
  const put = (path, value) => {
    touched.push(path);
    if (batching && path === vary) sel = [value];
    else t = P.set(t, path, { mode: LISTED, value });
  };
  const differs = (f, v) => !f || f.status === UNKNOWN || Number(f.value) !== Number(v);
  // THE TYPE STARTS OVER, as a click on its tile does: nothing the text did not name rides along from the part held before
  // - not its drive (M5x16r on a Torx button draft is a hex button), its extent, point or spring - and a type the text leaves
  // to choose is cleared, so "M3x20" never silently takes a button head from before (the record-path map's correction).
  // The material, notes, collections and name stay, as they do through a type click. A set screw has no type tiles: its
  // one type is set again, as its new draft gets it.
  const restart = () => { t = P.set(t, 'head', cand.head ? { mode: LISTED, value: cand.head } : { mode: UNKNOWN }); touched.push('head'); };
  for (const stage of STAGES) {
    if (stage === 'type' && !headSection && has('head') && cand.head) restart();
    plan.forEach((e, i) => {
      if (stageOfEntry(cand.family, entries[i]) !== stage) return;
      for (const path of entryPaths(e)) {
        if (path === 'head') {
          if (cand.head !== undefined) restart();
        } else if (path === 'thread.system') {
          // the Units row, above the sizes: switching starts the thread and the lengths over (and empties the ticks)
          if (has('thread.system') && (cand.system === 'unified') !== isUnified(t)) { t = P.set(t, 'thread.system', { mode: LISTED, value: cand.system }); sel = []; touched.push(path); }
        } else if (path === 'thread.pitch' || path === 'thread.tpi') {
          // the Pitch row: only a pitch other than the one the size brought (its coarse pitch, or its UNC threads per inch)
          const v = path === 'thread.pitch' ? cand.pitch : cand.tpi;
          const inchPath = path === 'thread.tpi';
          if (v === null || v === undefined || inchPath !== isUnified(t) || !getPath(t, path)) continue;
          if (differs(getPath(t, path), v)) { t = P.set(t, path, { mode: LISTED, value: v }); touched.push(path); }
        } else if (path === 'drive.type') {
          // the drive tile, then the page's primary "Use ISO 14579" where a listed standard pairs the head with that drive
          if (cand.drive) {
            t = chooseDriveOn(P, D, t, cand.drive); touched.push(path);
            if (cand.offer !== false && P.driveOffer(t)) t = P.acceptOffer(t);
          }
        } else if (want.has(path)) put(path, want.get(path));
      }
    });
    // More detail, editing one part: a nut's or an insert's pitch (it has no Pitch row; a batch fills each size's coarse one)
    if (stage === 'details' && !pitchSection && !batching && cand.pitch !== null && cand.pitch !== undefined && has('thread.pitch')
      && t.thread && !isUnified(t) && differs(t.thread.pitch, cand.pitch)) {
      t = P.set(t, 'thread.pitch', { mode: LISTED, value: cand.pitch }); touched.push('thread.pitch');
    }
  }
  // what the text said that the page cannot set here: said, never silently dropped
  const rec = previewOf(P, t, sel, vary);
  if (rec.thread && cand.pitch !== null && cand.pitch !== undefined && rec.thread.pitch && differs(rec.thread.pitch, cand.pitch)) {
    notes.push(batching && vary === 'thread.diameter'
      ? `${an(noun(cand.family))} batch takes each size's coarse pitch: pitch ${cand.pitch} is not used here (add the part, then Edit it to set the pitch)`
      : `pitch ${cand.pitch} is not used`);
  }
  if (rec.thread && cand.tpi !== null && cand.tpi !== undefined && rec.thread.tpi && differs(rec.thread.tpi, cand.tpi)) {
    notes.push(`the Picker takes ${an(noun(cand.family))}'s threads per inch from its size (${rec.thread.tpi.value}): ${cand.tpi} is not used`);
  }
  return { template: t, sel, touched: [...new Set(touched)], notes };
}
const noun = (f) => FIND_NOUN[f] || 'part';
// the first part the batch would make, without spending a record id (what a candidate's row shows)
export function previewOf(P, t, sel, vary) {
  return sel.length && vary ? P.set(clone(t), vary, { mode: LISTED, value: sel[0] }) : t;
}
// the records the bar's Add would make from it (the tests compare these with the clicks')
export function findRecords(P, D, start, cand, opts = {}) {
  const r = applyFind(P, D, start, cand, opts);
  return { ...r, records: r.sel.length ? expandBatch(P, r.template, r.sel) : [r.template] };
}

// The reader's order, with the data's word added: where two TYPES are offered, one whose table lists the size goes before
// one that would save it as Custom (DIN 557 starts at M5, so an M3 "square nut" is the thin DIN 562 first - the page's own
// hint). startFor(family) -> the template the clicks would start from. -> [{ cand, result, rec, error }], best first.
export function rankFind(P, D, cands, startFor, opts = {}) {
  const sizeOf = (r) => (r.thread ? r.thread.diameter : null);
  return cands.map((cand, i) => {
    let result = null; let rec = null; let error = null;
    try {
      result = applyFind(P, D, startFor(cand.family), cand, opts);
      rec = previewOf(P, result.template, result.sel, (FAMILIES.get(cand.family).varying || {}).path);
    } catch (e) { error = e.message; }
    const custom = rec && sizeOf(rec) && sizeOf(rec).status === CUSTOM && cand.thread !== null;
    return { cand, result, rec, error, i, rank: error ? 2 : custom ? 1 : 0 };
  }).sort((a, b) => a.rank - b.rank || a.i - b.i);
}
