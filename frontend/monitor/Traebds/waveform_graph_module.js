// ======================================================================
//  waveform_graph_module.js (FULL SAFE VERSION)
// ======================================================================

const Chart = window.Chart;

let waveformChart = null;
let waveformInterval = null;

const REFRESH_MS = 1200;
const SAMPLES = 300;
const COLORS = { L1: '#2563eb', L2: '#10b981', L3: '#dc2626' };

window.isWaveformRunning = false;

// ----------------------------------------------------------------------
// SAFE DOM UTILS
// ----------------------------------------------------------------------
function safeGet(id) {
  return document.getElementById(id) || null;
}

function safeText(id, txt) {
  const el = safeGet(id);
  if (el) el.textContent = txt;
}

// ======================================================================
// INIT
// ======================================================================
export async function initWaveformGraphModule() {

  if (window.isWaveformRunning) return;   // 🔥 Prevent duplicate init
  window.isWaveformRunning = true;

  await stopWaveformInterval();
  setupUIListeners();

  await drawWaveformOnce();
  waveformInterval = setInterval(drawWaveformUpdate, REFRESH_MS);
}

export async function stopWaveformInterval() {

  if (waveformInterval) clearInterval(waveformInterval);
  waveformInterval = null;

  if (waveformChart) {
    try { waveformChart.destroy(); } catch(e){}
    await new Promise(r => setTimeout(r,10));  // 🔥 prevent race
    waveformChart = null;
  }

  window.isWaveformRunning = false;
}

function isValidDeviceVal(dev) {
  if (!dev) return false;
  const s = String(dev).toLowerCase();
  return !(s.includes("select") || s.includes("please") || s.includes("กรุณา"));
}

// ======================================================================
// Generate sine
// ======================================================================
function generateSineSamples(Vrms, freq, phaseDeg = 0) {
  if (!Vrms || Vrms <= 0) return [];

  const Vpeak = Vrms * Math.SQRT2;
  const phase = (phaseDeg * Math.PI) / 180;

  const now = performance.now();
  const t0 = (now / 1000) % (1 / freq);
  const dt = (1 / freq) / SAMPLES;

  const arr = new Array(SAMPLES);
  for (let i = 0; i < SAMPLES; i++) {
    const t = t0 + i * dt;
    arr[i] = { x: i, y: Vpeak * Math.sin(2 * Math.PI * freq * t + phase) };
  }
  return arr;
}

// ======================================================================
// Draw once
// ======================================================================
async function drawWaveformOnce() {
  safeText('waveform-status', '⏳ Loading waveform...');

  const dev = safeGet('hist-device')?.value;
  if (!isValidDeviceVal(dev))
    return safeText('waveform-status', '⚠️ กรุณาเลือก Convertor และ Device ก่อน');

  try {
    const res = await fetch(`/api/json_latest/${dev}?_t=${Date.now()}`);
    if (!res.ok) return safeText('waveform-status', '❌ API error');

    const js = await res.json();
    if (js.status !== 'ok' || !js.latest)
      return safeText('waveform-status', '❌ ไม่มีข้อมูล');

    const d = js.latest;

    let freq = Number(d.Frequency) || 50;
    if (freq < 40 || freq > 70) freq = 50;

    const L1 = Number(d.Voltage_L1) || 0;
    const L2 = Number(d.Voltage_L2) || 0;
    const L3 = Number(d.Voltage_L3) || 0;

    const ds = [];

    if (safeGet('wf-l1')?.checked)
      ds.push({ label: 'L1', data: generateSineSamples(L1, freq, 0), borderColor: COLORS.L1, tension: 0.35, borderWidth: 2, pointRadius: 0 });

    if (safeGet('wf-l2')?.checked)
      ds.push({ label: 'L2', data: generateSineSamples(L2, freq, 120), borderColor: COLORS.L2, tension: 0.35, borderWidth: 2, pointRadius: 0 });

    if (safeGet('wf-l3')?.checked)
      ds.push({ label: 'L3', data: generateSineSamples(L3, freq, 240), borderColor: COLORS.L3, tension: 0.35, borderWidth: 2, pointRadius: 0 });

    // Destroy old
    if (waveformChart) {
      try { waveformChart.destroy(); } catch(e){}
      await new Promise(r => setTimeout(r,10));
    }

    const canvas = safeGet('waveformChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    waveformChart = new Chart(ctx, {
      type: 'line',
      data: { datasets: ds },
      options: {
        animation: false,
        maintainAspectRatio: false,
        scales: {
          x: { type: 'linear', ticks: { maxTicksLimit: 10 }},
          y: { title: { display: true, text: 'Voltage (V)' }}
        },
        plugins: {
          legend: { position: 'bottom' },

          ...(window.chartjsPluginZoom ? {
            zoom: {
              pan: { enabled: true, mode: 'x', modifierKey: 'ctrl' },
              zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
            }
          } : {}),

          ...(window.ChartAnnotation || window.chartjsPluginAnnotation ? {
            annotation: { annotations: makeAnnotations(ds) }
          } : {})
        }
      }
    });

    updateUIInfo(freq, L1, L2, L3);
    safeText('waveform-status', '🌊 Waveform loaded');

  } catch(e) {
    console.error("Waveform error:", e);
    safeText('waveform-status', '❌ Error loading waveform');
  }
}

