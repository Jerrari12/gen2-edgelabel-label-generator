/* The generator's own browser checks for Step 3 (STEP3-SPEC.md section 10.5, "generator-only page checks"): the generator alone,
   headed Chrome over CDP, and a STUB planner on a second local port (a different ORIGIN, so postMessage is cross-origin exactly
   as in production) that opens the generator with window.open and plays the planner's messages.

   Run (nothing else on 8711-8713):
     node tools/page/page-checks.mjs [--only G-boot]
   Prints PASS/FAIL per check, exits 1 on any failure, stops its servers and its browser, deletes its profile.
   Not part of `node --test`: it needs a real Chrome. */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './cdp.mjs';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const GEN_ROOT = process.env.GEN_ROOT || join(HERE, '..', '..');
const L = require('../../label-link.js');
const GP = 8711, SP = 8712, CDP = 8713;
const GEN = `http://localhost:${GP}/index.html`;
const STUB = `http://localhost:${SP}/stub-planner.html`;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };
const ID = (c) => c.repeat(12);
const style = (o = {}) => ({ capMm: 5, depth: 0.6, badgeSize: 14, bold: false, allCaps: true, predictIcons: true, ...o });
const mkJob = (rows, o = {}) => ({ v: 1, family: 'edgelabel', jobId: ID('j'), buildId: ID('b'), baseRev: ID('r'), origin: `http://localhost:${SP}`, textMax: 40, style: style(),
  rows: rows.map((r, i) => ({ u: i + 1, n: i + 1, g: [i, 0, 1, 2], t: '', b: null, ...r })), ...o });
const jobUrl = (job, legacy) => GEN + '#' + (legacy ? 'labels=' + Buffer.from(JSON.stringify(legacy)).toString('base64') + '&' : '') + 'job=' + L.encodeJob(job);
const legacyUrl = (words) => GEN + '#labels=' + Buffer.from(JSON.stringify(words)).toString('base64');

