/* GEN2 hardware-label layout - one hardware label item (part-picker-label-item/1, the Part Picker's saved-record export)
   laid out on the measured EdgeLabel face. This is the browser port of the Python print engine that laid out every
   printed hardware plate (D:/MODULITH/handoffs/hardware-library/icons-v1: label_from_items.lay_out ->
   printtest_v1.fields_value), ported rule for rule so the browser and the printed plates agree:
     - the value (its fields, e.g. "M12" "× 25") top-left at the largest cap from 12.0 down to the 6.0 mm minimum, wrapping
       only BETWEEN fields, never inside one;
     - the attributes at 4.7 mm caps, below the value or beside a value line, in reading order; pinned ones must print or
       the label is a NON-FIT naming them; the others go on while they fit and the rest are "not shown on label";
     - the compact family icon (screw / nut / washer) top-right when it fits beside everything else;
     - every element inside the face's usable area (1.8 mm margin) and 1.3 mm apart (1.4 mm from the icon);
     - text tracked in 0.05 mm steps until every glyph-to-glyph gap is at least 0.6 mm.
   Text outlines come from the generator's own font exactly as the Python engine reads it: FreeType's unhinted outline at
   100 px (26.6 fixed point, its rounding and its implied on-curve points), advances and GPOS kerning rounded to 1/64 pixel
   as matplotlib 3.11 places glyphs, and matplotlib's curve flattening (agg curve3_div, 0.5 tolerance in mm) - so the polygons are the same
   polygons, not a look-alike.

   A classic script with no imports and no THREE (the 3D extrusion stays in index.html):
     const hw = GEN2HardwareLayout.create({ data: GEN2HardwareData });   // hardware-data.js
     hw.setFont(opentypeFont);                                           // the generator font, before laying anything out
     const r = hw.layOut(item);   // { elements: {main1: rings, icon: rings, ...} | null, record: {...} }
   Element rings are in the generator label frame (mm, y up, the label centred at the origin; extrude from z 4.5). */
