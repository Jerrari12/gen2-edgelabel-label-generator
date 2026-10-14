/* THE PART PICKER INSIDE THE LABEL STUDIO (2026-10-10; the owner: the Part Picker ships inside the Label Studio site, under
   parts/, and picked parts are ADDED to the list with Undo). The Label Studio opens it in a sheet - an iframe of
   parts/?embed=1, the same site - and the two talk by message. A classic script with no imports and no DOM, so node tests
   run exactly what the page runs.

   THE CONTRACT (the Part Picker's side is its js/embed.js):
     Picker -> Studio  { gen2parts: 'add', v: 1, items: [part-picker-label-item/1, ...] }   at most 200 items
                       taken only from the sheet's own frame (event.source) on this page's own origin (event.origin)
     Studio -> Picker  { gen2parts: 'added', v: 1, count, skipped }    count = labels added or updated in place
                       { gen2parts: 'refused', v: 1, reason }          reason = a plain sentence
   Each item is checked on its own (itemOk: the checks a #hw= link's items have always had, index.html hardwareItems): a bad
   one is skipped and counted, never the whole batch. A part already in the list (the same item id) is updated in place,
   not added twice.

   GEN2PartPickerLink.itemOk(item)                   -> true when the Label Studio can lay the item out
   GEN2PartPickerLink.readAdd(event, frameWindow, origin) -> { items } | { refused: reason } | null (not for us / not trusted)
   GEN2PartPickerLink.planAdd(rowIds, items)         -> { add: [item], update: [{ index, item }], skipped }
                                                         rowIds: per list row, its part item id, or null for any other row
   GEN2PartPickerLink.added(count, skipped) / refused(reason)   the replies */
(function (root) {
'use strict';

const KEY = 'gen2parts', V = 1, MAX_ITEMS = 200;
const ITEM = 'part-picker-label-item/1', ITEMS = 'part-picker-label-items/1';
// Size limits on an item, far above any saved one. They bound the layout's search - it tries every below/beside placement of
// the attributes it prints, 3^n arrangements - so an oversized item cannot freeze the page.
const LIMITS = Object.freeze({ printable: 8, attributes: 24, fields: 6, text: 60 });

function strs(a, max) { return Array.isArray(a) && a.length <= max && a.every(x => typeof x === 'string' && x.length <= LIMITS.text); }
function itemOk(it) {
  return !!(it && it.schema === ITEM && typeof it.id === 'string' && strs(it.fields, LIMITS.fields) &&
    Array.isArray(it.attributes) && it.attributes.length <= LIMITS.attributes &&
    it.attributes.every(a => a && typeof a.path === 'string' && typeof a.text === 'string' && a.text.length <= LIMITS.text) &&
    (it.pinned === undefined || strs(it.pinned, LIMITS.printable)) && (it.optional === undefined || strs(it.optional, LIMITS.printable)) &&
    (it.pinned || []).length + (it.optional || []).length <= LIMITS.printable &&
    [...(it.pinned || []), ...(it.optional || [])].every(p => it.attributes.some(a => a.path === p)));
}

function readAdd(e, frameWin, origin) {
  const d = e && e.data;
  if (!d || typeof d !== 'object' || typeof d[KEY] !== 'string') return null;
  if (!frameWin || e.source !== frameWin || e.origin !== origin) return null;   // only the sheet's own frame, this site
  if (d[KEY] !== 'add' || d.v !== V) return null;
  // the batch id the Picker minted for this send (its flow refine, 2026-10-14): echoed on the reply, so a late reply to a
  // timed-out send is never credited to the next one; an older Picker sends none and gets none
  const batch = typeof d.batch === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(d.batch) ? d.batch : undefined;
  if (!Array.isArray(d.items) || !d.items.length) return { refused: 'There were no part labels in it.', batch };
  if (d.items.length > MAX_ITEMS) return { refused: `The Label Studio takes up to ${MAX_ITEMS} part labels at once; that was ${d.items.length}.`, batch };
  return { items: d.items, batch };
}

function planAdd(rowIds, items) {
  const add = [], update = [];
  let skipped = 0;
  const at = new Map();                 // part id -> the row it is in (the first, when a list holds a part twice)
  (rowIds || []).forEach((id, i) => { if (typeof id === 'string' && !at.has(id)) at.set(id, i); });
  const added = new Map();              // part id -> its place in `add` (a batch that names a part twice keeps the last)
  for (const it of items || []) {
    if (!itemOk(it)) { skipped++; continue; }
    if (at.has(it.id)) {
      const u = update.find(x => x.index === at.get(it.id));
      if (u) u.item = it; else update.push({ index: at.get(it.id), item: it });
    } else if (added.has(it.id)) add[added.get(it.id)] = it;
    else { added.set(it.id, add.length); add.push(it); }
  }
  return { add, update, skipped };
}

const added = (count, skipped) => ({ [KEY]: 'added', v: V, count, skipped });
const refused = (reason) => ({ [KEY]: 'refused', v: V, reason: String(reason || '').slice(0, 300) });

root.GEN2PartPickerLink = { version: 1, KEY, V, MAX_ITEMS, ITEM, ITEMS, LIMITS, itemOk, readAdd, planAdd, added, refused };
})(typeof globalThis !== 'undefined' ? globalThis : this);
