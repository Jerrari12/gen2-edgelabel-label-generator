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

The exported `.3mf` assigns the **base** to filament 1 and the **text + badge** to filament 2. Open it in OrcaSlicer, Bambu Studio, or PrusaSlicer; if your slicer doesn't auto-detect, set the base to a light filament and the text/badge to a dark one. 0.2 mm layer height works well.

---

## Run it locally

No server needed. Download `index.html` and open it in any modern browser. (It loads three.js, opentype.js, and JSZip from a CDN, so an internet connection is required the first time.)

---

Part of the [GEN2 Modular Storage System](https://jerrari3d.com) by Jerrari3D.

## More from Jerrari3D

- 🌐 [jerrari3d.com](https://jerrari3d.com)
- 🟧 [Printables](https://www.printables.com/@Jerrari)
- 📦 [Thangs](https://thangs.com/designer/Jerrari)
