/**
 * AE BILLING ADMIN - JavaScript (FULLY FIXED)
 * ✅ แก้ไขการส่งข้อมูลไปยัง PDF Template
 * ✅ เพิ่มระบบเลือก Template แยกตามปุ่ม
 * ✅ แก้ไขการคำนวณเงินให้ถูกต้อง
 */

// ===================== UTILITIES =====================
const el = (id) => document.getElementById(id);
const safeNum = (v, dec = 3) => {
  v = Number(v);
  return isNaN(v) ? (0).toFixed(dec) : v.toFixed(dec);
};

const formatMoney = (v) => {
  return new Intl.NumberFormat('th-TH').format(Number(v || 0).toFixed(2));
};

// ===================== GLOBAL STATE =====================
let TEMPLATE_LIST = [];
let DEFAULT_TEMPLATE = null;
let _pendingAction = null;
window.allDeviceBills = [];

// ⭐ NEW: เก็บ Template Preferences แยกตามปุ่ม
const TEMPLATE_PREFS = {
  summary: null,           // ปุ่ม "สรุปรายวัน"
  single_device: null,     // ปุ่ม "บิลรายเครื่อง"
  convertor: null,         // ปุ่ม "บิลรายกลุ่ม"
  merged: null             // ปุ่ม "รายงานรวมทั้งหมด"
};

// Load preferences from localStorage
function loadTemplatePrefs() {
  const saved = localStorage.getItem('ae_template_prefs');
  if (saved) {
    Object.assign(TEMPLATE_PREFS, JSON.parse(saved));
  }
}

// Save preferences to localStorage
function saveTemplatePrefs() {
  localStorage.setItem('ae_template_prefs', JSON.stringify(TEMPLATE_PREFS));
}

// ===================== TEMPLATE MANAGEMENT =====================
async function loadTemplates() {
  try {
    const [listRes, defRes] = await Promise.all([
      fetch("/api/report_template/list"),
      fetch("/api/report_template/default")
    ]);

    const listJs = await listRes.json();
    const defJs = await defRes.json();

    TEMPLATE_LIST = listJs.templates || [];
    DEFAULT_TEMPLATE = defJs?.default_template ?? null;

    console.log('✅ Templates loaded:', TEMPLATE_LIST.length);
    renderTemplateManagerList();
  } catch (err) {
    console.error("❌ loadTemplates error:", err);
  }
}

