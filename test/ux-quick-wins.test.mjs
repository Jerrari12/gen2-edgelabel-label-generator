/* The UI/UX review's quick wins (D:/MODULITH/handoffs/label-release/label-studio/UX-REVIEW-2026-10-10.md, section B):
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
    const camera = { fov: 40, aspect, position: { set: (x, y, z) => { pos = [x, y, z]; } } };
    const controls = { setTarget() {} };
    const THREE = { MathUtils: { degToRad: (d) => d * Math.PI / 180 }, Vector3: class {} };
    new Function('rebuild', 'camera', 'controls', 'THREE', fnSource('fitCamera') + '; fitCamera();')({ _fit: fit }, camera, controls, THREE);
    return { dist: pos[2] / 0.95, maxDistance: controls.maxDistance };
  };
  const fit = { span: 250, w: 250 };
  assert.equal(run(1.27, fit).dist, 250 * 1.75 + 50, 'a wide preview: unchanged');
  for (const aspect of [0.5, 0.63, 0.84]) {
    const { dist, maxDistance } = run(aspect, fit);
    const halfView = dist * Math.tan(20 * Math.PI / 180) * aspect;   // half the view's width at the plates
    assert.ok(halfView >= 125, `aspect ${aspect}: the plate's half width 125 mm fits in ${halfView.toFixed(1)} mm`);
    assert.ok(maxDistance >= dist, 'zooming out is never clamped short of the fitted view');
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
