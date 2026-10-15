/* The label-flow stress test's Label Studio fixes (2026-10-15; the findings list in D:\Claude - Output\label-flow-stress-2026-10-15):
   the small functions run on their own, and what the page must keep, read from index.html.
   Run:  node --test test/*.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// a function's whole source, by its name (brace matching from its first '{')
function fnSource(name) {
  const at = HTML.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `index.html has function ${name}`);
  let i = HTML.indexOf('{', HTML.indexOf(')', at)), depth = 0;
  for (; i < HTML.length; i++) { if (HTML[i] === '{') depth++; else if (HTML[i] === '}' && --depth === 0) break; }
  return HTML.slice(at, i + 1);
}

test('S-F7: a .txt is whole lines; a .csv is its first column, read as CSV, without a header row', () => {
  const labelsFromFile = new Function(fnSource('labelsFromFile') + '; return labelsFromFile;')();
  assert.deepEqual(labelsFromFile('\uFEFFScrews, M3\r\nNuts\n\n  Washers  \r', 'list.txt', 'text/plain'), ['Screws, M3', 'Nuts', 'Washers'], 'a comma in a .txt is part of the label');
  assert.deepEqual(labelsFromFile('Label,Qty\n"Screws, M3",40\n"Say ""hi""",1\nNuts,10\n', 'list.csv', 'text/csv'), ['Screws, M3', 'Say "hi"', 'Nuts']);
  assert.deepEqual(labelsFromFile('Bolts;2,5\nInserts;3\n', 'eu.csv', ''), ['Bolts', 'Inserts'], 'semicolons, with decimal commas');
  assert.deepEqual(labelsFromFile('M3, 40\nM4, 20\n', 'plain.csv', ''), ['M3', 'M4'], 'no header: the first row is a label');
  assert.deepEqual(labelsFromFile('name\nM3\n', 'x.csv', ''), ['M3'], 'a one-word header');
  assert.deepEqual(labelsFromFile('CAFE\u0301\n', 'x.txt', ''), ['CAF\u00c9'], 'composed (NFC)');
  assert.deepEqual(labelsFromFile('A,B\n', 'export', 'text/csv'), ['A'], 'no extension: the type decides');
  assert.deepEqual(labelsFromFile('A,B\n', 'export', ''), ['A,B'], 'no extension, no type: one label per line');
  // records, not lines (Sol 01a13ff8): a quoted field over two lines is one field
  assert.deepEqual(labelsFromFile('Label,Notes\nBolts,"left\nright"\nNuts,ok\n', 'x.csv', ''), ['Bolts', 'Nuts'], 'a note column over two lines is not a label');
  assert.deepEqual(labelsFromFile('"Two\r\nlines",1\r\nNuts,2', 'x.csv', ''), ['Two\r\nlines', 'Nuts'], 'a first column over two lines is one label (no line break at the end either)');
  assert.deepEqual(labelsFromFile('  "padded, quoted"  ,1\nlast', 'x.csv', ''), ['padded, quoted', 'last'], 'spaces around a quoted field');
});

test('S-B2 / S-F9: a number setting as it is used - empty takes the default, outside min/max is held, and a note says so', () => {
  const els = {};
  const field = (id, value, min, max, def) => { els[id] = { value, min, max, defaultValue: def }; };
  const document = { getElementById: (id) => els[id] || null };
  const numNotes = new Map();
  const src = `const NUM_NAME = { 'font-size': 'Text height', 'text-depth': 'Text depth', 'bed-w': 'Plate width' };` + fnSource('numSetting') + '; return numSetting;';
  const numSetting = new Function('document', 'numNotes', 'EMBED', src)(document, numNotes, null);
  field('font-size', '', '2', '6.5', '5');
  assert.equal(numSetting('font-size', 5), 5); assert.equal(numNotes.get('font-size').text, 'Text height is empty: using 5 mm.');
  field('font-size', 'abc', '2', '6.5', '5');
  assert.equal(numSetting('font-size', 5), 5, 'unreadable is empty');
  field('text-depth', '5', '0.2', '1.2', '0.6');
  assert.equal(numSetting('text-depth', 0.6), 1.2); assert.equal(numNotes.get('text-depth').text, 'Text depth goes up to 1.2 mm: using 1.2 mm.');
  field('text-depth', '0', '0.2', '1.2', '0.6');
  assert.equal(numSetting('text-depth', 0.6), 0.2);
  field('text-depth', '-1', '0.2', '1.2', '0.6');
  assert.equal(numSetting('text-depth', 0.6), 0.2, 'a negative depth no longer sinks the text');
  field('text-depth', '0.8', '0.2', '1.2', '0.6');
  assert.equal(numSetting('text-depth', 0.6), 0.8); assert.equal(numNotes.get('text-depth').text, '', 'in range: no note');
  field('bed-w', '10', '20', '1000', '250');
  assert.equal(numSetting('bed-w', 250, 67), 67); assert.equal(numNotes.get('bed-w').text, 'Plate width 10 mm cannot hold a label: using 67 mm.');
  field('bed-w', '50', '20', '1000', '250');
  assert.equal(numSetting('bed-w', 250, 67), 67, 'above the field\'s min, below one label: still held');
  assert.equal(numSetting('missing', 14), 14, 'no field: the fallback');
  // in the planner's plate the label settings are the planner's (disabled here): the note points there
  const inPlate = new Function('document', 'numNotes', 'EMBED', src)(document, numNotes, {});
  field('font-size', '', '2', '6.5', '5'); els['font-size'].disabled = true;
  inPlate('font-size', 5);
  assert.equal(numNotes.get('font-size').text, "Text height is empty: using 5 mm. Change it in the planner's Label settings.");
  field('bed-w', '10', '20', '1000', '250');
  inPlate('bed-w', 250, 67);
  assert.equal(numNotes.get('bed-w').text, 'Plate width 10 mm cannot hold a label: using 67 mm.', 'a printer setting the plate can change: no pointer');
  // every read of these settings goes through it (the raw parseFloat in rebuild and doExport is gone)
  assert.doesNotMatch(HTML, /parseFloat\(document\.getElementById\('(font-size|text-depth|bed-w|bed-l|purge-w|purge-l|badge-size)'\)/);
});

test('S-F9: the plate\'s capacity says what the purge area takes', () => {
  const src = 'const LABEL_WID = 12, LABEL_LEN = 57, ROW_SPACING = 4, COL_SPACING = 6, BED_MARGIN = 5;'
    + fnSource('purgeOverlaps') + fnSource('plateCapacity') + '; return plateCapacity;';
  const plateCapacity = new Function(src)();
  const none = plateCapacity(250, 220, null);
  assert.equal(none.reserved, 0); assert.equal(none.perPlate, none.spots);
  const usual = plateCapacity(250, 220, { w: 80, l: 80 });
  assert.ok(usual.reserved > 0 && usual.reserved * 2 < usual.spots, 'the usual 80 x 80: a few spots, no note');
  const huge = plateCapacity(250, 220, { w: 400, l: 400 });
  assert.equal(huge.reserved, huge.spots); assert.equal(huge.perPlate, 1, 'every spot taken: one label per plate, and the note says so');
});

test('S-B3 / S-F10 / S-B4 / S-F2: the page keeps the export gates and the Undo wiring', () => {
  const exp = fnSource('doExport');
  assert.match(exp, /querySelectorAll\('#labels \.row\.too-long'\)[\s\S]*Not exported: /, 'text off the label stops the export');
  assert.match(exp, /if \(doExport\.busy\) return;/, 'one export at a time');
  assert.match(exp, /finally \{ doExport\.busy = false; meshWatch = null;/, 'released whatever happens');
  assert.match(fnSource('exportFiles'), /if \(meshWatch && meshWatch\.length\)[\s\S]*return;/, 'text the preview had not caught stops it too');
  assert.match(fnSource('undoListAdd'), /if \(u\.run\) \{ u\.run\(\);/);
  assert.match(HTML, /const kept = keepPreviousSet\(captureProject\(\)\);\n      applyProject\(p\);/, 'Open set file keeps the previous set first');
  for (const what of ['Sorted in natural order', 'Deleted ${plural(rows.length', 'Added “${p.name}”', 'Removed label ${n}']) assert.ok(HTML.includes(what), what);
  assert.match(fnSource('offerListUndo'), /if \(EMBED \|\| \(typeof link !== 'undefined' && link\)\) \{ rebuild\(\); return; \}/, 'never in the plate or while linked');
});
