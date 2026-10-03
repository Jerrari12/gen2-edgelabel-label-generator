# GEN2 EdgeLabel Label Generator · Jerrari3D

A browser-based tool for creating custom **EdgeLabel** faceplate labels for the GEN2 Modular Storage System. No install, no account — open `index.html` and go.

---

## What it does

Generates print-ready, two-color EdgeLabel wedges that clip onto the front edge of GEN2 drawers. Each label has:

- **Left-justified text** that automatically **word-wraps** to new lines and shrinks to fit the label's triangular face.
- An **optional left badge** — either a typed **letter / number / short code** (e.g. `A`, `1`, `M3`) or an **icon**. When a badge is present, the text shifts right to make room; with no badge, the text sits flush left.
- **Icons**: pick from the built-in set, or **upload your own SVG**.

The model is the EdgeLabel V12 wedge (57 × 27 × 4.5 mm): full height on the left, tapering to the angled "flag" on the right.

---

## How to use it

1. Type your text in each label row. Long text wraps automatically.
2. *(Optional)* Click the **badge button** (the `+` left of the text field) to add a letter/number, choose a built-in icon, or upload an SVG.
3. Adjust **Text height**, **Text depth**, and **Badge size** under Settings.
4. *(Optional)* Import a **CSV / TXT** file to create many labels at once (one label's text per row).
5. Click **Download .3mf**.

Your work is **auto-saved in the browser**, so it's still there when you come back. Use **Save / Load → Export** to download your labels + settings as a `.json` file (for backup or moving to another computer), and **Upload** to load one back.

---

## Printing in two colors

The exported `.3mf` assigns the **base** to filament 1 and the **text + badge** to filament 2. Pick the **Export format** for your slicer: **PrusaSlicer**, or **Bambu Studio / OrcaSlicer** (the two slicers read multi-part 3MF files differently, so one file can't serve both; choosing a printer preset picks the matching format for you). If your slicer doesn't auto-detect, set the base to a light filament and the text/badge to a dark one. 0.2 mm layer height works well.

---

## Run it locally

No server needed, and no internet connection required. Download the repo (or clone it) and open `index.html` in any modern browser — the 3D libraries live in `vendor/`, so everything runs from local files.

---

## Development notes

**Third-party libraries are vendored, not loaded from a CDN.** `vendor/` holds three.js 0.146.0, opentype.js 1.3.4, JSZip 3.10.1, and three.js's `SVGLoader`. Older versions pulled these from jsdelivr, which made the tool depend on a third-party host at load time. A user reported it coming up completely blank in Firefox — no label rows, the status frozen on "Loading…" — while it worked in Chrome: their browser was blocking the CDN (DNS-over-HTTPS, tracking protection, or an extension). Serving the libraries from the same origin removes that failure mode entirely; they can't be blocked without blocking the page itself. `.gitattributes` marks `vendor/**` as binary so Git leaves the minified files byte-for-byte.

**Startup fails safe.** `init()` builds the label form *before* initialising three.js, then verifies each library actually loaded and names any that didn't. A missing library or a WebGL failure now leaves a working form with a clear message instead of a dead page; the Download button stays disabled because nothing can be exported without three.js.

**The label itself lives in `label-core.js`.** Everything that decides what ONE label looks like - its dimensions and text area, the word wrap against the slanted edge, the auto-shrink to the 3 mm floor, the left badge and the room it takes, the icon library and the icon prediction - is in that one file; `index.html` keeps the page, the form and the printer layout. The GEN2 3D Build Studio vendors `label-core.js` byte-for-byte (and pins its hash), so a drawer label previewed there is the label printed here. Change the label here, then copy the file to the viewer. The split was checked by building 135 labels, 23 icons and a full STL plate before and after it: byte-identical.

**Build-plate fields fit four digits.** They were previously narrow enough to clip a three-digit value, so a 250 mm plate showed as "25" — easily misread as centimetres. This affected every printer preset at or above 100 mm.

**The embedded font is Liberation Sans Narrow Bold 1.07.4** (© 2010 Oracle and/or its affiliates), stored as base64 in `<script id="font-data" type="text/plain">` so the page needs no font request. It is under the [Liberation Fonts license](https://fedoraproject.org/wiki/Licensing/LiberationFontLicense) (GPLv2 with the font exception), not the SIL OFL an older comment claimed, and not this repository's MIT license, which covers the code only. The `type` keeps the browser from trying to run the blob as JavaScript (it used to log a harmless `SyntaxError` on every load).

---

Part of the [GEN2 Modular Storage System](https://jerrari3d.com) by Jerrari3D.

## More from Jerrari3D

- 🌐 [jerrari3d.com](https://jerrari3d.com)
- 🟧 [Printables](https://www.printables.com/@Jerrari)
- 📦 [Thangs](https://thangs.com/designer/Jerrari)
