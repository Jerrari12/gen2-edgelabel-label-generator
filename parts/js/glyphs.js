// Line glyphs for the picker (screen illustrations, not print-tested label symbols).
// Heads, nuts, set screws and inserts are drawn side-on; drives, washers and nut tops are drawn looking down.
// 48 x 48 viewBox, stroked in currentColor so a tile's colour state carries into its picture.
// Redrawn 2026-10-04 after the symbol review: the 6-lobe recess is the T25 outline bd_warehouse builds from
// its ISO 10664 table (the library's table, not checked against a copy of the standard), Phillips arms taper
// and Pozidriv arms are parallel with its 45-degree marks, the external hex has no centre dot, and nuts gain top views.

const SHAFT = '<path d="M20 20V44M28 20V44M20 24l8 3M20 29l8 3M20 34l8 3M20 39l8 3"/>';
const HEAD_CIRCLE = '<circle cx="24" cy="24" r="18"/>';
const HEX = (r, cx = 24, cy = 24) => {
  const pts = [];
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i; pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
  return `<polygon points="${pts.join(' ')}"/>`;
};
// sampled from bd_warehouse 0.3.0 hexalobular_recess('T25'): its ISO 10664 table row (A 4.5, B 3.25, Re 0.378) and its
// tangent-arc construction, scaled to a 10-unit outer radius
const LOBE = 'M15.6 27.0L15.3 27.4L15.1 28.0L15.1 28.5L15.3 29.0L15.7 29.4L16.1 29.7L16.7 29.8L17.2 29.8L18.0 29.7L18.8 29.7L19.6 29.9L20.4 30.3L21.1 30.7L21.6 31.3L22.1 32.0L22.4 32.8L22.6 33.3L23.0 33.7L23.5 33.9L24.0 34.0L24.5 33.9L25.0 33.7L25.4 33.3L25.6 32.8L25.9 32.0L26.4 31.3L26.9 30.7L27.6 30.3L28.4 29.9L29.2 29.7L30.0 29.7L30.8 29.8L31.3 29.8L31.9 29.7L32.3 29.4L32.7 29.0L32.9 28.5L32.9 28.0L32.7 27.4L32.4 27.0L31.9 26.4L31.5 25.6L31.3 24.8L31.2 24.0L31.3 23.2L31.5 22.4L31.9 21.6L32.4 21.0L32.7 20.6L32.9 20.0L32.9 19.5L32.7 19.0L32.3 18.6L31.9 18.3L31.3 18.2L30.8 18.2L30.0 18.3L29.2 18.3L28.4 18.1L27.6 17.7L26.9 17.3L26.4 16.7L25.9 16.0L25.6 15.2L25.4 14.7L25.0 14.3L24.5 14.1L24.0 14.0L23.5 14.1L23.0 14.3L22.6 14.7L22.4 15.2L22.1 16.0L21.6 16.7L21.1 17.3L20.4 17.7L19.6 18.1L18.8 18.3L18.0 18.3L17.2 18.2L16.7 18.2L16.1 18.3L15.7 18.6L15.3 19.0L15.1 19.5L15.1 20.0L15.3 20.6L15.6 21.0L16.1 21.6L16.5 22.4L16.7 23.2L16.8 24.0L16.7 24.8L16.5 25.6L16.1 26.4Z';

