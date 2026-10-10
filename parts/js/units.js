// Units for the part picker (2026-10-05, Astra: "a units-aware data model - metric diameter/pitch and inch diameter/TPI,
// fractional input and display, correct length units, existing metric records preserved, no automatic substitution
// between approximately similar metric and inch parts").
//
// THE RECORD RULE. A thread with no `system` field is METRIC: every record saved before inch support is metric (the
// picker could make nothing else), so it stays byte-for-byte as it was - nothing is added to it on load. An INCH record
// says so explicitly:
//   thread.system   'unified'           (a Field, vocabulary)
//   thread.diameter '#10' | '1/4' ...   (the SIZE DESIGNATION as a string - never converted to a number of mm)
//   thread.tpi      24                  (threads per inch; replaces thread.pitch, which is null)
//   thread.series   'UNC' | 'UNF'       (replaces thread.pitch_class, which is null; never inferred from a custom tpi)
//   length.unit     'in'                (length.value is a number of INCHES)
// Nothing converts one system into the other: changing the system starts the thread and the length over as Unknown.

export const isUnified = (rec) => !!(rec && rec.thread && rec.thread.system && rec.thread.system.value === 'unified');
export const systemOf = (rec) => (rec && rec.thread ? (isUnified(rec) ? 'unified' : 'metric') : null);
export const lengthUnit = (rec) => (rec && rec.length && rec.length.unit && rec.length.unit.value === 'in' ? 'in' : 'mm');

// "1-1/4", "1 1/4", "1-1/4\"", "1.25", "5/8", "0.875 in", "1¼" -> inches (number), or null if it is not a length.
const VULGAR = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
export function parseInch(text) {
  if (typeof text === 'number') return Number.isFinite(text) && text > 0 ? text : null;
  let t = String(text ?? '').trim().toLowerCase().replace(/(″|"|”|''|inches|inch|in\.?)\s*$/, '').trim().replace(',', '.');
  if (!t) return null;
  for (const [g, v] of Object.entries(VULGAR)) {                     // "1¼" -> "1 1/4"
    if (t.includes(g)) t = t.replace(g, ` ${v * 8}/8`).trim();
  }
  let m = t.match(/^(\d+)\s*(?:-|\s)\s*(\d+)\s*\/\s*(\d+)$/);         // whole + fraction
  if (m) return +m[3] ? +m[1] + +m[2] / +m[3] : null;
  m = t.match(/^(\d+)\s*\/\s*(\d+)$/);                                 // fraction
  if (m) return +m[2] ? +m[1] / +m[2] : null;
  if (/^(\d+\.?\d*|\.\d+)$/.test(t)) { const n = Number(t); return n > 0 ? n : null; }
  return null;
}

// 1.25 -> "1-1/4", 0.875 -> "7/8", 2 -> "2", 0.05 -> "0.05" (a value that is no 1/64 fraction stays decimal)
export function fracInch(x) {
  if (x === null || x === undefined || !Number.isFinite(+x)) return '?';
  const v = +x; const whole = Math.floor(v + 1e-9); const rest = v - whole;
  const n64 = Math.round(rest * 64);
  if (Math.abs(rest * 64 - n64) > 1e-6) return String(+v.toFixed(4));
  if (n64 === 0) return String(whole);
  let num = n64, den = 64;
  while (num % 2 === 0) { num /= 2; den /= 2; }
  return whole ? `${whole}-${num}/${den}` : `${num}/${den}`;
}

// what a person types for an inch SIZE. A trailing inch mark means INCHES: "1\"" or "1 in" is the 1-inch size, "1/4\""
// is 1/4. Without one, a bare whole number up to 12 is a NUMBERED size, the trade's convention ("10" is #10, "1" is #1);
// "#10" and "no. 10" are numbered sizes. A fraction is reduced ("2/8" -> "1/4") and must be a real one (no zero part);
// a decimal of 1/4 or more is read as inches ("0.25" -> "1/4"). Anything else is refused (null), never coerced.
export function normalizeDesignation(text) {
  const raw = String(text ?? '').trim().toLowerCase();
  const mark = /(″|"|”|in\.?|inch|inches)\s*$/.test(raw);
  const t = raw.replace(/(″|"|”|inches|inch|in\.?)\s*$/, '').trim();
  if (!t) return null;
  if (!mark) {
    const m = t.match(/^(?:#|no\.?\s*|n°\s*)(\d{1,2})$/) || t.match(/^(\d{1,2})$/);
    if (m) return +m[1] <= 12 ? `#${+m[1]}` : null;
  }
  const f = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (f) return +f[1] === 0 || +f[2] === 0 ? null : fracInch(+f[1] / +f[2]);   // any real fraction (1/8 too: a custom size)
  const v = parseInch(t);                       // a bare decimal below 1/4 is refused: 0.19 could as well mean #10
  if (v === null || v < 0.25) return null;
  return fracInch(v);
}

// the thread as a person writes it: "M5" / "M5 × 0.5" (a fine pitch) / "#10-24" / "1/4-20"; unknowns read "?"
export function threadText(rec, { pitch = 'fine' } = {}) {
  const th = rec && rec.thread;
  if (!th) return null;
  const d = th.diameter;
  if (isUnified(rec)) {
    // an inch WASHER: the size alone - a fraction with its inch mark (1/4"), a numbered size without (#10)
    if (th.tpi === null) return d.status === 'unknown' ? '?' : (String(d.value).startsWith('#') ? String(d.value) : `${d.value}"`);
    const tpi = th.tpi && th.tpi.status !== 'unknown' ? String(th.tpi.value) : '?';
    return `${d.status === 'unknown' ? '?' : d.value}-${tpi}`;
  }
  const m = d.status === 'unknown' ? 'M?' : `M${+(+d.value).toFixed(3)}`;
  const p = th.pitch;
  const fine = p && p.status !== 'unknown' && !(th.pitch_class && th.pitch_class.status === 'listed' && th.pitch_class.value === 'coarse');
  return pitch === 'always' && p && p.status !== 'unknown' ? `${m} × ${+(+p.value).toFixed(3)}`
    : (pitch === 'fine' && fine ? `${m} × ${+(+p.value).toFixed(3)}` : m);
}

// a length value in the record's unit: metric "20", inch "1-1/4\"" (the inch mark is part of an inch length)
export function lengthText(rec, value) {
  if (value === null || value === undefined) return '?';
  return lengthUnit(rec) === 'in' ? `${fracInch(value)}"` : String(+(+value).toFixed(3));
}

// the record's own length field as text, '?' when unknown
export const recordLengthText = (rec) => (rec.length ? (rec.length.value.status === 'unknown' ? '?' : lengthText(rec, rec.length.value.value)) : null);
