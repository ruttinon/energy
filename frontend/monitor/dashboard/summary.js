// ======================================================================
//  ⭐ SUMMARY.JS — Professional Version (Stable + Status + Trends + 4D Motion)
//  Based on original: summary.js
// ======================================================================

const API_BASE = window.location.origin;

// ====== Smooth state memory ======
let prevVoltages = { L1: 0, L2: 0, L3: 0 };
let prevCurrents = { L1: 0, L2: 0, L3: 0 };
let prevPower = { P: 0, Q: 0 };
let sparkDataV = [];
let sparkDataI = [];
let sparkDataP = [];
// ==== FIX: define global hologram buffers =====
let powerCircleParticles = [];   // prevent undefined
let powerCircleTrails = [];      // prevent undefined
let isInitialized = false;
let updateTimer = null;

// Animation loop control
let animationLoopStarted = false;
let holoPhase = 0;          // for rotation / moving grid
let holoPulse = 0;          // for pulsing glow

// ======================================================================
// 🛰️ ดึงข้อมูลสดจากแบ็กเอนด์ (json_latest) พร้อม fallback
// ======================================================================
// helper: safe parse
function parseNumber(v, def = 0) {
  if (v === null || v === undefined || v === '') return def;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9eE.+-]/g, ''));
  return Number.isFinite(n) ? n : def;
}

// fetch live with fallback to /api/dashboard
async function fetchLiveData(device) {
  try {
    const pid = new URLSearchParams(location.search).get('pid') || '';
    const url = pid
      ? `${API_BASE}/api/json_latest/${encodeURIComponent(device)}?project_id=${encodeURIComponent(pid)}&_t=${Date.now()}`
      : `${API_BASE}/api/json_latest/${encodeURIComponent(device)}?_t=${Date.now()}`;

    // try realtime
    let res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const js = await res.json();
      if (js && js.latest) return js.latest;
    }

    // fallback to dashboard/xlsx
    if (pid) {
      try {
        const r2 = await fetch(`${API_BASE}/api/dashboard/${encodeURIComponent(pid)}?year=${new Date().getFullYear()}&month=${String(new Date().getMonth()+1).padStart(2,'0')}`, { cache: 'no-store' });
        if (r2.ok) {
          const jd = await r2.json();
          const latest = (jd.readings && jd.readings.length) ? jd.readings.slice(-1)[0] : null;
          if (latest) {
            // map to expected fields used in summary rendering
            return {
              Voltage_L1: parseNumber(latest.Voltage_L1 ?? latest.v1 ?? latest.V1),
              Voltage_L2: parseNumber(latest.Voltage_L2 ?? latest.v2 ?? latest.V2),
              Voltage_L3: parseNumber(latest.Voltage_L3 ?? latest.v3 ?? latest.V3),
              Current_L1: parseNumber(latest.Current_L1 ?? latest.i1 ?? latest.I1),
              Current_L2: parseNumber(latest.Current_L2 ?? latest.i2 ?? latest.I2),
              Current_L3: parseNumber(latest.Current_L3 ?? latest.i3 ?? latest.I3),
              ActivePower_Total: parseNumber(latest.ActivePower_Total ?? latest.P ?? latest.power),
              ReactivePower_Total: parseNumber(latest.ReactivePower_Total ?? latest.Q ?? latest.q)
            };
          }
        }
      } catch (e) {
        console.warn('fallback dashboard fetch failed', e);
      }
    }

    return null;
  } catch (err) {
    console.warn('⚠ fetchLiveData error:', err);
    return null;
  }
}