function renderTemplateManagerList() {
  const wrap = el("templateManagerList");
  if (!wrap) return;

  if (!TEMPLATE_LIST || TEMPLATE_LIST.length === 0) {
    wrap.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted);">
        <div style="font-size:48px;margin-bottom:16px;">📄</div>
        <p>ยังไม่มีเทมเพลต</p>
        <p style="font-size:12px;">คลิก "สร้างเทมเพลตใหม่" เพื่อเริ่มต้น</p>
      </div>`;
    return;
  }

  wrap.innerHTML = TEMPLATE_LIST.map(tpl => {
    const isDefault = tpl.id === DEFAULT_TEMPLATE;
    return `
      <div class="template-item ${isDefault ? 'selected' : ''}">
        <div class="template-icon">📄</div>
        <div class="template-info">
          <div class="template-name">${tpl.name}</div>
          <div class="template-desc">${tpl.desc || 'ไม่มีคำอธิบาย'}</div>
        </div>
        ${isDefault ? '<span class="template-badge">Default</span>' : ''}
        <div style="display:flex;gap:8px;">
          <button class="table-btn" onclick="previewTemplate('${tpl.id}')">👁️</button>
          <button class="table-btn" onclick="editTemplate('${tpl.id}')">✏️</button>
          ${!isDefault ? `<button class="table-btn" onclick="setDefaultTemplate('${tpl.id}')">⭐</button>` : ''}
          <button class="table-btn" onclick="deleteTemplate('${tpl.id}')" style="color:var(--primary);">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

// ===================== MODAL CONTROLS =====================
function openTemplateModal(actionCallback, buttonType = null) {
  _pendingAction = actionCallback;
  const listWrap = el("templateList");

  // ⭐ แสดง Template ที่เคยเลือกไว้สำหรับปุ่มนี้
  const savedTplId = buttonType ? TEMPLATE_PREFS[buttonType] : null;

  if (!TEMPLATE_LIST || TEMPLATE_LIST.length === 0) {
    listWrap.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-muted);">
        ไม่มีเทมเพลต กรุณาสร้างเทมเพลตก่อน
      </div>`;
  } else {
    listWrap.innerHTML = TEMPLATE_LIST.map(tpl => {
      const isDefault = tpl.id === DEFAULT_TEMPLATE;
      const isSaved = tpl.id === savedTplId;
      return `
        <div class="template-item ${isSaved ? 'selected' : ''}" onclick="chooseTemplate('${tpl.id}', '${buttonType || ''}')" style="cursor:pointer;">
          <div class="template-icon">📄</div>
          <div class="template-info">
            <div class="template-name">${tpl.name}</div>
            <div class="template-desc">${tpl.desc || 'ไม่มีคำอธิบาย'}</div>
          </div>
          ${isDefault ? '<span class="template-badge">Default</span>' : ''}
          ${isSaved ? '<span class="template-badge" style="background:var(--success);">Saved</span>' : ''}
        </div>`;
    }).join('');
  }

  el("templateModal").classList.add("active");
}

function closeTemplateModal() {
  el("templateModal").classList.remove("active");
}

function chooseTemplate(id, buttonType = null) {
  // ⭐ บันทึก Template ที่เลือกสำหรับปุ่มนี้
  if (buttonType && buttonType !== 'null' && buttonType !== '') {
    TEMPLATE_PREFS[buttonType] = id;
    saveTemplatePrefs();
    console.log(`✅ Saved template preference: ${buttonType} -> ${id}`);
  }

  closeTemplateModal();
  if (_pendingAction) {
    const cb = _pendingAction;
    Promise.resolve(cb(id))
      .then(() => _pendingAction = null)
      .catch(() => _pendingAction = null);
  }
}

function openTemplateManager() {
  el("templateManager").classList.add("active");
  loadTemplates();
}

function closeTemplateManager() {
  el("templateManager").classList.remove("active");
}

// ===================== TEMPLATE ACTIONS =====================
async function createNewTemplate() {
  const name = prompt("ชื่อเทมเพลต:");
  if (!name) return;

  try {
    const res = await fetch("/api/report_template/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: name, name: name, desc: '' })
    });

    if (res.ok) {
      alert("✅ สร้างเทมเพลตสำเร็จ");
      await loadTemplates();
      editTemplate(name);
    } else {
      alert("❌ สร้างเทมเพลตล้มเหลว");
    }
  } catch (err) {
    console.error("createNewTemplate error:", err);
    alert("❌ เกิดข้อผิดพลาด");
  }
}

function editTemplate(id) {
  window.open(`/admin/report_admin/report_template_editor.html?template_id=${id}`, '_blank');
}

function previewTemplate(id) {
  const w = window.open("", "_blank");
  w.document.body.innerHTML = `<div style='padding:24px;font-family:Kanit;'>กำลังโหลด...</div>`;

  fetch(`/api/report_template/preview?id=${id}`)
    .then(r => r.ok ? r.text() : Promise.reject('Preview failed'))
    .then(html => {
      w.document.open();
      w.document.write(html);
      w.document.close();
    })
    .catch(err => {
      w.document.body.innerHTML = `<div style='padding:24px;color:red;'>โหลดตัวอย่างล้มเหลว</div>`;
    });
}

async function setDefaultTemplate(id) {
  try {
    const res = await fetch("/api/report_template/set_default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: id })
    });

    const js = await res.json();
    if (js.status === "ok") {
      DEFAULT_TEMPLATE = id;
      alert("✅ ตั้งค่า Default เรียบร้อย");
      renderTemplateManagerList();
    } else {
      alert("❌ ตั้งค่าไม่สำเร็จ");
    }
  } catch (err) {
    alert("❌ เซิร์ฟเวอร์ขัดข้อง");
  }
}

async function deleteTemplate(id) {
  if (!confirm(`ต้องการลบเทมเพลต "${id}" ?`)) return;

  try {
    const res = await fetch(`/api/report_template/delete/${id}`, { method: "DELETE" });
    const js = await res.json().catch(() => ({}));

    if (js.status === "ok") {
      alert("✅ ลบเทมเพลตเรียบร้อย");
      await loadTemplates();
    } else {
      alert("❌ ลบไม่สำเร็จ");
    }
  } catch (err) {
    alert("❌ เซิร์ฟเวอร์ขัดข้อง");
  }
}

// ===================== PDF RENDER =====================
async function requestRender(templateId, context) {
  console.log('📤 Sending to template:', templateId);
  console.log('📦 Context data:', context);

  const res = await fetch("/api/report_template/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      template_id: templateId,
      data: context
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('❌ Render error:', errorText);
    throw new Error(`Render failed: ${res.status} - ${errorText}`);
  }

  return await res.blob();
}

async function downloadPDF(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 🔥 FIXED: ฟังก์ชันแปลงข้อมูล API เป็น Context ที่ Template ต้องการ
function buildTemplateContext(apiData) {
  console.log('📥 Raw API Data:', apiData);

  // ดึงข้อมูล device (อาจอยู่ใน array หรือ root level)
  const device = apiData.devices && apiData.devices[0] ? apiData.devices[0] : apiData;

  // 🔥 คำนวณค่าต่างๆ ให้ถูกต้อง (ตรวจสอบทุก field ที่เป็นไปได้)
  const meter_start = Number(
    device.meter_start ||
    device.meter_prev ||
    apiData.meter_start ||
    apiData.meter_prev ||
    0
  );

  const meter_end = Number(
    device.meter_end ||
    device.meter_now ||
    apiData.meter_end ||
    apiData.meter_now ||
    meter_start
  );

  const energy = Number(
    device.energy ||
    device.used ||
    device.total_used_today ||
    apiData.energy ||
    apiData.used ||
    (meter_end - meter_start)
  );

  const price_per_unit = Number(
    device.price_per_unit ||
    apiData.price_per_unit ||
    apiData.price?.price_per_unit ||
    5.0
  );

  const total_money = Number(
    device.total_money ||
    device.money ||
    device.money_today ||
    apiData.total_money ||
    apiData.money ||
    (energy * price_per_unit)
  );

  // วันที่
  const date = (
    device.date ||
    apiData.date ||
    apiData.meta?.date ||
    new Date().toISOString().slice(0, 10)
  );

  // ข้อมูลอุปกรณ์
  const device_id = device.device_id || apiData.device_id || 'UNKNOWN';
  const device_name = device.device_name || apiData.device_name || device_id;

  // ข้อมูลลูกค้า
  const customer = {
    name: (
      device.customer?.name ||
      apiData.customer?.name ||
      device_name ||
      ''
    ),
    address: (
      device.customer?.address ||
      apiData.customer?.address ||
      ''
    )
  };

  // Invoice
  const invoice = {
    id: `INV-${device_id}-${date}`,
    date: date,
    total: total_money.toFixed(2)
  };

  // Summary
  const summary_today = {
    units: energy.toFixed(3),
    money: total_money.toFixed(2)
  };

  // 🔥 สร้าง context ที่ครบถ้วน (รองรับทุกชื่อตัวแปรที่เป็นไปได้)
  const context = {
    // ข้อมูลพื้นฐาน
    date: date,
    device_id: device_id,
    device_name: device_name,
    convertor_id: device.convertor_id || apiData.convertor_id || '',

    // ค่ามิเตอร์ (รองรับหลายชื่อ)
    meter_prev: meter_start.toFixed(3),
    meter_now: meter_end.toFixed(3),
    meter_start: meter_start.toFixed(3),
    meter_end: meter_end.toFixed(3),

    // พลังงาน (รองรับหลายชื่อ)
    energy: energy.toFixed(3),
    used: energy.toFixed(3),
    total_used_today: energy.toFixed(3),
    last_increment: Number(device.last_increment || 0).toFixed(3),

    // เงิน (รองรับหลายชื่อ)
    money: total_money.toFixed(2),
    total_money: total_money.toFixed(2),
    money_today: total_money.toFixed(2),
    total_money_today: total_money.toFixed(2),
    total_cost: total_money.toFixed(2),

    // ราคา
    price_per_unit: price_per_unit.toFixed(2),

    // ข้อมูลลูกค้า
    customer: customer,

    // Invoice
    invoice: invoice,

    // Summary
    summary_today: summary_today,

    // เก็บ original data ไว้ด้วย
    _original: apiData
  };

  console.log('✅ Built Context:', context);
  return context;
}

// ===================================
// แก้ไข generateBill ให้ใช้ context ที่ถูกต้อง
// ===================================
async function generateBill(deviceId) {
  try {
    const r = await fetch(`/api/billing/device_bill/${deviceId}`);
    const js = await r.json();

    console.log('🔥 API Response:', js);

    if (js.status !== "ok") {
      alert("ไม่พบบิลของอุปกรณ์นี้");
      return;
    }

    const bill = js.data;

    // 🔥 สร้าง context ที่ถูกต้อง
    const context = buildTemplateContext(bill);

    // ใช้ Template ที่บันทึกไว้
    const savedTpl = TEMPLATE_PREFS.single_device;

    if (savedTpl) {
      const useSaved = confirm(`ใช้เทมเพลตที่บันทึกไว้ (${savedTpl}) ?`);
      if (useSaved) {
        const ok = await startRenderBill(savedTpl, context, `bill_${deviceId}`);
        if (ok) return;
      }
    } else if (DEFAULT_TEMPLATE) {
      const useDef = confirm(`ใช้เทมเพลต Default (${DEFAULT_TEMPLATE}) ?`);
      if (useDef) {
        const ok = await startRenderBill(DEFAULT_TEMPLATE, context, `bill_${deviceId}`);
        if (ok) return;
      }
    }

    openTemplateModal(async (tplId) => {
      await startRenderBill(tplId, context, `bill_${deviceId}`);
    }, 'single_device');
  } catch (err) {
    console.error('❌ Generate bill error:', err);
    alert("❌ ออกบิลล้มเหลว: " + err.message);
  }
}

// ===================================
// แก้ไข startRenderBill
// ===================================
async function startRenderBill(tplId, context, filename) {
  try {
    console.log('📄 Rendering:', tplId);
    console.log('📦 Context:', context);

    const res = await fetch("/api/report_template/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: tplId,
        data: context  // ส่ง context ที่สร้างแล้ว
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Render error:', errorText);
      throw new Error(`Render failed: ${res.status}`);
    }

    const blob = await res.blob();
    await downloadPDF(blob, `${filename}.html`);
    return true;
  } catch (err) {
    console.error("❌ Render error:", err);
    alert(`เกิดข้อผิดพลาด: ${err.message}`);
    return false;
  }
}

// ===================================
// แก้ไข generateAllBills
// ===================================
async function generateAllBills() {
  try {
    const rs = await fetch("/api/billing/all_bills");
    const js = await rs.json();
    const bills = js.data;

    console.log('🔥 All bills:', bills);

    if (!bills || bills.length === 0) {
      alert("ไม่มีบิลวันนี้");
      return;
    }

    window.allDeviceBills = bills;

    const choice = confirm(
      `พบ ${bills.length} บิล\n\n` +
      `[ตกลง] = ออกทีละบิล (${bills.length} ไฟล์)\n` +
      `[ยกเลิก] = ออกเฉพาะที่เลือก`
    );

    if (!choice) {
      alert("ยกเลิกการออกบิล");
      return;
    }

    const doRender = async (tplId) => {
      let count = 0;
      let success = 0;

      alert(`📦 กำลังสร้างบิล ${bills.length} รายการ...\nกรุณารอสักครู่`);

      for (const b of bills) {
        count++;
        try {
          // 🔥 สร้าง context ที่ถูกต้อง
          const context = buildTemplateContext(b);
          const ok = await startRenderBill(tplId, context, `bill_${b.device_id}_${new Date().toISOString().slice(0, 10)}`);
          if (ok) success++;

          if (count % 5 === 0) {
            console.log(`📄 Progress: ${count}/${bills.length}`);
          }

          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          console.error(`❌ Failed to generate bill for ${b.device_id}:`, err);
        }
      }

      alert(`✅ ออกบิลสำเร็จ ${success}/${bills.length} รายการ\n(${bills.length} ไฟล์ PDF แยก)`);
    };

    const savedTpl = TEMPLATE_PREFS.single_device;

    if (savedTpl && confirm(`ใช้เทมเพลตที่บันทึกไว้สำหรับทั้งหมด (${savedTpl})?`)) {
      await doRender(savedTpl);
    } else if (DEFAULT_TEMPLATE && confirm(`ใช้เทมเพลต Default สำหรับทั้งหมด?`)) {
      await doRender(DEFAULT_TEMPLATE);
    } else {
      openTemplateModal(doRender, 'single_device');
    }
  } catch (err) {
    console.error('❌ Generate all bills error:', err);
    alert("❌ เกิดข้อผิดพลาด");
  }
}

// ===================================
// แก้ไข downloadSummary
// ===================================
async function downloadSummary() {
  const savedTpl = TEMPLATE_PREFS.summary;

  const doDownload = async (tplId) => {
    try {
      const res = await fetch("/api/billing/all_bills");
      const js = await res.json();
      const items = js.data || [];

      if (items.length === 0) {
        alert("⚠️ ไม่มีข้อมูลวันนี้");
        return;
      }

      // 🔥 สร้าง summary context ที่ถูกต้อง
      const totalEnergy = items.reduce((sum, i) => {
        const energy = Number(i.energy || i.used || i.total_used_today || 0);
        return sum + energy;
      }, 0);

      const totalMoney = items.reduce((sum, i) => {
        const money = Number(i.total_money || i.money || i.money_today || 0);
        return sum + money;
      }, 0);

      // แปลง items ให้เป็น format ที่ template ต้องการ
      const formattedItems = items.map(item => {
        const ctx = buildTemplateContext(item);
        return {
          device_id: ctx.device_id,
          device_name: ctx.device_name,
          energy: ctx.energy,
          total_money: ctx.total_money,
          meter_prev: ctx.meter_prev,
          meter_now: ctx.meter_now
        };
      });

      const summaryContext = {
        date: new Date().toISOString().slice(0, 10),
        items: formattedItems,
        total_energy: totalEnergy.toFixed(3),
        total_cost: totalMoney.toFixed(2),
        device_count: items.length,
        summary_today: {
          units: totalEnergy.toFixed(3),
          money: totalMoney.toFixed(2)
        }
      };

      console.log('📊 Summary context:', summaryContext);

      const blob = await requestRender(tplId, summaryContext);
      await downloadPDF(blob, `summary_${summaryContext.date}.html`);

      alert("✅ ดาวน์โหลดสรุปรายวันสำเร็จ (1 ไฟล์)");
    } catch (e) {
      console.error('❌ Summary error:', e);
      alert(`❌ ดาวน์โหลดไม่สำเร็จ: ${e.message}`);
    }
  };

  if (savedTpl && confirm(`ใช้เทมเพลตที่บันทึกไว้ (${savedTpl})?`)) {
    await doDownload(savedTpl);
  } else {
    openTemplateModal(doDownload, 'summary');
  }
}

// ⭐ 📚 รายงานรวมทั้งหมด - PDF ไฟล์เดียว (Summary + ทุกบิล)
async function downloadMergedReport() {
  const savedTpl = TEMPLATE_PREFS.merged || TEMPLATE_PREFS.single_device;

  if (!savedTpl && !DEFAULT_TEMPLATE) {
    alert("⚠️ กรุณาตั้งค่า Template ก่อน");
    return;
  }

  const doDownload = async (tplId) => {
    try {
      // โหลดข้อมูลทั้งหมด
      const res = await fetch("/api/billing/all_bills");
      const js = await res.json();
      const items = js.data || [];

      if (items.length === 0) {
        alert("⚠️ ไม่มีข้อมูลวันนี้");
        return;
      }

      alert(`📦 กำลังสร้างรายงานรวม ${items.length} รายการ...\nกรุณารอสักครู่`);

      // ส่งข้อมูลไปให้ Backend รวม PDF
      const mergeRes = await fetch("/api/report_template/billing_merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: new Date().toISOString().slice(0, 10),
          items: items,
          template_id: tplId,
          summary_template_id: TEMPLATE_PREFS.summary || tplId
        })
      });

      if (!mergeRes.ok) {
        throw new Error(`Server error: ${mergeRes.status}`);
      }

      const blob = await mergeRes.blob();
      await downloadPDF(blob, `billing_all_${new Date().toISOString().slice(0, 10)}.html`);

      alert(`✅ ดาวน์โหลดรายงานรวมสำเร็จ!\n- Summary + ${items.length} บิล\n- ไฟล์เดียว (PDF)`);
    } catch (e) {
      console.error('❌ Merged report error:', e);
      alert(`❌ ดาวน์โหลดไม่สำเร็จ: ${e.message}`);
    }
  };

  if (savedTpl && confirm(`ใช้เทมเพลตที่บันทึกไว้ (${savedTpl})?`)) {
    await doDownload(savedTpl);
  } else {
    openTemplateModal(doDownload, 'merged');
  }
}

// ===================== PRICE MANAGEMENT =====================
// ===================================
// ออกบิลราย Convertor (ตัวเดียว)
// ===================================
async function generateConvertorBill(convId) {
  try {
    const res = await fetch(`/api/billing/convertor_summary`);
    const js = await res.json();
    const data = js.data?.[convId];

    if (!data) {
      alert("❌ ไม่พบข้อมูลคอนเวอร์เตอร์นี้");
      return;
    }

    // 🔥 แปลงข้อมูลเป็น Context ที่ template ต้องการ
    const context = {
      convertor_id: convId,
      convertor_name: data.convertor_name || convId,
      date: new Date().toISOString().slice(0, 10),
      devices: data.devices || [],
      today_units: Number(data.today_units).toFixed(3),
      today_money: Number(data.today_money).toFixed(2),
      month_units: Number(data.month_units).toFixed(3),
      month_money: Number(data.month_money).toFixed(2)
    };

    const savedTpl = TEMPLATE_PREFS.convertor;

    if (savedTpl && confirm(`ใช้เทมเพลตที่บันทึกไว้ (${savedTpl}) ?`)) {
      const blob = await requestRender(savedTpl, context);
      await downloadPDF(blob, `convertor_${convId}.html`);
      return;
    }

    openTemplateModal(async (tplId) => {
      const blob = await requestRender(tplId, context);
      await downloadPDF(blob, `convertor_${convId}.html`);
    }, 'convertor');

  } catch (err) {
    console.error("❌ generateConvertorBill error:", err);
    alert("❌ ออกบิลไม่สำเร็จ");
  }
}
// ===================================
// ออกบิลราย Convertor (ทั้งหมด)
// ===================================
async function generateAllConvertorBills() {
  try {
    const res = await fetch(`/api/billing/convertor_summary`);
    const js = await res.json();
    const data = js.data || {};

    const keys = Object.keys(data);
    if (keys.length === 0) {
      alert("❌ ไม่มีข้อมูลคอนเวอร์เตอร์");
      return;
    }

    alert(`📦 กำลังสร้างบิลทั้งหมด ${keys.length} กลุ่ม...`);

    const savedTpl = TEMPLATE_PREFS.convertor;

    const doRender = async (tplId) => {
      let success = 0;

      for (const cid of keys) {
        const item = data[cid];
        const context = {
          convertor_id: cid,
          convertor_name: item.convertor_name || cid,
          date: new Date().toISOString().slice(0, 10),
          devices: item.devices || [],
          today_units: Number(item.today_units).toFixed(3),
          today_money: Number(item.today_money).toFixed(2),
          month_units: Number(item.month_units).toFixed(3),
          month_money: Number(item.month_money).toFixed(2)
        };

        try {
          const blob = await requestRender(tplId, context);
          await downloadPDF(blob, `convertor_${cid}.html`);
          success++;
        } catch (err) {
          console.error(`❌ Failed for ${cid}:`, err);
        }

        await new Promise(r => setTimeout(r, 300)); // ลดโหลดเซิร์ฟเวอร์
      }

      alert(`✅ สำเร็จ ${success}/${keys.length} ไฟล์`);
    };

    if (savedTpl && confirm(`ใช้เทมเพลตที่บันทึกไว้ (${savedTpl}) ?`)) {
      await doRender(savedTpl);
    } else {
      openTemplateModal(doRender, 'convertor');
    }

  } catch (err) {
    console.error("❌ generateAllConvertorBills error:", err);
    alert("❌ ออกบิลไม่สำเร็จ");
  }
}

async function loadPrice() {
  try {
    const res = await fetch("/api/billing/get_price");
    const js = await res.json();
    el("priceInput").value = js?.price_per_unit ?? js?.price ?? 0;
  } catch {
    el("priceInput").value = 0;
  }
}

async function savePrice() {
  const price = parseFloat(el("priceInput").value);
  if (isNaN(price)) {
    alert("กรุณาใส่ราคาให้ถูกต้อง");
    return;
  }

  try {
    const res = await fetch("/api/billing/set_price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price })
    });
    const js = await res.json();
    if (js.status === "success") {
      alert("✅ บันทึกราคาเรียบร้อย");
      loadSummary();
    }
  } catch {
    alert("❌ เซิร์ฟเวอร์ขัดข้อง");
  }
}

// ===================== DATA LOADING =====================
async function loadSummary() {
  try {
    const res = await fetch("/api/billing/summary");
    const js = await res.json();
    const d = js.data ?? js;

    el("sumTodayUnit").innerText = safeNum(d.today_units);
    el("sumTodayMoney").innerText = formatMoney(d.today_money);
    el("sumMonthUnit").innerText = safeNum(d.month_units);
    el("sumMonthMoney").innerText = formatMoney(d.month_money);
  } catch (err) {
    console.error('❌ Load summary error:', err);
  }
}

async function loadDevicesTable() {
  try {
    const res = await fetch("/api/billing/device_usage");
    const js = await res.json();
    const body = el("tbDevicesBody");
    const data = js.data || {};
    const keys = Object.keys(data);

    el("deviceCount").innerText = keys.length;

    if (keys.length === 0) {
      body.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:40px;">ไม่มีข้อมูล กำลังซิงก์...</td></tr>`;
      try {
        await fetch('/api/billing/sync', { method: 'POST' });
        await new Promise(r => setTimeout(r, 800));
        const r2 = await fetch('/api/billing/device_usage');
        const j2 = await r2.json();
        const d2 = j2.data || {};
        const k2 = Object.keys(d2);
        el("deviceCount").innerText = k2.length;
        if (k2.length === 0) {
          body.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:40px;">ไม่มีข้อมูล</td></tr>`;
          return;
        }
        body.innerHTML = k2.map(dev => {
          const d = d2[dev];
          return `
            <tr>
              <td><strong>${d.device_name || dev}</strong></td>
              <td class="font-mono">${safeNum(d.meter_now)}</td>
              <td class="font-mono text-primary">${safeNum(d.total_used_today)}</td>
              <td class="font-mono">${formatMoney(d.money_today)} ฿</td>
              <td class="text-muted">${d.last_update || '-'}</td>
              <td><button class="table-btn" onclick="generateBill('${dev}')">📄 ออกบิล</button></td>
            </tr>`;
        }).join('');
        const billRes = await fetch("/api/billing/all_bills");
        const billJs = await billRes.json();
        window.allDeviceBills = billJs.data || [];
        return;
      } catch (e) {
        console.error('sync error:', e);
      }
      return;
    }

    body.innerHTML = keys.map(dev => {
      const d = data[dev];
      return `
        <tr>
          <td><strong>${d.device_name || dev}</strong></td>
          <td class="font-mono">${safeNum(d.meter_now)}</td>
          <td class="font-mono text-primary">${safeNum(d.total_used_today)}</td>
          <td class="font-mono">${formatMoney(d.money_today)} ฿</td>
          <td class="text-muted">${d.last_update || '-'}</td>
          <td><button class="table-btn" onclick="generateBill('${dev}')">📄 ออกบิล</button></td>
        </tr>`;
    }).join('');

    // Store for merged report
    const billRes = await fetch("/api/billing/all_bills");
    const billJs = await billRes.json();
    window.allDeviceBills = billJs.data || [];
  } catch (err) {
    console.error('❌ Load devices error:', err);
  }
}

