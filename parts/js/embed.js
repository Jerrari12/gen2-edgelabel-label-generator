// The Part Picker inside the Label Studio (2026-10-10): the page is published in the Label Studio site under parts/ and
// the Studio opens it in a sheet (an iframe of parts/?embed=1). Pure helpers, so the contract is testable without a page.
//
// THE CONTRACT (the Label Studio relies on exactly this):
//   embedded   = ?embed=1 in this page's address AND window.parent !== window AND the parent is the same origin
//   Picker -> Studio   window.parent.postMessage({ gen2parts: 'add', v: 1, items: [part-picker-label-item/1, ...] }, location.origin)
//                      items are the same objects a #hw= link carries (part-picker-label-items/1 .items); at most 200,
//                      and none is sent when there are more
//   Studio -> Picker   { gen2parts: 'added', v: 1, count, skipped }   count = labels added (or updated in place),
//                                                                      skipped = how many were not (a number)
//                      { gen2parts: 'refused', v: 1, reason }          reason = a sentence the Picker shows as it is
//                      accepted only from window.parent with event.origin === location.origin
//   Opened on its own (the site's parts/ page), Make labels opens the Label Studio at '../#hw=...' in a new tab.
//
// THE PLANNER'S EMBED (2026-10-13, the MODULITH planner's Part Picker modal; docs/redesign/LABELS-INTEGRATION.md there):
//   asked for   = ?embed=planner in this page's address AND window.parent !== window (the parent is ANOTHER origin, so
//                 nothing about it can be read; the page looks embedded at once and waits for the planner to speak)
//   Planner -> Picker   { gen2parts: 'hello', v: 1, session }   from window.parent, from an origin on PLANNER_ORIGINS (an
//                       exact match; a loopback origin only while this page is itself served from loopback). The first
//                       hello that passes binds the session: its origin is where the parts go, its session rides on every
//                       message both ways. Anything before it, or from anywhere else, is ignored. The referrer is not
//                       consulted: it can be absent, and it is not the planner speaking.
//   Picker -> Planner   { gen2parts: 'ready', v: 1, session }   the answer to the hello
//                       { gen2parts: 'add', v: 1, session, items } the parts, posted to the bound origin only
//   Planner -> Picker   the same 'added' / 'refused' replies as the Studio's, carrying the session, read only from
//                       window.parent at the bound origin with the bound session.
//
// THE BATCH (2026-10-14, both embeds): every 'add' also carries `batch` (8 to 64 of [A-Za-z0-9_-], new per send, a retry
// included). The Studio and the planner echo it verbatim on 'added' and 'refused'. The page credits a reply to its
// pending send ONLY when the batch matches (creditsPending); a reply without one, or for a send that timed out (its id
// is retired), changes nothing. Deploy order: the echo goes live before a Picker that waits for it.

export const PARTS_KEY = 'gen2parts';
export const PARTS_V = 1;
// the planners that may embed this page (pinned equal to the Label Studio's label-link.js by its contract test; never a
// GitHub Pages origin, which would admit every Pages site of an account)
export const PLANNER_ORIGINS = Object.freeze(['https://gen2planner.jerrari3d.com', 'https://planner.modulith.systems']);
export const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
export const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;
// the planner's build id, as the contract names it (LABELS-INTEGRATION.md, "The parts channel's additions"): the record's
// own id. Anything else is no build at all - never a refusal
export const BUILD_RE = /^[a-z0-9]{8,32}$/;
export const LABEL_STUDIO_MAX_ITEMS = 200;
// What the Label Studio accepts in one item (its hardwareItems(), index.html HW_MAX). One item past a limit used to make
// the Studio refuse the WHOLE batch, so a typed word is capped where it is typed and the batch is checked before it goes.
export const LABEL_STUDIO_LIMITS = Object.freeze({ printable: 8, attributes: 24, fields: 6, text: 60 });
export const CUSTOM_TEXT_MAX = LABEL_STUDIO_LIMITS.text;

// true only inside a same-origin frame that asked for it (?embed=1). A cross-origin parent throws on .location.origin.
export function isEmbedded(win) {
  try {
    if (new URLSearchParams(win.location.search).get('embed') !== '1') return false;
    if (!win.parent || win.parent === win) return false;
    const o = win.parent.location.origin;
    return typeof o === 'string' && o !== 'null' && o === win.location.origin;
  } catch { return false; }
}

