/* ============================================================
   ec.js — Export Costing Step Wizard
   IMPEXIO v2
   ============================================================ */

// Container columns: [id, fcl_key, lcl_key]
const EC_COLS = [
  { id:'20',   label:"20' Container" },
  { id:'40gp', label:"40' GP Container" },
  { id:'40hq', label:"40' HQ Container" },
  { id:'lcl',  label:"LCL Shipment" },
];

// Row definitions for the cost sheet
// type: input | calc_fob | calc_fob_usd | calc_fob_mt | calc_cif | calc_cif_usd | calc_cif_mt | separator | bags | loading
const EC_ROWS = [
  { key:'max_loading_kgs', label:'Maximum Loading KGS',        type:'input' },
  { key:'max_cbm',         label:'Maximum CBM Loading',        type:'input' },
  { key:'_sep1',           label:'',                           type:'separator' },
  { key:'basic_rates',     label:'Our Basic Rates',            type:'input' },
  { key:'transport_local', label:'Transportation Cost ( Local )', type:'input' },
  { key:'dom_insurance',   label:'Domestic Insurance',         type:'input' },
  { key:'cha_agency_thc',  label:'CHA + Agency + CFS + THC',   type:'input' },
  { key:'other_expenses',  label:'Other Expenses ( Direct & Indirect )', type:'input' },
  { key:'profit_pct',      label:'Profit %',                   type:'input_pct' },
  { key:'gst',             label:'GST',                        type:'input' },
  { key:'fob_inr',         label:'FOB VALUE IN INR',           type:'calc_fob_inr' },
  { key:'fob_usd',         label:'FOB VALUE IN $',             type:'calc_fob_usd' },
  { key:'fob_per_mt',      label:'FOB VALUE PER 1 MT',         type:'calc_fob_mt' },
  { key:'marine_ins',      label:'Marine Insurance',           type:'input' },
  { key:'sea_freight',     label:'Sea Freight Charges',        type:'input' },
  { key:'cif_inr',         label:'CIF VALUE IN INR',           type:'calc_cif_inr' },
  { key:'cif_usd',         label:'CIF VALUE IN $',             type:'calc_cif_usd' },
  { key:'cif_per_mt',      label:'CIF VALUE PER 1 MT',         type:'calc_cif_mt' },
  { key:'bags_units',      label:'NO OF BAGS / UNITS',         type:'input' },
];

const INPUT_KEYS = EC_ROWS.filter(r => r.type.startsWith('input')).map(r => r.key);

let ecRecords = JSON.parse(localStorage.getItem('ec_records') || '[]');
let editingId  = null;
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
  const el = document.getElementById('f_ratesdate');
  if (el && !el.value) el.value = new Date().toISOString().split('T')[0];
}

