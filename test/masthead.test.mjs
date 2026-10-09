// The Label Studio's masthead (2026-10-09). It is TOOL FIRST - Help, the Planner, the Build Studio, then one MODULITH menu
// holding the site's pages - and those pages are the site's nav (MODULITH src/components.js navItems()) as the Planner's
// masthead mirrors it. A site nav change is an edit in both apps; these checks catch the half that was forgotten.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const PAGE = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const PLANNER = new URL('../../../GEN2 Planner/gen2-planner-main/index.html', import.meta.url);   // D:/Code Projects/GEN2 Planner/...

const between = (s, from, to) => { const i = s.indexOf(from); assert.ok(i >= 0, `missing ${from}`); const j = s.indexOf(to, i); assert.ok(j > i, `missing ${to}`); return s.slice(i, j); };
const links = (html) => [...html.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].map(m => ({ attrs: m[1], href: (m[1].match(/href="([^"]*)"/) || [])[1], text: m[2] }));
const TOOLS = ['Planner', 'Build Studio'];

const nav = () => between(PAGE, '<nav aria-label="Primary" class="mainnav">', '</nav>');
const phone = () => between(PAGE, '<dialog class="mobilenav"', '</dialog>');
const siteMenu = () => links(between(PAGE, '<div class="dropdown" id="prodmenu">', '</div>'));

test('the bar leads with the tool: Help, then the Planner and the Build Studio, then the MODULITH menu', () => {
  const n = nav();
  assert.ok(n.indexOf('data-help>Help</button>') < n.indexOf('>Planner</a>'));
  assert.deepEqual(links(n).slice(0, 2).map(l => l.text), TOOLS);
  assert.match(n, /class="menubtn"[^>]*>MODULITH</);
  assert.ok(!siteMenu().some(l => TOOLS.includes(l.text)), 'the two tools are not repeated in the site menu');
});

test('the phone menu holds the same links as the bar, in the same order', () => {
  const p = phone();
  assert.match(p, /data-help>Help<\/button>/);
  assert.deepEqual(links(p).map(l => [l.href, l.text]), links(nav()).map(l => [l.href, l.text]));
});

test('every masthead link opens a new tab, so the labels being made stay open', () => {
  for (const l of [...links(nav()), ...links(phone())]) assert.match(l.attrs, /target="_blank" rel="noopener"/, l.text);
  // and the other ways off the page: the wordmark, and the footer's site link (Terra 01a12280)
  assert.match(between(PAGE, '<header class="mast"', '</header>'), /<a class="brandlink" target="_blank" rel="noopener" href="https:\/\/modulith\.systems\/"/);
  for (const l of links(between(PAGE, '<div class="footer">', '</div>')).filter(l => l.href !== '#')) assert.match(l.attrs, /target="_blank" rel="noopener"/, l.text);
});

test('the Help panel exists and the footer link opens it at two-color printing (no alert())', () => {
  assert.match(PAGE, /<dialog id="help" class="helpdlg"/);
  assert.match(PAGE, /id="help-two-color"/);
  assert.match(PAGE, /openHelp\('help-two-color'\)/);
  assert.doesNotMatch(PAGE, /alert\(\s*'Two-color/);
});

test('the site pages are the Planner masthead\'s, in its order, less the two tools (when its checkout is here)', (t) => {
  if (!existsSync(PLANNER)) { t.skip('no Planner checkout beside this one'); return; }
  const pl = readFileSync(PLANNER, 'utf8');
  const theirs = links(between(pl, '<nav aria-label="Primary" class="mainnav">', '</nav>')).filter(l => !TOOLS.includes(l.text));
  assert.deepEqual(siteMenu().map(l => [l.href, l.text]), theirs.map(l => [l.href, l.text]));
  const toolHrefs = Object.fromEntries(links(nav()).slice(0, 2).map(l => [l.text, l.href]));
  assert.equal(toolHrefs['Build Studio'], links(pl).find(l => l.text === 'Build Studio').href);
  assert.equal(toolHrefs.Planner, 'https://gen2planner.jerrari3d.com/');   // the Planner's own link is "./"
});

test('the wordmark is the Planner\'s, byte for byte (when its checkout is here)', (t) => {
  if (!existsSync(PLANNER)) { t.skip('no Planner checkout beside this one'); return; }
  const svg = (s) => between(s, '<svg class="brandlogo"', '</svg>').replace(/\r\n/g, '\n');
  assert.equal(svg(PAGE), svg(readFileSync(PLANNER, 'utf8')));
});