// ======================================================================
// 🎛️ STATUS OVERVIEW UPDATE
// ======================================================================
function updateStatusOverview(data) {
  if (!data) return;

  const set = (id, txt, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    const bubble = el.querySelector(".status-bubble");
    if (bubble) bubble.textContent = txt;
    el.className = `status-item ${color}`;
  };

  // Voltage
  const VLL = (data.Voltage_L1L2 + data.Voltage_L2L3 + data.Voltage_L3L1) / 3 || 0;
  let vStatus = "ok";
  if (VLL < 350) vStatus = "warn";
  if (VLL < 300) vStatus = "crit";
  set("status-voltage", `${Number.isFinite(VLL) ? VLL.toFixed(0) : "--"}V`, vStatus);

  // Load (current avg)
  const Iavg = (data.Current_L1 + data.Current_L2 + data.Current_L3) / 3 || 0;
  let loadStatus = "ok";
  if (Iavg > 40) loadStatus = "warn";
  if (Iavg > 65) loadStatus = "crit";
  set("status-load", `${Number.isFinite(Iavg) ? Iavg.toFixed(1) : "--"}A`, loadStatus);

  // PF
  const P = data.ActivePower_Total || 0;
  const Q = data.ReactivePower_Total || 0;
  const S = Math.sqrt(P * P + Q * Q) || 1;
  const PF = Math.abs(P / S);
  let pfStatus = "ok";
  if (PF < 0.9) pfStatus = "warn";
  if (PF < 0.75) pfStatus = "crit";
  set("status-pf", `${Number.isFinite(PF) ? PF.toFixed(2) : "--"}`, pfStatus);

  // Harmonics
  const THDv =
    ((data.THD_Voltage_L1 || 0) +
      (data.THD_Voltage_L2 || 0) +
      (data.THD_Voltage_L3 || 0)) /
    3;

  let hStatus = "ok";
  if (THDv > 5) hStatus = "warn";
  if (THDv > 8) hStatus = "crit";
  set("status-harmonics", `${Number.isFinite(THDv) ? THDv.toFixed(1) : "--"}%`, hStatus);
}