// true inside a frame that asked for the planner's embed (?embed=planner); who the parent is comes from its hello, not from here
export function plannerAsked(win) {
  try { return new URLSearchParams(win.location.search).get('embed') === 'planner' && !!win.parent && win.parent !== win; } catch { return false; }
}
// a planner origin this page may be bound to: exact, from the list; loopback only while this page is itself on loopback
export function plannerOriginAllowed(origin, win) {
  if (typeof origin !== 'string') return false;
  if (PLANNER_ORIGINS.includes(origin)) return true;
  let own = ''; try { own = win.location.origin; } catch { own = ''; }
  return LOOPBACK_ORIGIN.test(own) && LOOPBACK_ORIGIN.test(origin);
}
// the planner's hello: the binding { origin, session }, or null for anything else
export function readHello(e, win) {
  if (!e || e.source !== win.parent || !plannerOriginAllowed(e.origin, win)) return null;
  const d = e.data;
  if (!d || typeof d !== 'object' || d[PARTS_KEY] !== 'hello' || d.v !== PARTS_V || typeof d.session !== 'string' || !SESSION_RE.test(d.session)) return null;
  // buildId (2026-10-15, the planner session): which build this session adds to, so "sent" marks are per build. An older
  // planner sends none, and then the marks are this page's alone
  const buildId = typeof d.buildId === 'string' && BUILD_RE.test(d.buildId) ? d.buildId : null;
  return { origin: e.origin, session: d.session, ...(buildId ? { buildId } : {}) };
}
// caps: what this Picker can do beyond add (an older planner ignores it). 'open/1': Edit part details opens that part.
export const PICKER_CAPS = Object.freeze(['open/1']);
export const readyMessage = (link) => ({ [PARTS_KEY]: 'ready', v: PARTS_V, session: link.session, caps: [...PICKER_CAPS] });
export const addMessageFor = (items, link, batch) => ({ [PARTS_KEY]: 'add', v: PARTS_V, session: link.session, items, ...(batch ? { batch } : {}) });
// a reply from the bound planner: the same bodies as the Studio's replies, from window.parent at the bound origin with the bound session
export function readPlannerReply(e, win, link) {
  if (!link || !e || e.source !== win.parent || e.origin !== link.origin) return null;
  const d = e.data;
  if (!d || typeof d !== 'object' || d.session !== link.session) return null;
  return readReplyBody(d);
}

// ------------------------------------------------------------------ open/1 (2026-10-15, LABELS-INTEGRATION.md)
// The planner's "Edit part details": { gen2parts: 'open', v: 1, session, req, id, item }, from the bound parent at the
// bound origin with the bound session. req is the request's own id (echoed on the answer; the latest wins); id is the
// part label's record id, and must equal item.id. Read as:
//   null                          - not an open for this binding, or no req to answer to: ignored
//   { req, id, why }              - an open that cannot be done as sent: refused with why
//   { req, id, item }             - an open to do
export const REQ_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const RECORD_ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
export function readOpen(e, win, link) {
  if (!link || !e || e.source !== win.parent || e.origin !== link.origin) return null;
  const d = e.data;
  if (!d || typeof d !== 'object' || d[PARTS_KEY] !== 'open' || d.v !== PARTS_V || d.session !== link.session) return null;
  if (typeof d.req !== 'string' || !REQ_RE.test(d.req)) return null;
  const id = typeof d.id === 'string' && RECORD_ID_RE.test(d.id) ? d.id : null;
  if (!id) return { req: d.req, id: typeof d.id === 'string' ? d.id.slice(0, 80) : '', why: 'The planner sent no part id the Part Picker can read.' };
  const item = d.item;
  if (!item || typeof item !== 'object' || Array.isArray(item)) return { req: d.req, id, why: 'The planner sent no part label with the request.' };
  if (item.id !== id) return { req: d.req, id, why: 'The part label the planner sent is for another part.' };
  const bad = labelStudioProblem(item);
  if (bad) return { req: d.req, id, why: `The Part Picker cannot read that part label: ${bad}.` };
  return { req: d.req, id, item };
}
// close (LABELS-INTEGRATION.md): Escape inside the frame never reaches the planner's page, so when the Picker has nothing of
// its own to close, it asks the planner to close the dialog (the stress test's P-F4)
export const closeMessage = (link) => ({ [PARTS_KEY]: 'close', v: PARTS_V, session: link.session });
export const openedMessage = (link, req, id) => ({ [PARTS_KEY]: 'opened', v: PARTS_V, session: link.session, req, id });
export const openRefusedMessage = (link, req, id, reason) => ({ [PARTS_KEY]: 'refused', v: PARTS_V, session: link.session, req, id, reason: String(reason).slice(0, 300) });

// the Label Studio this page opens when it is NOT embedded: the same site, one folder up (parts/ -> the site root).
// ?labelgen=http://localhost:PORT/ points at a local Label Studio while developing the Picker on its own server.
export function labelStudioUrl(loc) {
  const q = new URLSearchParams(loc.search).get('labelgen');
  if (q && /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}\/?$/.test(q)) return q.replace(/\/?$/, '/');
  return new URL('../', loc.href).href;
}

export const addMessage = (items, batch) => ({ [PARTS_KEY]: 'add', v: PARTS_V, items, ...(batch ? { batch } : {}) });

