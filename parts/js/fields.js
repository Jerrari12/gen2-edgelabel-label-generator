// Field model for the part picker (no DOM, no data: usable from node tests and the browser).
//
// EVERY value in a part record is a Field:
//   { value, status, source }
//   status  'listed'   in the reference data (the tier on its source says how far to trust that)
//           'custom'   typed by the user, not in the reference data. Allowed, never blocked.
//           'unknown'  the user does not know. value is null and STAYS null: nothing fills it in.
//   source  null (unknown) | { ref, tier, ...extras }
//           tier 'documented' = in the bd_warehouse data (or a title it reproduces)
//                'unverified' = from our own tables (general knowledge, not checked)
//                'user'       = entered by hand
//           extras: standard (which standard's table it came from), prefill (true = filled in
//           from a documented standard entry and still replaceable), note, adopted_from.

export const STATUS = Object.freeze({ LISTED: 'listed', CUSTOM: 'custom', UNKNOWN: 'unknown' });
export const TIER = Object.freeze({
  DOCUMENTED: 'documented', // in the bd_warehouse data
  VERIFIED: 'verified',     // two independent public sources agree (URLs on the source)
  SINGLE: 'single',         // one source: a suggestion
  CONFLICT: 'conflict',     // sources disagree: a suggestion
  UNVERIFIED: 'unverified', // our own knowledge, not checked: a suggestion
  // a TERM the user picks ("dome head", "hammer-head drop-in"): not data and not an inference, so it reads as plain
  // Listed. Never prefills anything (design review 2026-10-04: Suggested means an inference, not "has no ISO number")
  VOCABULARY: 'vocabulary',
  USER: 'user',
});
// only these prefill; everything else is offered behind a Use button
export const PREFILL_TIERS = new Set([TIER.DOCUMENTED, TIER.VERIFIED]);

export const unknown = () => ({ value: null, status: STATUS.UNKNOWN, source: null });

// A record saved before a field existed gains it as Unknown (2026-10-04: material.colour). A set value never changes:
// "existing labels must not silently change because new catalog content or prediction rules arrived" (design review).
export function upgradeRecord(r) {
  if (r && r.material && typeof r.material === 'object' && !r.material.colour) r.material.colour = unknown();
  return r;
}

export function listed(value, source) {
  if (value === null || value === undefined) throw new TypeError('a listed field needs a value');
  if (!source || !source.ref || source.ref === 'user') throw new TypeError('a listed field needs a data source');
  return { value, status: STATUS.LISTED, source };
}

export function custom(value, extra = {}) {
  if (value === null || value === undefined || value === '') throw new TypeError('a custom field needs a value');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('a custom number must be finite');
  return { value, status: STATUS.CUSTOM, source: { ref: 'user', tier: TIER.USER, ...extra } };
}

export function source(ref, tier, extra = {}) {
  return { ref, tier, ...extra };
}

export const isField = (f) =>
  !!f && typeof f === 'object' && 'value' in f && 'status' in f && 'source' in f;

// text a person typed for a numeric field -> number, or null if it is not one.
// (This is input parsing, not a menu check: it never says a real number is "not allowed".)
export function parseNumber(text) {
  if (typeof text === 'number') return Number.isFinite(text) ? text : null;
  const t = String(text ?? '').trim().replace(',', '.').replace(/\s*mm$/i, '');
  if (t === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// ---- path helpers ('thread.diameter', 'specific.washer.od')
export function getPath(obj, path) {
  let cur = obj;
  for (const k of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[k];
  }
  return cur;
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] === null || cur[keys[i]] === undefined) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// every Field leaf in a record: [path, field]
export function* leaves(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object') return;
  if (isField(obj)) { yield [prefix, obj]; return; }
  if (Array.isArray(obj)) return;
  for (const [k, v] of Object.entries(obj)) {
    if (['source_refs'].includes(k) && !prefix) continue;
    yield* leaves(v, prefix ? prefix + '.' + k : k);
  }
}

// Invariants of a field. NOTE what is absent: nothing here rejects a custom value.
export function fieldProblems(path, f) {
  const out = [];
  if (!isField(f)) return [`${path}: not a field`];
  if (![STATUS.LISTED, STATUS.CUSTOM, STATUS.UNKNOWN].includes(f.status)) out.push(`${path}: bad status ${f.status}`);
  if (f.status === STATUS.UNKNOWN) {
    if (f.value !== null) out.push(`${path}: unknown but has a value (unknown is never filled in)`);
    if (f.source !== null) out.push(`${path}: unknown but has a source`);
  } else {
    if (f.value === null || f.value === undefined || f.value === '') out.push(`${path}: ${f.status} without a value`);
    if (typeof f.value === 'number' && !Number.isFinite(f.value)) out.push(`${path}: non-finite number`);
    if (!f.source || !f.source.ref) out.push(`${path}: ${f.status} without a source`);
    else if (f.status === STATUS.LISTED && (f.source.ref === 'user' || f.source.tier === TIER.USER))
      out.push(`${path}: listed but sourced from the user`);
    else if (f.status === STATUS.CUSTOM && f.source.ref !== 'user') out.push(`${path}: custom but not marked user-entered`);
  }
  return out;
}

export function recordProblems(rec) {
  const out = [];
  if (!rec || typeof rec !== 'object') return ['not a record'];
  if (rec.schema !== 'part-record/1') out.push('schema is not part-record/1');
  for (const [path, f] of leaves(rec)) out.push(...fieldProblems(path, f));
  return out;
}

export function collectRefs(rec) {
  const refs = new Set();
  for (const [, f] of leaves(rec)) {
    if (!f.source || !f.source.ref || f.source.ref === 'user') continue;
    refs.add(f.source.ref);
    for (const u of f.source.urls || []) refs.add(u); // verified values keep their public source URLs here
  }
  return [...refs].sort();
}

export const clone = (x) => JSON.parse(JSON.stringify(x));
