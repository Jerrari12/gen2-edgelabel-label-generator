// Batch mode, the list view text, and JSON export / import. No DOM.

import { STATUS, recordProblems, clone, upgradeRecord } from './fields.js';
import { DATA_FAMILY, labelText } from './families-data.js';
import { isUnified, fracInch } from './units.js';
import { cleanStyle } from './labelstyle.js';

// ISO standard id -> display text: iso7380_1 -> "ISO 7380-1", din127b -> "DIN 127B"
export function fmtStandard(id) {
  if (!id) return '';
  // the inch nut / washer tables (2026-10-05): named for the standards they hold
  const OWN_INCH = { asme_hex_nut: 'ASME B18.6.3 / B18.2.2', asme_jam_nut: 'ASME B18.2.2',
    // batch 7: nylon-insert locknuts (both patterns are ASME B18.16.6), square and flange nuts, SAE J483 acorn nuts
    asme_nylon_nut: 'ASME B18.16.6', asme_nylon_thin_nut: 'ASME B18.16.6', asme_square_nut: 'ASME B18.2.2',
    asme_flange_nut: 'ASME B18.2.2', sae_acorn_nut: 'SAE J483' };
  if (OWN_INCH[id]) return OWN_INCH[id];
  const a = /^asme_b(\d+)\.(\d+)(?:\.(\d+))?(?:_([a-z]))?$/i.exec(id);   // asme_b18.3 -> "ASME B18.3", asme_b18.22.1_n -> "ASME B18.22.1 N"
  if (a) return `ASME B${a[1]}.${a[2]}${a[3] ? '.' + a[3] : ''}${a[4] ? ' ' + a[4].toUpperCase() : ''}`;
  const m = /^(iso|din)(\d+)(?:_(\d+))?([a-z]?)$/i.exec(id);
  if (!m) return id;
  return `${m[1].toUpperCase()} ${m[2]}${m[3] ? '-' + m[3] : ''}${m[4].toUpperCase()}`;
}

// the standard ONE record follows: the inch hex nut table holds two standards, and a record's size names which -
// #0-#12 are ANSI B18.6.3 machine screw nuts, 1/4 and up ASME B18.2.2 finished hex nuts (2026-10-05)
export function fmtStandardOf(rec) {
  if (!rec || !rec.standard) return '';
  if (rec.standard === 'asme_hex_nut' && rec.thread && rec.thread.diameter && rec.thread.diameter.status !== STATUS.UNKNOWN) {
    return String(rec.thread.diameter.value).startsWith('#') ? 'ANSI B18.6.3' : 'ASME B18.2.2';
  }
  return fmtStandard(rec.standard);
}

// ---------------------------------------------------------------- batch
// A template record carries everything shared (family, head/type, thread, material, ...).
// `values` are the values of the family's varying field (lengths for screws and set screws,
// thread sizes for nuts / washers / inserts). Each value becomes its own record, and each
// record is then an ordinary record: editable on its own.
export function expandBatch(P, template, values) {
  const fam = P.FAMILIES.get(template.family);
  const path = fam.varying.path;
  const out = [];
  const seen = new Set();
  for (const v of values) {
    const key = String(v);
    if (seen.has(key)) continue; // the same value twice in one batch is one record
    seen.add(key);
    const fresh = JSON.parse(JSON.stringify(template));
    fresh.id = P.idgen();
    out.push(P.set(fresh, path, { mode: STATUS.LISTED, value: v }));
  }
  return out;
}

// ---------------------------------------------------------------- list view text
const FAMILY_NOUN = { screw: 'screw' };

function val(f, unit = '') {
  if (!f || f.status === STATUS.UNKNOWN) return 'unknown';
  const t = `${f.value}${unit}`;
  return f.status === STATUS.CUSTOM ? `${t} (custom)` : t;
}

