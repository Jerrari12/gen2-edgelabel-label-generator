/* The UI/UX review's quick wins (MODULITH/handoffs/label-release/label-studio/UX-REVIEW-2026-10-10.md, section B):
   what the page must keep - read from index.html, and the small functions run on their own.
   Run:  node --test test/*.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const CSS = HTML.slice(0, HTML.indexOf('</style>'));
// a function's whole source, by its name (brace matching from its first '{')
function fnSource(name) {
  const at = HTML.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `index.html has function ${name}`);
  let i = HTML.indexOf('{', HTML.indexOf(')', at)), depth = 0;
  for (; i < HTML.length; i++) { if (HTML[i] === '{') depth++; else if (HTML[i] === '}' && --depth === 0) break; }
  return HTML.slice(at, i + 1);
}
const between = (from, to) => HTML.slice(HTML.indexOf(from), HTML.indexOf(to, HTML.indexOf(from)));

test('B1: the status line, the label count and Download sit together in one bar pinned to the bottom of the sidebar', () => {
  const dock = between('<div class="dock" id="dock">', '<div class="footer">');
  assert.match(dock, /<div id="status" role="status" aria-live="polite">/, 'the status is announced to screen readers');
  assert.match(dock, /id="dock-count"/);
  assert.match(dock, /<button class="primary" id="download"/);
  assert.match(CSS, /\.dock \{ position: sticky; bottom: -20px;/, 'desktop: sticky at the bottom of the scrolling sidebar');
  const phone = CSS.slice(CSS.indexOf('@media (max-width: 760px) {'));
  assert.match(phone, /\.dock \{ position: fixed; left: 0; right: 0; bottom: 0;/, 'phone: fixed to the bottom of the screen');
  assert.match(phone, /#sidebar \{ padding-bottom: calc\(var\(--dock-h/, 'the sidebar keeps room under its last line for the bar');
});

test('B4: the preview shrinks with the window and refits the plates when its width changes', () => {
  assert.match(CSS, /#preview \{ flex: 1; min-width: 0; overflow: hidden;/);
  assert.match(fnSource('setupThree'), /new ResizeObserver\(onResize\)\.observe\(container\)/);
  assert.match(fnSource('onResize'), /if \(w !== previewWidth\) \{ previewWidth = w; fitCamera\(\); \}/, 'a height-only change leaves the view alone');
  // fitCamera on its own: a wide preview keeps the distance it always had; a narrow one backs off until the plates' width fits
  const run = (aspect, fit) => {
    let pos = null;
    const camera = { fov: 40, aspect, far: 2000, projections: 0, updateProjectionMatrix() { this.projections++; }, position: { set: (x, y, z) => { pos = [x, y, z]; } } };
    const controls = { setTarget() {} };
    const THREE = { MathUtils: { degToRad: (d) => d * Math.PI / 180 }, Vector3: class {} };
    new Function('rebuild', 'camera', 'controls', 'THREE', fnSource('fitCamera') + '; fitCamera();')({ _fit: fit }, camera, controls, THREE);
    return { dist: pos[2] / 0.95, maxDistance: controls.maxDistance, far: camera.far, projections: camera.projections };
  };
  const fit = { span: 250, w: 250 };
  assert.equal(run(1.27, fit).dist, 250 * 1.75 + 50, 'a wide preview: unchanged');
  for (const aspect of [0.5, 0.63, 0.84]) {
    const { dist, maxDistance } = run(aspect, fit);
    const halfView = dist * Math.tan(20 * Math.PI / 180) * aspect;   // half the view's width at the plates
    assert.ok(halfView >= 125, `aspect ${aspect}: the plate's half width 125 mm fits in ${halfView.toFixed(1)} mm`);
    assert.ok(maxDistance >= dist, 'zooming out is never clamped short of the fitted view');
  }
  // S-B5 (the stress test, 2026-10-15): the far plane was fixed at 2000, and five plates up (65+ labels) the fitted camera
  // sat 2382 mm out - the preview went blank. It now reaches past the farthest zoom plus the row of plates behind it.
  const one = run(1.27, fit);
  assert.equal(one.far, 2000, 'one plate: the far plane it always had');
  assert.equal(one.projections, 0, '...and no projection rebuilt for nothing');
  for (const plates of [5, 8, 16]) {
    const w = plates * 250 + (plates - 1) * 24;
    const r = run(1.27, { span: w, w });
    assert.ok(r.far >= r.maxDistance + w, `${plates} plates: the far plane ${r.far.toFixed(0)} mm covers the farthest zoom ${r.maxDistance.toFixed(0)} mm and the plates`);
    assert.equal(r.projections, 1, `${plates} plates: the projection is rebuilt once`);
  }
});

test('B5: Printer and Export format: the name above, the dropdown the full width (with the Planner\'s printer icon)', () => {
  const printer = between('<span id="bed-preset-name">', '</select>');
  assert.match(HTML, /<div class="setting stack">\s*<span id="bed-preset-name">Printer<\/span>/);
  assert.match(printer, /class="printer-icon"/);
  assert.match(HTML, /<div class="setting stack">\s*<span id="export-format-name">Export format<\/span>/);
  assert.match(CSS, /\.setting\.stack select \{ width: 100%;/);
});

test('B11: an empty plate says what goes on it, and the wipe-tower square is captioned', () => {
  assert.match(HTML, /id="plate-empty" hidden>Your labels appear here/);
  assert.match(HTML, /id="purge-tag" hidden>Kept free for the wipe tower</);
  const rb = fnSource('rebuild');
  assert.match(rb, /getElementById\('plate-empty'\)\.hidden = labels\.length > 0/);
  assert.match(rb, /purgeAnchor = purge \?/);
  assert.match(fnSource('animate'), /placePurgeTag\(\)/);
});

test('B6: colour names mean what the Planner\'s mean (--accent-dim the pressed orange, no lighter --panel-2), no old orange', () => {
  assert.match(CSS, /--accent-dim: #d9550f;/);
  assert.match(CSS, /--line: #4a4b50;/);
  assert.match(CSS, /--good: #4cc38a;/);
  assert.match(CSS, /--on-accent: #1d1e20;/);
  assert.doesNotMatch(HTML, /var\(--panel-2\)|--panel-2:|var\(--border\)|var\(--danger\)/, 'the old names are gone');
  assert.doesNotMatch(HTML, /238, 122, 48|0xee7a30|#1a1a1c/, 'the old orange and the old text-on-orange are gone');
});

test('B3, B7, B9, B14: orange keyboard focus, the three button looks, green success with a check, readable errors, page zoom', () => {
  assert.match(CSS, /:focus-visible \{ outline: 2px solid var\(--accent\);/);
  assert.match(CSS, /select:focus, textarea:focus \{ outline: none; border-color: var\(--accent\); box-shadow: 0 0 0 1px var\(--accent\); \}/);
  assert.doesNotMatch(CSS, /focus-visible[^{]*\{[^}]*outline: none/, 'nothing hides the keyboard outline');
  assert.match(CSS, /button\.primary, button\.btn-sm\.primary-sm, #affix-apply, #link-send \{\s*background: var\(--accent\)/, 'solid orange');
  assert.match(CSS, /button\.btn-sm, \.bulk-actions button, button\.tool-btn, \.bp-section button:not\(\.bp-icon\), \.csv-zone, \.af-buttons \.af-parts \{\s*background: transparent; color: var\(--accent\); border: 1px solid var\(--accent-dim\)/, 'orange outline');
  assert.equal((CSS.match(/dashed var\(--muted\)/g) || []).length, 1, 'one dashed button: + Add label');
  assert.match(CSS, /#status\.ok \{ color: var\(--good\); \}\s*#status\.ok::before \{ content: "\\2713/);
  assert.match(CSS, /#status\.err \{ color: var\(--bad-text\);/);
  assert.match(CSS, /\.swatch \.dot \{[^}]*border: 1\.5px solid #8a8c92/);
  assert.match(HTML, /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/, 'the page can be zoomed');
  assert.match(CSS, /#preview canvas \{ display: block; touch-action: none; \}/, 'the 3D view keeps its own pinch');
});

test('B13: the icon menu opens on the matching group, is held to the room on its side, and Escape returns the keyboard to its button', () => {
  // menuHintGroup on its own: the label's icon's group, else the guess from its words, else the first group
  const GROUPS = [{ id: 'screws' }, { id: 'tools' }, { id: 'general' }];
  const icons = { wrench: { group: 'tools' }, 'storage-box': { group: 'general' } };
  const row = (t) => ({ querySelector: () => ({ value: t }) });
  const hint = (cur, rows, bulk = false) => new Function('LabelIcons', 'bulkBadgeMode', 'activeBadgeRow', 'selectedRows',
    fnSource('menuHintGroup') + '; return menuHintGroup;')(
    { GROUPS, find: (id) => icons[id] || null, guessIconId: (t) => (/allen/i.test(t) ? 'wrench' : /box/i.test(t) ? 'storage-box' : null) },
    bulk, bulk ? null : rows[0] || null, () => rows)(cur);
  assert.equal(hint({ group: 'general' }, [row('Allen keys')]), 'general', 'its own icon first');
  assert.equal(hint(null, [row('Allen keys')]), 'tools', 'the icon its words suggest');
  assert.equal(hint(null, [row('Odds'), row('Box of bits')], true), 'general', 'Set icon: the first selected label with a guess');
  assert.equal(hint(null, [row('Odds')]), 'screws', 'nothing suggested: the first group');
  const place = fnSource('placeMenu');
  assert.match(place, /pop\.style\.maxHeight = Math\.max\(160, up \? above : below\) \+ 'px'/);
  assert.match(CSS, /\.badge-popover > \.bp-icons \{ flex: 0 1 auto; min-height: 60px; \}/, 'the icon list is what gives way');
  assert.match(HTML, /if \(e\.key === 'Escape' && !pop\.hidden\) closeBadgePopover\(true\)/);
  assert.match(fnSource('closeBadgePopover'), /if \(refocus && wasOpen && a && a\.isConnected && !a\.disabled\) a\.focus\(\)/);
});

test('B8, B10: plain words - Save set file, Open set file, Download print file (.3mf), icon (never badge) where a person reads it', () => {
  assert.match(HTML, /id="proj-export"[^>]*>Save set file</);
  assert.match(HTML, /id="proj-upload-btn"[^>]*>Open set file</);
  assert.match(HTML, /<h2>Save \/ Open<\/h2>/);
  assert.match(HTML, /id="download" disabled>Download print file \(\.3mf\)</);
  assert.match(HTML, /dlBtn\.textContent = 'Download print file \(' \+ \(fmtSel\.value === 'stl' \? '\.stl' : '\.3mf'\) \+ '\)'/);
  assert.doesNotMatch(HTML, /Save \/ Load ›|>Export<|>Upload<|>No badge<|Left badge \(optional\)|Badge size \(cap\)|pick another badge|'Badge: |`Badge: |"Badge: |Add a badge/);
  assert.match(HTML, /<button id="bp-none">No icon<\/button>/);
  assert.match(HTML, /title="Swap the current labels and settings with the previous set - the one set kept from before the last import \(from the Planner, the Part Picker or a CSV \/ TXT file\)/);
});

test('B2: a CSV / TXT file over a list with labels keeps it: Undo beside the list, and the Previous set', () => {
  const csv = fnSource('handleCsv');
  assert.match(csv, /const kept = had && keepPreviousSet\(captureProject\(\)\);/);
  assert.match(csv, /if \(had\) listUndo = \{ labels: before, sig: null, undone:/);
  assert.match(csv, /showListNote\(`Replaced your list with/);
  assert.match(fnSource('undoListAdd'), /setStatus\(u\.undone \|\|/);
});

test('B12: a part row\'s note is one short line - what prints, anything left off before the stripe - and the whole account its tooltip', () => {
  const run = (r, profile = true) => new Function('LH', 'LabelIcons', fnSource('hwShortNote') + '; return hwShortNote;')(
    { noteText: () => 'the whole account' },
    { find: (id) => ({ 'hex-nut': { name: 'Hex nut, plain' } }[id] || null) })(r, profile);
  const rec = (o) => Object.assign({ not_shown: [], value_missing: [] }, o);
  const metric = { band: { label: 'Metric' }, band_accent: { label: 'Stainless' } };
  assert.equal(run({ elements: [1], record: rec({ layout: 'v5', kind: 'screw' }), band: 'bottom', colours: metric }), 'Screw drawing · Metric stripe');
  assert.equal(run({ elements: [1], record: rec({ layout: 'v5', kind: 'nut', not_shown: ['ZINC'] }), band: 'bottom', colours: metric }), 'Nut drawing · left off: ZINC · Metric stripe');
  assert.equal(run({ elements: [1], record: rec({ icon: 'hex-nut', icon_left_off: 'hex-nut' }), covered: false }), 'Icon: hex nut, plain · no room for the hex nut, plain icon');
  assert.equal(run({ elements: [1], record: rec({}), covered: true }), 'Words only: no room for the drawing');
  assert.equal(run({ elements: [1], record: rec({ layout: 'v5', kind: 'screw' }), typeSkips: ['colour band'] }), 'Screw drawing · colour band on EdgeLabel only');
  assert.equal(run({ elements: null, record: rec({ nonfit: 'too long' }) }), 'the whole account', 'a label that cannot print keeps the whole reason');
  assert.match(fnSource('layOutHardwareRow'), /note\.title = \[LH\.noteText\(r, profile\), LH\.noteDetail\(r\)\]\.filter\(Boolean\)\.join\('\\n'\)/);
  assert.match(CSS, /\.row \.hw-note \{[^}]*white-space: nowrap; overflow: hidden; text-overflow: ellipsis; \}/);
});
