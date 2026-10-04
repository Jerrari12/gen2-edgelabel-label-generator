/* EdgeLabel generator <-> GEN2 Planner link: the pure rules (label-link.js), executed.
   Run:  node --test test/        (zero dependencies; the generator has no package.json)

   Test ids (G-parse, G-badge, G-style, G-send, G-adopt, G-unsaved, G-boot) are the ones STEP3-SPEC.md section 10.1 names.
   Every test calls the real module; none matches source text. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const L = require('../label-link.js');
require('../label-core.js');
const core = globalThis.GEN2EdgeLabelCore.create({ THREE: {} });
const ICONS = core.ICON_LIBRARY.map((i) => i.id);
const PROD = { servedFromLocalhost: false };
const LOCAL = { servedFromLocalhost: true };

/* ---- fixtures ---- */
const ID = (c) => c.repeat(12);
const style = (o = {}) => ({ capMm: 5, depth: 0.6, badgeSize: 14, bold: false, allCaps: true, predictIcons: true, ...o });
function mkJob(rows, o = {}) {
  return { v: 1, family: 'edgelabel', jobId: ID('j'), buildId: ID('b'), baseRev: ID('r'), origin: 'https://gen2planner.jerrari3d.com',
    textMax: 40, style: style(), rows: rows.map((r, i) => ({ u: i + 1, n: i + 1, g: [i, 0, 1, 2], t: '', b: null, ...r })), ...o };
}
const hashOf = (job, legacy) => '#' + (legacy ? 'labels=' + legacy + '&' : '') + 'job=' + L.encodeJob(job);
const snap = (o = {}) => ({ u: null, n: null, text: '', type: 'none', value: undefined, svg: false, manual: false, held: null, ...o });
const linkOf = (job, extra = {}) => ({ job, baseRev: job.baseRev, baseline: { rows: job.rows.map((r) => ({ u: r.u, t: r.t, b: r.b })), style: job.style }, pending: null, ...extra });

/* ---------------------------------------------------------------- G-parse */
test('G-parse-1: a well-formed job is accepted and returned verbatim', () => {
  const job = mkJob([{ t: 'M3 Nuts', b: { type: 'icon', value: 'nut' } }, { t: '' }]);
  const r = L.parseJob(hashOf(job), PROD);
  assert.equal(r.ok, true);
  assert.deepEqual(r.job, job);
});

test('G-parse-2: the raw value is bounded BEFORE it is decoded', () => {
  const r = L.parseJob('#job=' + 'A'.repeat(L.JOB_VALUE_MAX + 1), PROD);
  assert.deepEqual(r, { ok: false, reason: 'too-long' });
});

test('G-parse-3: bad base64url, an oversize decoded JSON, and non-JSON are each refused by name', () => {
  assert.equal(L.parseJob('#job=%%%not-base64', PROD).reason, 'bad-encoding');
  assert.equal(L.parseJob('#job=' + 'a=b', PROD).reason, 'bad-encoding');
  const big = L.encodeJob({ pad: 'x'.repeat(L.JOB_JSON_MAX + 10) });
  assert.ok(big.length < L.JOB_VALUE_MAX, 'fixture must reach the decoded-size check, not the raw-length one');
  assert.equal(L.parseJob('#job=' + big, PROD).reason, 'too-big');
  assert.equal(L.parseJob('#job=' + L.encodeJob([1, 2]), PROD).reason, 'bad-json');
  assert.equal(L.parseJob('#job=' + Buffer.from('not json').toString('base64url'), PROD).reason, 'bad-encoding');
});

test('G-parse-4: version, family and the three ids', () => {
  const ok = mkJob([{ t: 'a' }]);
  assert.equal(L.validateJob({ ...ok, v: 2 }, PROD).reason, 'bad-version');
  assert.equal(L.validateJob({ ...ok, family: 'classicpro' }, PROD).reason, 'wrong-family');
  for (const k of ['jobId', 'buildId', 'baseRev']) {
    for (const bad of ['short', 'UPPERCASE123', 'has space 1234', 'x'.repeat(33), 5, null]) {
      assert.equal(L.validateJob({ ...ok, [k]: bad }, PROD).reason, 'bad-id', `${k}=${JSON.stringify(bad)}`);
    }
  }
});

test('G-parse-5: the origin: production allows only the Planner; localhost is allowed ONLY when this page is served from localhost', () => {
  const ok = mkJob([{ t: 'a' }]);
  assert.equal(L.validateJob({ ...ok, origin: 'https://evil.example' }, PROD).reason, 'bad-origin');
  assert.equal(L.validateJob({ ...ok, origin: 'http://localhost:8701' }, PROD).reason, 'bad-origin');
  assert.equal(L.validateJob({ ...ok, origin: 'https://gen2planner.jerrari3d.com.evil.example' }, PROD).reason, 'bad-origin');
  assert.equal(L.validateJob({ ...ok, origin: 'http://localhost:8701' }, LOCAL).ok, true);
  assert.equal(L.validateJob({ ...ok, origin: 'http://127.0.0.1:9' }, LOCAL).ok, true);
  assert.equal(L.validateJob({ ...ok, origin: 'http://localhost:8701/' }, LOCAL).reason, 'bad-origin');
  assert.equal(L.validateJob({ ...ok, origin: 'https://evil.example' }, LOCAL).reason, 'bad-origin');
  assert.equal(L.validateJob({ ...ok, origin: undefined }, PROD).reason, 'bad-origin');
});

