/* CDP plumbing for the hand-run browser checks (not part of `node --test`; this folder is tools/, on purpose: node --test runs
   every .mjs under test/). One headed Chrome with its OWN profile (an ABSOLUTE --user-data-dir, created before launch - a
   relative one once popped an error dialog on Joey's desktop), one browser websocket, flattened sessions per tab, and a tiny
   no-store static server per folder. Everything it starts is stopped by close().

   Adapted from the step-2 e2e helper (D:/MODULITH/handoffs/label-plan-step2/e2e/cdp.mjs). */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, normalize, isAbsolute } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.ttf': 'font/ttf', '.csv': 'text/csv', '.txt': 'text/plain' };
export const CHROME = process.env.CHROME_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* `root` is a folder path, or an object { dir } whose dir can change while the server runs (the compatibility harness serves "the
   planner" from one port and swaps which version it is; tabs already open keep the code they loaded). */
export function serve(root, port, { log } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://localhost');
      if (log) log.push(u.pathname);
      const rel = normalize(decodeURIComponent(u.pathname)).replace(/^([/\\])+/, '');
      const file = join(typeof root === 'string' ? root : root.dir, rel === '' ? 'index.html' : rel);
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

/* A port is taken when a server cannot bind it - checked by binding, not by parsing netstat. */
export async function portFree(port) {
  return new Promise((res) => {
    const s = createServer();
    s.once('error', () => res(false));
    s.listen(port, '127.0.0.1', () => s.close(() => res(true)));
  });
}

export async function launch({ cdpPort, width = 1440, height = 900, extraArgs = [], tag = 'gen2-step3' }) {
  if (!(await portFree(cdpPort))) throw new Error(`CDP port ${cdpPort} is in use - pick another`);
  const base = join(tmpdir(), tag); mkdirSync(base, { recursive: true });
  const profileDir = mkdtempSync(join(base, 'profile-'));
  if (!isAbsolute(profileDir)) throw new Error('profile dir is not absolute: ' + profileDir);
  const chrome = spawn(CHROME, [`--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check',
    '--window-position=60,40', `--window-size=${width},${height}`, '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-popup-blocking',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', ...extraArgs, 'about:blank'], { stdio: 'ignore' });
  let ver;
  for (let i = 0; i < 80 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${cdpPort}/json/version`)).json(); } catch (e) { await sleep(300); } }
  if (!ver) { try { chrome.kill(); } catch (e) {} throw new Error('chrome did not start'); }
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const sessions = new Map(); const created = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
    if (m.method === 'Target.targetCreated') created.push(m.params.targetInfo);
    const s = m.sessionId && sessions.get(m.sessionId);
    if (s) s._event(m);
  });
  const sendRaw = (method, params = {}, sessionId, timeoutMs = 120000) => Promise.race([
    new Promise((res, rej) => { const i = ++id; pend.set(i, (m) => (m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); }),
    sleep(timeoutMs).then(() => { throw new Error('timeout: ' + method); })]);

  const procs = { chrome, profileDir, servers: [] };
  const browser = {
    send: (m, p) => sendRaw(m, p),
    created,
    async newContext() { return (await sendRaw('Target.createBrowserContext', { disposeOnDetach: false })).browserContextId; },
    async disposeContext(ctx) { try { await sendRaw('Target.disposeBrowserContext', { browserContextId: ctx }); } catch (e) {} },
    async attach(targetId) {
      const { sessionId } = await sendRaw('Target.attachToTarget', { targetId, flatten: true });
      const page = makePage(sessionId, targetId);
      sessions.set(sessionId, page);
      for (const d of ['Runtime', 'Page', 'Network']) await sendRaw(d + '.enable', {}, sessionId);
      await sendRaw('Network.setBlockedURLs', { urls: ['*gc.zgo.at*', '*goatcounter.com*'] }, sessionId);
      return page;
    },
    async newPage(url, ctx) {
      const { targetId } = await sendRaw('Target.createTarget', { url: 'about:blank', ...(ctx ? { browserContextId: ctx } : {}) });
      const page = await browser.attach(targetId);
      if (url) await page.goto(url);
      return page;
    },
    /* the page a window.open() from `opener` made: wait for its target, attach, wait for its load */
    async popupOf(opener, { timeoutMs = 15000, match } = {}) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const t = created.find((x) => x.type === 'page' && x.openerId === opener.targetId && !x.__taken && (!match || match(x)));
        if (t) { t.__taken = true; const p = await browser.attach(t.targetId); await p.ready(); return p; }
        await sleep(100);
      }
      throw new Error('no popup appeared');
    },
    async pages() { return (await sendRaw('Target.getTargets')).targetInfos.filter((t) => t.type === 'page'); },
    async close() {
      try { await sendRaw('Browser.close', {}, undefined, 4000); } catch (e) {}
      try { ws.close(); } catch (e) {}
      try { chrome.kill(); } catch (e) {}
      for (const s of procs.servers) { try { s.close(); s.closeAllConnections && s.closeAllConnections(); } catch (e) {} }
      for (let i = 0; i < 20; i++) { try { rmSync(profileDir, { recursive: true, force: true }); break; } catch (e) { await sleep(500); } }
    },
    startServer: async (root, port, opts) => {
      if (!(await portFree(port))) throw new Error(`port ${port} is in use - pick another`);
      const s = await serve(root, port, opts); procs.servers.push(s); return s;
    },
  };
  await sendRaw('Target.setDiscoverTargets', { discover: true });
  process.on('SIGINT', () => { browser.close().then(() => process.exit(1)); });

  function makePage(sessionId, targetId) {
    const errors = [], handlers = [], dialogs = [];
    const page = {
      sessionId, targetId, errors, dialogs,
      send: (m, p, t) => sendRaw(m, p, sessionId, t),
      _event(m) {
        // a beforeunload ("Leave site?") or alert/confirm dialog would block the page forever under CDP: record it, accept it
        if (m.method === 'Page.javascriptDialogOpening') { dialogs.push({ type: m.params.type, message: m.params.message }); sendRaw('Page.handleJavaScriptDialog', { accept: true }, sessionId).catch(() => {}); }
        if (m.method === 'Runtime.exceptionThrown') errors.push(String(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || '')).slice(0, 500));
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value || a.description).join(' ').slice(0, 500));
        for (const h of handlers) h(m);
      },
      on(fn) { handlers.push(fn); },
      async ev(expr, timeoutMs = 120000) {
        const r = await sendRaw('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId, timeoutMs);
        if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
        return r.result.value;
      },
      async goto(url) { await page.send('Page.navigate', { url }); await page.ready(); },
      async ready() { for (let i = 0; i < 200; i++) { try { if ((await page.ev('document.readyState', 4000)) === 'complete') return; } catch (e) {} await sleep(100); } throw new Error('page never finished loading'); },
      async reload() { await page.send('Page.reload', { ignoreCache: true }); await sleep(300); await page.ready(); },
      async waitFor(expr, { timeoutMs = 15000, every = 100 } = {}) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) { try { const v = await page.ev(expr, 4000); if (v) return v; } catch (e) {} await sleep(every); }
        throw new Error('timed out waiting for: ' + expr.slice(0, 160));
      },
      async click(selector) {
        const pt = await page.ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, !!e.disabled]; })()`);
        if (!pt) throw new Error('no element ' + selector);
        if (pt[2]) throw new Error('element is disabled ' + selector);
        for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: pt[0], y: pt[1], button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1, buttons: type === 'mousePressed' ? 1 : 0 });
      },
      async type(selector, text) {
        await page.ev(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.focus(); e.select && e.select(); })()`);
        await page.send('Input.insertText', { text });
      },
      async key(key, extra = {}) {
        for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: key === 'Escape' ? 27 : key === 'Enter' ? 13 : 0, ...extra });
      },
      async shot(file) { const r = await page.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(file, Buffer.from(r.data, 'base64')); return file; },
      async close() { try { await sendRaw('Target.closeTarget', { targetId }); } catch (e) {} },
      async bringToFront() { await page.send('Page.bringToFront'); },
    };
    return page;
  }
  return browser;
}
