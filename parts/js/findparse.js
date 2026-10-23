// FIND A PART: THE READER (2026-10-17). Joey: "add a 'Find a part' box to the Picker that reads shorthand (M5x16r, M3x12b,
// M3nN, M3nS, 'M3x20 socket', 'DIN 912 M3x20') into the record, shows candidates when ambiguous". This file reads text into
// ranked CANDIDATES - the family, the type, the size, the length, the drive - and nothing else: no DOM, no engine, no
// record. js/find.js replays a candidate the way the step clicks would, so what a candidate MAKES is always the engine's.
//
// Where the meanings come from: the Find-box map of 2026-10-17 (Prusa's own assembly manuals and 1:1 cheatsheets, the
// record path through ui.js, the DIN/ISO alias table; each part re-checked by a skeptic, whose correction wins). The rules
// a reader must not get wrong:
//   - Prusa's b means COUNTERSUNK (c on packages); round/button is r; T is Torx (6-lobe); T with no head letter
//     (M3x4T) is a headless Torx GRUB screw, never a Torx socket head.
//   - a plain b carries no drive (MINI+ Torx, MK3S+ hex), nN is a thin DIN 985 OR a regular ISO 7040 nyloc, and w is a
//     plain OR a large washer: each offers both, never a guess.
//   - a bare code (M3x20) is a socket head cap only BY DEFAULT: it is offered first, with the others beside it.
//   - Prusa never names a standard: a code's type is read from its letters, the standard is the type's (the engine's).
import { normalizeDesignation, parseInch } from './units.js';

export const FIND_EXAMPLES = ['M5x16r', 'M3x12bT', 'M3nN', 'M3nS', 'M3x20 socket', 'DIN 912 M3x20'];

const NUM = '\\d+(?:[.,]\\d+)?';
const num = (s) => Number(String(s).replace(',', '.').replace(/\s+/g, ''));
const famOf = (p) => p.split('/')[0];
const headOf = (p) => p.split('/')[1];
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const an = (w) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);

// ---------------------------------------------------------------- what the data says (M8x1: a pitch; M3x8: a length)
// ctx = readerContext(D). Without one the reader still works, with a coarser rule for a pitch (under half the size).
export function readerContext(D) {
  const coarse = new Map(D.bd.coarse_series.map((c) => [c.diameter, c.pitch]));
  const fine = new Map();
  for (const f of D.own.fine_pitches) { if (!fine.has(f.diameter)) fine.set(f.diameter, []); fine.get(f.diameter).push(f.pitch); }
  const unified = new Map(D.own.unified_series.map((u) => [u.designation, { unc: u.unc, unf: u.unf }]));
  return { coarse, fine, unified };
}
const isPitch = (ctx, d, n) => (ctx ? ctx.coarse.get(d) === n || (ctx.fine.get(d) || []).includes(n) : n > 0 && n < d / 2 && n <= 6);
const unifiedOf = (ctx, d) => (ctx && ctx.unified ? ctx.unified.get(d) || null : null);

// ---------------------------------------------------------------- what each family takes
// thread: an M size; pitch: a pitch the page lets you choose; length: the length the label prints; units: inch sizes too
const SHAPE = {
  screw: { thread: true, pitch: true, length: true, units: true, drive: true },
  setscrew: { thread: true, pitch: true, length: true, drive: true },
  nut: { thread: true, pitch: true, units: true },
  washer: { thread: true, units: true },
  insert: { thread: true, pitch: true },
  tnut: { thread: true },
  springwasher: { thread: true },
  rod: { thread: true, rodLength: true },
  standoff: { thread: true, length: true },
  thumb: { thread: true, length: true },
  shoulder: { thread: true, length: true, shoulder: true },
  pin: { pin: true, length: true },
  ring: { ring: true },
};
export const FIND_NOUN = { screw: 'screw', setscrew: 'set screw', nut: 'nut', washer: 'washer', insert: 'insert', tnut: 'T-nut',
  springwasher: 'lock washer', rod: 'threaded rod', standoff: 'standoff', thumb: 'thumb screw', shoulder: 'shoulder screw',
  pin: 'pin', ring: 'retaining ring' };
const NOUN = FIND_NOUN;
const takesLength = (f) => !!(SHAPE[f] && (SHAPE[f].length || SHAPE[f].rodLength));
// the type a family always has (the set screw has no Type tiles of its own: the engine sets its one head with the family)
const AUTO_HEAD = { setscrew: 'hex-socket-set' };

// ---------------------------------------------------------------- the words
// Every phrase is lower case, with hyphens read as spaces ("t-nut" is "t nut"); a plural reads as its singular; the longest
// phrase wins ("socket set screw" over "socket"). An entry says what it is evidence of:
//   fh      [family/head, ...] the types it names, best first ('setscrew/*': the set screw's one type; 'screw/?': a screw
//           whose type is to choose; 'tnut/?': a T-nut whose insertion type is not given)
//   fh0     what a family word means when nothing names the type ("nut": a hex nut)
//   family  the families a word allows ("nut" rules out a countersunk screw)
//   drive / point / extent / series / fields, and prefer (a modifier choosing among the types named: "thin")
//   note    a caveat the reading carries; alt: a caveat for one of its types only
const WORDS = [];
const say = (terms, ev) => { for (const t of terms) WORDS.push([t, ev]); };
// ---- screws (own_tables heads: socket-cap ISO 4762, button ISO 7380-1, countersunk ISO 10642, hex ISO 4017, pan ISO 7045,
// cheese ISO 1207). The bare word "socket" is Joey's own example ("M3x20 socket"); "regular bolt" is Prusa's cheatsheet name.
say(['socket head cap screw', 'socket head cap', 'socket cap screw', 'socket cap', 'socket head screw', 'socket head',
  'socket screw', 'cap screw', 'cap head screw', 'allen bolt', 'allen screw', 'allen head screw', 'allen head', 'shcs',
  'socket', 'regular bolt'], { fh: ['screw/socket-cap'] });
say(['hex socket head cap screw', 'hex socket cap screw', 'hexagon socket head cap screw', 'hex socket head screw'],
  { fh: ['screw/socket-cap'], drive: 'hex-socket' });
// "round head" is what Prusa's r stands for; in US use it can also name a slotted head the Picker does not have
say(['button head socket cap screw', 'button head cap screw', 'button head screw', 'button head', 'button socket',
  'socket button', 'button screw', 'button cap screw', 'bhcs', 'button', 'round head', 'round', 'dome head', 'domed head'],
{ fh: ['screw/button'] });
say(['countersunk head screw', 'countersunk head', 'countersunk screw', 'countersunk', 'counter sunk', 'countersink', 'csk',
  'flat head socket cap screw', 'flat head cap screw', 'flat head screw', 'flat head', 'flathead', 'fhcs', 'flat socket',
  'socket countersunk', 'countersunk socket'], { fh: ['screw/countersunk'] });
say(['hex head cap screw', 'hex head screw', 'hex head bolt', 'hex head', 'hex bolt', 'hex screw', 'hex cap screw', 'hex cap',
  'hexagon head bolt', 'hexagon head screw', 'hexagon head', 'hexagon bolt', 'hhcs'], { fh: ['screw/hex'] });
say(['pan head screw', 'pan head', 'pan', 'raised cheese head'], { fh: ['screw/pan'] });
say(['cheese head screw', 'cheese head', 'cheese', 'fillister head', 'fillister'], { fh: ['screw/cheese'] });
// ---- set screws. In the UK a "set screw" can also be a fully threaded hex bolt: the bare words offer that second
say(['socket set screw', 'hex socket set screw', 'grub screw', 'grub', 'headless screw', 'headless set screw', 'headless'],
  { fh: ['setscrew/*'] });
