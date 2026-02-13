import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode.react'
import promptpay from 'promptpay'
import { useDialog } from '../../../../context/DialogContext';
import { QrCode, CreditCard, CheckCircle2, AlertTriangle, Copy, Smartphone } from 'lucide-react';

export default function PromptPayQR(){
  const { showAlert } = useDialog();
  const [invoices, setInvoices] = useState([])
  const [selected, setSelected] = useState(null)
  const [tx, setTx] = useState(null)
  const [qrData, setQrData] = useState(null)
  const recipientPhone = '0906698821'

  useEffect(()=>{
    fetch('/api/billing/invoices')
      .then(r=>r.json())
      .then(data=>{
        // data is list of invoice objects
        setInvoices(data)
      }).catch(()=>{})
  },[])

  async function createTx(inv){
    const payload = { invoice_id: inv.id, amount: Math.round((inv.amount || 0) * 100)/100, phone: recipientPhone }
    const res = await fetch('/api/billing/transactions', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
    })
    if(!res.ok) return showAlert('Error', 'Failed to create transaction')
    const t = await res.json()
    setTx(t)
    // generate QR image using promptpay JS helper (returns dataURL PNG)
    try{
      const dataUrl = await promptpay.qr(recipientPhone, payload.amount)
      setQrData(dataUrl)
    }catch(e){
      console.error(e)
      // fallback: show text QR using qrcode.react encoding a simple payload
      setQrData(null)
    }
  }

  async function markPaid(){
    if(!tx) return
    const res = await fetch(`/api/billing/transactions/${tx.id}/notify_paid`, {method:'POST'})
    if(res.ok){
      showAlert('Success', 'Marked as paid (pending review). Admin will confirm soon.')
    } else {
      showAlert('Error', 'Failed to notify payment')
    }
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <QrCode size={120} />
        </div>
        <h3 className="text-xl font-bold font-orbitron flex items-center gap-2 mb-2">
          <Smartphone className="text-blue-400" /> PromptPay QR
        </h3>
        <p className="text-slate-400 text-sm mb-4">Scan to pay instantly</p>
        
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 mb-4">
           <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Recipient ID</div>
           <div className="font-mono text-xl font-bold tracking-widest text-blue-300">{recipientPhone}</div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-slate-400 uppercase tracking-wider font-bold">Select Invoice</label>
          <select 
            onChange={(e)=>{
              const id = Number(e.target.value)
              setSelected(invoices.find(i=>i.id===id))
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-all appearance-none"
          >
            <option value="">-- Select Invoice --</option>
            {invoices.map(inv=> (
              <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.amount.toFixed(2)} THB</option>
            ))}
          </select>
        </div>
      </div>

      {selected && !tx && (
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-end mb-6">
             <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Amount</p>
                <p className="text-3xl font-bold text-slate-800">{selected.amount.toFixed(2)} <span className="text-sm text-slate-400 font-normal">THB</span></p>
             </div>
             <div className="p-3 bg-blue-50 rounded-xl">
                <CreditCard className="text-blue-600" />
             </div>
          </div>
          <button 
            onClick={()=>createTx(selected)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
          >
            <QrCode size={18} /> Generate QR Code
          </button>
        </div>
      )}

      {tx && (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 animate-in zoom-in-95 duration-500 flex flex-col items-center text-center">
          <div className="mb-4">
             <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500 mb-2">
                Transaction ID: {tx.id}
             </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border-2 border-slate-100 shadow-inner mb-6">
            {qrData ? (
              <img src={qrData} alt="PromptPay QR" className="w-64 h-64 object-contain mix-blend-multiply" />
            ) : (
               <div className="w-64 h-64 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                  <AlertTriangle size={32} className="mb-2 opacity-50" />
                  <p className="text-xs">QR Generation Failed</p>
                  <p className="text-xs mt-2">Please transfer manually</p>
               </div>
            )}
          </div>

          <div className="w-full space-y-4">
             <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-bold text-slate-600">Amount to Pay</span>
                <span className="text-xl font-bold text-blue-600">{tx.amount.toFixed(2)} THB</span>
             </div>

             {!qrData && (
                <div className="text-left p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-xs text-yellow-800">
                   <strong>Manual Transfer:</strong><br/>
                   Bank: PromptPay<br/>
                   ID: {recipientPhone}
                </div>
             )}

            <button 
                onClick={markPaid}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
            >
                <CheckCircle2 size={18} /> I Have Paid
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
