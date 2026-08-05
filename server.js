require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const admin = require('firebase-admin');
const crypto = require('crypto');
const cors = require('cors'); // تم إضافة مكتبة الـ CORS لحل مشكلة الاتصال من المتصفح

// Initialize Firebase
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 9000;

// ==========================================
// 🛡️ CORS CONFIGURATION (حل مشكلة الحظر)
// ==========================================
app.use(cors({
  origin: '*', // السماح بالاتصال من أي دومين (يمكنك تخصيصه لاحقاً إلى 'https://tech-gaming.store')
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🔐 ENCRYPTION & DECRYPTION HELPERS (AES-256)
// ==========================================
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'foxgamessecretkey12345678901234'; // Must be 32 bytes/chars
const ALGORITHM = 'aes-256-cbc';

function encrypt(text) {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text || '';
  try {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const [ivHex, encryptedText] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return text;
  }
}

// Fallback .env MyFatoorah Settings
const ENV_MYFATOORAH_TOKEN = process.env.MYFATOORAH_TOKEN;
const ENV_MYFATOORAH_API_URL = (process.env.MYFATOORAH_API_URL || 'https://api-eg.myfatoorah.com').replace(/\/v2\/?$/, '');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

// Resend email settings
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Fox Games <onboarding@resend.dev>';

// Helper to get current active gateway from DB (Dynamic Demo/Live & Multi-gateway)
async function getActivePaymentGateway() {
  try {
    const snapshot = await db.collection('payment_gateways').where('isActive', '==', true).limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();

      const isLive = Boolean(data.isLive);
      const provider = (data.provider || data.name || 'myfatoorah').toLowerCase();

      let defaultSandbox = 'https://apitest.myfatoorah.com';
      let defaultLive = 'https://api-eg.myfatoorah.com';

      if (provider === 'paymob') {
        defaultSandbox = 'https://accept.paymob.com/api';
        defaultLive = 'https://accept.paymob.com/api';
      } else if (provider === 'kashier') {
        defaultSandbox = 'https://test-iframe.kashier.io';
        defaultLive = 'https://iframe.kashier.io';
      }

      const sandboxUrl = data.sandboxUrl || defaultSandbox;
      const liveUrl = data.liveUrl || defaultLive;
      const targetApiUrl = (isLive ? liveUrl : sandboxUrl).replace(/\/v2\/?$/, '');

      return {
        id: doc.id,
        name: data.name || provider,
        provider: provider,
        isLive: isLive,
        token: decrypt(data.token || data.apiKey),
        apiKey: decrypt(data.apiKey || data.token),
        secretKey: decrypt(data.secretKey),
        webhookSecret: decrypt(data.webhookSecret),
        apiUrl: targetApiUrl,
        sandboxUrl: sandboxUrl,
        liveUrl: liveUrl,
        merchantId: data.merchantId || '',
        iframeId: data.iframeId || ''
      };
    }
  } catch (err) {
    console.error('Error fetching active payment gateway from Firestore:', err.message);
  }

  // Fallback to default .env config
  return {
    id: 'env_default',
    name: 'myfatoorah',
    provider: 'myfatoorah',
    isLive: true,
    token: ENV_MYFATOORAH_TOKEN,
    apiKey: ENV_MYFATOORAH_TOKEN,
    apiUrl: ENV_MYFATOORAH_API_URL,
    sandboxUrl: 'https://apitest.myfatoorah.com',
    liveUrl: ENV_MYFATOORAH_API_URL,
    merchantId: '',
    secretKey: '',
    webhookSecret: ''
  };
}

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

async function myfatoorahPost(gatewayConfig, endpoint, body) {
  const token = gatewayConfig.token;
  const apiUrl = gatewayConfig.apiUrl;

  return axios.post(`${apiUrl}/v2/${endpoint}`, body, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
}

// ==========================================
// 🛠️ ADMIN GATEWAY MANAGEMENT APIs
// ==========================================

app.get('/api/admin/payment-gateways', async (req, res) => {
  try {
    const snapshot = await db.collection('payment_gateways').get();
    const gateways = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      gateways.push({
        id: doc.id,
        name: data.name,
        provider: data.provider || 'myfatoorah',
        isLive: Boolean(data.isLive),
        isActive: Boolean(data.isActive),
        apiUrl: data.apiUrl || '',
        sandboxUrl: data.sandboxUrl || '',
        liveUrl: data.liveUrl || '',
        merchantId: data.merchantId || '',
        tokenSet: !!(data.token || data.apiKey),
        secretKeySet: !!data.secretKey,
        webhookSecretSet: !!data.webhookSecret,
        updatedAt: data.updatedAt
      });
    });

    return res.json({ success: true, gateways });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/payment-gateways', async (req, res) => {
  try {
    const { 
      id, name, provider, apiUrl, sandboxUrl, liveUrl, 
      token, secretKey, apiKey, merchantId, iframeId, webhookSecret, 
      isActive, isLive 
    } = req.body;
    
    const docId = id || (provider ? provider.toLowerCase() : (name ? name.toLowerCase() : 'gateway_' + Date.now()));

    if (isActive) {
      const allGateways = await db.collection('payment_gateways').get();
      const batch = db.batch();
      allGateways.forEach(doc => {
        batch.update(doc.ref, { isActive: false });
      });
      await batch.commit();
    }

    const docRef = db.collection('payment_gateways').doc(docId);
    const existingDoc = await docRef.get();
    const existingData = existingDoc.exists ? existingDoc.data() : {};

    const inputToken = token || apiKey;

    const gatewayPayload = {
      name: name || existingData.name || 'MyFatoorah',
      provider: provider || existingData.provider || 'myfatoorah',
      sandboxUrl: sandboxUrl || existingData.sandboxUrl || 'https://apitest.myfatoorah.com',
      liveUrl: liveUrl || existingData.liveUrl || 'https://api-eg.myfatoorah.com',
      merchantId: merchantId ?? existingData.merchantId ?? '',
      iframeId: iframeId ?? existingData.iframeId ?? '',
      isActive: isActive !== undefined ? Boolean(isActive) : (existingData.isActive || false),
      isLive: isLive !== undefined ? Boolean(isLive) : (existingData.isLive || false),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (inputToken) gatewayPayload.token = encrypt(inputToken);
    if (secretKey) gatewayPayload.secretKey = encrypt(secretKey);
    if (webhookSecret) gatewayPayload.webhookSecret = encrypt(webhookSecret);

    await docRef.set(gatewayPayload, { merge: true });

    return res.json({
      success: true,
      message: 'تم حفظ وتشفير بيانات بوابة الدفع بنجاح!',
      gatewayId: docId
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/payment-gateways/activate', async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'Gateway ID is required.' });

    const allGateways = await db.collection('payment_gateways').get();
    const batch = db.batch();

    allGateways.forEach(doc => {
      batch.update(doc.ref, { isActive: doc.id === id });
    });

    await batch.commit();

    return res.json({ success: true, message: `تم تفعيل البوابة (${id}) وباقي البوابات معطلة الآن.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/payment-gateways/toggle-live', async (req, res) => {
  try {
    const { id, isLive } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'Gateway ID is required.' });

    const docRef = db.collection('payment_gateways').doc(id);
    await docRef.update({
      isLive: Boolean(isLive),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const modeName = isLive ? 'الوضع الحقيقي (Live)' : 'وضع التجربة (Demo)';
    return res.json({ success: true, message: `تم تغيير وضع البوابة إلى: ${modeName}` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 💳 STORE PAYMENT ROUTES
// ==========================================

app.get('/api/myfatoorah/payment-methods', async (req, res) => {
  try {
    const gateway = await getActivePaymentGateway();
    const amount = money(req.query.amount || 1);

    const initiateResponse = await myfatoorahPost(gateway, 'InitiatePayment', {
      InvoiceAmount: amount,
      CurrencyIso: 'EGP'
    });

    if (!initiateResponse.data?.IsSuccess) {
      return res.status(400).json({
        success: false,
        message: getMyFatoorahError(initiateResponse.data)
      });
    }

    return res.json({
      success: true,
      methods: initiateResponse.data?.Data?.PaymentMethods || []
    });
  } catch (e) {
    console.error('Payment methods error:', e.response?.data || e.message);
    return res.status(400).json({
      success: false,
      message: getMyFatoorahError(e.response?.data) || e.message
    });
  }
});

app.post('/api/myfatoorah/create-payment', async (req, res) => {
  try {
    const gateway = await getActivePaymentGateway();

    if (!gateway.token) {
      return res.status(500).json({ success: false, message: 'Missing payment token/API key for active gateway.' });
    }

    const order = req.body || {};
    const amount = money(order.total);
    const customerName = order.customer?.name || 'Fox Games Customer';
    const customerPhone = cleanPhone(order.customer?.phone || '');
    const customerEmail = order.customer?.email || order.email || 'customer@foxgames.local';
    const items = Array.isArray(order.items) ? order.items : [];

    console.log(`[MODE: ${gateway.isLive ? 'LIVE' : 'DEMO'}] ACTIVE_GATEWAY_URL:`, gateway.apiUrl);

    const initiateResponse = await myfatoorahPost(gateway, 'InitiatePayment', {
      InvoiceAmount: amount,
      CurrencyIso: 'EGP'
    });

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

    const selectedPaymentMethodId = Number(order.paymentMethodId || 0);
    const selectedMethod = selectedPaymentMethodId
      ? paymentMethods.find(m => Number(m.PaymentMethodId) === selectedPaymentMethodId)
      : null;

    const defaultMethod =
      selectedMethod ||
      paymentMethods.find(m => /visa|master|card/i.test(`${m.PaymentMethodEn || ''} ${m.PaymentMethodAr || ''}`)) ||
      paymentMethods[0];

    const paymentMethodId = Number(defaultMethod.PaymentMethodId);

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

    const executeResponse = await myfatoorahPost(gateway, 'ExecutePayment', executeBody);

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
      message: getMyFatoorahError(executeResponse.data) || 'Failed to create payment execution link.'
    });
  } catch (e) {
    console.error('=== PAYMENT CREATION ERROR DETAILS ===');
    console.error('Status:', e.response?.status);
    console.error('Data:', JSON.stringify(e.response?.data, null, 2));
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
    const gateway = await getActivePaymentGateway();
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

    const verification = await myfatoorahPost(gateway, 'GetPaymentStatus', {
      Key: invoiceId,
      KeyType: 'InvoiceId'
    });

    const paymentData = verification.data?.Data || {};
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

        if (!productId) continue;

        const codesRef = db.collection('productCodes');
        const availableCodeQuery = codesRef
          .where('productId', '==', productId)
          .where('status', '==', 'available')
          .limit(1);

        const codeSnapshot = await transaction.get(availableCodeQuery);

        if (codeSnapshot.empty) {
          console.error('No available code for product:', productId, item.name);
          continue;
        }

        const codeDoc = codeSnapshot.docs[0];
        const codeData = codeDoc.data();

        transaction.update(codeDoc.ref, {
          status: 'used',
          orderId,
          customerEmail,
          usedAt: admin.firestore.FieldValue.serverTimestamp(),
          purchasedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        purchasedCodes.push({
          productName: item.name || productId,
          code: codeData.code,
          codeDocId: codeDoc.id,
          productId
        });
      }
    });

    if (!purchasedCodes.length) {
      console.error('Payment paid, but no codes were pulled from Firebase.');
      return res.status(200).send('No codes available');
    }

    await db.collection('orders').doc(String(orderId)).set({
      orderId: String(orderId),
      invoiceId: String(orderId),
      customerEmail,
      customerName: paymentData.CustomerName || req.body?.Data?.Customer?.Name || '',
      customerPhone: paymentData.CustomerMobile || req.body?.Data?.Customer?.Mobile || '',
      amount: Number(paymentData.InvoiceValue || paymentData.InvoiceDisplayValue || req.body?.Data?.Amount?.ValueInBaseCurrency || 0),
      currency: paymentData.InvoiceDisplayCurrencyIso || paymentData.CurrencyIso || 'EGP',
      orderStatus: 'paid',
      paymentStatus: 'paid',
      paymentProvider: gateway.name || 'myfatoorah',
      isLive: gateway.isLive,
      items: cartItems,
      codes: purchasedCodes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await db.collection('transactions').doc(String(orderId)).set({
      orderId: String(orderId),
      invoiceId: String(orderId),
      transactionId: paymentData.InvoiceTransactions?.[0]?.TransactionId || req.body?.Data?.Invoice?.Id || '',
      customerEmail,
      amount: Number(paymentData.InvoiceValue || paymentData.InvoiceDisplayValue || req.body?.Data?.Amount?.ValueInBaseCurrency || 0),
      currency: paymentData.InvoiceDisplayCurrencyIso || paymentData.CurrencyIso || 'EGP',
      paymentStatus: 'paid',
      provider: gateway.name || 'myfatoorah',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await sendCodesEmail(customerEmail, orderId, purchasedCodes);
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

  await axios.post(
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
  console.log(`Fallback MyFatoorah API URL: ${ENV_MYFATOORAH_API_URL}`);
});
