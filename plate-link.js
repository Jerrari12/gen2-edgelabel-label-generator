/* MODULITH Label Studio - THE LABEL PLATE inside the merged planner (its docs/redesign/LABELS-INTEGRATION.md, step B1,
   read-only). The planner's Labels workspace frames this page with ?embed=planner and shows this build's label list as the
   Studio lays it out; the planner owns the list, this page only displays it (and downloads the print file).

   Pure: no DOM, no storage, no window. index.html owns the page (the rows, the status, the listener); this file owns the
   RULES, executed by `node --test test/`. A classic script (exposes GEN2PlateLink) and, under node, a CommonJS module.

   THE CONTRACT (the Part Picker's planner embed, parts/js/embed.js, with a different key):
     asked for  = ?embed=planner in this page's address AND window.parent !== window (a parent on ANOTHER origin: nothing
                  about it can be read; the page waits for the planner to speak)
     Planner -> page   { gen2plate: 'hello', v: 1, session }   from window.parent, from an origin on PLANNER_ORIGINS (an
                       exact match; a loopback origin only while this page is itself served from loopback). The first hello
                       that passes binds the session: its origin and its window are the only sender from then on, and the
                       session rides on every message both ways. The referrer is never consulted.
     page -> Planner   { gen2plate: 'ready', v: 1, session, caps }   the answer to the hello; caps names what this page does
                       ('snapshot/1', 'select/1'), so a planner can tell an older page apart and say so
     Planner -> page   { gen2plate: 'snapshot', v: 1, session, buildId, rev, type, doc, drawers, selected }   the committed
                       label state: doc = a modulith-labels list (label-list.js) or null with `reason` (over the bounds: the
                       page clears what it showed); drawers = { labelId: [drawer numbers] }; type = 'edgelabel' |
                       'classicpro' | null; selected = a label id or null. A snapshot for another buildId replaces everything.
     Planner -> page   { gen2plate: 'select', v: 1, session, id }   highlight that label (null: none)
     page -> Planner   { gen2plate: 'selected', v: 1, session, id, rev, buildId }   a row was clicked here; rev and buildId
                       are the snapshot's, so the planner can drop a click that belongs to an earlier state */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.GEN2PlateLink = api;
})(typeof window !== 'undefined' ? window : null, function () {
'use strict';

const KEY = 'gen2plate';
const V = 1;
const CAPS = Object.freeze(['snapshot/1', 'select/1']);
// the planners that may embed this page: pinned equal to label-link.js's PLANNER_ORIGINS by the test; never a GitHub Pages
// origin, which would admit every Pages site of an account
const PLANNER_ORIGINS = Object.freeze(['https://gen2planner.jerrari3d.com', 'https://planner.modulith.systems']);
const LOOPBACK_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;
const SESSION_RE = /^[A-Za-z0-9_-]{8,64}$/;
const ID_RE = /^[a-z0-9]{8,32}$/;
const LABELS_MAX = 400;
const JSON_MAX = 256 * 1024;
const DRAWER_MAX = 10000;
const REASON_MAX = 300;
const isObj = (v) => Object.prototype.toString.call(v) === '[object Object]';
const byteLength = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : unescape(encodeURIComponent(s)).length);

/* true inside a frame that asked for the planner's embed; who the parent is comes from its hello, not from here */
function plannerAsked(win) {
  try { return new URLSearchParams(win.location.search).get('embed') === 'planner' && !!win.parent && win.parent !== win; } catch (e) { return false; }
}
/* a planner origin this page may be bound to: exact, from the list; loopback only while this page is itself on loopback */
function originAllowed(origin, win) {
  if (typeof origin !== 'string') return false;
  if (PLANNER_ORIGINS.includes(origin)) return true;
  let own = ''; try { own = win.location.origin; } catch (e) { own = ''; }
  return LOOPBACK_ORIGIN.test(own) && LOOPBACK_ORIGIN.test(origin);
}
/* the planner's hello: the binding { origin, session }, or null for anything else */
function readHello(e, win) {
  if (!e || e.source !== win.parent || !originAllowed(e.origin, win)) return null;
  const d = e.data;
  if (!isObj(d) || d[KEY] !== 'hello' || d.v !== V || typeof d.session !== 'string' || !SESSION_RE.test(d.session)) return null;
  return { origin: e.origin, session: d.session };
}
/* a message from the bound planner: its body, when it comes from the bound window at the bound origin with the bound session */
function fromPlanner(e, win, bind) {
  if (!bind || !e || e.source !== win.parent || e.origin !== bind.origin) return null;
  const d = e.data;
  if (!isObj(d) || d.v !== V || d.session !== bind.session || typeof d[KEY] !== 'string') return null;
  return d;
}
const readyMessage = (bind) => ({ [KEY]: 'ready', v: V, session: bind.session, caps: CAPS.slice() });
const selectedMessage = (bind, id, snap) => ({ [KEY]: 'selected', v: V, session: bind.session, id: id || null, rev: snap ? snap.rev : -1, buildId: snap ? snap.buildId : null });

/* The snapshot, checked: { ok: true, snap } or { ok: false, reason }. `LL` is label-list.js (GEN2LabelList): the document is
   cleaned by it, so a label this version cannot read is dropped as that module drops it, never shown half-read. A null
   document is the planner saying the list is over the bounds: ok, with no labels and its reason. */
function readSnapshot(d, LL) {
  const fail = (reason) => ({ ok: false, reason });
  if (!isObj(d) || d[KEY] !== 'snapshot') return fail('not-a-snapshot');
  if (typeof d.buildId !== 'string' || !ID_RE.test(d.buildId)) return fail('bad-build');
  if (!Number.isInteger(d.rev) || d.rev < 0) return fail('bad-rev');
  const type = d.type === 'edgelabel' || d.type === 'classicpro' ? d.type : null;
  if (d.doc === null) {
    const reason = typeof d.reason === 'string' ? d.reason.trim().slice(0, REASON_MAX) : '';
    return { ok: true, snap: { buildId: d.buildId, rev: d.rev, type, labels: [], style: null, drawers: {}, selected: null, reason: reason || 'The planner did not send its labels.' } };
  }
  if (!isObj(d.doc) || !Array.isArray(d.doc.labels)) return fail('bad-doc');
  if (d.doc.labels.length > LABELS_MAX) return fail('too-many');
  let bytes = 0; try { bytes = byteLength(JSON.stringify(d.doc)); } catch (e) { return fail('bad-doc'); }
  if (bytes > JSON_MAX) return fail('too-big');   // the advertised bound, in UTF-8 bytes as the planner measures it (Sol 01a13a10)
  if (!LL || typeof LL.cleanLabelList !== 'function') return fail('no-list-module');
  const doc = LL.cleanLabelList(d.doc);
  if (!doc) return fail('bad-doc');
  const drawers = {};
  if (isObj(d.drawers)) {
    for (const [id, ns] of Object.entries(d.drawers)) {
      if (!ID_RE.test(id) || !Array.isArray(ns)) continue;
      const clean = ns.filter((n) => Number.isInteger(n) && n >= 1 && n <= DRAWER_MAX).slice(0, 64).sort((a, b) => a - b);
      if (clean.length) drawers[id] = clean;
    }
  }
  const selected = typeof d.selected === 'string' && ID_RE.test(d.selected) && doc.labels.some((l) => l.id === d.selected) ? d.selected : null;
  return { ok: true, snap: { buildId: d.buildId, rev: d.rev, type, labels: doc.labels, style: doc.style || null, drawers, selected, reason: null } };
}
/* `select` from the planner: { id } (null for none), or null for anything else - including one for another build than the
   snapshot on screen (messages arrive in order, so this is belt and braces - Sol 01a13a10) */
function readSelect(d, snap) {
  if (!isObj(d) || d[KEY] !== 'select') return null;
  if (!snap || d.buildId !== snap.buildId) return null;
  if (d.id === null || d.id === undefined) return { id: null };
  return typeof d.id === 'string' && ID_RE.test(d.id) ? { id: d.id } : null;
}

/* THE ROW PLAN: each label of a checked snapshot as the page builds it.
     { id, kind: 'hw', text, item, drawers }                       a part label: laid out from its record, as a #hw= link's row
     { id, kind: 'plain', text, badge, manual, drawers }           a typed label: badge = { type, value?, svg? } or null;
                                                                   manual = the list chose the badge (absent = predict here, as
                                                                   fromGeneratorProject reads a predicted one as absent) */
function rowPlan(snap) {
  return snap.labels.map((l) => {
    const drawers = snap.drawers[l.id] || [];
    if (l.hardware && isObj(l.hardware)) return { id: l.id, kind: 'hw', text: l.text || '', item: l.hardware, drawers };
    const b = isObj(l.badge) ? l.badge : null;
    const badge = b && (b.type === 'char' || b.type === 'icon' || b.type === 'none') ? { type: b.type, value: b.value, svg: typeof b.svg === 'string' ? b.svg : undefined } : null;
    return { id: l.id, kind: 'plain', text: l.text || '', badge, manual: !!badge, drawers };
  });
}
/* the six label settings of a snapshot's style, as the page's input ids (label-link.js STYLE_INPUT); absent ones are left */
const STYLE_INPUT = { capMm: 'font-size', depth: 'text-depth', badgeSize: 'badge-size', bold: 'bold-text', allCaps: 'all-caps', predictIcons: 'predict-icons' };
function styleSettings(style) {
  const out = {};
  if (!isObj(style)) return out;
  for (const [k, id] of Object.entries(STYLE_INPUT)) if (k in style && style[k] !== undefined && style[k] !== null) out[id] = style[k];
  return out;
}

return { KEY, V, CAPS, PLANNER_ORIGINS, LOOPBACK_ORIGIN, SESSION_RE, ID_RE, LABELS_MAX, JSON_MAX, STYLE_INPUT,
  plannerAsked, originAllowed, readHello, fromPlanner, readyMessage, selectedMessage, readSnapshot, readSelect, rowPlan, styleSettings };
});