async function loadConvertorTable() {
  try {
    const res = await fetch("/api/billing/convertor_summary");
    const js = await res.json();
    const body = el("tbConvertorsBody");
    const data = js.data || {};
    const keys = Object.keys(data);

    el("convertorCount").innerText = keys.length;

    if (keys.length === 0) {
      body.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;padding:40px;">ไม่มีข้อมูล</td></tr>`;
      return;
    }

    body.innerHTML = keys.map(cid => {
      const val = data[cid];
      return `
        <tr>
          <td><strong>${cid}</strong></td>
          <td class="text-muted">${val.meters.length} เครื่อง</td>
          <td class="font-mono text-primary">${safeNum(val.today_units)}</td>
          <td class="font-mono">${formatMoney(val.today_money)} ฿</td>
          <td class="font-mono">${safeNum(val.month_units)}</td>
          <td class="font-mono">${formatMoney(val.month_money)} ฿</td>
          <td><button class="table-btn" onclick="generateConvertorBill('${cid}')">📄 ออกบิล</button></td>
        </tr>`;
    }).join('');
  } catch (err) {
    console.error('❌ Load convertor error:', err);
  }
}

async function loadTotalTable() {
  try {
    const res = await fetch("/api/billing/total_summary");
    const js = await res.json();
    const d = js.data || {};

    el("tbTotalBody").innerHTML = `
      <tr>
        <td><strong>🔹 รวมวันนี้</strong></td>
        <td class="font-mono text-primary">${safeNum(d.today_units)} kWh</td>
        <td class="font-mono">${formatMoney(d.today_money)} บาท</td>
      </tr>
      <tr>
        <td><strong>🔸 รวมเดือนนี้</strong></td>
        <td class="font-mono text-primary">${safeNum(d.month_units)} kWh</td>
        <td class="font-mono">${formatMoney(d.month_money)} บาท</td>
      </tr>`;
  } catch (err) {
    console.error('❌ Load total error:', err);
  }
}

