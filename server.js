require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 9000;

// MyFatoorah settings
// Render value should be WITHOUT /v2, for example:
// Live Egypt: https://api-eg.myfatoorah.com
// Test: https://apitest.myfatoorah.com
const MYFATOORAH_TOKEN = process.env.MYFATOORAH_TOKEN;
const MYFATOORAH_API_URL = (process.env.MYFATOORAH_API_URL || 'https://api-eg.myfatoorah.com').replace(/\/v2\/?$/, '');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Resend email settings
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Fox Games <onboarding@resend.dev>';


function money(amount) {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) throw new Error('Invalid payment amount.');
  return Number(value.toFixed(2));
}

function cleanPhone(phone = '') {
  return String(phone).replace(/[^\d+]/g, '').slice(0, 20);
}

function getMyFatoorahError(data) {
  if (!data) return 'Unknown MyFatoorah error.';
  if (typeof data === 'string') return data;
  if (data.Message) return data.Message;
  if (Array.isArray(data.ValidationErrors) && data.ValidationErrors.length) {
    return data.ValidationErrors.map(e => e.Error || e.Name || JSON.stringify(e)).join(' | ');
  }
  if (data.Data?.Message) return data.Data.Message;
  return JSON.stringify(data);
}

async function myfatoorahPost(endpoint, body) {
  return axios.post(`${MYFATOORAH_API_URL}/v2/${endpoint}`, body, {
    headers: {
      Authorization: `Bearer ${MYFATOORAH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
}

app.post('/api/myfatoorah/create-payment', async (req, res) => {
  try {
    if (!MYFATOORAH_TOKEN) {
      return res.status(500).json({ success: false, message: 'Missing MyFatoorah token in .env file.' });
    }

    const order = req.body || {};
    const amount = money(order.total);
    const customerName = order.customer?.name || 'Fox Games Customer';
    const customerPhone = cleanPhone(order.customer?.phone || '');
    const customerEmail = order.customer?.email || order.email || 'customer@foxgames.local';
    const items = Array.isArray(order.items) ? order.items : [];

    console.log('MYFATOORAH_BASE_URL:', MYFATOORAH_API_URL);
    console.log('Initiating payment methods:', `${MYFATOORAH_API_URL}/v2/InitiatePayment`);

    // Step 1: get a valid PaymentMethodId for this account/currency instead of using 0
    const initiateResponse = await myfatoorahPost('InitiatePayment', {
      InvoiceAmount: amount,
      CurrencyIso: 'EGP'
    });

    console.log('InitiatePayment response:', JSON.stringify(initiateResponse.data, null, 2));

    if (!initiateResponse.data?.IsSuccess) {
      return res.status(400).json({
        success: false,
        message: getMyFatoorahError(initiateResponse.data)
      });
    }

    const paymentMethods = initiateResponse.data?.Data?.PaymentMethods || [];
    if (!paymentMethods.length) {
      return res.status(400).json({
        success: false,
        message: 'No payment methods returned from MyFatoorah. Check account/currency activation.'
      });
    }

    const selectedMethod = paymentMethods.find(m => m.IsDirectPayment === false) || paymentMethods[0];
    const paymentMethodId = selectedMethod.PaymentMethodId;

    console.log('Selected PaymentMethodId:', paymentMethodId, selectedMethod.PaymentMethodEn || selectedMethod.PaymentMethodAr);
    console.log('Sending request to MyFatoorah URL:', `${MYFATOORAH_API_URL}/v2/ExecutePayment`);

    const executeBody = {
      PaymentMethodId: paymentMethodId,
      InvoiceValue: amount,
      DisplayCurrencyIso: 'EGP',
      CustomerEmail: customerEmail,
      CustomerName: customerName,
      CustomerMobile: customerPhone,
      CallBackUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=success`,
      ErrorUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=failed`,
      UserDefinedField: JSON.stringify(items.map(item => ({
        id: item.id || item.productId || '',
        name: item.name || '',
        category: item.category || '',
        price: item.price || 0
      })))
    };

    console.log('ExecutePayment body:', JSON.stringify(executeBody, null, 2));

    const executeResponse = await myfatoorahPost('ExecutePayment', executeBody);

    console.log('ExecutePayment response:', JSON.stringify(executeResponse.data, null, 2));

    if (executeResponse.data?.IsSuccess && executeResponse.data?.Data?.PaymentURL) {
      return res.json({
        success: true,
        invoiceId: executeResponse.data.Data.InvoiceId,
        paymentMethodId,
        paymentUrl: executeResponse.data.Data.PaymentURL
      });
    }

    return res.status(400).json({
      success: false,
      message: getMyFatoorahError(executeResponse.data) || 'Failed to create MyFatoorah execution link.'
    });
  } catch (e) {
    console.error('=== MYFATOORAH FULL ERROR DETAILS ===');
    console.error('Status:', e.response?.status);
    console.error('Data from MyFatoorah:', JSON.stringify(e.response?.data, null, 2));
    console.error('Message:', e.message);
    console.error('======================================');

    return res.status(400).json({
      success: false,
      message: getMyFatoorahError(e.response?.data) || e.message
    });
  }
});

app.post('/api/myfatoorah/webhook', async (req, res) => {
  console.log('WEBHOOK BODY:', JSON.stringify(req.body, null, 2));

  try {
    const invoice = req.body?.Data?.Invoice;
    const status = String(invoice?.Status || '').toUpperCase();

    if (!invoice || status !== 'PAID') {
      console.log('Webhook ignored. Invoice status:', status || 'NO_STATUS');
      return res.status(200).send('Ignored');
    }

    const invoiceId = invoice.Id;
    if (!invoiceId) {
      console.error('Webhook paid but missing invoice id.');
      return res.status(200).send('Missing invoice id');
    }

    const verification = await myfatoorahPost('GetPaymentStatus', {
      Key: invoiceId,
      KeyType: 'InvoiceId'
    });

    const paymentData = verification.data?.Data || {};
    console.log('VERIFIED PAYMENT:', JSON.stringify(paymentData, null, 2));

    const customerEmail =
      paymentData.CustomerEmail ||
      req.body?.Data?.Customer?.Email ||
      invoice.CustomerEmail ||
      '';

    let cartItems = [];
    try {
      cartItems = JSON.parse(paymentData.UserDefinedField || invoice.UserDefinedField || '[]');
    } catch (parseErr) {
      console.error('Could not parse UserDefinedField:', parseErr.message);
      cartItems = [];
    }

    console.log('CART ITEMS FROM PAYMENT:', JSON.stringify(cartItems, null, 2));

    if (!customerEmail || customerEmail === 'customer@foxgames.local') {
      console.error('No valid customer email found. Codes cannot be delivered.');
      return res.status(200).send('No customer email');
    }

    if (!Array.isArray(cartItems) || !cartItems.length) {
      console.error('No cart items found in payment UserDefinedField.');
      return res.status(200).send('No cart items');
    }

    const orderId = paymentData.InvoiceId || invoiceId;
    const purchasedCodes = [];

    await db.runTransaction(async (transaction) => {
      for (const item of cartItems) {
        const productId = item.id || item.productId;

        if (!productId) {
          console.error('Item missing product id:', item);
          continue;
        }

        const codesRef = db.collection('products').doc(productId).collection('digital_codes');
        const availableCodeQuery = codesRef.where('isUsed', '==', false).limit(1);
        const codeSnapshot = await transaction.get(availableCodeQuery);

        if (codeSnapshot.empty) {
          console.error('No available code for product:', productId, item.name);
          continue;
        }

        const codeDoc = codeSnapshot.docs[0];
        const codeData = codeDoc.data();

        transaction.update(codeDoc.ref, {
          isUsed: true,
          orderId,
          customerEmail,
          purchasedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        purchasedCodes.push({
          productName: item.name || productId,
          code: codeData.code
        });
      }
    });

    console.log('PURCHASED CODES:', JSON.stringify(purchasedCodes, null, 2));

    if (!purchasedCodes.length) {
      console.error('Payment paid, but no codes were pulled from Firebase.');
      return res.status(200).send('No codes available');
    }

    await sendCodesEmail(customerEmail, orderId, purchasedCodes);
    console.log('Codes email sent to:', customerEmail);

    return res.status(200).send('SUCCESS');

  } catch (error) {
    console.error('Webhook processing error:', error.response?.data || error.message);
    return res.status(500).send('Internal Server Error');
  }
});

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
    from: RESEND_FROM,
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

  if (!RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY in Render Environment Variables.');
  }

  const resendResponse = await axios.post(
    'https://api.resend.com/emails',
    {
      from: RESEND_FROM,
      to: [email],
      subject: mailOptions.subject,
      html: mailOptions.html
    },
    {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  console.log('RESEND RESPONSE:', JSON.stringify(resendResponse.data, null, 2));
}
app.get('/test-email', async (req, res) => {
  try {
    await sendCodesEmail('namy9585@gmail.com', 'TEST-001', [
      { productName: 'PUBG UC Test', code: 'TEST-CODE-1234' }
    ]);

    res.send('Email sent successfully');
  } catch (err) {
    console.error('TEST EMAIL ERROR:', err);
    res.status(500).send(err.message);
  }
});
app.listen(PORT, () => {
  console.log(`Fox Games running on http://localhost:${PORT}`);
  console.log(`MyFatoorah API URL: ${MYFATOORAH_API_URL}`);
});
