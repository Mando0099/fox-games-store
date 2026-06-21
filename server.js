require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios'); 
const admin = require('firebase-admin'); 
const nodemailer = require('nodemailer'); 

// تهيئة الفايربيز باستخدام الـ Database URL
if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: process.env.FIREBASE_DATABASE_URL 
  });
}
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 9000;

// إعدادات ماي فاتورة (MyFatoorah)
const MYFATOORAH_TOKEN = process.env.MYFATOORAH_TOKEN;
const MYFATOORAH_API_URL = process.env.MYFATOORAH_API_URL || 'https://api.myfatoorah.com/v2'; 
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// إعداد مرسل الإيميلات (Nodemailer)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS  
  }
});

function money(amount) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid payment amount.');
  return value.toFixed(2);
}

// 1. مسار استقبال طلب الدفع وتوليد رابط الدفع المباشر مع ميزة كشف تفاصيل الأخطاء
app.post('/api/myfatoorah/create-payment', async (req, res) => {
  try {
    if (!MYFATOORAH_TOKEN) return res.status(500).json({ message: 'Missing MyFatoorah token in .env file.' });

    const order = req.body || {};
    const amount = money(order.total);
    const customerEmail = order.customer?.email;
    const items = Array.isArray(order.items) ? order.items : [];

    if (!customerEmail) return res.status(400).json({ success: false, message: 'Customer email is required to deliver codes.' });

    // طباعة البيانات في الـ Logs للتأكد عند التشغيل
    console.log('Sending request to MyFatoorah URL:', `${MYFATOORAH_API_URL}/ExecutePayment`);
    console.log('Token snippet:', MYFATOORAH_TOKEN ? MYFATOORAH_TOKEN.substring(0, 15) + '...' : 'MISSING');

    const response = await axios.post(`${MYFATOORAH_API_URL}/ExecutePayment`, {
      PaymentMethodId: 0, 
      InvoiceValue: amount,
      CustomerEmail: customerEmail,
      CustomerName: order.customer?.name || 'Fox Games Customer',
      CustomerMobile: order.customer?.phone || '',
      CallBackUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=success`,
      ErrorUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=failed`,
      UserDefinedField: JSON.stringify(items) 
    }, {
      headers: { 'Authorization': `Bearer ${MYFATOORAH_TOKEN}` }
    });

    if (response.data.IsSuccess) {
      res.json({ success: true, paymentUrl: response.data.Data.PaymentURL });
    } else {
      res.status(400).json({ success: false, message: 'Failed to create MyFatoorah execution link.' });
    }
  } catch (e) {
    // طباعة تفاصيل الـ 403 كاملة في سيرفر ريندر لمعرفة السبب
    console.error('=== MYFATOORAH FULL ERROR DETAILS ===');
    console.error('Status:', e.response?.status);
    console.error('Data from MyFatoorah:', e.response?.data);
    console.error('======================================');
    
    res.status(400).json({ 
      success: false, 
      message: e.response?.data?.Message || e.response?.data?.ValidationErrors?.[0]?.Error || e.message 
    });
  }
});

// 2. الـ Webhook الفعلي لاستقبال إشارة نجاح الدفع وسحب الأكواد تلقائياً
app.post('/api/myfatoorah/webhook', async (req, res) => {
  const { TransactionId, OrderStatus } = req.body;

  if (OrderStatus === 'Paid') {
    try {
      const verification = await axios.post(`${MYFATOORAH_API_URL}/GetPaymentStatus`, {
        Key: TransactionId,
        KeyType: 'TransactionId'
      }, {
        headers: { 'Authorization': `Bearer ${MYFATOORAH_TOKEN}` }
      });

      const paymentData = verification.data.Data;
      const customerEmail = paymentData.CustomerEmail;
      const cartItems = JSON.parse(paymentData.UserDefinedField); 
      const orderId = paymentData.InvoiceId;

      const purchasedCodes = [];

      await db.runTransaction(async (transaction) => {
        for (const item of cartItems) {
          const codesRef = db.collection('products').doc(item.id).collection('digital_codes');
          const availableCodeQuery = codesRef.where('isUsed', '==', false).limit(1);
          const codeSnapshot = await transaction.get(availableCodeQuery);

          if (!codeSnapshot.empty) {
            const codeDoc = codeSnapshot.docs[0];
            transaction.update(codeDoc.ref, {
              isUsed: true,
              orderId: orderId,
              purchasedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            purchasedCodes.push({ productName: item.name, code: codeDoc.data().code });
          }
        }
      });

      if (purchasedCodes.length > 0) {
        await sendCodesEmail(customerEmail, orderId, purchasedCodes);
      }

      return res.status(200).send('SUCCESS');
    } catch (error) {
      console.error('Webhook processing error:', error.message);
      return res.status(500).send('Internal Server Error');
    }
  }
  res.status(200).send('Ignored');
});

// دالة تنسيق وإرسال الإيميل للاعبين بالـ HTML
async function sendCodesEmail(email, orderId, codes) {
  let codesHtml = '';
  codes.forEach(c => {
    codesHtml += `
      <div style="background: #0d1722; border: 1px solid #65cc00; padding: 15px; border-radius: 8px; margin-bottom: 10px; color: #fff; text-align: center;">
        <h3 style="margin: 0 0 5px 0; color: #94a3b8;">${c.productName}</h3>
        <p style="font-size: 20px; font-weight: bold; letter-spacing: 2px; margin: 0; color: #65cc00;">${c.code}</p>
      </div>`;
  });

  const mailOptions = {
    from: `"Fox Games Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: `أكواد طلبك رقم #${orderId} - Fox Games`,
    html: `
      <div style="font-family: sans-serif; direction: rtl; text-align: right; padding: 20px; background: #090f17; color: #fff; max-width: 500px; margin: auto; border: 1px solid rgba(101,204,0,0.2); border-radius: 12px;">
        <h2 style="color: #65cc00; text-align: center;">شكرًا لشرائك من Fox Games!</h2>
        <p>تم تأكيد دفع طلبك بنجاح. إليك الأكواد الرقمية الفورية الخاصة بك:</p>
        <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">
        ${codesHtml}
        <hr style="border-color: rgba(255,255,255,0.1); margin: 20px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">إذا واجهت أي مشكلة في الشحن، تواصل مع الدعم الفني فوراً عبر الواتساب.</p>
      </div>`
  };
  await transporter.sendMail(mailOptions);
}

app.listen(PORT, () => {
  console.log(`Fox Games running on http://localhost:${PORT}`);
});