// ======================================================================
// 🔋 Draw Vector (Smooth) with labels and subtle holo motion
// ======================================================================
let holoParticles = [];
function drawVectorSmooth(canvas, volts, amps, t = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // ============================
  // RESPONSIVE CANVAS FIX (สำคัญที่สุด)
  // ============================
  const DPR = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // ป้องกัน rect.width = 0
  if (rect.width === 0 || rect.height === 0) return;

  // Set actual pixel size
  canvas.width = rect.width * DPR;
  canvas.height = rect.width * DPR; // 1:1 square

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.36;

  ctx.clearRect(0, 0, w, h);

  // ====================================
  // TIME-BASED MOTION (5D HOLOGRAM)
  // ====================================
  const time = t || performance.now();
  const rot = Math.sin(time * 0.0007) * 0.08;       
  const pulse = (Math.sin(time * 0.0035) + 1) / 2;  
  const warp = Math.sin(time * 0.0012) * 0.006;     

  // ====================================
  // BACKDROP (Glow + Depth)
  // ====================================
  ctx.save();
  const vg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
  vg.addColorStop(0, `rgba(0,20,30,${0.02 + pulse*0.02})`);
  vg.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Rotating rim
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-cx, -cy);

  ctx.beginPath();
  ctx.lineWidth = 2 * DPR;
  ctx.strokeStyle = `rgba(0,220,255,${0.12 + pulse*0.15})`;
  ctx.shadowBlur = 28 * DPR * (0.6 + pulse*0.8);
  ctx.shadowColor = "rgba(0,220,255,0.45)";
  ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // dashed hologram circle
  ctx.setLineDash([6 * DPR, 8 * DPR]);
  ctx.lineWidth = 1.2 * DPR;
  ctx.strokeStyle = `rgba(120,240,255,${0.18 + pulse*0.14})`;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  // ====================================
  // MICRO GRID RINGS (3D depth)
  // ====================================
  ctx.save();
  ctx.lineWidth = 0.9 * DPR;
  for (let rr = R * 0.22; rr <= R * 0.88; rr += R * 0.22) {
    ctx.strokeStyle = `rgba(0,180,220,${0.06 + (rr/R)*0.08 + pulse*0.02})`;
    ctx.beginPath();
    ctx.arc(cx + warp * 40, cy - warp * 20, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ====================================
  // PARTICLE FIELD (Hologram Dust)
  // ====================================
  if (!Array.isArray(holoParticles) || holoParticles.length < 60) {
    holoParticles = [];
    for (let i = 0; i < 80; i++) {
      holoParticles.push({
        x: cx + (Math.random() - 0.5) * R * 2,
        y: cy + (Math.random() - 0.5) * R * 2,
        z: Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        life: Math.random() * 100 + 40,
        size: (Math.random() * 2 + 0.6) * DPR,
      });
    }
  }

  ctx.save();
  for (let p of holoParticles) {
    p.x += p.vx * (1 + p.z * 1.8);
    p.y += p.vy * (1 + p.z * 1.8);
    p.life -= 0.05;

    if (p.life <= 0) {
      p.x = cx + (Math.random() - 0.5) * R * 2;
      p.y = cy + (Math.random() - 0.5) * R * 2;
      p.life = Math.random() * 100 + 40;
    }

    const alpha = 0.06 + p.z * 0.18 + pulse * 0.04;
    const gd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6);
    gd.addColorStop(0, `rgba(180,255,255,${alpha})`);
    gd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gd;
    ctx.fillRect(p.x - p.size*6, p.y - p.size*6, p.size*12, p.size*12);
  }
  ctx.restore();

  // ====================================
  // DRAW VECTORS (with 5D ghost trails)
  // ====================================
  const phases = ["L1", "L2", "L3"];
  const baseAngles = [0, 240, 120];
  const maxI = Math.max(...Object.values(amps).map(a => Math.abs(a)), 1);

  if (!canvas._trails) canvas._trails = { L1: [], L2: [], L3: [] };

  for (let i = 0; i < 3; i++) {
    const ph = phases[i];
    const base = (baseAngles[i] * Math.PI) / 180;
    const angle = base + rot + Math.sin(time * 0.0009 + i) * 0.01;

    const targetV = Number.isFinite(volts[ph]) ? volts[ph] : 0;
    const targetI = Number.isFinite(amps[ph]) ? amps[ph] : 0;

    prevVoltages[ph] += (targetV - prevVoltages[ph]) * 0.16;
    prevCurrents[ph] += (targetI - prevCurrents[ph]) * 0.16;

    const v = prevVoltages[ph];
    const c = prevCurrents[ph];

    const vx = cx + R * Math.cos(angle);
    const vy = cy + R * Math.sin(angle);

    const curLen = (R * (Math.abs(c) / maxI)) * 0.78;
    const ix = cx + curLen * Math.cos(angle + Math.PI / 14);
    const iy = cy + curLen * Math.sin(angle + Math.PI / 14);

    // trails
    const trails = canvas._trails[ph];
    trails.push({ vx, vy, ix, iy });
    if (trails.length > 12) trails.shift();

    for (let k = 0; k < trails.length; k++) {
      const tr = trails[k];
      const s = (k / trails.length);

      ctx.save();
      ctx.globalAlpha = s * 0.25 * (0.4 + pulse * 0.6);
      ctx.strokeStyle = `rgba(255,255,255,${s})`;
      ctx.lineWidth = 2.5 * DPR * (1 - s);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tr.vx, tr.vy);
      ctx.stroke();
      ctx.restore();
    }

    // MAIN VOLTAGE VECTOR
    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5 * DPR;
    ctx.shadowBlur = 18 * DPR;
    ctx.shadowColor = "rgba(120,240,255,0.9)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(vx, vy);
    ctx.stroke();
    ctx.restore();

    // CURRENT VECTOR
    ctx.save();
    ctx.strokeStyle = "#ff5a5a";
    ctx.lineWidth = 2 * DPR;
    ctx.shadowBlur = 8 * DPR;
    ctx.shadowColor = "rgba(255,120,120,0.6)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ix, iy);
    ctx.stroke();
    ctx.restore();

    // Labels
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.font = `${14 * DPR}px Orbitron`;
    ctx.fillText(`V${i+1} ${v.toFixed(2)} V`, vx + 12, vy + 12);

    ctx.fillStyle = "#ff9a9a";
    ctx.font = `${13 * DPR}px Orbitron`;
    ctx.fillText(`I${i+1} ${c.toFixed(3)} A`, ix + 12, iy + 12);
    ctx.restore();
  }
}

