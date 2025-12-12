(function(){
  if (window.makeTable) return;
  window.makeTable = function(columns, rows){
    const table=document.createElement('table');
    const thead=document.createElement('thead'); const trh=document.createElement('tr');
    columns.forEach(c=>{ const th=document.createElement('th'); th.textContent=c; trh.appendChild(th); }); thead.appendChild(trh); table.appendChild(thead);
    const tbody=document.createElement('tbody'); rows.forEach(r=>{ const tr=document.createElement('tr'); r.forEach(cell=>{ const td=document.createElement('td'); td.textContent=cell==null?'':String(cell); tr.appendChild(td); }); tbody.appendChild(tr); }); table.appendChild(tbody);
    return table;
  };
})();
