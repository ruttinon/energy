/******************************************************************
 *  ENERGY MODULE - FINAL FIX (ป้องกัน conflict)
 ******************************************************************/

console.log("⚡ ENERGY MODULE LOADED (CONFLICT-FREE)");

const API_BASE = (() => {
  const origin = String(window.location.origin).replace(/\/$/, "");
  const cfg = String(window.__CONFIG?.apiBase || '').replace(/\/$/, "");
  const stored = String(sessionStorage.getItem("API_BASE") || localStorage.getItem("API_BASE") || "").replace(/\/$/, "");
  const candidate = cfg || stored;
  if (!candidate) return origin;
  try {
    const u = new URL(candidate);
    const sameHost = u.hostname === window.location.hostname;
    const samePort = u.port === window.location.port;
    return (sameHost && samePort) ? candidate : origin;
  } catch(e) {
    return origin;
  }
})();

// ========================================================================
// STATE
// ========================================================================
let ENERGY = {
  EA_plus: 0,
  EA_minus: 0,
  ER_plus: 0,
  ER_minus: 0,
  ES: 0,
  lastEA: null,
  lastGEN: null,
  last_ts: null,
  start_ts: Date.now()
};

let PARTIAL = null;
let updateInterval = null;
let isActive = false; // ✅ ป้องกันการทำงานซ้ำ

// ========================================================================
// UTIL
// ========================================================================
const parseNum = (v, def = 0) => {
  if (v === null || v === undefined || v === "") return def;
  const n = Number(String(v).replace(/[^0-9eE.+-]/g, ""));
  return Number.isFinite(n) ? n : def;
};