// ======================================================================
// ⚡ Power Circle — 5D HOLOGRAM (matching Vector Diagram)
// ======================================================================
function drawPowerCircleSmooth(canvas, P, Q, t = 0) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // --- RESPONSIVE DPR + SQUARE CANVAS ---
  const DPR = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const size = Math.min(rect.width, rect.height);
  canvas.width = size * DPR;
  canvas.height = size * DPR;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.36;

  ctx.clearRect(0, 0, w, h);

  // TIME MOTION (same as vector)
  const time = t || performance.now();
  const rot = Math.sin(time * 0.0007) * 0.08;
  const pulse = (Math.sin(time * 0.0035) + 1) / 2;
  const warp = Math.sin(time * 0.0012) * 0.006;

  // ======================================================================
  // BACKDROP — Gradient + Vignette (same style)
  // ======================================================================
  ctx.save();
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
  bg.addColorStop(0, `rgba(0,20,30,${0.02 + pulse * 0.02})`);
  bg.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();


  // ======================================================================
  // ROTATING RIM (identical style to vector)
  // ======================================================================
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(-cx, -cy);

  ctx.beginPath();
  ctx.lineWidth = 2 * DPR;
  ctx.strokeStyle = `rgba(0,220,255,${0.12 + pulse * 0.15})`;
  ctx.shadowBlur = 28 * DPR * (0.6 + pulse * 0.8);
  ctx.shadowColor = "rgba(0,220,255,0.45)";
  ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // dashed
  ctx.setLineDash([6 * DPR, 8 * DPR]);
  ctx.lineWidth = 1.2 * DPR;
  ctx.strokeStyle = `rgba(120,240,255,${0.18 + pulse * 0.14})`;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();

  // ======================================================================
  // MICRO GRID RINGS — identical style
  // ======================================================================
  ctx.save();
  ctx.lineWidth = 0.9 * DPR;
  for (let rr = R * 0.22; rr <= R * 0.88; rr += R * 0.22) {
    ctx.strokeStyle = `rgba(0,180,220,${0.06 + (rr / R) * 0.08 + pulse * 0.02})`;
    ctx.beginPath();
    ctx.arc(cx + warp * 40, cy - warp * 20, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // ======================================================================
  // PARTICLE FIELD (same hologram dust)
  // ======================================================================
  if (!Array.isArray(powerCircleParticles) || powerCircleParticles.length < 60) {
    powerCircleParticles = [];
    for (let i = 0; i < 80; i++) {
      powerCircleParticles.push({
        x: cx + (Math.random() - 0.5) * R * 2,
        y: cy + (Math.random() - 0.5) * R * 2,
        z: Math.random() * 1.2,
        vx: (Math.random() - 0.5) * 0.02,
        vy: (Math.random() - 0.5) * 0.02,
        life: Math.random() * 100 + 40,
        size: (Math.random() * 2 + 0.6) * DPR,
      });
    }
  }

  ctx.save();
  for (let p of powerCircleParticles) {
    p.x += p.vx * (1 + p.z * 1.8);
    p.y += p.vy * (1 + p.z * 1.8);
    p.life -= 0.05;

    if (p.life <= 0) {
      p.x = cx + (Math.random() - 0.5) * R * 2;
      p.y = cy + (Math.random() - 0.5) * R * 2;
      p.life = Math.random() * 100 + 40;
    }

    const alpha = 0.06 + p.z * 0.18 + pulse * 0.04;
    const gd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 6);
    gd.addColorStop(0, `rgba(180,255,255,${alpha})`);
    gd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gd;
    ctx.fillRect(p.x - p.size * 6, p.y - p.size * 6, p.size * 12, p.size * 12);
  }
  ctx.restore();


  // ======================================================================
  // SMOOTH P/Q interpolation (same logic as vector)
  // ======================================================================
  prevPower.P += (P - prevPower.P) * 0.16;
  prevPower.Q += (Q - prevPower.Q) * 0.16;

  // Mapping
  const maxPQ = Math.max(1, Math.abs(prevPower.P), Math.abs(prevPower.Q));
  const scale = R * 0.85 / maxPQ;

  const px = cx + prevPower.P * scale;
  const py = cy - prevPower.Q * scale;

  // ======================================================================
  // Ghost TRAILS (same as vector)
  // ======================================================================
  if (!Array.isArray(powerCircleTrails)) powerCircleTrails = [];
  powerCircleTrails.push({ x: px, y: py });
  if (powerCircleTrails.length > 14) powerCircleTrails.shift();

  for (let i = 0; i < powerCircleTrails.length; i++) {
    const tr = powerCircleTrails[i];
    const s = i / powerCircleTrails.length;

    ctx.save();
    ctx.globalAlpha = s * 0.25 * (0.4 + pulse * 0.6);
    ctx.strokeStyle = `rgba(255,255,255,${s})`;
    ctx.lineWidth = 2.5 * DPR * (1 - s);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tr.x, tr.y);
    ctx.stroke();
    ctx.restore();
  }

  // ======================================================================
  // MAIN VECTOR (white glow same as vector voltage)
  // ======================================================================
  ctx.save();
  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 3.5 * DPR;
  ctx.shadowBlur = 18 * DPR;
  ctx.shadowColor = "rgba(120,240,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(px, py);
  ctx.stroke();
  ctx.restore();

  // Tip Glow
  ctx.save();
  ctx.fillStyle = "#00faff";
  ctx.shadowBlur = 28 * DPR;
  ctx.shadowColor = "rgba(0,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(px, py, 6 * DPR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ======================================================================
  // LABELS (same style)
  // ======================================================================
  ctx.save();
  ctx.fillStyle = "#bffaff";
  ctx.font = `${14 * DPR}px Orbitron`;

  ctx.fillText(`P: ${prevPower.P.toFixed(0)} W`, px + 14, py - 6);
  ctx.fillText(`Q: ${prevPower.Q.toFixed(0)} var`, cx + 14, cy - R + 26);

  const midX = (px + cx) / 2;
  const midY = (py + cy) / 2;
  const S = Math.sqrt(prevPower.P ** 2 + prevPower.Q ** 2);
  ctx.fillText(`${S.toFixed(0)} VA`, midX + 8, midY - 6);

  ctx.restore();

  // Axis labels
  ctx.save();
  ctx.font = `${12 * DPR}px Orbitron`;
  ctx.fillStyle = "rgba(180,255,255,0.9)";
  ctx.fillText("W", cx + R - 26, cy - 6);
  ctx.fillText("VAR", cx + 8, cy - R - 6);
  ctx.restore();
}

