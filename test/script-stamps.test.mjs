// Every local <script src> in index.html carries ?v=<hash of that file>, so a deploy never pairs a new index.html with
// an old cached script (tools/stamp-scripts.mjs says why). Re-stamp with: node tools/stamp-scripts.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stampPlan, stampOf } from '../tools/stamp-scripts.mjs';

const HTML = readFileSync(new URL('../index.html', import.meta.url));

test('every local script in index.html is stamped with the hash of its current file', () => {
  const { stale } = stampPlan(HTML);
  assert.deepEqual(stale, [], 'run: node tools/stamp-scripts.mjs');
});

test('no local script is loaded without a stamp, and nothing loads from another host', () => {
  const srcs = [...HTML.toString('latin1').matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcs.length >= 14, `found ${srcs.length} script tags`);
  for (const s of srcs) {
    assert.ok(!/^(https?:)?\/\//.test(s), `${s}: libraries are vendored, nothing loads from a CDN`);
    assert.match(s, /^[^?]+\.js\?v=[0-9a-f]{8}$/, `${s}: stamped`);
  }
});

test('a script tag with other attributes is stamped too, and keeps them', () => {
  const read = () => Buffer.from('x\n');
  const { html, stale } = stampPlan(Buffer.from('<script defer src="a.js" type="text/javascript"></script>\n<script src="https://cdn/x.js"></script>'), read);
  assert.equal(html, `<script defer src="a.js?v=${stampOf(Buffer.from('x\n'))}" type="text/javascript"></script>\n<script src="https://cdn/x.js"></script>`);
  assert.deepEqual(stale.map((s) => s.path), ['a.js'], 'an external URL is never stamped');
});

test('the stamp reads CRLF as LF, so every checkout computes the same one', () => {
  assert.equal(stampOf(Buffer.from('a\r\nb\r\n')), stampOf(Buffer.from('a\nb\n')));
  assert.notEqual(stampOf(Buffer.from('a\nb\n')), stampOf(Buffer.from('a\nc\n')));
});
