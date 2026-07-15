/* ================================================================
   PINK PEARL COUTURE ZM — STANDALONE BARCODE APP
   File: app.js
   All data lives in this browser's localStorage. No server,
   no login, no internet needed after the first load.
================================================================ */

const STORAGE_KEY     = 'ppc_barcode_items';
const COUNTER_KEY     = 'ppc_barcode_counter';
const SKU_COUNTER_KEY = 'ppc_sku_counter';
const PRINTED_KEY     = 'ppc_barcode_printed_count';

let ITEMS    = [];
let SELECTED = new Set();

/* ── Init ─────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  load();
  renderList();
  renderStats();
});

function load() {
  try {
    ITEMS = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (_) { ITEMS = []; }
  // Migrate older records that only had a combined "sku" field (used as the
  // barcode) into the new separate sku/barcode shape.
  let migrated = false;
  ITEMS.forEach(it => {
    if (!it.barcode) {
      it.barcode = it.sku || '';
      it.sku = '';
      migrated = true;
    }
  });
  if (migrated) save();
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ITEMS));
  renderStats();
}

function renderStats() {
  const total = ITEMS.length;
  const printed = sessionStorage.getItem(PRINTED_KEY) || 0;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPrinted').textContent = printed;
  const mTotal = document.getElementById('statTotalMobile');
  const mPrinted = document.getElementById('statPrintedMobile');
  if (mTotal) mTotal.textContent = total;
  if (mPrinted) mPrinted.textContent = printed;
}

/* ── Auto barcode generator (SKU and barcode are separate fields) ── */
function nextBarcode() {
  let counter = parseInt(localStorage.getItem(COUNTER_KEY)) || 100000;
  counter += 1;
  // Make sure it's not already used as a barcode OR a SKU on any item
  while (ITEMS.some(it => it.barcode === String(counter) || it.sku === String(counter))) counter += 1;
  localStorage.setItem(COUNTER_KEY, counter);
  return String(counter);
}

function autoGenerateBarcode() {
  document.getElementById('fBarcode').value = nextBarcode();
}