// ===================== CHART =====================
let energyChart;

async function loadChart(range = 'day') {
  try {
    const endpoint = range === 'year' ? 'yearly' : range === 'month' ? 'monthly' : 'daily';
    const res = await fetch(`/api/billing/chart/${endpoint}`);
    const js = await res.json();
    const rows = js.data || [];

    const labels = rows.map(v => v.day ?? v.month ?? v.year ?? '-');
    const values = rows.map(v => v.value ?? 0);

    const ctx = el("energyChart").getContext("2d");
    if (energyChart) energyChart.destroy();

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(229, 9, 20, 0.8)');
    gradient.addColorStop(1, 'rgba(229, 9, 20, 0.1)');

    energyChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: values,
          label: 'พลังงาน (kWh)',
          backgroundColor: gradient,
          borderColor: '#E50914',
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#6B6B70' }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#6B6B70' }
          }
        }
      }
    });
  } catch (err) {
    console.error('❌ Load chart error:', err);
  }
}

// ===================== TAB SWITCHING =====================
function initTabs() {
  // Main tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tabContent').forEach(tc => tc.classList.add('hidden'));

      btn.classList.add('active');
      const tab = btn.dataset.tab;
      el(tab)?.classList.remove('hidden');

      if (tab === 'tabDevices') loadDevicesTable();
      if (tab === 'tabConvertors') loadConvertorTable();
      if (tab === 'tabTotal') loadTotalTable();
    });
  });

  // Chart tabs
  document.querySelectorAll('.chart-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadChart(btn.dataset.range);
    });
  });
}
// 📚 MERGED EXPORT (รวมทุกบิล + Summary)
async function exportMerged(type) {
  let query = "";
  let filename = "";

  if (type === "day") {
    query = "/api/billing/all_bills";
    filename = "merged_day";
  }
  else if (type === "month") {
    const month = prompt("กรุณาใส่เดือน เช่น 2025-11");
    if (!month) return;
    query = `/api/billing/history?month=${month}`;
    filename = `merged_month_${month}`;
  }
  else if (type === "year") {
    const year = prompt("กรุณาใส่ปี เช่น 2025");
    if (!year) return;
    query = `/api/billing/history?year=${year}`;
    filename = `merged_year_${year}`;
  }

  const res = await fetch(query);
  const js = await res.json();
  const items = js.data || [];

  if (items.length === 0) {
    alert("ไม่มีข้อมูลในช่วงเวลานี้");
    return;
  }

  const mergeRes = await fetch("/api/report_template/billing_merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      items: items,
      template_id: TEMPLATE_PREFS.merged || TEMPLATE_PREFS.single_device || DEFAULT_TEMPLATE
    })
  });

  const blob = await mergeRes.blob();
  await downloadPDF(blob, `${filename}.html`);
}

