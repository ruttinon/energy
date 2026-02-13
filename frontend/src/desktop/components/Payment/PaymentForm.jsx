import React, { useState, useEffect } from 'react';

const PaymentForm = ({ onSubmit }) => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [slip, setSlip] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    // ดึงข้อมูล invoice จาก backend (API จริง)
    fetch('/api/billing/invoices')
      .then(r => r.json())
      .then(data => setInvoices(data || []));
  }, []);

  const handleFileChange = (e) => {
    setSlip(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoice || !slip) {
      alert('กรุณาเลือกใบแจ้งหนี้และอัปโหลดสลิป');
      return;
    }
    // ส่งข้อมูลแบบ multipart/form-data
    const formData = new FormData();
    formData.append('invoice_id', selectedInvoice.id);
    formData.append('amount', selectedInvoice.amount);
    formData.append('method', 'promptpay');
    formData.append('note', note);
    formData.append('slip', slip);
    const res = await fetch('/api/billing/payments/upload', {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      alert('แจ้งชำระเงินเรียบร้อย รอตรวจสอบ');
    } else {
      alert('เกิดข้อผิดพลาดในการแจ้งชำระเงิน');
    }
    if (onSubmit) onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <h2>แจ้งชำระเงิน</h2>
      <div>
        <label>เลือกใบแจ้งหนี้:</label>
        <select value={selectedInvoice ? selectedInvoice.id : ''} onChange={e => {
          const inv = invoices.find(i => i.id === e.target.value || i.id === Number(e.target.value));
          setSelectedInvoice(inv || null);
        }} required>
          <option value="">-- เลือกใบแจ้งหนี้ --</option>
          {invoices.map(inv => (
            <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.amount} บาท</option>
          ))}
        </select>
      </div>
      {selectedInvoice && (
        <div>
          <label>จำนวนเงินที่ต้องชำระ:</label>
          <div><strong>{selectedInvoice.amount} บาท</strong></div>
        </div>
      )}
      <div>
        <label>อัปโหลดสลิปโอนเงิน:</label>
        <input type="file" accept="image/*" onChange={handleFileChange} required />
      </div>
      <div>
        <label>หมายเหตุ (ถ้ามี):</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <button type="submit">แจ้งชำระเงิน</button>
    </form>
  );
};

export default PaymentForm;