say(['set screw', 'setscrew'], { fh: ['setscrew/*', 'screw/hex'], alt: { 'screw/hex': 'read as a UK "set screw": a fully threaded hex bolt' } });
say(['flat point'], { fh: ['setscrew/*'], point: 'flat' });
say(['cup point', 'cup'], { fh: ['setscrew/*'], point: 'cup' });
say(['cone point', 'cone'], { fh: ['setscrew/*'], point: 'cone' });
say(['dog point', 'dog'], { fh: ['setscrew/*'], point: 'dog' });
// words that name different parts in different drawers: the other words decide, and with none every sense is offered.
// "flat" is a flat head or a flat washer; a flat POINT only where another word named the set screw (weak: it agrees, it
// never proposes)
say(['flat'], { fh: ['screw/countersunk', 'washer/plain', 'setscrew/*'], weak: ['setscrew/*'], attrs: { 'setscrew/*': { point: 'flat' } } });
say(['hex', 'hexagon'], { fh: ['screw/hex', 'nut/hex'] });
say(['cap'], { fh: ['screw/socket-cap', 'nut/cap'] });
say(['dome', 'domed'], { fh: ['screw/button', 'nut/cap'] });
// ---- drives (own_tables drive_types). A T-size (T10) says Torx; it never fills the tool size (the clicks do not either)
say(['torx', 'tx', 'torx plus', 'hexalobular', 'hexalobe', '6 lobe', 'six lobe', '6 lobular', 'star drive'], { drive: 'hexalobular' });
say(['hex socket', 'hexagon socket', 'allen', 'inbus', 'allen key', 'hex key'], { drive: 'hex-socket' });
say(['phillips', 'philips', 'cross', 'cross recess', 'cross recessed', 'crosshead', 'cross head', 'ph'], { drive: 'phillips' });
say(['pozidriv', 'pozidrive', 'pozi', 'pz', 'pozi drive'], { drive: 'pozidriv' });
say(['slotted', 'slot', 'slot head', 'slotted head', 'flat blade'], { drive: 'slotted' });
// ---- thread extent (a screw's, in Details)
say(['fully threaded', 'full thread', 'full threaded', 'thread to head'], { extent: 'full' });
say(['partially threaded', 'partial thread', 'part threaded', 'half thread', 'half threaded'], { extent: 'partial' });
// ---- nuts (own_tables heads, nut family)
say(['nut'], { family: ['nut', 'tnut', 'rod'], fh0: ['nut/hex'] });
say(['hex nut', 'hexagon nut', 'full nut', 'finished hex nut', 'plain nut', 'regular nut'], { fh: ['nut/hex'] });
say(['jam nut', 'thin nut', 'thin hex nut', 'half nut'], { fh: ['nut/thin'] });
// Prusa never states its nyloc's height, and DIN 985 (4 mm at M3) and ISO 7040 (4.5) are both sold as nyloc: both, thin
// first (README: "the common hobby nyloc"). js/synonyms.js sends these to the regular one, which the map found wrong.
const NYLOC = { fh: ['nut/nylon-thin', 'nut/nylon-regular'], note: 'a nyloc is thin (DIN 985) or regular (ISO 7040): the name does not say which' };
say(['nyloc', 'nyloc nut', 'nylock', 'nylock nut', 'nylon lock nut', 'nylon locknut', 'nylon insert lock nut',
  'nylon insert locknut', 'nylon insert nut', 'nyloc locknut', 'nylon lock'], NYLOC);
say(['thin nyloc', 'thin nyloc nut', 'thin nylock', 'thin nylon lock nut', 'thin nylon insert nut'], { fh: ['nut/nylon-thin'] });
say(['regular nyloc', 'regular nyloc nut', 'regular nylock', 'regular nylon lock nut'], { fh: ['nut/nylon-regular'] });
say(['lock nut', 'locknut', 'locking nut'], { fh: ['nut/nylon-thin', 'nut/nylon-regular', 'nut/flange', 'nut/thin'],
  note: '"lock nut" names several types: a nyloc, a serrated flange nut, or a jam nut used as a lock nut' });
say(['flange nut', 'serrated flange nut', 'flanged nut', 'flange lock nut', 'flng'], { fh: ['nut/flange'] });
say(['plain flange nut'], { fh: ['nut/flange-plain'] });
// DIN 557 starts at M5: the small square nuts (Prusa's M3nS) are the thin DIN 562 type (the page's own hint). find.js puts
// the type whose table lists the size first.
say(['square nut', 'square'], { fh: ['nut/square', 'nut/square-thin'] });
say(['thin square nut', 'square thin nut'], { fh: ['nut/square-thin'] });
say(['domed cap nut', 'dome cap nut', 'dome nut', 'domed nut', 'acorn nut', 'cap nut'], { fh: ['nut/cap'] });
say(['style 2 nut', 'style 2 hex nut', 'high nut'], { fh: ['nut/style2'] });
say(['unchamfered thin nut', 'thin unchamfered nut', 'unchamfered jam nut'], { fh: ['nut/thin-unchamfered'] });
// ---- T-nuts (js/picker.js tnut): the insertion type is the Type; its profile and slot are not read from text
say(['t nut', 'tnut', 'slot nut', 'extrusion nut', 'extrusion t nut', 'profile nut'], { fh: ['tnut/?'] });
say(['hammer nut', 'hammer head nut', 'hammer t nut', 'drop in nut', 'drop in t nut'], { fh: ['tnut/drop-in-hammer'] });
say(['roll in nut', 'roll in t nut'], { fh: ['tnut/roll-in'] });
say(['sliding t nut', 'sliding nut', 'slide in nut'], { fh: ['tnut/sliding-t'] });
say(['two hole t nut', 'two hole t plate', 't plate'], { fh: ['tnut/two-hole'] });
say(['spring leaf', 'sheet metal spring', 'with spring'], { fields: { tnutSpring: 'spring leaf' } });
say(['ball spring', 'spring ball'], { fields: { tnutSpring: 'ball spring' } });
// ---- washers (own_tables heads, washer family; the lock washers of families-data.js)
say(['washer'], { family: ['washer', 'springwasher'], fh0: ['washer/plain'] });
say(['plain washer', 'flat washer', 'plain flat washer', 'fw'], { fh: ['washer/plain'] });
say(['large washer', 'large series washer', 'penny washer', 'large flat washer'], { fh: ['washer/large'] });
say(['fender washer'], { fh: ['washer/large', 'washer/extra-large'], note: '"fender washer" is used for the large and the extra-large series' });
say(['extra large washer', 'extra large series washer'], { fh: ['washer/extra-large'] });
say(['small washer', 'small series washer'], { fh: ['washer/small'] });
say(['chamfered washer'], { fh: ['washer/chamfered'] });
// the DIN 127 B spring washer is in the Picker twice: the washer type (with its table) and the lock-washer family's split
const SPRING = { fh: ['washer/spring', 'springwasher/split'],
  alt: { 'springwasher/split': 'the same part in the lock-washer family, which has no size table' } };
say(['spring washer', 'spring lock washer', 'split washer', 'split lock washer', 'helical spring washer', 'helical spring lock washer',
  'helical washer'], SPRING);
say(['lock washer', 'lockwasher', 'locking washer'], { fh: ['washer/spring', 'washer/tooth-internal', 'springwasher/split',
  'springwasher/wave', 'springwasher/conical'], note: '"lock washer" names several types' });
say(['internal tooth lock washer', 'internal tooth washer', 'tooth lock washer', 'tooth washer', 'star washer', 'star lock washer',
  'shakeproof washer', 'shakeproof'], { fh: ['washer/tooth-internal'] });
