// The rendered picture for a record (design review 2026-10-04: "changing size, length or drive retrieves the corresponding
// asset, with a clear fallback when there isn't one"). Pure: no DOM, no fetch - give it the parsed
// img/hw/v2/assets.json (written by tools/sync_hw_assets.py from the hardware visual library's manifest) and the
// picker's own head -> standard table (data/own_tables.json heads), which names each type's primary standard.
//
// A picture is a REFERENCE MODEL, never a claim about the part in someone's hand. It matches on what the record says
// (rec.standard is only a tie-break: a drive change detaches it in picker.js setDriveType).
//
// Round 6 (design review): a generic picture beats a misleading near-match.
//   - IDENTITY must match or no render is shown (kind 'generic': the UI keeps the glyph and says why):
//     the type, a drive the record states, a set-screw point it states, a thread extent it states.
//   - SIZE and LENGTH may be near: within NEAR (25 %) of the record's value, with one note. Further off: generic.
//   - At most ONE note under a picture. A failed CAD build shows its nearest rendered size under the same rules.
// Unknown fields show the type's reference model, labelled as such (nothing is claimed for the record).
//
// Finish (2026-10-04, the library expansion brief): the record's base / finish / colour pick an APPEARANCE preset
// (presetFor) and the geometry's rendered finish variant when there is one. Appearance never decides identity: a part
// with no picture in its finish shows the reference finish, with one note when nothing else needed saying.

import { isUnified, fracInch } from './units.js';

const NEAR = 0.25;
const val = (f) => (f && (f.status === 'listed' || f.status === 'custom') ? f.value : null);
const fmt = (n) => String(Math.round(n * 100) / 100);
const DRIVE_WORD = { 'hex-socket': 'hex socket', 'external-hex': 'external hex', hexalobular: 'hexalobular', phillips: 'Phillips',
  pozidriv: 'Pozidriv', slotted: 'slotted', none: 'no drive' };
export const stdWord = (s) => (s === 'cnckitchen' ? 'CNC Kitchen' : s === 'asme_b18.3' ? 'ASME B18.3'
  : s.replace(/^iso/, 'ISO ').replace(/^din/, 'DIN ').replace('_', '-'));
// an inch size reads #10-24 x 1-1/4" (designation-TPI, length in inches)
const inchText = (d, tpi, L) => `${d}${tpi ? `-${tpi}` : ''}${L !== null && L !== undefined ? ` × ${fracInch(L)}"` : ''}`;
// a thread reads M5; an unthreaded part's size reads as the picture index says ('' for a pin, '⌀' for a ring)
export const sizeText = (a, prefix) => (a.d === null || a.d === undefined ? ''
  : `${prefix ?? a.prefix ?? 'M'}${fmt(a.d)}${a.L !== null && a.L !== undefined ? ` × ${fmt(a.L)}` : ''}`);
const getp = (o, path) => path.split('.').reduce((x, k) => (x === null || x === undefined ? undefined : x[k]), o);
const far = (got, want) => Math.abs(got - want) > NEAR * want;
const ANOD = new Set(['black', 'blue', 'red', 'gold', 'purple', 'green']);
// the size fields of an OWN family whose size is not a thread (the data families carry theirs in families-data.js)
const OWN_PICTURE = { rivet: { d: 'specific.rivet.diameter', L: 'specific.rivet.length', prefix: '\u2300' } };
// PICTURE NOTES (design review 2026-10-06): one short VISIBLE line per picture that names every identity-affecting difference
// ("Reference model - different length", "Generic fitting"); the standard, geometry class, verification, deviations and
// the full sentence go in `details`, behind an expandable "Source" line. The reason a picture does not match is never
// hidden: `short` lists every difference, even where the one-note rule keeps a second one out of `notes`.
const ILLUS_NOUN = { tnut: 'T-nut', fitting: 'fitting', insert: 'insert', rivet: 'rivet', standoff: 'standoff', screw: 'screw',
  nut: 'nut', washer: 'washer', 'thumb:plastic-knob': 'knob', thumb: 'thumb screw' };
const COARSE_NOTE = 'Picture shows coarse thread; selected part is fine thread.';