const b = await launch({ cdpPort: CDP, width: 1280, height: 900, tag: 'gen2-step3-page' });
let exitCode = 0;
try {
  await b.startServer(GEN_ROOT, GP);
  await b.startServer(join(HERE, 'stub'), SP);

  /* one scenario = a fresh browser context (its own localStorage), the stub page, and whatever tabs it opens */
  async function scenario(name, fn) {
    if (only && !name.startsWith(only)) return;
    const ctx = await b.newContext();
    const stub = await b.newPage(STUB, ctx);
    const opened = [stub];
    const S = {
      b, ctx, stub,
      async openGen(url, { name: wname = 'gen', ack = true, drawers = 0, auto } = {}) {
        await stub.ev(`window.__auto = ${JSON.stringify({ ack, received: false, drawers, ...(auto || {}) })}`);
        await stub.ev(`openGen(${JSON.stringify(url)}, ${JSON.stringify(wname)})`);
        const g = await b.popupOf(stub); opened.push(g);
        await g.waitFor(`!document.getElementById('download').disabled`, { timeoutMs: 20000 });
        return g;
      },
      log: () => stub.ev('window.__log'),
      rows: (g) => g.ev(`[...document.querySelectorAll('#labels .row')].map(r => ({ text: r.querySelector('input.label-text').value, u: r.dataset.unit || null, tag: (r.querySelector('.utag')||{}).textContent || null, manual: r.dataset.badgeManual === '1', type: r.dataset.badgeType, held: r.dataset.badgeHeld || null, max: r.querySelector('input.label-text').maxLength, note: (r.querySelector('.row-note')||{}).textContent || null }))`),
      ls: (g, k) => g.ev(`localStorage.getItem(${JSON.stringify(k)})`),
      ss: (g, k) => g.ev(`sessionStorage.getItem(${JSON.stringify(k)})`),
      barText: (g) => g.ev(`(() => { const b = document.getElementById('link-bar'); return b.hidden ? null : b.textContent.replace(/\\s+/g, ' ').trim(); })()`),
      status: (g) => g.ev(`document.getElementById('status').textContent`),
      /* seed localStorage from a same-origin URL that does NOT run the app (favicon.svg): seeding while the app is open is
         overwritten by its pending debounced autosave */
      async seed(entries) {
        const t = await b.newPage(`http://localhost:${GP}/favicon.svg`, ctx);
        for (const [k, v] of Object.entries(entries)) await t.ev(`localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`);
        await t.close();
      },
      async setText(g, i, text) { await g.ev(`(() => { const i = document.querySelectorAll('#labels .row input.label-text')[${i}]; i.value = ${JSON.stringify(text)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(450); },
    };
    try { await fn(S); }
    catch (e) { check(name + ' (scenario crashed)', false, String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
    finally {
      for (const p of opened.reverse()) { try { await p.close(); } catch (e) {} }
      await b.disposeContext(ctx);
    }
  }

  const ORDINARY = (labels, settings = {}) => JSON.stringify({ fmt: 'edgelabel-set', v: 1, savedAt: '2026-10-01T00:00:00.000Z',
    labels: labels.map((t) => ({ text: t, badge: { type: 'none' }, manual: false })),
    settings: { 'font-size': '3', 'text-depth': '0.6', 'badge-size': '14', 'bold-text': true, 'predict-icons': false, 'all-caps': true, 'bed-preset': 'custom', 'bed-w': '300', 'bed-l': '200', 'export-format': 'stl', 'reserve-purge': false, 'purge-w': '80', 'purge-l': '80', 'color-base': '#112233', 'color-text': '#445566', ...settings } });

  /* ------------------------------------------------------------ G-boot-1 */
  await scenario('G-boot-1', async (S) => {
    const job = mkJob([{ t: 'M3 Screws', b: { type: 'char', value: 'A' } }, { t: '' }, { t: 'Torx Bits' }]);
    const g = await S.openGen(jobUrl(job, ['M3 Screws', 'Torx Bits']), { drawers: 3 });
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    const rows = await S.rows(g);
    check('G-boot-1: a job hash opens LINKED: three rows tagged #1-#3, drawer text in place', rows.length === 3 && rows.map((r) => r.tag).join() === '#1,#2,#3' && rows[0].text === 'M3 Screws' && rows[2].text === 'Torx Bits', JSON.stringify(rows));
    check('G-boot-1: the hash is cleared', (await g.ev('location.hash')) === '');
    check('G-boot-1: the bar says Linked with the drawer count', /Linked to your planner build · 3 drawers/.test(await S.barText(g)), await S.barText(g));
    const log = await S.log();
    const hellos = log.filter((x) => x.d.gen2label === 'hello');
    // the stub tab is in the BACKGROUND, so Chrome may hold its ack past the 1 s retry: one hello, or two identical ones; never more
    check('G-boot-1: hello reached the planner from its own window with the job ids (1-2 identical retries, never more)', hellos.length >= 1 && hellos.length <= 2 && hellos.every((x) => x.fromGen && x.origin === GEN.replace('/index.html', '') && x.d.jobId === job.jobId && x.d.buildId === job.buildId && x.d.baseRev === job.baseRev && x.d.family === 'edgelabel' && x.d.v === 1), JSON.stringify(log.map((x) => x.d.gen2label)));
    check('G-boot-1: the linked session is stored in sessionStorage', !!(await S.ss(g, 'edgelabel.linked.v1')));
    check('G-boot-1: linked rows are capped at the planner\'s 40', rows.every((r) => r.max === 40));
    check('G-boot-1: row 1 shows its planner letter badge as a manual choice; row 3 is not manual', rows[0].manual && rows[0].type === 'char' && !rows[2].manual);
    check('G-boot-1: no console errors', g.errors.length === 0, g.errors.join(' | '));
  });

  /* ------------------------------------------------------------ G-boot-2 + G-store-1 */
  await scenario('G-boot-2', async (S) => {
    const ord = ORDINARY(['ordinary one', 'ordinary two']);
    await S.seed({ 'edgelabel.autosave.v1': ord });
    const job = mkJob([{ t: 'One' }, { t: 'Weird', b: { type: 'icon', value: 'not-an-icon' } }, { t: 'Three' }]);
    const g = await S.openGen(jobUrl(job));
    await S.setText(g, 0, 'One edited');
    await g.click('#add-label');
    await g.ev(`(() => { const i = document.querySelectorAll('#labels .row input.label-text'); const x = i[i.length - 1]; x.value = 'extra label'; x.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await g.ev(`(() => { const e = document.getElementById('bed-w'); e.value = '123'; e.dispatchEvent(new Event('input', { bubbles: true })); const t = document.getElementById('text-depth'); t.value = '0.8'; t.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(1200);
    const before = await S.rows(g);
    await g.reload();
    await g.waitFor(`!document.getElementById('download').disabled`);
    const after = await S.rows(g);
    check('G-boot-2: reload restores the LINKED session: rows, tags, edits and the extra', JSON.stringify(before) === JSON.stringify(after) && after.length === 4 && after[0].text === 'One edited' && after[3].text === 'extra label' && after[3].u === null, JSON.stringify(after));
    check('G-boot-2: the held badge is still held, byte for byte', after[1].held === JSON.stringify({ type: 'icon', value: 'not-an-icon' }), after[1].held);
    check('G-boot-2: ALL settings restored (bed width 123 and depth 0.8 - a linked tab never reads the ordinary autosave)', (await g.ev(`document.getElementById('bed-w').value + '|' + document.getElementById('text-depth').value`)) === '123|0.8');
    check('G-boot-2: still linked, and it said hello again after the reload', (await g.ev(`document.getElementById('link-bar').classList.contains('linked')`)) && (await S.log()).filter((x) => x.d.gen2label === 'hello').length >= 2);
    check('G-store-1: the ordinary autosave is BYTE-IDENTICAL after edits, an extra, a settings change and a reload', (await S.ls(g, 'edgelabel.autosave.v1')) === ord);
  });

  /* ------------------------------------------------------------ G-boot-3 + G-backup-1 (legacy into linked) */
  await scenario('G-boot-3', async (S) => {
    const job = mkJob([{ t: 'One' }, { t: 'Two' }]);
    const g = await S.openGen(jobUrl(job));
    await S.setText(g, 0, 'One edited');
    // a legacy one-way link into the linked tab (the same named window: a fragment navigation -> hashchange)
    await S.stub.ev(`openGen(${JSON.stringify(legacyUrl(['Legacy A', 'Legacy B', 'Legacy C']))}, 'gen')`);
    await g.waitFor(`document.querySelectorAll('#labels .row').length === 3 && !document.getElementById('link-send').offsetParent`);
    const rows = await S.rows(g);
    check('G-boot-3: a legacy-only hash into a linked tab is a ONE-WAY import (three plain rows, no tags)', rows.map((r) => r.text).join() === 'Legacy A,Legacy B,Legacy C' && rows.every((r) => r.tag === null), JSON.stringify(rows));
    check('G-boot-3: the link is PAUSED and says so, with a Resume button', /paused/.test(await S.barText(g)) && (await g.ev(`!document.getElementById('link-resume').hidden`)), await S.barText(g));
    check('G-boot-3: the status names the pause', /paused: Resume it/.test(await S.status(g)), await S.status(g));
    check('G-boot-3: the paused session is kept in sessionStorage', JSON.parse(await S.ss(g, 'edgelabel.linked.v1')).paused === true);
    check('G-boot-3: the hash is cleared', (await g.ev('location.hash')) === '');
    await sleep(1100);   // the ordinary autosave is debounced (800 ms), as it has always been
    await g.reload();
    await g.waitFor(`!document.getElementById('download').disabled`);
    check('G-boot-3: a reload does NOT restore the paused link (the one-way set is the ordinary session) and still offers Resume', (await S.rows(g)).map((r) => r.text).join() === 'Legacy A,Legacy B,Legacy C' && (await g.ev(`!document.getElementById('link-resume').hidden`)));
    await g.click('#link-resume');
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    const back = await S.rows(g);
    check('G-boot-3: Resume brings the linked session back exactly (edits and tags)', back.length === 2 && back[0].text === 'One edited' && back[0].tag === '#1', JSON.stringify(back));
    const ord = JSON.parse(await S.ls(g, 'edgelabel.autosave.v1'));
    check('G-boot-3: the one-way set it displaced is in the ordinary autosave (switching back is lossless)', ord.labels.map((l) => l.text).join() === 'Legacy A,Legacy B,Legacy C', JSON.stringify(ord.labels.map((l) => l.text)));
  });
  await scenario('G-boot-3b', async (S) => {
    // the same at BOOT: navigate the linked tab away and back with a legacy-only URL
    const job = mkJob([{ t: 'One' }, { t: 'Two' }]);
    const g = await S.openGen(jobUrl(job));
    await S.setText(g, 1, 'Two edited');
    await sleep(900);
    await g.goto('about:blank');
    await g.goto(legacyUrl(['Boot A', 'Boot B']));
    await g.waitFor(`!document.getElementById('download').disabled`);
    check('G-boot-3b: a legacy-only hash at boot imports one-way and pauses the stored link', (await S.rows(g)).map((r) => r.text).join() === 'Boot A,Boot B' && /paused/.test(await S.barText(g)) && JSON.parse(await S.ss(g, 'edgelabel.linked.v1')).paused === true, await S.barText(g));
  });

  /* ------------------------------------------------------------ G-boot-4: a second tab never sees the first tab's session */
  await scenario('G-boot-4', async (S) => {
    const job = mkJob([{ t: 'Only in tab one' }]);
    const g = await S.openGen(jobUrl(job));
    await S.setText(g, 0, 'Only in tab one!');
    await sleep(900);
    const other = await b.newPage(GEN, S.ctx);
    await other.waitFor(`!document.getElementById('download').disabled`);
    const rows = await S.rows(other);
    check('G-boot-4: a second tab (fresh sessionStorage) is the ORDINARY page: no link bar, no tags, nothing of the first tab\'s session', (await S.barText(other)) === null && rows.every((r) => r.tag === null && !/Only in tab one/.test(r.text)), JSON.stringify(rows));
    check('G-boot-4: the first tab is still linked', (await g.ev(`document.getElementById('link-bar').classList.contains('linked')`)));
    await other.close();
  });

  /* ------------------------------------------------------------ G-boot-5: a new job into a tab with unsaved work */
  await scenario('G-boot-5', async (S) => {
    const job1 = mkJob([{ t: 'One' }, { t: 'Two' }], { jobId: ID('a') });
    const g = await S.openGen(jobUrl(job1));
    await S.setText(g, 0, 'One EDITED');
    const job2 = mkJob([{ t: 'New one' }, { t: 'New two' }, { t: 'New three' }], { jobId: ID('c') });
    await S.stub.ev(`openGen(${JSON.stringify(jobUrl(job2))}, 'gen')`);
    await g.waitFor(`!document.getElementById('gen-modal').hidden`);
    check('G-boot-5: a newer job into a tab with unsaved edits ASKS (three choices), nothing replaced yet', (await g.ev(`[...document.querySelectorAll('#gm-buttons button')].map(b => b.textContent).join('|')`)) === "Send mine first|Replace with the planner's|Cancel" && (await S.rows(g)).length === 2);
    await g.click('#gm-buttons button:nth-child(2)');
    await g.waitFor(`document.querySelectorAll('#labels .row').length === 3`);
    const rows = await S.rows(g);
    check('G-boot-5: Replace loads the new job', rows.map((r) => r.text).join() === 'New one,New two,New three' && rows[0].tag === '#1');
    const prev = JSON.parse(await S.ls(g, 'edgelabel.autosave.v1.before-import'));
    check('G-boot-5: the old linked labels are the PREVIOUS SET (edits included, tags dropped)', prev.labels.map((l) => l.text).join() === 'One EDITED,Two' && prev.labels.every((l) => l.u === undefined), JSON.stringify(prev.labels));
    check('G-boot-5: the Previous set button shows', await g.ev(`document.getElementById('proj-restore').style.display !== 'none'`));
  });
  await scenario('G-boot-5b', async (S) => {
    // Cancel keeps the session; and an UNEDITED tab takes the new job quietly
    const job1 = mkJob([{ t: 'One' }], { jobId: ID('a') });
    const g = await S.openGen(jobUrl(job1));
    const job2 = mkJob([{ t: 'Two' }], { jobId: ID('c') });
    await S.stub.ev(`openGen(${JSON.stringify(jobUrl(job2))}, 'gen')`);
    await g.waitFor(`document.querySelectorAll('#labels .row input.label-text')[0].value === 'Two'`);
    check('G-boot-5b: an unedited linked tab takes the newer job without asking ("Updated from the planner")', (await S.status(g)) === 'Updated from the planner.' && (await g.ev(`document.getElementById('gen-modal').hidden`)));
    await S.setText(g, 0, 'Two edited');
    const job3 = mkJob([{ t: 'Three' }], { jobId: ID('d') });
    await S.stub.ev(`openGen(${JSON.stringify(jobUrl(job3))}, 'gen')`);
    await g.waitFor(`!document.getElementById('gen-modal').hidden`);
    await g.click('#gm-buttons button:nth-child(3)');
    await sleep(300);
    check('G-boot-5b: Cancel keeps the current labels and says how to reload', (await S.rows(g))[0].text === 'Two edited' && /Click the planner's button again/.test(await S.status(g)), await S.status(g));
  });
  await scenario('G-boot-5c', async (S) => {
    // at BOOT: a new job over a stored linked session with unsaved work -> backup + status
    const job1 = mkJob([{ t: 'One' }], { jobId: ID('a') });
    const g = await S.openGen(jobUrl(job1));
    await S.setText(g, 0, 'One EDITED');
    await sleep(900);
    await g.goto('about:blank');
    await g.goto(jobUrl(mkJob([{ t: 'Fresh' }], { jobId: ID('e') })));
    await g.waitFor(`!document.getElementById('download').disabled`);
    check('G-boot-5c: a new job hash at boot loads it, backs up the edited linked session, and says so', (await S.rows(g))[0].text === 'Fresh' && /earlier linked labels were kept/.test(await S.status(g)) && JSON.parse(await S.ls(g, 'edgelabel.autosave.v1.before-import')).labels[0].text === 'One EDITED', await S.status(g));
  });

  /* ------------------------------------------------------------ G-boot-6: settings precedence */
  await scenario('G-boot-6', async (S) => {
    const ord = ORDINARY(['saved one']);
    await S.seed({ 'edgelabel.autosave.v1': ord });
    const job = mkJob([{ t: 'Job one' }], { style: style({ capMm: 4.5, depth: 0.8, bold: false, allCaps: false, predictIcons: true, badgeSize: 12 }) });
    const g = await S.openGen(jobUrl(job));
    const v = await g.ev(`['font-size','text-depth','badge-size','bold-text','all-caps','predict-icons','bed-w','bed-l','export-format','color-base'].map(id => { const e = document.getElementById(id); return id + '=' + (e.type === 'checkbox' ? e.checked : e.value); }).join(' ')`);
    check('G-boot-6: label style comes from the JOB (it beats the saved one)', /font-size=4\.5 text-depth=0\.8 badge-size=12 bold-text=false all-caps=false predict-icons=true/.test(v), v);
    check('G-boot-6: printer preferences stay LOCAL (bed, format, colours from the ordinary autosave)', /bed-w=300 bed-l=200 export-format=stl color-base=#112233/.test(v), v);
    check('G-boot-6: the ordinary autosave is untouched', (await S.ls(g, 'edgelabel.autosave.v1')) === ord);
    check('G-boot-6: the job\'s drawer is in the list, no saved label was imported', (await S.rows(g)).map((r) => r.text).join() === 'Job one');
  });

  /* ------------------------------------------------------------ G-backup-1: the legacy hand-off, exactly as small-fixes */
  await scenario('G-backup-1', async (S) => {
    const ord = ORDINARY(['OLD ONE', 'Old Two']);
    await S.seed({ 'edgelabel.autosave.v1': ord });
    const g = await S.openGen(legacyUrl(['Torx Bits', 'M3 Nuts', 'Washers']));
    check('G-backup-1: the legacy hand-off imports the three labels', (await S.rows(g)).map((r) => r.text).join() === 'Torx Bits,M3 Nuts,Washers');
    check('G-backup-1: no link bar (a one-way import)', (await S.barText(g)) === null);
    check('G-backup-1: the previous set is KEPT and the status says so', /Your previous set is kept: Save \/ Load › Previous set/.test(await S.status(g)) && (await g.ev(`document.getElementById('proj-restore').style.display !== 'none'`)), await S.status(g));
    check('G-backup-1: the saved settings carry over (3 mm text, bold on, 300 x 200 plate, STL)', (await g.ev(`['font-size','bold-text','bed-w','export-format'].map(id => { const e = document.getElementById(id); return e.type === 'checkbox' ? e.checked : e.value; }).join()`)) === '3,true,300,stl');
    check('G-backup-1: the hash is cleared', (await g.ev('location.hash')) === '');
    await g.click('#proj-restore');
    await sleep(300);
    check('G-backup-1: Previous set swaps to the old labels, and back again', (await S.rows(g)).map((r) => r.text).join() === 'OLD ONE,Old Two' && (await g.click('#proj-restore'), await sleep(300), (await S.rows(g)).map((r) => r.text).join() === 'Torx Bits,M3 Nuts,Washers'));
  });

  /* ------------------------------------------------------------ G-backup-2: Unlink */
  await scenario('G-backup-2', async (S) => {
    const ord = ORDINARY(['ordinary one']);
    await S.seed({ 'edgelabel.autosave.v1': ord });
    const job = mkJob([{ t: 'One' }, { t: 'Weird', b: { type: 'icon', value: 'not-an-icon' } }]);
    const g = await S.openGen(jobUrl(job));
    await S.setText(g, 0, 'One edited');
    await g.click('#link-unlink');
    await sleep(500);
    const rows = await S.rows(g);
    check('G-backup-2: Unlink drops the tags and the link bar', rows.every((r) => r.tag === null && r.u === null) && (await S.barText(g)) === null && (await S.ss(g, 'edgelabel.linked.v1')) === null, JSON.stringify(rows));
    check('G-backup-2: the previous ORDINARY session is the Previous set', JSON.parse(await S.ls(g, 'edgelabel.autosave.v1.before-import')).labels[0].text === 'ordinary one' && /previous labels are kept/.test(await S.status(g)), await S.status(g));
    const auto = JSON.parse(await S.ls(g, 'edgelabel.autosave.v1'));
    check('G-backup-2: the linked project is now the ORDINARY autosave (edits and the held icon as its id; settings too)', auto.labels[0].text === 'One edited' && auto.labels[1].badge.value === 'not-an-icon' && auto.labels.every((l) => l.u === undefined && l.held === undefined), JSON.stringify(auto.labels));
    check('G-backup-2: from now on it autosaves again', await (async () => { await S.setText(g, 0, 'after unlink'); await sleep(1100); return JSON.parse(await S.ls(g, 'edgelabel.autosave.v1')).labels[0].text === 'after unlink'; })());
    check('G-backup-2: rows are no longer capped at 40', (await S.rows(g)).every((r) => r.max === 48));
  });

  /* ------------------------------------------------------------ G-backup-3: &amp; and &#34; survive (section 7.11) */
  await scenario('G-backup-3', async (S) => {
    const tricky = ['A &amp; B', 'say &#34;hi&#34;', '<b>bold</b> & "quoted"'];
    const g = await S.openGen(legacyUrl(tricky));
    check('G-backup-3: a legacy import keeps `&amp;`, `&#34;` and markup as typed', JSON.stringify((await S.rows(g)).map((r) => r.text)) === JSON.stringify(tricky), JSON.stringify((await S.rows(g)).map((r) => r.text)));
    await sleep(1100);
    await g.reload();
    await g.waitFor(`!document.getElementById('download').disabled`);
    check('G-backup-3: a restore keeps them', JSON.stringify((await S.rows(g)).map((r) => r.text)) === JSON.stringify(tricky));
    await g.ev(`applyProject({ fmt: 'edgelabel-set', v: 1, labels: ${JSON.stringify(tricky.map((t) => ({ text: t, badge: { type: 'none' }, manual: false })))}, settings: {} })`);
    check('G-backup-3: an Upload (applyProject) keeps them', JSON.stringify((await S.rows(g)).map((r) => r.text)) === JSON.stringify(tricky));
    const jg = await S.openGen(jobUrl(mkJob(tricky.map((t) => ({ t }))), null), { name: 'gen2' });
    check('G-backup-3: a linked import keeps them, and an unedited send returns them exactly', JSON.stringify((await S.rows(jg)).map((r) => r.text)) === JSON.stringify(tricky));
  });

  /* ------------------------------------------------------------ the send flow (section 5.2 / 5.3 / 7.5) */
  const returnsOf = (log) => log.filter((x) => x.d.gen2label === 'return');
  const appliedFor = (ret, rows, o = {}) => ({ gen2label: 'applied', v: 1, jobId: ret.jobId, returnId: ret.returnId, baseRev: ID('q'), rows, gone: [], style: style(), styleDecision: {}, changes: 1, ...o });
  const say = (S, msg) => S.stub.ev(`say(${JSON.stringify(msg)})`);
  const unsavedRows = (g) => g.ev(`GEN2EdgeLabelLink.isUnsaved(link, allSnaps(), currentStyle(), { iconIds: iconIds() }).rows`);

  await scenario('G-send-A', async (S) => {
    const job = mkJob([{ t: 'One' }, { t: 'Two' }, { t: '' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 3 });
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    await S.setText(g, 0, 'One EDITED');
    await g.ev(`(() => { const e = document.getElementById('font-size'); e.value = '4.5'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await sleep(500);
    await g.click('#link-send');
    await g.waitFor(`!document.getElementById('send-veil').hidden`);
    check('G-send-A: Send shows the veil, pauses editing (the sidebar is inert), and posts ONE return to the planner', (await g.ev(`document.getElementById('sidebar').inert`)) && /Sending to the planner/.test(await g.ev(`document.getElementById('veil-text').textContent`)));
    await sleep(400);
    const log = await S.log();
    const ret = returnsOf(log)[0].d;
    check('G-send-A: the return carries every linked row, the raw text, null badges (not manual), the style and no extras', ret.rows.length === 3 && ret.rows[0].t === 'One EDITED' && ret.rows.every((r) => r.b === null) && ret.style.capMm === 4.5 && ret.extras === 0 && ret.baseRev === job.baseRev && ret.jobId === job.jobId && ret.buildId === job.buildId && ret.family === 'edgelabel', JSON.stringify(ret).slice(0, 300));
    check('G-send-A: it came from the generator\'s own window and origin', returnsOf(log)[0].fromGen && returnsOf(log)[0].origin === `http://localhost:${GP}`);
    // `received` -> reviewing; then WAIT past the 6 s send timeout: human review is never timed out
    await say(S, { gen2label: 'received', v: 1, jobId: job.jobId, returnId: ret.returnId });
    await g.waitFor(`/Review the changes in your planner tab/.test(document.getElementById('veil-text').textContent)`);
    await sleep(8000);
    check('G-send-A: 8 s into review the veil is STILL up (no review timeout) and the generator did not re-send', !(await g.ev(`document.getElementById('send-veil').hidden`)) && returnsOf(await S.log()).length === 1);
    await say(S, appliedFor(ret, [{ u: 1, t: 'One EDITED', b: null, decision: 'applied' }, { u: 2, t: 'Two', b: null, decision: 'unchanged' }, { u: 3, t: '', b: null, decision: 'unchanged' }], { style: style({ capMm: 4.5 }), changes: 2 }));
    await g.waitFor(`document.getElementById('send-veil').hidden`);
    check('G-send-A: `applied` ends the wait, says "Saved to the planner (2 changes)", and the sidebar is editable again', /Saved to the planner \(2 changes\)/.test(await S.status(g)) && !(await g.ev(`document.getElementById('sidebar').inert`)), await S.status(g));
    check('G-send-A: the session\'s baseline moved: Send is enabled and there is no pending return', await g.ev(`link.baseRev === ${JSON.stringify(ID('q'))} && link.pending === null && !document.getElementById('link-send').disabled`));
    check('G-send-A: the style input follows the answer (4.5)', (await g.ev(`document.getElementById('font-size').value`)) === '4.5');
    const stored = JSON.parse(await S.ss(g, 'edgelabel.linked.v1'));
    check('G-send-A: the linked session was saved with the new baseline and no pending', stored.baseRev === ID('q') && stored.pending === null && stored.baseline.rows[0].t === 'One EDITED');
    check('G-send-A: no console errors', g.errors.length === 0, g.errors.join(' | '));
  });

  await scenario('G-send-B', async (S) => {
    // no `received`: three sends two seconds apart with the SAME returnId, then "didn't answer" and the pending return is abandoned
    const job = mkJob([{ t: 'One' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 1 });
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    await S.setText(g, 0, 'One!');
    await g.click('#link-send');
    await g.waitFor(`document.getElementById('send-veil').hidden`, { timeoutMs: 12000 });
    const rets = returnsOf(await S.log());
    check('G-send-B: three sends of ONE returnId, then the veil drops', rets.length === 3 && new Set(rets.map((r) => r.d.returnId)).size === 1, String(rets.length));
    check('G-send-B: the message says the planner tab did not answer and that labels are unchanged here', /The planner tab didn't answer\. If it was updated or reloaded, reload it, then Send again\. Your labels are unchanged here\./.test(await S.status(g)), await S.status(g));
    check('G-send-B: the pending return is abandoned, the rows are untouched', (await g.ev(`link.pending.state`)) === 'abandoned' && (await S.rows(g))[0].text === 'One!');
    await g.click('#link-send');
    await sleep(500);
    const again = returnsOf(await S.log());
    check('G-send-B: a manual Send of the IDENTICAL payload re-uses the returnId', again.length === 4 && again[3].d.returnId === rets[0].d.returnId);
    await g.waitFor(`document.getElementById('send-veil').hidden`, { timeoutMs: 12000 });
    await S.setText(g, 0, 'One!!');
    await g.click('#link-send');
    await sleep(500);
    const third = returnsOf(await S.log());
    check('G-send-B: a Send after an edit mints a NEW returnId', third[third.length - 1].d.returnId !== rets[0].d.returnId);
  });

  await scenario('G-send-C', async (S) => {
    // Stop waiting -> abandoned; a late applied with NO edits since is adopted; with edits it is status-only and baseRev stays
    const job = mkJob([{ t: 'One' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 1 });
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    await S.setText(g, 0, 'One!');
    await g.click('#link-send');
    await sleep(400);
    const ret = returnsOf(await S.log())[0].d;
    await say(S, { gen2label: 'received', v: 1, jobId: job.jobId, returnId: ret.returnId });
    await g.waitFor(`/Review the changes/.test(document.getElementById('veil-text').textContent)`);
    await g.click('#veil-stop');
    check('G-send-C: Stop waiting abandons the send and re-enables editing', (await g.ev(`link.pending.state`)) === 'abandoned' && !(await g.ev(`document.getElementById('sidebar').inert`)));
    await say(S, appliedFor(ret, [{ u: 1, t: 'One!', b: null, decision: 'applied' }]));
    await g.waitFor(`link.baseRev === ${JSON.stringify(ID('q'))}`);
    check('G-send-C: a late `applied` with nothing edited since is ADOPTED (baseRev moved)', /Saved to the planner/.test(await S.status(g)));
    // second pass: abandon, edit, then the late answer is status-only
    await S.setText(g, 0, 'One!!');
    await g.click('#link-send');
    await sleep(400);
    const ret2 = returnsOf(await S.log()).pop().d;
    await g.click('#veil-stop');
    await S.setText(g, 0, 'One!!!');
    await say(S, appliedFor(ret2, [{ u: 1, t: 'One!!', b: null, decision: 'applied' }], { baseRev: ID('z') }));
    await g.waitFor(`/applied your earlier send/.test(document.getElementById('status').textContent)`);
    check('G-send-C: with newer edits the late answer is STATUS ONLY: edits kept, baseRev unchanged', (await S.rows(g))[0].text === 'One!!!' && (await g.ev(`link.baseRev`)) === ID('q'), await g.ev(`link.baseRev`));
  });

  await scenario('G-send-D', async (S) => {
    // `cancelled` / `refused` straight after Send (its `received` lost) are handled as from reviewing; not-applied rows keep local edits
    const job = mkJob([{ t: 'One' }, { t: 'Two' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 2 });
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    await S.setText(g, 0, 'One!');
    await S.setText(g, 1, 'Two!');
    await g.click('#link-send');
    await sleep(400);
    const ret = returnsOf(await S.log())[0].d;
    await say(S, { gen2label: 'cancelled', v: 1, jobId: job.jobId, returnId: ret.returnId });
    await g.waitFor(`document.getElementById('send-veil').hidden`);
    check('G-send-D: `cancelled` (without a prior received) changes NOTHING and says so', (await S.rows(g)).map((r) => r.text).join() === 'One!,Two!' && /Not applied\. Your labels are unchanged here/.test(await S.status(g)) && (await g.ev(`link.pending`)) === null);
    await g.click('#link-send');
    await sleep(400);
    const ret2 = returnsOf(await S.log()).pop().d;
    await say(S, appliedFor(ret2, [{ u: 1, t: 'One', b: null, decision: 'not-applied' }, { u: 2, t: 'Two!', b: null, decision: 'applied' }], { changes: 1 }));
    await g.waitFor(`link.baseRev === ${JSON.stringify(ID('q'))}`);
    check('G-send-D: a `not-applied` row KEEPS the local edit (it is offered again); the applied one follows the planner', (await S.rows(g)).map((r) => r.text).join() === 'One!,Two!');
    check('G-send-D: that kept edit is still unsaved work, so the next send lists it', await unsavedRows(g));
    await g.click('#link-send');
    await sleep(400);
    const ret3 = returnsOf(await S.log()).pop().d;
    await say(S, { gen2label: 'refused', v: 1, jobId: job.jobId, returnId: ret3.returnId, reason: 'other-build' });
    await g.waitFor(`document.getElementById('send-veil').hidden`);
    check('G-send-D: `refused other-build` explains in words, disables Send and keeps the rows', /Your planner now shows a different build/.test(await S.status(g)) && (await g.ev(`document.getElementById('link-send').disabled`)) && /different build/.test(await S.barText(g)));
  });

  await scenario('G-send-E', async (S) => {
    // reload with a send in flight: the pending return is resent with its SAME returnId and the veil returns
    const job = mkJob([{ t: 'One' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 1 });
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    await S.setText(g, 0, 'One!');
    await g.click('#link-send');
    await sleep(500);
    const ret = returnsOf(await S.log())[0].d;
    await say(S, { gen2label: 'received', v: 1, jobId: job.jobId, returnId: ret.returnId });
    await g.waitFor(`/Review the changes/.test(document.getElementById('veil-text').textContent)`);
    await sleep(500);
    await g.reload();
    await g.waitFor(`!document.getElementById('download').disabled`);
    await sleep(600);
    const rets = returnsOf(await S.log());
    check('G-send-E: after a reload mid-review the SAME return was sent again (same returnId)', rets.length >= 2 && rets[rets.length - 1].d.returnId === ret.returnId, String(rets.length));
    check('G-send-E: the veil is back and the edit is still there', !(await g.ev(`document.getElementById('send-veil').hidden`)) && (await S.rows(g))[0].text === 'One!');
    await say(S, { gen2label: 'cancelled', v: 1, jobId: job.jobId, returnId: ret.returnId });
    await g.waitFor(`document.getElementById('send-veil').hidden`);
  });

  /* ------------------------------------------------------------ authentication (section 5.1) */
  await scenario('G-auth-1', async (S) => {
    const job = mkJob([{ t: 'One' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 1 });
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    await S.setText(g, 0, 'One!');
    await g.click('#link-send');
    await sleep(500);
    const ret = returnsOf(await S.log())[0].d;
    const forged = appliedFor(ret, [{ u: 1, t: 'FORGED', b: null, decision: 'applied' }], { baseRev: ID('f') });
    // (a) the planner's ORIGIN but a DIFFERENT window (same origin as the stub, not the opener); (b) another ORIGIN, holding a reference
    // to the generator through the window name. Both post a well-formed `applied` for the pending returnId.
    await S.stub.ev(`window.open('http://localhost:${SP}/stub-planner.html', 'helper-same'); window.open('http://127.0.0.1:${SP}/stub-planner.html', 'helper-other'); 1`);
    await sleep(1500);
    const helpers = (await b.pages()).filter((x) => x.url.includes(`:${SP}/stub-planner.html`) && x.targetId !== S.stub.targetId);
    check('G-auth-1: two helper windows exist (same origin, other origin)', helpers.length === 2, String(helpers.length));
    for (const hp of helpers.filter((h) => !process.env.ONLY || h.url.includes(process.env.ONLY))) {
      const hpg = await b.attach(hp.targetId);
      const r = await hpg.ev(`(() => { const w = window.open('', 'gen'); const info = { loc: location.href, isOpener: w === window.opener, isSelf: w === window, got: !!w }; if (w) w.postMessage(${JSON.stringify(forged)}, 'http://localhost:${GP}'); return info; })()`).catch((e) => String(e));
      if (process.env.DBG) console.log('HELPER', JSON.stringify(r));
      void r;
    }
    await sleep(800);
    check('G-auth-1: an `applied` posted by another window (same origin, not the opener) or from another origin is IGNORED', (await S.rows(g))[0].text === 'One!' && (await g.ev(`link.baseRev`)) === job.baseRev, JSON.stringify({ rows: await S.rows(g), baseRev: await g.ev(`link.baseRev`), pending: await g.ev(`link.pending && link.pending.state`) }));
    await say(S, { ...forged, jobId: ID('w') });
    await sleep(500);
    check('G-auth-1: the right window with the wrong jobId is ignored', (await g.ev(`link.baseRev`)) === job.baseRev);
    // Chrome re-points window.opener at a window that re-targets this one by name (window.open('', 'gen')) - the helpers just did
    // that. The generator must keep trusting the window that really opened it (captured at load), so the REAL planner still works:
    await say(S, { gen2label: 'cancelled', v: 1, jobId: job.jobId, returnId: ret.returnId });
    await g.waitFor(`document.getElementById('send-veil').hidden`);
    check("G-auth-1: after the helpers took window.opener, the real planner's `cancelled` is still honoured", /Not applied/.test(await S.status(g)), await S.status(g));
  });

  await scenario('G-auth-2', async (S) => {
    // a job naming an origin that is not the Planner's is NOT linked (it falls through, with the reason); nothing is posted anywhere
    const evil = mkJob([{ t: 'One' }], { origin: 'https://evil.example' });
    const g = await S.openGen(jobUrl(evil, ['One']), { drawers: 1 });
    check('G-auth-2: a job from a foreign origin is not linked: one-way import of its labels, no bar', (await S.barText(g)) === null && (await S.rows(g)).map((r) => r.text).join() === 'One' && /one-way import/.test(await S.status(g)), await S.status(g));
    check('G-auth-2: nothing was posted to the opener', (await S.log()).length === 0);
  });

  await scenario('G-auth-3', async (S) => {
    // no opener at all (a plain navigation): the bar says so at once, Send is disabled, and nothing is posted
    const job = mkJob([{ t: 'One' }]);
    const t = await b.newPage(jobUrl(job), S.ctx);
    await t.waitFor(`!document.getElementById('download').disabled`);
    check('G-auth-3: no window.opener -> "Not connected to a planner tab", Send disabled', /Not connected to a planner tab/.test(await S.barText(t)) && (await t.ev(`document.getElementById('link-send').disabled`)));
    check('G-auth-3: the labels are still there', (await S.rows(t))[0].text === 'One');
    await t.close();
  });

  await scenario('G-auth-4', async (S) => {
    // the planner never answers hello: 4 hellos one second apart, then no-planner; "Try connecting again" says hello again
    const job = mkJob([{ t: 'One' }]);
    const g = await S.openGen(jobUrl(job), { ack: false });
    await g.waitFor(`/Not connected to a planner tab/.test(document.getElementById('link-bar').textContent)`, { timeoutMs: 12000 });
    const hellos = (await S.log()).filter((x) => x.d.gen2label === 'hello');
    check('G-auth-4: exactly 4 hellos, then no-planner', hellos.length === 4, String(hellos.length));
    check('G-auth-4: Send is disabled, the retry button shows', await g.ev(`document.getElementById('link-send').disabled && !document.getElementById('link-retry').hidden`));
    await S.stub.ev(`window.__auto.ack = true`);
    await g.click('#link-retry');
    await g.waitFor(`document.getElementById('link-bar').classList.contains('linked')`);
    check('G-auth-4: after the planner answers, "Try connecting again" links', true);
  });

  /* ------------------------------------------------------------ rows: held, icon-only, over-limit, clearing, deleting (section 7.3 - 7.8) */
  await scenario('G-rows-1', async (S) => {
    const job = mkJob([{ t: 'Weird', b: { type: 'icon', value: 'not-an-icon' } }, { t: 'Nut', b: { type: 'icon', value: 'nut' } }]);
    const g = await S.openGen(jobUrl(job), { drawers: 2 });
    const info = await g.ev(`[...document.querySelectorAll('#labels .row .badge-btn')].map(b => ({ t: b.textContent, held: b.classList.contains('held'), title: b.title }))`);
    check('G-rows-1: an unknown planner icon shows `?` with the explanation (held), a known one shows its icon', info[0].t === '?' && info[0].held && /isn't in this generator version/.test(info[0].title) && info[1].t !== '?' && !info[1].held, JSON.stringify(info));
    check('G-rows-1: the bar counts the held drawers', /1 drawer has an icon from the planner that this generator can't show/.test(await g.ev(`document.getElementById('lb-sub').textContent`)), await g.ev(`document.getElementById('lb-sub').textContent`));
    await g.click('#link-send');
    await sleep(500);
    const ret = returnsOf(await S.log())[0].d;
    check('G-rows-1: an unedited Send returns the held icon BYTE-FOR-BYTE, not null', JSON.stringify(ret.rows[0].b) === JSON.stringify({ type: 'icon', value: 'not-an-icon' }) && JSON.stringify(ret.rows[1].b) === JSON.stringify({ type: 'icon', value: 'nut' }), JSON.stringify(ret.rows.map((r) => r.b)));
    await say(S, { gen2label: 'cancelled', v: 1, jobId: job.jobId, returnId: ret.returnId });
    await g.waitFor(`document.getElementById('send-veil').hidden`);
    // picking a badge on the held row ends the hold
    await g.click('#labels .row:nth-child(1) .badge-btn');
    await g.click('#bp-none');
    await sleep(300);
    const row = (await S.rows(g))[0];
    check('G-rows-1: picking "No badge" on the held row ends the hold; it now returns {type:none}', row.held === null && row.manual && row.type === 'none');
    await g.click('#link-send');
    await sleep(500);
    check('G-rows-1: ...and the next return says so', JSON.stringify(returnsOf(await S.log()).pop().d.rows[0].b) === JSON.stringify({ type: 'none' }));
  });

  await scenario('G-rows-2', async (S) => {
    // clearing a linked row's words clears its badge (back to not-manual); an icon-only row is flagged and returns `unsupplied`
    const job = mkJob([{ t: 'Letter', b: { type: 'char', value: 'Q' } }, { t: '' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 2 });
    await S.setText(g, 0, '');
    const r0 = (await S.rows(g))[0];
    check('G-rows-2: clearing a linked row\'s words resets its badge (not manual, none)', r0.manual === false && r0.type === 'none', JSON.stringify(r0));
    await g.click('#labels .row:nth-child(2) .badge-btn');
    await g.ev(`(() => { const i = document.getElementById('bp-char'); i.value = 'Z'; document.getElementById('bp-char-apply').click(); })()`);
    await sleep(400);
    const r1 = (await S.rows(g))[1];
    check('G-rows-2: a letter on an EMPTY row is an icon-only label, flagged in the row', r1.type === 'char' && /Icon only - printed here, not saved to the planner/.test(r1.note || ''), JSON.stringify(r1));
    await g.click('#link-send');
    await sleep(500);
    const ret = returnsOf(await S.log())[0].d;
    check('G-rows-2: the return has t:"" b:null for the cleared row and unsupplied/icon-only for the other', ret.rows[0].t === '' && ret.rows[0].b === null && JSON.stringify(ret.rows[1].b) === JSON.stringify({ type: 'unsupplied', why: 'icon-only' }), JSON.stringify(ret.rows));
    await say(S, appliedFor(ret, [{ u: 1, t: '', b: null, decision: 'applied' }, { u: 2, t: '', b: null, decision: 'unchanged' }]));
    await g.waitFor(`link.baseRev === ${JSON.stringify(ID('q'))}`);
    const after = (await S.rows(g))[1];
    check('G-rows-2: applying the planner\'s answer NEVER erases an icon-only badge', after.type === 'char' && after.manual, JSON.stringify(after));
  });

  await scenario('G-rows-3', async (S) => {
    // over the planner's limit: the bulk prefix can push a linked row past 40 (maxlength does not limit script writes); extras keep 48
    const job = mkJob([{ t: 'x'.repeat(38) }]);
    const g = await S.openGen(jobUrl(job), { drawers: 1 });
    await g.ev(`document.querySelector('#labels .row .row-sel').click()`);
    await g.click('#bulk-affix');
    await g.type('#affix-pre', 'ABCD');
    await g.click('#affix-apply');
    await sleep(500);
    const r = (await S.rows(g))[0];
    check('G-rows-3: a linked row pushed past 40 shows "42 / 40 - the planner keeps the first 40"', r.text.length === 42 && /42 \/ 40 - the planner keeps the first 40/.test(r.note || ''), JSON.stringify(r));
    await g.click('#add-label');
    check('G-rows-3: an added (extra) row keeps the generator\'s own 48', (await S.rows(g)).pop().max === 48);
  });

  await scenario('G-rows-4', async (S) => {
    // deleting a linked row asks (section 7.6): Don't print it removes the row; Clear its label keeps it empty; Cancel nothing
    const job = mkJob([{ t: 'One' }, { t: 'Two' }, { t: 'Three' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 3 });
    await g.click('#labels .row:nth-child(1) .remove');
    await g.waitFor(`!document.getElementById('gen-modal').hidden`);
    check('G-rows-4: the × on a linked row asks with three choices', (await g.ev(`[...document.querySelectorAll('#gm-buttons button')].map(b => b.textContent).join('|')`)) === "Don't print it|Clear its label|Cancel");
    await g.click('#gm-buttons button:nth-child(3)');
    await sleep(200);
    check('G-rows-4: Cancel changes nothing', (await S.rows(g)).length === 3);
    await g.click('#labels .row:nth-child(1) .remove');
    await g.waitFor(`!document.getElementById('gen-modal').hidden`);
    await g.click('#gm-buttons button:nth-child(2)');
    await sleep(300);
    check('G-rows-4: Clear its label empties the text and KEEPS the row (it will return a clear)', (await S.rows(g)).map((r) => r.text).join('|') === '|Two|Three');
    await g.click('#labels .row:nth-child(2) .remove');
    await g.waitFor(`!document.getElementById('gen-modal').hidden`);
    await g.click('#gm-buttons button:nth-child(1)');
    await sleep(300);
    check('G-rows-4: Don\'t print it removes the row', (await S.rows(g)).map((r) => r.text).join('|') === '|Three');
    await g.click('#link-send');
    await sleep(500);
    const ret = returnsOf(await S.log())[0].d;
    check('G-rows-4: the return has the cleared row as t:"" and NO entry for the removed one (missing = no change)', ret.rows.length === 2 && ret.rows[0].u === 1 && ret.rows[0].t === '' && ret.rows[1].u === 3, JSON.stringify(ret.rows.map((r) => [r.u, r.t])));
    await say(S, { gen2label: 'cancelled', v: 1, jobId: job.jobId, returnId: ret.returnId });
  });

  await scenario('G-rows-5', async (S) => {
    // list-replacing operations end the link first (CSV, a replacing preset, Upload, Previous set): ask, Continue = Unlink then the operation
    const job = mkJob([{ t: '' }, { t: '' }]);   // all blank: a preset would REPLACE the list
    const g = await S.openGen(jobUrl(job), { drawers: 2 });
    await g.ev(`document.getElementById('preset-select').value = 'hex-nuts'; document.getElementById('preset-select').dispatchEvent(new Event('change'))`);
    await g.waitFor(`!document.getElementById('gen-modal').hidden`);
    check('G-rows-5: a preset that would replace the linked list ASKS ("ends the link")', /replaces the planner's drawers in the list and ends the link/.test(await g.ev(`document.getElementById('gm-body').textContent`)));
    await g.click('#gm-buttons button:nth-child(2)');
    await sleep(300);
    check('G-rows-5: Cancel: still linked, same two rows', (await S.rows(g)).length === 2 && (await g.ev(`link !== null`)));
    await g.ev(`document.getElementById('preset-select').value = 'hex-nuts'; document.getElementById('preset-select').dispatchEvent(new Event('change'))`);
    await g.waitFor(`!document.getElementById('gen-modal').hidden`);
    await g.click('#gm-buttons button:nth-child(1)');
    await g.waitFor(`document.querySelectorAll('#labels .row').length === 6`);
    check('G-rows-5: Continue unlinks, then loads the preset (6 rows, no tags, no link bar)', (await S.barText(g)) === null && (await S.rows(g)).every((r) => r.tag === null));
    const g2 = await S.openGen(jobUrl(mkJob([{ t: 'One' }], { jobId: ID('k') })), { name: 'gen-2', drawers: 1 });
    await g2.ev(`(() => { const dt = new DataTransfer(); dt.items.add(new File(['M3'], 'x.csv', { type: 'text/csv' })); const i = document.getElementById('csv-input'); i.files = dt.files; i.dispatchEvent(new Event('change')); })()`);
    await g2.waitFor(`!document.getElementById('gen-modal').hidden`);
    check('G-rows-5: a CSV import into a linked tab asks the same question', /ends the link/.test(await g2.ev(`document.getElementById('gm-body').textContent`)));
    await g2.click('#gm-buttons button:nth-child(2)');
  });

  await scenario('G-misc-1', async (S) => {
    // beforeunload warns while there is unsaved linked work and not otherwise; Sort keeps tags
    const job = mkJob([{ t: 'banana' }, { t: 'apple' }]);
    const g = await S.openGen(jobUrl(job), { drawers: 2 });
    await g.reload();
    await g.waitFor(`!document.getElementById('download').disabled`);
    check('G-misc-1: a reload with NO unsaved work does not warn', g.dialogs.filter((d) => d.type === 'beforeunload').length === 0);
    await g.click('#sort-labels');
    await sleep(300);
    const rows = await S.rows(g);
    check('G-misc-1: Sort keeps the planner tags with their drawers', rows[0].text === 'apple' && rows[0].tag === '#2' && rows[1].tag === '#1', JSON.stringify(rows));
    await S.setText(g, 0, 'apple!');
    await g.reload();
    check('G-misc-1: a reload WITH unsaved work triggers the browser\'s leave-page warning', g.dialogs.filter((d) => d.type === 'beforeunload').length >= 1, JSON.stringify(g.dialogs));
  });

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
  if (results.some((r) => !r.ok)) exitCode = 1;
} catch (e) {
  console.log('HARNESS ERROR', e.stack || e);
  exitCode = 1;
} finally {
  await b.close();
}
process.exit(exitCode);