say(['wave washer', 'crinkle washer', 'wave spring washer'], { fh: ['springwasher/wave'] });
say(['conical washer', 'conical spring washer', 'belleville washer', 'belleville'], { fh: ['springwasher/conical'] });
// inch washers: SAE is the narrow series (ASME B18.22.1 N), USS the wide one (W) - as washer words only (on a screw SAE
// means a fine thread)
say(['sae washer', 'sae flat washer', 'narrow washer'], { fh: ['washer/plain'] });
say(['uss washer', 'uss flat washer', 'wide washer'], { fh: ['washer/large'] });
// ---- inserts
say(['heat set insert', 'heatset insert', 'heat insert', 'heat set', 'heatset', 'threaded insert', 'brass insert',
  'heat set threaded insert', 'melt in insert'], { fh: ['insert/heat-set'] });
say(['insert'], { fh: ['insert/heat-set', 'insert/press-in', 'insert/self-tapping'] });
say(['press in insert', 'press fit insert', 'press insert'], { fh: ['insert/press-in'] });
say(['self tapping insert'], { fh: ['insert/self-tapping'] });
// ---- the data families (js/families-data.js)
say(['standoff', 'stand off', 'pcb standoff', 'hex standoff', 'hex spacer', 'pcb spacer', 'female female standoff', 'f f standoff',
  'female female'], { fh: ['standoff/hex-ff'] });
say(['male female standoff', 'm f standoff', 'male female', 'm f'], { fh: ['standoff/hex-mf'] });
say(['male male standoff', 'm m standoff', 'male male', 'm m'], { fh: ['standoff/hex-mm'] });
say(['round standoff'], { fh: ['standoff/round-ff'] });
say(['spacer', 'round spacer', 'nylon spacer', 'unthreaded spacer'], { fh: ['standoff/spacer'] });
say(['shoulder bolt', 'shoulder screw', 'stripper bolt'], { fh: ['shoulder/socket-iso7379'] });
say(['pin'], { family: ['pin'], fh0: ['pin/dowel'] });
say(['dowel pin', 'dowel', 'parallel pin'], { fh: ['pin/dowel'] });
say(['spring pin', 'roll pin', 'tension pin', 'slotted spring pin', 'slotted pin'], { fh: ['pin/spring-slotted'] });
say(['coiled pin', 'coiled spring pin', 'spiral pin'], { fh: ['pin/spring-coiled'] });
say(['clevis pin'], { fh: ['pin/clevis'] });
say(['split pin', 'cotter pin', 'cotter'], { fh: ['pin/split'] });
say(['heavy'], { fields: { pinDuty: 'heavy' } });
say(['light'], { fields: { pinDuty: 'light' } });
say(['circlip', 'retaining ring', 'snap ring', 'seeger ring', 'seeger'], { fh: ['ring/external', 'ring/internal'],
  note: 'a circlip is external (on a shaft, DIN 471) or internal (in a bore, DIN 472)' });
say(['external circlip', 'shaft circlip', 'external retaining ring', 'external snap ring'], { fh: ['ring/external'] });
say(['internal circlip', 'bore circlip', 'internal retaining ring', 'internal snap ring'], { fh: ['ring/internal'] });
say(['e clip', 'eclip', 'e ring'], { fh: ['ring/e-clip'] });
say(['threaded rod', 'threaded bar', 'all thread', 'allthread', 'all thread rod', 'studding'], { fh: ['rod/threaded-rod'] });
say(['coupling nut', 'coupler nut', 'rod coupler', 'connector nut'], { fh: ['rod/coupling-nut'] });
say(['thumb screw', 'thumbscrew', 'knurled screw', 'knurled thumb screw', 'knurled head screw'], { fh: ['thumb/knurled-high', 'thumb/knurled-low'] });
say(['wing screw', 'wing bolt'], { fh: ['thumb/wing'] });
// ---- a family word alone
say(['screw', 'machine screw'], { family: ['screw', 'setscrew', 'thumb', 'shoulder'], fh0: ['screw/socket-cap', 'screw/?'] });
say(['bolt'], { family: ['screw', 'shoulder'], fh0: ['screw/socket-cap', 'screw/?'] });
// ---- modifiers: they choose among the types the other words named
say(['thin'], { prefer: ['thin', 'nylon-thin', 'square-thin', 'thin-unchamfered'], fh0: ['nut/thin'] });
say(['regular'], { prefer: ['nylon-regular', 'hex', 'plain', 'socket-cap'] });
say(['large'], { prefer: ['large'], fh0: ['washer/large'] });
say(['extra large'], { prefer: ['extra-large'], fh0: ['washer/extra-large'] });
say(['spring'], { prefer: ['spring', 'split', 'spring-slotted'], fields: { tnutSpring: 'spring leaf' } });
// ---- an inch series named without its TPI (1/4 UNF)
say(['unc', 'coarse'], { series: 'unc' });
say(['unf', 'fine'], { series: 'unf' });
// ---- parts the Picker has no type for: said so, never mapped to a near type (the alias map's DO NOT ALIAS lists)
say(['wing nut', 'butterfly nut'], { notype: 'a wing nut (DIN 315)' });
say(['knurled nut', 'thumb nut'], { notype: 'a knurled thumb nut (DIN 466 / 467)' });
say(['wood screw', 'chipboard screw', 'self tapping screw', 'tapping screw', 'sheet metal screw', 'drywall screw',
  'thread forming screw', 'plastite screw'], { notype: 'a self-tapping or wood screw' });
say(['carriage bolt', 'coach bolt', 'eye bolt', 'u bolt', 'j bolt', 'hanger bolt'], { notype: 'that kind of bolt' });
say(['rivet nut', 'rivnut', 'nutsert'], { notype: 'a rivet nut' });
say(['flange bolt', 'flange screw', 'hex flange bolt', 'flanged bolt'], { notype: 'a hex flange bolt (EN 1665 / DIN 6921)' });
say(['low head', 'low head cap screw', 'low head socket cap screw', 'low head socket'], { notype: 'a low-head socket cap screw (DIN 7984)' });
// ---- materials and finishes: not filled in from the text (said, and chosen under Details), and never read as the type
say(['stainless steel', 'stainless', 'steel', 'carbon steel', 'alloy steel', 'zinc plated', 'zinc', 'black oxide', 'black', 'brass',
  'nylon', 'aluminium', 'aluminum', 'titanium', 'galvanized', 'galvanised', 'hot dip galvanized', 'nickel plated', 'copper', 'plastic'],
{ material: true });
// ---- words that carry no part information
const NOISE = new Set(['mm', 'metric', 'with', 'and', 'or', 'of', 'the', 'for', 'a', 'an', 'type', 'size', 'head', 'pcs', 'pc', 'pieces',
  'piece', 'qty', 'x', 'iso', 'din', 'en', 'standard', 'kit', 'spare', 'bag', 'prusa', 'part', 'parts', 'hardware', 'fastener',
  'fasteners', 'thread', 'threads', 'threaded', 'inch', 'inches', 'in', 'imperial', 'long', 'length', 'l', 'm', '#']);
const PHRASES = new Map(WORDS.map(([t, ev]) => [t, { ...ev, phrase: t }]));
const MAX_WORDS = Math.max(...WORDS.map(([t]) => t.split(' ').length));

