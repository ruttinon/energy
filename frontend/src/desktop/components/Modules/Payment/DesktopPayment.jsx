import React from 'react';
import PaymentForm from '../../Payment/PaymentForm';

const DesktopPayment = () => {
  const handleSubmit = (data) => {
    // TODO: ส่งข้อมูลแจ้งชำระเงินไป backend และแจ้งเตือน admin
    alert('แจ้งชำระเงินเรียบร้อย รอ admin ยืนยัน');
    // สามารถเพิ่ม logic แจ้งเตือน admin ผ่าน email/LINE ได้ที่นี่
  };

  return (
    <div className="desktop-payment-page">
      <PaymentForm onSubmit={handleSubmit} />
    </div>
  );
};

export default DesktopPayment;