// 📊 SUMMARY EXPORT (รายวัน/เดือน/ปี)
async function exportSummary(type) {
  let query = "";
  let filename = "";

  if (type === "day") {
    query = "/api/billing/all_bills";
    filename = "summary_day";
  }
  else if (type === "month") {
    const month = prompt("กรุณาใส่เดือน (รูปแบบ: 2025-11)");
    if (!month) return;
    query = `/api/billing/history?month=${month}`;
    filename = `summary_month_${month}`;
  }
  else if (type === "year") {
    const year = prompt("กรุณาใส่ปี เช่น 2025");
    if (!year) return;
    query = `/api/billing/history?year=${year}`;
    filename = `summary_year_${year}`;
  }

  const res = await fetch(query);
  const js = await res.json();
  const rows = js.data || [];

  if (rows.length === 0) {
    alert("ไม่มีข้อมูลในช่วงเวลานี้");
    return;
  }

  const totalEnergy = rows.reduce((s, r) => s + Number(r.energy_used || r.energy || 0), 0);
  const totalCost = rows.reduce((s, r) => s + Number(r.total_cost || r.money || 0), 0);

  const context = {
    date: new Date().toISOString().slice(0, 10),
    total_energy: totalEnergy.toFixed(3),
    total_cost: totalCost.toFixed(2),
    items: rows
  };

  const tpl = TEMPLATE_PREFS.summary || DEFAULT_TEMPLATE;
  const blob = await requestRender(tpl, context);
  await downloadPDF(blob, `${filename}.html`);
}