// ---------------------------------------------------------------- the standards (the alias map, its corrections applied)
// key: din912, iso7380-1, din125a ... -> evidence. A designation the Picker cannot record exactly says so (note); one it
// has no type for says that (notype), rather than landing on a near type.
const S = (fh, extra = {}) => ({ fh: [fh].flat(), ...extra });
const DIN965 = { drives: ['phillips', 'pozidriv'], driveWhy: { phillips: 'cross recess, type H (Phillips)', pozidriv: 'cross recess, type Z (Pozidriv)' } };
const STANDARDS = {
  // socket head cap
  din912: S('screw/socket-cap'), iso4762: S('screw/socket-cap'),
  iso14579: S('screw/socket-cap', { drive: 'hexalobular' }),
  // button: "DIN 7380" is no DIN number, it is everyday shorthand for (DIN EN) ISO 7380
  'iso7380-1': S('screw/button'), iso7380: S('screw/button'), din7380: S('screw/button', { note: '"DIN 7380" is read as ISO 7380 (there is no DIN 7380)' }),
  'iso7380-2': { notype: 'a button head with a collar (ISO 7380-2)' },
  din34805: S('screw/button', { drive: 'hexalobular' }), 'din34805-1': S('screw/button', { drive: 'hexalobular' }),
  // countersunk: DIN 7991 is withdrawn and about equal to ISO 10642 (Bossard)
  iso10642: S('screw/countersunk'), din7991: S('screw/countersunk', { note: 'DIN 7991 (withdrawn) is read as ISO 10642, its near equivalent' }),
  iso14581: S('screw/countersunk', { drive: 'hexalobular' }),
  din965: S('screw/countersunk', DIN965), iso7046: S('screw/countersunk', DIN965), 'iso7046-1': S('screw/countersunk', DIN965),
  din963: S('screw/countersunk', { drive: 'slotted' }), iso2009: S('screw/countersunk', { drive: 'slotted' }),
  iso7047: { notype: 'a raised countersunk head (ISO 7047 / DIN 966)' }, din966: { notype: 'a raised countersunk head (ISO 7047 / DIN 966)' },
  // hex head. DIN 931 / ISO 4014 is part-threaded and the data has no ISO 4014 table: a hex head with a partial thread,
  // under the ISO 4017 label, said so; ISO 4018 / DIN 558 is the same form at grade C
  iso4017: S('screw/hex'), din933: S('screw/hex'),
  iso4014: S('screw/hex', { extent: 'partial', note: 'the data has no ISO 4014 table: recorded as a hex head (ISO 4017) with a partial thread' }),
  din931: S('screw/hex', { extent: 'partial', note: 'the data has no DIN 931 / ISO 4014 table: recorded as a hex head (ISO 4017) with a partial thread' }),
  iso4018: S('screw/hex', { note: 'ISO 4018 is the grade C hex screw: recorded with the ISO 4017 table' }),
  din558: S('screw/hex', { note: 'DIN 558 (ISO 4018, grade C) is recorded with the ISO 4017 table' }),
  // pan and cheese heads, with the drives their standards name
  iso7045: S('screw/pan'), din7985: S('screw/pan'),
  iso1580: S('screw/pan', { drive: 'slotted' }), din85: S('screw/pan', { drive: 'slotted' }),
  iso14583: S('screw/pan', { drive: 'hexalobular' }),
  iso1207: S('screw/cheese'), din84: S('screw/cheese'),
  iso7048: S('screw/cheese', { drive: 'phillips' }), iso14580: S('screw/cheese', { drive: 'hexalobular' }),
  din7984: { notype: 'a low-head socket cap screw (DIN 7984)' }, din6921: { notype: 'a hex flange bolt (DIN 6921)' },
  en1665: { notype: 'a hex flange bolt (EN 1665)' }, din7500: { notype: 'a thread-forming screw (DIN 7500)' },
  // set screws: only a flat point is ISO 4026; the other points borrow its table (picker.js)
  iso4026: S('setscrew/*', { point: 'flat' }), din913: S('setscrew/*', { point: 'flat' }),
  iso4027: S('setscrew/*', { point: 'cone' }), din914: S('setscrew/*', { point: 'cone' }),
  iso4028: S('setscrew/*', { point: 'dog' }), din915: S('setscrew/*', { point: 'dog' }),
  iso4029: S('setscrew/*', { point: 'cup' }), din916: S('setscrew/*', { point: 'cup' }),
  din34827: S('setscrew/*', { drive: 'hexalobular' }), iso4766: S('setscrew/*', { drive: 'slotted' }),
  // nuts. DIN 970 is ISO 4032 modified; DIN 936 the fine-thread low nut; DIN 982 near ISO 7040 (its heights differ);
  // EN 1661 replaced DIN 6923, and its M10 is 16 mm across flats where the table's 15 is DIN 6923's
  iso4032: S('nut/hex'), din934: S('nut/hex'), din970: S('nut/hex', { note: 'DIN 970 (ISO 4032 modified) is read as ISO 4032' }),
  iso4035: S('nut/thin'), din439b: S('nut/thin'), din936: S('nut/thin', { note: 'DIN 936 is a fine-thread thin nut, and its heights differ from ISO 4035' }),
  iso4036: S('nut/thin-unchamfered'),
  din439a: S(['nut/thin-unchamfered', 'nut/thin'], { note: 'DIN 439 A: one source lists it as ISO 4035, its title says unchamfered (ISO 4036)' }),
  din439: S(['nut/thin', 'nut/thin-unchamfered'], { note: 'DIN 439 comes as form B (chamfered, ISO 4035) and form A (unchamfered)' }),
  din985: S('nut/nylon-thin'), iso10511: S('nut/nylon-thin'),
  iso7040: S('nut/nylon-regular'), din982: S('nut/nylon-regular', { note: 'DIN 982 is near ISO 7040, but its heights differ' }),
  din6923: S('nut/flange'), iso4161: S('nut/flange'),
  en1661: S('nut/flange', { note: 'EN 1661 M10 is 16 mm across flats; the table\'s 15 mm is DIN 6923\'s' }),
  din1665: S('nut/flange-plain', { note: 'the data\'s "DIN 1665" nut label is suspect: EN 1665 is a hex flange bolt' }),
  iso4033: S('nut/style2'), en24033: S('nut/style2'),
  din557: S('nut/square'), din562: S('nut/square-thin'), din1587: S('nut/cap'),
  din917: { notype: 'a low cap nut (DIN 917)' }, din980: { notype: 'an all-metal lock nut (DIN 980)' }, din315: { notype: 'a wing nut (DIN 315)' },
  din466: { notype: 'a knurled nut (DIN 466)' }, din467: { notype: 'a knurled nut (DIN 467)' },
  din6334: S('rod/coupling-nut'),
  // washers. A bare DIN 125 is form A (ISO 7089) or B (chamfered, ISO 7090); DIN 440 R is a timber washer, about ISO 7094
  iso7089: S('washer/plain'), din125a: S('washer/plain'), din125: S(['washer/plain', 'washer/chamfered'], { note: 'DIN 125 comes as form A (plain) and form B (chamfered)' }),
  iso7090: S('washer/chamfered'), din125b: S('washer/chamfered'),
  iso7093: S('washer/large'), 'iso7093-1': S('washer/large'), din9021: S('washer/large'),
  iso7094: S('washer/extra-large'), din440r: S('washer/extra-large', { note: 'DIN 440 R (a timber-construction washer) is read as ISO 7094' }),
  din440: S('washer/extra-large', { note: 'DIN 440 R (a timber-construction washer) is read as ISO 7094' }),
  iso7091: S('washer/plain-c'), din126: S('washer/plain-c'),
  iso7092: S('washer/small'), din433: S('washer/small'),
  din6797: S('washer/tooth-internal', { note: 'DIN 6797 is read as form J (internal teeth); the external form A is not in the Picker' }),
  din6797j: S('washer/tooth-internal'), din6797a: { notype: 'an external tooth lock washer (DIN 6797 A)' },
  din127: S(['washer/spring', 'springwasher/split'], { alt: SPRING.alt }), din127b: S(['washer/spring', 'springwasher/split'], { alt: SPRING.alt }),
  din137: S('springwasher/wave'), din137b: S('springwasher/wave'), din6796: S('springwasher/conical'),
  // pins, retaining rings, rods, thumb and shoulder screws
  iso2338: S('pin/dowel'), din7: S('pin/dowel'), iso8734: S('pin/dowel'), din6325: S('pin/dowel'),
  iso8752: S('pin/spring-slotted', { fields: { pinDuty: 'heavy' } }), din1481: S('pin/spring-slotted', { fields: { pinDuty: 'heavy' } }),
  iso13337: S('pin/spring-slotted', { fields: { pinDuty: 'light' } }), din7346: S('pin/spring-slotted', { fields: { pinDuty: 'light' } }),
  iso8750: S('pin/spring-coiled'), din7343: S('pin/spring-coiled'),
  iso1234: S('pin/split'), din94: S('pin/split'), iso2341: S('pin/clevis'), din1444: S('pin/clevis'),
  din471: S('ring/external'), din472: S('ring/internal'), din6799: S('ring/e-clip'),
  'din976-1': S('rod/threaded-rod'), din976: S('rod/threaded-rod'), din975: S('rod/threaded-rod', { note: 'DIN 975 is withdrawn: threaded rod is DIN 976-1 now' }),
  din464: S('thumb/knurled-high'), din653: S('thumb/knurled-low'), din316: S('thumb/wing'),
  iso7379: S('shoulder/socket-iso7379'),
};
export const FIND_STANDARDS = Object.keys(STANDARDS);
const stdName = (pre, n, part, letter) => `${pre.toUpperCase()} ${n}${part ? '-' + part : ''}${letter ? ' ' + letter.toUpperCase() : ''}`;