test('G-parse-6: textMax must be an integer 1..48', () => {
  const ok = mkJob([{ t: 'a' }]);
  for (const bad of [0, 49, 1.5, '40', null, -1]) assert.equal(L.validateJob({ ...ok, textMax: bad }, PROD).reason, 'bad-textmax', String(bad));
  for (const good of [1, 40, 48]) assert.equal(L.validateJob({ ...ok, textMax: good }, PROD).ok, true, String(good));
});

test('G-parse-7: style has exactly the six keys, numbers inside this page\'s own limits, flags boolean', () => {
  const ok = mkJob([{ t: 'a' }]);
  const bad = (st) => L.validateJob({ ...ok, style: st }, PROD).reason;
  const { bold, ...missing } = style();
  assert.equal(bad(missing), 'bad-style');
  assert.equal(bad({ ...style(), extra: 1 }), 'bad-style');
  assert.equal(bad(style({ capMm: 1.9 })), 'bad-style');
  assert.equal(bad(style({ capMm: 6.6 })), 'bad-style');
  assert.equal(bad(style({ depth: 0.1 })), 'bad-style');
  assert.equal(bad(style({ badgeSize: 23 })), 'bad-style');
  assert.equal(bad(style({ capMm: '5' })), 'bad-style');
  assert.equal(bad(style({ capMm: NaN })), 'bad-style');
  assert.equal(bad(style({ bold: 1 })), 'bad-style');
  assert.equal(bad(style({ allCaps: 'true' })), 'bad-style');
  assert.equal(bad('nope'), 'bad-style');
  assert.equal(L.validateJob({ ...ok, style: style({ capMm: 2, depth: 1.2, badgeSize: 22 }) }, PROD).ok, true, 'the limits themselves are inside');
});

test('G-parse-8: more than JOB_ROWS_MAX rows, a duplicate u, and a non-array are refused', () => {
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ u: i + 1, n: 1, g: [0, 0, 1, 1], t: '', b: null }));
  assert.equal(L.validateJob({ ...mkJob([]), rows: rows(L.JOB_ROWS_MAX + 1) }, PROD).reason, 'bad-rows');
  assert.equal(L.validateJob({ ...mkJob([]), rows: rows(L.JOB_ROWS_MAX) }, PROD).ok, true);
  assert.equal(L.validateJob({ ...mkJob([]), rows: 'x' }, PROD).reason, 'bad-rows');
  const dup = rows(2); dup[1].u = 1;
  assert.equal(L.validateJob({ ...mkJob([]), rows: dup }, PROD).reason, 'bad-row');
});

test('G-parse-9: per-row shapes: u, n, g, t', () => {
  const one = (r) => L.validateJob({ ...mkJob([]), rows: [{ u: 1, n: 1, g: [0, 0, 1, 1], t: 'ok', b: null, ...r }] }, PROD).reason;
  for (const u of [0, -1, 1.5, '1', 1e9 + 1, null]) assert.equal(one({ u }), 'bad-row', 'u=' + u);
  for (const n of [0, 401, 1.5, '1']) assert.equal(one({ n }), 'bad-row', 'n=' + n);
  for (const g of [[0, 0, 1], [0, 0, 1, 1, 1], [-1, 0, 1, 1], [0, 0, 101, 1], [0, 0, 1.5, 1], 'abcd', null]) assert.equal(one({ g }), 'bad-row', JSON.stringify(g));
  assert.equal(one({ t: 'x'.repeat(41) }), 'bad-row', 'longer than textMax');
  assert.equal(one({ t: 5 }), 'bad-row');
  assert.equal(one({ t: 'x'.repeat(40) }), undefined, 'exactly textMax is fine');
});

test('G-parse-10: per-row badges: only none / char (1-4) / icon (id-shaped, 40) or null', () => {
  const one = (b) => L.validateJob({ ...mkJob([]), rows: [{ u: 1, n: 1, g: [0, 0, 1, 1], t: 'x', b }] }, PROD).reason;
  assert.equal(one({ type: 'none' }), undefined);
  assert.equal(one({ type: 'char', value: 'M3' }), undefined);
  assert.equal(one({ type: 'icon', value: 'screw-hex-socket' }), undefined);
  assert.equal(one({ type: 'icon', value: 'not-an-icon' }), undefined, 'an id this page does not know is still a valid job; it is HELD');
  assert.equal(one({ type: 'char', value: '' }), 'bad-row');
  assert.equal(one({ type: 'char', value: 'ABCDE' }), 'bad-row');
  assert.equal(one({ type: 'char' }), 'bad-row');
  assert.equal(one({ type: 'icon', value: 'Not An Icon' }), 'bad-row');
  assert.equal(one({ type: 'icon', value: 'a'.repeat(41) }), 'bad-row');
  assert.equal(one({ type: 'icon' }), 'bad-row');
  assert.equal(one({ type: 'svg', value: 'x' }), 'bad-row');
  assert.equal(one({ type: 'unsupplied', why: 'custom' }), 'bad-row', 'a job never carries a sentinel');
  assert.equal(one('none'), 'bad-row');
});

test('G-parse-11: the WORST CASE the Planner can produce (288 rows x 40 CJK chars x 40-char icon ids) is ACCEPTED', () => {
  const t = '漢'.repeat(40);
  const icon = 'a'.repeat(19) + '-' + 'b'.repeat(20);
  assert.equal(icon.length, 40);
  const rows = Array.from({ length: 288 }, (_, i) => ({ u: i + 1, n: i + 1, g: [i % 12, i % 24, 1, 1], t, b: { type: 'icon', value: icon } }));
  const job = mkJob([], { rows });
  const json = JSON.stringify(job);
  assert.ok(Buffer.byteLength(json) < L.JOB_JSON_MAX);
  const hash = '#job=' + L.encodeJob(job);
  assert.ok(hash.length < L.JOB_URL_MAX);
  const r = L.parseJob(hash, PROD);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.job.rows.length, 288);
});