export const GLYPHS = {
  // heads (side view, head up)
  'socket-cap': '<rect x="13" y="5" width="22" height="15" rx="2"/>' + SHAFT,
  'button': '<path d="M10 20C12 8 36 8 38 20Z"/>' + SHAFT,
  'countersunk': '<path d="M8 8H40L29 20H19Z"/>' + SHAFT,
  'hex-head': '<rect x="10" y="7" width="28" height="13" rx="1"/><path d="M19 7V20M29 7V20"/>' + SHAFT,
  // pan / cheese (2026-10-05), scaled like the socket cap (its dk 8.5 x k 5 drawn 22 x 15): ISO 7045 M5 dk 9.5, k 3.7,
  // dome rf 8 - a short straight side under a shallow dome; ISO 1207 M5 dk 8.5, k 3.3 - a flat cylinder, top edge broken
  'pan-head': '<path d="M11.7 20V15.6C12.4 11.6 17.6 9 24 9C30.4 9 35.6 11.6 36.3 15.6V20Z"/>' + SHAFT,
  'cheese-head': '<path d="M13 20V11.6L14.6 10H33.4L35 11.6V20Z"/>' + SHAFT,
  // drives (looking down at the head)
  'hex-socket': HEAD_CIRCLE + '<polygon points="33,24 28.5,31.8 19.5,31.8 15,24 19.5,16.2 28.5,16.2"/>',
  'hexalobular': HEAD_CIRCLE + `<path d="${LOBE}"/>`,
  'phillips': HEAD_CIRCLE + '<path d="M22.6 12.5H25.4L26.9 21.1L35.5 22.6V25.4L26.9 26.9L25.4 35.5H22.6L21.1 26.9L12.5 25.4V22.6L21.1 21.1Z"/>',
  'pozidriv': HEAD_CIRCLE + '<path d="M22.2 12.5H25.8V22.2H35.5V25.8H25.8V35.5H22.2V25.8H12.5V22.2H22.2Z"/>'
    + '<path d="M27.4 20.6L31.4 16.6M20.6 20.6L16.6 16.6M27.4 27.4L31.4 31.4M20.6 27.4L16.6 31.4"/>',
  'slotted': HEAD_CIRCLE + '<rect x="11" y="22" width="26" height="4" rx="1"/>',
  'ext-hex': HEX(18),
  'no-drive': '<circle cx="24" cy="24" r="18" stroke-dasharray="3 5"/>',
  // nuts (side view: the height reads) and their top views
  'hex-nut': '<rect x="7" y="16" width="34" height="16" rx="1"/><path d="M18 16V32M30 16V32"/>',
  'thin-nut': '<rect x="7" y="20" width="34" height="8" rx="1"/><path d="M18 20V28M30 20V28"/>',
  'nyloc-thin': '<rect x="7" y="22" width="34" height="9" rx="1"/><path d="M18 22V31M30 22V31"/><path d="M11 22C13 15 35 15 37 22"/>',
  'nyloc-regular': '<rect x="7" y="19" width="34" height="16" rx="1"/><path d="M18 19V35M30 19V35"/><path d="M11 19C13 12 35 12 37 19"/>',
  'flange-nut': '<rect x="12" y="13" width="24" height="17" rx="1"/><path d="M20 13V30M28 13V30"/><path d="M5 35L12 30H36L43 35Z"/>',
  // batch 5 types (2026-10-05). Screen tiles only - the printed MODULITH icon family is unchanged while it is print-tested.
  // A square nut seen corner-on shows TWO faces (one line), a hex nut three; a cap nut is a hex with a dome.
  'square-nut': '<rect x="7" y="16" width="34" height="16" rx="1"/><path d="M24 16V32"/>',
  'square-thin-nut': '<rect x="7" y="20" width="34" height="8" rx="1"/><path d="M24 20V28"/>',
  'cap-nut': '<rect x="7" y="24" width="34" height="13" rx="1"/><path d="M18 24V37M30 24V37"/><path d="M11 24C11 11 37 11 37 24"/>',
  'nut-top': HEX(17) + '<circle cx="24" cy="24" r="7"/>',
  'flange-top': '<circle cx="24" cy="24" r="20"/>' + HEX(14) + '<circle cx="24" cy="24" r="6"/>',
  // washers (top view: the outside size reads)
  'plain-washer': '<circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="5"/>',
  'large-washer': '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="5"/>',
  'xl-washer': '<circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="5"/>',
  'small-washer': '<circle cx="24" cy="24" r="8.5"/><circle cx="24" cy="24" r="5"/>',
  'tooth-washer': '<circle cx="24" cy="24" r="13"/><circle cx="24" cy="24" r="8.5"/>'
    + '<path d="M24 15.5V19M24 29V32.5M15.5 24H19M29 24H32.5M18 18L20.5 20.5M27.5 27.5L30 30M18 30L20.5 27.5M27.5 20.5L30 18"/>',
  'spring-washer': '<path d="M27 11.4A13 13 0 1 1 20.5 11.5"/><path d="M26 16.6A8 8 0 1 1 21.5 16.5"/><path d="M27 11.4L26 16.6M20.5 11.5L21.5 16.5"/>',
  // set screw points (side view)
  'point-flat': '<path d="M18 6H30M18 6V36M30 6V36M18 12l12 3M18 18l12 3M18 24l12 3M18 30l12 3"/><path d="M18 36H30"/>',
  'point-cup': '<path d="M18 6H30M18 6V36M30 6V36M18 12l12 3M18 18l12 3M18 24l12 3"/><path d="M18 36Q24 30 30 36"/>',
  'point-cone': '<path d="M18 6H30M18 6V34M30 6V34M18 12l12 3M18 18l12 3M18 24l12 3"/><path d="M18 34L24 43L30 34"/>',
  'point-dog': '<path d="M18 6H30M18 6V32M30 6V32M18 12l12 3M18 18l12 3M18 24l12 3"/><path d="M18 32H21V43H27V32H30"/>',
  // inserts: generic illustrations of the category, not a particular part's geometry
  'heat-set': '<rect x="14" y="8" width="20" height="32" rx="2"/><path d="M14 13l20 8M34 13l-20 8M14 27l20 8M34 27l-20 8" stroke-width="1.5"/>',
  'press-in': '<rect x="14" y="8" width="20" height="32" rx="2"/><path d="M19.5 8V40M24 8V40M28.5 8V40" stroke-width="1.5"/><path d="M10 8H38"/>',
  'self-tap': '<rect x="17" y="8" width="14" height="32" rx="2"/><path d="M17 12L12 15L17 18M17 20L12 23L17 26M17 28L12 31L17 34M31 12L36 15L31 18M31 20L36 23L31 26M31 28L36 31L31 34"/>',
  // thread and tools
  'coarse': '<path d="M5 31L11 17L17 31L23 17L29 31L35 17L41 31"/>',
  'fine': '<path d="M5 28L8 20L11 28L14 20L17 28L20 20L23 28L26 20L29 28L32 20L35 28L38 20L41 28"/>',
  'hex-key': '<path d="M13 8V33Q13 39 19 39H40" stroke-width="5"/>',
  'bit': '<path d="M20 6H28V30L24 36L20 30Z"/><path d="M20 14H28M20 22H28"/><path d="M24 36V43"/>',
  'across-flats': HEX(13) + '<path d="M17 4V9M31 4V9M17 6.5H31" stroke-width="1.5"/>',
  'length': '<path d="M6 24H42M6 18V30M42 18V30M10 20L6 24L10 28M38 20L42 24L38 28"/>',
  // tube fittings (2026-10-04): generic shapes, side view - collet ends drawn as short bars
  'fit-straight-male': '<rect x="16" y="8" width="16" height="15" rx="2"/><path d="M14 8h20"/><rect x="13" y="23" width="22" height="7" rx="1"/>'
    + '<path d="M19 23v7M29 23v7"/><rect x="19" y="30" width="10" height="11"/><path d="M19 33l10 2M19 37l10 2"/>',
  'fit-union': '<rect x="10" y="17" width="28" height="14" rx="3"/><path d="M8 15v18M40 15v18"/><path d="M21 17c2 3 2 11 0 14M27 17c-2 3-2 11 0 14"/>',
  'fit-elbow': '<path d="M9 21h17V9h11v21a5 5 0 0 1-5 5H9z"/><path d="M7 19v18M24 7h15"/>',
  'fit-tee': '<path d="M8 15h32v12H30v12H18V27H8z"/><path d="M6 13v16M42 13v16M16 41h16"/>',
  'fit-bulkhead': '<rect x="9" y="18" width="30" height="12" rx="3"/><path d="M7 16v16M41 16v16"/><rect x="21" y="11" width="6" height="26" rx="1"/>',
  'fit-cartridge': '<rect x="16" y="12" width="16" height="24" rx="2"/><path d="M13 12h22M20 12v24M28 12v24"/>',
  'fit-plug': '<rect x="14" y="20" width="20" height="10" rx="2"/><path d="M12 18v14"/><rect x="34" y="22" width="6" height="6" rx="1"/>',
  // extrusion T-nuts: end view in the slot (the thread is the vertical line)
  'tnut-hammer': '<path d="M8 30h32l-6-8H14z"/><rect x="18" y="14" width="12" height="8" rx="1"/><path d="M24 14v16"/>',
  'tnut-roll-in': '<path d="M8 30c4-9 28-9 32 0z"/><rect x="18" y="14" width="12" height="8" rx="1"/><path d="M24 14v16"/>',
  'tnut-sliding': '<path d="M6 32h36v-7H31v-9H17v9H6z"/><path d="M24 16v16"/>',
  'tnut-two-hole': '<rect x="6" y="18" width="36" height="12" rx="2"/><circle cx="16" cy="24" r="2.5"/><circle cx="32" cy="24" r="2.5"/>',
  // blind rivets: side view, head up, mandrel through the body
  'rivet-dome': '<path d="M12 19c2-9 22-9 24 0z"/><rect x="19" y="19" width="10" height="16"/><path d="M24 6v37"/><path d="M22 43h4"/>',
  'rivet-csk': '<path d="M10 12h28l-9 8H19z"/><rect x="19" y="20" width="10" height="15"/><path d="M24 6v37"/><path d="M22 43h4"/>',
  'rivet-flange': '<rect x="7" y="15" width="34" height="4" rx="1"/><rect x="19" y="19" width="10" height="16"/><path d="M24 6v37"/><path d="M22 43h4"/>',
  // Other part: a tag
  'part-other': '<path d="M9 14h21l9 10-9 10H9z"/><circle cx="15" cy="24" r="2.2"/>',
  // states
  'unknown': '<circle cx="24" cy="24" r="17" stroke-dasharray="3 4"/><path d="M19.5 19.5a4.5 4.5 0 1 1 6.6 4c-1.4.8-2.1 1.6-2.1 3.2"/><circle cx="24" cy="32" r="0.6" stroke-width="2.4"/>',
  'custom': '<rect x="8" y="8" width="32" height="32" rx="4"/><path d="M17 31l2-6 10-10 4 4-10 10z"/><path d="M27 17l4 4"/>',
};

