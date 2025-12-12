(function(){
  if (window.renderSummary) return;

  function fmt(n, d=2){ const v=Number(n); return Number.isFinite(v)? v.toFixed(d): '--'; }
  function el(id){ return document.getElementById(id); }
  let animationFrameId = null;

  async function fetchLatest(deviceId){
    try{
      const pidParam = new URLSearchParams(location.search).get('pid') || '';
      const pid = pidParam || window.MON?.pid || '';
      const url = pid? `/api/json_latest/${encodeURIComponent(deviceId)}?project_id=${encodeURIComponent(pid)}`
                      : `/api/json_latest/${encodeURIComponent(deviceId)}`;
      const r = await fetch(url);
      const j = await r.json();
      return j.latest || null;
    }catch(e){ return null; }
  }

  function build(content){
    const devSelect = document.getElementById('dev');
    const convSelect = document.getElementById('conv');
    const devLabel = devSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Select device';
    const convLabel = convSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Select converter';

    content.innerHTML = `
      <section class="summary-premium">
        <div class="summary-hero">
          <div class="hero-left">
            <div class="hero-eyebrow">Realtime summary</div>
            <div class="hero-title">${devLabel}</div>
            <div class="hero-subtitle">${convLabel}</div>
          </div>
          <div class="hero-right">
            <div class="timestamp-badge" id="sum-timestamp">--:--:--</div>
            <button class="btn" id="sum-refresh">Refresh</button>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="card-label">Voltage</div>
            <div class="card-value" id="m-voltage">--</div>
            <div class="card-hint">VLL / VLN</div>
          </div>
          <div class="summary-card">
            <div class="card-label">Load</div>
            <div class="card-value" id="m-load">--</div>
            <div class="card-hint">Avg. Current</div>
          </div>
          <div class="summary-card">
            <div class="card-label">Power Factor</div>
            <div class="card-value" id="m-pf">--</div>
            <div class="card-hint">P / S</div>
          </div>
          <div class="summary-card">
            <div class="card-label">Harmonics</div>
            <div class="card-value" id="m-thd">--</div>
            <div class="card-hint">THD V / I</div>
          </div>
        </div>

        <div class="summary-charts">
          <div class="chart-card">
            <div class="chart-title">Phase Vector</div>
            <canvas id="summaryVector"></canvas>
          </div>
          <div class="chart-card">
            <div class="chart-title">Power Circle</div>
            <canvas id="powerCircle"></canvas>
          </div>
        </div>

        <div class="summary-panels">
          <div class="panel-card">
            <div class="panel-header">System</div>
            <ul class="panel-list">
              <li>VLL <span id="sys-vll">--</span></li>
              <li>VLN <span id="sys-vln">--</span></li>
              <li>F <span id="sys-f">-- Hz</span></li>
              <li>I <span id="sys-i">-- A</span></li>
            </ul>
          </div>
          <div class="panel-card">
            <div class="panel-header">Quality</div>
            <ul class="panel-list">
              <li>UNB U <span id="q-unbu">-- %</span></li>
              <li>UNB I <span id="q-unbi">-- %</span></li>
              <li>THD V <span id="q-thdv">-- %</span></li>
              <li>THD I <span id="q-thdi">-- %</span></li>
            </ul>
          </div>
        </div>
      </section>`;
  }

  function drawVector(canvas, vL1, vL2, vL3){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if(w===0||h===0) return;
    canvas.width = w * (window.devicePixelRatio||1);
    canvas.height = h * (window.devicePixelRatio||1);
    const DPR = window.devicePixelRatio||1;
    const cx = canvas.width/2, cy = canvas.height/2, R = Math.min(canvas.width, canvas.height)*0.35;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = 'rgba(99,209,255,0.15)'; ctx.lineWidth = 1*DPR;
    for(let r=0.2;r<=1;r+=0.2){ ctx.setLineDash([6*DPR,6*DPR]); ctx.beginPath(); ctx.arc(cx,cy,R*r,0,Math.PI*2); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(99,209,255,0.08)';
    for(let i=0;i<24;i++){ const a=Math.random()*Math.PI*2; const rr=R*(0.2+Math.random()*0.8); const x=cx+rr*Math.cos(a), y=cy+rr*Math.sin(a); ctx.beginPath(); ctx.arc(x,y,1.5*DPR,0,Math.PI*2); ctx.fill(); }
    const phases = [0, 240, 120];
    const mags = [vL1||0, vL2||0, vL3||0];
    const maxV = Math.max(...mags, 1);
    const cols = ['#c8fafe','#bba7ff','#a7fcd1'];
    for(let i=0;i<3;i++){ const ang=(phases[i]*Math.PI)/180; const len=R*(Math.abs(mags[i])/maxV); ctx.strokeStyle=cols[i]; ctx.lineWidth=3*DPR; const x=cx+len*Math.cos(ang), y=cy+len*Math.sin(ang); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(x,y); ctx.stroke(); ctx.fillStyle=cols[i]; ctx.font=`${12*DPR}px Rajdhani,system-ui`; const label = `V${i+1} ${fmt(mags[i],2)} V`; ctx.fillText(label, x + 6*DPR*Math.cos(ang), y + 6*DPR*Math.sin(ang)); }
  }

  function drawVectorDual(canvas, vArr, iArr){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth, h = canvas.clientHeight; if(!w||!h) return;
    const DPR = window.devicePixelRatio||1; canvas.width=w*DPR; canvas.height=h*DPR;
    const cx = canvas.width/2, cy = canvas.height/2, R = Math.min(canvas.width, canvas.height)*0.38;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    // 🌟 3D CONCENTRIC CIRCLES WITH DEPTH
    const time = Date.now() * 0.0004;
    const globalSpin = Date.now() * 0.00008;
    for(let r=1; r>=0.25; r-=0.25){
      // Inner shadow for depth
      const innerGrad = ctx.createRadialGradient(cx-5*DPR, cy-5*DPR, R*r*0.3, cx, cy, R*r);
      innerGrad.addColorStop(0, `rgba(6, 182, 212, ${0.08 * r})`);
      innerGrad.addColorStop(0.7, `rgba(15, 23, 42, ${0.15 * r})`);
      innerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R*r, 0, Math.PI*2);
      ctx.fill();
      
      // Dashed circle rings with 3D effect
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.4 * r})`;
      ctx.lineWidth = 1.5*DPR;
      ctx.setLineDash([12*DPR, 12*DPR]);
      ctx.lineDashOffset = Math.sin(time * (1.1 + r)) * 60;
      ctx.beginPath();
      ctx.arc(cx, cy, R*r, 0, Math.PI*2);
      ctx.stroke();
      
      // Outer glow ring
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 * r})`;
      ctx.lineWidth = 3*DPR;
      ctx.beginPath();
      ctx.arc(cx, cy, R*r, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // ✨ FLOATING PARTICLES (reduced for clarity)
    ctx.shadowBlur = 6*DPR;
    for(let i=0;i<30;i++){
      const a = Math.random()*Math.PI*2;
      const rr = R*(0.2+Math.random()*0.8);
      const x = cx+rr*Math.cos(a), y = cy+rr*Math.sin(a);
      const size = (0.8 + Math.random()*1.5)*DPR;
      ctx.fillStyle = `rgba(99,209,255,${0.3+Math.random()*0.4})`;
      ctx.shadowColor = '#06b6d4';
      ctx.beginPath();
      ctx.arc(x,y,size,0,Math.PI*2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    
    const phases=[0,240,120];
    
    // 🔷 VOLTAGE VECTORS WITH 3D DEPTH & GLOW
    const vMax=Math.max(...vArr.map(Number),1);
    const vCols=['#c8fafe','#bba7ff','#a7fcd1'];
    const vLabels = ['V2', 'V1', 'V3'];
    
    for(let i=0;i<3;i++){
      const ang=(phases[i]*Math.PI)/180 + globalSpin;
      const len=R*(Math.abs(Number(vArr[i])||0)/vMax);
      const x=cx+len*Math.cos(ang), y=cy+len*Math.sin(ang);
      
      // 3D Shadow for depth
      ctx.strokeStyle='rgba(0,0,0,0.5)';
      ctx.lineWidth=7*DPR;
      ctx.beginPath();
      ctx.moveTo(cx+3*DPR,cy+3*DPR);
      ctx.lineTo(x+3*DPR,y+3*DPR);
      ctx.stroke();
      
      // Outer glow layer
      ctx.shadowBlur = 25*DPR;
      ctx.shadowColor = vCols[i];
      ctx.strokeStyle=vCols[i];
      ctx.lineWidth=5*DPR;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(x,y);
      ctx.stroke();
      
      // Inner bright core
      ctx.strokeStyle='#ffffff';
      ctx.lineWidth=2*DPR;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(x,y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Endpoint with radial glow
      const endGrad = ctx.createRadialGradient(x, y, 0, x, y, 10*DPR);
      endGrad.addColorStop(0, '#ffffff');
      endGrad.addColorStop(0.3, vCols[i]);
      endGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = endGrad;
      ctx.beginPath();
      ctx.arc(x,y,10*DPR,0,Math.PI*2);
      ctx.fill();
      
      // Label with shadow background
      const labelX = x + 18*DPR*Math.cos(ang);
      const labelY = y + 18*DPR*Math.sin(ang);
      const labelText = `${vLabels[i]} ${fmt(vArr[i],2)} V`;
      
      // Text background
      ctx.font=`bold ${14*DPR}px Orbitron, system-ui`;
      const metrics = ctx.measureText(labelText);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fillRect(labelX - 4*DPR, labelY - 14*DPR, metrics.width + 8*DPR, 20*DPR);
      
      // Text with glow
      ctx.fillStyle='#ffffff';
      ctx.shadowBlur = 12*DPR;
      ctx.shadowColor = vCols[i];
      ctx.fillText(labelText, labelX, labelY);
      ctx.shadowBlur = 0;
    }
    
    // 🔥 CURRENT VECTORS WITH 3D DEPTH
    const iMax=Math.max(...iArr.map(Number),1);
    const iCols=['#ff9e9e','#ff7c7c','#ff5c5c'];
    const iLabels = ['I2', 'I1', 'I3'];
    
    for(let i=0;i<3;i++){
      const ang=(phases[i]*Math.PI)/180 + globalSpin;
      const len=R*0.7*(Math.abs(Number(iArr[i])||0)/iMax);
      const x=cx+len*Math.cos(ang), y=cy+len*Math.sin(ang);
      
      // 3D Shadow
      ctx.strokeStyle='rgba(0,0,0,0.4)';
      ctx.lineWidth=6*DPR;
      ctx.beginPath();
      ctx.moveTo(cx+2*DPR,cy+2*DPR);
      ctx.lineTo(x+2*DPR,y+2*DPR);
      ctx.stroke();
      
      // Outer glow
      ctx.shadowBlur = 20*DPR;
      ctx.shadowColor = iCols[i];
      ctx.strokeStyle=iCols[i];
      ctx.lineWidth=4*DPR;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(x,y);
      ctx.stroke();
      
      // Inner core
      ctx.strokeStyle='#ffcccc';
      ctx.lineWidth=1.5*DPR;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.lineTo(x,y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Endpoint glow
      const endGrad = ctx.createRadialGradient(x, y, 0, x, y, 8*DPR);
      endGrad.addColorStop(0, '#ffffff');
      endGrad.addColorStop(0.4, iCols[i]);
      endGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = endGrad;
      ctx.beginPath();
      ctx.arc(x,y,8*DPR,0,Math.PI*2);
      ctx.fill();
      
      // Label with background
      const labelX = x - 18*DPR*Math.cos(ang);
      const labelY = y - 18*DPR*Math.sin(ang);
      const labelText = `${iLabels[i]} ${fmt(iArr[i],3)} A`;
      
      ctx.font=`bold ${14*DPR}px Orbitron, system-ui`;
      const metrics = ctx.measureText(labelText);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fillRect(labelX - metrics.width - 4*DPR, labelY - 14*DPR, metrics.width + 8*DPR, 20*DPR);
      
      ctx.fillStyle='#ffffff';
      ctx.shadowBlur = 12*DPR;
      ctx.shadowColor = iCols[i];
      ctx.fillText(labelText, labelX - metrics.width, labelY);
      ctx.shadowBlur = 0;
    }
    
    // 💎 CENTER HOLOGRAPHIC CORE
    const coreGrad1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, 15*DPR);
    coreGrad1.addColorStop(0, 'rgba(0, 212, 255, 0.9)');
    coreGrad1.addColorStop(0.5, 'rgba(6, 182, 212, 0.5)');
    coreGrad1.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad1;
    ctx.beginPath();
    ctx.arc(cx, cy, 15*DPR, 0, Math.PI*2);
    ctx.fill();
    
    // Inner white core
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 15*DPR;
    ctx.shadowColor = '#00d4ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 4*DPR, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawPowerCircle(canvas, P, Q){
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth, h = canvas.clientHeight; if(!w||!h) return;
    const DPR = window.devicePixelRatio||1; canvas.width=w*DPR; canvas.height=h*DPR;
    const cx = canvas.width/2, cy = canvas.height/2, R = Math.min(canvas.width, canvas.height)*0.42;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    // 🌌 3D CONCENTRIC CIRCLES WITH DEPTH
    const spin = Date.now() * 0.00015;
    const time = Date.now() * 0.0005;
    for(let r=1; r>=0.25; r-=0.25){
      // Inner shadow gradient for 3D depth
      const depthGrad = ctx.createRadialGradient(cx-5*DPR, cy-5*DPR, R*r*0.3, cx, cy, R*r);
      depthGrad.addColorStop(0, `rgba(6, 182, 212, ${0.1 * r})`);
      depthGrad.addColorStop(0.7, `rgba(139, 92, 246, ${0.08 * r})`);
      depthGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = depthGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R*r, 0, Math.PI*2);
      ctx.fill();
      
      // Animated dashed rings
      ctx.strokeStyle = `rgba(6, 182, 212, ${0.45 * r})`;
      ctx.lineWidth = 1.5*DPR;
      ctx.setLineDash([12*DPR, 12*DPR]);
      ctx.lineDashOffset = spin * r * 120;
      ctx.beginPath();
      ctx.arc(cx, cy, R*r, 0, Math.PI*2);
      ctx.stroke();

      // Rotating segment indicators (visible rotation)
      const segCount = 24 + Math.round(8 * r);
      ctx.setLineDash([]);
      for(let seg=0; seg<segCount; seg++){
        const a0 = (seg/segCount) * Math.PI*2 + spin * (0.8 + r);
        const a1 = a0 + 0.08;
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.35 * r})`;
        ctx.lineWidth = 2*DPR;
        ctx.beginPath();
        ctx.arc(cx, cy, R*r, a0, a1);
        ctx.stroke();
      }
      
      // Outer glow ring
      ctx.strokeStyle = `rgba(34, 211, 238, ${0.2 * r})`;
      ctx.lineWidth = 3*DPR;
      ctx.beginPath();
      ctx.arc(cx, cy, R*r, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // ⚡ ENERGY PARTICLES (reduced for clarity)
    ctx.shadowBlur = 6*DPR;
    for(let i=0;i<35;i++){
      const a = (Math.random()*Math.PI*2) + (time * 0.1);
      const rr = R*(0.15+Math.random()*0.85);
      const x = cx+rr*Math.cos(a), y = cy+rr*Math.sin(a);
      const size = (0.8 + Math.random()*2)*DPR;
      ctx.fillStyle = `rgba(${100+Math.random()*155}, ${200+Math.random()*55}, 255, ${0.4+Math.random()*0.4})`;
      ctx.shadowColor = '#00d4ff';
      ctx.beginPath();
      ctx.arc(x,y,size,0,Math.PI*2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    
    // 💠 CENTER HOLOGRAPHIC CORE
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18*DPR);
    coreGrad.addColorStop(0, 'rgba(0, 212, 255, 1)');
    coreGrad.addColorStop(0.3, 'rgba(6, 182, 212, 0.8)');
    coreGrad.addColorStop(0.6, 'rgba(59, 130, 246, 0.4)');
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 18*DPR, 0, Math.PI*2);
    ctx.fill();
    
    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 20*DPR;
    ctx.shadowColor = '#00d4ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 5*DPR, 0, Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Calculate power values
    const S = Math.sqrt(P*P+Q*Q);
    const maxS = Math.max(Math.abs(S), 1);
    const len = R * (Math.abs(S)/maxS);
    const angle = Math.atan2(Q, P);
    const x = cx + len * Math.cos(angle);
    const y = cy - len * Math.sin(angle);
    
    // 🎯 POWER VECTOR WITH 3D EFFECT
    // Deep shadow for 3D depth
    ctx.strokeStyle='rgba(0,0,0,0.6)';
    ctx.lineWidth=10*DPR;
    ctx.beginPath();
    ctx.moveTo(cx+4*DPR,cy+4*DPR);
    ctx.lineTo(x+4*DPR,y+4*DPR);
    ctx.stroke();
    
    // Outer glow layer
    ctx.shadowBlur = 35*DPR;
    ctx.shadowColor = '#00d4ff';
    ctx.strokeStyle='#00d4ff';
    ctx.lineWidth=7*DPR;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(x,y);
    ctx.stroke();
    
    // Middle layer
    ctx.strokeStyle='#3dd4ff';
    ctx.lineWidth=4*DPR;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(x,y);
    ctx.stroke();
    
    // Inner bright core line
    ctx.strokeStyle='#ffffff';
    ctx.lineWidth=2*DPR;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.lineTo(x,y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // ⭐ ENDPOINT WITH MULTI-LAYER HOLOGRAM
    const endGrad = ctx.createRadialGradient(x, y, 0, x, y, 18*DPR);
    endGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    endGrad.addColorStop(0.2, 'rgba(0, 212, 255, 1)');
    endGrad.addColorStop(0.5, 'rgba(34, 211, 238, 0.8)');
    endGrad.addColorStop(0.8, 'rgba(6, 182, 212, 0.3)');
    endGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = endGrad;
    ctx.beginPath();
    ctx.arc(x,y,18*DPR,0,Math.PI*2);
    ctx.fill();
    
    // Bright center dot
    ctx.fillStyle='#ffffff';
    ctx.shadowBlur = 25*DPR;
    ctx.shadowColor = '#00d4ff';
    ctx.beginPath();
    ctx.arc(x,y,6*DPR,0,Math.PI*2);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // 📊 LABELS WITH PREMIUM EFFECTS
    ctx.font=`bold ${15*DPR}px Orbitron, system-ui`;
    
    // S label (on the vector line)
    const sX = cx + (R*0.55)*Math.cos(angle);
    const sY = cy - (R*0.55)*Math.sin(angle);
    const sText = `S ${fmt(S,2)} VA`;
    
    // Background for S label
    const sMetrics = ctx.measureText(sText);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(sX - sMetrics.width/2 - 6*DPR, sY - 16*DPR, sMetrics.width + 12*DPR, 24*DPR);
    
    // S text with glow
    ctx.fillStyle='#00d4ff';
    ctx.shadowBlur = 18*DPR;
    ctx.shadowColor = '#00d4ff';
    ctx.textAlign = 'center';
    ctx.fillText(sText, sX, sY);
    
    // P label (below endpoint)
    const pText = `P: ${fmt(P,2)} W`;
    const pMetrics = ctx.measureText(pText);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(x + 14*DPR, y - 20*DPR, pMetrics.width + 12*DPR, 24*DPR);
    
    ctx.fillStyle='#a8e6ff';
    ctx.shadowColor = '#00d4ff';
    ctx.textAlign = 'left';
    ctx.fillText(pText, x + 20*DPR, y - 6*DPR);
    
    // Q label (above P label)
    const qText = `Q: ${fmt(Q,2)} var`;
    const qMetrics = ctx.measureText(qText);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.fillRect(x + 14*DPR, y + 4*DPR, qMetrics.width + 12*DPR, 24*DPR);
    
    ctx.fillStyle='#7dd3fc';
    ctx.fillText(qText, x + 20*DPR, y + 18*DPR);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'start';
  }

  function updateHeroLabels(){
    const devSelect = document.getElementById('dev');
    const convSelect = document.getElementById('conv');
    const devLabel = devSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Select device';
    const convLabel = convSelect?.selectedOptions?.[0]?.textContent?.trim() || 'Select converter';
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    if (heroTitle) heroTitle.textContent = devLabel;
    if (heroSubtitle) heroSubtitle.textContent = convLabel;
  }

  function updateTimestamp(){
    const ts = document.getElementById('sum-timestamp');
    if (ts) ts.textContent = new Date().toLocaleTimeString();
  }

  async function refresh(){
    let dev = document.getElementById('dev')?.value || '';
    if(!dev){ dev = localStorage.getItem('selectedDevice') || ''; }
    if(!dev){ return; }
    const latest = await fetchLatest(dev);
    if(!latest){ return; }
    updateHeroLabels();
    updateTimestamp();
    const vll = ((Number(latest.Voltage_L1L2)||0)+(Number(latest.Voltage_L2L3)||0)+(Number(latest.Voltage_L3L1)||0))/3;
    const vln = ((Number(latest.Voltage_L1)||0)+(Number(latest.Voltage_L2)||0)+(Number(latest.Voltage_L3)||0))/3;
    const elV = el('m-voltage'); if (!elV) return;
    elV.textContent = `${fmt(vll,0)}V`;
    const il = ((Number(latest.Current_L1)||0)+(Number(latest.Current_L2)||0)+(Number(latest.Current_L3)||0))/3;
    const elI = el('m-load'); if (!elI) return;
    elI.textContent = `${fmt(il,1)}A`;
    let P = Number(latest.ActivePower_Total);
    if(!Number.isFinite(P)) P = (Number(latest.ActivePower_L1)||0)+(Number(latest.ActivePower_L2)||0)+(Number(latest.ActivePower_L3)||0);
    let Q = Number(latest.ReactivePower_Total);
    if(!Number.isFinite(Q)) Q = (Number(latest.ReactivePower_L1)||0)+(Number(latest.ReactivePower_L2)||0)+(Number(latest.ReactivePower_L3)||0);
    const S = Math.sqrt(P*P+Q*Q)||1; const PF = Math.abs(P/S);
    const elPF = el('m-pf'); if (!elPF) return; elPF.textContent = fmt(PF,2);
    const thdv = ((Number(latest.THD_Voltage_L1)||0)+(Number(latest.THD_Voltage_L2)||0)+(Number(latest.THD_Voltage_L3)||0))/3;
    let thdi = ((Number(latest.THD_Current_L1)||0)+(Number(latest.THD_Current_L2)||0)+(Number(latest.THD_Current_L3)||0))/3;
    if(!Number.isFinite(thdi) || thdi===0){ thdi = Number(latest.THD_I)||0; }
    const elTHD = el('m-thd'); if (!elTHD) return; elTHD.textContent = `${fmt(thdv,1)}% / ${fmt(thdi,1)}%`;
    // system table
    const sVLL = el('sys-vll'); const sVLN = el('sys-vln'); const sF = el('sys-f'); const sI = el('sys-i');
    if (sVLL) sVLL.textContent = `${fmt(vll,2)} V`;
    if (sVLN) sVLN.textContent = `${fmt(vln,2)} V`;
    if (sF) sF.textContent = `${fmt(latest.Frequency||latest.Freq||0,2)} Hz`;
    if (sI) sI.textContent = `${fmt(il,2)} A`;
    // quality table
    const unb = (a,b,c)=>{ const avg=(a+b+c)/3; const max=Math.max(a,b,c); return avg? ((max-avg)/avg)*100:0; };
    const unbU = unb(Number(latest.Voltage_L1)||0, Number(latest.Voltage_L2)||0, Number(latest.Voltage_L3)||0);
    const unbI = unb(Number(latest.Current_L1)||0, Number(latest.Current_L2)||0, Number(latest.Current_L3)||0);
    el('q-unbu').textContent = `${fmt(unbU,2)} %`;
    el('q-unbi').textContent = `${fmt(unbI,2)} %`;
    el('q-thdv').textContent = `${fmt(thdv,2)} %`;
    el('q-thdi').textContent = `${fmt(thdi,2)} %`;
    
    // Store data for continuous animation
    window.__summaryData = {
      vArr: [latest.Voltage_L1, latest.Voltage_L2, latest.Voltage_L3],
      iArr: [latest.Current_L1, latest.Current_L2, latest.Current_L3],
      P: P,
      Q: Q
    };
  }
  
  // 🎬 CONTINUOUS ANIMATION LOOP
  function animateCanvases() {
    if (window.__summaryData) {
      const vectorCanvas = el('summaryVector');
      const powerCanvas = el('powerCircle');
      
      if (vectorCanvas) {
        drawVectorDual(vectorCanvas, window.__summaryData.vArr, window.__summaryData.iArr);
      }
      
      if (powerCanvas) {
        drawPowerCircle(powerCanvas, window.__summaryData.P, window.__summaryData.Q);
      }
    }
    
    animationFrameId = requestAnimationFrame(animateCanvases);
  }

 window.renderSummary = async function(content){
  build(content);

  // ⏳ รอจนกว่า DOM element จะถูกสร้างเสร็จ
  function waitForButton() {
    const btn = el("sum-refresh");
    if (btn) {
      btn.onclick = refresh;
      refresh();
      
      // 🎬 Start continuous animation loop
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      animateCanvases();
      
      return;
    }
    requestAnimationFrame(waitForButton);
  }

  waitForButton();

  try { 
    if (window.__summaryTimer) clearInterval(window.__summaryTimer); 
  } catch(e){}

  window.__summaryTimer = setInterval(refresh, 2000);
};

})();