const nowMs = () => Date.now();

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ========================================================================
// FETCH
// ========================================================================
async function fetchEnergyRealtime() {
  const device = localStorage.getItem("selectedDevice");
  if (!device) return null;

  const pid = new URLSearchParams(location.search).get("pid") || "";
  const url = pid !== ""
    ? `${API_BASE}/api/json_latest/${device}?project_id=${pid}&_t=${Date.now()}`
    : `${API_BASE}/api/json_latest/${device}?_t=${Date.now()}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const js = await res.json();
    if (js && js.latest) return js.latest;
  } catch (err) {
    console.warn("fetchEnergyRealtime error:", err);
  }

  // Fallback: use public readings API
  try {
    const r = await fetch(`${API_BASE}/public/projects/${encodeURIComponent(pid || (window.MON?.pid||''))}/readings?_t=${Date.now()}`, { cache: 'no-store' });
    const j = await r.json();
    const items = (j.items||[]).filter(x=> String(x.device_id) === String(device));
    const latestByKey = {};
    for (const it of items) {
      const k = it.parameter;
      if (!k) continue;
      // choose latest by timestamp
      const prev = latestByKey[k];
      if (!prev || String(it.timestamp||'') > String(prev.timestamp||'')) {
        latestByKey[k] = it;
      }
    }
    const values = {};
    Object.keys(latestByKey).forEach(k=>{ values[k] = latestByKey[k].value; });
    return Object.keys(values).length ? values : null;
  } catch(e) {
    console.warn('fallback readings error:', e);
  }
  return null;
}

// ========================================================================
// ENERGY CALCULATION
// ========================================================================
function updateEnergy(raw) {
  if (!raw) return;

  const now = nowMs();
  const dh = ENERGY.last_ts ? (now - ENERGY.last_ts) / 3600000 : 0; // hours

  // Helper: pick first available key
  const pick = (obj, keys) => {
    for (const k of keys) {
      if (obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return null;
  };

  // EA+ registers (import)
  const eaReg = pick(raw, [
    'ActiveEnergy_kWh', 'EnergyActiveImport_kWh', 'Energy_Active_Import_kWh',
    'EA+', 'EAP_total', 'kWh_import', 'TotalEnergy_kWh'
  ]);
  const ea = parseNum(eaReg, null);
  if (ea !== null) {
    if (ENERGY.lastEA === null) {
      ENERGY.lastEA = ea;
      ENERGY.EA_plus = ea;
    } else {
      const diff = ea - ENERGY.lastEA;
      ENERGY.EA_plus += diff >= 0 ? diff : ea;
      ENERGY.lastEA = ea;
    }
  }

  // EA- registers (export)
  const genReg = pick(raw, [
    'Generated_kWh', 'EnergyActiveExport_kWh', 'Energy_Active_Export_kWh',
    'EA-', 'kWh_export'
  ]);
  const gen = parseNum(genReg, null);
  if (gen !== null) {
    if (ENERGY.lastGEN === null) {
      ENERGY.lastGEN = gen;
      ENERGY.EA_minus = gen;
    } else {
      const diff = gen - ENERGY.lastGEN;
      ENERGY.EA_minus += diff >= 0 ? diff : gen;
      ENERGY.lastGEN = gen;
    }
  }

  let P = parseNum(pick(raw, ['ActivePower_Total', 'P_total', 'ActivePower', 'TotalActivePower_kW']), null);
  if (P === null) {
    const p1 = parseNum(raw.ActivePower_L1, null);
    const p2 = parseNum(raw.ActivePower_L2, null);
    const p3 = parseNum(raw.ActivePower_L3, null);
    if (p1 !== null || p2 !== null || p3 !== null) {
      P = (p1 || 0) + (p2 || 0) + (p3 || 0);
    }
  }
  if (P !== null && Math.abs(P) > 10000) P = P / 1000;

  let q = parseNum(pick(raw, ['ReactivePower_Total', 'Q_total', 'ReactivePower', 'TotalReactivePower_kvar']), null);
  if (q === null) {
    const q1 = parseNum(raw.ReactivePower_L1, null);
    const q2 = parseNum(raw.ReactivePower_L2, null);
    const q3 = parseNum(raw.ReactivePower_L3, null);
    if (q1 !== null || q2 !== null || q3 !== null) {
      q = (q1 || 0) + (q2 || 0) + (q3 || 0);
    }
  }
  if (q !== null && Math.abs(q) > 10000) q = q / 1000;

  let S = parseNum(pick(raw, ['ApparentPower_Total', 'S_total', 'ApparentPower', 'TotalApparentPower_kVA']), null);
  if (S === null && P !== null && q !== null) {
    S = Math.sqrt(P * P + q * q);
  }
  if (S !== null && Math.abs(S) > 10000) S = S / 1000;

  // Fallback: integrate powers over time when energy registers are missing
  if (dh > 0 && P !== null && ea === null) {
    const imp = Math.max(P, 0);
    const exp = Math.max(-P, 0);
    ENERGY.EA_plus += imp * dh;
    ENERGY.EA_minus += exp * dh;
  }

  if (dh > 0 && q !== null) {
    if (q >= 0) ENERGY.ER_plus += q * dh;
    else ENERGY.ER_minus += Math.abs(q) * dh;
  }

  if (dh > 0 && S !== null) ENERGY.ES += S * dh;

  ENERGY.last_ts = now;
}

// ========================================================================
// PARTIAL
// ========================================================================
function getPartial() {
  if (!PARTIAL) return { ...ENERGY };
  return {
    EA_plus: ENERGY.EA_plus - PARTIAL.EA_plus,
    EA_minus: ENERGY.EA_minus - PARTIAL.EA_minus,
    ER_plus: ENERGY.ER_plus - PARTIAL.ER_plus,
    ER_minus: ENERGY.ER_minus - PARTIAL.ER_minus,
    ES: ENERGY.ES - PARTIAL.ES
  };
}

function resetPartial() {
  PARTIAL = {
    EA_plus: ENERGY.EA_plus,
    EA_minus: ENERGY.EA_minus,
    ER_plus: ENERGY.ER_plus,
    ER_minus: ENERGY.ER_minus,
    ES: ENERGY.ES,
    ts: nowMs()
  };
  console.log("✅ Partial reset");
}

// ========================================================================
// RENDER FUNCTIONS
// ========================================================================
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderGeneral() {
  // ✅ ตรวจสอบว่ายังอยู่ใน Energy tab หรือไม่
  if (!document.getElementById("energy-general-section")) {
    console.warn("⚠️ Energy section not found, stopping update");
    stopEnergyModule();
    return;
  }

  const dur = nowMs() - ENERGY.start_ts;
  setVal("general-duration", formatTime(dur));

  setVal("energy-ea-plus", ENERGY.EA_plus.toFixed(3));
  setVal("energy-ea-minus", (ENERGY.EA_minus * 1000).toFixed(3));
  setVal("energy-er-plus", ENERGY.ER_plus.toFixed(3));
  setVal("energy-er-minus", ENERGY.ER_minus.toFixed(3));
  setVal("energy-es", ENERGY.ES.toFixed(3));

  const P = getPartial();
  const pdur = PARTIAL ? nowMs() - PARTIAL.ts : dur;
  setVal("partial-duration", formatTime(pdur));

  setVal("energy-ea-plus-partial", P.EA_plus.toFixed(3));
  setVal("energy-ea-minus-partial", (P.EA_minus * 1000).toFixed(3));
  setVal("energy-er-plus-partial", P.ER_plus.toFixed(3));
  setVal("energy-er-minus-partial", P.ER_minus.toFixed(3));
  setVal("energy-es-partial", P.ES.toFixed(3));
}

function renderTariff() {
  const tbody = document.getElementById("energy-tariff-total-body");
  if (!tbody) {
    console.warn("⚠️ Tariff table not found, stopping update");
    stopEnergyModule();
    return;
  }

  const rows = [];
  for (let i = 1; i <= 8; i++) {
    rows.push(`
      <tr>
        <td>${i}</td>
        <td>Tariff ${i}</td>
        <td>${(ENERGY.EA_plus / 8).toFixed(3)}</td>
        <td>${((ENERGY.EA_minus * 1000) / 8).toFixed(3)}</td>
        <td>${(ENERGY.ER_plus / 8).toFixed(3)}</td>
        <td>${(ENERGY.ER_minus / 8).toFixed(3)}</td>
        <td>${((ENERGY.ER_plus + ENERGY.ER_minus) / 8).toFixed(3)}</td>
        <td>${(ENERGY.ER_minus / 8).toFixed(3)}</td>
        <td>${(ENERGY.ES / 8).toFixed(3)}</td>
      </tr>
    `);
  }
  tbody.innerHTML = rows.join("");

  // Partial
  const P = getPartial();
  const partialBody = document.getElementById("energy-tariff-partial-body");
  if (!partialBody) return;

  const prows = [];
  for (let i = 1; i <= 8; i++) {
    prows.push(`
      <tr>
        <td>${i}</td>
        <td>Tariff ${i}</td>
        <td>${(P.EA_plus / 8).toFixed(3)}</td>
        <td>${((P.EA_minus * 1000) / 8).toFixed(3)}</td>
        <td>${(P.ER_plus / 8).toFixed(3)}</td>
        <td>${(P.ER_minus / 8).toFixed(3)}</td>
        <td>${((P.ER_plus + P.ER_minus) / 8).toFixed(3)}</td>
        <td>${(P.ER_minus / 8).toFixed(3)}</td>
        <td>${(P.ES / 8).toFixed(3)}</td>
      </tr>
    `);
  }
  partialBody.innerHTML = prows.join("");
}

// ========================================================================
// UPDATE LOOP
// ========================================================================
async function updateEnergyPage() {
  if (!isActive) {
    console.log("⏸️ Energy module stopped");
    return;
  }

  const raw = await fetchEnergyRealtime();
  updateEnergy(raw);

  // Check which section is active
  const generalActive = document.getElementById("energy-general-section")?.classList.contains("active");
  const tariffActive = document.getElementById("energy-tariff-section")?.classList.contains("active");

  if (generalActive) {
    renderGeneral();
  }
  if (tariffActive) {
    renderTariff();
  }
}

// ========================================================================
// START / STOP
// ========================================================================
function stopEnergyModule() {
  console.log("🛑 Stopping energy module");
  isActive = false;
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

function startEnergyModule() {
  console.log("▶️ Starting energy module");
  isActive = true;
  
  updateEnergyPage();
  
  if (updateInterval) clearInterval(updateInterval);
  updateInterval = setInterval(updateEnergyPage, 2000);
}

// ========================================================================
// INIT
// ========================================================================
export function initEnergy() {
  console.log("🚀 INIT ENERGY MODULE");

  // ✅ หยุด module เดิมก่อน (ถ้ามี)
  stopEnergyModule();

  // Setup reset button
  window.resetEnergyPartial = () => {
    resetPartial();
    updateEnergyPage();
  };

  // Start
  startEnergyModule();
}

// ✅ หยุดเมื่อออกจากหน้า
window.addEventListener("beforeunload", stopEnergyModule);

// ✅ หยุดเมื่อ visibility change (สลับ tab browser)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    console.log("👁️ Page hidden - pausing energy module");
    if (updateInterval) clearInterval(updateInterval);
  } else if (isActive) {
    console.log("👁️ Page visible - resuming energy module");
    if (!updateInterval) {
      updateInterval = setInterval(updateEnergyPage, 2000);
    }
  }
});

// ✅ Export stop function
export { stopEnergyModule };
