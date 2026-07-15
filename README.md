# Pink Pearl Couture — Standalone Barcode Label App

A fully offline, standalone barcode label generator. No server, no login,
no Supabase, no internet required after first load. Built as a lightweight
replacement for the earlier Supabase-backed `barcode-labels.html` page that
lived inside the main `pink-pearl-couture` website repo (that page and its
supporting files were removed from that repo via `git revert` once this
standalone version was adopted — see "History" below).

---

## Quick start

1. Open `index.html` directly in Chrome or Edge (double-click, or drag into
   the browser). No build step, no install required to just use it.
2. Optional: install as a desktop app — click the install icon (⊕) in the
   address bar, or browser menu → "Install Pink Pearl Couture — Barcode
   Labels". Runs in its own window afterward.
3. Add an item (name, price, SKU), tick it, hit Print.

---

## File structure

```
pink-pearl-barcode-app/
├── index.html       — UI markup + all CSS (mobile-first, desktop enhancement via @media)
├── app.js           — All application logic (storage, rendering, printing)
├── manifest.json     — PWA manifest, makes the app installable
├── sw.js             — Service worker, caches app shell for offline use
└── assets/
    ├── icon.svg               — App icon (used by manifest + browser tab)
    └── JsBarcode.all.min.js   — Barcode rendering library, bundled locally
                                  (NOT loaded from CDN — see "Why local JsBarcode" below)
```

No `node_modules`, no `package.json`, no build tooling. This is intentionally
plain HTML/CSS/JS so it keeps working indefinitely without dependency rot.

---

## Data model & storage

Everything lives in the browser's `localStorage`, scoped to whichever
browser profile opens `index.html`. There is no backend and no shared
database.

| Key | Purpose |
|---|---|
| `ppc_barcode_items` | JSON array of saved items: `{ id, name, price, sku }` |
| `ppc_barcode_counter` | Last auto-generated SKU number (for "Generate number" button) |
| `ppc_barcode_printed_count` | Session-only print counter (uses `sessionStorage`, resets on tab close) |

**Important implications:**
- Data does **not** sync between devices or browsers. Each install/browser
  has its own separate item list.
- Data does **not** travel with the app files if you copy the folder to
  another machine. Use **Export backup** (downloads a `.json` snapshot) and
  **Import backup** (merges by SKU, skips duplicates) to move data between
  installs.
- Clearing browser data/cache on that machine wipes the saved items. There's
  no cloud copy — the Export backup file is the only durable backup.

---

## SKU / barcode field

One combined field is used for both the barcode's encoded value and the
human-readable SKU shown under each item (deliberate simplification vs. the
old dashboard, which has separate SKU and Barcode columns — see the
dashboard reference screenshots discussed when this was built, if revisiting
that decision).

- Accepts letters, numbers, and dashes (e.g. `V000000`, `V-00-0044`).
- The "Generate number" button auto-fills a sequential 6-digit numeric SKU
  starting from 100001, tracked via `ppc_barcode_counter`.
- Duplicate SKUs are rejected on add.
- `sanitizeSku()` in `app.js` normalizes "smart" punctuation (curly quotes,
  en/em dashes, non-breaking spaces) to plain ASCII before barcode encoding
  — these are common silent corruption sources from autocorrect/copy-paste
  and will otherwise produce a barcode that looks fine on screen but fails
  to encode.

## Barcode format

