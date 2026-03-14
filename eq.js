/* ============================================================
   eq.js — Export Quotation Step Wizard
   IMPEXIO v2
   ============================================================ */

let eqRecords   = JSON.parse(localStorage.getItem('eq_records') || '[]');
let editingId   = null;
let currentStep = 1;
let rowCount    = 0;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSess();
  populateTopbar();
  setTodayDate();
  autoSetQuotNo();
  addRow(); addRow(); addRow(); addRow(); addRow(); // 5 rows default
  renderRecords();
  goToStep(1);
});

function setTodayDate() {
  const el = document.getElementById('f_date');
  if (el && !el.value) el.value = new Date().toISOString().split('T')[0];
}

function autoSetQuotNo() {
  const el = document.getElementById('f_quotno');
  if (el && !el.value) {
    const num = String(eqRecords.length + 1).padStart(4, '0');
    el.value = `EQ/2026/${num}`;
  }
}

function populateTopbar() {
  const s = sess || {};
  setText('dtbUname', s.username || 'Admin');
  setText('dtbRole',  s.role     || 'Administrator');
  const av = document.getElementById('dtbAv');
  if (av) av.textContent = (s.username || 'A')[0].toUpperCase();
  const meta = document.getElementById('dtbMeta');
  if (meta && s.company && s.year) {
    meta.innerHTML = `
      <div class="dtb-chip">🏷️ <strong>${s.clientCode||''}</strong></div>
      <div class="dtb-chip">🏢 <strong>${(s.company.name||'').split(' ').slice(0,3).join(' ')}</strong></div>
      <div class="dtb-chip">📅 <strong>FY ${s.year?.label||''}</strong></div>`;
  }
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function doLogout() {
  if (confirm('Logout from IMPEXIO?')) { sessionStorage.removeItem('impexio'); window.location.href = 'index.html'; }
}
function gv(id) { return document.getElementById(id)?.value?.trim() || ''; }

// ── Step Navigation ───────────────────────────────────────────
function goToStep(n) {
  if (n > currentStep && n === 2) {
    if (!gv('f_quotno')) { showToast('⚠️', 'Please enter Quot. No. first.'); return; }
    if (!gv('f_date'))   { showToast('⚠️', 'Please select Date first.');     return; }
    if (!gv('f_buyer'))  { showToast('⚠️', 'Please enter Buyer name first.'); return; }
  }

  currentStep = n;

  [1,2,3].forEach(i => {
    document.getElementById(`step_${i}`)?.classList.toggle('hidden', i !== n);
  });
  [1,2,3].forEach(i => {
    const dot = document.getElementById(`pstep_${i}`);
    if (!dot) return;
    dot.classList.remove('active','done');
    if (i === n) dot.classList.add('active');
    if (i < n)   dot.classList.add('done');
  });
  document.querySelectorAll('.qpb-connector').forEach((c, idx) => {
    c.classList.toggle('done', idx + 1 < n);
  });

  const subs = {
    1: 'Step 1 of 3 — Header Info',
    2: 'Step 2 of 3 — Product Lines',
    3: 'Step 3 of 3 — Terms & Remarks'
  };
  setText('formSub', subs[n] || '');
  updateInfoStrips();
  if (n === 3) updateSummaryCard();
}

function nextStep(from) { goToStep(from + 1); }
function prevStep(from) { goToStep(from - 1); }

function updateInfoStrips() {
  const quotno  = gv('f_quotno')  || '—';
  const buyer   = gv('f_buyer')   || '—';
  const product = gv('f_product') || '—';
  const country = gv('f_country') || '—';
  const total   = document.getElementById('tot_amt')?.textContent || '0.00';

  setText('s2_quotno',  quotno);  setText('s2_buyer',   buyer);
  setText('s2_product', product); setText('s2_country', country);
  setText('s3_quotno',  quotno);  setText('s3_buyer',   buyer);
  setText('s3_total',   total);
}

// ── Product Rows ──────────────────────────────────────────────
function addRow() {
  rowCount++;
  const id = rowCount;
  const tbody = document.getElementById('productBody');
  const tr = document.createElement('tr');
  tr.id = `qrow_${id}`;
  tr.innerHTML = `
    <td><input type="text"   class="qi-ci"           id="r_desc_${id}"  placeholder="Product description"/></td>
    <td><input type="text"   class="qi-ci qi-ci-num" id="r_hs_${id}"    placeholder="HS Code"/></td>
    <td><input type="number" class="qi-ci qi-ci-num" id="r_qty_${id}"   placeholder="0"    step="0.01" min="0" oninput="calcRow(${id})"/></td>
    <td><input type="number" class="qi-ci qi-ci-num" id="r_rate_${id}"  placeholder="0.00" step="0.01" min="0" oninput="calcRow(${id})"/></td>
    <td><span class="qi-ci-amt" id="r_amt_${id}">0.00</span></td>
    <td><button class="qi-del-btn" onclick="delRow(${id})">✕</button></td>`;
  tbody.appendChild(tr);
}

function delRow(id) {
  const rows = document.getElementById('productBody').querySelectorAll('tr');
  if (rows.length <= 1) { showToast('⚠️', 'At least one product row is required.'); return; }
  document.getElementById(`qrow_${id}`)?.remove();
  calcTotals();
}

function calcRow(id) {
  const qty  = parseFloat(document.getElementById(`r_qty_${id}`)?.value)  || 0;
  const rate = parseFloat(document.getElementById(`r_rate_${id}`)?.value) || 0;
  const amt  = qty * rate;
  const el   = document.getElementById(`r_amt_${id}`);
  if (el) el.textContent = fmtAmt(amt);
  calcTotals();
}

function calcTotals() {
  const tbody = document.getElementById('productBody');
  const rows  = tbody.querySelectorAll('tr');
  let totalQty = 0, totalAmt = 0;

  rows.forEach(tr => {
    const id = tr.id.replace('qrow_','');
    totalQty += parseFloat(document.getElementById(`r_qty_${id}`)?.value) || 0;
    const amtEl = document.getElementById(`r_amt_${id}`);
    totalAmt += parseFloat(amtEl?.textContent?.replace(/,/g,'')) || 0;
  });

  setText('tot_qty', fmtNum(totalQty));
  setText('tot_amt', fmtAmt(totalAmt));
}

function updateSummaryCard() {
  calcTotals();
  setText('sum_qty',     document.getElementById('tot_qty')?.textContent || '0');
  setText('sum_amt',     document.getElementById('tot_amt')?.textContent || '0.00');
  setText('sum_buyer',   gv('f_buyer')   || '—');
  setText('sum_country', gv('f_country') || '—');
}

function fmtNum(n) {
  if (!n || n === 0) return '0';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function fmtAmt(n) {
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,' / ');
}

// ── Collect Rows ──────────────────────────────────────────────
function collectRows() {
  const tbody = document.getElementById('productBody');
  return Array.from(tbody.querySelectorAll('tr')).map(tr => {
    const id = tr.id.replace('qrow_','');
    return {
      desc: document.getElementById(`r_desc_${id}`)?.value || '',
      hs:   document.getElementById(`r_hs_${id}`)?.value   || '',
      qty:  parseFloat(document.getElementById(`r_qty_${id}`)?.value)  || 0,
      rate: parseFloat(document.getElementById(`r_rate_${id}`)?.value) || 0,
      amt:  document.getElementById(`r_amt_${id}`)?.textContent || '0.00',
    };
  }).filter(r => r.desc || r.qty || r.rate);
}

// ── New / Clear ───────────────────────────────────────────────
function newEntry() {
  clearForm();
  editingId = null;
  setText('formTitle', 'New Export Quotation');
  goToStep(1);
  document.querySelectorAll('.ql-card').forEach(c => c.classList.remove('active'));
}

function clearForm() {
  ['f_quotno','f_date','f_product','f_buyer','f_country',
   'f_pol','f_pod','f_incoterms','f_final_dest','f_delivery_time',
   'f_shipment_type','f_payment_terms','f_validity','f_packaging',
   'f_container_size','f_packed_dim','f_inner_pack','f_packed_weight',
   'f_master_pack','f_sample','f_special_inst','f_remarks',
   'f_preparedby','f_signatory'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  // restore default other_desc
  const od = document.getElementById('f_other_desc');
  if (od) od.value = '( Testing Charges, Inspection Charges and Special Packaging Charges will be extra as applicable )';

  setTodayDate();
  autoSetQuotNo();
  document.getElementById('productBody').innerHTML = '';
  rowCount = 0;
  addRow(); addRow(); addRow(); addRow(); addRow();
  calcTotals();
}

// ── Save ──────────────────────────────────────────────────────
function saveRecord() {
  const quotno = gv('f_quotno');
  const date   = gv('f_date');
  const buyer  = gv('f_buyer');
  if (!quotno) { showToast('⚠️','Please enter Quot. No.'); goToStep(1); return; }
  if (!date)   { showToast('⚠️','Please select Date.');    goToStep(1); return; }
  if (!buyer)  { showToast('⚠️','Please enter Buyer.');    goToStep(1); return; }

  calcTotals();
  const rows = collectRows();

  const rec = {
    id: editingId ?? Date.now(),
    quotno, date,
    product:     gv('f_product'),
    buyer,
    country:     gv('f_country'),
    pol:         gv('f_pol'),
    pod:         gv('f_pod'),
    incoterms:   gv('f_incoterms'),
    final_dest:  gv('f_final_dest'),
    delivery_time:   gv('f_delivery_time'),
    shipment_type:   gv('f_shipment_type'),
    payment_terms:   gv('f_payment_terms'),
    validity:        gv('f_validity'),
    packaging:       gv('f_packaging'),
    container_size:  gv('f_container_size'),
    packed_dim:      gv('f_packed_dim'),
    inner_pack:      gv('f_inner_pack'),
    packed_weight:   gv('f_packed_weight'),
    master_pack:     gv('f_master_pack'),
    sample:          gv('f_sample'),
    special_inst:    gv('f_special_inst'),
    other_desc:      gv('f_other_desc'),
    remarks:         gv('f_remarks'),
    preparedby:      gv('f_preparedby'),
    signatory:       gv('f_signatory'),
    rows,
    tot_qty: document.getElementById('tot_qty')?.textContent || '0',
    tot_amt: document.getElementById('tot_amt')?.textContent || '0.00',
  };

  if (editingId !== null) {
    const idx = eqRecords.findIndex(r => r.id === editingId);
    if (idx > -1) eqRecords[idx] = rec; else eqRecords.unshift(rec);
  } else {
    eqRecords.unshift(rec);
  }

  localStorage.setItem('eq_records', JSON.stringify(eqRecords));
  renderRecords();
  showToast('✅', `Quotation ${quotno} saved!`);
  editingId = rec.id;
  setText('formTitle', `Editing: ${quotno}`);
}

// ── Edit ──────────────────────────────────────────────────────
function editRecord(id) {
  const rec = eqRecords.find(r => r.id === id);
  if (!rec) return;
  editingId = id;
  setText('formTitle', `Editing: ${rec.quotno}`);

  const sv = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
  sv('f_quotno',   rec.quotno);   sv('f_date',    rec.date);
  sv('f_product',  rec.product);  sv('f_buyer',   rec.buyer);
  sv('f_country',  rec.country);
  sv('f_pol',      rec.pol);      sv('f_pod',     rec.pod);
  sv('f_incoterms',rec.incoterms);sv('f_final_dest',rec.final_dest);
  sv('f_delivery_time', rec.delivery_time);
  sv('f_shipment_type', rec.shipment_type);
  sv('f_payment_terms', rec.payment_terms);
  sv('f_validity',      rec.validity);
  sv('f_packaging',     rec.packaging);
  sv('f_container_size',rec.container_size);
  sv('f_packed_dim',    rec.packed_dim);
  sv('f_inner_pack',    rec.inner_pack);
  sv('f_packed_weight', rec.packed_weight);
  sv('f_master_pack',   rec.master_pack);
  sv('f_sample',        rec.sample);
  sv('f_special_inst',  rec.special_inst);
  sv('f_other_desc',    rec.other_desc || '( Testing Charges, Inspection Charges and Special Packaging Charges will be extra as applicable )');
  sv('f_remarks',       rec.remarks);
  sv('f_preparedby',    rec.preparedby);
  sv('f_signatory',     rec.signatory);

  // Restore rows
  document.getElementById('productBody').innerHTML = '';
  rowCount = 0;
  if (rec.rows && rec.rows.length > 0) {
    rec.rows.forEach(row => {
      addRow();
      const id2 = rowCount;
      const sv2 = (k, v) => { const el = document.getElementById(`r_${k}_${id2}`); if (el) el.value = v || ''; };
      sv2('desc', row.desc); sv2('hs', row.hs);
      sv2('qty',  row.qty);  sv2('rate', row.rate);
      calcRow(id2);
    });
    // fill to at least 5 rows
    while (rowCount < 5) { addRow(); }
  } else {
    addRow(); addRow(); addRow(); addRow(); addRow();
  }
  calcTotals();

  document.querySelectorAll('.ql-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`eqcard_${id}`)?.classList.add('active');
  goToStep(1);
}

// ── Delete ────────────────────────────────────────────────────
function deleteRecord(id) {
  if (!confirm('Delete this Export Quotation?')) return;
  eqRecords = eqRecords.filter(r => r.id !== id);
  localStorage.setItem('eq_records', JSON.stringify(eqRecords));
  if (editingId === id) newEntry();
  renderRecords();
  showToast('🗑','Record deleted.');
}

// ── Render List ───────────────────────────────────────────────
function renderRecords(data = null) {
  const list  = document.getElementById('recordsList');
  const items = data || eqRecords;
  if (items.length === 0) {
    list.innerHTML = `
      <div class="ql-empty">
        <div style="font-size:1.6rem;opacity:0.35;">📋</div>
        <div class="ql-empty-txt">No records yet</div>
        <div class="ql-empty-sub">Click + New to begin</div>
      </div>`;
    return;
  }
  list.innerHTML = items.map(rec => `
    <div class="ql-card ${editingId===rec.id?'active':''}" id="eqcard_${rec.id}" onclick="editRecord(${rec.id})">
      <div class="ql-card-no">${rec.quotno}</div>
      <div class="ql-card-buyer">${rec.buyer||'—'}</div>
      <div class="ql-card-prod">${rec.product||'—'}</div>
      <div class="ql-card-row">
        <span class="ql-card-date">${fmtDate(rec.date)}</span>
        <span class="ql-card-val">${rec.tot_amt||'0.00'}</span>
      </div>
      <div class="ql-card-acts">
        <button class="ql-act edit" onclick="event.stopPropagation();editRecord(${rec.id})">✏️ Edit</button>
        <button class="ql-act prnt" onclick="event.stopPropagation();printById(${rec.id})">🖨 Print</button>
        <button class="ql-act del"  onclick="event.stopPropagation();deleteRecord(${rec.id})">🗑</button>
      </div>
    </div>`).join('');
}

function filterRecords() {
  const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
  if (!q) { renderRecords(); return; }
  renderRecords(eqRecords.filter(r =>
    r.quotno?.toLowerCase().includes(q) ||
    r.buyer?.toLowerCase().includes(q)  ||
    r.product?.toLowerCase().includes(q)
  ));
}

// ── Print ─────────────────────────────────────────────────────
function printRecord() {
  calcTotals();
  doPrint({
    quotno: gv('f_quotno'), date: gv('f_date'),
    product: gv('f_product'), buyer: gv('f_buyer'), country: gv('f_country'),
    pol: gv('f_pol'), pod: gv('f_pod'),
    incoterms: gv('f_incoterms'), final_dest: gv('f_final_dest'),
    delivery_time: gv('f_delivery_time'), shipment_type: gv('f_shipment_type'),
    payment_terms: gv('f_payment_terms'), validity: gv('f_validity'),
    packaging: gv('f_packaging'), container_size: gv('f_container_size'),
    packed_dim: gv('f_packed_dim'), inner_pack: gv('f_inner_pack'),
    packed_weight: gv('f_packed_weight'), master_pack: gv('f_master_pack'),
    sample: gv('f_sample'), special_inst: gv('f_special_inst'),
    other_desc: gv('f_other_desc'), remarks: gv('f_remarks'),
    preparedby: gv('f_preparedby'), signatory: gv('f_signatory'),
    rows: collectRows(),
    tot_qty: document.getElementById('tot_qty')?.textContent || '0',
    tot_amt: document.getElementById('tot_amt')?.textContent || '0.00',
  });
}

function printById(id) {
  const rec = eqRecords.find(r => r.id === id);
  if (rec) doPrint(rec);
}

function doPrint(rec) {
  const client = sess?.clientCode || 'Demo001';

  const productRows = (rec.rows || []).map(r => `
    <tr>
      <td class="desc-td">${r.desc||''}</td>
      <td>${r.hs||''}</td>
      <td>${r.qty||''}</td>
      <td>${r.rate ? fmtAmt(r.rate) : ''}</td>
      <td>${r.amt||''}</td>
    </tr>`).join('');

  const emptyRows = Math.max(0, 12 - (rec.rows||[]).length);
  const padRows   = Array(emptyRows).fill('<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>').join('');

  // Terms grid
  const termPairs = [
    ['Port of Loading',    rec.pol],
    ['Port of Discharge',  rec.pod],
    ['Inco Terms',         rec.incoterms],
    ['Final Destination',  rec.final_dest],
    ['Delivery Time',      rec.delivery_time],
    ['Shipment Type',      rec.shipment_type],
    ['Payment Terms',      rec.payment_terms],
    ['Quotation Validity', rec.validity],
    ['Packaging / Labeling',rec.packaging],
    ['Container Size',     rec.container_size],
    ['Packed Dimension',   rec.packed_dim],
    ['Total Inner Pack',   rec.inner_pack],
    ['Packed Weight',      rec.packed_weight],
    ['Total Master Pack',  rec.master_pack],
  ];
  const termsHTML = termPairs.map(([l,v]) => `
    <div class="qp-term-item">
      <span class="qp-term-lbl">${l}:</span>
      <span class="qp-term-val">${v||''}</span>
    </div>`).join('');

  document.getElementById('printArea').innerHTML = `
  <div class="qp-doc">
    <div class="qp-hdr">
      <div class="qp-hdr-title">IMPEXIO &mdash; EXPORT QUOTATION</div>
    </div>
    <div class="qp-teal-bar"></div>

    <div class="qp-meta">
      <div class="qp-meta-item"><span class="qp-meta-lbl">Quot. No.:&nbsp;</span><span class="qp-meta-val">${rec.quotno||''}</span></div>
      <div class="qp-meta-item"><span class="qp-meta-lbl">Date:&nbsp;</span><span class="qp-meta-val">${fmtDate(rec.date)}</span></div>
      <div class="qp-meta-item"><span class="qp-meta-lbl">Country:&nbsp;</span><span class="qp-meta-val">${rec.country||''}</span></div>
      <div class="qp-meta-item"><span class="qp-meta-lbl">Product:&nbsp;</span><span class="qp-meta-val">${rec.product||''}</span></div>
      <div class="qp-meta-item" style="grid-column:2/-1;"><span class="qp-meta-lbl">Buyer:&nbsp;</span><span class="qp-meta-val">${rec.buyer||''}</span></div>
    </div>

    <table class="qp-tbl">
      <thead>
        <tr>
          <th class="desc-th">Product Description</th>
          <th>HS Code</th>
          <th>Qty</th>
          <th>Rate CIF</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${productRows}
        ${padRows}
        <tr class="qp-tot-row">
          <td colspan="2" style="text-align:right;font-size:8pt;letter-spacing:0.12em;">TOTAL</td>
          <td>${rec.tot_qty||'0'}</td>
          <td></td>
          <td class="qp-tot-gold">${rec.tot_amt||'0.00'}</td>
        </tr>
      </tbody>
    </table>

    <div class="qp-sec-hd">Other Details With Terms &amp; Conditions</div>
    <div class="qp-terms">${termsHTML}</div>

    <div class="qp-sample-box">
      <div class="qp-sample-row">
        <div class="qp-sample-item">
          <span class="qp-sample-lbl">Sample:</span>
          <span class="qp-sample-val">${rec.sample || '( Sample not yet approved )'}</span>
        </div>
        <div class="qp-sample-item">
          <span class="qp-sample-lbl">Special Instructions:</span>
          <span class="qp-sample-val">${rec.special_inst||''}</span>
        </div>
      </div>
      <div class="qp-other-desc">Other Desc.: ${rec.other_desc||''}</div>
    </div>

    ${rec.remarks ? `<div style="font-weight:700;font-size:7.5pt;background:#0f5c52;color:#fff;padding:3px 7px;margin-top:4px;">Remarks:</div><div class="qp-remarks">${rec.remarks}</div>` : `<div style="font-weight:700;font-size:7.5pt;background:#0f5c52;color:#fff;padding:3px 7px;margin-top:4px;">Remarks:</div><div class="qp-remarks">&nbsp;</div>`}

    <div class="qp-sigs">
      <div class="qp-sig"><div class="qp-sig-line">Prepared By: ${rec.preparedby||'__________________'}</div></div>
      <div class="qp-sig"><div class="qp-sig-line">For IMPEXIO / Authorised Signatory: ${rec.signatory||'__________________'}</div></div>
    </div>

    <div class="qp-bottom-bar"></div>
    <div class="qp-footer">IMPEXIO | Export-Import Document Portal | Client: ${client} | Export Quotation | Printed: ${new Date().toLocaleString('en-IN')}</div>
  </div>`;

  window.print();
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(icon, msg) {
  let t = document.getElementById('eq-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'eq-toast';
    t.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;background:var(--teal,#0f5c52);color:#fff;padding:0.7rem 1.2rem;border-radius:10px;font-size:0.82rem;font-weight:600;display:flex;gap:0.5rem;align-items:center;box-shadow:0 8px 24px rgba(15,92,82,0.3);z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;border-left:3px solid var(--gold,#c9a84c);`;
    document.body.appendChild(t);
  }
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}
