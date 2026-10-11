// Version-stamp every local <script src> in index.html with a hash of the file it loads.
//
// GitHub Pages caches each file for 10 minutes. Without stamps, a visitor right after a deploy can get the NEW
// index.html with an OLD cached script (label-link.js, label-icons.js ...) and the page dies at boot - a linked tab
// stays on "Loading..." (release-readiness review 2026-10-10). This repo deploys straight from the branch with no build
// step, so the stamps live in index.html itself: `src="label-link.js?v=<8 hex>"`, the hex being the first 8 of the
// sha256 of the file (CRLF read as LF, so every checkout agrees). A changed script gets a new URL; an unchanged one
// keeps its cached copy. test/script-stamps.test.mjs fails while any stamp is stale.
//
//   node tools/stamp-scripts.mjs          rewrite the stamps in index.html (byte-exact elsewhere: the file mixes
//                                         line endings, so it is edited as bytes, never re-written line by line)
//   node tools/stamp-scripts.mjs --check  exit 1 and list the stale stamps
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// local paths only (no scheme, no query of another kind); any other attributes (defer, type ...) are kept as they are
const SRC = /(<script\b[^>]*?\bsrc=")([^"?#:]+\.js)(\?v=[0-9a-f]*)?(")/g;

export const stampOf = (bytes) =>
  createHash('sha256').update(Buffer.from(bytes.toString('latin1').replace(/\r\n/g, '\n'), 'latin1')).digest('hex').slice(0, 8);

// -> { html (latin1 string, stamps current), stale: [{ path, had, want }] }
export function stampPlan(htmlBytes, read = (p) => readFileSync(join(ROOT, p))) {
  const html = htmlBytes.toString('latin1');
  const stale = [];
  const out = html.replace(SRC, (whole, open, path, q, close) => {
    const want = stampOf(read(path));
    const had = q ? q.slice(3) : null;
    if (had !== want) stale.push({ path, had, want });
    return `${open}${path}?v=${want}${close}`;
  });
  return { html: out, stale };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = join(ROOT, 'index.html');
  const { html, stale } = stampPlan(readFileSync(file));
  if (process.argv.includes('--check')) {
    for (const s of stale) console.log(`stale: ${s.path} has ${s.had ?? 'no stamp'}, wants ${s.want}`);
    process.exit(stale.length ? 1 : 0);
  }
  writeFileSync(file, Buffer.from(html, 'latin1'));
  console.log(stale.length ? `stamped ${stale.length}: ${stale.map((s) => s.path).join(', ')}` : 'all stamps current');
}