// The families added 2026-10-04 (no reference tables): their main line names what tells drawers apart.
const lab = (P, rec, path, f) => {
  if (!f || f.status === STATUS.UNKNOWN) return null;
  if (f.status === STATUS.CUSTOM) return `${f.value} (custom)`;
  const o = P.optionsFor(rec, path).options.find((x) => String(x.value) === String(f.value));
  return o ? o.label : String(f.value);
};
function describeNew(P, rec) {
  const sp = rec.specific; const bits = [];
  const name = rec.label || null;
  const head = lab(P, rec, 'head', rec.head);
  if (rec.family === 'fitting') {
    const f = sp.fitting;
    const tubes = [f.tube_a, f.tube_b].filter((x) => x.status !== STATUS.UNKNOWN).map((x) => val(x)).join(' / ');
    bits.push(head || 'fitting (shape unknown)', tubes ? `tube ${tubes} mm` : 'tube unknown');
    if (f.thread.status !== STATUS.UNKNOWN) bits.push(val(f.thread));
    if (f.construction.status !== STATUS.UNKNOWN) bits.push(val(f.construction));
  } else if (rec.family === 'tnut') {
    const t = sp.tnut;
    bits.push(`${t.profile.status !== STATUS.UNKNOWN ? val(t.profile) + ' ' : ''}T-nut`, head || 'type unknown',
      rec.thread.diameter.status === STATUS.UNKNOWN ? 'thread unknown' : `M${val(rec.thread.diameter)}`);
    if (t.slot.status !== STATUS.UNKNOWN) bits.push(`${val(t.slot)} mm slot`);
    if (t.spring.status !== STATUS.UNKNOWN) bits.push(val(t.spring));
  } else if (rec.family === 'rivet') {
    const r = sp.rivet;
    bits.push(`Blind rivet ${val(r.diameter)} x ${val(r.length)} mm`, head || 'head unknown');
    bits.push(`grip ${val(r.grip_min)}-${val(r.grip_max)} mm`);
    bits.push(`${val(r.body_material)} body / ${val(r.mandrel_material)} mandrel`);
    if (r.type.status !== STATUS.UNKNOWN) bits.push(val(r.type));
  } else if (DATA_FAMILY.has(rec.family)) {
    const lt = labelText(rec, head);
    bits.push(`${DATA_FAMILY.get(rec.family).label}: ${lt.big}`, ...(lt.small.length ? lt.small : [head || 'type unknown']));
  } else {
    bits.push(name || 'Other part (unnamed)');
  }
  if (name && rec.family !== 'other') bits.unshift(name);
  const main = bits.join('  -  ');
  const sec = [];
  const m = rec.material;
  if (m.base.status !== STATUS.UNKNOWN || m.finish.status !== STATUS.UNKNOWN) sec.push(`Material: ${val(m.base)}, finish ${val(m.finish)}${m.colour && m.colour.status !== STATUS.UNKNOWN ? `, colour ${val(m.colour)}` : ''}`);
  const meta = rec.meta || {};
  for (const [k, t] of [['package_text', 'Package'], ['dimensions', 'Dimensions'], ['supplier', 'Supplier'], ['supplier_part', 'Supplier part']]) {
    if (meta[k]) sec.push(`${t}: ${meta[k]}`);
  }
  if (rec.tags && rec.tags.length) sec.push(`Collections: ${rec.tags.join(', ')}`);
  if (rec.notes) sec.push(`Notes: ${rec.notes}`);
  return { main, secondary: sec, text: `${main}\n    ${sec.join(' | ')}` };
}
const NEW_FAMILIES = new Set(['fitting', 'tnut', 'rivet', 'other', ...DATA_FAMILY.keys()]);