// ---------------------------------------------------------------- Prusa's codes (the map's prusa-notation, corrected)
function screwCode(suffix, mk3) {
  switch (suffix) {
    case 'r': return { fh: ['screw/button'], why: 'r = round (button) head in Prusa\'s codes' };
    case 'rt': return { fh: ['screw/button'], drive: 'hexalobular', why: 'rT = button head, Torx, in Prusa\'s codes' };
    case 'bt': return { fh: ['screw/countersunk'], drive: 'hexalobular', why: 'bT = countersunk, Torx, in Prusa\'s codes' };
    case 'ct': return { fh: ['screw/countersunk'], drive: 'hexalobular', why: 'cT = bT, countersunk with Torx (Prusa\'s package label)' };
    case 'b': case 'c':
      // the MK3S+ "M3x12b(14b)" is hex (that kit has only Allen keys); a plain b anywhere else carries no drive
      return { fh: ['screw/countersunk'], drives: mk3 ? [null] : [null, 'hexalobular'], prusaB: true,
        why: suffix === 'b' ? 'b = countersunk in Prusa\'s codes (button is r)' : 'c = countersunk (Prusa\'s package label)',
        driveWhy: mk3 ? { null: 'hex socket, the MK3S+ kit\'s' } : { null: 'hex socket, as in MK3S+ kits', hexalobular: 'Torx, as in MINI+ and XL kits' },
        note: mk3 ? null : 'Prusa\'s b carries no drive: MK3S+ kits use hex socket, MINI+ and XL use Torx' };
    case 't': return { fh: ['setscrew/*'], drive: 'hexalobular', why: 'T with no head letter = a headless Torx grub screw in Prusa\'s codes' };
    default: return null;
  }
}
function nutCode(suffix) {
  switch (suffix) {
    case 'n': return { fh: ['nut/hex'], why: 'n = hex nut in Prusa\'s codes' };
    case 'nn': return { ...NYLOC, why: 'nN = nyloc in Prusa\'s codes', note: 'Prusa never states its nyloc\'s height: thin (DIN 985) or regular (ISO 7040)' };
    case 'ns': return { fh: ['nut/square-thin'], why: 'nS = square nut in Prusa\'s codes (the thin DIN 562 at M3)' };
    case 'ne': return { fh: ['tnut/?'], fields: { tnutSpring: 'none' }, why: 'nE = extrusion T-nut in Prusa\'s codes' };
    case 'nes': return { fh: ['tnut/?'], fields: { tnutSpring: 'spring leaf' }, why: 'nEs = extrusion T-nut with a sheet-metal spring in Prusa\'s codes' };
    case 'w': return { fh: ['washer/plain', 'washer/large'], why: 'w = washer in Prusa\'s codes',
      note: 'Prusa does not say which series: the MK4 drawing reads 7 mm across (plain), the MK3S+ part was 3.2/9/0.8 (large)' };
    default: return null;
  }
}

// ---------------------------------------------------------------- reading
export function normalizeFind(text) {
  return String(text ?? '').normalize('NFC')
    .replace(/[×✕✖⨯∗*]/g, 'x').replace(/[‐‑‒–—−]/g, '-').replace(/[″“”]/g, '"').replace(/[′’]/g, '\'').replace(/⁄/g, '/')
    .replace(/\s+/g, ' ').trim();
}
const AT = '(?<![\\w.#/])';      // a size starts at a word's start, not inside a number or a word
const INCH_LEN = '(\\d+(?:\\s*-\\s*\\d+\\s*/\\s*\\d+|\\s+\\d+\\s*/\\s*\\d+|\\s*/\\s*\\d+|\\.\\d+)?)\\s*(?:"|inch(?:es)?\\b|in\\b)?';
const blank = (m) => ' '.repeat(m.length);