function autoSetRefNo() {
  const el = document.getElementById('f_refno');
  if (el && !el.value) {
    const num = String(ecRecords.length + 1).padStart(4, '0');
    el.value = `EC/2026/${num}`;
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
function gv(id) { return document.getElementById(id)?.value || ''; }
function gn(id) { return parseFloat(document.getElementById(id)?.value) || 0; }

// ── Build Cost Table ──────────────────────────────────────────
function buildCostTable() {
  const tbody = document.getElementById('costBody');
  tbody.innerHTML = '';

  EC_ROWS.forEach(row => {
    const tr = document.createElement('tr');

    if (row.type === 'separator') {
      tr.className = 'ec-row-sublabel';
      tr.innerHTML = `<td colspan="9" style="padding:0.22rem 0.85rem;background:rgba(15,37,64,0.06);font-size:0.6rem;font-weight:700;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.08em;">Cost Particulars &nbsp;|&nbsp; Cents LB Cost &nbsp;&amp;&nbsp; Total Cost</td>`;
      tbody.appendChild(tr);
      return;
    }

    // Row class
    if (row.type === 'calc_fob_inr' || row.type === 'calc_fob_usd' || row.type === 'calc_fob_mt') {
      tr.className = 'ec-row-fob';
    } else if (row.type === 'calc_cif_inr' || row.type === 'calc_cif_usd' || row.type === 'calc_cif_mt') {
      tr.className = 'ec-row-cif';
    } else if (row.key === 'bags_units') {
      tr.className = 'ec-row-bags';
    }

    let firstCell = `<td>${row.label}</td>`;

    // 8 data cells — 2 per container (FCL, LCL)
    let dataCells = '';
    EC_COLS.forEach(col => {
      ['fcl','lcl'].forEach(mode => {
        const cellId = `cell_${row.key}_${col.id}_${mode}`;
        if (row.type === 'input' || row.type === 'input_pct') {
          const extra = row.type === 'input_pct'
            ? `<div class="ec-pct-wrap"><input type="number" class="ec-ci" id="${cellId}" placeholder="0" step="0.01" min="0" max="100" oninput="recalc()"/> <span class="ec-pct-sym">%</span></div>`
            : `<input type="number" class="ec-ci" id="${cellId}" placeholder="0" step="0.01" oninput="recalc()"/>`;
          dataCells += `<td>${extra}</td>`;
        } else {
          const cls = row.type.includes('fob') ? 'ec-ro ec-ro-fob' : 'ec-ro ec-ro-cif';
          dataCells += `<td><span class="${cls}" id="${cellId}">0</span></td>`;
        }
      });
    });

    tr.innerHTML = firstCell + dataCells;
    tbody.appendChild(tr);
  });
}

// ── Recalculate ───────────────────────────────────────────────
function recalc() {
  const usdRate  = gn('f_usdrate')  || 84;
  const shipRate = gn('f_shiprate') || 0;

  EC_COLS.forEach(col => {
    ['fcl','lcl'].forEach(mode => {
      const g = (key) => parseFloat(document.getElementById(`cell_${key}_${col.id}_${mode}`)?.value) || 0;
      const gs = (key) => {
        const el = document.getElementById(`cell_${key}_${col.id}_${mode}`);
        return parseFloat(el?.value || el?.textContent) || 0;
      };

      const basicRates  = g('basic_rates');
      const transport   = g('transport_local');
      const domIns      = g('dom_insurance');
      const cha         = g('cha_agency_thc');
      const other       = g('other_expenses');
      const profitPct   = g('profit_pct');
      const gst         = g('gst');
      const marineIns   = g('marine_ins');
      const seaFreight  = g('sea_freight');
      const maxKgs      = g('max_loading_kgs');

      // FOB INR = basicRates + transport + domIns + cha + other + (profit% of sum) + gst
      const costBase = basicRates + transport + domIns + cha + other;
      const profitAmt = costBase * (profitPct / 100);
      const fobInr   = costBase + profitAmt + gst;

      // FOB USD = fobInr / usdRate
      const fobUsd = usdRate > 0 ? fobInr / usdRate : 0;

      // FOB per MT = fobUsd / (maxKgs / 1000), if kgs > 0
      const fobMt = (maxKgs > 0 && usdRate > 0) ? (fobUsd / (maxKgs / 1000)) : 0;

      // CIF INR = fobInr + marineIns + seaFreight
      const cifInr = fobInr + marineIns + seaFreight;
      const cifUsd = usdRate > 0 ? cifInr / usdRate : 0;
      const cifMt  = (maxKgs > 0 && usdRate > 0) ? (cifUsd / (maxKgs / 1000)) : 0;

      setCalcCell(`cell_fob_inr_${col.id}_${mode}`, fmtNum(fobInr));
      setCalcCell(`cell_fob_usd_${col.id}_${mode}`, fmtNum(fobUsd));
      setCalcCell(`cell_fob_per_mt_${col.id}_${mode}`, fmtNum(fobMt));
      setCalcCell(`cell_cif_inr_${col.id}_${mode}`, fmtNum(cifInr));
      setCalcCell(`cell_cif_usd_${col.id}_${mode}`, fmtNum(cifUsd));
      setCalcCell(`cell_cif_per_mt_${col.id}_${mode}`, fmtNum(cifMt));
    });
  });

  updateSummaryCard();
}

function setCalcCell(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function updateSummaryCard() {
  const usdRate = gn('f_usdrate') || 84;
  // Use 20' FCL as reference
  const fobInrEl  = document.getElementById('cell_fob_inr_20_fcl');
  const fobUsdEl  = document.getElementById('cell_fob_usd_20_fcl');
  const fobMtEl   = document.getElementById('cell_fob_per_mt_20_fcl');
  const cifInrEl  = document.getElementById('cell_cif_inr_20_fcl');
  const cifUsdEl  = document.getElementById('cell_cif_usd_20_fcl');
  const cifMtEl   = document.getElementById('cell_cif_per_mt_20_fcl');

  setText('sum_fob_inr', `₹ ${fobInrEl?.textContent || '0'}`);
  setText('sum_fob_usd', `$ ${fobUsdEl?.textContent || '0'}`);
  setText('sum_fob_mt',  `$ ${fobMtEl?.textContent  || '0'}`);
  setText('sum_cif_inr', `₹ ${cifInrEl?.textContent || '0'}`);
  setText('sum_cif_usd', `$ ${cifUsdEl?.textContent || '0'}`);
  setText('sum_cif_mt',  `$ ${cifMtEl?.textContent  || '0'}`);
}

function fmtNum(n) {
  if (!n || n === 0) return '0';
  return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// ── Step Navigation ───────────────────────────────────────────
function goToStep(n) {
  if (n > currentStep && n === 2) {
    if (!gv('f_company').trim()) { showToast('⚠️', 'Please enter Company Name first.');  return; }
    if (!gv('f_refno').trim())   { showToast('⚠️', 'Please enter Costing Ref. No.');    return; }
    if (!gv('f_ratesdate'))      { showToast('⚠️', 'Please select Rates As On date.');   return; }
  }

  currentStep = n;

  [1,2,3].forEach(i => {
    const el = document.getElementById(`step_${i}`);
    if (el) el.classList.toggle('hidden', i !== n);
  });

  [1,2,3].forEach(i => {
    const dot = document.getElementById(`pstep_${i}`);
    if (!dot) return;
    dot.classList.remove('active','done');
    if (i === n) dot.classList.add('active');
    if (i < n)   dot.classList.add('done');
  });

  document.querySelectorAll('.epb-connector').forEach((c, idx) => {
    c.classList.toggle('done', idx + 1 < n);
  });

  const subs = { 1:'Step 1 of 3 — Document Info', 2:'Step 2 of 3 — Cost Sheet Entry', 3:'Step 3 of 3 — Summary & Auth' };
  setText('formSub', subs[n] || '');

  updateInfoStrips();
  if (n === 2) recalc();
  if (n === 3) updateSummaryCard();
}

function nextStep(from) { goToStep(from + 1); }
function prevStep(from) { goToStep(from - 1); }

function updateInfoStrips() {
  const company = gv('f_company') || '—';
  const product = gv('f_product') || '—';
  const ref     = gv('f_refno')   || '—';
  const rate    = gv('f_usdrate') || '—';

  [[2,'s2'],[3,'s3']].forEach(([step, prefix]) => {
    setText(`${prefix}_company`, company);
    setText(`${prefix}_product`, product);
    setText(`${prefix}_ref`,     ref);
    if (prefix === 's2') setText('s2_rate', rate);
  });
}

// ── New / Clear ───────────────────────────────────────────────
function newEntry() {
  clearForm();
  editingId = null;
  setText('formTitle', 'New Export Costing');
  goToStep(1);
  document.querySelectorAll('.el-card').forEach(c => c.classList.remove('active'));
}

function clearForm() {
  ['f_company','f_refno','f_product','f_ratesdate','f_usdrate','f_shiprate',
   'f_remarks','f_preparedby','f_signatory'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  setTodayDate();

  EC_ROWS.forEach(row => {
    if (row.type !== 'input' && row.type !== 'input_pct') return;
    EC_COLS.forEach(col => {
      ['fcl','lcl'].forEach(mode => {
        const el = document.getElementById(`cell_${row.key}_${col.id}_${mode}`);
        if (el) el.value = '';
      });
    });
  });
  recalc();
  autoSetRefNo();
}

// ── Save ──────────────────────────────────────────────────────
function saveRecord() {
  const company   = gv('f_company').trim();
  const refno     = gv('f_refno').trim();
  const ratesdate = gv('f_ratesdate');
  if (!company)   { showToast('⚠️','Please enter Company Name.'); goToStep(1); return; }
  if (!refno)     { showToast('⚠️','Please enter Costing Ref. No.'); goToStep(1); return; }
  if (!ratesdate) { showToast('⚠️','Please select Rates As On date.'); goToStep(1); return; }

  // Collect all input values
  const cells = {};
  EC_ROWS.forEach(row => {
    if (row.type !== 'input' && row.type !== 'input_pct') return;
    cells[row.key] = {};
    EC_COLS.forEach(col => {
      cells[row.key][col.id] = {};
      ['fcl','lcl'].forEach(mode => {
        cells[row.key][col.id][mode] = parseFloat(gv(`cell_${row.key}_${col.id}_${mode}`)) || 0;
      });
    });
  });

  // Collect calc values
  const calcs = {};
  ['fob_inr','fob_usd','fob_per_mt','cif_inr','cif_usd','cif_per_mt'].forEach(key => {
    calcs[key] = {};
    EC_COLS.forEach(col => {
      calcs[key][col.id] = {};
      ['fcl','lcl'].forEach(mode => {
        calcs[key][col.id][mode] = document.getElementById(`cell_${key}_${col.id}_${mode}`)?.textContent || '0';
      });
    });
  });

  const rec = {
    id: editingId ?? Date.now(),
    company, refno, product: gv('f_product'),
    ratesdate, usdrate: gv('f_usdrate'), shiprate: gv('f_shiprate'),
    remarks: gv('f_remarks'), preparedby: gv('f_preparedby'), signatory: gv('f_signatory'),
    cells, calcs,
    sum_fob_inr: document.getElementById('sum_fob_inr')?.textContent || '0',
    sum_fob_usd: document.getElementById('sum_fob_usd')?.textContent || '0',
    sum_cif_inr: document.getElementById('sum_cif_inr')?.textContent || '0',
    sum_cif_usd: document.getElementById('sum_cif_usd')?.textContent || '0',
  };

  if (editingId !== null) {
    const idx = ecRecords.findIndex(r => r.id === editingId);
    if (idx > -1) ecRecords[idx] = rec; else ecRecords.unshift(rec);
  } else {
    ecRecords.unshift(rec);
  }

  localStorage.setItem('ec_records', JSON.stringify(ecRecords));
  renderRecords();
  showToast('✅', `Record ${refno} saved!`);
  editingId = rec.id;
  setText('formTitle', `Editing: ${refno}`);
}

// ── Edit ──────────────────────────────────────────────────────
function editRecord(id) {
  const rec = ecRecords.find(r => r.id === id);
  if (!rec) return;
  editingId = id;
  setText('formTitle', `Editing: ${rec.refno}`);

  const sv = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
  sv('f_company', rec.company); sv('f_refno', rec.refno);
  sv('f_product', rec.product); sv('f_ratesdate', rec.ratesdate);
  sv('f_usdrate', rec.usdrate); sv('f_shiprate', rec.shiprate);
  sv('f_remarks', rec.remarks); sv('f_preparedby', rec.preparedby);
  sv('f_signatory', rec.signatory);

  EC_ROWS.forEach(row => {
    if (row.type !== 'input' && row.type !== 'input_pct') return;
    EC_COLS.forEach(col => {
      ['fcl','lcl'].forEach(mode => {
        sv(`cell_${row.key}_${col.id}_${mode}`, rec.cells?.[row.key]?.[col.id]?.[mode] || '');
      });
    });
  });

  recalc();
  document.querySelectorAll('.el-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`ecard_${id}`)?.classList.add('active');
  goToStep(1);
}

// ── Delete ────────────────────────────────────────────────────
function deleteRecord(id) {
  if (!confirm('Delete this Export Costing record?')) return;
  ecRecords = ecRecords.filter(r => r.id !== id);
  localStorage.setItem('ec_records', JSON.stringify(ecRecords));
  if (editingId === id) newEntry();
  renderRecords();
  showToast('🗑','Record deleted.');
}

// ── Render List ───────────────────────────────────────────────
function renderRecords(data = null) {
  const list  = document.getElementById('recordsList');
  const items = data || ecRecords;
  if (items.length === 0) {
    list.innerHTML = `
      <div class="el-empty">
        <div style="font-size:1.6rem;opacity:0.35;">🧮</div>
        <div class="el-empty-txt">No records yet</div>
        <div class="el-empty-sub">Click + New to begin</div>
      </div>`;
    return;
  }
  list.innerHTML = items.map(rec => `
    <div class="el-card ${editingId === rec.id ? 'active' : ''}" id="ecard_${rec.id}" onclick="editRecord(${rec.id})">
      <div class="el-card-no">${rec.refno}</div>
      <div class="el-card-co">${rec.company}</div>
      <div class="el-card-prod">${rec.product || '—'}</div>
      <div class="el-card-row">
        <span class="el-card-date">${fmtDate(rec.ratesdate)}</span>
        <span class="el-card-val">${rec.sum_fob_usd || '$0'}</span>
      </div>
      <div class="el-card-acts">
        <button class="el-act edit" onclick="event.stopPropagation();editRecord(${rec.id})">✏️ Edit</button>
        <button class="el-act prnt" onclick="event.stopPropagation();printById(${rec.id})">🖨 Print</button>
        <button class="el-act del"  onclick="event.stopPropagation();deleteRecord(${rec.id})">🗑</button>
      </div>
    </div>`).join('');
}

function filterRecords() {
  const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
  if (!q) { renderRecords(); return; }
  renderRecords(ecRecords.filter(r =>
    r.refno?.toLowerCase().includes(q) ||
    r.company?.toLowerCase().includes(q) ||
    r.product?.toLowerCase().includes(q)
  ));
}

function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

// ── Print ─────────────────────────────────────────────────────
function printRecord() {
  // Collect live data
  const cells = {};
  EC_ROWS.forEach(row => {
    if (row.type !== 'input' && row.type !== 'input_pct') return;
    cells[row.key] = {};
    EC_COLS.forEach(col => {
      cells[row.key][col.id] = {};
      ['fcl','lcl'].forEach(mode => {
        cells[row.key][col.id][mode] = gv(`cell_${row.key}_${col.id}_${mode}`) || '0';
      });
    });
  });
  const calcs = {};
  ['fob_inr','fob_usd','fob_per_mt','cif_inr','cif_usd','cif_per_mt'].forEach(key => {
    calcs[key] = {};
    EC_COLS.forEach(col => {
      calcs[key][col.id] = {};
      ['fcl','lcl'].forEach(mode => {
        calcs[key][col.id][mode] = document.getElementById(`cell_${key}_${col.id}_${mode}`)?.textContent || '0';
      });
    });
  });
  doPrint({
    company: gv('f_company'), refno: gv('f_refno'), product: gv('f_product'),
    ratesdate: gv('f_ratesdate'), usdrate: gv('f_usdrate'), shiprate: gv('f_shiprate'),
    remarks: gv('f_remarks'), preparedby: gv('f_preparedby'), signatory: gv('f_signatory'),
    cells, calcs
  });
}

function printById(id) {
  const rec = ecRecords.find(r => r.id === id);
  if (!rec) return;
  // Rebuild calcs from saved cells
  doPrint(rec);
}

function doPrint(rec) {
  const client = sess?.clientCode || 'Demo001';
  const user   = sess?.username   || 'Admin';

  // Build column headers
  const colHeaders = EC_COLS.map(col =>
    `<th colspan="2" class="p-th-grp">${col.label}</th>`
  ).join('');
  const subHeaders = EC_COLS.map(() =>
    `<th>FCL</th><th>LCL</th>`
  ).join('');
  const unitHeaders = EC_COLS.map(() =>
    `<th>RS</th><th>RS</th>`
  ).join('');

  const bodyRows = EC_ROWS.map(row => {
    if (row.type === 'separator') {
      return `<tr class="sub-row"><td class="par-td" colspan="9" style="font-size:6pt;font-weight:700;color:#3d5475;text-transform:uppercase;letter-spacing:0.08em;">Cost Particulars | Cents LB Cost & Total Cost</td></tr>`;
    }

    let rowClass = '';
    if (['calc_fob_inr','calc_fob_usd','calc_fob_mt'].includes(row.type)) rowClass = 'fob-row';
    if (['calc_cif_inr','calc_cif_usd','calc_cif_mt'].includes(row.type)) rowClass = 'cif-row';
    if (row.key === 'bags_units') rowClass = 'bags-row';

    const cells = EC_COLS.map(col => {
      const isCalc = !row.type.startsWith('input');
      let fcl = '', lcl = '';

      if (row.type.startsWith('input')) {
        fcl = rec.cells?.[row.key]?.[col.id]?.fcl || '';
        lcl = rec.cells?.[row.key]?.[col.id]?.lcl || '';
      } else {
        const calcKey = row.key; // e.g. fob_inr
        fcl = rec.calcs?.[calcKey]?.[col.id]?.fcl || '0';
        lcl = rec.calcs?.[calcKey]?.[col.id]?.lcl || '0';
      }

      const suffix = row.type === 'input_pct' ? ' %' : '';
      return `<td>${fcl ? fcl + suffix : ''}</td><td>${lcl ? lcl + suffix : ''}</td>`;
    }).join('');

    return `<tr class="${rowClass}"><td class="par-td">${row.label}</td>${cells}</tr>`;
  }).join('');

  document.getElementById('printArea').innerHTML = `
  <div class="p-doc">
    <div class="p-hdr">
      <div class="p-hdr-title">IMPEXIO &mdash; EXPORT COSTING &nbsp;|&nbsp; COST SHEET FOR INTERNAL USE</div>
      <div class="p-hdr-sub">Export Import Document Management System &nbsp;|&nbsp; Client: ${client}</div>
    </div>

    <div class="p-meta">
      <div class="p-meta-item"><span class="p-meta-lbl">Company:&nbsp;</span><span class="p-meta-val">${rec.company||''}</span></div>
      <div class="p-meta-item"><span class="p-meta-lbl">Costing Ref:&nbsp;</span><span class="p-meta-val">${rec.refno||''}</span></div>
      <div class="p-meta-item"><span class="p-meta-lbl">Product:&nbsp;</span><span class="p-meta-val">${rec.product||''}</span></div>
      <div class="p-meta-item"><span class="p-meta-lbl">Rates As On:&nbsp;</span><span class="p-meta-val">${fmtDate(rec.ratesdate)}</span></div>
      <div class="p-meta-item"><span class="p-meta-lbl">Currency 1$=INR:&nbsp;</span><span class="p-meta-val">${rec.usdrate||''}</span></div>
      <div class="p-meta-item"><span class="p-meta-lbl">Ship Rate $:&nbsp;</span><span class="p-meta-val">${rec.shiprate||''}</span></div>
    </div>

    <div class="p-sec-hd" style="background:var(--gold,#c9a84c);color:#0f2540;text-align:center;font-size:8pt;">Cost Sheet For Internal Use</div>
    <table class="ptbl">
      <thead>
        <tr><th class="par-th" rowspan="3">PARTICULARS</th>${colHeaders}</tr>
        <tr><th>FCL COSTING</th><th>LCL COSTING</th><th>FCL COSTING</th><th>LCL COSTING</th><th>FCL COSTING</th><th>LCL COSTING</th><th>FCL COSTING</th><th>LCL COSTING</th></tr>
        <tr>${EC_COLS.map(()=>'<th>RS</th><th>RS</th>').join('')}</tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>

    <div class="p-sec-hd">Remarks</div>
    <div class="p-remarks">${rec.remarks||'&nbsp;'}</div>

    <div class="p-sigs">
      <div class="p-sig"><div class="p-sig-line">Prepared By: ${rec.preparedby||'__________________'}</div></div>
      <div class="p-sig"><div class="p-sig-line">Authorised Signatory: ${rec.signatory||'__________________'}</div></div>
    </div>
    <div class="p-footer">IMPEXIO | Export-Import Document Portal | Client: ${client} | Printed: ${new Date().toLocaleString('en-IN')}</div>
  </div>`;

  window.print();
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(icon, msg) {
  let t = document.getElementById('ec-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ec-toast';
    t.style.cssText = `position:fixed;bottom:1.5rem;right:1.5rem;background:var(--navy);color:#fff;padding:0.7rem 1.2rem;border-radius:10px;font-size:0.82rem;font-weight:600;display:flex;gap:0.5rem;align-items:center;box-shadow:0 8px 24px rgba(15,37,64,0.3);z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;border-left:3px solid var(--gold);`;
    document.body.appendChild(t);
  }
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}