/* ── Auto SKU generator (separate counter/field from barcode) ────── */
function skuPrefixFromName(name) {
  const words = String(name ?? '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'SKU';

  let prefix;
  if (words.length === 1) {
    prefix = words[0].slice(0, 3).toUpperCase();
  } else {
    prefix = words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
  }
  return prefix || 'SKU';
}

function nextSku(name) {
  const prefix = skuPrefixFromName(name);
  let n = 1;
  let candidate;
  do {
    candidate = `${prefix}-${String(n).padStart(3, '0')}`;
    n++;
  } while (ITEMS.some(it => it.sku === candidate || it.barcode === candidate));
  return candidate;
}

function autoGenerateSku() {
  const name = document.getElementById('fName').value.trim();
  document.getElementById('fSku').value = nextSku(name);
}

/* ── Sizes helper ─────────────────────────────────────── */
function parseSizes(raw) {
  return String(raw ?? '')
    .split(/[,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function makeItem(name, price, sku, barcode) {
  return {
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, price, sku: sku || '', barcode,
  };
}

/* ── Add item ───────────────────────────────────────── */
function addItem() {
  const name    = document.getElementById('fName').value.trim();
  const price   = document.getElementById('fPrice').value.trim();
  const sku     = document.getElementById('fSku').value.trim();
  const barcode = document.getElementById('fBarcode').value.trim();
  const sizes   = parseSizes(document.getElementById('fSizes').value);

  if (!name) { showToast('Enter an item name first.'); return; }

  if (sizes.length > 0) {
    let added = 0;
    sizes.forEach(size => {
      const itemBarcode = nextBarcode();
      ITEMS.unshift(makeItem(`${name} - ${size}`, price, sku, itemBarcode));
      added++;
    });
    save();
    document.getElementById('fName').value = '';
    document.getElementById('fPrice').value = '';
    document.getElementById('fSizes').value = '';
    document.getElementById('fSku').value = '';
    document.getElementById('fBarcode').value = '';
    document.getElementById('fName').focus();
    renderList();
    showToast(`${added} size(s) saved, each with its own barcode.`);
    return;
  }

  if (!barcode) { showToast('Add a barcode number, or click "Generate number".'); return; }

  if (ITEMS.some(it => it.barcode === barcode)) {
    showToast(`That barcode is already used by "${ITEMS.find(it => it.barcode === barcode).name}".`);
    return;
  }

  ITEMS.unshift(makeItem(name, price, sku, barcode));
  save();

  document.getElementById('fName').value = '';
  document.getElementById('fPrice').value = '';
  document.getElementById('fSku').value = '';
  document.getElementById('fBarcode').value = '';
  document.getElementById('fName').focus();

  renderList();
  showToast('Item saved.');
}

/* ── Bulk add ─────────────────────────────────────────────────── */
function toggleBulk() {
  const card = document.getElementById('bulkCard');
  card.style.display = card.style.display === 'none' ? 'block' : 'none';
  if (card.style.display === 'block') document.getElementById('bulkText').focus();
}

function addBulk() {
  const raw = document.getElementById('bulkText').value;
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    showToast('Paste at least one item first.');
    return;
  }

  let added = 0;
  lines.forEach(line => {
    const parts = line.split(',').map(p => p.trim());
    const name = parts[0];
    const price = parts[1] || '';
    const sizes = parseSizes(parts[2] || '');
    const sku = parts[3] || '';
    if (!name) return;

    if (sizes.length > 0) {
      sizes.forEach(size => {
        const item = makeItem(`${name} - ${size}`, price, sku, nextBarcode());
        ITEMS.unshift(item);
        SELECTED.add(item.id);
        added++;
      });
    } else {
      const item = makeItem(name, price, sku, nextBarcode());
      ITEMS.unshift(item);
      SELECTED.add(item.id);
      added++;
    }
  });

  save();
  document.getElementById('bulkText').value = '';
  renderList();
  showToast(`${added} item(s) saved with new barcodes and selected for printing.`);
}

function selectAllVisible() {
  getFiltered().forEach(it => SELECTED.add(it.id));
  renderList();
}

function clearSelection() {
  SELECTED.clear();
  renderList();
}

function deleteItem(id) {
  if (!confirm('Remove this item from your list?')) return;
  ITEMS = ITEMS.filter(it => it.id !== id);
  SELECTED.delete(id);
  save();
  renderList();
}

/* ── Edit item (Update) ─────────────────────────────── */
function openEdit(id) {
  const it = ITEMS.find(i => i.id === id);
  if (!it) return;
  document.getElementById('eId').value = it.id;
  document.getElementById('eName').value = it.name || '';
  document.getElementById('ePrice').value = it.price || '';
  document.getElementById('eSku').value = it.sku || '';
  document.getElementById('eBarcode').value = it.barcode || '';
  document.getElementById('editOverlay').style.display = 'flex';
}

function closeEdit() {
  document.getElementById('editOverlay').style.display = 'none';
}

function saveEdit() {
  const id      = document.getElementById('eId').value;
  const name    = document.getElementById('eName').value.trim();
  const price   = document.getElementById('ePrice').value.trim();
  const sku     = document.getElementById('eSku').value.trim();
  const barcode = document.getElementById('eBarcode').value.trim();

  if (!name)    { showToast('Item name cannot be empty.'); return; }
  if (!barcode) { showToast('Barcode number cannot be empty.'); return; }

  const clash = ITEMS.find(i => i.barcode === barcode && i.id !== id);
  if (clash) { showToast(`That barcode is already used by "${clash.name}".`); return; }

  const it = ITEMS.find(i => i.id === id);
  if (!it) { showToast('Item not found.'); closeEdit(); return; }

  it.name = name;
  it.price = price;
  it.sku = sku;
  it.barcode = barcode;

  save();
  renderList();
  closeEdit();
  showToast('Item updated.');
}

/* ── List rendering ───────────────────────────────────────────── */
function getFiltered() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const onlySel = document.getElementById('onlySelected').checked;
  return ITEMS.filter(it => {
    if (onlySel && !SELECTED.has(it.id)) return false;
    if (q && !(
      it.name.toLowerCase().includes(q) ||
      (it.sku || '').toLowerCase().includes(q) ||
      (it.barcode || '').includes(q)
    )) return false;
    return true;
  });
}

function renderList() {
  const items = getFiltered();
  const list  = document.getElementById('itemList');

  if (items.length === 0) {
    list.innerHTML = ITEMS.length === 0
      ? '<div class="empty-state">No items yet — add your first one above.</div>'
      : '<div class="empty-state">No items match. Try clearing filters.</div>';
    updatePrintCount();
    return;
  }

  list.innerHTML = items.map(it => `
    <div class="item-row ${SELECTED.has(it.id) ? 'selected' : ''}" data-id="${it.id}">
      <input type="checkbox" class="item-row__check" ${SELECTED.has(it.id) ? 'checked' : ''}
             onchange="toggleSelect('${it.id}', this.checked)">
      <div>
        <div class="item-row__name">${escapeHtml(it.name)}</div>
        ${it.price ? `<div class="item-row__price">K${escapeHtml(it.price)}</div>` : ''}
        ${it.sku ? `<div class="item-row__sku">SKU: ${escapeHtml(it.sku)}</div>` : ''}
        <div class="item-row__sku">Barcode: ${escapeHtml(it.barcode)}</div>
      </div>
      <div class="item-row__qty">
        <input type="number" min="1" value="1" id="qty-${it.id}" title="Copies to print">
      </div>
      <div class="item-row__actions">
        <button class="action-btn" onclick="openEdit('${it.id}')">Edit</button>
        <button class="action-btn del" onclick="deleteItem('${it.id}')">Remove</button>
      </div>
      <div></div>
    </div>
  `).join('');

  updatePrintCount();
}

function toggleSelect(id, checked) {
  if (checked) SELECTED.add(id); else SELECTED.delete(id);
  document.querySelector(`.item-row[data-id="${id}"]`)?.classList.toggle('selected', checked);
  updatePrintCount();
}

function updatePrintCount() {
  document.getElementById('printCount').textContent = SELECTED.size;
}

/* ── Print ────────────────────────────────────────────────────── */
function printSelected() {
  if (SELECTED.size === 0) {
    showToast('Tick at least one item to print.');
    return;
  }

  const w = document.getElementById('labelW').value || 60;
  const h = document.getElementById('labelH').value || 40;
  document.documentElement.style.setProperty('--label-w', w + 'mm');
  document.documentElement.style.setProperty('--label-h', h + 'mm');

  // Inject a real @page size rule with the actual numbers. CSS variables
  // are not reliably supported inside @page, so this must be plain values —
  // otherwise the browser/driver falls back to a default paper size that
  // won't match the physical label, causing content to split across
  // multiple physical labels.
  let pageStyle = document.getElementById('dynamicPageSize');
  if (!pageStyle) {
    pageStyle = document.createElement('style');
    pageStyle.id = 'dynamicPageSize';
    document.head.appendChild(pageStyle);
  }
  pageStyle.textContent = `@media print { @page { size: ${w}mm ${h}mm; margin: 0; } }`;

  const printArea = document.getElementById('printArea');
  printArea.innerHTML = '';
  let totalLabels = 0;

  [...SELECTED].forEach(id => {
    const it = ITEMS.find(i => i.id === id);
    if (!it) return;
    const qty = parseInt(document.getElementById(`qty-${id}`)?.value) || 1;

    for (let i = 0; i < qty; i++) {
      totalLabels++;
      const div = document.createElement('div');
      div.className = 'print-label';

      const nameEl = document.createElement('div');
      nameEl.className = 'print-label__name';
      nameEl.innerText = it.name;
      div.appendChild(nameEl);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      div.appendChild(svg);

      if (it.price) {
        const priceEl = document.createElement('div');
        priceEl.className = 'print-label__price';
        priceEl.innerText = `K${it.price}`;
        div.appendChild(priceEl);
      }

      printArea.appendChild(div);

      try {
        const cleanBarcode = sanitizeBarcode(it.barcode);
        JsBarcode(svg, cleanBarcode, {
          format: 'CODE128', displayValue: true, fontSize: 12, height: 55, margin: 2,
        });
      } catch (e) {
        svg.outerHTML = `<div style="color:red;font-size:8px;text-align:center;padding:2px;">Invalid barcode: "${escapeHtml(it.barcode)}"<br>${escapeHtml(e.message || '')}</div>`;
      }
    }
  });

  const prevCount = parseInt(sessionStorage.getItem(PRINTED_KEY)) || 0;
  sessionStorage.setItem(PRINTED_KEY, prevCount + totalLabels);
  renderStats();

  setTimeout(() => window.print(), 150);
}

/* ── Backup / restore ─────────────────────────────────────────── */
function exportData() {
  const blob = new Blob([JSON.stringify(ITEMS, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `pink-pearl-barcodes-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded.');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const incoming = JSON.parse(e.target.result);
      if (!Array.isArray(incoming)) throw new Error('Not a valid backup file.');
      let added = 0;
      incoming.forEach(it => {
        // Support both new-format ({sku, barcode}) and old-format ({sku only}) backups.
        const barcode = it.barcode || it.sku || '';
        if (barcode && !ITEMS.some(existing => existing.barcode === barcode)) {
          it.barcode = barcode;
          if (!it.barcode || it.sku === barcode) it.sku = it.sku === barcode ? '' : (it.sku || '');
          ITEMS.push(it);
          added++;
        }
      });
      save();
      renderList();
      showToast(`Imported ${added} item(s).`);
    } catch (err) {
      showToast('Could not read that file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

/* ── Toast ────────────────────────────────────────────────────── */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.innerText = str ?? '';
  return d.innerHTML;
}

function sanitizeBarcode(barcode) {
  return String(barcode ?? '')
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')   // en/em dash, hyphen variants → plain hyphen
    .replace(/[\u2018\u2019]/g, "'")    // curly single quotes → straight
    .replace(/[\u201C\u201D]/g, '"')    // curly double quotes → straight
    .replace(/\u00A0/g, ' ');           // non-breaking space → normal space
}

/* Enter key on add-item fields */
['fName', 'fPrice', 'fSku', 'fBarcode'].forEach(id => {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') addItem();
    });
  });
});