// ======================================================================
// Update
// ======================================================================
async function drawWaveformUpdate() {
  if (!waveformChart) return drawWaveformOnce();

  const dev = safeGet('hist-device')?.value;
  if (!isValidDeviceVal(dev))
    return safeText('waveform-status', '⚠️ กรุณาเลือก Convertor และ Device ก่อน');

  try {
    const res = await fetch(`/api/json_latest/${dev}?_t=${Date.now()}`);
    if (!res.ok) return safeText('waveform-status', '❌ API error');

    const js = await res.json();
    if (js.status !== 'ok')
      return safeText('waveform-status', '❌ ไม่มีข้อมูล');

    const d = js.latest;

    let freq = Number(d.Frequency) || 50;
    if (freq < 40 || freq > 70) freq = 50;

    const L1 = Number(d.Voltage_L1) || 0;
    const L2 = Number(d.Voltage_L2) || 0;
    const L3 = Number(d.Voltage_L3) || 0;

    const phases = [];

    if (safeGet('wf-l1')?.checked)
      phases.push({ key: 'L1', data: generateSineSamples(L1, freq, 0) });

    if (safeGet('wf-l2')?.checked)
      phases.push({ key: 'L2', data: generateSineSamples(L2, freq, 120) });

    if (safeGet('wf-l3')?.checked)
      phases.push({ key: 'L3', data: generateSineSamples(L3, freq, 240) });

    waveformChart.data.datasets = phases.map(p => ({
      label: p.key,
      data: p.data,
      borderColor: COLORS[p.key],
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 0
    }));

    if (window.ChartAnnotation || window.chartjsPluginAnnotation)
      waveformChart.options.plugins.annotation.annotations = makeAnnotations(waveformChart.data.datasets);

    waveformChart.update("none");

    updateUIInfo(freq, L1, L2, L3);
    safeText('waveform-status', `✔ Updated @ ${new Date().toLocaleTimeString()}`);

  } catch(e) {
    console.error("Waveform update error:", e);
    safeText("waveform-status", "❌ Error updating waveform");
  }
}

// ======================================================================
// Annotation Lines
// ======================================================================
function makeAnnotations(datasets) {
  const ann = {
    zero: {
      type: 'line',
      yMin: 0,
      yMax: 0,
      borderColor: '#888',
      borderDash: [4,4]
    }
  };

  datasets.forEach(ds => {
    let peak = 0;
    ds.data.forEach(p => {
      const abs = Math.abs(p.y);
      if (abs > peak) peak = abs;
    });

    ann[`peak_${ds.label}`] = {
      type: 'line',
      yMin: peak,
      yMax: peak,
      borderColor: ds.borderColor,
      borderDash: [6,2],
      label: { display: true, content: `${ds.label} peak ${Math.round(peak)}V` }
    };
  });

  return ann;
}

// ======================================================================
// Update UI Fields
// ======================================================================
function updateUIInfo(freq, L1, L2, L3) {
  safeText('wf-freq', `Hz: ${freq.toFixed(2)}`);
  safeText('wf-peak-l1', `L1 peak: ${Math.round(L1 * Math.SQRT2)} V`);
  safeText('wf-peak-l2', `L2 peak: ${Math.round(L2 * Math.SQRT2)} V`);
  safeText('wf-peak-l3', `L3 peak: ${Math.round(L3 * Math.SQRT2)} V`);
}

// ======================================================================
function setupUIListeners() {
  const btn = safeGet('wf-refresh');
  if (btn) btn.onclick = drawWaveformUpdate;

  ['wf-l1','wf-l2','wf-l3'].forEach(id => {
    const el = safeGet(id);
    if (el) el.onchange = drawWaveformUpdate;
  });

  const devSel = safeGet('hist-device');
  if (devSel) devSel.onchange = () => setTimeout(drawWaveformUpdate, 120);
}

export default {
  initWaveformGraphModule,
  stopWaveformInterval
};