CODE128 (JsBarcode's default `CODE128` auto-subset). Supports the full
printable ASCII range, so letters + digits + dashes + spaces all work.

---

## Print flow

1. User ticks items, sets quantity per item, sets label size (mm) in the
   bottom bar.
2. `printSelected()` builds one `.print-label` div per copy into the hidden
   `#printArea`, renders a barcode SVG into each via JsBarcode, then calls
   `window.print()`.
3. A `@media print` block hides everything except `#printArea` and sizes
   each label to the configured width/height via CSS custom properties
   (`--label-w`, `--label-h`).
4. If JsBarcode throws for a given SKU, the label shows the literal error
   and the offending SKU string inline (in red) instead of a generic
   message — this was a deliberate change (see Troubleshooting) so failures
   are self-diagnosing without needing devtools.

---

## Mobile-first layout

Base CSS (outside any `@media` query) targets phones: single-column stacked
fields, 44–48px minimum touch targets, fixed bottom print bar, sticky
condensed top bar with item/print counts.

A single `@media (min-width: 720px)` block is the desktop enhancement layer:
restores the original sidebar dashboard layout (fixed 240px sidebar, static
print bar at the bottom of page content instead of fixed-to-viewport).

If redesigning either layout, keep in mind both share the same underlying
HTML elements (e.g. `#statTotal` for desktop sidebar vs. `#statTotalMobile`
for the phone top bar) — `renderStats()` in `app.js` writes to both sets of
IDs defensively (`if (el) ...`) so either can be removed from the markup
without breaking the other.

---

## Why local JsBarcode (not CDN)

Originally loaded via `<script src="https://cdnjs.cloudflare.com/...">`.
This silently broke the "works fully offline" promise: in Incognito mode,
or on any machine without an active internet connection at load time, the
script tag fails and `JsBarcode` is `undefined` — every barcode print
attempt then throws.

Fixed by downloading the official npm package (`jsbarcode`, MIT licensed)
and copying `dist/JsBarcode.all.min.js` byte-for-byte (checksum-verified)
into `assets/`. `index.html` and `sw.js` now both reference the local copy.
There is no code difference in behavior — it's the same library, just not
network-dependent.

**Remaining non-local dependency:** the Google Fonts stylesheet link
(Cormorant Garamond / Jost) is still loaded remotely. This fails gracefully
— the app falls back to system serif/sans-serif fonts if offline — so it
doesn't block barcode printing, only affects visual polish. Not yet
bundled locally; worth doing if a fully zero-network guarantee is wanted.

---

## Troubleshooting

**"JsBarcode is not defined" printed on the label instead of a barcode**
The library script failed to load. If you ever revert to a CDN-based setup,
this will resurface in Incognito/offline conditions. Should not occur with
the current local `assets/JsBarcode.all.min.js` setup — if it does, check
that file still exists and the `<script src="./assets/JsBarcode.all.min.js">`
tag in `index.html` matches its actual path/filename.

**"Invalid SKU" printed on the label**
The label text now shows the exact SKU string and JsBarcode's real error
message (not a generic message), so check what's printed. Most common
cause: invisible smart-quote/dash characters from autocorrect — `sanitizeSku()`
already guards against the known ones, but a genuinely unsupported character
could still slip through.

**Service worker serving stale files after an update**
Bump `CACHE_NAME` in `sw.js` (e.g. `ppc-barcode-v2` → `v3`) whenever any
cached asset changes. The old cache is deleted automatically on next load
once the version string changes; without bumping it, browsers may keep
serving old cached files indefinitely.

**Data missing after moving the app to a new PC**
Expected — see "Data model & storage" above. Use Export/Import backup.

---

## History

- **Original approach:** a `barcode-labels.html` page inside the main
  `pink-pearl-couture` site repo, backed by Supabase (added a `sku` column
  to the live `products` table via `supabase-add-sku-column.sql`).
- **Decision:** abandoned that approach since the site itself isn't used
  day-to-day (staff use separate POS software for stock), making a
  Supabase-connected page unnecessary overhead. Rebuilt as this fully
  standalone, localStorage-based app instead.
- The original commit (`d047194` — "Add barcode label generator page...")
  that added the Supabase-backed files to the `pink-pearl-couture` repo was
  reverted via `git revert d047194` (not a hard reset, to avoid rewriting
  shared history). The Supabase `sku` column itself was left in place
  (revert only affects git, not the live database) — decide separately if
  that column should be dropped, since it's now unused.
