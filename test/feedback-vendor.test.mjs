// Feedback & support: modulith-feedback.js is the planner's js/modulith-feedback.js byte for byte (the planner owns it), so
// every MODULITH tool shows the same three kinds and the same email wording (Astra 2026-10-10). Re-vendor: copy the planner's
// file here, update PIN, run node tools/stamp-scripts.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PIN = 'b5e41b406e55cfde4b688a5fa2dea2e73c59bb954d78a98c1aedb09ff2907c32';
const here = readFileSync(new URL('../modulith-feedback.js', import.meta.url));
const sha = (b) => createHash('sha256').update(b).digest('hex');

test('the vendored feedback dialog is the pinned copy', () => {
  assert.equal(sha(here), PIN);
});

test('it is the planner checkout\'s file byte for byte (GEN2_PLANNER_ROOT)', { skip: !process.env.GEN2_PLANNER_ROOT && 'set GEN2_PLANNER_ROOT to compare' }, () => {
  const p = process.env.GEN2_PLANNER_ROOT + '/js/modulith-feedback.js';
  assert.ok(existsSync(p), p);
  assert.equal(sha(readFileSync(p)), sha(here));
});

test('the page loads it and offers it in the masthead, the phone menu and the footer', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<script src="modulith-feedback\.js\?v=[0-9a-f]{8}"><\/script>/);
  assert.match(html, /<nav aria-label="Primary" class="mainnav">[\s\S]*?<button type="button" class="navhelp" data-feedback aria-haspopup="dialog">Feedback<\/button>[\s\S]*?<\/nav>/);
  assert.match(html, /<dialog class="mobilenav"[\s\S]*?data-feedback aria-haspopup="dialog">Feedback &amp; support<\/button>[\s\S]*?<\/dialog>/);
  assert.match(html, /<div class="footer">[\s\S]*?<a href="#" data-feedback>Feedback &amp; support<\/a>/);
  assert.match(html, /MODULITHFeedback\.open\(\{ tool: 'Label Studio' \}\)/);
});