test('G-parse-12: the job param is found beside the legacy labels= and without one; unpadded base64url never contains `=` or `labels=`', () => {
  const job = mkJob([{ t: 'a' }]);
  const enc = L.encodeJob(job);
  assert.ok(!/[=+/]/.test(enc), 'unpadded base64url has none of + / =');
  assert.equal(L.parseJob('#labels=' + Buffer.from('["x"]').toString('base64') + '&job=' + enc, PROD).ok, true);
  assert.equal(L.parseJob('#job=' + enc, PROD).ok, true);
  assert.equal(L.parseJob('#job=' + enc + '&labels=W10', PROD).ok, true);
  assert.equal(L.parseJob('#labels=W10', PROD).reason, 'no-job');
  assert.equal(L.parseJob('', PROD).reason, 'no-job');
  assert.equal(L.hasJobParam('#x=1&job='), true);
});

test('G-parse-13: lone surrogates and tricky text survive the encoding', () => {
  const t = 'A &amp; B “<b>” &#34; ' + '\ud83d'.padEnd(1);   // a half surrogate pair at the end
  const job = mkJob([{ t: t.slice(0, 40) }]);
  const back = L.parseJob(hashOf(job), PROD);
  assert.equal(back.ok, true);
  assert.equal(back.job.rows[0].t, t.slice(0, 40));
});

/* ---------------------------------------------------------------- G-badge */
test('G-badge-1: the section 4.6 table, row by row', () => {
  const rep = (o) => L.badgeRep(snap({ text: 'M3', ...o }), ICONS);
  assert.equal(rep({}), null, 'not manual (predicted or empty) -> null');
  assert.equal(rep({ type: 'icon', value: 'nut', manual: false }), null, 'a predicted icon is "let the generator choose"');
  assert.deepEqual(rep({ type: 'none', manual: true }), { type: 'none' });
  assert.deepEqual(rep({ type: 'char', value: 'M3', manual: true }), { type: 'char', value: 'M3' });
  assert.deepEqual(rep({ type: 'icon', value: 'nut', manual: true }), { type: 'icon', value: 'nut' });
});

test('G-badge-2: a custom upload is unsupplied/custom, and an icon-only label is unsupplied/icon-only', () => {
  assert.deepEqual(L.badgeRep(snap({ text: 'M3', type: 'icon', svg: true, manual: true }), ICONS), { type: 'unsupplied', why: 'custom' });
  assert.deepEqual(L.badgeRep(snap({ text: '', type: 'char', value: 'A', manual: true }), ICONS), { type: 'unsupplied', why: 'icon-only' });
  assert.deepEqual(L.badgeRep(snap({ text: '   ', type: 'icon', value: 'nut', manual: true }), ICONS), { type: 'unsupplied', why: 'icon-only' });
  assert.equal(L.badgeRep(snap({ text: '', type: 'none', manual: true }), ICONS), null, 'empty words with no real badge is just "nothing" (no spurious change)');
  assert.equal(L.badgeRep(snap({ text: '', type: 'icon', value: 'nut', manual: false }), ICONS), null, 'an auto icon on an empty row is nothing');
});

test('G-badge-3: a HELD badge (one this page cannot show) returns BYTE-FOR-BYTE, never as null (Auto)', () => {
  const job = mkJob([{ t: 'Weird', b: { type: 'icon', value: 'not-an-icon' } }, { t: 'M3', b: { type: 'icon', value: 'nut' } }]);
  const rows = L.jobToRows(job, ICONS);
  assert.deepEqual(rows[0].held, { type: 'icon', value: 'not-an-icon' });
  assert.equal(rows[0].manual, true, 'held rows count as manual so prediction never replaces them');
  assert.equal(rows[1].held, null);
  const rep = L.badgeRep(rows[0], ICONS);
  assert.equal(L.canon(rep), L.canon({ type: 'icon', value: 'not-an-icon' }));
  assert.notEqual(rep, null, 'mutant: converting a held badge to Auto');
  assert.equal(L.canon(L.badgeRep(rows[1], ICONS)), L.canon({ type: 'icon', value: 'nut' }));
});

test('G-badge-4: jobToRows for every b kind', () => {
  const rows = L.jobToRows(mkJob([{ t: 'a', b: null }, { t: 'b', b: { type: 'none' } }, { t: 'c', b: { type: 'char', value: 'Q' } }, { t: 'd', b: { type: 'icon', value: 'nut' } }]), ICONS);
  assert.deepEqual(rows.map((r) => [r.manual, r.type, r.value, r.held]), [[false, 'none', undefined, null], [true, 'none', undefined, null], [true, 'char', 'Q', null], [true, 'icon', 'nut', null]]);
});

test('G-badge-5: a held badge with no words left is an icon-only row (the words were cleared)', () => {
  const rep = L.badgeRep(snap({ text: '', type: 'none', manual: true, held: { type: 'icon', value: 'zzz' } }), ICONS);
  assert.deepEqual(rep, { type: 'unsupplied', why: 'icon-only' });
});

