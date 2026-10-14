/* The Label plate inside the planner (plate-link.js, step B1): the hello and its binding, the snapshot's checks, the row plan,
   and the messages back. Run: node --test test/plate-link.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const P = require('../plate-link.js');
const LINK = require('../label-link.js');
const LL = (() => { const mod = { exports: {} }; new Function('module', 'window', readFileSync(new URL('../label-list.js', import.meta.url), 'utf8'))(mod, undefined); return mod.exports; })();
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');   // a checkout with CRLF on disk reads the same

const PARENT = { name: 'the planner window' }, OTHER = { name: 'another window' };
const PLANNER = 'https://planner.modulith.systems';
const win = (origin, parent = PARENT) => ({ parent, location: { origin, search: '?embed=planner' } });
const SESSION = 'sessionabcdef123';
const hello = (o = {}) => ({ gen2plate: 'hello', v: 1, session: SESSION, ...o });
const ev = (data, o = {}) => ({ data, source: PARENT, origin: PLANNER, ...o });
const ID = (c) => c.repeat(12);
const label = (text, o = {}) => ({ id: ID(text[0].toLowerCase()), text, ...o });
const doc = (labels, style) => ({ format: LL.FORMAT, version: LL.VERSION, labels, ...(style ? { style } : {}) });
const snap = (o = {}) => ({ gen2plate: 'snapshot', v: 1, session: SESSION, buildId: ID('b'), rev: 3, type: 'edgelabel', doc: doc([label('Screws'), label('Nuts')]), drawers: { [ID('s')]: [1, 3] }, selected: ID('n'), ...o });

test('the planner origins are the ones label-link.js names, and never a Pages origin', () => {
  assert.deepEqual([...P.PLANNER_ORIGINS], [...LINK.PLANNER_ORIGINS]);
  assert.ok(!P.PLANNER_ORIGINS.some((o) => /github\.io/.test(o)));
});

test('asked for: ?embed=planner inside a frame; the hello binds the parent at a listed origin, loopback only on loopback', () => {
  assert.ok(P.plannerAsked(win('https://labels.modulith.systems')));
  assert.equal(P.plannerAsked({ parent: null, location: { search: '?embed=planner' } }), false, 'no parent');
  const top = { location: { search: '?embed=planner' } }; top.parent = top;
  assert.equal(P.plannerAsked(top), false, 'the top window');
  assert.equal(P.plannerAsked({ parent: PARENT, location: { search: '?embed=1' } }), false, 'the Studio\'s own sheet embed');
  const prod = win('https://labels.modulith.systems');
  assert.deepEqual(P.readHello(ev(hello()), prod), { origin: PLANNER, session: SESSION });
  assert.equal(P.readHello(ev(hello(), { origin: 'https://jerrari12.github.io' }), prod), null, 'a Pages origin');
  assert.equal(P.readHello(ev(hello(), { origin: 'http://127.0.0.1:8743' }), prod), null, 'loopback while served from the site');
  assert.deepEqual(P.readHello(ev(hello(), { origin: 'http://127.0.0.1:8743' }), win('http://127.0.0.1:8744')), { origin: 'http://127.0.0.1:8743', session: SESSION }, 'loopback while served from loopback');
  assert.equal(P.readHello(ev(hello(), { source: OTHER }), prod), null, 'not the parent');
  assert.equal(P.readHello(ev(hello({ v: 2 })), prod), null);
  assert.equal(P.readHello(ev(hello({ session: 'short' })), prod), null);
  assert.equal(P.readHello(ev({ gen2parts: 'hello', v: 1, session: SESSION }), prod), null, 'the Picker\'s key is another channel');
});

test('after the hello only the bound window at the bound origin with the bound session is heard', () => {
  const w = win('https://labels.modulith.systems');
  const bind = P.readHello(ev(hello()), w);
  const body = snap();
  assert.equal(P.fromPlanner(ev(body), w, bind), body);
  assert.equal(P.fromPlanner(ev(body, { source: OTHER }), w, bind), null, 'another window with the right session');
  assert.equal(P.fromPlanner(ev(body, { origin: 'https://gen2planner.jerrari3d.com' }), w, bind), null, 'another listed origin is not the bound one');
  assert.equal(P.fromPlanner(ev({ ...body, session: 'anothersession12' }), w, bind), null);
  assert.equal(P.fromPlanner(ev(body), w, null), null, 'nothing before the hello');
  assert.deepEqual(P.readyMessage(bind), { gen2plate: 'ready', v: 1, session: SESSION, caps: ['snapshot/1', 'select/1'] });
});

test('a snapshot is checked: ids, the rev, the type, the document through label-list.js, the drawers, the selection', () => {
  const r = P.readSnapshot(snap(), LL);
  assert.ok(r.ok, r.reason);
  assert.equal(r.snap.buildId, ID('b')); assert.equal(r.snap.rev, 3); assert.equal(r.snap.type, 'edgelabel');
  assert.deepEqual(r.snap.labels.map((l) => l.text), ['Screws', 'Nuts']);
  assert.deepEqual(r.snap.drawers, { [ID('s')]: [1, 3] });
  assert.equal(r.snap.selected, ID('n'));
  assert.equal(r.snap.reason, null);
  assert.equal(P.readSnapshot(snap({ buildId: 'BAD' }), LL).reason, 'bad-build');
  assert.equal(P.readSnapshot(snap({ rev: -1 }), LL).reason, 'bad-rev');
  assert.equal(P.readSnapshot(snap({ rev: '3' }), LL).reason, 'bad-rev');
  assert.equal(P.readSnapshot(snap({ type: 'paper' }), LL).snap.type, null, 'an unknown type is none');
  assert.equal(P.readSnapshot(snap({ doc: { labels: 'x' } }), LL).reason, 'bad-doc');
  assert.equal(P.readSnapshot(snap({ doc: doc(Array.from({ length: 401 }, (_, i) => label('L' + i, { id: ('l' + i).padEnd(8, 'x') }))) }), LL).reason, 'too-many');
  assert.equal(P.readSnapshot(snap({ doc: doc([label('Up', { id: ID('u'), badge: { type: 'icon', svg: '<svg>' + 'x'.repeat(P.JSON_MAX) + '</svg>' } })]) }), LL).reason, 'too-big', 'the advertised bound, in bytes');
  assert.equal(P.readSnapshot(snap({ doc: doc([label('Ü', { id: ID('u'), badge: { type: 'icon', svg: '<svg>' + 'ü'.repeat(P.JSON_MAX / 2 + 100) + '</svg>' } })]) }), LL).reason, 'too-big', 'bytes, not characters');
  assert.equal(P.readSnapshot(snap({ doc: doc([label('Screws')]), drawers: { [ID('s')]: [0, 2, 'x', 1.5], BAD: [1] } }), LL).snap.drawers[ID('s')].join(), '2', 'drawer numbers are positive integers, ids checked');
  assert.equal(P.readSnapshot(snap({ selected: ID('z') }), LL).snap.selected, null, 'a selection not in the list is none');
  assert.equal(P.readSnapshot({ gen2plate: 'select', v: 1 }, LL).reason, 'not-a-snapshot');
  assert.equal(P.readSnapshot(snap(), null).reason, 'no-list-module');
});

test('a null document is the planner saying the list is over the bounds: no labels, and its reason', () => {
  const r = P.readSnapshot(snap({ doc: null, reason: 'This build has 500 labels; the plate shows at most 400.' }), LL);
  assert.ok(r.ok);
  assert.deepEqual(r.snap.labels, []); assert.deepEqual(r.snap.drawers, {}); assert.equal(r.snap.selected, null);
  assert.match(r.snap.reason, /at most 400/);
  assert.equal(P.readSnapshot(snap({ doc: null, reason: 7 }), LL).snap.reason, 'The planner did not send its labels.');
  assert.equal(P.readSnapshot(snap({ doc: null, reason: 'x'.repeat(400) }), LL).snap.reason.length, 300);
});

test('the row plan: a part label is a hardware row from its record, a typed label a plain row with its badge; drawers per row', () => {
  const item = { schema: LL.HW_ITEM, id: 'r1', fields: ['M5', '20'], attributes: [{ path: 'head', text: 'SHCS' }], pinned: ['head'] };
  const r = P.readSnapshot(snap({ doc: doc([
    label('M5 20 · SHCS', { id: ID('h'), hardware: item }),
    label('Nuts', { badge: { type: 'icon', value: 'nut' } }),
    label('Bolts', { badge: { type: 'char', value: 'B' } }),
    label('Plain'),
    label('Up', { id: ID('u'), badge: { type: 'icon', svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' } }),
  ]), drawers: { [ID('h')]: [2], [ID('n')]: [1, 4] } }), LL);
  assert.ok(r.ok, r.reason);
  const rows = P.rowPlan(r.snap);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].kind, 'hw'); assert.equal(rows[0].item.id, 'r1'); assert.deepEqual(rows[0].drawers, [2]);
  assert.equal(rows[1].kind, 'plain'); assert.deepEqual(rows[1].badge, { type: 'icon', value: 'nut', svg: undefined }); assert.equal(rows[1].manual, true); assert.deepEqual(rows[1].drawers, [1, 4]);
  assert.deepEqual(rows[2].badge, { type: 'char', value: 'B', svg: undefined });
  assert.equal(rows[3].badge, null); assert.equal(rows[3].manual, false, 'no badge in the list: predict here'); assert.deepEqual(rows[3].drawers, []);
  assert.equal(rows[4].badge.type, 'icon'); assert.match(rows[4].badge.svg, /^<svg/);
  assert.deepEqual(rows.map((x) => x.id), [ID('h'), ID('n'), ID('b'), ID('p'), ID('u')]);
});

test('style settings: the six label settings as the page\'s input ids; nothing else, nothing missing invented', () => {
  assert.deepEqual(P.styleSettings({ capMm: 4, depth: 0.5, badgeSize: 12, bold: true, allCaps: false, predictIcons: false }), { 'font-size': 4, 'text-depth': 0.5, 'badge-size': 12, 'bold-text': true, 'all-caps': false, 'predict-icons': false });
  assert.deepEqual(P.styleSettings({ capMm: 4, other: 1 }), { 'font-size': 4 });
  assert.deepEqual(P.styleSettings(null), {});
});

test('select and selected: the planner names a label or none; a click here names the label with the snapshot it belongs to', () => {
  const onScreen = { rev: 3, buildId: ID('b') };
  assert.deepEqual(P.readSelect({ gen2plate: 'select', v: 1, session: SESSION, id: ID('n'), buildId: ID('b') }, onScreen), { id: ID('n') });
  assert.deepEqual(P.readSelect({ gen2plate: 'select', v: 1, session: SESSION, id: null, buildId: ID('b') }, onScreen), { id: null });
  assert.equal(P.readSelect({ gen2plate: 'select', v: 1, session: SESSION, id: 'BAD', buildId: ID('b') }, onScreen), null);
  assert.equal(P.readSelect({ gen2plate: 'select', v: 1, session: SESSION, id: ID('n'), buildId: ID('c') }, onScreen), null, 'another build than the snapshot on screen');
  assert.equal(P.readSelect({ gen2plate: 'select', v: 1, session: SESSION, id: ID('n'), buildId: ID('b') }, null), null, 'no snapshot yet');
  assert.equal(P.readSelect({ gen2plate: 'snapshot' }, onScreen), null);
  const bind = { origin: PLANNER, session: SESSION };
  assert.deepEqual(P.selectedMessage(bind, ID('n'), { rev: 3, buildId: ID('b') }), { gen2plate: 'selected', v: 1, session: SESSION, id: ID('n'), rev: 3, buildId: ID('b') });
  assert.deepEqual(P.selectedMessage(bind, null, null), { gen2plate: 'selected', v: 1, session: SESSION, id: null, rev: -1, buildId: null });
});

test('the page loads plate-link.js (stamped) and guards its storage in the embed', () => {
  assert.match(HTML, /<script src="plate-link\.js\?v=[0-9a-f]+"><\/script>/, 'the script tag, version-stamped');
  assert.ok(HTML.includes('embed-planner'), 'the embed class');
  assert.ok(/function autosave\(\) \{\n\s*if \(EMBED\) return;/.test(HTML), 'autosave never writes in the embed');
  assert.ok(/function restoreAutosave\(\) \{\n\s*if \(EMBED\) return false;/.test(HTML), 'the embed never restores the standalone list');
  assert.ok(/function keepPreviousSet\(p\) \{\n\s*if \(EMBED\) return false;/.test(HTML), 'the embed never writes the previous set');
  // the page is one script: a second declaration of a name wins by hoisting. The embed's sender is its own (plateSend); the tab
  // link's postToPlanner (to the opener) stays the one declaration (found live 2026-10-14: a same-named embed sender sent the
  // ready to a null opener)
  assert.equal((HTML.match(/^function postToPlanner\(/gm) || []).length, 1, 'one postToPlanner');
  assert.equal((HTML.match(/^function plateSend\(/gm) || []).length, 1, 'the embed sends through plateSend');
  for (const name of ['bootEmbed', 'onPlannerMessage', 'applySnapshot', 'highlightRow', 'plateSend']) assert.equal((HTML.match(new RegExp(`^function ${name}\\(`, 'gm')) || []).length, 1, `${name} declared once`);
});
