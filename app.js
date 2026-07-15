/* ================================================================
   PINK PEARL COUTURE ZM — STANDALONE BARCODE APP
   File: app.js
   All data lives in this browser's localStorage. No server,
   no login, no internet needed after the first load.
================================================================ */

const STORAGE_KEY   = 'ppc_barcode_items';
const COUNTER_KEY   = 'ppc_barcode_counter';
const PRINTED_KEY   = 'ppc_barcode_printed_count';

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

/* ── Auto SKU generator ───────────────────────────────────────── */
function nextSku() {
  let counter = parseInt(localStorage.getItem(COUNTER_KEY)) || 100000;
  counter += 1;
  // Make sure it's not already used
  while (ITEMS.some(it => it.sku === String(counter))) counter += 1;
  localStorage.setItem(COUNTER_KEY, counter);
  return String(counter);
}

function autoGenerateSku() {
  document.getElementById('fSku').value = nextSku();
}

/* ── Sizes helper ─────────────────────────────────────── */
function parseSizes(raw) {
  return String(raw ?? '')
    .split(/[,;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function makeItem(name, price, sku) {
  return {
    id: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name, price, sku,
  };
}

/* ── Add item ───────────────────────────────────────── */
function addItem() {
  const name   = document.getElementById('fName').value.trim();
  const price  = document.getElementById('fPrice').value.trim();
  const sku    = document.getElementById('fSku').value.trim();
  const sizes  = parseSizes(document.getElementById('fSizes').value);

  if (!name) { showToast('Enter an item name first.'); return; }

  if (sizes.length > 0) {
    let added = 0;
    sizes.forEach(size => {
      const itemSku = nextSku();
      ITEMS.unshift(makeItem(`${name} - ${size}`, price, itemSku));
      added++;
    });
    save();
    document.getElementById('fName').value = '';
    document.getElementById('fPrice').value = '';
    document.getElementById('fSizes').value = '';
    document.getElementById('fSku').value = '';
    document.getElementById('fName').focus();
    renderList();
    showToast(`${added} size(s) saved, each with its own SKU.`);
    return;
  }

  if (!sku)  { showToast('Add a SKU, or click "Generate number".'); return; }

  if (ITEMS.some(it => it.sku === sku)) {
    showToast(`That SKU is already used by "${ITEMS.find(it => it.sku === sku).name}".`);
    return;
  }

  ITEMS.unshift(makeItem(name, price, sku));
  save();

  document.getElementById('fName').value = '';
  document.getElementById('fPrice').value = '';
  document.getElementById('fSku').value = '';
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
    if (!name) return;

    if (sizes.length > 0) {
      sizes.forEach(size => {
        const item = makeItem(`${name} - ${size}`, price, nextSku());
        ITEMS.unshift(item);
        SELECTED.add(item.id);
        added++;
      });
    } else {
      const item = makeItem(name, price, nextSku());
      ITEMS.unshift(item);
      SELECTED.add(item.id);
      added++;
    }
  });

  save();
  document.getElementById('bulkText').value = '';
  renderList();
  showToast(`${added} item(s) saved with new SKUs and selected for printing.`);
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

/* ── List rendering ───────────────────────────────────────────── */
function getFiltered() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  const onlySel = document.getElementById('onlySelected').checked;
  return ITEMS.filter(it => {
    if (onlySel && !SELECTED.has(it.id)) return false;
    if (q && !(it.name.toLowerCase().includes(q) || it.sku.includes(q))) return false;
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
        <div class="item-row__sku">${escapeHtml(it.sku)}</div>
      </div>
      <div class="item-row__qty">
        <input type="number" min="1" value="1" id="qty-${it.id}" title="Copies to print">
      </div>
      <div class="item-row__actions">
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

  const w = document.getElementById('labelW').value || 40;
  const h = document.getElementById('labelH').value || 30;
  document.documentElement.style.setProperty('--label-w', w + 'mm');
  document.documentElement.style.setProperty('--label-h', h + 'mm');

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
        const cleanSku = sanitizeSku(it.sku);
        JsBarcode(svg, cleanSku, {
          format: 'CODE128', displayValue: true, fontSize: 12, height: 40, margin: 2,
        });
      } catch (e) {
        svg.outerHTML = `<div style="color:red;font-size:8px;text-align:center;padding:2px;">Invalid SKU: "${escapeHtml(it.sku)}"<br>${escapeHtml(e.message || '')}</div>`;
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
        if (it.sku && !ITEMS.some(existing => existing.sku === it.sku)) {
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

function sanitizeSku(sku) {
  return String(sku ?? '')
    .trim()
    .replace(/[\u2010-\u2015]/g, '-')   // en/em dash, hyphen variants → plain hyphen
    .replace(/[\u2018\u2019]/g, "'")    // curly single quotes → straight
    .replace(/[\u201C\u201D]/g, '"')    // curly double quotes → straight
    .replace(/\u00A0/g, ' ');           // non-breaking space → normal space
}

/* Enter key on add-item fields */
['fName', 'fPrice', 'fSku'].forEach(id => {
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') addItem();
    });
  });
});
