// Each family's builder sections, in order (moved out of js/ui.js on 2026-10-14 so the flow's stage table can be tested
// against every family without a page). Array entries [key, title] are drawn by ui.js's own sections; object entries
// { key, title, kind, path, ... } by its generic sections.
import { DATA_FAMILIES } from './families-data.js';

// family -> builder sections, in order: [key, title]
export const PLAN = {
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
export const planKey = (e) => (Array.isArray(e) ? e[0] : e.key);
export const planTitle = (e) => (Array.isArray(e) ? e[1] : e.title);
// the flow's view of a family's sections (js/flow.js): { key, multi, noun } - multi = the batch field, several parts at once
export function planEntries(family) {
  return (PLAN[family] || []).map((e) => (Array.isArray(e)
    ? { key: e[0], multi: e[0] === 'lengths' || e[0] === 'sizes', noun: e[0] === 'lengths' ? 'lengths' : e[0] === 'sizes' ? 'sizes' : null }
    : { key: e.key, multi: e.kind === 'batch' || e.kind === 'sizes', noun: e.kind === 'sizes' ? 'sizes' : e.noun || null }));
}