// THE BATCH (2026-10-14, Astra via the planner session: a late reply credited to a later send could falsely confirm
// labels). Every add carries `batch`, new per send (a retry is a new send); the planner and the Label Studio echo it
// verbatim on 'added' and 'refused'. The page credits a reply to its pending send ONLY when the two are equal: a reply
// without one, or with a retired one (the send timed out), changes nothing.
export const BATCH_RE = /^[A-Za-z0-9_-]{8,64}$/;
export function newBatch() {
  const a = new Uint8Array(12);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') globalThis.crypto.getRandomValues(a);
  else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return 'b' + [...a].map((x) => x.toString(16).padStart(2, '0')).join('');   // 25 characters, inside BATCH_RE
}
// does this reply answer the send that is pending? pending = { batch, ... } | null; reply from readReply/readPlannerReply
export const creditsPending = (pending, reply) => !!(pending && reply && typeof reply.batch === 'string' && reply.batch === pending.batch);

// why the Label Studio would refuse this item, in plain words; null when it takes it. Every condition of the Studio's
// own check (index.html hardwareItems(), its good()), so a part it would refuse is named here and the batch is not sent.
export const LABEL_ITEM_SCHEMA = 'part-picker-label-item/1';
export function labelStudioProblem(item) {
  const L = LABEL_STUDIO_LIMITS;
  if (!item || typeof item !== 'object') return 'it is not a part label';
  if (item.schema !== LABEL_ITEM_SCHEMA) return 'it is not a part label of this version';
  if (typeof item.id !== 'string') return 'it has no part id';
  if (!Array.isArray(item.fields) || !Array.isArray(item.attributes)) return 'it has no size or printed words';
  const attrs = item.attributes;
  if (attrs.some((a) => !a || typeof a.path !== 'string' || typeof a.text !== 'string')) return 'a printed word is not text';
  const words = [...item.fields, ...attrs.map((a) => a.text)];
  if (words.some((w) => typeof w !== 'string')) return 'a printed word is not text';
  const long = words.find((w) => w.length > L.text);
  if (long) return `"${long.slice(0, 20)}…" is longer than ${L.text} characters`;
  if (item.fields.length > L.fields) return `it has more than ${L.fields} size fields`;
  if (attrs.length > L.attributes) return `it has more than ${L.attributes} printed words`;
  for (const k of ['pinned', 'optional']) {
    const v = item[k];
    if (v === undefined) continue;
    if (!Array.isArray(v) || v.some((p) => typeof p !== 'string' || p.length > L.text)) return `its ${k} fields are not a list of names`;
    if (v.length > L.printable) return `it asks to print more than ${L.printable} words`;
  }
  const printable = [...(item.pinned || []), ...(item.optional || [])];
  if (printable.length > L.printable) return `it asks to print more than ${L.printable} words`;
  const missing = printable.find((p) => !attrs.some((a) => a.path === p));
  if (missing !== undefined) return `it asks to print ${missing}, which it does not carry`;
  return null;
}

// a message from the Label Studio, checked: { kind: 'added', count, skipped } | { kind: 'refused', reason } | null
export function readReply(e, win) {
  if (!e || e.source !== win.parent || e.origin !== win.location.origin) return null;
  return readReplyBody(e.data);
}
function readReplyBody(d) {
  if (!d || typeof d !== 'object' || d.v !== PARTS_V) return null;
  const n = (x) => (Number.isInteger(x) && x >= 0 ? x : null);
  // the echoed batch, when well-formed (anything else reads as none, and then the reply credits no send)
  const b = typeof d.batch === 'string' && BATCH_RE.test(d.batch) ? { batch: d.batch } : {};
  if (d[PARTS_KEY] === 'added') {
    const count = n(d.count);
    if (count === null) return null;
    // skipped is a number; a list of what was skipped is counted the same way
    const skipped = Array.isArray(d.skipped) ? d.skipped.length : n(d.skipped) || 0;
    return { kind: 'added', count, skipped, ...b };
  }
  if (d[PARTS_KEY] === 'refused') {
    const reason = typeof d.reason === 'string' ? d.reason.trim().slice(0, 300) : '';
    return { kind: 'refused', reason, ...b };
  }
  return null;
}

const labels = (n) => `${n} part label${n === 1 ? '' : 's'}`;
// the status line for a reply: { text, cls } ('ok' fades, 'err' stays)
export function replyStatus(r) {
  if (r.kind === 'refused') return { text: `The Label Studio did not add them: ${r.reason || 'it gave no reason'}`, cls: 'err' };
  const sk = r.skipped ? ` ${r.skipped} ${r.skipped === 1 ? 'was' : 'were'} skipped.` : '';
  if (!r.count) return { text: `No part labels were added.${sk}`, cls: 'err' };
  return { text: `Added ${labels(r.count)} to your list.${sk}`, cls: r.skipped ? 'err' : 'ok' };
}

// the button that hands the shown parts over: 'Add N part labels' inside the Studio, 'Add N labels to the planner' inside
// the planner, 'Make labels (N)' on its own
export function labelsButtonText(n, embedded, planner = false) {
  if (planner) return n ? `Add ${n} ${n === 1 ? 'label' : 'labels'} to the planner` : 'Add labels to the planner';
  if (embedded) return n ? `Add ${labels(n)}` : 'Add part labels';
  return `Make labels${n ? ` (${n})` : ''}`;
}