export function describe(P, rec) {
  if (NEW_FAMILIES.has(rec.family)) return describeNew(P, rec);
  const D = P.D;
  const th = rec.thread;
  const parts = [];
  // thread / size
  const dia = th.diameter;
  const inch = isUnified(rec);
  let size = dia.status === STATUS.UNKNOWN ? 'size unknown'
    : `${inch ? '' : 'M'}${dia.value}${dia.status === STATUS.CUSTOM ? ' (custom)' : ''}`;
  if (inch) {                                       // an inch thread: size-TPI, e.g. #10-24; never an M size
    size += th.tpi.status === STATUS.UNKNOWN ? (dia.status === STATUS.UNKNOWN ? '' : '-TPI unknown')
      : `-${th.tpi.value}${th.tpi.status === STATUS.CUSTOM ? ' (custom TPI)' : ''}`;
  } else if (th.pitch) {
    size += th.pitch.status === STATUS.UNKNOWN ? '' : ` x ${val(th.pitch)}`;
    if (th.pitch.status === STATUS.UNKNOWN && dia.status !== STATUS.UNKNOWN) size += ' x pitch unknown';
  }
  parts.push(size);
  if (rec.length) {
    const lv = rec.length.value;
    parts.push(lv.status === STATUS.UNKNOWN ? 'x length unknown'
      : (inch ? `x ${fracInch(lv.value)}"${lv.status === STATUS.CUSTOM ? ' (custom)' : ''}` : `x ${val(lv, ' mm')}`));
  }
  // type
  let headLabel;
  if (rec.head.status === STATUS.UNKNOWN) headLabel = `${rec.family} (type unknown)`;
  else if (rec.head.status === STATUS.CUSTOM) headLabel = `${rec.head.value} (custom)`;
  else headLabel = (D.head(rec.family, rec.head.value) || { label: rec.head.value }).label;
  if (FAMILY_NOUN[rec.family] && rec.head.status !== STATUS.UNKNOWN) headLabel += ` ${FAMILY_NOUN[rec.family]}`;
  let std = '';
  if (rec.standard) std = fmtStandardOf(rec);
  else if (rec.standard_changed_from) std = `off-standard (was ${fmtStandard(rec.standard_changed_from)})`;
  const main = [rec.label || null, parts.join(' '), headLabel, std].filter(Boolean).join('  -  ');   // label: absent on v1 records

  const sec = [];
  const m = rec.material;
  const mat = [];
  mat.push(val(m.base));
  if (m.base.value === 'stainless') mat.push(`group ${val(m.stainless_group)}`);
  mat.push(`class ${val(m.property_class)}`);
  mat.push(`finish ${val(m.finish)}`);
  if (m.colour && m.colour.status !== STATUS.UNKNOWN) mat.push(`colour ${val(m.colour)}`);   // only when stated: older lists read as before
  sec.push(`Material: ${mat.join(', ')}`);
  if (rec.drive) {
    const dt = rec.drive.type;
    const dl = dt.status === STATUS.UNKNOWN ? 'unknown'
      : dt.status === STATUS.LISTED ? ((D.driveType(dt.value) || {}).label || dt.value) : `${dt.value} (custom)`;
    sec.push(`Drive: ${dl}, tool size ${val(rec.drive.tool_size, typeof rec.drive.tool_size.value === 'number' ? ' mm' : '')}`);
  }
  if (rec.length) sec.push(`Length datum: ${val(rec.length.datum)}`);
  const sp = rec.specific;
  if (sp.thread_extent) sec.push(`Thread extent: ${val(sp.thread_extent)}`);
  if (sp.locking_feature) sec.push(`Locking feature: ${val(sp.locking_feature)}`);
  if (sp.point_type) sec.push(`Point: ${val(sp.point_type)}`);
  if (sp.height) sec.push(`Height (max): ${val(sp.height, ' mm')}`);
  if (sp.washer) {
    sec.push(`ID ${val(sp.washer.id, ' mm')}, OD ${val(sp.washer.od, ' mm')}, thickness ${val(sp.washer.thickness, ' mm')}`);
  }
  if (sp.insert) {
    sec.push(`Brand dataset: ${val(sp.insert.brand_dataset)}; outside dia ${val(sp.insert.outer_diameter, ' mm')}, length ${val(sp.insert.length, ' mm')}`);
  }
  if (th.pitch_class && th.pitch_class.status !== STATUS.UNKNOWN) sec.push(`Pitch class: ${val(th.pitch_class)}`);
  if (inch) sec.push(`Thread: Unified (inch), series ${val(th.series)}`);
  // record-level details (2026-10-04); absent on every v1 record, so v1 text is unchanged
  const meta = rec.meta || {};
  for (const [k, t] of [['package_text', 'Package'], ['dimensions', 'Dimensions'], ['supplier', 'Supplier'], ['supplier_part', 'Supplier part']]) {
    if (meta[k]) sec.push(`${t}: ${meta[k]}`);
  }
  if (rec.tags && rec.tags.length) sec.push(`Collections: ${rec.tags.join(', ')}`);
  if (rec.notes) sec.push(`Notes: ${rec.notes}`);
  return { main, secondary: sec, text: `${main}\n    ${sec.join(' | ')}` };
}

export function listText(P, records) {
  return records.map((r, i) => `${String(i + 1).padStart(2, ' ')}. ${describe(P, r).text}`).join('\n');
}

// ---------------------------------------------------------------- export / import
// `labelStyle`: the collection's label colour scheme (labelstyle.js). It is saved WITH the records so reopening or
// importing the file never changes what a colour means (design review 2026-10-06); a file without one has no colours.
export function exportDoc(P, records, { labelStyle = null } = {}) {
  return JSON.stringify({ schema: 'part-records/1', data_version: P.D.version, ...(labelStyle ? { label_style: labelStyle } : {}), records }, null, 1);
}

// Import never blocks a custom value: it only reports structural problems (an unknown that
// carries a value, a listed field with no source, ...).
export function importDoc(text) {
  const doc = JSON.parse(text);
  if (!doc || doc.schema !== 'part-records/1' || !Array.isArray(doc.records)) {
    throw new Error('not a part-records/1 file');
  }
  const problems = [];
  doc.records.forEach((r, i) => recordProblems(r).forEach((m) => problems.push(`record ${i + 1}: ${m}`)));
  // the collection's colour scheme, if the file carries one: refused whole when its shape is wrong, never half-applied
  const labelStyle = doc.label_style === undefined ? null : cleanStyle(doc.label_style);
  if (doc.label_style !== undefined && !labelStyle) problems.push('label_style: not a usable label-style/1 scheme - ignored');
  return { records: doc.records.map(clone).map(upgradeRecord), problems, labelStyle: labelStyle ? clone(labelStyle) : null };
}
