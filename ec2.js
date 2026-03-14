/* ============================================================
   ec2.js — Export Costing 2 Step Wizard
   IMPEXIO v2

   COSTING SHEET STRUCTURE & FORMULAS
   ═══════════════════════════════════
   Columns: LCL Col1 | LCL Col2 | 40' HQ FCL

   MOQ NET WEIGHT - KGS           → input
   MOQ GROSS WEIGHT - KGS         → input
   NO OF CARTOON                  → input
   CBM PER CARTOON                → input
   CBM PER CARTON TOTAL           → auto = NO OF CARTOON × CBM PER CARTOON

   OUR EXW RATE                   → input (per KGS)

   LOCAL TRANSPORTATION COST :-
     FREIGHT                      → input
     DOCKET & FOV                 → input
     FSC                          → input
     SPECIAL DELIVERY CHARGE      → input
     18% SERVICE TAX              → auto = 18% of (FREIGHT + DOCKET + FSC + SPECIAL DELIVERY)
     DOMESTIC INSURANCE           → input
   TOTAL (LOCAL)                  → auto = sum of all local items

   CUSTOM CLEARANCE & HANDLING CHARGES :-
     GENERAL THC LCL              → input
     B/L CHARGES                  → input
     CERTIFICATE OF ORIGIN        → input
     ENS (USD 25)                 → auto = 25 × USD rate
     VGM (USD 20)                 → auto = 20 × USD rate
     CUSTOM CLEARANCE CHARGE-CFS  → input
     18% SERVICE TAX              → auto = 18% of (GENERAL THC + B/L + CERT + CCC-CFS)
   TOTAL (CUSTOMS)                → auto = sum of all custom items

   OTHER EXPENSES (DIRECT & INDIRECT)  → input

   FOB VALUE IN INR    → auto = (EXW RATE × NET WT) + LOCAL TOTAL + CUSTOMS TOTAL
   FOB EXPENSE / KG    → auto = FOB VALUE INR ÷ NET WEIGHT KGS
   FOB VALUE IN $      → auto = FOB VALUE INR ÷ USD RATE
   MARINE INSURANCE    → input
   Sea Freight Charges → input
   CIF VALUE IN INR    → auto = FOB VALUE INR + MARINE INS + SEA FREIGHT
   CIF VALUE IN $      → auto = CIF VALUE INR ÷ USD RATE
   ============================================================ */

const COLS = ['c1','c2','c3']; // LCL1, LCL2, 40' HQ FCL

const EC2_ROWS = [
  // ── MOQ Details ──
  { key:'moq_net_wt',     label:'MOQ NET WEIGHT - KGS',      type:'input' },
  { key:'moq_gross_wt',   label:'MOQ GROSS WEIGHT - KGS',    type:'input' },
  { key:'no_of_carton',   label:'NO OF CARTON',              type:'input' },
  { key:'cbm_per_carton', label:'CBM PER CARTON',            type:'input' },
  { key:'cbm_total',      label:'CBM PER CARTON (TOTAL)',    type:'calc_cbm' },

  // ── EXW Rate ──
  { key:'_sep_exw',       label:'OUR EXW RATE',              type:'section_exw' },
  { key:'exw_rate',       label:'OUR EXW RATE (per KGS)',    type:'input' },

  // ── Local Transport ──
  { key:'_sec_local',     label:'LOCAL TRANSPORTATION COST :-', type:'section' },
  { key:'freight',        label:'FREIGHT',                   type:'input' },
  { key:'docket_fov',     label:'DOCKET & FOV',              type:'input' },
  { key:'fsc',            label:'FSC',                       type:'input' },
  { key:'special_del',    label:'SPECIAL DELIVERY CHARGE',   type:'input' },
  { key:'local_svc_tax',  label:'18% SERVICE TAX',           type:'calc_local_tax' },
  { key:'domestic_ins',   label:'DOMESTIC INSURANCE',        type:'input' },
  { key:'local_total',    label:'TOTAL',                     type:'calc_local_total' },

  // ── Custom Clearance ──
  { key:'_sec_cust',      label:'CUSTOM CLEARANCE & HANDLING CHARGES :-', type:'section' },
  { key:'gen_thc',        label:'GENERAL THC LCL',           type:'input' },
  { key:'bl_charges',     label:'B/L CHARGES',               type:'input' },
  { key:'cert_origin',    label:'CERTIFICATE OF ORIGIN',     type:'input' },
  { key:'ens',            label:'ENS (USD 25)',               type:'calc_ens' },
  { key:'vgm',            label:'VGM (USD 20)',               type:'calc_vgm' },
  { key:'ccc_cfs',        label:'CUSTOM CLEARANCE CHARGE - CFS', type:'input' },
  { key:'cust_svc_tax',   label:'18% SERVICE TAX',           type:'calc_cust_tax' },
  { key:'cust_total',     label:'TOTAL',                     type:'calc_cust_total' },

  // ── Other Expenses ──
  { key:'_sec_other',     label:'OTHER EXPENSES ( DIRECT & INDIRECT )', type:'section' },
  { key:'other_expenses', label:'OTHER EXPENSES',            type:'input' },

  // ── FOB / CIF ──
  { key:'fob_inr',        label:'FOB VALUE IN INR',          type:'calc_fob_inr' },
  { key:'fob_kg',         label:'FOB EXPENSE / KG',          type:'calc_fob_kg' },
  { key:'fob_usd',        label:'FOB VALUE IN $',            type:'calc_fob_usd' },
  { key:'marine_ins',     label:'MARINE INSURANCE',          type:'input' },
  { key:'sea_freight',    label:'Sea Freight Charges',       type:'input' },
  { key:'cif_inr',        label:'CIF VALUE IN INR',          type:'calc_cif_inr' },
  { key:'cif_usd',        label:'CIF VALUE IN $',            type:'calc_cif_usd' },
];

