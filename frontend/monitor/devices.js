(function(){
  if (window.renderDeviceTable) return;
  window.renderDeviceTable = function(tbody, devices, latestByDev, fmtTs, isRecent){
    tbody.innerHTML='';
    devices.forEach(d=>{
      const ts = latestByDev[String(d.id)] || '';
      const ok = isRecent(ts);
      const tr = document.createElement('tr');
      const ip = d.modbus_ip || '';
      const port = d.modbus_port || '';
      const ipDisp = ip? `${ip}:${port}` : '';
      tr.innerHTML = `<td>${d.converter||''}</td><td>${d.name||d.id}</td><td>${ipDisp}</td><td>${fmtTs(ts)}</td><td class="${ok?'status-ok':'status-fail'}">${ok?'ONLINE':'OFFLINE'}</td>`;
      tbody.appendChild(tr);
    });
  };
})();
