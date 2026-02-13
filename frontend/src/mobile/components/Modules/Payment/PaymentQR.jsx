import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';
import promptpay from 'promptpay';

const recipientPhone = '0906698821'; // เบอร์ PromptPay

const PaymentQR = () => {
  const [amount, setAmount] = useState(0);
  const [qrPayload, setQrPayload] = useState('');

  useEffect(() => {
    fetch('/api/billing/invoices')
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          setAmount(data[0].amount);
          // ใช้ promptpay-js เพื่อสร้าง payload มาตรฐาน
          setQrPayload(promptpay.generatePayload(recipientPhone, data[0].amount));
        }
      });
  }, []);

  return (
    <div className="payment-qr">
      <div className="flex flex-col items-center">
        <QRCode value={qrPayload || ' '} size={220} />
        <div className="mt-2 text-sm text-slate-500">สแกนเพื่อชำระ {amount} บาท</div>
      </div>
    </div>
  );
};

export default PaymentQR;
