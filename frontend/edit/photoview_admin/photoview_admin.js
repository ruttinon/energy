// photoview_admin.js — SPA INTEGRATED VERSION
// =======================================================

"use strict";
(function () {
    console.log("📌 Photoview Admin JS Loaded — SPA Version");

    // =======================================================
    // GLOBALS
    // =======================================================
    const API_BASE = "/api/photoview";
    let PROJECT_ID = null;

    function getApi() {
        return `${API_BASE}/${PROJECT_ID}`;
    }
    let PREVIEW, LAYER, TABS, TABLE;
    let currentFloor = null;
    let currentMarkers = []; // 🔥 NEW: Store markers for global drag handler

    let pendingCoords = null;
    let editIndex = null;
    let editMode = false;
    let draggingState = { active: false, markerEl: null, index: null };

    // =======================================================
    // UTILS
    // =======================================================
    function q(id) { try { return document.getElementById(id); } catch (e) { return null; } }

    function escapeHtml(str) {
        if (str === undefined || str === null) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    async function safeJson(res) {
        try { return await res.json(); }
        catch { return null; }
    }
    async function apiGet(p) { try { return safeJson(await fetch(getApi() + p, { cache: "no-store" })); } catch { return null; } }
    async function apiPost(p, b) {
        try {
            const isForm = b instanceof FormData;
            return safeJson(await fetch(getApi() + p, {
                method: "POST",
                headers: isForm ? undefined : { "Content-Type": "application/json" },
                body: isForm ? b : JSON.stringify(b)
            }));
        } catch { return null; }
    }
    async function apiDelete(p) {
        try { return safeJson(await fetch(getApi() + p, { method: "DELETE" })); }
        catch { return null; }
    }

    // =======================================================
    // RENDER UI (SPA)
    // =======================================================
    function injectStyles() {
        if (document.getElementById("photoview-styles")) return;
        const s = document.createElement("style");
        s.id = "photoview-styles";
        s.textContent = `
      .pv-layout { display: flex; gap: 20px; height: calc(100vh - 140px); overflow: hidden; }
      .pv-main { flex: 1; display: flex; flex-direction: column; background: #0f2232; border: 1px solid #274b61; border-radius: 12px; position: relative; overflow: hidden; }
      .pv-sidebar { width: 300px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
      .pv-panel { background: #0d1f2f; border: 1px solid #29465c; border-radius: 12px; padding: 12px; }
      .pv-tabs { display: flex; gap: 8px; padding: 8px; border-bottom: 1px solid #274b61; background: #0b1821; overflow-x: auto; }
      .pv-tab-btn { background: #113246; border: 1px solid #2c6b8a; color: #9bd0e8; padding: 6px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
      .pv-tab-btn.active { background: #007bff; color: white; border-color: #0056b3; }
      .pv-view-container { flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; }
      .pv-wrapper { position: relative; display: inline-block; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
      .pv-preview { max-width: 100%; max-height: 100%; display: block; user-select: none; }
      .pv-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
      .marker { pointer-events: auto; cursor: grab; position: absolute; transform: translate(-50%, -50%); transition: transform 0.1s; user-select: none; font-weight: bold; background: white; color: black; padding: 4px 8px; border-radius: 4px; font-size: 14px; white-space: nowrap; }
      .marker:active { cursor: grabbing; transform: translate(-50%, -50%) scale(1.1); z-index: 1000; }
      
      .pv-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
      .pv-table th, .pv-table td { border-bottom: 1px solid #274b61; padding: 4px; color: #cce8ff; text-align: left; }
      .pv-table th { color: #9bd0e8; }
      
      .pv-controls { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .pv-input { background: #0f2232; border: 1px solid #355e75; color: white; padding: 6px; border-radius: 6px; width: 100%; box-sizing: border-box; }
      .pv-btn { background: #2c6b8a; border: none; color: white; padding: 8px; border-radius: 6px; cursor: pointer; margin-top: 4px; width: 100%; }
      .pv-btn:hover { background: #3da9d4; }
      .pv-btn.danger { background: #a33; }

      /* Modal */
      .pv-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999; justify-content: center; align-items: center; }
      .pv-modal-content { background: #0d1f2f; border: 1px solid #63d1ff; padding: 20px; border-radius: 12px; width: 320px; max-width: 90%; }
      .pv-modal h3 { color: #63d1ff; margin-top: 0; }
    `;
        document.head.appendChild(s);
    }

    async function renderPhotoviewPage() {
        injectStyles();
        const area = document.getElementById("content-area");
        if (!area) return;

        area.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h2 style="margin:0; color:#63d1ff;">📸 Photoview Admin</h2>
        <div>
           <span id="pvCurrentPage" style="color:#9bd0e8; font-weight:bold; margin-right:15px;">-</span>
           <button class="pv-btn" style="width:auto; display:inline-block;" id="styleEditorBtn">🎨 Style Editor</button>
        </div>
      </div>

      <div class="pv-layout">
        <div class="pv-main">
           <div id="tabs" class="pv-tabs"></div>
           <div class="pv-view-container">
             <div class="pv-wrapper">
               <img id="preview" class="pv-preview" />
               <div id="markerLayer" class="pv-layer"></div>
             </div>
           </div>
        </div>

        <div class="pv-sidebar">
           <!-- ADD PAGE -->
           <div class="pv-panel">
             <h4 style="margin:0 0 8px 0; color:#9bd0e8;">Manage Pages</h4>
             <input id="newPageName" class="pv-input" placeholder="Page Name" style="margin-bottom:4px">
             <input type="file" id="newPageImage" class="pv-input" accept="image/*" style="margin-bottom:4px">
             <button id="createPageBtn" class="pv-btn">➕ New Page</button>
             <button id="renamePageBtn" class="pv-btn" style="background:#555; margin-top:4px;">✏️ Rename Current</button>
             <button id="updateImgBtn" class="pv-btn" style="background:#555; margin-top:4px;">🖼️ Update Image</button>
             <input type="file" id="pageImageInput" style="display:none" accept="image/*">
             <button id="deletePageBtn" class="pv-btn danger" style="margin-top:4px;">🗑️ Delete Page</button>
           </div>

           <!-- INFO -->
           <div class="pv-panel">
             <h4 style="margin:0 0 8px 0; color:#9bd0e8;">Details</h4>
             <table class="pv-table">
               <tbody id="dataTable"><tr><td colspan="2" style="text-align:center; color:#777;">Select a marker</td></tr></tbody>
             </table>
           </div>
        </div>
      </div>

       <!-- MARKER EDITOR MODAL -->
       <div id="markerModal" class="pv-modal">
         <div class="pv-modal-content" style="width: 400px;">
            <h3 id="markerModalTitle">Edit Marker</h3>
            
            <div style="display:flex; gap:10px;">
                <div style="flex:1">
                    <label style="display:block; color:#ccc; font-size:12px">Type</label>
                    <select id="markerType" class="pv-input">
                      <option value="device">Device Parameter</option>
                      <option value="link">Link to Page</option>
                      <option value="converter">Converter Status</option>
                      <option value="label">Static Label</option>
                    </select>

                    <div style="margin-top:8px">
                      <label style="display:block; color:#ccc; font-size:12px">Reference</label>
                      <select id="markerRef" class="pv-input"></select>
                    </div>

                    <div style="margin-top:8px">
                     <label style="display:block; color:#ccc; font-size:12px">Parameter Search</label>
                     <input id="paramSearch" class="pv-input" placeholder="Filter parameters...">
                      <select id="markerParam" class="pv-input" style="margin-top:4px"></select>
                    </div>
                </div>
                
                <!-- CUSTOM STYLE SECTION -->
                <div style="flex:1; border-left:1px solid #334; padding-left:10px;">
                    <h4 style="margin:0 0 8px 0; color:#9bd0e8; font-size:12px;">Custom Style</h4>
                    
                    <div style="margin-bottom:4px"><small>Bg Color</small> <input type="color" id="mksBg" value="#ffffff" style="width:100%; height:24px;"></div>
                    <div style="margin-bottom:4px"><small>Text Color</small> <input type="color" id="mksColor" value="#000000" style="width:100%; height:24px;"></div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <div><small>Font Size</small><input type="number" id="mksFont" class="pv-input" value="14"></div>
                        <div><small>Radius</small><input type="number" id="mksRadius" class="pv-input" value="4"></div>
                        <div><small>Padding</small><input type="number" id="mksPadding" class="pv-input" value="4"></div>
                        <div><small>Opacity</small><input type="number" id="mksOpacity" class="pv-input" value="100"></div>
                    </div>

                    <div style="margin-top:8px">
                        <input type="checkbox" id="mksTransparent"> <label for="mksTransparent" style="color:#ccc; font-size:12px">No Background</label>
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid #334; padding-top:10px;">
              <button id="markerSaveBtn" class="pv-btn">Save</button>
              <button id="markerCancelBtn" class="pv-btn danger">Cancel</button>
            </div>
         </div>
       </div>

      <!-- STYLE EDITOR PANEL (Absolute) -->
      <div id="styleEditorPanel" style="display:none; position:fixed; top:80px; right:320px; width:260px; background:#1a2b3c; border:1px solid #63d1ff; padding:15px; border-radius:12px; z-index:2000; box-shadow:0 10px 40px rgba(0,0,0,0.5);">
         <h4 style="margin:0 0 10px 0; color:#fff; border-bottom:1px solid #444; padding-bottom:5px;">Marker Style</h4>
         
         <div class="pv-controls">
           <div><small>Bg Color</small><input type="color" id="mkBg" style="width:100%"></div>
           <div><small>Text Color</small><input type="color" id="mkColor" style="width:100%"></div>
         </div>
         <div style="margin-top:5px"><small>Font Size</small><input type="range" id="mkFont" min="10" max="32" class="pv-input"></div>
         <div style="margin-top:5px"><small>Radius</small><input type="range" id="mkRadius" min="0" max="20" class="pv-input"></div>
         <div style="margin-top:5px"><small>Padding</small><input type="range" id="mkPadding" min="0" max="20" class="pv-input"></div>
         <div style="margin-top:5px"><small>Opacity</small><input type="range" id="mkOpacity" min="20" max="100" class="pv-input"></div>
         <div style="margin-top:5px"><small>Icon Size</small><input type="number" id="mkIconSize" class="pv-input"></div>
         
         <div style="margin-top:10px; display:flex; align-items:center; gap:8px;">
           <input type="checkbox" id="mkShadow"> <label for="mkShadow" style="color:#ccc; font-size:12px">Shadow</label>
           <input type="checkbox" id="mkTransparent"> <label for="mkTransparent" style="color:#ccc; font-size:12px">No Bg</label>
         </div>

         <div style="margin-top:15px; text-align:right;">
            <button id="clearBgBtn" class="pv-btn" style="width:auto; font-size:11px">Toggle Transparent</button>
            <button id="closeStylePanel" class="pv-btn danger" style="width:auto; font-size:11px">Close</button>
         </div>
      </div>
    `;

        // INIT LOGIC
        try {
            const res = await fetch("/api/active");
            const j = await res.json();
            if (!j.active) {
                area.innerHTML = "<h3>No Active Project</h3>";
                return;
            }
            PROJECT_ID = j.active;
            console.log("Project ID:", PROJECT_ID);

            bindUI();
            await loadPages();
            console.log("🔥 Photoview Ready — SPA Mode");

            if (typeof window.highlightNav === 'function') window.highlightNav('add_screen');

        } catch (e) {
            console.error("Init failed", e);
            area.innerHTML = `<h3>Error loading project: ${e.message}</h3>`;
        }
    }

    // =======================================================
    // PREVIEW
    // =======================================================
    function setPreviewSrc(src) {
        if (!PREVIEW) return;
        PREVIEW.src = src || "";
        // Don't sync size instantly, wait for load
        PREVIEW.onload = () => syncMarkerLayerSize();
        // Also try syncing after a delay in case it's cached
        setTimeout(syncMarkerLayerSize, 100);
    }
    function syncMarkerLayerSize() {
        if (!PREVIEW || !LAYER) return;
        if (PREVIEW.offsetWidth === 0) return; // Not visible yet
        LAYER.style.width = PREVIEW.offsetWidth + "px";
        LAYER.style.height = PREVIEW.offsetHeight + "px";
    }

    // =======================================================
    // PARAM / REF DROPDOWNS
    // =======================================================
    async function refreshParamDropdown(deviceId, preset = "") {
        const sel = q("markerParam");
        const search = q("paramSearch");
        if (!sel) return;

        sel.innerHTML = `<option value="">(กำลังโหลด...)</option>`;
        if (!deviceId) {
            sel.innerHTML = `<option value="">(เลือก Device ก่อน)</option>`;
            return;
        }

        const js = await apiGet(`/device_params/${encodeURIComponent(deviceId)}?t=${Date.now()}`) || {};
        if (js.status !== "ok" || !Array.isArray(js.params)) {
            sel.innerHTML = `<option value="">(ไม่มี parameter)</option>`;
            return;
        }

        sel.innerHTML = `<option value="">(ยังไม่ได้เลือก)</option>`;
        js.params.forEach(p => {
            const o = document.createElement("option");
            o.value = p.key;
            o.textContent = p.key + (p.unit ? ` (${p.unit})` : "");
            o.dataset.meta = JSON.stringify(p);
            sel.appendChild(o);
        });

        if (preset) sel.value = preset;

        if (search) {
            search.value = "";
            search.oninput = () => {
                const qv = search.value.toLowerCase();
                for (const opt of sel.options) {
                    if (!opt.value) continue;
                    opt.hidden = !opt.textContent.toLowerCase().includes(qv);
                }
            };
        }
    }

    async function refreshMarkerRefDropdown(type, preset = "") {
        const sel = q("markerRef");
        if (!sel) return;
        sel.innerHTML = "";

        if (type === "device") {
            const list = await apiGet(`/device_list?t=${Date.now()}`) || [];
            if (!list.length) sel.innerHTML = `<option value="">(ไม่มี Device)</option>`;
            else list.forEach(d => { // d is {id, name}
                const o = document.createElement("option");
                o.value = d.id;
                o.textContent = d.name; // Display Name
                sel.appendChild(o);
            });
        }
        else if (type === "converter") {
            const list = await apiGet(`/converter_list?t=${Date.now()}`) || [];
            if (!list.length) sel.innerHTML = `<option value="">(ไม่มี Converter)</option>`;
            else list.forEach(id => {
                const o = document.createElement("option"); o.value = id; o.textContent = id; sel.appendChild(o);
            });
        }
        else if (type === "link") {
            const pages = await apiGet(`/pages?t=${Date.now()}`) || [];
            if (!pages.length) sel.innerHTML = `<option value="">(ไม่มีหน้า)</option>`;
            else pages.forEach(p => {
                const o = document.createElement("option"); o.value = p.id; o.textContent = p.name; sel.appendChild(o);
            });
        }
        else {
            sel.innerHTML = `<option value="">(ไม่ต้องอ้างอิง)</option>`;
        }

        if (preset) sel.value = preset;

        if (type === "device") {
            sel.onchange = () => refreshParamDropdown(sel.value);
            if (preset) refreshParamDropdown(preset);
        } else {
            q("markerParam").innerHTML = `<option value="">(ไม่ต้องเลือก parameter)</option>`;
        }
    }

    // =======================================================
    // PAGE LOAD / SWITCH
    // =======================================================
    async function loadPages() {
        const res = await apiGet(`/pages?t=${Date.now()}`);
        // Robust handling for both object wrapper and direct array
        let pages = [];
        if (res && Array.isArray(res.pages)) pages = res.pages;
        else if (Array.isArray(res)) pages = res;
        if (!TABS) return;

        TABS.innerHTML = "";

        if (!pages.length) {
            TABS.innerHTML = `<p style="padding:8px;color:#999;">ยังไม่มีหน้า Photoview</p>`;
            return;
        }

        pages.forEach((p, i) => {
            const b = document.createElement("button");
            b.className = "pv-tab-btn" + (i === 0 ? " active" : "");
            b.textContent = p.name;
            b.onclick = () => switchFloor(p, b);
            TABS.appendChild(b);
        });

        // Switch to the first page if it exists
        if (pages.length > 0) {
            await switchFloor(pages[0], TABS.querySelector(".pv-tab-btn"));
        } else {
            currentFloor = null;
            setPreviewSrc("");
            LAYER.innerHTML = "";
        }
    }

    async function switchFloor(page, btn) {
        currentFloor = page.id;

        document.querySelectorAll(".pv-tab-btn").forEach(b => b.classList.remove("active"));
        btn?.classList.add("active");

        if (q("pvCurrentPage")) q("pvCurrentPage").textContent = page.name;

        let img = page.image ? `${getApi()}/images/${page.image}?t=${Date.now()}` : "";
        setPreviewSrc(img);

        await loadMarkers(page.id);
        loadSavedStyle();  // โหลดสไตล์ที่บันทึกไว้สำหรับหน้านั้น ๆ
        setTimeout(applyMarkerStyle, 150); // ย้ำการ Apply สไตล์
    }

    // =======================================================
    // LOAD MARKERS
    // =======================================================
    async function loadMarkers(pageId) {
        if (!LAYER) return;
        LAYER.innerHTML = "";

        const markers = await apiGet(`/markers/${pageId}?t=${Date.now()}`) || [];
        currentMarkers = markers;
        syncMarkerLayerSize();

        // 1. Identify all device markers and prepare promises for data fetching
        const deviceMarkers = markers.filter(m => m.type === "device" && m.device_id && m.param?.key);
        const dataPromises = deviceMarkers.map(m => {
            // Execute API call concurrently for each device
            return apiGet(`/device_data/${encodeURIComponent(m.device_id)}?t=${Date.now()}`)
                .catch(() => ({ status: "error" }));
        });

        // 2. Wait for all data to be fetched
        const deviceDataResults = await Promise.all(dataPromises);
        const deviceDataMap = {};

        // 3. Create a map for quick lookup: device_id -> data
        deviceMarkers.forEach((m, index) => {
            const result = deviceDataResults[index];
            if (result?.status === "ok" && result.data) {
                deviceDataMap[m.device_id] = result.data;
            }
        });

        // 4. Render all markers
        for (const [idx, m] of markers.entries()) {
            const mk = document.createElement("div");
            mk.className = "marker";
            mk.style.position = "absolute";
            mk.style.transform = "translate(-50%,-50%)";
            mk.style.left = (Number(m.x) || 0) + "%";
            mk.style.top = (Number(m.y) || 0) + "%";
            mk.dataset.index = idx;

            // Content determination (Uses pre-fetched data)
            if (m.type === "device" && m.param?.key) {
                const data = deviceDataMap[m.device_id];
                const key = m.param.key;
                let textContent = "—"; // Default value

                if (data) {
                    const raw = data[key];
                    const val = raw == null ? "—" : raw;
                    const unit = m.param.unit ? ` ${m.param.unit}` : "";
                    textContent = val + unit;
                }

                mk.textContent = textContent;
            }
            else if (m.icon) {
                const img = document.createElement("img");
                img.src = `${getApi()}/images/${m.icon}`;
                img.style.pointerEvents = "none";
                mk.appendChild(img);
            }
            else mk.textContent = "•";

            // Event listeners
            mk.onclick = () => { m.type === "device" ? showDeviceInfo(m) : showMarkerInfo(m); };
            mk.ondblclick = () => openEditMarkerModal(m, idx);

            // Dragging Setup: Only register pointerdown/up on the element
            mk.onpointerdown = e => {
                draggingState = { active: true, markerEl: mk, index: idx };
                try { mk.setPointerCapture(e.pointerId); } catch { }
            };
            mk.onpointerup = () => draggingState = { active: false, markerEl: null, index: null };

            mk.oncontextmenu = async (e) => {
                e.preventDefault();
                if (!confirm("ลบ Marker นี้?")) return;
                await apiDelete(`/delete_marker/${encodeURIComponent(currentFloor)}/${idx}`);
                loadMarkers(currentFloor);
            };

            LAYER.appendChild(mk);
        }
        applyMarkerStyle();
    }

    // =======================================================
    // ADD / EDIT MARKERS
    // =======================================================
    function openAddMarkerModal(coords) {
        editMode = false;
        editIndex = null;
        pendingCoords = coords;

        q("markerModalTitle").textContent = "เพิ่ม Marker ใหม่";
        q("markerType").value = "device";
        q("paramSearch").value = "";
        q("markerParam").innerHTML = `<option value="">(ยังไม่ได้เลือก)</option>`;

        refreshMarkerRefDropdown("device");
        q("markerModal").style.display = "flex";
    }

    function openEditMarkerModal(m, idx) {
        editMode = true;
        editIndex = idx;
        pendingCoords = { x: m.x, y: m.y };

        q("markerModalTitle").textContent = `แก้ไข Marker #${idx + 1}`;
        q("markerType").value = m.type || "device";

        const preset = (m.type === "device") ? m.device_id : (m.type === "converter") ? m.converter_id : (m.type === "link") ? m.target : "";
        refreshMarkerRefDropdown(m.type, preset);

        if (m.type === "device" && m.param) {
            setTimeout(() => {
                refreshParamDropdown(m.device_id, m.param.key);
                q("paramSearch").value = m.param.key;
            }, 300);
        } else {
            q("markerParam").innerHTML = `<option value="">(ไม่ต้องเลือก parameter)</option>`;
            q("paramSearch").value = "";
        }

        // Load custom style or default
        const s = m.style || { bg: "#ffffff", color: "#000000", font: 14, radius: 4, padding: 4, opacity: 100, transparent: false };
        if (q("mksBg")) q("mksBg").value = s.bg;
        if (q("mksColor")) q("mksColor").value = s.color;
        if (q("mksFont")) q("mksFont").value = s.font;
        if (q("mksRadius")) q("mksRadius").value = s.radius;
        if (q("mksPadding")) q("mksPadding").value = s.padding;
        if (q("mksOpacity")) q("mksOpacity").value = s.opacity;
        if (q("mksTransparent")) q("mksTransparent").checked = s.transparent;

        q("markerModal").style.display = "flex";
    }

    // =======================================================
    // SAVE MARKER
    // =======================================================
    async function saveMarkerHandler() {
        const type = q("markerType").value;
        const ref = q("markerRef").value;

        // Collect Custom Style
        const style = {
            bg: q("mksBg")?.value || "#ffffff",
            color: q("mksColor")?.value || "#000000",
            font: Number(q("mksFont")?.value || 14),
            radius: Number(q("mksRadius")?.value || 4),
            padding: Number(q("mksPadding")?.value || 4),
            opacity: Number(q("mksOpacity")?.value || 100),
            transparent: q("mksTransparent")?.checked || false
        };

        const payload = {
            x: pendingCoords.x,
            y: pendingCoords.y,
            type,
            style // Attach style
        };

        if (type === "device") {
            payload.device_id = ref || null;
            const sel = q("markerParam");
            if (sel.value) {
                try {
                    payload.param = JSON.parse(sel.selectedOptions[0].dataset.meta);
                } catch {
                    console.error("Could not parse parameter metadata.");
                    alert("Error: Could not save parameter data.");
                    return;
                }
            } else {
                payload.param = null;
            }
        }
        if (type === "converter") payload.converter_id = ref;
        if (type === "link") payload.target = ref;

        if (editMode)
            await apiPost(`/update_marker/${encodeURIComponent(currentFloor)}/${editIndex}`, payload);
        else
            await apiPost(`/add_marker/${encodeURIComponent(currentFloor)}`, payload);

        q("markerModal").style.display = "none";
        await loadMarkers(currentFloor);
        // No need to apply global style here as we use individual styles
        setTimeout(applyMarkerStyle, 150);
    }

    // =======================================================
    // DEVICE INFO
    // =======================================================
    function showMarkerInfo(m) {
        TABLE.innerHTML = `<tr><td colspan="4">Marker (type: ${escapeHtml(m.type || "")})</td></tr>`;
    }

    async function showDeviceInfo(m) {
        TABLE.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;
        const js = await apiGet(`/device_data/${encodeURIComponent(m.device_id)}?t=${Date.now()}`);

        if (!js?.data) {
            TABLE.innerHTML = `<tr><td colspan="4">ไม่พบข้อมูลอุปกรณ์</td></tr>`;
            return;
        }

        if (!m.param) {
            TABLE.innerHTML = `<tr><td colspan="4">ยังไม่ได้เลือก parameter</td></tr>`;
            return;
        }

        const key = m.param.key;
        const val = js.data[key] ?? "—";
        const unit = m.param.unit || "";

        TABLE.innerHTML = `
    <tr><th colspan="4">Device: ${escapeHtml(m.device_id)}</th></tr>
    <tr>
      <td>Parameter</td><td>${escapeHtml(key)}</td>
      <td>Value</td><td>${escapeHtml(String(val))} ${escapeHtml(unit)}</td>
    </tr>
  `;
    }

    // =======================================================
    // PAGE OPS
    // =======================================================
    async function renamePage() {
        if (!currentFloor) return alert("Select a page first");
        const newName = prompt("ตั้งชื่อหน้าใหม่:", currentFloor);
        if (!newName) return;

        const res = await apiPost("/rename_page", { page_id: currentFloor, new_name: newName });
        if (res?.status === "ok") { alert("เปลี่ยนชื่อเรียบร้อย"); loadPages(); }
        else alert("เปลี่ยนชื่อไม่สำเร็จ");
    }

    function triggerImageUpload() { q("pageImageInput").click(); }

    async function deletePage() {
        if (!currentFloor) return alert("Select a page first");
        if (!confirm("ต้องการลบหน้านี้จริงหรือไม่?")) return;
        const res = await apiDelete(`/delete_page/${encodeURIComponent(currentFloor)}`);
        if (res?.status === "ok") { alert("ลบหน้าเรียบร้อย"); loadPages(); }
        else alert("ลบหน้าไม่สำเร็จ");
    }

    // =======================================================
    // STYLE SYSTEM
    // =======================================================
    function defaultStyle() {
        return {
            bg: "#ffffff",
            color: "#000000",
            font: 14,
            radius: 8,
            padding: 6,
            opacity: 100,
            shadow: false,
            iconSize: 28,
            transparentBg: false
        };
    }

    function saveStyleSettings() {
        if (!currentFloor) return;

        const key = "markerStyle_" + currentFloor;

        const s = {
            bg: q("mkBg")?.value ?? "#ffffff",
            color: q("mkColor")?.value ?? "#000000",
            font: Number(q("mkFont")?.value ?? 14),
            radius: Number(q("mkRadius")?.value ?? 8),
            padding: Number(q("mkPadding")?.value ?? 6),
            opacity: Number(q("mkOpacity")?.value ?? 100),
            shadow: q("mkShadow")?.checked ?? false,
            iconSize: Number(q("mkIconSize")?.value ?? 28),
            transparentBg: q("mkTransparent")?.checked ?? false
        };

        // Save LocalStorage
        localStorage.setItem(key, JSON.stringify(s));

        // Sync Backend
        fetch(getApi() + `/save_style/${currentFloor}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                marker_bg: s.bg,
                marker_color: s.color,
                font_size: s.font,
                border_radius: s.radius,
                padding_x: s.padding,
                padding_y: s.padding,
                opacity: s.opacity,
                shadow: s.shadow,
                icon_size: s.iconSize,
                transparent: s.transparentBg
            })
        }).then(() => {
            console.log("📡 Style updated");
        });

        applyMarkerStyle();
    }
    function loadSavedStyle() {
        if (!currentFloor) return;

        const key = "markerStyle_" + currentFloor;
        const raw = localStorage.getItem(key);

        let s = defaultStyle();
        if (raw) {
            try { s = { ...s, ...JSON.parse(raw) }; } catch { }
        }

        // ใส่ค่าเข้า UI panel
        if (q("mkBg")) q("mkBg").value = s.bg;
        if (q("mkColor")) q("mkColor").value = s.color;
        if (q("mkFont")) q("mkFont").value = s.font;
        if (q("mkRadius")) q("mkRadius").value = s.radius;
        if (q("mkPadding")) q("mkPadding").value = s.padding;
        if (q("mkOpacity")) q("mkOpacity").value = s.opacity;
        if (q("mkShadow")) q("mkShadow").checked = s.shadow;
        if (q("mkIconSize")) q("mkIconSize").value = s.iconSize;
        if (q("mkTransparent")) q("mkTransparent").checked = s.transparentBg;

        applyMarkerStyle();
    }

    function applyMarkerStyle() {
        if (!currentFloor) return;

        const key = "markerStyle_" + currentFloor;
        const raw = localStorage.getItem(key);

        let globalS = defaultStyle();
        if (raw) { try { globalS = { ...globalS, ...JSON.parse(raw) } } catch { } }

        document.querySelectorAll(".marker").forEach(m => {
            const idx = m.dataset.index;
            const markerData = currentMarkers[idx];

            // Prefer individual style, fallback to global
            const s = markerData.style ? {
                bg: markerData.style.bg,
                color: markerData.style.color,
                font: markerData.style.font,
                radius: markerData.style.radius,
                padding: markerData.style.padding,
                opacity: markerData.style.opacity,
                transparentBg: markerData.style.transparent,
                // These might not be in individual style yet, fallback safely
                shadow: globalS.shadow,
                iconSize: globalS.iconSize
            } : globalS;

            const img = m.querySelector("img");

            if (s.transparentBg) {
                m.style.background = "transparent";
                m.style.border = "1px dashed rgba(255,255,255,0.2)"; // SLight border for visibility in edit mode
                m.style.boxShadow = "none";
                m.style.lineHeight = "1.2";
            } else {
                m.style.background = s.bg;
                m.style.border = "none";
                m.style.boxShadow = s.shadow ? "0 4px 12px rgba(0,0,0,0.3)" : "none";
                m.style.lineHeight = "1.2";
            }

            m.style.color = s.color;
            m.style.fontSize = s.font + "px";
            m.style.borderRadius = s.radius + "px";
            m.style.padding = s.padding + "px";
            m.style.opacity = s.opacity / 100;

            if (img) {
                m.style.width = s.iconSize + "px";
                m.style.height = s.iconSize + "px";
            }
        });
    }

    // =======================================================
    // CREATE NEW PAGE
    // =======================================================
    async function createPage() {
        const name = q("newPageName")?.value?.trim();
        const file = q("newPageImage")?.files?.[0];

        if (!name) { alert("กรุณาตั้งชื่อหน้า"); return; }
        if (!file) { alert("กรุณาเลือกรูปหน้าพร้อมอัปโหลด"); return; }

        const fd = new FormData();
        fd.append("page_name", name);
        fd.append("file", file);

        const res = await apiPost("/add_page", fd);

        if (res?.status === "ok") {
            alert("เพิ่มหน้าสำเร็จ");
            q("newPageName").value = "";
            q("newPageImage").value = "";
            loadPages();
        } else {
            alert("เพิ่มหน้าไม่สำเร็จ");
        }
    }

    // =======================================================
    // BIND UI
    // =======================================================
    function bindUI() {
        PREVIEW = q("preview");
        LAYER = q("markerLayer");
        TABS = q("tabs");
        TABLE = q("dataTable");

        // Add Marker on Click
        PREVIEW?.addEventListener("click", ev => {
            if (draggingState.active) return;
            const r = PREVIEW.getBoundingClientRect();
            const x = ((ev.clientX - r.left) / r.width) * 100;
            const y = ((ev.clientY - r.top) / r.height) * 100;
            openAddMarkerModal({ x: x.toFixed(2), y: y.toFixed(2) });
        });

        // Marker Modal Events
        q("markerType")?.addEventListener("change", (ev) => refreshMarkerRefDropdown(ev.target.value));
        q("markerSaveBtn")?.addEventListener("click", saveMarkerHandler);
        q("markerCancelBtn")?.addEventListener("click", () => q("markerModal").style.display = "none");

        // STYLE PANEL
        q("styleEditorBtn")?.addEventListener("click", () => {
            const panel = q("styleEditorPanel");
            if (panel) panel.style.display = "block";
        });
        q("closeStylePanel")?.addEventListener("click", () => {
            const panel = q("styleEditorPanel");
            if (panel) panel.style.display = "none";
        });

        // STYLE INPUTS
        [
            "mkBg", "mkColor", "mkFont", "mkRadius",
            "mkPadding", "mkOpacity", "mkShadow",
            "mkIconSize", "mkTransparent"
        ].forEach(id => {
            const el = q(id); if (!el) return;
            const ev = (el.type === "checkbox") ? "change" : "input";
            el.addEventListener(ev, () => { saveStyleSettings(); });
        });

        // Transparent toggle
        q("clearBgBtn")?.addEventListener("click", () => {
            const chk = q("mkTransparent");
            chk.checked = !chk.checked;
            saveStyleSettings();
        });

        // PAGE ACTIONS
        q("createPageBtn")?.addEventListener("click", createPage);
        q("renamePageBtn")?.addEventListener("click", renamePage);
        q("updateImgBtn")?.addEventListener("click", triggerImageUpload);
        q("deletePageBtn")?.addEventListener("click", deletePage);
        q("pageImageInput")?.addEventListener("change", async ev => {
            const file = ev.target.files[0];
            if (!file) return;
            const fd = new FormData();
            fd.append("page_id", currentFloor);
            fd.append("file", file);
            const res = await apiPost("/update_image", fd);
            if (res?.status === "ok") { alert("อัปเดตรูปสำเร็จ"); loadPages(); }
            else alert("อัปเดตรูปล้มเหลว");
        });

        // GLOBAL DRAG
        document.addEventListener("pointermove", async (ev) => {
            if (!draggingState.active || !draggingState.markerEl || currentFloor === null || !currentMarkers.length) return;

            const idx = draggingState.index;
            const mk = draggingState.markerEl;
            const m = currentMarkers[idx];

            if (!m) return;

            const rect = PREVIEW.getBoundingClientRect();
            let nx = ((ev.clientX - rect.left) / rect.width) * 100;
            let ny = ((ev.clientY - rect.top) / rect.height) * 100;

            nx = Math.max(0, Math.min(100, nx));
            ny = Math.max(0, Math.min(100, ny));

            mk.style.left = nx + "%";
            mk.style.top = ny + "%";

            clearTimeout(mk._t);
            mk._t = setTimeout(async () => {
                m.x = nx.toFixed(2);
                m.y = ny.toFixed(2);

                await apiPost(`/update_marker/${encodeURIComponent(currentFloor)}/${idx}`, {
                    ...m, x: m.x, y: m.y
                });
                console.log(`Marker ${idx} updated: (${m.x}, ${m.y})`);
            }, 150);
        }, { capture: true });
    }

    // =======================================================
    // INIT & HOOKS
    // =======================================================
    // Expand window.showPage to handle add_screen
    const originalShowPage = window.showPage;
    window.showPage = function (page) {
        if (page === 'add_screen') {
            renderPhotoviewPage();
            return;
        }
        if (originalShowPage) originalShowPage(page);
    };

    // If already on add_screen (unlikely with this setup, but good for refresh)
    // we don't auto-run render() unless we check URL or state.
    // For now, let the user click the nav item.

})();