// Data index: wraps the four JSON files built by tools/build_data.py.
// The loader is injected (fs in node tests, fetch in the browser) so the core stays DOM-free.

export const DATA_FILES = ['bd_standards.json', 'own_tables.json', 'sanity.json', 'lengths_all.json', 'overlay.json'];

export function indexData({ bd, own, sanity, lengthsAll, overlay }) {
  const stds = { ...bd.standards, ...own.standards };
  const version = bd.source.ref;
  const D = {
    bd, own, sanity, lengthsAll, overlay, version,
    std: (id) => (id ? stds[id] || null : null),
    listsOnly: (id) => (id ? bd.lists_only[id] || null : null),
    heads: (family) => own.heads.filter((h) => h.family === family),
    head: (family, id) => own.heads.find((h) => h.family === family && h.id === id) || null,
    // an inch row is a designation AND its threads per inch ('#10' with 24 or 32); a metric row is its diameter
    row(stdId, diameter, tpi = null) {
      const s = stds[stdId];
      if (!s || !s.sizes || diameter === null || diameter === undefined) return null;
      // an inch WASHER row has no threads per inch: its designation alone (2026-10-05)
      if (s.units === 'in' && s.family === 'washer') return s.sizes.find((r) => r.diameter === diameter) || null;
      if (s.units === 'in') return tpi === null ? null : s.sizes.find((r) => r.diameter === diameter && r.tpi === tpi) || null;
      return s.sizes.find((r) => r.diameter === diameter) || null;
    },
    refOf(std, row, what) {
      const base = std.origin === 'bd_warehouse' ? version : 'own';
      return `${base}/${std.id}${row ? '/' + row.size : ''}${what ? '#' + what : ''}`;
    },
    tierOf: (std) => std.tier,
    flagsForRow(stdId, row) {
      if (!row) return [];
      // corrected flags are not warnings any more: the row carries the correction (and its original value)
      return sanity.flags.filter((f) => f.subject === `${stdId}:${row.size}` && f.offered !== false && f.status !== 'corrected');
    },
    allFlags: () => sanity.flags,
    driveType: (id) => own.drive_types.find((d) => d.id === id) || null,
  };
  return D;
}

// node: loadData((name) => readFileSync(join(dataDir, name), 'utf8'))
// browser: await loadDataAsync((name) => fetch('data/' + name).then((r) => r.text()))
export function loadData(readText) {
  const [bd, own, sanity, lengthsAll, overlay] = DATA_FILES.map((n) => JSON.parse(readText(n)));
  return indexData({ bd, own, sanity, lengthsAll, overlay });
}
export async function loadDataAsync(readText) {
  const parts = await Promise.all(DATA_FILES.map(async (n) => JSON.parse(await readText(n))));
  const [bd, own, sanity, lengthsAll, overlay] = parts;
  return indexData({ bd, own, sanity, lengthsAll, overlay });
}