// ===================== GLOBAL BINDINGS =====================
window.previewTemplate = previewTemplate;
window.deleteTemplate = deleteTemplate;
window.setDefaultTemplate = setDefaultTemplate;
window.editTemplate = editTemplate;
window.openTemplateManager = openTemplateManager;
window.closeTemplateManager = closeTemplateManager;
window.openTemplateModal = openTemplateModal;
window.closeTemplateModal = closeTemplateModal;
window.chooseTemplate = chooseTemplate;
window.createNewTemplate = createNewTemplate;
window.generateBill = generateBill;
window.generateAllBills = generateAllBills;
window.generateConvertorBill = generateConvertorBill;
window.generateAllConvertorBills = generateAllConvertorBills;
window.downloadSummary = downloadSummary;
window.downloadMergedReport = downloadMergedReport;
window.savePrice = savePrice;

// ===================== INITIALIZATION =====================
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadTemplatePrefs(); // ⭐ โหลดค่า template ที่บันทึกไว้
  loadTemplates();
  loadPrice();
  loadSummary();
  loadDevicesTable();
  loadChart('day');

  // Auto refresh
  setInterval(() => {
    loadSummary();
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab === 'tabDevices') loadDevicesTable();
    if (activeTab === 'tabConvertors') loadConvertorTable();
    if (activeTab === 'tabTotal') loadTotalTable();
  }, 5000);
});