import { DATA_FAMILIES, DATA_GLYPHS } from './families-data.js';
Object.assign(GLYPHS, DATA_GLYPHS);

export function glyph(id, px = 40, cls = '') {
  const body = GLYPHS[id] || GLYPHS.unknown;
  return `<svg class="glyph ${cls}" width="${px}" height="${px}" viewBox="0 0 48 48" fill="none" stroke="currentColor" `
    + `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// engine ids -> glyph ids
export const FAMILY_GLYPH = { screw: 'socket-cap', nut: 'nut-top', washer: 'plain-washer', setscrew: 'point-cup', insert: 'heat-set',
  fitting: 'fit-straight-male', tnut: 'tnut-hammer', rivet: 'rivet-dome', other: 'part-other' };
const HEAD_GLYPH = {
  screw: { 'socket-cap': 'socket-cap', button: 'button', countersunk: 'countersunk', hex: 'hex-head', pan: 'pan-head', cheese: 'cheese-head' },
  nut: { hex: 'hex-nut', thin: 'thin-nut', 'nylon-thin': 'nyloc-thin', 'nylon-regular': 'nyloc-regular', flange: 'flange-nut',
    style2: 'hex-nut', 'thin-unchamfered': 'thin-nut', square: 'square-nut', 'square-thin': 'square-thin-nut',
    'flange-plain': 'flange-nut', cap: 'cap-nut' },
  washer: { plain: 'plain-washer', large: 'large-washer', 'extra-large': 'xl-washer', spring: 'spring-washer',
    'plain-c': 'plain-washer', chamfered: 'plain-washer', small: 'small-washer', 'tooth-internal': 'tooth-washer' },
  setscrew: { 'hex-socket-set': 'point-flat' },
  insert: { 'heat-set': 'heat-set', 'press-in': 'press-in', 'self-tapping': 'self-tap' },
  fitting: { 'straight-male': 'fit-straight-male', 'straight-union': 'fit-union', 'reducing-union': 'fit-union', 'elbow-male': 'fit-elbow',
    'elbow-union': 'fit-elbow', 'tee-union': 'fit-tee', 'bulkhead-union': 'fit-bulkhead', 'push-in-cartridge': 'fit-cartridge', plug: 'fit-plug' },
  tnut: { 'drop-in-hammer': 'tnut-hammer', 'roll-in': 'tnut-roll-in', 'sliding-t': 'tnut-sliding', 'two-hole': 'tnut-two-hole' },
  rivet: { dome: 'rivet-dome', countersunk: 'rivet-csk', 'large-flange': 'rivet-flange' },
};
for (const df of DATA_FAMILIES) {
  FAMILY_GLYPH[df.id] = df.glyph;
  HEAD_GLYPH[df.id] = Object.fromEntries(df.heads.map(([id, , g]) => [id, g]));
}
export const headGlyph = (family, id) => (HEAD_GLYPH[family] && HEAD_GLYPH[family][id]) || null;
export const DRIVE_GLYPH = { 'hex-socket': 'hex-socket', 'external-hex': 'ext-hex', hexalobular: 'hexalobular', phillips: 'phillips',
  pozidriv: 'pozidriv', slotted: 'slotted', none: 'no-drive' };
export const POINT_GLYPH = { flat: 'point-flat', cup: 'point-cup', cone: 'point-cone', dog: 'point-dog' };
export const nutTopGlyph = (id) => (id === 'flange' ? 'flange-top' : 'nut-top');
