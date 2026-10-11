// Label pins (2026-10-05, design review: "Let users pin fields that must appear. If a pinned field doesn't fit, report the
// non-fit. If another selected field is omitted, show 'Not shown on label: BLK OX' in the preview. Preserve the complete
// part record regardless of what appears on the label.")
//
// A pin names a FIELD PATH of the record ('head', 'material.finish', 'thread.series', ...). It says only that the field
// must be printed; it never changes the field, and nothing is removed from the record when a field is left off a label.
// A record with no `label_pins` uses the defaults: the type (head) and the material in its most specific recorded form
// (the property class, else the base material - defaultMaterialPin below) - what tells two drawers apart.
// Toggling any pin writes the full list explicitly, so a later change of the defaults never changes a saved choice.
// Automatic comparison against the neighbouring drawers is deliberately NOT done here (design review: a later pass).

export const DEFAULT_PINS = Object.freeze(['head', 'material.base']);

// The default material pin names the MOST SPECIFIC material field the record holds (design review 2026-10-05: on an M8 socket
// cap "the broad material word is consuming space that could identify the grade and finish"; SHCS · 12.9 · BLK OX was
// measured to fit at M3-M12): a property class (12.9 - it implies the steel) before the base material (STEEL, BRASS).
// Stainless keeps the base path: its printed text is already the group when one is known (A2, js/labelitem.js).
// Only the DEFAULT changes; an explicit pin list is the user's and is never rewritten.
const known = (f) => f && f.status !== 'unknown' && f.value !== null && f.value !== undefined && f.value !== '';
export function defaultMaterialPin(rec) {
  const m = rec && rec.material;
  if (m && known(m.base) && m.base.value === 'stainless') return 'material.base';
  if (m && known(m.property_class)) return 'material.property_class';
  return 'material.base';
}

export function pinsOf(rec) {
  return rec && Array.isArray(rec.label_pins) ? rec.label_pins.slice() : ['head', defaultMaterialPin(rec)];
}

export const isPinned = (rec, path) => pinsOf(rec).includes(path);

// the pin list after toggling `path` - a new array, for the caller to store on the record
export function togglePin(rec, path) {
  if (typeof path !== 'string' || !path) throw new RangeError('label pin: a field path is required');
  const pins = pinsOf(rec);
  return pins.includes(path) ? pins.filter((p) => p !== path) : [...pins, path];
}