test('G-badge-6: an icon id outside the library, with no hold, is returned as it is', () => {
  assert.deepEqual(L.badgeRep(snap({ text: 'x', type: 'icon', value: 'from-older-set', manual: true }), ICONS), { type: 'icon', value: 'from-older-set' });
});

/* ---------------------------------------------------------------- G-style */
test('G-style-1: inputsFromStyle / styleFromInputs round-trip defaults, extremes and floats', () => {
  for (const st of [style(), style({ capMm: 2, depth: 0.2, badgeSize: 4, bold: true, allCaps: false, predictIcons: false }), style({ capMm: 4.5, depth: 0.6, badgeSize: 22 }), style({ capMm: 6.5, depth: 1.2, badgeSize: 13.5 })]) {
    const els = {};
    const el = (id) => (els[id] = els[id] || { value: '', checked: false });
    L.inputsFromStyle(st, el);
    assert.deepEqual(L.styleFromInputs(el), st);
  }
});

test('G-style-2: an unparseable number input comes back as NaN (out of range) rather than a made-up value; `only` limits which fields are written', () => {
  const els = {};
  const el = (id) => (els[id] = els[id] || { value: '', checked: false });
  assert.ok(Number.isNaN(L.styleFromInputs((id) => (id === 'font-size' ? { value: 'abc' } : { value: '1', checked: true })).capMm));
  L.inputsFromStyle(style({ capMm: 3, bold: true }), el, ['capMm']);
  assert.equal(els['font-size'].value, '3');
  assert.equal(els['bold-text'], undefined, 'bold was not asked for');
});

