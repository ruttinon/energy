import React, { useEffect, useState } from 'react';
import promptpay from 'promptpay';

const PaymentQR = () => {
    const [invoices, setInvoices] = useState([])
    const [selected, setSelected] = useState(null)
    const [tx, setTx] = useState(null)
    const [qrData, setQrData] = useState(null)
    const [status, setStatus] = useState('idle')
    const recipientPhone = '0906698821'

    useEffect(()=>{
        fetch('/api/billing/invoices')
            .then(r=>r.json())
            .then(data=>setInvoices(data || []))
            .catch(()=>setInvoices([]))
    },[])

    async function createTx(inv){
        setStatus('creating')
        const payload = { invoice_id: inv.id, amount: Math.round((inv.amount || 0) * 100)/100, phone: recipientPhone }
        const res = await fetch('/api/billing/transactions', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
        })
        if(!res.ok){ setStatus('error'); return alert('สร้าง transaction ล้มเหลว') }
        const t = await res.json()
        setTx(t)
        setStatus('qr')
        try{
            const dataUrl = await promptpay.qr(recipientPhone, payload.amount)
            setQrData(dataUrl)
        }catch(e){
            console.error(e)
            setQrData(null)
        }
    }

    async function markPaid(){
        if(!tx) return
        const res = await fetch(`/api/billing/transactions/${tx.id}/notify_paid`, {method:'POST'})
        if(res.ok){
            setStatus('awaiting_review')
            alert('แจ้งชำระแล้ว รอการยืนยันจากผู้ดูแล')
        } else {
            alert('แจ้งชำระล้มเหลว')
        }
    }

    function downloadQR(){
        if(!qrData) return
        const a = document.createElement('a')
        a.href = qrData
        a.download = `promptpay-${tx ? tx.id : 'qr'}.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">QR PromptPay (รับที่ {recipientPhone})</div>
            </div>

            <div>
                <label className="text-xs text-slate-500">เลือกใบแจ้งหนี้</label>
                <div>
                    <select onChange={(e)=>{
                        const id = Number(e.target.value)
                        setSelected(invoices.find(i=>i.id === id) || null)
                    }}>
                        <option value="">-- เลือก --</option>
                        {invoices.map(inv => (
                            <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.target_name} — {Number(inv.amount).toFixed(2)} THB</option>
                        ))}
                    </select>
                </div>
            </div>

            {selected && !tx && (
                <div>
                    <p>จำนวน: <strong>{Number(selected.amount).toFixed(2)} THB</strong></p>
                    <button onClick={()=>createTx(selected)} className="px-3 py-2 rounded bg-cyan-500 text-white">สร้างคิวอาร์</button>
                </div>
            )}

            {tx && (
                <div>
                    <h4 className="text-sm">Transaction: {tx.id}</h4>
                    {status === 'awaiting_review' && (
                        <div className="text-sm text-amber-500 mb-2">สถานะ: รอการยืนยันโดยผู้ดูแล</div>
                    )}
                    {qrData ? (
                        <div className="flex flex-col items-center gap-2">
                            <img src={qrData} alt="PromptPay QR" style={{width:220,height:220}} />
                            <div>จำนวน: <strong>{Number(tx.amount).toFixed(2)} THB</strong></div>
                            <div className="flex gap-2 mt-2">
                                <button onClick={downloadQR} disabled={status === 'awaiting_review'} className={`px-3 py-2 rounded ${status === 'awaiting_review' ? 'bg-slate-400' : 'bg-amber-500'} text-white text-sm`}>ดาวน์โหลด QR</button>
                                <button onClick={markPaid} disabled={status === 'awaiting_review'} className={`px-3 py-2 rounded ${status === 'awaiting_review' ? 'bg-slate-400' : 'bg-emerald-600'} text-white text-sm`}>แจ้งว่าชำระแล้ว</button>
                            </div>
                            <div className="text-xs text-slate-400 mt-2">แสกนคิวอาร์ด้วยแอปธนาคารหรือแอป PromptPay แล้วกด "แจ้งว่าชำระแล้ว" เพื่อให้ผู้ดูแลตรวจสอบ</div>
                        </div>
                    ) : (
                        <div>
                            <p>ไม่สามารถสร้างรูปคิวอาร์ได้ — แสดงข้อมูลเพื่อโอนด้วยตนเอง</p>
                            <p>เบอร์: <strong>{recipientPhone}</strong></p>
                            <p>จำนวน: <strong>{Number(tx.amount).toFixed(2)} THB</strong></p>
                            <button onClick={markPaid} disabled={status === 'awaiting_review'} className={`px-3 py-2 rounded ${status === 'awaiting_review' ? 'bg-slate-400' : 'bg-emerald-600'} text-white`}>แจ้งว่าชำระแล้ว</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default PaymentQR;
