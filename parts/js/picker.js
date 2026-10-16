// The picker engine: family registry, menus, cascades, prefill, drive-change rules.
// Pure functions over plain-JSON records; every mutation returns a NEW record.
// No DOM. The browser UI and the node tests both drive exactly this.

import {
  STATUS, TIER, PREFILL_TIERS, unknown, listed, custom, source, parseNumber, getPath, setPath, leaves, collectRefs, clone,
} from './fields.js';
import { DATA_FAMILIES } from './families-data.js';
import { isUnified, parseInch, normalizeDesignation, fracInch } from './units.js';

// ---------------------------------------------------------------------------
// family registry. Hardware only in v1; `category` leaves room for other categories later
// (a family is just: ordered paths + a blank body + which path a batch varies).

export const FAMILIES = new Map();
export function registerFamily(def) { FAMILIES.set(def.id, def); return def; }

// options: a VOCABULARY for families without a reference table - values (or { value, label }) the user picks from,
// listed with tier 'vocabulary'. A field without options and without a table takes only Unknown or Custom.
const p = (path, label, kind, group, numeric = false, options = null) => ({ path, label, kind, group, numeric, options });
const HEAD = (label) => p('head', label, 'select', 'main');
const DIA = (label) => p('thread.diameter', label, 'select', 'main', true);
const PITCH = p('thread.pitch', 'Pitch (mm)', 'select', 'main', true);
const PCLASS = p('thread.pitch_class', 'Pitch class', 'select', 'secondary');
const MATERIAL = [
  p('material.base', 'Base material', 'select', 'material'),
  p('material.stainless_group', 'Stainless group', 'select', 'material'),
  p('material.property_class', 'Property class', 'select', 'material'),
  p('material.finish', 'Finish', 'select', 'material'),
  p('material.colour', 'Colour', 'select', 'material'),      // apart from the treatment: anodized + blue (2026-10-04)
];
const thread = (pitch = true) => ({
  diameter: unknown(), pitch: pitch ? unknown() : null, pitch_class: pitch ? unknown() : null,
});

registerFamily({
  id: 'screw', label: 'Screws / bolts', category: 'hardware',
  varying: { path: 'length.value', label: 'Lengths (mm)' },
  // 2026-10-05: inch screws. thread.system / thread.tpi / thread.series exist only on an INCH record (units.js); a
  // metric record keeps exactly its old shape, so its paths stay as they were and these three read "not applicable"
  units: true,
  paths: [HEAD('Head'), p('thread.system', 'Thread system', 'select', 'main'), DIA('Thread'), PITCH,
    p('thread.tpi', 'Threads per inch', 'select', 'main', true),
    p('length.value', 'Length', 'select', 'main', true),
    p('specific.thread_extent', 'Thread extent', 'select', 'main'),
    p('drive.type', 'Drive type', 'select', 'secondary'), p('drive.tool_size', 'Tool size', 'select', 'secondary'),
    p('length.datum', 'Length datum', 'select', 'secondary'), PCLASS, p('thread.series', 'Thread series', 'select', 'secondary'),
    ...MATERIAL],
  body: () => ({ thread: thread(), length: { value: unknown(), datum: unknown() },
    drive: { type: unknown(), tool_size: unknown() }, specific: { thread_extent: unknown() } }),
});
registerFamily({
  id: 'nut', label: 'Nuts', category: 'hardware',
  varying: { path: 'thread.diameter', label: 'Thread sizes' },
  // 2026-10-05: inch nuts (design review: "Extend inch support to washers and nuts") - the thread as on a screw; no length
  units: true,
  paths: [HEAD('Nut type'), p('thread.system', 'Thread system', 'select', 'main'), DIA('Thread'), PITCH,
    p('thread.tpi', 'Threads per inch', 'select', 'main', true), p('specific.locking_feature', 'Locking feature', 'select', 'main'),
    p('drive.type', 'Drive type', 'select', 'secondary'), p('drive.tool_size', 'Wrench size (across flats; mm, or inches on an inch nut)', 'select', 'secondary'),
    p('specific.height', 'Nut height, max (mm)', 'select', 'secondary', true),
    p('thread.series', 'Thread series', 'select', 'secondary'), PCLASS, ...MATERIAL],
  body: () => ({ thread: thread(), length: null, drive: { type: unknown(), tool_size: unknown() },
    specific: { locking_feature: unknown(), height: unknown() } }),
});
registerFamily({
  id: 'washer', label: 'Washers', category: 'hardware',
  varying: { path: 'thread.diameter', label: 'Nominal sizes' },
  // 2026-10-05: inch washers - a size DESIGNATION ('#10', '1/4') and no threads per inch
  units: true,
  paths: [HEAD('Washer type'), p('thread.system', 'Size system', 'select', 'main'), DIA('Nominal size'),
    p('specific.washer.id', 'Inner diameter (mm)', 'select', 'secondary', true),
    p('specific.washer.od', 'Outer diameter (mm)', 'select', 'main', true),
    p('specific.washer.thickness', 'Thickness (mm)', 'select', 'main', true), ...MATERIAL],
  body: () => ({ thread: thread(false), length: null, drive: null,
    specific: { washer: { id: unknown(), od: unknown(), thickness: unknown() } } }),
});
registerFamily({
  id: 'setscrew', label: 'Set screws', category: 'hardware',
  varying: { path: 'length.value', label: 'Lengths (mm)' },
  paths: [HEAD('Type'), DIA('Thread'), PITCH, p('length.value', 'Length (mm)', 'select', 'main', true),
    p('specific.point_type', 'Point type', 'select', 'main'),
    p('drive.type', 'Drive type', 'select', 'secondary'), p('drive.tool_size', 'Tool size', 'select', 'secondary'),
    p('length.datum', 'Length datum', 'select', 'secondary'), PCLASS, ...MATERIAL],
  body: () => ({ thread: thread(), length: { value: unknown(), datum: unknown() },
    drive: { type: unknown(), tool_size: unknown() }, specific: { point_type: unknown() } }),
});
registerFamily({
  id: 'insert', label: 'Inserts', category: 'hardware',
  varying: { path: 'thread.diameter', label: 'Internal thread sizes' },
  paths: [HEAD('Insert type'), DIA('Internal thread'), PITCH,
    p('specific.insert.brand_dataset', 'Brand dataset', 'select', 'main'),
    p('specific.insert.outer_diameter', 'Outside diameter (mm)', 'select', 'main', true),
    p('specific.insert.length', 'Insert length (mm)', 'select', 'main', true), PCLASS, ...MATERIAL],
  body: () => ({ thread: thread(), length: null, drive: null,
    specific: { insert: { brand_dataset: unknown(), outer_diameter: unknown(), length: unknown() } } }),
});

