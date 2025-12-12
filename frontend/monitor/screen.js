(function(){
  if (window.renderScreen) return;
  window.renderScreen = async function(content, MON){
    content.innerHTML = '<div class="cards"><div class="card"><h3>Parameters</h3></div></div><div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><label>Device</label><select id="scr-dev" class="select"></select></div><table><thead><tr><th>PARAMETER</th><th>VALUE</th><th>UNIT</th><th>DESCRIPTION</th></tr></thead><tbody id="scr-body"></tbody></table>';
    const devSel=document.getElementById('scr-dev'); devSel.innerHTML='';
    MON.devices.forEach(d=>{ const o=document.createElement('option'); o.value=String(d.id); o.textContent=d.name?`${d.name} (#${d.id})`:`Device #${d.id}`; devSel.appendChild(o); });
    const load = async ()=>{
      const pid = MON.pid || document.getElementById('proj')?.value; if(!pid) return;
      const res = await fetch(`/public/projects/${encodeURIComponent(pid)}/readings`); const j = await res.json(); const items=j.items||[]; const did=devSel.value||'';
      const tbody=document.getElementById('scr-body'); tbody.innerHTML='';
      const filtered = did? items.filter(x=>String(x.device_id)===did): items;
      filtered.sort((a,b)=>String(a.parameter).localeCompare(String(b.parameter))).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.parameter}</td><td>${r.value??''}</td><td>${r.unit??''}</td><td>${r.description??''}</td>`; tbody.appendChild(tr); });
    };
    devSel.onchange = load; await load();
  };
})();