// ======================================================================
// 📉 Render sparklines (tiny trend graphs)
// ======================================================================
function drawSpark(canvas, arr) {
  if (!canvas || arr.length < 2) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width = canvas.width; // ensure pixel dimensions remain
  const h = canvas.height = canvas.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const range = max - min || 1;

  ctx.strokeStyle = "#00eaff";
  ctx.lineWidth = 1.6;

  ctx.beginPath();
  arr.forEach((v, i) => {
    const x = (i / (arr.length - 1)) * canvas.clientWidth;
    const y = canvas.clientHeight - ((v - min) / range) * canvas.clientHeight;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// ======================================================================
// 📊 Update right side values
// ======================================================================
function updateRightTables(data) {
  const safe = (id, t) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t;
  };

  // nominal
  safe("nomV", "400 V");
  safe("nomVN", "230 V");
  safe("nomF", "50 Hz");
  safe("nomI", "--");

  // system values (safely)
  const VLL = (
    ((data.Voltage_L1L2 || 0) + (data.Voltage_L2L3 || 0) + (data.Voltage_L3L1 || 0)) /
    3
  );
  const VLN = (
    ((data.Voltage_L1 || 0) + (data.Voltage_L2 || 0) + (data.Voltage_L3 || 0)) /
    3
  );
  const Iavg = (
    ((data.Current_L1 || 0) + (data.Current_L2 || 0) + (data.Current_L3 || 0)) /
    3
  );

  safe("sysVLL", `${Number.isFinite(VLL) ? VLL.toFixed(2) : "--"} V`);
  safe("sysVLN", `${Number.isFinite(VLN) ? VLN.toFixed(2) : "--"} V`);
  safe("sysI", `${Number.isFinite(Iavg) ? Iavg.toFixed(3) : "--"} A`);
  safe("sysF", `${Number.isFinite(data.Frequency) ? data.Frequency.toFixed(2) : "--"} Hz`);

  // quality
  const voltArr = [data.Voltage_L1 || 0, data.Voltage_L2 || 0, data.Voltage_L3 || 0];
  const currArr = [data.Current_L1 || 0, data.Current_L2 || 0, data.Current_L3 || 0];
  const UBv = (((Math.max(...voltArr) - Math.min(...voltArr)) / (voltArr.reduce((a,b)=>a+b,0)/3 || 1)) * 100).toFixed(2);
  const UBi = (((Math.max(...currArr) - Math.min(...currArr)) / (currArr.reduce((a,b)=>a+b,0)/3 || 1)) * 100).toFixed(2);

  const THDv = (((data.THD_Voltage_L1 || 0) + (data.THD_Voltage_L2 || 0) + (data.THD_Voltage_L3 || 0)) / 3).toFixed(2);
  const THDi = (((data.THD_Current_L1 || 0) + (data.THD_Current_L2 || 0) + (data.THD_Current_L3 || 0)) / 3).toFixed(2);

  safe("qualU", `${UBv} %`);
  safe("qualI", `${UBi} %`);
  safe("qualV", `${THDv} %`);
  safe("thdI", `${THDi} %`);

  // power
  const P = data.ActivePower_Total || 0;
  const Q = data.ReactivePower_Total || 0;
  const S = Math.sqrt(P * P + Q * Q);
  const PF = S ? (P / S) : 0;

  safe("pwrP", `${Number.isFinite(P) ? P.toFixed(2) : "--"} W`);
  safe("pwrQ", `${Number.isFinite(Q) ? Q.toFixed(2) : "--"} var`);
  safe("pwrS", `${Number.isFinite(S) ? S.toFixed(2) : "--"} VA`);
  safe("pwrPF", `${Number.isFinite(PF) ? PF.toFixed(3) : "--"}`);
}

// ======================================================================
// 🔄 Main update loop (data fetching & updates every 500ms)
// ======================================================================
async function updateSummary() {
  const device = localStorage.getItem("selectedDevice");
  if (!device) return;

  const data = await fetchLiveData(device);
  if (!data) return;

  // update status bar
  updateStatusOverview(data);

  // update trends
  const avgV =
    ((data.Voltage_L1 || 0) + (data.Voltage_L2 || 0) + (data.Voltage_L3 || 0)) / 3;
  const avgI =
    ((data.Current_L1 || 0) + (data.Current_L2 || 0) + (data.Current_L3 || 0)) / 3;
  const power = data.ActivePower_Total || 0;

  sparkDataV.push(avgV);
  sparkDataI.push(avgI);
  sparkDataP.push(power);

  if (sparkDataV.length > 30) sparkDataV.shift();
  if (sparkDataI.length > 30) sparkDataI.shift();
  if (sparkDataP.length > 30) sparkDataP.shift();

  // update sparkline canvases (use clientWidth for scaling)
  try { drawSpark(document.getElementById("sparkV"), sparkDataV); } catch (e) {}
  try { drawSpark(document.getElementById("sparkI"), sparkDataI); } catch (e) {}
  try { drawSpark(document.getElementById("sparkP"), sparkDataP); } catch (e) {}

  // prepare data for visuals (vector uses the raw volts/amps; draw functions smooth)
  const volts = {
    L1: data.Voltage_L1 || 0,
    L2: data.Voltage_L2 || 0,
    L3: data.Voltage_L3 || 0
  };
  const amps = {
    L1: data.Current_L1 || 0,
    L2: data.Current_L2 || 0,
    L3: data.Current_L3 || 0
  };

  // update prevPower targets (draw loop reads prevPower)
  // do not call heavy draw functions here (animation loop will draw smoothly),
  // but call once to ensure immediate values displayed if animation hasn't started yet
  try {
    drawVectorSmooth(document.getElementById("vectorCanvas"), volts, amps, performance.now());
    drawPowerCircleSmooth(document.getElementById("powerCanvas"), data.ActivePower_Total || 0, data.ReactivePower_Total || 0, performance.now());
  } catch (e) {
    console.warn("Draw quick update failed:", e);
  }

  updateRightTables(data);
}

// ======================================================================
// 🎞️ Animation loop (separate from data update)
// - keeps holo motion smooth via requestAnimationFrame
// ======================================================================
function animationLoop() {
  const t = performance.now();
  holoPhase += 0.0009; // slow rotation

  // draw based on prev* (which updateSummary sets)
  const vCanvas = document.getElementById("vectorCanvas");
  const pCanvas = document.getElementById("powerCanvas");

  try {
    // vector uses current prevVoltages/prevCurrents
    drawVectorSmooth(vCanvas, prevVoltages, prevCurrents, t);
  } catch (e) {}

  try {
    drawPowerCircleSmooth(pCanvas, prevPower.P, prevPower.Q, t);
  } catch (e) {}

  // small update to sparklines glow (optional)
  // schedule next frame
  requestAnimationFrame(animationLoop);
}

function startAnimationLoopOnce() {
  if (!animationLoopStarted) {
    animationLoopStarted = true;
    requestAnimationFrame(animationLoop);
  }
}

// ======================================================================
// 🚀 INIT
// ======================================================================
async function initSummary() {
  const device = localStorage.getItem("selectedDevice");
  if (!device) {
    console.warn("⚠ no selectedDevice");
    return;
  }

  const first = await fetchLiveData(device);
  if (!first) return;

  // init previous
  prevVoltages = {
    L1: first.Voltage_L1 || 0,
    L2: first.Voltage_L2 || 0,
    L3: first.Voltage_L3 || 0
  };
  prevCurrents = {
    L1: first.Current_L1 || 0,
    L2: first.Current_L2 || 0,
    L3: first.Current_L3 || 0
  };
  prevPower = {
    P: first.ActivePower_Total || 0,
    Q: first.ReactivePower_Total || 0
  };

  // immediate update to tables + one frame draw
  await updateSummary();

  // start data loop
  if (updateTimer) clearInterval(updateTimer);
  updateTimer = setInterval(updateSummary, 2000); // 2s default - safe and near-real-time

  // start animation loop
  startAnimationLoopOnce();
}

// ======================================================================
// EVENT — When device changes externally
// ======================================================================
window.addEventListener("deviceConfirmed", async (e) => {
  if (updateTimer) clearInterval(updateTimer);
  await initSummary();
});

// auto start
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSummary);
} else {
  initSummary();
}

// allow external call
window.updateSummary = updateSummary;
window.refreshSummary = initSummary;