// ---- the next families (2026-10-04, docs/FAMILIES-PLAN-2026-10-04.md): Jerrari's actual stock first. No reference
// tables: every choice is VOCABULARY, nothing is inferred, and any value can be typed as Custom.
const v = (value, label) => ({ value, label });
const BASE_FINISH = [MATERIAL[0], MATERIAL[3], MATERIAL[4]];
registerFamily({
  id: 'fitting', label: 'Tube fittings', category: 'hardware', standardless: true,
  varying: { path: 'specific.fitting.tube_a', label: 'Tube OD, end A (mm)' },
  paths: [
    HEAD('Shape'),
    p('specific.fitting.tube_a', 'Tube OD, end A (mm)', 'select', 'main', true, [3, 4, 6, 8, 10, 12]),
    p('specific.fitting.tube_b', 'Tube OD, end B (mm)', 'select', 'main', true, [3, 4, 6, 8, 10, 12]),
    // the FULL designation: G1/8 (parallel) and R1/8 (taper) are different parts, so never just "1/8"
    p('specific.fitting.thread', 'Thread designation', 'select', 'main', false,
      ['M3', 'M5', 'M6', 'M8x1', 'M10x1', 'M12x1.5', 'G1/8', 'G1/4', 'R1/8', 'R1/4', 'NPT 1/8', 'NPT 1/4', 'UNF 10-32']),
    p('specific.fitting.construction', 'Construction', 'select', 'main', false, ['tube stop', 'pass-through']),
    ...BASE_FINISH],
  headOptions: [v('straight-male', 'Straight, male thread'), v('straight-union', 'Straight union'), v('reducing-union', 'Reducing union'),
    v('elbow-male', 'Elbow, male thread'), v('elbow-union', 'Elbow union'), v('tee-union', 'Tee union'), v('bulkhead-union', 'Bulkhead union'),
    v('push-in-cartridge', 'Push-in cartridge'), v('plug', 'Plug')],
  body: () => ({ thread: null, length: null, drive: null,
    specific: { fitting: { tube_a: unknown(), tube_b: unknown(), thread: unknown(), construction: unknown() } } }),
});
registerFamily({
  id: 'tnut', label: 'Extrusion T-nuts', category: 'hardware', standardless: true,
  varying: { path: 'thread.diameter', label: 'Thread sizes' },
  paths: [
    HEAD('Insertion type'),
    p('specific.tnut.profile', 'Profile / interface', 'select', 'main', false,
      ['2020 B-type', '2020 I-type', '2020 V-slot', '3030 B-type', '4040 B-type', '4040 I-type']),
    p('specific.tnut.slot', 'Slot width (mm)', 'select', 'main', true, [5, 6, 8, 10]),
    DIA('Thread'),
    p('specific.tnut.spring', 'Spring / ball', 'select', 'main', false, ['none', 'spring leaf', 'ball spring']),
    ...BASE_FINISH],
  headOptions: [v('drop-in-hammer', 'Drop-in, hammer head'), v('roll-in', 'Roll-in'), v('sliding-t', 'Sliding T (pre-assembly)'),
    v('two-hole', 'Two-hole T plate')],
  body: () => ({ thread: thread(false), length: null, drive: null,
    specific: { tnut: { profile: unknown(), slot: unknown(), spring: unknown() } } }),
});
registerFamily({
  id: 'rivet', label: 'Blind rivets', category: 'hardware', standardless: true,
  varying: { path: 'specific.rivet.length', label: 'Body lengths (mm)' },
  paths: [
    HEAD('Head style'),
    p('specific.rivet.diameter', 'Body diameter (mm)', 'select', 'main', true, [2.4, 3, 3.2, 4, 4.8, 5, 6, 6.4]),
    p('specific.rivet.length', 'Body length (mm)', 'select', 'main', true, [4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25]),
    // grip range is kept SEPARATE from body length (design review): it is typed from the package, never derived
    p('specific.rivet.grip_min', 'Grip range, min (mm)', 'select', 'main', true),
    p('specific.rivet.grip_max', 'Grip range, max (mm)', 'select', 'main', true),
    p('specific.rivet.type', 'Type', 'select', 'main', false, ['open end', 'closed end', 'multi-grip', 'peel', 'structural']),
    p('specific.rivet.body_material', 'Body material', 'select', 'main', false, ['aluminium', 'steel', 'stainless', 'copper', 'monel']),
    p('specific.rivet.mandrel_material', 'Mandrel material', 'select', 'main', false, ['steel', 'aluminium', 'stainless'])],
  headOptions: [v('dome', 'Dome'), v('countersunk', 'Countersunk'), v('large-flange', 'Large flange')],
  body: () => ({ thread: null, length: null, drive: null,
    specific: { rivet: { diameter: unknown(), length: unknown(), grip_min: unknown(), grip_max: unknown(), type: unknown(),
      body_material: unknown(), mandrel_material: unknown() } } }),
});
// DATA-DRIVEN FAMILIES (2026-10-04, library expansion): standoffs, shoulder screws, pins, retaining rings, lock
// washers, threaded rod, thumb screws - defined as data in families-data.js; nothing here is per family.
for (const df of DATA_FAMILIES) {
  const fields = df.fields.map((f) => (f.thread ? DIA(f.title)
    : p(f.path, f.unit ? `${f.title} (${f.unit})` : f.title, 'select', 'main', !!f.numeric,
      f.options.map((o) => (Array.isArray(o) ? v(o[0], o[1]) : o)))));
  const vary = df.fields.find((f) => f.batch);
  registerFamily({
    id: df.id, label: df.label, category: 'hardware', standardless: true, data: df,
    varying: vary ? { path: vary.path, label: vary.thread ? 'Thread sizes' : `${vary.title}${vary.unit ? ` (${vary.unit})` : ''}` } : null,
    paths: [HEAD(df.headTitle), ...fields, ...BASE_FINISH],
    headOptions: df.heads.map(([id, label]) => v(id, label)),
    body: () => {
      const own = {};
      for (const f of df.fields) if (!f.thread) own[f.key] = unknown();
      return { thread: df.fields.some((f) => f.thread) ? thread(false) : null, length: null, drive: null, specific: { [df.ns]: own } };
    },
  });
}
// OTHER PART (design review): save it NOW - name, photo, package text, dimensions, supplier - and give it a family later
// (reassignFamily keeps its id, so its label and drawer association survive). Its details live in record.label /
// record.meta, which every family may carry.
registerFamily({
  id: 'other', label: 'Other part', category: 'hardware', standardless: true, varying: null, paths: [],
  body: () => ({ thread: null, length: null, drive: null, specific: {} }),
});

// paths a standard entry may prefill (and which stay replaceable until the user touches them)
const PREFILL_PATHS = ['drive.type', 'drive.tool_size', 'length.datum', 'specific.height',
  'specific.washer.id', 'specific.washer.od', 'specific.washer.thickness'];

// fields whose Listed status depends on the attached standard (they go Custom if it is dropped)
const STD_BOUND = ['length.value', ...PREFILL_PATHS];

export function pathsFor(familyId) { return FAMILIES.get(familyId).paths; }
// record-level keys a person sets outside the typed fields (setMeta); carried through a head change and a reassignment
// label_pins (2026-10-05): the field paths the user pinned to the printed label - js/labelpins.js
// label_pins_removed: the pins a family change removed ([{path, family}]) - written by reassignFamily only; setMeta can
// only dismiss it (null)
// label_words (design review 2026-10-05: "Keep the short forms provisional ... allow custom wording"): {path: text}, the person's
// own printed form for a field (STAR WASHER for TOOTH LW); never a value - it replaces the short form of a recorded one
// label_colours (design review 2026-10-06: "Allow an intentional manual override"): {band?, band_accent?}, a colour key of the
// collection's label scheme (labelstyle.js) that wins over the scheme's rule for this part, shown as set by hand
export const META_KEYS = ['label', 'meta', 'photo', 'tags', 'label_pins', 'label_pins_removed', 'label_words', 'label_colours'];
export const LABEL_WORD_MAX = 24;
export function pathDef(familyId, path) { return pathsFor(familyId).find((d) => d.path === path) || null; }

// ---------------------------------------------------------------------------

const same = (a, b) => (typeof a === 'number' || typeof b === 'number' ? Number(a) === Number(b) : a === b);
const opt = (value, label, tier, ref, extra = {}) => ({ value, label, tier, ref, ...extra });

export function defaultIdGen(prefix = 'rec') {
  let n = 0;
  const stamp = Date.now().toString(36);
  return () => `${prefix}_${stamp}_${(++n).toString(36)}`;
}