// The record's material -> the render library's appearance preset (hw_materials.json) that depicts it, or null when
// no preset does. Conservative: a colour never names a treatment ("black" is not black oxide, "silver" is not
// stainless), and it counts only where the preset depicts colour (nylon, anodizing, zinc passivate).
export function presetFor(m) {
  if (!m) return null;
  const b = val(m.base); const f = val(m.finish); const c = m.colour ? val(m.colour) : null;
  // a connector's contact plating (round 3, Joey 2026-10-17): the library's own looks, whatever the base - only the
  // contacts are plated (a header's plastic keeps its colour). Tin is each geometry's reference look, gold a variant
  if (f === 'tin' || f === 'gold') return f;
  const plain = c === null || c === 'natural';
  if (b === 'stainless') return plain && (f === null || f === 'plain' || f === 'passivated') ? 'stainless' : null;
  if (b === 'steel' || (b === null && f !== null && f !== 'anodized')) {
    // "natural" is the finish's own colour, not a dye: black oxide's natural colour IS the black-oxide look, and clear
    // zinc's is the clear look (Jerrari 2026-10-10: black oxide + colour natural fell back to the reference steel)
    if (f === 'black oxide') return plain || c === 'black' ? 'black-oxide' : null;
    if (f === 'zinc') return plain || c === 'clear/blue' ? 'zinc-clear' : null;
    if (!plain) return null;
    // "plain" 12.9 is sold as SELF COLOUR, which the heat treatment commonly leaves dark - neither the grey plain-steel
    // look nor black oxide (a different, named process). design review 2026-10-05: show the NEUTRAL reference steel and say
    // "Finish appearance unspecified" (appearanceUnspecified); no 12.9 look is invented. A source photo may refine it.
    if (appearanceUnspecified(m)) return 'steel';
    if (f === 'plain') return 'steel-plain';
    if (f === 'nickel') return 'nickel';
    return f === null ? 'steel' : null;
  }
  if (b === 'brass') return !plain ? null : f === 'nickel' ? 'nickel' : f === null || f === 'plain' ? 'brass' : null;
  if (b === 'copper') return plain && (f === null || f === 'plain') ? 'copper' : null;
  if (b === 'nylon') return c === 'black' ? 'nylon-black' : plain ? 'nylon-natural' : null;
  if (b === 'aluminium') {
    if (f === 'anodized') return c && ANOD.has(c) ? `anodized:${c}` : null;
    return plain && (f === null || f === 'plain') ? 'aluminium' : null;
  }
  return null;
}
// The colours that choose a DIFFERENT picture for this base + finish: what the Material section offers as Colour
// (Jerrari 2026-10-08: "hide it if it's not available"). Elsewhere a colour picks nothing - zinc's clear/blue and black
// oxide's black show the same picture as no colour at all - so the row is hidden there. presetFor() stays the rule;
// test/hwimage.test.mjs checks this list against it over every base, finish and colour.
export function pictureColours(m) {
  if (!m) return [];
  const b = val(m.base); const f = val(m.finish);
  if (b === 'nylon') return ['natural', 'black'];
  if (b === 'aluminium' && f === 'anodized') return [...ANOD];
  return [];
}
// steel (or no base), finish "plain", property class 12.9, no colour beyond natural: the trade's "self colour"
export function appearanceUnspecified(m) {
  if (!m) return false;
  const b = val(m.base); const f = val(m.finish); const c = m.colour ? val(m.colour) : null;
  return (b === 'steel' || b === null) && f === 'plain' && (c === null || c === 'natural')
    && String(val(m.property_class)) === '12.9';                                      // a JSON import may hold the number 12.9
}
export const UNSPECIFIED_NOTE = 'Finish appearance unspecified';
const stated = (m) => !!m && [m.base, m.finish, m.colour].some((f) => val(f) !== null);
const nearest = (list, key, want) => list.reduce((b, a) => (b === null || Math.abs(a[key] - want) < Math.abs(b[key] - want)
  || (Math.abs(a[key] - want) === Math.abs(b[key] - want) && a[key] > b[key]) ? a : b), null);