(function (root) {
'use strict';

function create(deps) {
  const D = deps.data;
  if (!D || D.format !== 'modulith-hardware-face') throw new Error('hardware-layout: hardware-data.js is missing');
  const RU = D.rules;
  const MAIN_MIN = RU.mainMin, MAIN_MAX = RU.mainMax, SEC_CAP = RU.secCap, GAP_TEXT = RU.gapText, GAP_ICON = RU.gapIcon;
  const ATTR_BESIDE_GAP = RU.attrBesideGap, GLYPH_GAP = RU.glyphGap, TRACK_STEP = RU.trackStep, CAP_RATIO = D.capRatio;
  const FAMILY_ICON = { screw: 'screw', nut: 'nut', washer: 'washer' };
  const FONT_SUBS = [['\u2300', '\u00D8']];      // the font has no DIAMETER SIGN; Ø is in it (label_sheet_v1.FONT_SUBS)

  // ----- the usable area: convex (checked), so containment is a half-plane test per edge
  const US = D.usable.map(p => [p[0], p[1]]);
  const usOrient = Math.sign(signedArea(US.flat()));
  for (let i = 0; i < US.length; i++) {
    const a = US[i], b = US[(i + 1) % US.length], c = US[(i + 2) % US.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cr * usOrient < -1e-9) throw new Error('hardware-layout: the usable area is not convex');
  }
  let usMinX = Infinity, usMaxY = -Infinity;
  for (const [x, y] of US) { usMinX = Math.min(usMinX, x); usMaxY = Math.max(usMaxY, y); }
  const X0 = usMinX, YTOP = usMaxY;

  let font = null, xScale = 0, yScale = 0;
  const glyphCache = new Map(), textCache = new Map(), trackCache = new Map();
  function setFont(f) {
    font = f;
    // matplotlib's text_to_path: FT_Set_Char_Size(100 pt, 72 dpi) with text.hinting_factor 8 - 800 px per em across,
    // 100 px down - and FT_Set_Transform(1/8, 1) to bring x back; scales = FT_DivFix(ppem << 6, units_per_EM)
    xScale = Math.floor(800 * 64 * 65536 / f.unitsPerEm + 0.5);
    yScale = Math.floor(100 * 64 * 65536 / f.unitsPerEm + 0.5);
    glyphCache.clear(); textCache.clear(); trackCache.clear();
  }

  // ===================================================================== geometry
  // A ring is a flat array [x0, y0, x1, y1, ...] (implicitly closed). A part is {rings, minx, miny, maxx, maxy}: one glyph or
  // one icon shape, filled even-odd. An element is {parts, minx, miny, maxx, maxy}.
  function signedArea(r) {
    let a = 0;
    for (let i = 0, n = r.length; i < n; i += 2) {
      const j = (i + 2) % n; a += r[i] * r[j + 1] - r[j] * r[i + 1];
    }
    return a / 2;
  }
  function mkPart(rings) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const r of rings) for (let i = 0; i < r.length; i += 2) {
      const x = r[i], y = r[i + 1];
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
    }
    return { rings, minx, miny, maxx, maxy };
  }
  function mkEl(parts) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of parts) {
      if (p.minx < minx) minx = p.minx; if (p.maxx > maxx) maxx = p.maxx;
      if (p.miny < miny) miny = p.miny; if (p.maxy > maxy) maxy = p.maxy;
    }
    return { parts, minx, miny, maxx, maxy };
  }
  function shiftPart(p, dx, dy) {
    return { rings: p.rings.map(r => { const o = new Array(r.length); for (let i = 0; i < r.length; i += 2) { o[i] = r[i] + dx; o[i + 1] = r[i + 1] + dy; } return o; }),
             minx: p.minx + dx, maxx: p.maxx + dx, miny: p.miny + dy, maxy: p.maxy + dy };
  }
  function shift(el, dx, dy) { return mkEl(el.parts.map(p => shiftPart(p, dx, dy))); }
  // labelcore.place: the bounding box's left edge to `left`, its top to `top`
  function place(el, left, top) { return shift(el, left - el.minx, top - el.maxy); }

  function pointInRings(x, y, rings) {            // even-odd over every ring of a part
    let inside = false;
    for (const r of rings) {
      for (let i = 0, n = r.length, j = n - 2; i < n; j = i, i += 2) {
        const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  }
  function segsCross(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  function ptSeg2(px, py, ax, ay, bx, by) {
    const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
    let t = L > 0 ? ((px - ax) * vx + (py - ay) * vy) / L : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = ax + t * vx - px, ey = ay + t * vy - py;
    return ex * ex + ey * ey;
  }
  // true when the two parts are closer than `lim` (shapely distance; 0 when they overlap or one lies inside the other)
  function partsCloser(A, B, lim) {
    const gx = Math.max(0, A.minx - B.maxx, B.minx - A.maxx), gy = Math.max(0, A.miny - B.maxy, B.miny - A.maxy);
    if (gx * gx + gy * gy >= lim * lim) return false;
    const lim2 = lim * lim;
    const bx0 = B.minx - lim, bx1 = B.maxx + lim, by0 = B.miny - lim, by1 = B.maxy + lim;
    for (const ra of A.rings) {
      for (let i = 0, n = ra.length; i < n; i += 2) {
        const ax = ra[i], ay = ra[i + 1], cx = ra[(i + 2) % n], cy = ra[(i + 3) % n];
        if (Math.max(ax, cx) < bx0 || Math.min(ax, cx) > bx1 || Math.max(ay, cy) < by0 || Math.min(ay, cy) > by1) continue;
        for (const rb of B.rings) {
          for (let k = 0, m = rb.length; k < m; k += 2) {
            const ex = rb[k], ey = rb[k + 1], fx = rb[(k + 2) % m], fy = rb[(k + 3) % m];
            if (Math.max(ex, fx) < Math.min(ax, cx) - lim || Math.min(ex, fx) > Math.max(ax, cx) + lim ||
                Math.max(ey, fy) < Math.min(ay, cy) - lim || Math.min(ey, fy) > Math.max(ay, cy) + lim) continue;
            if (segsCross(ax, ay, cx, cy, ex, ey, fx, fy)) return true;
            if (ptSeg2(ax, ay, ex, ey, fx, fy) < lim2 || ptSeg2(cx, cy, ex, ey, fx, fy) < lim2 ||
                ptSeg2(ex, ey, ax, ay, cx, cy) < lim2 || ptSeg2(fx, fy, ax, ay, cx, cy) < lim2) return true;
          }
        }
      }
    }
    // no edge within reach: either apart, or one wholly inside the other's fill (distance 0)
    for (const ra of A.rings) if (pointInRings(ra[0], ra[1], B.rings)) return true;
    for (const rb of B.rings) if (pointInRings(rb[0], rb[1], A.rings)) return true;
    return false;
  }
  function elsCloser(a, b, lim) {
    const gx = Math.max(0, a.minx - b.maxx, b.minx - a.maxx), gy = Math.max(0, a.miny - b.maxy, b.miny - a.maxy);
    if (gx * gx + gy * gy >= lim * lim) return false;
    for (const p of a.parts) for (const q of b.parts) if (partsCloser(p, q, lim)) return true;
    return false;
  }

  // the area of an element outside the usable area (Python: g.difference(USABLE).area). Each ring is clipped against the
  // convex area (Sutherland-Hodgman); outer rings add, holes subtract (even-odd depth within the part).
  function clipRing(r) {
    let pts = r;
    for (let e = 0; e < US.length && pts.length; e++) {
      const [ax, ay] = US[e], [bx, by] = US[(e + 1) % US.length];
      const side = (x, y) => usOrient * ((bx - ax) * (y - ay) - (by - ay) * (x - ax));
      const out = [];
      for (let i = 0, n = pts.length; i < n; i += 2) {
        const px = pts[i], py = pts[i + 1], qx = pts[(i + 2) % n], qy = pts[(i + 3) % n];
        const sp = side(px, py), sq = side(qx, qy);
        if (sp >= 0) out.push(px, py);
        if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push(px + t * (qx - px), py + t * (qy - py)); }
      }
      pts = out;
    }
    return pts;
  }
  function outsideArea(el) {
    let any = false;
    for (const p of el.parts) for (const r of p.rings) for (let i = 0; i < r.length && !any; i += 2) {
      for (let e = 0; e < US.length; e++) {
        const [ax, ay] = US[e], [bx, by] = US[(e + 1) % US.length];
        if (usOrient * ((bx - ax) * (r[i + 1] - ay) - (by - ay) * (r[i] - ax)) < -1e-9) { any = true; break; }
      }
    }
    if (!any) return 0;
    let area = 0;
    for (const p of el.parts) {
      for (const r of p.rings) {
        let depth = 0;
        for (const o of p.rings) if (o !== r && pointInRings(r[0], r[1], [o])) depth++;
        const k = depth % 2 ? -1 : 1;
        area += k * (Math.abs(signedArea(r)) - Math.abs(signedArea(clipRing(r))));
      }
    }
    return area;
  }

  // ===================================================================== text, as the Python engine reads the font
  function mulFix(a, b) { const c = Math.floor((Math.abs(a) * b + 32768) / 65536); return a < 0 ? -c : c; }   // FT_MulFix
  const ptX = xu => mulFix(mulFix(xu, xScale), 8192);       // loaded at 800 px/em, then the 1/8 transform (26.6 at 100 px)
  const ptY = yu => mulFix(yu, yScale);
  function glyphOf(ch) { return font.charToGlyph(ch); }
  // FreeType's FT_Outline_Decompose over the unhinted outline in 26.6 units: implied on-curve points are integer midpoints
  function outline26(g) {
    void g.path;                                  // opentype parses points lazily
    const pts = g.points || [], ops = [];
    let first = 0;
    for (let last = 0; last < pts.length; last++) {
      if (!pts[last].lastPointOfContour) continue;
      const P = [];
      for (let i = first; i <= last; i++) P.push({ x: ptX(pts[i].x), y: ptY(pts[i].y), on: !!pts[i].onCurve });
      first = last + 1;
      if (!P.length) continue;
      let start = { x: P[0].x, y: P[0].y }, idx = 0, limit = P.length - 1;
      if (!P[0].on) {
        if (P[limit].on) { start = { x: P[limit].x, y: P[limit].y }; limit--; }
        else start = { x: Math.trunc((P[0].x + P[limit].x) / 2), y: Math.trunc((P[0].y + P[limit].y) / 2) };
        idx = -1;
      }
      ops.push(['M', start.x, start.y]);
      let closed = false;
      while (idx < limit) {
        idx++;
        const p = P[idx];
        if (p.on) { ops.push(['L', p.x, p.y]); continue; }
        let ctl = { x: p.x, y: p.y };
        for (;;) {
          if (idx < limit) {
            idx++;
            const v = P[idx];
            if (v.on) { ops.push(['Q', ctl.x, ctl.y, v.x, v.y]); break; }
            const mid = { x: Math.trunc((ctl.x + v.x) / 2), y: Math.trunc((ctl.y + v.y) / 2) };
            ops.push(['Q', ctl.x, ctl.y, mid.x, mid.y]);
            ctl = { x: v.x, y: v.y };
            continue;
          }
          ops.push(['Q', ctl.x, ctl.y, start.x, start.y]); closed = true; break;
        }
        if (closed) break;
      }
      if (!closed) ops.push(['L', start.x, start.y]);
      ops.push(['Z']);
    }
    return ops;
  }
  // matplotlib Path.to_polygons -> agg conv_curve -> curve3_div (approximation scale 1: distance tolerance 0.5 units)
  const TOL2 = 0.25;
  function recBez(x1, y1, x2, y2, x3, y3, level, out) {
    if (level > 32) return;
    const x12 = (x1 + x2) / 2, y12 = (y1 + y2) / 2, x23 = (x2 + x3) / 2, y23 = (y2 + y3) / 2;
    const x123 = (x12 + x23) / 2, y123 = (y12 + y23) / 2;
    const dx = x3 - x1, dy = y3 - y1;
    let d = Math.abs((x2 - x3) * dy - (y2 - y3) * dx);
    if (d > 1e-30) {
      if (d * d <= TOL2 * (dx * dx + dy * dy)) { out.push(x123, y123); return; }
    } else {
      const da = dx * dx + dy * dy;
      const sq = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
      if (da === 0) d = sq(x1, y1, x2, y2);
      else {
        d = ((x2 - x1) * dx + (y2 - y1) * dy) / da;
        if (d > 0 && d < 1) return;
        if (d <= 0) d = sq(x2, y2, x1, y1);
        else if (d >= 1) d = sq(x2, y2, x3, y3);
        else d = sq(x2, y2, x1 + d * dx, y1 + d * dy);
      }
      if (d < TOL2) { out.push(x2, y2); return; }
    }
    recBez(x1, y1, x12, y12, x123, y123, level + 1, out);
    recBez(x123, y123, x23, y23, x3, y3, level + 1, out);
  }
  function glyphPart(ch, cap) {                   // the glyph at the pen origin, in mm (labelcore.text_geom of one char)
    const key = ch + '\u0000' + cap;
    if (glyphCache.has(key)) return glyphCache.get(key);
    const s = (cap / CAP_RATIO) / 100 / 64;       // 26.6 px at 100 px/em -> mm at this cap
    const rings = [];
    let r = null, lx = 0, ly = 0;
    const flush = () => { if (r && r.length >= 6) rings.push(r); r = null; };
    for (const op of outline26(glyphOf(ch))) {
      if (op[0] === 'M') { flush(); lx = op[1] * s; ly = op[2] * s; r = [lx, ly]; }
      else if (op[0] === 'L') { lx = op[1] * s; ly = op[2] * s; r.push(lx, ly); }
      else if (op[0] === 'Q') {
        const x2 = op[1] * s, y2 = op[2] * s, x3 = op[3] * s, y3 = op[4] * s;
        recBez(lx, ly, x2, y2, x3, y3, 0, r); r.push(x3, y3); lx = x3; ly = y3;
      } else flush();
    }
    flush();
    for (const q of rings) {                      // the decomposer closes back onto the start: drop that duplicate
      const n = q.length;
      if (n >= 4 && q[n - 2] === q[0] && q[n - 1] === q[1]) q.length = n - 2;
    }
    const part = rings.filter(q => q.length >= 6).length ? mkPart(rings.filter(q => q.length >= 6)) : null;
    glyphCache.set(key, part);
    return part;
  }
  // pen positions as matplotlib 3.11 lays text out (_text_helpers.layout, shaped by HarfBuzz over FreeType at 100 px/em):
  // each advance and each GPOS kerning value scaled to 26.6 pixels and rounded there, positions summed in 26.6 - checked
  // against matplotlib itself on 'AV TO' (A-V -123 units -> -384/64 px, T-O -29 -> -91/64)
  function penX(s, cap) {
    const scale = (cap / CAP_RATIO) / 100, xs = [], em = 6400 / font.unitsPerEm;
    let x26 = 0, prev = null;
    for (const ch of s) {
      const g = glyphOf(ch);
      if (prev !== null) x26 += Math.floor(font.getKerningValue(prev, g) * em + 0.5);
      xs.push(x26 / 64 * scale);
      x26 += Math.floor(g.advanceWidth * em + 0.5);
      prev = g;
    }
    return xs;
  }
  function glyphList(s, cap, track) {
    const xs = penX(s, cap), chars = [...s], out = [];
    chars.forEach((ch, i) => {
      if (ch === ' ') return;
      const g = glyphPart(ch, cap);
      if (g) out.push(shiftPart(g, xs[i] + i * track, 0));
    });
    return out;
  }
  function trackFor(s, cap) {                     // labels_v5.track_for: every glyph gap >= 0.6 mm, in 0.05 mm steps
    const key = s + '\u0000' + cap;
    if (trackCache.has(key)) return trackCache.get(key);
    let t = 0;
    for (;;) {
      const tr = Math.round(t * 1000) / 1000, gl = glyphList(s, cap, tr);
      let close = false;
      for (let i = 0; i < gl.length && !close; i++) for (let j = i + 1; j < gl.length; j++) {
        if (partsCloser(gl[i], gl[j], GLYPH_GAP - 1e-9)) { close = true; break; }
      }
      if (!close) { trackCache.set(key, tr); return tr; }
      t += TRACK_STEP;
    }
  }
  function text(s, cap) {                         // printtest_v1.text: the string at this cap, tracked, baseline at y 0
    const key = s + '\u0000' + cap;
    if (textCache.has(key)) return textCache.get(key);
    const el = mkEl(glyphList(s, cap, trackFor(s, cap)));
    textCache.set(key, el);
    return el;
  }

  // ===================================================================== the icon (printtest_v1.icon_mm, compact)
  function iconAt(iid, x0, ytop) {
    const ic = D.icons[iid];
    if (!ic) return null;
    return mkEl(ic.polys.map(rr => mkPart(rr.map(ring => { const o = []; for (const [x, y] of ring) o.push(x + x0, y + ytop); return o; }))));
  }

  // ===================================================================== the layout (printtest_v1, verbatim in logic)
  function ok(els) {
    const ks = Object.keys(els);
    for (const k of ks) {
      const a = outsideArea(els[k]);
      if (a > 1e-4) return [false, `${k} leaves the usable face by ${a.toFixed(3)} mm²`];
    }
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const need = (ks[i] + ks[j]).includes('icon') ? GAP_ICON : GAP_TEXT;
      if (elsCloser(els[ks[i]], els[ks[j]], need - 1e-6)) return [false, `${ks[i]} - ${ks[j]} closer than ${need} mm`];
    }
    return [true, null];
  }
  function* capsDown(lo, hi) {
    let c = hi;
    while (c >= lo - 1e-9) { yield Math.round(c * 100) / 100; c -= 0.1; }
  }
  function splits(s, sep) {
    const parts = s.split(sep), out = [[s]];
    for (let k = 1; k < parts.length; k++) out.push([parts.slice(0, k).join(sep).trim(), parts.slice(k).join(sep).trim()]);
    return out;
  }
  function stack(lines, cap, left, top, key) {
    const els = {};
    lines.forEach((ln, n) => { const g = place(text(ln, cap), left, top); els[key + (n + 1)] = g; top = g.miny - GAP_TEXT; });
    return [els, top];
  }
  function secondaryFit(els, secondary, left, top, loose) {
    const seen = new Set(), options = [];
    for (const sep of (loose ? [' · ', ', ', ' '] : [' · '])) {
      for (const lines of splits(secondary, sep)) {
        const key = JSON.stringify(lines);
        if (!seen.has(key)) { seen.add(key); options.push(lines); }
      }
    }
    for (const lines of options) {
      const [add] = stack(lines, SEC_CAP, left, top, 'secondary');
      if (ok({ ...els, ...add })[0]) return [add, lines];
    }
    return [null, null];
  }
  function product(slots, n) {
    let out = [[]];
    for (let i = 0; i < n; i++) { const nx = []; for (const c of out) for (const s of slots) nx.push([...c, s]); out = nx; }
    return out;
  }
  function placeAttrs(els, attrs, nLines, bottom, ordered) {
    if (!attrs.length) return [els, {}];
    const slots = ['below']; for (let i = 0; i < nLines; i++) slots.push(`beside line ${i + 1}`);
    const reading = { below: nLines }; for (let i = 0; i < nLines; i++) reading[`beside line ${i + 1}`] = i;
    const cmpTuple = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; };
    let combos = product(slots, attrs.length).sort((a, b) =>
      (a.filter(s => s !== 'below').length - b.filter(s => s !== 'below').length) || cmpTuple(a, b));
    if (ordered) combos = combos.filter(c => c.every((s, i) => i === 0 || reading[c[i - 1]] <= reading[s]));
    for (const combo of combos) {
      const out = { ...els };
      for (let i = 0; i < nLines; i++) {
        const here = attrs.filter((a, k) => combo[k] === `beside line ${i + 1}`);
        if (!here.length) continue;
        const line = els[`main${i + 1}`];
        let g = place(text(here.join(' · '), SEC_CAP), line.maxx + ATTR_BESIDE_GAP, YTOP);
        g = shift(g, 0, line.miny - g.miny);
        out[`beside${i + 1}`] = g;
      }
      if (!ok(out)[0]) continue;
      const below = attrs.filter((a, k) => combo[k] === 'below');
      if (below.length) {
        const [add] = secondaryFit(out, below.join(' · '), X0, bottom, false);
        if (!add) continue;
        Object.assign(out, add);
      }
      const where = {}; attrs.forEach((a, k) => { where[a] = combo[k]; });
      return [out, where];
    }
    return null;
  }
  let iconPosCache = new Map();
  function compactIcon(iid) {                     // the compact icon top-right: the rightmost 0.2 mm step that stays inside
    if (iconPosCache.has(iid)) return iconPosCache.get(iid);
    let g = null;
    for (let k = 560; k > 200; k -= 2) {
      const xr = k / 10 - 28.5;                   // Python frame x -> generator frame
      const t = iconAt(iid, xr - RU.iconCompact, YTOP);
      if (!t) break;
      if (outsideArea(t) < 1e-4) { g = t; break; }
    }
    iconPosCache.set(iid, g);
    return g;
  }
  function fieldsValue(fields, opts) {
    const required = opts.pinned || [], order = opts.order || null, iid = opts.iid || null;
    const optional = (opts.optional || []).filter(a => !required.includes(a));
    const tried = [];
    const valueSplits = [[fields.join(' ')]];
    for (let k = 1; k < fields.length; k++) valueSplits.push([fields.slice(0, k).join(' '), fields.slice(k).join(' ')]);
    const iconG = iid ? compactIcon(iid) : null;
    for (let nOpt = optional.length; nOpt >= 0; nOpt--) {
      const attrs = [...required, ...optional.slice(0, nOpt)];
      if (order) attrs.sort((a, b) => (order.includes(a) ? order.indexOf(a) : order.length) - (order.includes(b) ? order.indexOf(b) : order.length));
      for (const withIcon of (iconG ? [true, false] : [false])) {
        let best = null;
        for (const lines of valueSplits) {
          for (const cap of capsDown(MAIN_MIN, MAIN_MAX)) {
            if (best && cap <= best[1]) break;
            const [els, bottom] = stack(lines, cap, X0, YTOP, 'main');
            if (withIcon) els.icon = iconG;
            if (!ok(els)[0]) continue;
            const placed = placeAttrs(els, attrs, lines.length, bottom, !!(order && order.length));
            if (!placed) continue;
            best = [lines, cap, placed[0], placed[1]];
            break;
          }
        }
        if (best) {
          const [lines, cap, els, where] = best;
          return [els, { layout: 'value by fields + attributes', fields: [...fields], main_lines: lines, main_cap: cap,
            attributes: attrs, attribute_places: where, pinned: [...required], not_shown: optional.slice(nOpt),
            secondary_cap: attrs.length ? SEC_CAP : null, icon: withIcon ? iid : null,
            icon_version: withIcon ? 'compact' : null, tried_before: tried }];
        }
        tried.push(`attributes ${JSON.stringify(attrs)} ${withIcon ? 'with' : 'without'} the icon: no split fits at >= ${MAIN_MIN} mm caps`);
      }
    }
    return [null, { layout: 'value by fields + attributes', fields: [...fields], pinned: [...required], not_shown: [...optional],
      nonfit: `'${fields.join(' ')}' with its pinned attributes ${required.join(', ') || '(none)'} does not fit at the minimum sizes - unpin one or choose a larger label`,
      tried }];
  }

  // ===================================================================== label items (label_from_items)
  function printable(s) {
    s = String(s).toUpperCase();
    for (const [a, b] of FONT_SUBS) s = s.split(a).join(b);
    return s;
  }
  function attrText(it, path) {
    const a = (it.attributes || []).find(x => x.path === path);
    if (!a) throw new Error(`label item ${it.id}: no attribute for path ${path}`);
    return printable(a.text);
  }
  function ringsOut(el) { return el.parts.map(p => p.rings.map(r => r.slice())); }
  function layOut(it) {
    if (!font) throw new Error('hardware-layout: setFont() first');
    if (!it.fields || !it.fields.length) return notReady(it);
    const byPath = {}; for (const a of it.attributes || []) byPath[a.path] = printable(a.text);
    const pinned = (it.pinned || []).map(p => attrText(it, p));
    const optional = (it.optional || []).map(p => attrText(it, p));
    const fields = it.fields.map(printable);
    const order = (it.attributes || []).map(a => byPath[a.path]);
    const [els, r] = fieldsValue(fields, { pinned, optional, iid: FAMILY_ICON[it.family], order });
    const textOf = {}; for (const [k, v] of Object.entries(byPath)) textOf[v] = k;
    const rec = { ...r };
    delete rec.tried_before;
    rec.not_shown_paths = (r.not_shown || []).map(t => textOf[t]);
    rec.pinned_unprinted = it.pinned_unprinted || [];
    rec.value_missing = it.value_missing || [];
    const elements = els ? Object.fromEntries(Object.entries(els).map(([k, el]) => [k, ringsOut(el)])) : null;
    return { elements, record: rec };
  }
  function notReady(it) {        // no value to print (the size is not recorded): never a placeholder like 'M?'
    return { elements: null, record: { not_ready: (it.value_missing || []).map(m => m.why).join(', ') || 'no value to print',
      value_missing: it.value_missing || [], pinned_unprinted: it.pinned_unprinted || [], not_shown: [], attributes: [] } };
  }
  // a NON-FIT with pins: the layout leaving off the FEWEST lowest-priority pins (never the first, the type). A PROPOSAL only:
  // the label stays a non-fit until the person unpins (label_from_items.propose, Astra 2026-10-06)
  function propose(it) {
    const order = it.pinned_by_priority || it.pinned || [];
    for (let k = 1; k < order.length; k++) {
      const drop = order.slice(order.length - k);
      const trial = { ...it, pinned: (it.pinned || []).filter(p => !drop.includes(p)) };
      const r = layOut(trial);
      if (r.elements && !r.record.nonfit) return { ...r, record: { ...r.record, proposal: true, omit_paths: drop, omit: drop.map(p => attrText(it, p)) } };
    }
    const keep = order.length ? (it.attributes.find(a => a.path === order[0]) || {}).text : null;
    return { elements: null, record: { why: keep ? `nothing fits even with only ${keep} pinned: ${keep} itself does not fit beside or under '${it.fields.join(' ')}' at the minimum sizes`
                                                 : 'no pins to leave off' } };
  }

  return { setFont, layOut, propose, printable, FACE: D.face, USABLE: D.usable, X0, YTOP,
           _text: text, _trackFor: trackFor, _penX: penX, _glyphPart: glyphPart, _ok: ok };
}

root.GEN2HardwareLayout = { version: 1, create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