// text -> { status, candidates, message, notes, unread }. status: 'one' | 'several' | 'none' | 'unsupported'.
export function readFind(text, ctx = null) {
  const original = normalizeFind(text);
  const out = { text: original, status: 'none', candidates: [], message: null, notes: [], unread: [] };
  if (!original) return out;
  const f = { metric: [], inch: [], bare: [], codes: [], stds: [], words: [], numbers: [], lengths: [], notype: [], issues: [], material: [] };
  let rest = original.toLowerCase().replace(/(\d)(m\d)/g, '$1 $2');

  // a package count from a part list ("M3x10 screw (4x)") is not part of the part
  rest = rest.replace(/\(\s*\d+\s*(?:x|pcs?|pieces?)\s*\)/g, blank).replace(/\b\d+\s*(?:pcs|pc|pieces|piece)\b/g, blank);
  // standards: DIN 912, ISO 7380-1, DIN 125 A, DIN EN ISO 4762
  rest = rest.replace(/\b(din\s*en\s*iso|din\s*iso|en\s*iso|din|iso|en)\s*-?\s*(\d{1,5})(?:\s*-\s*(\d{1,2})(?!\d))?(?:[\s-]*([abjr])\b)?/g,
    (m, p, n, part, letter) => {
      const pre = /iso/.test(p) ? 'iso' : p === 'en' ? 'en' : 'din';
      const pt = part ? `-${part}` : '';
      const tries = [[`${pre}${n}${pt}${letter || ''}`, part, letter], [`${pre}${n}${pt}`, part, null], [`${pre}${n}${letter || ''}`, null, letter], [`${pre}${n}`, null, null]];
      const hit = tries.find(([k]) => STANDARDS[k]);
      if (!hit) { f.issues.push(`${stdName(pre, n, part, letter)} is not a standard the Picker records.`); return blank(m); }
      const ev = STANDARDS[hit[0]];
      const name = stdName(pre, n, hit[1], hit[2]);
      if (ev.notype) f.notype.push(ev.notype); else f.stds.push({ ...ev, std: name, why: name });
      return blank(m);
    });
  // Prusa's self-tapping codes have no M (3x8sT, 2.9x6.5sT): the Picker has no self-tapping screw type
  rest = rest.replace(new RegExp(`${AT}(${NUM})x(${NUM})st(?![a-z0-9])`, 'g'), (m, d, l) => {
    f.notype.push(`${d}x${l}sT (Prusa's self-tapping Torx screw)`); return blank(m);
  });
  // Prusa's nuts and washers: M3n, M3nN, M3nS, M3nE, M3nEs, M3w (the letters read the same in either case: no two collide)
  rest = rest.replace(new RegExp(`${AT}m(${NUM})(nes|ne|nn|ns|n|w)(?![a-z0-9])`, 'g'), (m, d, s) => {
    f.metric.push({ d: num(d), nums: [], raw: m.trim(), alt: null });
    f.codes.push({ ...nutCode(s), code: m.trim() });
    return blank(m);
  });
  // metric sizes: M3, M2.5, M3x20, M3-20, M3 x 20 mm, M3x0.5x20, M3-0.5x20, and Prusa's screw letters after the length
  // (M5x16r, M3x12b, M3x4rT, M3x12bT, M3x4cT, M3x4T), with the MK3S+ alternative "M3x12b(14b)"
  rest = rest.replace(new RegExp(`${AT}m\\s?(${NUM})(?:\\s*[x-]\\s*(${NUM}))?(?:\\s*[x-]\\s*(${NUM}))?(?:\\s*mm)?([brc]?t?)(?:\\s*\\(\\s*(${NUM})\\s*([brc]?t?)\\s*\\))?(?![a-z0-9])`, 'g'),
    (m, d, a, b, suffix, alt, altSuffix) => {
      const nums = [a, b].filter((x) => x !== undefined).map(num);
      const code = suffix || (alt !== undefined ? altSuffix : '');
      // coded: Prusa's letters follow the LENGTH, so a code's one number is its length even where it is also a pitch (M6x1T)
      f.metric.push({ d: num(d), nums, raw: m.trim(), alt: alt !== undefined ? num(alt) : null, coded: !!code });
      if (code && !nums.length) f.issues.push(`${m.trim()}: Prusa's letters come after the length (M3x12${suffix}).`);
      else if (code) f.codes.push({ ...screwCode(code, alt !== undefined), code: m.trim() });
      return blank(m);
    });
  // inch with a TPI: #10-24, 1/4-20, 1/4"-20 x 1-1/4", 5/16-18 x 1.5, 6-32 x 1/2", 7/8-9, 1"-8 (Sol 01a14d03: a one-digit TPI
  // and a marked 1" were lost). A bare number is a numbered size only with a TPI that size has (10-24 is #10), else the
  // whole-inch size with that TPI (1-8 is 1"), else no inch size at all (3-20). A one-digit TPI is only ever the big sizes'
  // own (7/8-9, 1"-8): after any other size the digit is not read as threads per inch (1/4-1 is not a TPI of 1)
  rest = rest.replace(new RegExp(`${AT}(#\\s?\\d{1,2}|no\\.?\\s?\\d{1,2}|\\d+\\s*/\\s*\\d+|\\d*\\.\\d+|\\d{1,2})\\s*("|inch\\b|in\\b)?\\s*-\\s*(\\d{1,3})(?:\\s*(?:unc|unf)\\b)?(?:\\s*x\\s*${INCH_LEN})?`, 'g'),
    (m, dz, mark, tpi, len) => {
      const hasTpi = (x) => { const u = unifiedOf(ctx, x); return !!u && [u.unc, u.unf].includes(+tpi); };
      const z = dz.replace(/\s+/g, '');
      const d = mark ? normalizeDesignation(`${z}"`) : /^\d{1,2}$/.test(z) ? [`#${z}`, z].find(hasTpi) || null : normalizeDesignation(z);
      if (!d || (tpi.length === 1 && !hasTpi(d))) return m;    // not an inch size with that TPI: the other readers try
      f.inch.push({ d, tpi: +tpi, length: len !== undefined ? parseInch(len) : null, raw: m.trim() });
      return blank(m);
    });
  // inch without a TPI: #10 (x 3/4), 1/4" (x 1), and a bare fraction the Unified table has (1/4 washer)
  rest = rest.replace(new RegExp(`${AT}(#\\s?\\d{1,2}|no\\.\\s?\\d{1,2}|\\d+\\s*/\\s*\\d+\\s*(?:"|inch\\b|in\\b)?|\\d*\\.\\d+\\s*(?:"|inch\\b|in\\b)|\\d+\\s*(?:"|inch\\b))(?:\\s*x\\s*${INCH_LEN})?`, 'g'),
    (m, dz, len) => {
      const marked = /#|no\.|"|in/.test(dz);
      const d = normalizeDesignation(dz.replace(/\s+/g, ''));
      if (!d || (!marked && !unifiedOf(ctx, d))) return m;
      f.inch.push({ d, tpi: null, length: len !== undefined ? parseInch(len) : null, raw: m.trim() });
      return blank(m);
    });
  // a size with no M (3x25: a pin's diameter x length, or prose that left the M off, as Prusa's "socket set screw 3x25")
  rest = rest.replace(new RegExp(`${AT}(${NUM})\\s*x\\s*(${NUM})(?:\\s*mm)?(?![a-z0-9/])`, 'g'), (m, a, b) => {
    f.bare.push({ a: num(a), b: num(b), raw: m.trim() }); return blank(m);
  });
  // a material is not a size: a stainless grade (A2, A4-80), a property class (8.8, 10.9, 12.9, class 8, 45H) - or "M3
  // socket A2-70" read as M3 x 70. Find does not fill materials in: it says so, and they are chosen under Details.
  rest = rest.replace(/(?<![\w.])(?:a[1-5](?:\s*-\s*\d{2,3})?|(?:4\.6|4\.8|5\.6|5\.8|6\.8|8\.8|9\.8|10\.9|12\.9)|(?:class|grade|gr\.?)\s*\d+(?:\.\d+)?h?)(?![\w.])/g,
    (m) => { f.material.push(asTyped(original, m.trim())); return blank(m); });
  // a length on its own: 20mm, 20 mm, L20, L=20, length 20
  rest = rest.replace(new RegExp(`${AT}(?:l\\s*=?\\s*|length\\s*=?\\s*)(${NUM})(?:\\s*mm)?(?![a-z0-9])|${AT}(${NUM})\\s*mm(?![a-z0-9])`, 'g'),
    (m, a, b) => { f.lengths.push({ v: num(a !== undefined ? a : b), mm: /mm/.test(m) }); return blank(m); });

  // the words: the longest phrase first
  const toks = rest.replace(/[^a-z0-9.#/]+/g, ' ').split(' ').map((t) => t.replace(/^\.+|\.+$/g, '')).filter(Boolean);
  for (let i = 0; i < toks.length;) {
    let hit = null;
    for (let n = Math.min(MAX_WORDS, toks.length - i); n >= 1 && !hit; n--) {
      const ph = toks.slice(i, i + n).join(' ');
      const ev = PHRASES.get(ph) || PHRASES.get(ph.replace(/(?<=[a-z]{3})s$/, ''));
      if (ev) hit = { n, ev };
    }
    if (hit) {
      if (hit.ev.notype) f.notype.push(hit.ev.notype);
      else if (hit.ev.material) f.material.push(asTyped(original, toks.slice(i, i + hit.n).join(' ')));
      else f.words.push(hit.ev);
      i += hit.n; continue;
    }
    const t = toks[i];
    if (/^tx?\d{1,2}$/.test(t)) f.words.push({ drive: 'hexalobular', phrase: t, note: `${t.toUpperCase()} names the drive; the tool size is not filled in from the text` });
    else if (/^ph[0-4]$/.test(t)) f.words.push({ drive: 'phillips', phrase: t });
    else if (/^pz[0-4]$/.test(t)) f.words.push({ drive: 'pozidriv', phrase: t });
    else if (/^\d+(?:\.\d+)?$/.test(t)) f.numbers.push(num(t));
    else if (!NOISE.has(t)) out.unread.push(asTyped(original, t));
    i++;
  }

  // ---- what cannot be read at all
  // a shoulder screw is written with two sizes, the shoulder and the thread (8x20 M6)
  const shoulder = [...f.stds, ...f.words].some((e) => e.fh && e.fh.some((p) => famOf(p) === 'shoulder'));
  const sizes = f.metric.length + f.inch.length + (shoulder && f.metric.length ? 0 : f.bare.length);
  if (sizes > 1) {
    out.message = `Two sizes (${[...f.metric, ...f.inch, ...f.bare].map((x) => asTyped(original, x.raw)).join(', ')}): Find reads one part at a time.`;
    return out;
  }
  const evs = [...f.codes, ...f.stds, ...f.words];
  if (f.notype.length && !evs.some((e) => e.fh || e.fh0)) {
    out.status = 'unsupported';
    out.message = `${cap(f.notype[0])} is not a type the Picker has. Pick the nearest under Type, or record it as an Other part.`;
    return out;
  }
  out.notes.push(...f.issues);
  const seen = new Set();
  out.candidates = interpret(f, evs, ctx, out).filter((c) => { const k = candKey(c); if (seen.has(k)) return false; seen.add(k); return true; });
  if (f.notype.length) out.notes.push(`${cap(f.notype[0])} is not a type the Picker has: read without it.`);
  if (f.material.length) out.notes.push(`${f.material.join(', ')}: Find does not fill the material in; choose it under Details.`);
  if (out.unread.length) out.notes.push(`Not read: ${out.unread.join(', ')}.`);
  if (!out.candidates.length) {
    out.message = `Not read as a part. Try ${FIND_EXAMPLES.slice(0, 4).join(', ')}, "M3x20 socket" or "DIN 912 M3x20".`;
    return out;
  }
  out.status = out.candidates.length === 1 ? 'one' : 'several';
  return out;
}
// a word as the person typed it (the reading works in lower case)
function asTyped(original, t) {
  const i = original.toLowerCase().indexOf(t);
  return i >= 0 ? original.slice(i, i + t.length) : t;
}
export const candKey = (c) => [c.family, c.head ?? '?', c.point || '', c.system, c.thread ?? '', c.pitch ?? '', c.tpi ?? '', c.length ?? '',
  c.drive || '', c.extent || '', JSON.stringify(c.fields || {})].join('|');

// ---------------------------------------------------------------- evidence -> candidates
function interpret(f, evs, ctx, out) {
  const metric = f.metric[0] || null; const inch = f.inch[0] || null; const bare = f.bare[0] || null;
  // whether the size has a length: it decides the bare default and which families stay in
  const hasLength = !!((metric && metric.nums.some((n) => !isPitch(ctx, metric.d, n))) || (inch && inch.length !== null) || bare
    || f.lengths.length || ((metric || inch) && f.numbers.length));

  // the types: every reading that names some must agree; where two cannot, both are offered, the earlier one first (the
  // code's, then the standard's, then the words')
  // (a reading with weak types meets the others last, so its weak types can only agree)
  const named = evs.filter((e) => e.fh).sort((a, b) => !!a.weak - !!b.weak);
  let pairs = null; const clash = [];
  for (const e of named) {
    const mine = e.fh.filter((p) => pairs || !(e.weak || []).includes(p)).map((p) => ({ p, from: [e] }));
    if (!pairs) { pairs = mine; continue; }
    const both = [];
    for (const a of pairs) for (const b of mine) { const p = meet(a.p, b.p); if (p && !both.some((x) => x.p === p)) both.push({ p, from: [...a.from, e] }); }
    if (both.length) pairs = both; else clash.push(...mine);
  }
  if (pairs && clash.length) {
    for (const x of clash) if (!pairs.some((y) => y.p === x.p)) pairs.push(x);
    const trap = named.some((e) => e.prusaB) && named.some((e) => !e.prusaB && e.fh.includes('screw/button'));
    out.notes.push(trap ? 'Prusa\'s b means countersunk, not button (button is r, as in M3x12r): both readings are offered.'
      : `${named.map((e) => e.code || e.std || `"${e.phrase}"`).join(' and ')} name different types: each reading is offered.`);
  }
  // a family word alone ("M3 nut"), then the size alone ("M3x20": a socket head cap by default, Prusa's regular bolt)
  if (!pairs) {
    const fw = evs.find((e) => e.fh0);
    if (fw) pairs = fw.fh0.map((p) => ({ p, from: [fw], word: true }));
    else if (metric || inch) pairs = (hasLength ? ['screw/socket-cap', 'screw/?', 'setscrew/*'] : ['screw/?', 'nut/hex', 'washer/plain']).map((p) => ({ p, from: [], bare: true }));
    else if (bare) pairs = ['screw/socket-cap', 'pin/dowel', 'screw/?'].map((p) => ({ p, from: [], bare: true }));
    else return [];
  }
  // the family words narrow it ("M3x12b nut" cannot be a countersunk screw: said, and the code's reading kept)
  for (const e of evs.filter((x) => x.family)) {
    const x = pairs.filter((q) => e.family.includes(famOf(q.p)));
    if (x.length) pairs = x;
    else out.notes.push(`"${e.phrase}" does not fit ${pairs.map((q) => an(NOUN[famOf(q.p)])).filter(uniq).join(' or ')}: not used.`);
  }
  // (a modifier that also names a field - "spring" on a T-nut - is used there; anywhere else it is said to be unused)
  const fieldFits = (e) => !!e.fields && pairs.some((q) => (e.fields.tnutSpring && famOf(q.p) === 'tnut') || (e.fields.pinDuty && famOf(q.p) === 'pin'));
  for (const e of evs.filter((x) => x.prefer)) {
    const x = pairs.filter((q) => e.prefer.includes(headOf(q.p)));
    if (x.length) pairs = x;
    else if (!fieldFits(e)) out.notes.push(`"${e.phrase}" does not fit this part: not used.`);
  }
  // a length rules out the parts that have none, while one that has a length is among them
  if (hasLength && pairs.some((q) => takesLength(famOf(q.p)))) pairs = pairs.filter((q) => takesLength(famOf(q.p)));
  return pairs.flatMap((q) => build(q, f, evs, ctx, { metric, inch, bare }));
}
const uniq = (x, i, a) => a.indexOf(x) === i;
// two readings of the types meet where they agree; a wildcard ('?', '*') gives way to the type the other names
function meet(a, b) {
  if (famOf(a) !== famOf(b)) return null;
  const ha = headOf(a); const hb = headOf(b);
  if (ha === hb) return a;
  if (ha === '?' || ha === '*') return b;
  if (hb === '?' || hb === '*') return a;
  return null;
}

// one type -> its candidates: more than one where a Prusa b leaves the drive open, or "(14b)" gives a second length
function build(q, f, evs, ctx, sizes) {
  const family = famOf(q.p); const h = headOf(q.p);
  const shape = SHAPE[family] || {};
  const c = { family, head: h === '?' ? null : h === '*' ? (AUTO_HEAD[family] || null) : h, system: 'metric',
    thread: null, pitch: null, tpi: null, length: null, drive: null, point: null, extent: null, fields: {}, why: [], notes: [] };
  const own = q.from;                                    // the readings this type came from
  const loose = evs.filter((e) => !e.fh && !e.fh0);      // drive, extent, series and field words
  const why = (s) => { if (s && !c.why.includes(s)) c.why.push(s); };
  const note = (s) => { if (s && !c.notes.includes(s)) c.notes.push(s); };
  for (const e of own) { why(e.why); note(e.note); if (e.alt && e.alt[q.p]) note(e.alt[q.p]); }
  if (q.bare) {
    why(q.p === 'screw/socket-cap' ? 'a bare size: a socket head cap by default (Prusa\'s "regular bolt")'
      : q.p === 'screw/?' ? 'a screw: its type to choose under Type' : `a bare size, read as ${an(NOUN[family])}`);
  }
  if (h === '?' && family === 'tnut') note('its insertion type is not given: choose it under Type');

  Object.assign(c, sizeOf(family, shape, sizes, f, ctx, note));
  for (const e of [...own, ...loose]) {
    const point = e.point || (e.attrs && e.attrs[q.p] && e.attrs[q.p].point);
    if (point && family === 'setscrew') c.point = point;
    if (e.extent) { if (family === 'screw') c.extent = e.extent; else note(`"${e.phrase}" applies to a screw: not used`); }
    for (const [k, v] of Object.entries(e.fields || {})) {
      if (k === 'tnutSpring' && family === 'tnut') c.fields['specific.tnut.spring'] = v;
      else if (k === 'pinDuty' && family === 'pin' && h === 'spring-slotted') c.fields['specific.pin.duty'] = v;
      else if (!e.prefer && !e.code && !e.std) note(`"${e.phrase}" does not apply to ${an(NOUN[family])}: not used`);
    }
    // 1/4 UNF: the series named without its threads per inch
    if (e.series && c.system === 'unified' && c.tpi === null && family !== 'washer') {
      const u = unifiedOf(ctx, c.thread);
      if (u && u[e.series]) c.tpi = u[e.series];
    }
  }
  // the drive: a named drive (a word, a standard, Torx in a code) wins over a code's open choice (a plain b: hex or Torx)
  const named = [...own, ...loose].filter((e) => e.drive);
  const open = own.find((e) => e.drives);
  let drives = [null];
  if (named.length) {
    // two drives named that disagree: each reading is offered, as two types are (Sol 01a14d03)
    drives = [...new Set(named.map((e) => e.drive))];
    if (drives.length > 1) note(`${named.map((e) => e.code || e.std || `"${e.phrase}"`).join(' and ')} name different drives: each reading is offered`);
    for (const e of named) note(e.note);
  } else if (open) drives = open.drives;
  if (drives.some(Boolean) && !shape.drive) { note(`${an(NOUN[family])} has no drive to choose: the drive word is not used`); drives = [null]; }
  // a hex head is turned by its own flats: the page does not ask its drive, so neither does Find (round 3)
  if (family === 'screw' && h === 'hex' && drives.some(Boolean)) { note('a hex head is turned by its own flats: the drive word is not used'); drives = [null]; }

  const lengths = c.alt !== null && c.alt !== undefined ? [c.length, c.alt] : [c.length];
  delete c.alt;
  const out = [];
  for (const L of lengths) {
    for (const d of drives) {
      const x = { ...c, length: L, drive: d, fields: { ...c.fields }, notes: [...c.notes], why: [...c.why] };
      if (open && open.driveWhy && !named.length && open.driveWhy[String(d)]) x.why.push(open.driveWhy[String(d)]);
      out.push(x);
    }
  }
  return out;
}

// the numbers of the size, read for one family -> { system, thread, pitch, tpi, length, fields, alt }
function sizeOf(family, shape, { metric, inch, bare }, f, ctx, note) {
  const s = { system: 'metric', thread: null, pitch: null, tpi: null, length: null, fields: {}, alt: null };
  const lone = [...f.numbers];
  const setLength = (v, why) => {
    if (v === null || v === undefined) return;
    if (shape.length) { s.length = v; if (why) note(why); } else if (shape.rodLength) s.fields['specific.rod.length'] = v;
    else note(`${an(NOUN[family])} has no length: ${v} is not used`);
  };
  const setPitch = (v) => { if (shape.pitch) s.pitch = v; else note(`${an(NOUN[family])} has no pitch to choose: ${v} is not used`); };
  if (metric) {
    const { d, nums } = metric;
    if (shape.thread) s.thread = d;
    else if (shape.pin) { s.fields['specific.pin.diameter'] = d; note(`a pin has no thread: M${d} is read as a ${d} mm pin`); }
    else if (shape.ring) { s.fields['specific.ring.size'] = d; note(`M${d} is read as the ring size, ${d} mm`); }
    if (nums.length === 1) {
      if (!metric.coded && isPitch(ctx, d, nums[0])) setPitch(nums[0]); else setLength(nums[0]);
    } else if (nums.length === 2) {
      const [a, b] = nums;
      if (isPitch(ctx, d, a)) { setPitch(a); setLength(b); }
      else if (isPitch(ctx, d, b)) { setLength(a); setPitch(b); note(`read as M${d}, pitch ${b}, length ${a}`); }
      else if (shape.pitch && a < d) { s.pitch = a; setLength(b); note(`${a} is not a listed pitch for M${d}: it is kept as typed (Custom)`); }
      else note(`${metric.raw}: read as M${d} only; ${a} and ${b} are not a pitch and a length`);
    }
    if (metric.alt !== null) s.alt = metric.alt;
  } else if (inch) {
    if (shape.units) {
      s.system = 'unified'; s.thread = inch.d;
      if (inch.tpi !== null) { if (family === 'washer') note('a washer has no threads per inch: the TPI is not used'); else s.tpi = inch.tpi; }
      setLength(inch.length);
    } else note(`the Picker records ${an(NOUN[family])} in metric sizes only: ${inch.raw} is not used`);
  }
  if (bare) {
    if (shape.shoulder) { s.fields['specific.shoulder.diameter'] = bare.a; setLength(bare.b); }
    else if (metric || inch) note(`${bare.raw} is not read`);
    else if (shape.pin) { s.fields['specific.pin.diameter'] = bare.a; setLength(bare.b); }
    else if (shape.thread) { s.thread = bare.a; setLength(bare.b); note(`${bare.raw} is read as M${bare.a} × ${bare.b}`); }
    else if (shape.ring) { s.fields['specific.ring.size'] = bare.a; note(`${bare.raw}: read as a ${bare.a} mm ring size`); }
  }
  // a ring's size and a pin's diameter can be a plain number (DIN 471 10, dowel pin 3)
  if (shape.ring && s.fields['specific.ring.size'] === undefined && lone.length) s.fields['specific.ring.size'] = lone.shift();
  if (shape.pin && s.fields['specific.pin.diameter'] === undefined && lone.length) s.fields['specific.pin.diameter'] = lone.shift();
  const noLength = () => s.length === null && s.fields['specific.rod.length'] === undefined;   // a rod's length is its own field
  // a length typed on its own (L20, 20mm): one per part, and a length in mm never lands on an inch part as inches (Sol
  // 01a14d03: "L20 L30" kept 20 and said nothing of 30)
  for (const L of f.lengths) {
    if (s.system === 'unified' && L.mm) note(`${L.v} mm is not read: an inch part's length is in inches`);
    else if (noLength()) setLength(L.v);
    else note(`${L.v}${L.mm ? ' mm' : ''} is not read: Find reads one length at a time`);
  }
  // "M3 20": a plain number after the size is read as its length, and said so
  if (noLength() && takesLength(family) && (metric || inch) && lone.length) { const v = lone.shift(); setLength(v, `${v} is read as the length`); }
  for (const v of lone) note(`${v} is not read`);
  return s;
}