export function createPicker(D, opts = {}) {
  const idgen = opts.idgen || defaultIdGen();

  const stdOf = (rec) => D.std(rec.table_basis);
  const rowOf = (rec) => {
    const std = stdOf(rec);
    if (!std || !std.sizes) return null;
    // an inch row is a designation AND its threads per inch (#10-24 and #10-32 are two rows)
    if (isUnified(rec)) return D.row(rec.table_basis, rec.thread.diameter.value, rec.thread.tpi ? rec.thread.tpi.value : null);
    return D.row(rec.table_basis, rec.thread.diameter.value);
  };
  const UNI = (designation) => D.own.unified_series.find((u) => u.designation === designation) || null;
  // tier of data read from a standard's table for THIS record: a set screw that is not
  // a flat point only borrows the ISO 4026 table
  // tier of data read from a standard's table for THIS record: a set screw that is not a flat point
  // only borrows the ISO 4026 table; a row can carry its own tier (verified / single / unverified)
  const tierFor = (rec, std, row) => (rec.family === 'setscrew' && rec.standard === null
    ? TIER.UNVERIFIED : (row && row.tier) || std.tier);
  const noteFor = (rec) => (rec.family === 'setscrew' && rec.standard === null
    ? 'borrowed from the ISO 4026 (flat point) table; this point type is not in the data' : null);
  const urlsOf = (row, std) => (row && row.sources) || (std && std.sources) || null;
  const corrOf = (row, field) => (row && row.corrections ? row.corrections.find((c) => c.field === field) || null : null);
  const corrNote = (c) => `corrected from ${c.from} to ${c.to} (${c.status}; overlay ${c.id})`;
  const flagText = (f) => (f.status === 'conflict' ? 'CONFLICT: ' : '') + f.message;

  // The wrench size of a standard's row for this record, or null. Hex nuts and hex bolts at M10 / M12
  // are AMBIGUOUS (ISO 16 / 18, DIN 17 / 19): both are offered, neither is prefilled.
  function toolEntry(rec, std, row) {
    const dia = rec.thread.diameter.value;
    if (!std || !rec.drive || dia === null) return null;
    if (isUnified(rec)) {                            // an inch hex key, as the table writes it ('5/32 in'): no mm tables
      return row && row.tool_size ? { value: row.tool_size.value, tier: row.tool_size.tier, ref: D.refOf(std, row, 'tool_size'),
        standard: std.id, note: row.tool_size.basis } : null;
    }
    const amb = D.own.width_ambiguity;
    const alts = amb.standards.includes(std.id) ? amb.diameters[String(dia)] : null;
    if (alts) {
      return { ambiguous: alts.map((a) => ({ value: a.value, label: a.label })), hint: amb.hint, tier: amb.status,
        ref: `own/width_ambiguity/${dia}`, urls: amb.sources, note: amb.note, standard: std.id };
    }
    if (row && row.tool_size) {
      return { value: row.tool_size.value, tier: row.tool_size.tier, ref: D.refOf(std, row, 'tool_size'), standard: std.id,
        urls: row.tool_size.sources || null, note: row.tool_size.note || row.tool_size.basis };
    }
    const t = (D.own.tool_sizes[std.id] || []).find((e) => e.diameter === dia);
    if (t) {
      return { value: t.value, tier: t.status, ref: `own/tool_sizes/${std.id}/M${dia}`, standard: std.id, urls: t.sources,
        note: t.note };
    }
    return null;
  }

  // ---------------------------------------------------------------- inch (Unified) options
  // Returns `out` when the inch rules answer this path, null when the ordinary (metric / generic) branch should.
  function unifiedOptions(rec, path, out, std, row) {
    const uni = isUnified(rec);
    const inchStd = std && std.units === 'in' ? std : null;
    const dia = rec.thread ? rec.thread.diameter.value : null;
    switch (path) {
      case 'thread.system':
        out.options = D.own.thread_systems.map((t) => opt(t.value, t.label, TIER.VOCABULARY, `own/thread_systems/${t.value}`));
        return out;
      case 'thread.tpi':
      case 'thread.series':
        if (!uni) { out.enabled = false; out.reason = 'metric threads are given as a pitch in mm'; return out; }
        if (path === 'thread.series') {
          out.options = ['UNC', 'UNF'].map((v) => opt(v, v, TIER.VOCABULARY, `own/thread_series/${v}`));
          out.note = 'read from the threads per inch (the Unified series table); never inferred for a custom TPI';
          return out;
        }
        if (dia === null) { out.reason = 'choose the size first'; return out; }
        {
          const seen = new Set();
          const u = UNI(dia);
          if (inchStd) {
            for (const r of inchStd.sizes.filter((x) => x.diameter === dia)) {
              seen.add(r.tpi);
              out.options.push(opt(r.tpi, `${r.tpi}${r.series ? ` (${r.series})` : ''}`, TIER.DOCUMENTED, D.refOf(inchStd, r, 'tpi'),
                { standard: inchStd.id, series: r.series, isDefault: r.series === 'UNC' }));
            }
          }
          if (u) {
            for (const [k, v] of [['UNC', u.unc], ['UNF', u.unf]]) {
              if (v === null || seen.has(v)) continue;
              out.options.push(opt(v, `${v} (${k})`, TIER.VERIFIED, `own/unified_series/${dia}#${k.toLowerCase()}`,
                { series: k, isDefault: k === 'UNC', urls: u.sources }));
            }
          }
          if (!out.options.some((o) => o.isDefault) && out.options.length === 1) out.options[0].isDefault = true;  // #0: UNF only
        }
        return out;
      case 'thread.pitch': case 'thread.pitch_class':
        out.enabled = false; out.reason = 'an inch thread is given in threads per inch (TPI)';
        return out;
      case 'thread.diameter': {
        if (inchStd) {
          const seen = new Set();
          for (const r of inchStd.sizes) {
            if (seen.has(r.diameter)) continue;
            seen.add(r.diameter);
            out.options.push(opt(r.diameter, r.name.startsWith('#') ? r.name : `${r.name}"`, TIER.DOCUMENTED, D.refOf(inchStd, r, 'size'),
              { standard: inchStd.id, major_in: r.major_in }));
          }
        } else {
          for (const u of D.own.unified_series) {
            out.options.push(opt(u.designation, u.designation.startsWith('#') ? u.designation : `${u.designation}"`, TIER.VERIFIED,
              `own/unified_series/${u.designation}`, { urls: u.sources, major_in: u.major_in }));
          }
        }
        return out;
      }
      case 'length.value': {
        out.unit = 'in';
        if (inchStd) {
          const tpiOk = rec.thread.tpi.value === null || !!row;
          const list = row ? row.lengths : inchStd.nominal_lengths;
          for (const v of list) {
            out.options.push(opt(v, fracInch(v), tpiOk ? TIER.DOCUMENTED : TIER.UNVERIFIED, D.refOf(inchStd, row, 'lengths'),
              { standard: inchStd.id, note: tpiOk ? null : `${dia}-${rec.thread.tpi.value} is not a row of ${inchStd.id}: its whole nominal list, unverified for this size` }));
          }
          out.note = row ? `listed nominal lengths up to ${fracInch(row.long)}"; nothing shorter than 3/4" is in the data - type it`
            : 'listed nominal lengths for this standard; choose the size for its own list';
        } else {
          out.note = 'no inch length data for this head: type the length in inches (1-1/4, 1 1/4 or 1.25)';
        }
        return out;
      }
      case 'drive.tool_size': {
        const te = std && rec.drive && rec.drive.type.value === std.drive_type ? toolEntry(rec, std, row) : null;
        if (te) out.options.push(opt(te.value, te.value, te.tier, te.ref, { standard: te.standard, note: te.note }));
        out.note = 'an inch hex key, as the table writes it; type any other (the mm key list does not apply)';
        if (!rec.drive || !rec.drive.type.value) out.reason = 'choose the drive type first';
        return out;
      }
      case 'head':
        out.options = D.heads(rec.family).map((h) => {
          const hs = D.std(h.unified_standard);
          return opt(h.id, h.label, hs ? TIER.DOCUMENTED : TIER.VOCABULARY, `own/heads/${rec.family}/${h.id}`,
            { standard: h.unified_standard || null, note: hs ? null : 'no inch table for this head: its sizes and lengths are typed' });
        });
        return out;
      default:
        return null;
    }
  }

  // ---------------------------------------------------------------- options
  function optionsFor(rec, path) {
    const fam = FAMILIES.get(rec.family);
    const def = fam.paths.find((d) => d.path === path);
    if (!def) throw new Error(`no field ${path} in family ${rec.family}`);
    const out = { path, kind: def.kind, numeric: def.numeric, options: [], enabled: true, reason: null, note: null };
    const std = stdOf(rec);
    const row = rowOf(rec);
    const dia = rec.thread ? rec.thread.diameter.value : null;   // fittings, rivets and Other have no M thread

    // a VOCABULARY (the families without reference tables): the terms to pick from, tier 'vocabulary'
    const vocab = path === 'head' && !D.heads(rec.family).length ? fam.headOptions : def.options;
    if (vocab) {
      out.options = vocab.map((o) => {
        const value = typeof o === 'object' ? o.value : o;
        return opt(value, typeof o === 'object' ? o.label : String(o), TIER.VOCABULARY, `vocab/${rec.family}/${path}/${value}`);
      });
      return out;
    }

    const uni = isUnified(rec);
    if (uni || ['thread.system', 'thread.tpi', 'thread.series'].includes(path)) {
      const u = unifiedOptions(rec, path, out, std, row);
      if (u) return u;
    }
    switch (path) {
      case 'head':
        out.options = D.heads(rec.family).map((h) => {
          const hs = D.std(h.standard);
          return opt(h.id, h.label, hs && hs.origin === 'bd_warehouse' ? TIER.DOCUMENTED : (hs ? hs.tier : TIER.UNVERIFIED),
            `own/heads/${rec.family}/${h.id}`, { standard: h.standard });
        });
        break;
      case 'thread.diameter': {
        if (std && std.sizes) {
          const seen = new Set();
          for (const r of std.sizes) {
            if (seen.has(r.diameter)) continue;
            seen.add(r.diameter);
            out.options.push(opt(r.diameter, r.name, tierFor(rec, std, r), D.refOf(std, r, 'size'),
              { standard: std.id, note: noteFor(rec), urls: urlsOf(r, std) }));
          }
        } else {
          for (const c of D.bd.coarse_series) {
            out.options.push(opt(c.diameter, c.name, c.tier || TIER.DOCUMENTED, `${D.version}/coarse_series/${c.name}`,
              { urls: c.sources || null }));
          }
        }
        break;
      }
      case 'thread.pitch': {
        if (dia === null) { out.reason = 'choose the thread diameter first'; }
        let coarse = null;
        out.corrections = [];
        const cv = (p) => D.own.coarse_verified.find((x) => x.diameter === dia && x.pitch === p);
        if (row && row.pitch !== null && row.pitch !== undefined) {
          coarse = row.pitch;
          let tier = tierFor(rec, std, row);
          let urls = urlsOf(row, std);
          if (tier === TIER.DOCUMENTED && cv(row.pitch)) { tier = TIER.VERIFIED; urls = cv(row.pitch).sources; }
          const c = corrOf(row, 'pitch');
          if (c) out.corrections.push(corrNote(c));
          out.options.push(opt(row.pitch, `${row.pitch} (coarse)`, tier, D.refOf(std, row, 'pitch'),
            { pitch_class: 'coarse', isDefault: true, group: 'coarse', standard: std.id, note: noteFor(rec), urls,
              corrected_from: c ? c.from : undefined, correction: c ? c.id : undefined }));
        } else {
          const c = D.bd.coarse_series.find((s) => s.diameter === dia);
          if (c) {
            coarse = c.pitch;
            out.options.push(opt(c.pitch, `${c.pitch} (coarse)`, c.tier || TIER.DOCUMENTED,
              `${D.version}/coarse_series/${c.name}`, { pitch_class: 'coarse', isDefault: true, group: 'coarse', urls: c.sources || null }));
          }
        }
        out.flags = row ? D.flagsForRow(std.id, row).filter((f) => f.kind === 'pitch-differs-from-coarse').map(flagText) : [];
        // fine pitches: ISO 262 selected ones first, the rest of ISO 261 under "more"
        const fines = D.own.fine_pitches.filter((fp) => fp.diameter === dia && fp.pitch !== coarse);
        for (const grp of ['iso262', 'more']) {
          for (const fp of fines.filter((x) => x.group === grp)) {
            out.options.push(opt(fp.pitch, `${fp.pitch} (fine)`, fp.status, `own/fine_pitches/M${fp.diameter}x${fp.pitch}`,
              { pitch_class: 'fine', group: grp, urls: fp.sources || null }));
          }
        }
        break;
      }
      case 'thread.pitch_class':
        out.options = ['coarse', 'fine'].map((v) => opt(v, v, TIER.UNVERIFIED, `own/pitch_class/${v}`));
        break;
      case 'length.value': {
        out.corrections = [];
        if (std && row && row.lengths) {
          const pitchOk = rec.thread.pitch.value === null || rec.thread.pitch.value === row.pitch;
          const base = pitchOk ? tierFor(rec, std, row) : TIER.UNVERIFIED;
          const note = pitchOk ? noteFor(rec)
            : 'listed lengths belong to the coarse-pitch row; this pitch is not in the data';
          out.flags = D.flagsForRow(std.id, row)
            .filter((f) => f.kind.startsWith('range') || f.kind === 'bound-not-in-list').map(flagText);
          const orig = row.original_range || { short: row.short, long: row.long };
          for (const c of (row.corrections || []).filter((x) => x.field === 'short' || x.field === 'long')) {
            out.corrections.push(`listed range ${c.field}: ${corrNote(c)}`);
          }
          const urls = urlsOf(row, std);
          for (const v of row.lengths) {
            let tier = base; let n = note; let cr = null;
            if (v > orig.long) cr = corrOf(row, 'long'); else if (v < orig.short) cr = corrOf(row, 'short');
            if (cr) { tier = pitchOk ? cr.status : TIER.UNVERIFIED; n = `inside the range as corrected (${cr.status}, overlay ${cr.id})`; }
            out.options.push(opt(v, String(v), tier, D.refOf(std, row, 'lengths'), { standard: std.id, note: n, urls }));
          }
        } else if (D.listsOnly(rec.table_basis)) {
          const lo = D.listsOnly(rec.table_basis);
          out.note = 'listed nominal lengths for this standard; the per-size range is not in the data';
          for (const v of lo.nominal_lengths) {
            out.options.push(opt(v, String(v), TIER.DOCUMENTED, `${D.version}/${lo.id}#nominal_lengths`, { standard: lo.id }));
          }
        }
        if (!out.options.length) out.note = out.note || 'no listed lengths for this selection: enter the length as Custom';
        break;
      }
      case 'length.datum':
        out.options = D.own.length_datums.map((r) => opt(r.value, r.value, TIER.UNVERIFIED, `own/length_datums/${r.value}`));
        break;
      case 'drive.type':
        out.options = D.own.drive_types.map((d) => opt(d.id, d.label, TIER.UNVERIFIED, `own/drive_types/${d.id}`));
        break;
      case 'drive.tool_size': {
        const dt = D.driveType(rec.drive.type.value);
        const seen = new Set();
        const add = (v, tier, ref, extra) => {
          if (!seen.has(String(v))) { seen.add(String(v)); out.options.push(opt(v, extra.label || String(v), tier, ref, extra)); }
        };
        const lo = D.listsOnly(rec.table_basis);
        let te = null;
        if (std && rec.drive.type.value === std.drive_type) te = toolEntry(rec, std, row);
        else if (lo && lo.tool_sizes && rec.drive.type.value === lo.drive_type && dia !== null && lo.tool_sizes[String(dia)]) {
          const t = lo.tool_sizes[String(dia)];
          te = { value: t.value, tier: t.tier, ref: `own/${lo.id}/tool_sizes/M${dia}`, standard: lo.id, urls: t.sources, note: t.basis };
        }
        if (te && te.ambiguous) {
          for (const a of te.ambiguous) {
            add(a.value, te.tier, `own/width_ambiguity/${dia}/${a.value}`, { label: `${a.value} (${a.label})`, urls: te.urls, note: te.hint });
          }
          out.note = `ISO and DIN differ at M${dia}: ${te.hint}.`;
        } else if (te) {
          add(te.value, te.tier, te.ref, { standard: te.standard, urls: te.urls, note: te.note });
        }
        if (dt) for (const v of dt.tool_sizes) add(v, TIER.UNVERIFIED, `own/drive_types/${dt.id}/${v}`, {});
        if (!rec.drive.type.value) out.reason = 'choose the drive type first';
        break;
      }
      case 'material.base': case 'material.stainless_group': case 'material.property_class': case 'material.finish': case 'material.colour': {
        const key = path.split('.')[1];
        // a colour is read off the part or the bag: VOCABULARY (design review: plain Listed, never "unverified")
        const tier = key === 'colour' ? TIER.VOCABULARY : TIER.UNVERIFIED;
        // a family's own list replaces the shared one where its parts never come in some of those (an insert is not nylon
        // and has no property class: own_tables material_by_family, Joey 2026-10-15); an empty list switches the field off
        const own = D.own.material_by_family && D.own.material_by_family[rec.family] && D.own.material_by_family[rec.family][key];
        const list = own || D.own.material[key];
        const where = own ? `own/material_by_family/${rec.family}/${key}` : `own/material/${key}`;
        // a family row may carry its own provenance (a nut's ISO 898-2 classes are verified): its status is its tier
        out.options = list.map((r) => opt(r.value, r.value, own && key !== 'colour' && r.status ? r.status : tier, `${where}/${r.value}`,
          own && r.sources ? { urls: r.sources } : {}));
        // material is kept when the family changes, so a value from the old family (nylon from a screw) can be held here:
        // it stays on screen with its own button rather than hidden, so nothing out of sight goes on reaching the label
        // A typed (Custom) value shows in its row whatever the list, so it only needs the row kept on (Terra 01a14209)
        const held = rec.material[key];
        const offList = own && held && held.status === STATUS.LISTED && !own.some((r) => r.value === held.value);
        const inOffField = own && !own.length && held && held.status !== STATUS.UNKNOWN;
        if (offList) out.options.push(opt(held.value, held.value, tier, `own/material/${key}/${held.value}`));
        if (offList || inOffField) out.note = `${held.value} was kept from before; it is not usual for this kind of part. Choose Unknown to clear it.`;
        if (own && !own.length && !inOffField) { out.enabled = false; out.reason = key === 'property_class' ? 'property classes rate bolts, screws and nuts; this part has none' : 'not used for this kind of part'; }
        if (key === 'stainless_group' && rec.material.base.value !== 'stainless') {
          out.enabled = false; out.reason = 'only when the base material is stainless';
        }
        break;
      }
      case 'specific.thread_extent':
        out.options = D.own.thread_extent.map((r) => opt(r.value, r.value, TIER.UNVERIFIED, `own/thread_extent/${r.value}`));
        break;
      case 'specific.locking_feature':
        out.options = D.own.locking_features.map((r) => opt(r.id, r.label, TIER.UNVERIFIED, `own/locking_features/${r.id}`));
        break;
      case 'specific.point_type':
        out.options = D.own.point_types.map((r) => opt(r.id, r.label, TIER.UNVERIFIED, `own/point_types/${r.id}`, { standard: r.standard }));
        break;
      case 'specific.height': {
        const v = row ? (row.dims.m !== undefined ? row.dims.m : row.dims.h) : undefined;
        if (v !== undefined) {
          const c = corrOf(row, 'dims.m');
          out.options.push(opt(v, String(v), tierFor(rec, std, row), D.refOf(std, row, 'm'), { standard: std.id, urls: urlsOf(row, std) }));
          out.corrections = c ? [corrNote(c)] : [];
        }
        out.note = 'the maximum height; shown from the data, typed only if Custom';
        break;
      }
      case 'specific.washer.id': case 'specific.washer.od': case 'specific.washer.thickness': {
        const k = { id: 'd1', od: 'd2', thickness: 'h' }[path.split('.')[2]];
        if (std && row && row.dims[k] !== undefined) {
          const c = corrOf(row, `dims.${k}`);
          out.options.push(opt(row.dims[k], String(row.dims[k]), tierFor(rec, std, row), D.refOf(std, row, k),
            { standard: std.id, urls: urlsOf(row, std), note: row.note || null,
              corrected_from: c ? c.from : undefined, correction: c ? c.id : undefined }));
          out.corrections = c ? [corrNote(c)] : [];
        }
        out.note = 'nominal value, shown from the data; typed only if Custom';
        break;
      }
      case 'specific.insert.brand_dataset':
        out.options = Object.keys(D.bd.insert_brands).map((b) => opt(b, b, TIER.UNVERIFIED, `${D.version}/insert_brands/${b}`));
        out.note = 'optional: a brand dataset lists outside diameter and length for that brand';
        break;
      case 'specific.insert.outer_diameter': case 'specific.insert.length': {
        const brand = rec.specific.insert.brand_dataset.value;
        const key = path.endsWith('length') ? 'length' : 'outer_diameter';
        const seen = new Set();
        if (brand && D.bd.insert_brands[brand]) {
          for (const r of D.bd.insert_brands[brand]) {
            if (dia !== null && r.diameter !== dia) continue;
            if (r[key] === null || seen.has(r[key])) continue;
            seen.add(r[key]);
            out.options.push(opt(r[key], String(r[key]), TIER.UNVERIFIED, `${D.version}/insert_brands/${brand}/${r.size}#${key}`));
          }
        }
        break;
      }
      default: break;
    }
    return out;
  }

  // ---------------------------------------------------------------- field construction
  function srcOf(o) {
    const extra = {};
    if (o.standard) extra.standard = o.standard;
    if (o.note) extra.note = o.note;
    if (o.urls) extra.urls = o.urls;
    if (o.corrected_from !== undefined) { extra.corrected_from = o.corrected_from; extra.correction = o.correction; }
    return source(o.ref, o.tier, extra);
  }

  // Turn "what the user did" into a Field. mode: 'listed' | 'custom' | 'unknown'.
  // A listed pick that is not in the menu, or a custom entry, is CUSTOM - never refused.
  // A custom entry that happens to equal a listed value IS the listed value (data lookup is truthful).
  function makeField(rec, path, input) {
    const def = pathDef(rec.family, path);
    if (!input || input.mode === STATUS.UNKNOWN || input.value === null || input.value === undefined || input.value === '') {
      return unknown();
    }
    let v = input.value;
    if (isUnified(rec) && path === 'thread.diameter') {               // an inch SIZE designation, never a number of mm
      // a menu value is taken as it is ('1' is the 1-inch size in the Unified table); typed text is normalized
      const exact = optionsFor(rec, path).options.find((x) => x.value === String(v).trim());
      const d = exact ? exact.value : normalizeDesignation(v);
      if (d === null) throw new RangeError(`${path}: "${v}" is not an inch size (#10, 1/4, 1" ...)`);
      v = d;
    } else if (isUnified(rec) && path === 'length.value') {           // inches: 1-1/4, 1 1/4, 1.25
      const n = parseInch(v);
      if (n === null) throw new RangeError(`${path}: "${v}" is not a length in inches (1-1/4, 1 1/4 or 1.25)`);
      v = n;
    } else if (def.numeric) {
      const n = parseNumber(v);
      if (n === null) throw new RangeError(`${path}: "${v}" is not a number`);
      v = n;
    } else if (typeof v === 'string') {
      v = v.trim();
      if (v === '') return unknown();
    } else if (typeof v === 'number' && !Number.isFinite(v)) {
      throw new RangeError(`${path}: not finite`);
    }
    const o = optionsFor(rec, path).options.find((x) => same(x.value, v));
    if (o) return listed(o.value, srcOf(o));
    return custom(v);
  }

  // a field that was listed is looked up again in the (changed) menu: same value, fresh
  // source/tier; value not in the menu any more -> Custom (value kept, never dropped)
  function reresolve(rec, path) {
    const f = getPath(rec, path);
    if (!f || f.status !== STATUS.LISTED) return;
    const o = optionsFor(rec, path).options.find((x) => same(x.value, f.value));
    setPath(rec, path, o ? listed(o.value, srcOf(o)) : custom(f.value, { adopted_from: f.source.standard || null }));
  }

  // ---------------------------------------------------------------- prefill / suggestions
  function prefillEntries(rec) {
    const std = stdOf(rec);
    const lo = D.listsOnly(rec.table_basis);
    const dia = rec.thread ? rec.thread.diameter.value : null;
    const out = {};
    if (std) {
      const row = rowOf(rec);
      const tier = tierFor(rec, std, row);
      const urls = urlsOf(row, std);
      if (rec.drive && std.drive_type) {
        out['drive.type'] = { value: std.drive_type, tier: std.drive_tier || std.tier, ref: D.refOf(std, null, 'drive_type'), standard: std.id };
        if (rec.drive.type.value === std.drive_type) {
          const te = toolEntry(rec, std, row);
          if (te) out['drive.tool_size'] = te;
        }
      }
      if (rec.length && std.datum) {
        out['length.datum'] = { value: std.datum, tier: std.tier, ref: D.refOf(std, null, 'datum'), standard: std.id };
      }
      if (rec.family === 'washer' && row) {
        for (const [k, d] of [['id', 'd1'], ['od', 'd2'], ['thickness', 'h']]) {
          if (row.dims[d] !== undefined) {
            const c = corrOf(row, `dims.${d}`);
            out[`specific.washer.${k}`] = { value: row.dims[d], tier, ref: D.refOf(std, row, d), standard: std.id, urls,
              note: row.note || undefined, corrected_from: c ? c.from : undefined, correction: c ? c.id : undefined };
          }
        }
      }
      if (rec.family === 'nut' && row) {
        const v = row.dims.m !== undefined ? row.dims.m : row.dims.h;
        const c = corrOf(row, 'dims.m');
        if (v !== undefined) out['specific.height'] = { value: v, tier, ref: D.refOf(std, row, 'm'), standard: std.id, urls,
          corrected_from: c ? c.from : undefined, correction: c ? c.id : undefined };
      }
    } else if (lo && lo.tool_sizes && rec.drive && rec.drive.type.value === lo.drive_type && dia !== null && lo.tool_sizes[String(dia)]) {
      const t = lo.tool_sizes[String(dia)];
      out['drive.tool_size'] = { value: t.value, tier: t.tier, ref: `own/${lo.id}/tool_sizes/M${dia}`, standard: lo.id,
        urls: t.sources, note: t.basis };
    }
    // AN INCH RECORD OF A TYPE WITH NO INCH TABLE (hex, button, countersunk, pan, cheese head) has no standard of its own,
    // so nothing filled its drive (Joey, 2026-10-15, on a 1/4-20 hex head: "i had to select external hex for this, wouldn't
    // that always be true"). own_tables drive_by_head holds what is checked for the inch head: a hex head is External hex,
    // VERIFIED by two public sources, so it prefills. Any other type is only OFFERED its metric standard's drive, unverified:
    // inch button and countersunk socket heads also come with 6-lobe sockets (Terra 01a141fb), and inch pan and cheese heads
    // with several drives.
    if (!std && rec.drive && isUnified(rec) && rec.head && rec.head.status === STATUS.LISTED && !out['drive.type']) {
      const db = (D.own.drive_by_head || []).find((r) => r.family === rec.family && r.head === rec.head.value);
      if (db) out['drive.type'] = { value: db.drive, tier: db.status, ref: `own/drive_by_head/${db.family}:${db.head}`, urls: db.sources, note: db.source };
      else {
        const hd = D.own.heads.find((x) => x.family === rec.family && x.id === rec.head.value);
        const ms = hd && hd.standard ? D.std(hd.standard) : null;
        if (ms && ms.drive_type) out['drive.type'] = { value: ms.drive_type, tier: TIER.UNVERIFIED, ref: D.refOf(ms, null, 'drive_type'),
          note: `${ms.id}'s drive for the metric head; inch heads of this type also come with other drives` };
      }
    }
    if (rec.family === 'nut' && rec.head.status === STATUS.LISTED) {
      const lb = D.own.locking_by_type.find((r) => r.type === rec.head.value);
      if (lb) out['specific.locking_feature'] = { value: lb.locking, tier: lb.status, ref: `own/locking_by_type/${lb.type}` };
    }
    return out;
  }

  const extraOf = (e) => {
    const x = {};
    if (e.standard) x.standard = e.standard;
    if (e.note) x.note = e.note;
    if (e.urls) x.urls = e.urls;
    if (e.corrected_from !== undefined) { x.corrected_from = e.corrected_from; x.correction = e.correction; }
    return x;
  };

  function applyPrefill(rec) {
    const entries = prefillEntries(rec);
    for (const path of PREFILL_PATHS) {
      const cur = getPath(rec, path);
      if (!cur) continue;
      if (rec.user_unknown.includes(path)) continue;
      if (cur.status === STATUS.UNKNOWN || (cur.source && cur.source.prefill)) {
        const e = entries[path];
        // only documented and VERIFIED values prefill; single / conflict / unverified are suggestions
        if (e && !e.ambiguous && PREFILL_TIERS.has(e.tier)) {
          setPath(rec, path, listed(e.value, source(e.ref, e.tier, { prefill: true, ...extraOf(e) })));
        } else if (cur.source && cur.source.prefill) {
          setPath(rec, path, unknown());
        }
      }
    }
  }

  // Values the data offers but that do not prefill: single / conflict / unverified rows, and the ISO-or-DIN
  // alternatives. NEVER applied for you: shown, and used only when the user accepts one (the field then reads
  // Listed, with that tier).
  function suggestions(rec) {
    const out = [];
    for (const [path, e] of Object.entries(prefillEntries(rec))) {
      const cur = getPath(rec, path);
      if (!cur || cur.status !== STATUS.UNKNOWN) continue;
      if (e.ambiguous) {
        for (const a of e.ambiguous) {
          out.push({ path, value: a.value, label: a.label, tier: e.tier, ref: `${e.ref}/${a.value}`, standard: e.standard,
            urls: e.urls, note: e.hint, ambiguous: true, hint: e.hint });
        }
      } else if (!PREFILL_TIERS.has(e.tier)) {
        out.push({ path, ...e });
      }
    }
    return out;
  }

  function acceptSuggestion(rec, path, value) {
    const list = suggestions(rec).filter((s) => s.path === path && (value === undefined || same(s.value, value)));
    if (!list.length) throw new Error(`no suggestion for ${path}`);
    const e = list[0];
    const r = clone(rec);
    r.user_unknown = r.user_unknown.filter((x) => x !== path);
    setPath(r, path, listed(e.value, source(e.ref, e.tier, extraOf(e))));
    return finalize(r);
  }

  // ---------------------------------------------------------------- record lifecycle
  function finalize(rec) {
    rec.source_refs = collectRefs(rec);
    return rec;
  }

  function newRecord(familyId, init = {}) {
    const fam = FAMILIES.get(familyId);
    if (!fam) throw new Error(`unknown family ${familyId}`);
    const rec = {
      schema: 'part-record/1', id: init.id || idgen(), family: familyId, category: fam.category,
      standard: null, table_basis: null, spec_status: STATUS.UNKNOWN, standard_changed_from: null,
      user_unknown: [], // prefillable paths the user explicitly set to Unknown: never re-filled
      head: unknown(), ...fam.body(),
      material: { base: unknown(), stainless_group: unknown(), property_class: unknown(), finish: unknown(), colour: unknown() },
      notes: '', source_refs: [], data_version: D.version,
    };
    return finalize(rec);
  }

  // thread diameter chosen: coarse pitch as the default (spec section 4), then re-look-up
  // anything that depends on the size
  function afterDiameter(rec) {
    if (isUnified(rec) && rec.thread.tpi === null) return;   // an inch WASHER: a designation, no threads per inch
    if (isUnified(rec)) {
      const po = optionsFor(rec, 'thread.tpi');
      rec.thread.tpi = unknown();
      rec.thread.series = unknown();
      const d = po.options.find((o) => o.isDefault);
      if (d && rec.thread.diameter.value !== null) {
        rec.thread.tpi = listed(d.value, srcOf(d));
        if (d.series) rec.thread.series = listed(d.series, srcOf(d));
      }
      if (rec.length) reresolve(rec, 'length.value');
      return;
    }
    if (rec.thread.pitch !== null) {
      const po = optionsFor(rec, 'thread.pitch');
      rec.thread.pitch = unknown();
      rec.thread.pitch_class = unknown();
      const d = po.options.find((o) => o.isDefault);
      if (d && rec.thread.diameter.value !== null) {
        rec.thread.pitch = listed(d.value, srcOf(d));
        rec.thread.pitch_class = listed('coarse', srcOf(d));
      }
    }
    if (rec.length) reresolve(rec, 'length.value');
    if (rec.specific.insert) {
      for (const k of ['outer_diameter', 'length']) reresolve(rec, `specific.insert.${k}`);
    }
  }

  // threads per inch chosen: the series is READ from the listed option; a custom tpi gets no series (never inferred)
  function afterTpi(rec) {
    const f = rec.thread.tpi;
    const o = f.status === STATUS.LISTED ? optionsFor(rec, 'thread.tpi').options.find((x) => same(x.value, f.value)) : null;
    rec.thread.series = o && o.series ? listed(o.series, srcOf(o)) : unknown();
    if (rec.length) reresolve(rec, 'length.value');
  }

  // Metric <-> inch. NOTHING CONVERTS: the thread and the length start over as Unknown (an M6 is not a 1/4-20, and a 25 mm
  // length is not a 1"). The head, material, notes and the meta keys stay; the head's own standard for the system is
  // attached (socket head cap: ISO 4762 / ASME B18.3), or none when the head has no table in that system.
  function setSystem(rec, input) {
    const f = makeField(rec, 'thread.system', input);
    // the system is STRUCTURAL - it decides which fields the thread has - so it is metric, unified or Unknown (which
    // reads as metric: the old shape). A typed 'something else' would be silently dropped, so it is refused instead.
    if (f.status !== STATUS.UNKNOWN && !['metric', 'unified'].includes(f.value)) {
      throw new RangeError(`thread.system: "${f.value}" is not a thread system (metric or unified)`);
    }
    const toUnified = f.status !== STATUS.UNKNOWN && f.value === 'unified';
    const h = rec.head.status === STATUS.LISTED ? D.head(rec.family, rec.head.value) : null;
    const stdId = h ? (toUnified ? h.unified_standard || null : h.standard) : null;
    // the family's own shape is kept: a nut or a washer has no length, a washer no threads per inch (2026-10-05)
    const threaded = !!pathDef(rec.family, 'thread.tpi');
    const hasLength = rec.length !== null && rec.length !== undefined;
    if (toUnified) {
      rec.thread = { system: f, diameter: unknown(), pitch: null, pitch_class: null,
        tpi: threaded ? unknown() : null, series: threaded ? unknown() : null };
      if (hasLength) {
        rec.length = { value: unknown(), datum: unknown(),
          unit: listed('in', source('own/thread_systems/unified#length_unit', TIER.VOCABULARY, { note: 'an inch record measures length in inches' })) };
      }
    } else {
      rec.thread = thread(!!pathDef(rec.family, 'thread.pitch'));   // metric: the family's old shape exactly, no system field
      if (hasLength) rec.length = { value: unknown(), datum: unknown() };
    }
    if (rec.drive) rec.drive = { type: unknown(), tool_size: unknown() };
    rec.user_unknown = [];
    rec.table_basis = stdId;
    rec.standard = stdId;
    rec.standard_changed_from = null;
    rec.spec_status = rec.head.status === STATUS.UNKNOWN ? STATUS.UNKNOWN : (stdId ? STATUS.LISTED : STATUS.CUSTOM);
    // the type's source names the standard the system uses (an inch hex nut's head reads from asme_hex_nut, not ISO
    // 4032), so type -> inch and inch -> type give the same record (design review 2026-10-05: selection order)
    reresolve(rec, 'head');
  }

  function afterPitch(rec) {
    const f = rec.thread.pitch;
    if (f.status === STATUS.LISTED) {
      const o = optionsFor(rec, 'thread.pitch').options.find((x) => same(x.value, f.value));
      rec.thread.pitch_class = o && o.pitch_class ? listed(o.pitch_class, srcOf(o)) : unknown();
    } else {
      rec.thread.pitch_class = unknown(); // a custom pitch's class is never inferred
    }
    if (rec.length) reresolve(rec, 'length.value');
  }

  function setHead(rec, input) {
    const f = makeField(rec, 'head', input);
    const o = f.status === STATUS.LISTED ? optionsFor(rec, 'head').options.find((x) => same(x.value, f.value)) : null;
    const fresh = newRecord(rec.family, { id: rec.id });
    fresh.material = clone(rec.material);
    fresh.notes = rec.notes;
    fresh.head = f;
    const stdId = o ? o.standard || null : null;
    fresh.table_basis = stdId;
    // A set screw is only ISO 4026 once its point is known to be flat: until then it reads the
    // ISO 4026 TABLES but does not claim the standard.
    fresh.standard = rec.family === 'setscrew' ? null : stdId;
    fresh.spec_status = f.status === STATUS.UNKNOWN ? STATUS.UNKNOWN
      : (fresh.standard ? STATUS.LISTED : (rec.family === 'setscrew' && stdId ? STATUS.UNKNOWN : STATUS.CUSTOM));
    // a family with no standards makes no claim either way: picking "dome head" is not a "custom spec"
    if (FAMILIES.get(rec.family).standardless) fresh.spec_status = STATUS.UNKNOWN;
    for (const k of META_KEYS) if (rec[k] !== undefined) fresh[k] = clone(rec[k]);
    // a custom word for the TYPE described the old type: it does not carry over to a different one
    if (fresh.label_words && fresh.label_words.head && !(rec.head.status !== STATUS.UNKNOWN && same(rec.head.value, f.value))) {
      delete fresh.label_words.head;
      if (!Object.keys(fresh.label_words).length) delete fresh.label_words;
    }
    if (rec.reassigned_from) fresh.reassigned_from = rec.reassigned_from;   // provenance survives a head change
    if (isUnified(rec)) setSystem(fresh, { mode: STATUS.LISTED, value: 'unified' });   // an inch record stays inch
    return fresh;
  }

  // Section 5. Changing the drive away from the standard's own drive: the old standard is not
  // kept attached. Fields that came from that standard's tables become Custom (values kept),
  // the tool size goes Unknown, and a listed matching standard is OFFERED if there is one.
  function setDriveType(rec, input) {
    const std = D.std(rec.standard);
    const f = makeField(rec, 'drive.type', input);
    if (f.status === STATUS.UNKNOWN) {
      rec.drive.type = f;
      if (rec.drive.tool_size.source && rec.drive.tool_size.source.prefill) rec.drive.tool_size = unknown();
      return;
    }
    if (std && std.drive_type && f.value !== std.drive_type) {
      const from = std.id;
      rec.standard_changed_from = from;
      rec.standard = null;
      rec.table_basis = null;
      rec.spec_status = STATUS.CUSTOM;
      // only what is specific to the standard's table goes Custom; head and thread are generic facts
      for (const [path, fld] of [...leaves(rec)]) {
        if (STD_BOUND.includes(path) && fld.source && fld.source.standard === from) {
          setPath(rec, path, fld.status === STATUS.UNKNOWN ? fld : custom(fld.value, { adopted_from: from }));
        }
      }
      const offer = driveOfferFor(rec.head.value, f.value);
      rec.drive.type = offer && f.status === STATUS.LISTED ? f : custom(f.value);
      rec.drive.tool_size = unknown();
      return;
    }
    rec.drive.type = f;
    // picking the standard's own drive again reads as that standard's (documented) entry
    const e = prefillEntries(rec)['drive.type'];
    if (e && PREFILL_TIERS.has(e.tier) && e.value === f.value) {
      rec.drive.type = listed(e.value, source(e.ref, e.tier, { standard: e.standard }));
    }
  }

  function driveOfferFor(headId, driveId) {
    const o = D.own.drive_offers.find((x) => x.head === headId && x.drive === driveId);
    if (!o) return null;
    const known = D.listsOnly(o.standard) || D.std(o.standard);
    if (!known) return null;
    return { standard: o.standard, label: o.label, tier: o.status, ref: `own/drive_offers/${o.head}/${o.drive}` };
  }
  function driveOffer(rec) {
    if (rec.standard !== null || !rec.standard_changed_from || rec.drive === null) return null;
    return driveOfferFor(rec.head.value, rec.drive.type.value);
  }
  function acceptOffer(rec) {
    const offer = driveOffer(rec);
    if (!offer) throw new Error('no listed standard matches this head and drive');
    const r = clone(rec);
    r.standard = offer.standard;
    r.table_basis = offer.standard;
    r.spec_status = STATUS.LISTED;
    r.drive.type = listed(r.drive.type.value, source(offer.ref, offer.tier, { standard: offer.standard }));
    applyPrefill(r); // e.g. the verified ISO 14579 T size for this diameter
    reresolve(r, 'length.value'); // listed lengths for the new standard, if the value is in its list
    // length that was adopted as custom: look it up in the new list
    if (r.length && r.length.value.status === STATUS.CUSTOM) {
      const o = optionsFor(r, 'length.value').options.find((x) => same(x.value, r.length.value.value));
      if (o) r.length.value = listed(o.value, srcOf(o));
    }
    return finalize(r);
  }

  function setPointType(rec, input) {
    rec.specific.point_type = makeField(rec, 'specific.point_type', input);
    // only a flat point is ISO 4026; any other point (or an unknown one) borrows its table
    const flat = rec.specific.point_type.status === STATUS.LISTED && rec.specific.point_type.value === 'flat';
    if (rec.table_basis === 'iso4026') {
      const pt = rec.specific.point_type.status;
      rec.standard = flat ? 'iso4026' : null;
      rec.spec_status = flat ? STATUS.LISTED : (pt === STATUS.UNKNOWN ? STATUS.UNKNOWN : STATUS.CUSTOM);
      for (const path of ['thread.diameter', 'length.value']) reresolve(rec, path);
      afterPitch(rec);
    }
  }

  // ---------------------------------------------------------------- the one entry point
  // input: { mode: 'listed' | 'custom' | 'unknown', value }
  function set(rec, path, input) {
    if (!pathDef(rec.family, path)) throw new Error(`no field ${path} in family ${rec.family}`);
    if (path === 'material.stainless_group' && rec.material.base.value !== 'stainless') {
      throw new Error('stainless group applies only when the base material is stainless');
    }
    if (path === 'head') {
      const r = setHead(rec, input);
      applyPrefill(r);
      return carryChoices(rec, finalize(r));
    }
    let r = clone(rec);
    if (PREFILL_PATHS.includes(path)) {
      const explicit = !input || input.mode === STATUS.UNKNOWN || input.value === null || input.value === undefined || input.value === '';
      r.user_unknown = r.user_unknown.filter((x) => x !== path);
      if (explicit) r.user_unknown.push(path);
    }
    switch (path) {
      case 'thread.diameter':
        r.thread.diameter = makeField(r, path, input);
        afterDiameter(r);
        break;
      case 'thread.pitch':
        if (isUnified(r)) throw new Error('an inch thread has no pitch in mm: set thread.tpi');
        r.thread.pitch = makeField(r, path, input);
        afterPitch(r);
        break;
      case 'thread.system':
        setSystem(r, input);
        break;
      case 'thread.tpi':
        if (!isUnified(r)) throw new Error('threads per inch apply to an inch thread: set thread.system to unified first');
        r.thread.tpi = makeField(r, path, input);
        afterTpi(r);
        break;
      case 'thread.series':
        if (!isUnified(r)) throw new Error('the thread series applies to an inch thread');
        // the series of a LISTED TPI is read from it (#10-24 is UNC); setting it by hand could contradict the TPI
        if (r.thread.tpi.status === STATUS.LISTED) throw new Error('the series is read from the listed threads per inch: change the TPI instead');
        r.thread.series = makeField(r, path, input);
        break;
      case 'drive.type':
        setDriveType(r, input);
        break;
      case 'specific.point_type':
        setPointType(r, input);
        break;
      case 'material.base': {
        setPath(r, path, makeField(r, path, input));
        if (r.material.base.value !== 'stainless') r.material.stainless_group = unknown();
        break;
      }
      case 'specific.insert.brand_dataset':
        r.specific.insert.brand_dataset = makeField(r, path, input);
        for (const k of ['outer_diameter', 'length']) reresolve(r, `specific.insert.${k}`);
        break;
      default:
        setPath(r, path, makeField(r, path, input));
    }
    applyPrefill(r);
    return finalize(r);
  }

  // A type change KEEPS the size, thread and length already chosen (design review 2026-10-05: "Selection order shouldn't change
  // the result. Picking size -> type should produce the same valid options and defaults as type -> size ... without
  // overwriting an explicitly chosen TPI"). setHead starts a fresh record; each choice is then re-applied through set(),
  // exactly as a pick on the new type would be: listed if the new type lists the value, else Custom (value kept, never
  // dropped - the rule reresolve() follows), so the new type's defaults follow (wrench size, height ...). A TPI or pitch
  // the record held is re-applied rather than replaced by the default; an unknown one takes the default, as type -> size.
  function carryChoices(old, rec) {
    const has = (f) => f && f.status !== STATUS.UNKNOWN;
    if (!old.thread || !rec.thread || !has(old.thread.diameter)) return rec;
    let r = set(rec, 'thread.diameter', { mode: STATUS.LISTED, value: old.thread.diameter.value });
    for (const p of ['thread.tpi', 'thread.pitch']) {
      const f = getPath(old, p);
      if (has(f) && getPath(r, p)) r = set(r, p, { mode: STATUS.LISTED, value: f.value });
    }
    if (old.length && r.length && has(old.length.value)) r = set(r, 'length.value', { mode: STATUS.LISTED, value: old.length.value.value });
    return r;
  }

  // convenience: infer the mode from the value (null/'' -> unknown, in the menu -> listed, else custom)
  function choose(rec, path, value) {
    if (value === null || value === undefined || value === '') return set(rec, path, { mode: STATUS.UNKNOWN });
    return set(rec, path, { mode: STATUS.LISTED, value });
  }

  function setNotes(rec, text) {
    const r = clone(rec);
    r.notes = String(text ?? '');
    return finalize(r);
  }

  // What a person typed or attached about a part, outside the typed fields (2026-10-04): a display name (label), package
  // text, dimensions, supplier and part number (meta), a photo (a small data URL) and collections (tags). Plain strings,
  // not Fields - nothing here is looked up or inferred. An empty value removes the key, so an untouched record keeps its
  // v1 shape.
  function setMeta(rec, changes) {
    const r = clone(rec);
    for (const [k, val] of Object.entries(changes)) {
      if (!META_KEYS.includes(k)) throw new Error(`not a meta key: ${k}`);
      if (k === 'tags') {
        const raw = Array.isArray(val) ? val : String(val ?? '').split(',');   // an array, or "a, b" typed as one string
        const tags = [...new Set(raw.map((t) => String(t).trim()).filter(Boolean))];
        if (tags.length) r.tags = tags; else delete r.tags;
      } else if (k === 'label_pins') {
        // an explicit list, possibly empty (nothing pinned is a choice); null goes back to the defaults
        if (val === null || val === undefined) { delete r.label_pins; continue; }
        if (!Array.isArray(val) || val.some((p) => typeof p !== 'string' || !/^[a-z_]+(\.[a-z_]+)*$/.test(p))) {
          throw new RangeError('label_pins: a list of field paths, e.g. ["head", "material.finish"]');
        }
        r.label_pins = [...new Set(val)];
      } else if (k === 'label_words') {
        // merged into the existing words: {path: 'TEXT'} sets one, {path: ''} or {path: null} removes it; null removes all
        if (val === null || val === undefined) { delete r.label_words; continue; }
        if (typeof val !== 'object' || Array.isArray(val)) throw new RangeError('label_words: {field path: text}');
        const w = { ...(r.label_words || {}) };
        for (const [path, text] of Object.entries(val)) {
          if (!/^[a-z_]+(\.[a-z_]+)*$/.test(path)) throw new RangeError(`label_words: "${path}" is not a field path`);
          const t = text === null || text === undefined ? '' : String(text).replace(/\s+/g, ' ').trim();
          if (t.length > LABEL_WORD_MAX) throw new RangeError(`label_words: at most ${LABEL_WORD_MAX} characters`);
          if (t) w[path] = t; else delete w[path];
        }
        if (Object.keys(w).length) r.label_words = w; else delete r.label_words;
      } else if (k === 'label_colours') {
        // merged: {band: 'yellow'} sets one, {band: null} or '' removes it; null removes both. The key is checked against
        // the collection's scheme when the label is made (labelstyle.labelColours), not here: a record does not own a scheme
        if (val === null || val === undefined) { delete r.label_colours; continue; }
        if (typeof val !== 'object' || Array.isArray(val)) throw new RangeError('label_colours: {band?, band_accent?}');
        const c = { ...(r.label_colours || {}) };
        for (const [slot, key] of Object.entries(val)) {
          if (slot !== 'band' && slot !== 'band_accent') throw new RangeError(`label_colours: "${slot}" is not band or band_accent`);
          const t = key === null || key === undefined ? '' : String(key).trim();
          if (t.length > LABEL_WORD_MAX) throw new RangeError(`label_colours: at most ${LABEL_WORD_MAX} characters`);
          if (t) c[slot] = t; else delete c[slot];
        }
        if (Object.keys(c).length) r.label_colours = c; else delete r.label_colours;
      } else if (k === 'label_pins_removed') {
        if (val !== null && val !== undefined && !(Array.isArray(val) && !val.length)) {
          throw new RangeError('label_pins_removed: only a family change writes it; null dismisses it');
        }
        delete r.label_pins_removed;
      } else if (k === 'meta') {
        const m = {};
        for (const [mk, mv] of Object.entries(val || {})) { const t = String(mv ?? '').trim(); if (t) m[mk] = t; }
        if (Object.keys(m).length) r.meta = m; else delete r.meta;
      } else {
        const t = val === null || val === undefined ? '' : String(val).trim();
        if (t) r[k] = t; else delete r[k];
      }
    }
    return finalize(r);
  }

  // Give a part another family (design review: an Other part gets its real family later). The record keeps its ID - so its label
  // and drawer association survive - and its name, package text, supplier, photo, collections, notes and material; the
  // typed fields start over, because they belong to the old family.
  function reassignFamily(rec, familyId) {
    if (!FAMILIES.has(familyId)) throw new Error(`unknown family ${familyId}`);
    const fresh = newRecord(familyId, { id: rec.id });
    fresh.material = clone(rec.material);
    fresh.notes = rec.notes;
    for (const k of META_KEYS) if (rec[k] !== undefined) fresh[k] = clone(rec[k]);
    fresh.reassigned_from = rec.family;
    // label pins (design review 2026-10-05: "retain applicable pins and flag or remove incompatible ones"): a pin names a FIELD
    // PATH; one the new family has no such field for is removed and recorded, so the screen can say what was unpinned
    if (Array.isArray(rec.label_pins)) {
      const has = new Set(pathsFor(familyId).map((d) => d.path));
      fresh.label_pins = rec.label_pins.filter((p) => has.has(p));
      const gone = rec.label_pins.filter((p) => !has.has(p));
      // added to any notice not yet dismissed (setMeta {label_pins_removed: null} dismisses it)
      if (gone.length) fresh.label_pins_removed = [...(rec.label_pins_removed || []), ...gone.map((path) => ({ path, family: rec.family }))];
    }
    // custom words: kept for the fields the new family has; the type's word never (the type starts over)
    if (rec.label_words) {
      const has = new Set(pathsFor(familyId).map((d) => d.path));
      const w = Object.fromEntries(Object.entries(rec.label_words).filter(([p]) => p !== 'head' && has.has(p)));
      if (Object.keys(w).length) fresh.label_words = w; else delete fresh.label_words;
    }
    return finalize(fresh);
  }

  function flagsFor(rec, path) {
    if (path === 'length.value' || path === 'thread.pitch') return optionsFor(rec, path).flags || [];
    return [];
  }

  return {
    D, FAMILIES, idgen,
    newRecord, optionsFor, set, choose, setNotes, setMeta, reassignFamily, suggestions, acceptSuggestion,
    driveOffer, acceptOffer, flagsFor, pathsFor, pathDef,
    prefillEntries: (rec) => prefillEntries(rec),
  };
}