// families: the data families (families-data.js DATA_FAMILY) - where a record keeps its size and length, which fields
// are identity, and how its size reads. Without it only the thread families resolve, as before.
// materialIssue (round 3, Joey 2026-10-17): (rec) -> why the record's material is not one its kind of part comes in, or
// null - the picker's own rule (picker.materialIssue). A finish picture is then never used: every geometry was rendered in
// every look, so a nylon heat-set insert has a picture, and it must never be shown as if such a part existed.
export function createHwImages(index, { heads = [], base = 'img/hw/v2/', families = null, materialIssue = null } = {}) {
  const assets = index.assets || [];
  const byId = new Map(assets.map((a) => [a.id, a]));
  const primary = new Map(heads.map((h) => [`${h.family}:${h.id}`, h.standard]));
  const byType = new Map();
  for (const a of assets) {
    const k = `${a.family}:${a.head}`;
    if (!byType.has(k)) byType.set(k, []);
    byType.get(k).push(a);
  }
  // the type's own picture: the library's visual variant of the type's primary standard
  const repOf = (k, list) => list.find((a) => a.rep && a.status === 'rendered' && a.std === primary.get(k))
    || list.find((a) => a.rep && a.status === 'rendered') || list.find((a) => a.status === 'rendered') || null;
  const src = (a, kind = '') => `${base}${a.img}${kind}.webp`;
  // an inch size's major diameter, by the Unified rule (numbered sizes 0.060 + 0.013 x N in; a fraction is its value) -
  // so a size with no render (#12) can still find its nearest rendered neighbour (#10) within NEAR
  const majorOf = (d) => { const m = /^#(\d+)$/.exec(d); if (m) return 0.06 + 0.013 * +m[1]; const f = /^(\d+)\/(\d+)$/.exec(d); return f ? +f[1] / +f[2] : null; };
  const shown = (a) => byId.get(a.img) || a;

  // mat: the record's material (resolve only). Its preset's finish variant replaces the reference-finish image; with no
  // such variant the reference finish shows and, if no other note was needed, says so.
  function render(a, match, note = null, mat = null) {
    const t = shown(a);
    const rule = t.extent === 'partial' && t.extentRule ? ` (part-threaded per ${t.extentRule})` : '';
    const want = mat ? presetFor(mat) : null;
    // a material this kind of part does not come in never gets its look, even where one was rendered
    const ruled = mat && MAT_ISSUE ? `Not a material this kind of part comes in (${MAT_ISSUE}) - shown in the reference finish` : null;
    const fin = want && want !== 'steel' && t.finishes && !ruled ? t.finishes[want] : null;
    if (ruled && !note) note = ruled;
    if (!fin && mat && want !== 'steel' && stated(mat) && !note) note = 'No reference picture in this finish yet - shown in the reference finish';
    if (mat && appearanceUnspecified(mat) && !note) note = UNSPECIFIED_NOTE;
    const im = fin ? { img: fin.img } : a;
    // every difference between what the record states (WANT, set by resolve) and what the picture shows (t)
    const diffs = []; const extra = [];
    const W = WANT;
    if (W) {
      if (W.d === null) diffs.push('size not set');
      else if (W.d !== undefined && t.d !== null && t.d !== undefined && t.d !== W.d) diffs.push('different size');
      if (W.tpi === null) diffs.push('TPI not set');
      else if (W.tpi !== undefined && t.tpi !== null && t.tpi !== undefined && t.tpi !== W.tpi) diffs.push('different thread');
      if (W.fine) { diffs.push('different thread'); extra.push(COARSE_NOTE); }   // every metric render is coarse thread
      if (W.lengthed) {
        if (W.L === null) diffs.push('length not set');
        else if (t.L !== null && t.L !== undefined && t.L !== W.L) diffs.push('different length');
      }
    }
    if (ruled) { diffs.push('reference finish shown'); extra.push(ruled); }
    else if (!fin && mat && want !== 'steel' && stated(mat)) {
      diffs.push('reference finish shown'); extra.push('No reference picture in this finish yet - shown in the reference finish');
    }
    if (mat && appearanceUnspecified(mat)) { diffs.push('finish appearance unspecified'); extra.push(UNSPECIFIED_NOTE); }
    const caption = `Reference model: ${[t.ref || sizeText(t), t.ref ? null : stdWord(t.std), fin ? fin.label.toLowerCase() : null].filter(Boolean).join(', ')}${rule}`;
    const uniq = [...new Set(diffs)];
    return {
      kind: 'render', asset: a.id, image: fin ? fin.img : a.img, match, notes: note ? [note] : [], finish: fin ? want : null,
      src: src(im), srcSm: src(im, '-sm'), srcHead: (fin ? fin.hasHead : t.hasHead) ? src(im, '-head') : null,
      caption,
      short: uniq.length ? `Reference model - ${uniq.join(', ')}` : 'Reference model',
      details: [caption, ...new Set([...(note ? [note] : []), ...extra]), t.geometry ? `Geometry: ${t.geometry}` : null,
        t.verification ? `Checked: ${t.verification}` : null, ...(t.deviations || [])].filter(Boolean),
      exact: match === 'exact' && !note && !uniq.length,
    };
  }
  const generic = (reason) => ({ kind: 'generic', match: 'generic', notes: [reason], caption: reason, short: reason, details: [],
    exact: false, asset: null, image: null, src: null, srcSm: null, srcHead: null });

  // GENERIC ILLUSTRATIONS (2026-10-05, design review: "Keep a separate, explicitly illustrative fallback path"): never a
  // reference model, never matched to a documented standard's part. One is offered only where the record has no
  // reference picture, only for the type (and drive / spring) its rule names, and it always says what it is.
  const illus = index.illustrations || [];
  // the drive or spring the record STATES, listed or custom (Pozidriv on a cheese head is a custom combination, and is
  // still a Pozidriv); Unknown states nothing
  const statedVal = (f) => (f && f.status !== 'unknown' ? f.value : null);
  function illustrationFor(rec, headOnly = false) {
    if (!rec || !rec.head || rec.head.status !== 'listed') return null;
    const drive = rec.drive ? statedVal(rec.drive.type) : null;
    const spring = rec.specific && rec.specific.tnut ? statedVal(rec.specific.tnut.spring) : null;
    const hit = illus.find((i) => {
      const m = i.match;
      if (m.family !== rec.family || m.head !== rec.head.value) return false;
      if (headOnly) return !m.drive && !m.spring;   // a type tile shows the plain form of the type
      if (m.drive && m.drive !== drive) return false;
      if (m.spring && m.spring !== spring) return false;
      if (m.spring_not && spring && m.spring_not.includes(spring)) return false;
      return true;
    });
    return hit ? illustration(hit) : null;
  }
  const illustration = (i) => ({
    kind: 'illustration', asset: i.id, image: i.img, match: 'illustration', exact: false, finish: null,
    src: src(i), srcSm: src(i, '-sm'), srcHead: i.hasHead ? src(i, '-head') : null,
    caption: `Illustration: ${i.shows}`, notes: ['A generic shape, not a reference model of this part'],
    short: i.match.drive ? `Generic ${DRIVE_WORD[i.match.drive] || i.match.drive} ${ILLUS_NOUN[i.match.family] || 'part'}`
      : `Generic ${ILLUS_NOUN[`${i.match.family}:${i.match.head}`] || ILLUS_NOUN[i.match.family] || 'part'}`,
    details: [`Illustration: ${i.shows}`, 'A generic shape, not a reference model of this part', i.title ? `Drawn as: ${i.title}` : null,
      `Geometry: ${i.geometry || 'generic illustration'}`].filter(Boolean),
  });

  let MAT = null;          // the record being resolved: its material decides the finish picture
  let MAT_ISSUE = null;    // ...unless that material is not one the record's kind of part comes in (materialIssue)
  let WANT = null;         // ...and what it states (size, TPI, length, fine thread): render() names what the picture differs in
  function resolve(rec) {
    MAT = rec && rec.material ? rec.material : null;
    MAT_ISSUE = MAT && materialIssue ? materialIssue(rec) : null;
    try {
      const r = resolveRec(rec);
      // no reference picture: a generic illustration of the same type, if one is ruled in - labelled as such
      return r && r.kind === 'generic' ? (illustrationFor(rec) || r) : r;
    } finally { MAT = null; MAT_ISSUE = null; WANT = null; }
  }
  function resolveRec(rec) {
    if (!rec || !rec.head || rec.head.status !== 'listed') return null;
    const k = `${rec.family}:${rec.head.value}`;
    const list = byType.get(k);
    const rep = list && list.length ? repOf(k, list) : null;
    if (!rep) return generic('No reference picture of this type yet');

    // identity: what the record states must be what the picture shows
    const drive = rec.drive ? val(rec.drive.type) : null;
    let pool = list.filter((a) => a.drive === (drive || rep.drive));
    if (!pool.length) return generic(`No reference picture with a ${DRIVE_WORD[drive] || drive} drive yet`);
    if (rec.family === 'setscrew') {
      const pt = rec.specific ? val(rec.specific.point_type) : null;
      const sub = pool.filter((a) => a.point === (pt || rep.point || 'flat'));
      if (!sub.length) return generic(`No reference picture of a ${pt} point yet`);
      pool = sub;
    }
    // METRIC OR INCH is identity: an inch record never shows a metric picture and a metric record never an inch one
    // (design review 2026-10-05: no automatic substitution between approximately similar metric and inch parts)
    const inch = isUnified(rec);
    pool = pool.filter((a) => (a.units === 'in') === inch);
    if (!pool.length) return generic(inch ? 'No inch reference picture of this type yet' : 'No metric reference picture of this type yet');
    if (inch) return resolveInch(rec, pool);
    const df = families ? families.get(rec.family) : null;
    for (const f of df ? df.fields.filter((x) => x.identity) : []) {      // e.g. a spring pin's duty: heavy is not light
      const want = val(getp(rec, f.path));
      if (want === null) continue;
      const sub = pool.filter((a) => a[f.identity] === want);
      if (!sub.length) return generic(`No reference picture of the ${want} type yet`);
      pool = sub;
    }
    const ext = rec.specific && rec.specific.thread_extent ? val(rec.specific.thread_extent) : null;
    if (ext) {
      const sub = pool.filter((a) => shown(a).extent === ext);
      if (!sub.length) return generic(ext === 'partial' ? 'No part-threaded reference picture of this type yet' : 'No fully threaded reference picture of this type yet');
      pool = sub;
    }
    if (rec.standard && pool.some((a) => a.std === rec.standard)) pool = pool.filter((a) => a.std === rec.standard);
    const prim = primary.get(k);
    pool = [...pool].sort((a, b) => (b.std === prim) - (a.std === prim));

    // size and length: exact, else near (one note), else generic
    const pic = df ? df.picture : OWN_PICTURE[rec.family] || null;
    const d = pic ? val(getp(rec, pic.d)) : rec.thread ? val(rec.thread.diameter) : null;
    const L = pic ? (pic.L ? val(getp(rec, pic.L)) : null) : rec.length ? val(rec.length.value) : null;
    const lengthed = pic ? !!pic.L : rec.family === 'screw' || rec.family === 'setscrew';
    const px = pic ? pic.prefix : undefined;
    const th = rec.thread;
    WANT = { d, L, lengthed,
      fine: !!(th && th.pitch && th.pitch.status !== 'unknown' && val(th.pitch) !== null
        && !(th.pitch_class && th.pitch_class.status === 'listed' && th.pitch_class.value === 'coarse')) };
    const sized = pool.filter((a) => a.d !== null && a.d !== undefined);
    if (d !== null && !sized.length) return generic(`No reference picture at ${sizeText({ d }, px)} yet`);   // a stated size needs a sized picture
    if (d === null) {
      const pick = pool.find((a) => a.rep) || sized[0] || pool[0];
      return finish(pick, 'type', `Size not set - showing ${sizeText(shown(pick))}`, null, null);
    }
    let atD = sized.filter((a) => a.d === d); let match = 'exact';
    if (!atD.length && pic && pic.exact) return generic(`No reference picture of the ${fmt(d)}-position part yet`);   // a count is identity
    if (!atD.length) {
      const nd = nearest(sized, 'd', d).d;
      if (far(nd, d)) return generic(`No reference picture near ${sizeText({ d }, px)} yet`);
      atD = sized.filter((a) => a.d === nd); match = 'nearest-size';
    }
    let pick;
    if (L === null || !lengthed) {
      pick = atD.find((a) => a.rep) || atD[Math.floor((atD.length - 1) / 2)];
      if (lengthed) return finish(pick, match === 'exact' ? 'size' : match, `Length not set - showing ${sizeText(shown(pick))}`, d, null);
    } else {
      const withL = atD.filter((a) => a.L !== null && a.L !== undefined);
      if (!withL.length) return generic(`No reference picture near ${sizeText({ d, L }, px)} yet`);   // a stated length needs a lengthed picture
      pick = nearest(withL, 'L', L);
      if (pick.L !== null && pick.L !== undefined && pick.L !== L) {
        if (far(pick.L, L)) return generic(`No reference picture near ${sizeText({ d, L }, px)} yet`);
        if (match === 'exact') match = 'nearest-length';
      }
    }
    const note = match === 'exact' ? null : `No reference model at ${sizeText({ d, L: lengthed ? L : null }, px)} - showing ${sizeText(pick)}`;
    return finish(pick, match, note, d, lengthed ? L : null);
  }

  // An inch record: the designation and TPI match exactly, else the same designation at another TPI, else the nearest
  // major diameter within NEAR - each with one note; the length (inches) the same way. Every inch asset is rendered.
  function resolveInch(rec, pool) {
    const d = val(rec.thread.diameter); const tpi = val(rec.thread.tpi);
    const L = rec.length ? val(rec.length.value) : null;
    const ext = rec.specific && rec.specific.thread_extent ? val(rec.specific.thread_extent) : null;
    if (ext) {
      const sub = pool.filter((a) => a.extent === ext);
      if (!sub.length) return generic(ext === 'partial' ? 'No part-threaded inch reference picture yet' : 'No fully threaded inch reference picture yet');
      pool = sub;
    }
    // an inch WASHER (2026-10-05) is its designation alone - no threads per inch, no length: 1/4" or #10
    const washer = rec.thread.tpi === null;
    WANT = { d, L, lengthed: !!rec.length, tpi: washer ? undefined : tpi };
    const wText = (x) => (String(x).startsWith('#') ? String(x) : `${x}"`);
    const show = (a) => (washer ? wText(a.d) : inchText(a.d, a.tpi, a.L));
    if (d === null) {
      const pick = pool[Math.floor((pool.length - 1) / 2)];
      return render(pick, 'type', `Size not set - showing ${show(pick)}`, MAT);
    }
    // the designation: the record's own, else the nearest rendered one by major diameter (within NEAR); then its TPI:
    // the record's, else the COARSE row (lowest TPI) - deterministic whatever order the index is in
    let dd = d; let match = 'exact';
    if (!pool.some((a) => a.d === d)) {
      const want = majorOf(d);
      const ds = [...new Set(pool.map((a) => a.d))].map((x) => [x, majorOf(x)]).filter(([, m]) => m !== null);
      const best = want === null ? null : ds.reduce((b, x) => (b === null || Math.abs(x[1] - want) < Math.abs(b[1] - want)
        || (Math.abs(x[1] - want) === Math.abs(b[1] - want) && x[1] > b[1]) ? x : b), null);
      if (!best || far(best[1], want)) return generic(`No reference picture near ${washer ? wText(d) : inchText(d, tpi, null)} yet`);
      dd = best[0]; match = 'nearest-size';
    }
    if (washer) {           // the designation IS the whole identity: exact, or the nearest one with one note
      const pick = pool.find((a) => a.d === dd);
      return render(pick, match, match === 'exact' ? null : `No reference model at ${wText(d)} - showing ${show(pick)}`, MAT);
    }
    let atD = pool.filter((a) => a.d === dd && a.tpi === tpi);
    // a thread with no render of its own (a fine thread) shows the designation's COARSE render, said in one plain
    // sentence; the record's own designation and TPI stay authoritative (design review 2026-10-05)
    let threadNote = null;
    if (!atD.length) {
      const sameD = pool.filter((a) => a.d === dd);
      const coarse = Math.min(...sameD.map((a) => a.tpi));
      atD = sameD.filter((a) => a.tpi === coarse);
      if (tpi !== null) {
        match = 'nearest-size';
        if (dd === d) threadNote = tpi > coarse ? 'Illustration shows coarse thread; selected part is fine thread.'
          : `Illustration shows ${coarse} TPI; selected part is ${tpi} TPI.`;
      }
    }
    let pick;
    if (L === null) {
      pick = atD[Math.floor((atD.length - 1) / 2)];
      // an inch NUT has no length (2026-10-05): its designation and TPI are its whole size
      if (!rec.length) {
        return render(pick, tpi === null && match === 'exact' ? 'size' : match, tpi === null ? `TPI not set - showing ${show(pick)}`
          : match === 'exact' ? null : threadNote || `No reference model at ${inchText(d, tpi, null)} - showing ${show(pick)}`, MAT);
      }
      return render(pick, match === 'exact' ? 'size' : match, (threadNote ? `${threadNote} ` : '')
        + `${tpi === null ? 'TPI and length' : 'Length'} not set - showing ${show(pick)}`, MAT);
    }
    pick = nearest(atD, 'L', L);
    if (pick.L !== L) {
      if (far(pick.L, L)) return generic(`No reference picture near ${inchText(d, tpi, L)} yet`);
      if (match === 'exact') match = 'nearest-length';
    }
    // an unknown TPI is shown as the coarse row, and SAID so: the picture shows a specific thread the record does not state
    if (tpi === null) return render(pick, match === 'exact' ? 'size' : match, `TPI not set - showing ${show(pick)}`, MAT);
    if (threadNote) return render(pick, match, threadNote + (pick.L !== L ? ` Length shown: ${fracInch(pick.L)}".` : ''), MAT);
    return render(pick, match, match === 'exact' ? null : `No reference model at ${inchText(d, tpi, L)} - showing ${show(pick)}`, MAT);
  }

  // a failed CAD build: its picture is a rendered neighbour. The distance rule is measured from what the RECORD asks
  // for (wd, wL), not from the failed size, and the one note names both.
  function finish(pick, match, note, wd, wL) {
    if (pick.status !== 'fallback') return render(pick, match, note, MAT);
    const t = byId.get(pick.img);
    const d = wd ?? pick.d; const L = wL ?? pick.L;
    const asked = sizeText({ d, L });
    if (!t || far(t.d, d) || (L && t.L && far(t.L, L))) {
      return generic(`No reference picture of ${asked} - the CAD library cannot build ${asked === sizeText(pick) ? 'it' : sizeText(pick)}`);
    }
    return render(pick, 'fallback', asked === sizeText(pick)
      ? `${asked} cannot be built by the CAD library - showing ${sizeText(t)}`
      : `No reference model at ${asked} (${sizeText(pick)} cannot be built by the CAD library) - showing ${sizeText(t)}`, MAT);
  }

  function familyPicture(family) {      // the first type, in the picker's own head order, that has a picture
    const keys = [...heads.filter((h) => h.family === family).map((h) => `${h.family}:${h.id}`),
      ...[...byType.keys()].filter((k) => k.startsWith(`${family}:`))];
    for (const k of keys) { const l = byType.get(k); const r = l && repOf(k, l); if (r) return r; }
    return null;
  }

  return {
    resolve,
    // a type with no reference model shows its generic illustration, if any (drive-specific ones never stand for a type)
    typePicture: (family, head) => { const k = `${family}:${head}`; const l = byType.get(k); const r = l && repOf(k, l);
      return r ? render(r, 'type') : illustrationFor({ family, head: { status: 'listed', value: head } }, true); },
    // a family with no reference picture yet (T-nuts, fittings) shows its first plain illustration, labelled as one
    familyPicture: (family) => {
      const r = familyPicture(family); if (r) return render(r, 'type');
      const i = illus.find((x) => x.match.family === family && !x.match.drive && !x.match.spring);
      return i ? illustration(i) : null;
    },
    pointPicture: (point) => { const r = assets.find((a) => a.family === 'setscrew' && a.point === point && a.rep && a.status === 'rendered'); return r ? render(r, 'type') : null; },
  };
}
