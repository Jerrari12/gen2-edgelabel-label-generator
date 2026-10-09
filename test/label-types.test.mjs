/* Label types (Astra 2026-10-09: one app, Classic Pro as another output for the same labels). What the page relies on:
   - the icon library and its prediction are the same in both cores, because the page takes them once (from EdgeLabel's)
     while it swaps everything else with the type - a divergence would put one type's icons on the other's labels;
   - both cores start from the same defaults, so a type's first visit (the form's defaults) means the same in both;
   - the Classic Pro label body and core are that generator's own, unchanged (checked against its checkout when present);
   - the page's type registry names a body, a core and file names for every type, and the per-type settings are real
     settings of the form.
   Run:  node --test test/*.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
require('../label-core.js');
require('../label-core-classicpro.js');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CP_REPO = new URL('../../../GEN2 Classic Label Generator/', import.meta.url);   // D:/Code Projects/GEN2 Classic Label Generator

const stubTHREE = {};   // create() only keeps the reference; nothing here builds geometry
const EL = globalThis.GEN2EdgeLabelCore.create({ THREE: stubTHREE });
const CP = globalThis.GEN2ClassicProCore.create({ THREE: stubTHREE });

test('both cores carry the same icon library and the same icon prediction (the page takes them once)', () => {
  assert.deepEqual(CP.ICON_LIBRARY.map((i) => [i.id, i.label, i.svg]), EL.ICON_LIBRARY.map((i) => [i.id, i.label, i.svg]));
  assert.ok(EL.ICON_LIBRARY.length >= 20, `${EL.ICON_LIBRARY.length} icons`);
  for (const w of ['Torx Bits', 'Coffee filters', 'Zip ties', 'M3 SCREWS', 'Drill bits HSS', 'nothing to see']) {
    assert.equal(CP.guessIconId(w), EL.guessIconId(w), w);
  }
});

test('both cores start from the same defaults', () => {
  assert.deepEqual({ ...CP.DEFAULTS }, { ...EL.DEFAULTS });
});

test('the two label faces are the measured ones (EdgeLabel 57 x 27 x 4.5, Classic Pro 47.07 x 25.47 x 1.5)', () => {
  assert.deepEqual([EL.LABEL_LEN, EL.LABEL_WID, EL.LABEL_HT], [57, 27, 4.5]);
  assert.deepEqual([CP.LABEL_LEN, CP.LABEL_WID, CP.LABEL_HT], [47.07, 25.47, 1.5]);
  assert.equal(CP.MIN_PRINT_CAP, EL.MIN_PRINT_CAP);
});

const arr = (name) => JSON.parse(HTML.match(new RegExp(`const ${name} = (\\[.*?\\]);`))[1]);

test('the Classic Pro body in the page is the Classic Pro generator\'s, unchanged (when its checkout is here)', (t) => {
  const v = arr('CP_BASE_VERTS'), tr = arr('CP_BASE_TRIS');
  assert.equal(v.length / 3, 92); assert.equal(tr.length / 3, 180);
  const zs = v.filter((_, i) => i % 3 === 2);
  assert.deepEqual([Math.min(...zs), Math.max(...zs)], [0, 1.5], 'a 1.5 mm plate, printing top at z 1.5');
  if (!existsSync(new URL('index.html', CP_REPO))) { t.skip('no Classic Pro checkout beside this one'); return; }
  const cp = execFileSync('git', ['show', 'main:index.html'], { cwd: CP_REPO }).toString().replace(/\r\n/g, '\n');
  assert.deepEqual(v, JSON.parse(cp.match(/const BASE_VERTS = (\[.*?\]);/)[1]));
  assert.deepEqual(tr, JSON.parse(cp.match(/const BASE_TRIS = (\[.*?\]);/)[1]));
});

test('label-core-classicpro.js is the Classic Pro branch core, byte for byte (when its checkout is here)', (t) => {
  const mine = readFileSync(new URL('../label-core-classicpro.js', import.meta.url));
  // pinned: a change to this file is a change to how every Classic Pro label is built - re-run the export check first
  assert.equal(createHash('sha256').update(mine).digest('hex').slice(0, 16), 'bbb53c7c46054428');
  if (!existsSync(new URL('index.html', CP_REPO))) { t.skip('no Classic Pro checkout beside this one'); return; }
  const theirs = execFileSync('git', ['show', 'f0ef3c6:label-core.js'], { cwd: CP_REPO });
  assert.ok(Buffer.compare(mine, theirs) === 0, 'differs from classicpro-label-core f0ef3c6');
});

test('the type registry: every type names a body, a core and its own file names; per-type settings are form settings', () => {
  const reg = HTML.match(/const LABEL_TYPES = \{([\s\S]*?)\n\};/)[1];
  for (const id of ['edgelabel', 'classicpro']) assert.match(reg, new RegExp(`\\b${id}: \\{ id: '${id}'`), id);
  assert.match(reg, /coreName: 'GEN2EdgeLabelCore', verts: BASE_VERTS, tris: BASE_TRIS/);
  assert.match(reg, /coreName: 'GEN2ClassicProCore', verts: CP_BASE_VERTS, tris: CP_BASE_TRIS/);
  assert.match(reg, /files: 'edgelabels', zip: 'gen2_edgelabels', set: 'edgelabel-set'/, 'EdgeLabel keeps its download names');
  assert.match(reg, /files: 'classicpro-labels', zip: 'gen2_classicpro_labels', set: 'classicpro-set'/, 'Classic Pro keeps its generator\'s names');
  const ids = (name) => JSON.parse(HTML.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);`))[1].replace(/'/g, '"'));
  const all = ids('SETTING_IDS'), per = ids('TYPE_SETTING_IDS');
  for (const id of per) assert.ok(all.includes(id), `${id} is a saved setting`);
  for (const shared of ['predict-icons', 'bed-preset', 'bed-w', 'bed-l', 'export-format', 'reserve-purge']) assert.ok(!per.includes(shared), `${shared} stays shared`);
  for (const id of all) assert.ok(HTML.includes(`id="${id}"`), `${id} is in the form`);
});