test('G-style-3: STYLE_DEFAULTS = label-core.js DEFAULTS = the six inputs\' own value/checked/min/max in index.html', () => {
  for (const k of L.STYLE_KEYS) assert.equal(L.STYLE_DEFAULTS[k], core.DEFAULTS[k], k + ' vs label-core DEFAULTS');
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const input = (id) => { const m = html.match(new RegExp('<input[^>]*\\bid="' + id + '"[^>]*>')); assert.ok(m, id); return m[0]; };
  for (const k of L.STYLE_KEYS) {
    const tag = input(L.STYLE_INPUT[k]);
    if (L.STYLE_FLAGS.includes(k)) assert.equal(/\bchecked\b/.test(tag), L.STYLE_DEFAULTS[k], k + ' checked');
    else {
      assert.equal(Number(tag.match(/\bvalue="([^"]+)"/)[1]), L.STYLE_DEFAULTS[k], k + ' value');
      assert.equal(Number(tag.match(/\bmin="([^"]+)"/)[1]), L.STYLE_LIMITS[k][0], k + ' min');
      assert.equal(Number(tag.match(/\bmax="([^"]+)"/)[1]), L.STYLE_LIMITS[k][1], k + ' max');
    }
  }
  assert.equal(Number(html.match(/<input[^>]*id="font-size"[^>]*>/)[0].match(/step="([^"]+)"/)[1]) > 0, true);
});

/* ---------------------------------------------------------------- G-send */
const sentLink = (job, rows, o = {}) => linkOf(job, o);

test('G-send-1: buildReturn lists every linked row in list order and counts only extras that HAVE content', () => {
  const job = mkJob([{ t: 'One' }, { t: 'Two' }]);
  const snaps = [snap({ u: 2, text: 'Two!' }), snap({ u: 1, text: 'One' }), snap({ text: 'extra' }), snap({ text: '  ' }), snap({ type: 'char', value: 'Z', manual: true })];
  const { msg, reused } = L.buildReturn(linkOf(job), snaps, style(), { newId: () => ID('n') });
  assert.equal(reused, false);
  assert.deepEqual(msg.rows.map((r) => [r.u, r.t, r.b]), [[2, 'Two!', null], [1, 'One', null]]);
  assert.equal(msg.extras, 2, 'a blank untagged row is not an extra label');
  assert.deepEqual([msg.gen2label, msg.v, msg.family, msg.jobId, msg.buildId, msg.baseRev, msg.returnId], ['return', 1, 'edgelabel', job.jobId, job.buildId, job.baseRev, ID('n')]);
});

test('G-send-2: an identical Send re-uses the returnId; a Send after any edit mints a new one', () => {
  const job = mkJob([{ t: 'One' }]);
  const snaps = [snap({ u: 1, text: 'One!' })];
  let n = 0;
  const mint = () => 'id' + String(++n).padStart(10, '0');
  const first = L.buildReturn(linkOf(job), snaps, style(), { newId: mint });
  const pending = { returnId: first.msg.returnId, payload: first.msg, state: 'sending' };
  const again = L.buildReturn(linkOf(job, { pending }), snaps, style(), { newId: mint });
  assert.equal(again.reused, true);
  assert.equal(again.msg.returnId, first.msg.returnId, 'mutant: a retry minting a new returnId');
  for (const [name, snaps2, st] of [
    ['text', [snap({ u: 1, text: 'One!!' })], style()],
    ['badge', [snap({ u: 1, text: 'One!', type: 'char', value: 'A', manual: true })], style()],
    ['style', snaps, style({ capMm: 4.5 })],
    ['extras', [...snaps, snap({ text: 'x' })], style()],
  ]) {
    const next = L.buildReturn(linkOf(job, { pending }), snaps2, st, { newId: mint });
    assert.equal(next.reused, false, name);
    assert.notEqual(next.msg.returnId, first.msg.returnId, name);
  }
  const abandoned = L.buildReturn(linkOf(job, { pending: { ...pending, state: 'abandoned' } }), snaps, style(), { newId: mint });
  assert.equal(abandoned.reused, true, 'the Planner may still hold that return: re-use its id here too');
});

test('G-send-3: sending -> received -> reviewing; the only timed answer is `received`', () => {
  const job = mkJob([{ t: 'One' }]);
  const pending = { returnId: ID('p'), payload: {}, state: 'sending' };
  const e = L.onAnswer(linkOf(job, { pending }), { gen2label: 'received', v: 1, jobId: job.jobId, returnId: ID('p') }, null);
  assert.deepEqual(e, { effect: 'received', pendingState: 'reviewing' });
  const noMore = L.onAnswer(linkOf(job, { pending: { ...pending, state: 'reviewing' } }), { gen2label: 'received', v: 1, jobId: job.jobId, returnId: ID('p') }, null);
  assert.equal(noMore.effect, 'ignore');
});

test('G-send-4: abandoned + a late `applied`: adopted if nothing changed since the send, status-only if the user edited', () => {
  const job = mkJob([{ t: 'One' }]);
  const snaps = [snap({ u: 1, text: 'One!' })];
  const sent = L.buildReturn(linkOf(job), snaps, style(), { newId: () => ID('p') }).msg;
  const link = linkOf(job, { pending: { returnId: ID('p'), payload: sent, state: 'abandoned' } });
  const ans = { gen2label: 'applied', v: 1, jobId: job.jobId, returnId: ID('p'), baseRev: ID('q'), rows: [], gone: [], style: style(), styleDecision: {} };
  const same = L.returnCore(snaps, style(), link.baseRev, ICONS);
  assert.equal(L.onAnswer(link, ans, same).effect, 'adopt');
  const edited = L.returnCore([snap({ u: 1, text: 'One!!' })], style(), link.baseRev, ICONS);
  assert.equal(L.onAnswer(link, ans, edited).effect, 'late-status');
  assert.equal(link.baseRev, job.baseRev, 'late-status leaves baseRev for the caller to keep, so the next return is a baseline mismatch');
});

test('G-send-5: `applied` / `cancelled` arriving while still `sending` (its `received` was lost) are handled as from `reviewing`', () => {
  const job = mkJob([{ t: 'One' }]);
  for (const state of ['sending', 'reviewing']) {
    const link = linkOf(job, { pending: { returnId: ID('p'), payload: {}, state } });
    assert.equal(L.onAnswer(link, { gen2label: 'applied', v: 1, jobId: job.jobId, returnId: ID('p') }, null).effect, 'adopt', state);
    assert.equal(L.onAnswer(link, { gen2label: 'cancelled', v: 1, jobId: job.jobId, returnId: ID('p') }, null).effect, 'cancelled', state);
    const refused = L.onAnswer(link, { gen2label: 'refused', v: 1, jobId: job.jobId, returnId: ID('p'), reason: 'other-build' }, null);
    assert.deepEqual([refused.effect, refused.reason, refused.linkState], ['refused', 'other-build', 'other-build'], state);
  }
});

test('G-send-6: an answer for another returnId, another job, or a `superseded` is ignored', () => {
  const job = mkJob([{ t: 'One' }]);
  const link = linkOf(job, { pending: { returnId: ID('p'), payload: {}, state: 'reviewing' } });
  for (const a of [
    { gen2label: 'applied', v: 1, jobId: job.jobId, returnId: ID('z') },
    { gen2label: 'applied', v: 1, jobId: ID('k'), returnId: ID('p') },
    { gen2label: 'cancelled', v: 1, jobId: job.jobId, returnId: ID('z') },
    { gen2label: 'superseded', v: 1, jobId: job.jobId, returnId: ID('p'), by: ID('y') },
    { gen2label: 'refused', v: 1, jobId: job.jobId, returnId: ID('z'), reason: 'malformed' },
  ]) assert.equal(L.onAnswer(link, a, null).effect, 'ignore', JSON.stringify(a));
  assert.equal(L.onAnswer({ ...link, pending: null }, { gen2label: 'applied', v: 1, jobId: job.jobId, returnId: ID('p') }, null).effect, 'ignore');
  assert.equal(L.onAnswer(link, { gen2label: 'refused', v: 1, jobId: job.jobId, reason: 'other-build' }, null).effect, 'other-build', 'a hello refusal names no returnId');
});

test('G-send-7: parseAnswer accepts the Planner\'s answers and refuses malformed ones', () => {
  const job = mkJob([{ t: 'a' }]);
  const ok = { gen2label: 'applied', v: 1, jobId: job.jobId, returnId: ID('p'), baseRev: ID('q'), rows: [{ u: 1, t: 'a', b: null, decision: 'applied' }], gone: [], style: style(), styleDecision: {}, changes: 1 };
  assert.ok(L.parseAnswer(ok));
  assert.ok(L.parseAnswer({ gen2label: 'ack', v: 1, jobId: job.jobId, baseRev: ID('q'), drawers: 3, review: 'normal' }));
  assert.ok(L.parseAnswer({ gen2label: 'received', v: 1, jobId: job.jobId, returnId: ID('p') }));
  for (const bad of [null, 'x', {}, { ...ok, v: 2 }, { ...ok, gen2label: 'nonsense' }, { ...ok, jobId: 'short' }, { ...ok, rows: 'x' }, { ...ok, rows: [{ u: 0, t: 'a', b: null, decision: 'applied' }] },
    { ...ok, gone: ['x'] }, { ...ok, style: { capMm: 'x' } }, { gen2label: 'received', v: 1, jobId: job.jobId },
    { gen2label: 'ack', v: 1, jobId: job.jobId, baseRev: ID('q'), drawers: 3, review: 'weird' }, { gen2label: 'refused', v: 1, jobId: job.jobId }])
    assert.equal(L.parseAnswer(bad), null, JSON.stringify(bad).slice(0, 80));
});

/* ---------------------------------------------------------------- G-adopt */
const applied = (rows, o = {}) => ({ gen2label: 'applied', v: 1, jobId: ID('j'), returnId: ID('p'), baseRev: ID('q'), rows, gone: [], style: style(), styleDecision: {}, ...o });

test('G-adopt-1: applied / kept-planner / unchanged set the text and the badge from the result', () => {
  const job = mkJob([{ t: 'One' }, { t: 'Two' }, { t: 'Three' }]);
  const snaps = [snap({ u: 1, text: 'One!' }), snap({ u: 2, text: 'Two', type: 'char', value: 'A', manual: true }), snap({ u: 3, text: 'Three' })];
  const out = L.adoptApplied(linkOf(job), snaps, applied([
    { u: 1, t: 'One!', b: { type: 'char', value: 'Z' }, decision: 'applied' },
    { u: 2, t: 'Two', b: null, decision: 'kept-planner' },
    { u: 3, t: 'Three', b: { type: 'none' }, decision: 'unchanged' }]), ICONS);
  assert.deepEqual(out.actions.map((a) => [a.kind, a.text, a.badge]), [
    ['set', 'One!', { mode: 'manual', type: 'char', value: 'Z' }],
    ['set', 'Two', { mode: 'auto' }],
    ['set', 'Three', { mode: 'manual', type: 'none' }]]);
  assert.equal(out.baseRev, ID('q'));
  assert.deepEqual(out.baseline.rows, [{ u: 1, t: 'One!', b: { type: 'char', value: 'Z' } }, { u: 2, t: 'Two', b: null }, { u: 3, t: 'Three', b: { type: 'none' } }]);
});

test('G-adopt-2: a `not-applied` row keeps what is on screen; mutant: adopting it anyway', () => {
  const job = mkJob([{ t: 'One' }]);
  const out = L.adoptApplied(linkOf(job), [snap({ u: 1, text: 'One!' })], applied([{ u: 1, t: 'One', b: null, decision: 'not-applied' }]), ICONS);
  assert.equal(out.actions[0].text, undefined);
  assert.equal(out.actions[0].badge, undefined);
  assert.deepEqual(out.baseline.rows, [{ u: 1, t: 'One', b: null }], 'the baseline is what the planner holds, so the unticked edit stays unsaved');
});

test('G-adopt-3: per-field decisions: words applied + icon left unticked keep the icon the user chose', () => {
  const job = mkJob([{ t: 'One' }]);
  const snaps = [snap({ u: 1, text: 'One!', type: 'char', value: 'Q', manual: true })];
  const out = L.adoptApplied(linkOf(job), snaps, applied([{ u: 1, t: 'One!', b: null, decision: 'applied', tDecision: 'applied', bDecision: 'not-applied' }]), ICONS);
  assert.equal(out.actions[0].text, 'One!');
  assert.equal(out.actions[0].badge, undefined);
});

test('G-adopt-4: a row whose badge is unsupplied (custom upload or icon-only) keeps its local badge', () => {
  const job = mkJob([{ t: 'One' }, { t: '' }]);
  const snaps = [snap({ u: 1, text: 'One', type: 'icon', svg: true, manual: true }), snap({ u: 2, text: '', type: 'char', value: 'A', manual: true })];
  const out = L.adoptApplied(linkOf(job), snaps, applied([{ u: 1, t: 'One', b: null, decision: 'applied' }, { u: 2, t: '', b: null, decision: 'unchanged' }]), ICONS);
  assert.equal(out.actions[0].badge, undefined, 'custom icon kept');
  assert.equal(out.actions[1].badge, undefined, 'icon-only kept');
  assert.equal(out.actions[0].text, 'One');
});

test('G-adopt-5: `gone` rows detach (become extras); an unknown result icon is HELD; style fields not-applied are skipped', () => {
  const job = mkJob([{ t: 'One' }, { t: 'Two' }]);
  const snaps = [snap({ u: 1, text: 'One' }), snap({ u: 2, text: 'Two' }), snap({ text: 'extra' })];
  const out = L.adoptApplied(linkOf(job), snaps, applied([{ u: 1, t: 'One', b: { type: 'icon', value: 'not-an-icon' }, decision: 'unchanged' }],
    { gone: [2], style: style({ capMm: 4.5, depth: 0.8 }), styleDecision: { capMm: 'applied', depth: 'not-applied' } }), ICONS);
  assert.deepEqual(out.actions.map((a) => a.kind), ['set', 'detach', 'keep']);
  assert.deepEqual(out.actions[0].badge, { mode: 'held', b: { type: 'icon', value: 'not-an-icon' } });
  assert.deepEqual(out.styleSet, { capMm: 4.5, bold: false, allCaps: true, predictIcons: true, badgeSize: 14 }, 'depth is not-applied');
  assert.deepEqual(out.gone, [2]);
});

/* ---------------------------------------------------------------- G-unsaved */
test('G-unsaved-1: a changed linked row (words or badge) is unsaved; an unsupplied badge counts as equal', () => {
  const job = mkJob([{ t: 'One', b: { type: 'char', value: 'A' } }, { t: 'Two' }]);
  const base = [snap({ u: 1, text: 'One', type: 'char', value: 'A', manual: true }), snap({ u: 2, text: 'Two' })];
  assert.equal(L.isUnsaved(linkOf(job), base, style(), { iconIds: ICONS }).any, false);
  assert.equal(L.isUnsaved(linkOf(job), [{ ...base[0], text: 'One!' }, base[1]], style(), { iconIds: ICONS }).rows, true);
  assert.equal(L.isUnsaved(linkOf(job), [{ ...base[0], value: 'B' }, base[1]], style(), { iconIds: ICONS }).rows, true);
  assert.equal(L.isUnsaved(linkOf(job), [{ ...base[0], svg: true, type: 'icon', value: undefined }, base[1]], style(), { iconIds: ICONS }).rows, false, 'a custom upload is the generator\'s own');
  assert.equal(L.isUnsaved(linkOf(job), [base[0], { ...base[1], text: ' Two ' }], style(), { iconIds: ICONS }).rows, false, 'whitespace is not a change: the Planner trims');
});
test('G-unsaved-1b: an icon-only label or a custom upload exists ONLY in this tab, so a replacement job must not discard it silently', () => {
  const job = mkJob([{ t: 'One' }, { t: '' }]);
  const base = [snap({ u: 1, text: 'One' }), snap({ u: 2, text: '' })];
  assert.equal(L.isUnsaved(linkOf(job), base, style(), { iconIds: ICONS }).localOnly, 0);
  const iconOnly = [base[0], snap({ u: 2, text: '', type: 'char', value: 'Z', manual: true })];
  const u = L.isUnsaved(linkOf(job), iconOnly, style(), { iconIds: ICONS });
  assert.equal(u.localOnly, 1, 'the icon-only label is counted');
  assert.equal(u.rows, false, 'it is still not a row the Planner could be sent');
  assert.equal(u.any, true, 'but it is local work: the tab must warn and a replacement must ask');
  const custom = [snap({ u: 1, text: 'One', svg: true, type: 'icon', value: undefined, manual: true }), base[1]];
  assert.equal(L.isUnsaved(linkOf(job), custom, style(), { iconIds: ICONS }).localOnly, 1, 'a custom upload too');
});

test('G-unsaved-2: extras alone are unsaved (counted); blank extras are not; style changes are', () => {
  const job = mkJob([{ t: 'One' }]);
  const base = [snap({ u: 1, text: 'One' })];
  const u = L.isUnsaved(linkOf(job), [...base, snap({ text: 'mine' }), snap({ text: 'mine too' }), snap({})], style(), { iconIds: ICONS });
  assert.deepEqual([u.rows, u.extras, u.pending, u.any], [false, 2, false, true]);
  assert.equal(L.isUnsaved(linkOf(job), [...base, snap({})], style(), { iconIds: ICONS }).any, false);
  assert.equal(L.isUnsaved(linkOf(job), base, style({ bold: true }), { iconIds: ICONS }).style, true);
});

test('G-unsaved-3: a pending return that has not been answered is unsaved; an abandoned one is not', () => {
  const job = mkJob([{ t: 'One' }]);
  const base = [snap({ u: 1, text: 'One' })];
  for (const [state, want] of [['sending', true], ['reviewing', true], ['abandoned', false]])
    assert.equal(L.isUnsaved(linkOf(job, { pending: { returnId: ID('p'), payload: {}, state } }), base, style(), { iconIds: ICONS }).pending, want, state);
});

/* ---------------------------------------------------------------- G-boot */
const proj = (labels, settings = {}) => ({ fmt: 'edgelabel-set', v: 1, labels, settings: { 'font-size': '5', 'text-depth': '0.6', 'badge-size': '14', 'bold-text': false, 'all-caps': true, 'predict-icons': true, ...settings } });
function sessionOf(job, labels, o = {}) {
  return { v: 1, job, baseRev: job.baseRev, baseline: { rows: job.rows.map((r) => ({ u: r.u, t: r.t, b: r.b })), style: job.style }, project: proj(labels), pending: null, paused: false, savedAt: 1, ...o };
}
const lab = (text, o = {}) => ({ text, badge: { type: 'none' }, manual: false, ...o });

test('G-boot-1: a hash with a job -> a linked import', () => {
  const job = mkJob([{ t: 'a' }]);
  const plan = L.planBoot({ hash: hashOf(job, Buffer.from('["a"]').toString('base64')), session: null, ...PROD, iconIds: ICONS });
  assert.equal(plan.action, 'linked-import');
  assert.equal(plan.job.jobId, job.jobId);
  assert.equal(plan.backup, null);
});

test('G-boot-2: no hash and a linked session -> restore the LINKED session, before the ordinary autosave', () => {
  const job = mkJob([{ t: 'a' }]);
  const session = sessionOf(job, [lab('a', { u: 1, n: 1 })]);
  const plan = L.planBoot({ hash: '', session, ...PROD, iconIds: ICONS });
  assert.equal(plan.action, 'linked-restore', 'mutant: restoring the autosave first');
  assert.equal(plan.session, session);
});

test('G-boot-3: a legacy-only hash into a linked tab -> a one-way import that PAUSES the link', () => {
  const job = mkJob([{ t: 'a' }]);
  const session = sessionOf(job, [lab('a', { u: 1, n: 1 })]);
  const plan = L.planBoot({ hash: '#labels=' + Buffer.from('["x","y"]').toString('base64'), session, ...PROD, iconIds: ICONS });
  assert.equal(plan.action, 'legacy-import');
  assert.deepEqual(plan.labels, ['x', 'y']);
  assert.equal(plan.pause, session);
  const noSession = L.planBoot({ hash: '#labels=' + Buffer.from('["x"]').toString('base64'), session: null, ...PROD, iconIds: ICONS });
  assert.deepEqual([noSession.action, noSession.pause], ['legacy-import', null]);
});

test('G-boot-4: a paused session is not restored on reload (the ordinary autosave is), and is reported so the Resume button can show', () => {
  const job = mkJob([{ t: 'a' }]);
  const session = sessionOf(job, [lab('a', { u: 1, n: 1 })], { paused: true });
  const plan = L.planBoot({ hash: '', session, ...PROD, iconIds: ICONS });
  assert.equal(plan.action, 'autosave');
  assert.equal(plan.pausedSession, session);
  assert.equal(L.planBoot({ hash: '', session: null, ...PROD, iconIds: ICONS }).action, 'autosave');
});

test('G-boot-5: a NEW job into a tab with unsaved linked work -> import the job and BACK UP the old linked session; an unedited one is not backed up', () => {
  const oldJob = mkJob([{ t: 'a' }], { jobId: ID('o') });
  const newJob = mkJob([{ t: 'a' }], { jobId: ID('n') });
  const edited = sessionOf(oldJob, [lab('a CHANGED', { u: 1, n: 1 })]);
  const p1 = L.planBoot({ hash: hashOf(newJob), session: edited, ...PROD, iconIds: ICONS });
  assert.equal(p1.action, 'linked-import');
  assert.equal(p1.backup, edited);
  const clean = sessionOf(oldJob, [lab('a', { u: 1, n: 1 })]);
  assert.equal(L.planBoot({ hash: hashOf(newJob), session: clean, ...PROD, iconIds: ICONS }).backup, null);
  const extras = sessionOf(oldJob, [lab('a', { u: 1, n: 1 }), lab('mine')]);
  assert.equal(L.planBoot({ hash: hashOf(newJob), session: extras, ...PROD, iconIds: ICONS }).backup, extras, 'extras are unsaved work too');
  const styled = sessionOf(oldJob, [lab('a', { u: 1, n: 1 })]);
  styled.project.settings['bold-text'] = true;
  assert.equal(L.planBoot({ hash: hashOf(newJob), session: styled, ...PROD, iconIds: ICONS }).backup, styled, 'a changed style is unsaved work too');
});

test('G-boot-6: a job that fails to parse falls through to the legacy labels (one-way) with the reason; never half-linked', () => {
  const bad = '#labels=' + Buffer.from('["x"]').toString('base64') + '&job=' + L.encodeJob({ nope: 1 }).slice(0, 20);
  const plan = L.planBoot({ hash: bad, session: null, ...PROD, iconIds: ICONS });
  assert.equal(plan.action, 'legacy-import');
  assert.ok(plan.jobError, 'the reason travels so the status can say it');
  const onlyBad = L.planBoot({ hash: '#job=%%%', session: null, ...PROD, iconIds: ICONS });
  assert.equal(onlyBad.action, 'autosave');
  assert.equal(onlyBad.jobError, 'bad-encoding');
});

test('G-boot-7: an explicit incoming job wins over a restorable linked session (mutant: restore first)', () => {
  const oldJob = mkJob([{ t: 'a' }], { jobId: ID('o') });
  const newJob = mkJob([{ t: 'b' }], { jobId: ID('n') });
  const plan = L.planBoot({ hash: hashOf(newJob), session: sessionOf(oldJob, [lab('a', { u: 1, n: 1 })]), ...PROD, iconIds: ICONS });
  assert.equal(plan.action, 'linked-import');
  assert.equal(plan.job.jobId, ID('n'));
});

test('G-session-1: parseSession accepts what the page wrote and refuses anything damaged', () => {
  const job = mkJob([{ t: 'a' }]);
  const s = sessionOf(job, [lab('a', { u: 1, n: 1 })], { pending: { returnId: ID('p'), payload: { x: 1 }, state: 'sending' } });
  assert.ok(L.parseSession(JSON.stringify(s), PROD));
  assert.equal(L.parseSession('{not json', PROD), null);
  assert.equal(L.parseSession(JSON.stringify({ ...s, v: 2 }), PROD), null);
  assert.equal(L.parseSession(JSON.stringify({ ...s, job: { ...job, origin: 'https://evil.example' } }), PROD), null, 'the stored job is re-validated');
  assert.equal(L.parseSession(JSON.stringify({ ...s, pending: { ...s.pending, state: 'weird' } }), PROD), null);
  assert.equal(L.parseSession(JSON.stringify({ ...s, project: { labels: 'x' } }), PROD), null);
  assert.equal(L.parseSession(JSON.stringify({ ...s, baseRev: 'x' }), PROD), null);
});

test('G-session-2: snapsFromProject rebuilds the row snapshots incl. tags, held badges and extras', () => {
  const snaps = L.snapsFromProject(proj([
    lab('a', { u: 1, n: 1 }), lab('Weird', { u: 2, n: 2, badge: { type: 'icon', value: 'zzz' }, manual: true, held: true }), lab('mine'),
    lab('x', { u: 3, n: 3, badge: { type: 'icon', svg: '<svg/>' }, manual: true })]));
  assert.deepEqual(snaps.map((s) => [s.u, s.held && s.held.value, s.svg]), [[1, null, false], [2, 'zzz', false], [null, null, false], [3, null, true]]);
});