const INPUT_TYPES = ['input'];
const CALC_TYPES  = ['calc_cbm','calc_local_tax','calc_local_total','calc_ens','calc_vgm','calc_cust_tax','calc_cust_total','calc_fob_inr','calc_fob_kg','calc_fob_usd','calc_cif_inr','calc_cif_usd'];

let ec2Records  = JSON.parse(localStorage.getItem('ec2_records') || '[]');
let editingId   = null;
let currentStep = 1;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSess();
  populateTopbar();
  setTodayDate();
  autoSetRefNo();
  buildCostTable();
  renderRecords();
  goToStep(1);
});

function setTodayDate() {
  const el = document.getElementById('f_ratedate');
  if (el && !el.value) el.value = new Date().toISOString().split('T')[0];
}

function autoSetRefNo() {
  const el = document.getElementById('f_refno');
  if (el && !el.value) {
    const num = String(ec2Records.length + 1).padStart(4,'0');
    el.value = `EC2/2026/${num}`;
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
function gv(id)  { return document.getElementById(id)?.value?.trim() || ''; }
function gn(id)  { return parseFloat(document.getElementById(id)?.value) || 0; }
function gct(id) { return parseFloat(document.getElementById(id)?.textContent?.replace(/,/g,'')) || 0; }
function fmtN(n) {
  if (!n || n === 0) return '0';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// ── Build Table ───────────────────────────────────────────────
function buildCostTable() {
  const tbody = document.getElementById('costBody');
  tbody.innerHTML = '';

  EC2_ROWS.forEach(row => {
    const tr = document.createElement('tr');

    if (row.type === 'section') {
      tr.className = 'ec2-row-section';
      tr.innerHTML = `<td colspan="4">${row.label}</td>`;
      tbody.appendChild(tr); return;
    }
    if (row.type === 'section_exw') {
      tr.className = 'ec2-row-exw';
      tr.innerHTML = `<td colspan="4">${row.label}</td>`;
      tbody.appendChild(tr); return;
    }

    // Row class for calculated rows
    const classMap = {
      calc_local_total: 'ec2-row-total',
      calc_cust_total:  'ec2-row-total',
      calc_fob_inr:     'ec2-row-fob-inr',
      calc_fob_kg:      'ec2-row-fob-kg',
      calc_fob_usd:     'ec2-row-fob-usd',
      calc_cif_inr:     'ec2-row-cif-inr',
      calc_cif_usd:     'ec2-row-cif-usd',
    };
    if (classMap[row.type]) tr.className = classMap[row.type];

    let cells = COLS.map(col => {
      const cid = `cell_${row.key}_${col}`;
      if (row.type === 'input') {
        return `<td><input type="number" class="e2-ci" id="${cid}" placeholder="0" step="0.01" oninput="recalc()"/></td>`;
      }
      // Calc cell styling
      let cls = 'e2-ro';
      if (['calc_fob_inr','calc_fob_kg','calc_fob_usd'].includes(row.type)) cls += ' e2-ro-navy';
      else if (['calc_cif_inr','calc_cif_usd'].includes(row.type)) cls += ' e2-ro-gold';
      else if (row.type === 'calc_local_total' || row.type === 'calc_cust_total') cls += ' e2-ro-navy';
      return `<td><span class="${cls}" id="${cid}">0</span></td>`;
    }).join('');

    tr.innerHTML = `<td>${row.label}</td>${cells}`;
    tbody.appendChild(tr);
  });
}

// ── Recalculate All ───────────────────────────────────────────
function recalc() {
  const usdRate = gn('f_usdrate') || 84;

  COLS.forEach(col => {
    const g  = key => parseFloat(document.getElementById(`cell_${key}_${col}`)?.value) || 0;
    const gc = key => parseFloat(document.getElementById(`cell_${key}_${col}`)?.textContent?.replace(/,/g,'')) || 0;
    const set = (key, val) => {
      const el = document.getElementById(`cell_${key}_${col}`);
      if (el) el.textContent = fmtN(val);
    };

    // CBM Total
    const cbmTotal = g('no_of_carton') * g('cbm_per_carton');
    set('cbm_total', cbmTotal);

    // Local Transport
    const freight   = g('freight');
    const docket    = g('docket_fov');
    const fsc       = g('fsc');
    const specDel   = g('special_del');
    const localTax  = (freight + docket + fsc + specDel) * 0.18;
    const domIns    = g('domestic_ins');
    const localTot  = freight + docket + fsc + specDel + localTax + domIns;
    set('local_svc_tax',  localTax);
    set('local_total',    localTot);

    // Custom Clearance
    const genThc    = g('gen_thc');
    const bl        = g('bl_charges');
    const cert      = g('cert_origin');
    const ens       = 25 * usdRate;
    const vgm       = 20 * usdRate;
    const cccCfs    = g('ccc_cfs');
    const custTax   = (genThc + bl + cert + cccCfs) * 0.18;
    const custTot   = genThc + bl + cert + ens + vgm + cccCfs + custTax;
    set('ens',          ens);
    set('vgm',          vgm);
    set('cust_svc_tax', custTax);
    set('cust_total',   custTot);

    // Other expenses
    const other = g('other_expenses');

    // FOB = (EXW Rate × Net Wt) + Local Total + Custom Total + Other Expenses
    const exwRate  = g('exw_rate');
    const netWt    = g('moq_net_wt');
    const fobInr   = (exwRate * netWt) + localTot + custTot + other;
    const fobKg    = netWt > 0 ? fobInr / netWt : 0;
    const fobUsd   = usdRate > 0 ? fobInr / usdRate : 0;
    set('fob_inr', fobInr);
    set('fob_kg',  fobKg);
    set('fob_usd', fobUsd);

    // CIF = FOB + Marine Insurance + Sea Freight
    const marineIns  = g('marine_ins');
    const seaFreight = g('sea_freight');
    const cifInr     = fobInr + marineIns + seaFreight;
    const cifUsd     = usdRate > 0 ? cifInr / usdRate : 0;
    set('cif_inr', cifInr);
    set('cif_usd', cifUsd);
  });

  updateSummaryCard();
}

function updateSummaryCard() {
  // Use first column (c1) as reference for summary
  const get = key => parseFloat(document.getElementById(`cell_${key}_c1`)?.textContent?.replace(/,/g,'')) || 0;

  setText('sum_fob_inr', `₹ ${fmtN(get('fob_inr'))}`);
  setText('sum_fob_kg',  `₹ ${fmtN(get('fob_kg'))}`);
  setText('sum_fob_usd', `$ ${fmtN(get('fob_usd'))}`);
  setText('sum_cif_inr', `₹ ${fmtN(get('cif_inr'))}`);
  setText('sum_cif_usd', `$ ${fmtN(get('cif_usd'))}`);
  setText('sum_other',   `₹ ${fmtN((parseFloat(document.getElementById('cell_other_expenses_c1')?.value) || 0))}`);
}

// ── Step Navigation ───────────────────────────────────────────
function goToStep(n) {
  if (n > currentStep && n === 2) {
    if (!gv('f_company')) { showToast('⚠️','Please enter Company Name.'); return; }
    if (!gv('f_refno'))   { showToast('⚠️','Please enter Costing Ref.'); return; }
    if (!gv('f_ratedate')){ showToast('⚠️','Please select Rate On Date.'); return; }
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
  document.querySelectorAll('.e2pb-connector').forEach((c, idx) => {
    c.classList.toggle('done', idx + 1 < n);
  });

  const subs = {
    1: 'Step 1 of 3 — Document Info',
    2: 'Step 2 of 3 — Costing Sheet Entry',
    3: 'Step 3 of 3 — Summary & Auth'
  };
  setText('formSub', subs[n] || '');
  updateInfoStrips();
  if (n === 2) recalc();
  if (n === 3) updateSummaryCard();
}

function nextStep(from) { goToStep(from + 1); }
function prevStep(from) { goToStep(from - 1); }

function updateInfoStrips() {
  const co  = gv('f_company') || '—';
  const pr  = gv('f_product') || '—';
  const ref = gv('f_refno')   || '—';
  const rt  = gv('f_usdrate') || '—';

  [[2,'s2'],[3,'s3']].forEach(([,p]) => {
    setText(`${p}_company`, co);
    setText(`${p}_product`, pr);
    setText(`${p}_ref`,     ref);
  });
  setText('s2_rate', rt);
}

// ── New / Clear ───────────────────────────────────────────────
function newEntry() {
  clearForm();
  editingId = null;
  setText('formTitle','New Export Costing 2');
  goToStep(1);
  document.querySelectorAll('.e2l-card').forEach(c => c.classList.remove('active'));
}

function clearForm() {
  ['f_company','f_refno','f_product','f_ratedate','f_usdrate','f_pol',
   'f_preparedby','f_signatory'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  setTodayDate();
  autoSetRefNo();

  EC2_ROWS.filter(r => r.type === 'input').forEach(row => {
    COLS.forEach(col => {
      const el = document.getElementById(`cell_${row.key}_${col}`);
      if (el) el.value = '';
    });
  });
  recalc();
}

// ── Save ──────────────────────────────────────────────────────
function saveRecord() {
  const company  = gv('f_company');
  const refno    = gv('f_refno');
  const ratedate = gv('f_ratedate');
  if (!company)  { showToast('⚠️','Please enter Company.');  goToStep(1); return; }
  if (!refno)    { showToast('⚠️','Please enter Costing Ref.'); goToStep(1); return; }
  if (!ratedate) { showToast('⚠️','Please select Rate On Date.'); goToStep(1); return; }

  // Collect all input values
  const cells = {};
  EC2_ROWS.filter(r => r.type === 'input').forEach(row => {
    cells[row.key] = {};
    COLS.forEach(col => {
      cells[row.key][col] = parseFloat(document.getElementById(`cell_${row.key}_${col}`)?.value) || 0;
    });
  });

  // Collect calc values
  const calcs = {};
  EC2_ROWS.filter(r => CALC_TYPES.includes(r.type)).forEach(row => {
    calcs[row.key] = {};
    COLS.forEach(col => {
      calcs[row.key][col] = document.getElementById(`cell_${row.key}_${col}`)?.textContent || '0';
    });
  });

  const rec = {
    id: editingId ?? Date.now(),
    company, refno,
    product:    gv('f_product'),
    ratedate,
    usdrate:    gv('f_usdrate'),
    pol:        gv('f_pol'),
    preparedby: gv('f_preparedby'),
    signatory:  gv('f_signatory'),
    cells, calcs,
    sum_fob_inr: document.getElementById('sum_fob_inr')?.textContent || '0',
    sum_fob_usd: document.getElementById('sum_fob_usd')?.textContent || '0',
    sum_cif_inr: document.getElementById('sum_cif_inr')?.textContent || '0',
  };

  if (editingId !== null) {
    const idx = ec2Records.findIndex(r => r.id === editingId);
    if (idx > -1) ec2Records[idx] = rec; else ec2Records.unshift(rec);
  } else {
    ec2Records.unshift(rec);
  }

  localStorage.setItem('ec2_records', JSON.stringify(ec2Records));
  renderRecords();
  showToast('✅', `Record ${refno} saved!`);
  editingId = rec.id;
  setText('formTitle', `Editing: ${refno}`);
}

// ── Edit ──────────────────────────────────────────────────────
function editRecord(id) {
  const rec = ec2Records.find(r => r.id === id);
  if (!rec) return;
  editingId = id;
  setText('formTitle', `Editing: ${rec.refno}`);

  const sv = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
  sv('f_company',  rec.company);  sv('f_refno',    rec.refno);
  sv('f_product',  rec.product);  sv('f_ratedate', rec.ratedate);
  sv('f_usdrate',  rec.usdrate);  sv('f_pol',      rec.pol);
  sv('f_preparedby', rec.preparedby); sv('f_signatory', rec.signatory);

  EC2_ROWS.filter(r => r.type === 'input').forEach(row => {
    COLS.forEach(col => {
      sv(`cell_${row.key}_${col}`, rec.cells?.[row.key]?.[col] || '');
    });
  });

  recalc();
  document.querySelectorAll('.e2l-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`ec2card_${id}`)?.classList.add('active');
  goToStep(1);
}

// ── Delete ────────────────────────────────────────────────────
function deleteRecord(id) {
  if (!confirm('Delete this Export Costing 2 record?')) return;
  ec2Records = ec2Records.filter(r => r.id !== id);
  localStorage.setItem('ec2_records', JSON.stringify(ec2Records));
  if (editingId === id) newEntry();
  renderRecords();
  showToast('🗑','Record deleted.');
}

// ── Render List ───────────────────────────────────────────────
function renderRecords(data = null) {
  const list  = document.getElementById('recordsList');
  const items = data || ec2Records;
  if (items.length === 0) {
    list.innerHTML = `
      <div class="e2l-empty">
        <div style="font-size:1.6rem;opacity:0.35;">🧾</div>
        <div class="e2l-empty-txt">No records yet</div>
        <div class="e2l-empty-sub">Click + New to begin</div>
      </div>`;
    return;
  }
  list.innerHTML = items.map(rec => `
    <div class="e2l-card ${editingId===rec.id?'active':''}" id="ec2card_${rec.id}" onclick="editRecord(${rec.id})">
      <div class="e2l-card-no">${rec.refno}</div>
      <div class="e2l-card-co">${rec.company}</div>
      <div class="e2l-card-row">
        <span class="e2l-card-date">${fmtDate(rec.ratedate)}</span>
        <span class="e2l-card-val">${rec.sum_fob_usd || '$0'}</span>
      </div>
      <div class="e2l-card-acts">
        <button class="e2l-act edit" onclick="event.stopPropagation();editRecord(${rec.id})">✏️ Edit</button>
        <button class="e2l-act prnt" onclick="event.stopPropagation();printById(${rec.id})">🖨 Print</button>
        <button class="e2l-act del"  onclick="event.stopPropagation();deleteRecord(${rec.id})">🗑</button>
      </div>
    </div>`).join('');
}

function filterRecords() {
  const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
  if (!q) { renderRecords(); return; }
  renderRecords(ec2Records.filter(r =>
    r.refno?.toLowerCase().includes(q) ||
    r.company?.toLowerCase().includes(q) ||
    r.product?.toLowerCase().includes(q)
  ));
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}

// ── Print ─────────────────────────────────────────────────────
function printRecord() {
  // collect live data
  const cells = {};
  EC2_ROWS.filter(r => r.type === 'input').forEach(row => {
    cells[row.key] = {};
    COLS.forEach(col => { cells[row.key][col] = gv(`cell_${row.key}_${col}`) || '0'; });
  });
  const calcs = {};
  EC2_ROWS.filter(r => CALC_TYPES.includes(r.type)).forEach(row => {
    calcs[row.key] = {};
    COLS.forEach(col => { calcs[row.key][col] = document.getElementById(`cell_${row.key}_${col}`)?.textContent || '0'; });
  });
  doPrint({
    company: gv('f_company'), refno: gv('f_refno'), product: gv('f_product'),
    ratedate: gv('f_ratedate'), usdrate: gv('f_usdrate'), pol: gv('f_pol'),
    preparedby: gv('f_preparedby'), signatory: gv('f_signatory'),
    cells, calcs
  });
}

function printById(id) {
  const rec = ec2Records.find(r => r.id === id);
  if (rec) doPrint(rec);
}

function doPrint(rec) {
  const client = sess?.clientCode || 'Demo001';
  const colLabels = ['LCL COSTING', 'LCL COSTING', 'FCL COSTING'];

  const getVal = (row, col, src) => {
    if (row.type === 'input') return src.cells?.[row.key]?.[col] || '';
    return src.calcs?.[row.key]?.[col] || '0';
  };

  const rowClassMap = {
    section:          'p2-sec',
    section_exw:      'p2-exw',
    calc_local_total: 'p2-tot',
    calc_cust_total:  'p2-tot',
    calc_fob_inr:     'p2-fob-inr',
    calc_fob_kg:      'p2-fob-kg',
    calc_fob_usd:     'p2-fob-usd',
    calc_cif_inr:     'p2-cif-inr',
    calc_cif_usd:     'p2-cif-usd',
    calc_other_total: 'p2-other',
  };

  const bodyRows = EC2_ROWS.map(row => {
    if (row.type === 'section' || row.type === 'section_exw') {
      return `<tr class="${rowClassMap[row.type]||''}"><td class="par-td" colspan="4">${row.label}</td></tr>`;
    }
    const cls  = rowClassMap[row.type] || '';
    const vals = COLS.map(col => `<td>${getVal(row, col, rec) || ''}</td>`).join('');
    return `<tr class="${cls}"><td class="par-td">${row.label}</td>${vals}</tr>`;
  }).join('');

  document.getElementById('printArea').innerHTML = `
  <div class="p2-doc">
    <div class="p2-hdr">
      <div class="p2-hdr-title">IMPEXIO &mdash; EXPORT COSTING 2 &nbsp;|&nbsp; PRINTOUT</div>
    </div>
    <div class="p2-teal-bar"></div>

    <div class="p2-meta">
      <div class="p2-meta-item"><span class="p2-meta-lbl">Company:&nbsp;</span><span class="p2-meta-val">${rec.company||''}</span></div>
      <div class="p2-meta-item"><span class="p2-meta-lbl">Costing Ref:&nbsp;</span><span class="p2-meta-val">${rec.refno||''}</span></div>
      <div class="p2-meta-item"><span class="p2-meta-lbl">Product:&nbsp;</span><span class="p2-meta-val">${rec.product||''}</span></div>
      <div class="p2-meta-item"><span class="p2-meta-lbl">Rate On Date:&nbsp;</span><span class="p2-meta-val">${fmtDate(rec.ratedate)}</span></div>
      <div class="p2-meta-item"><span class="p2-meta-lbl">Currency 1$=INR:&nbsp;</span><span class="p2-meta-val">${rec.usdrate||''}</span></div>
      <div class="p2-meta-item"><span class="p2-meta-lbl">Port of Loading:&nbsp;</span><span class="p2-meta-val">${rec.pol||''}</span></div>
    </div>

    <div class="p2-sheet-hd">COSTING SHEET</div>

    <table class="p2-tbl">
      <thead>
        <tr>
          <th class="par-th" rowspan="2">PARTICULARS</th>
          <th>LCL SHIPMENT</th>
          <th>LCL SHIPMENT</th>
          <th>40' HQ CONTAINER</th>
        </tr>
        <tr>
          ${colLabels.map(l => `<th style="font-size:6pt;">${l}<br/><span style="font-weight:400;opacity:0.7;">RS</span></th>`).join('')}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>

    <div class="p2-sigs">
      <div class="p2-sig"><div class="p2-sig-line">Prepared By: ${rec.preparedby||'__________________'}</div></div>
      <div class="p2-sig"><div class="p2-sig-line">Authorised Signatory: ${rec.signatory||'__________________'}</div></div>
    </div>
    <div class="p2-bottom-bar"></div>
    <div class="p2-footer">IMPEXIO | Export-Import Document Portal | Client: ${client} | Export Costing 2 | Printed: ${new Date().toLocaleString('en-IN')}</div>
  </div>`;

  window.print();
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(icon, msg) {
  let t = document.getElementById('ec2-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ec2-toast';
    t.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;background:var(--navy);color:#fff;padding:0.7rem 1.2rem;border-radius:10px;font-size:0.82rem;font-weight:600;display:flex;gap:0.5rem;align-items:center;box-shadow:0 8px 24px rgba(15,37,64,0.3);z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;border-left:3px solid var(--gold);`;
    document.body.appendChild(t);
  }
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}
