require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');
const admin = require('firebase-admin');
const crypto = require('crypto');

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🔐 ENCRYPTION & DECRYPTION HELPERS (AES-256)
// ==========================================
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'foxgamessecretkey12345678901234';
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

const ENV_MYFATOORAH_TOKEN = process.env.MYFATOORAH_TOKEN;
const ENV_MYFATOORAH_API_URL = (process.env.MYFATOORAH_API_URL || 'https://api-eg.myfatoorah.com').replace(/\/v2\/?$/, '');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Fox Games <onboarding@resend.dev>';

// Helper to get active gateway dynamically
async function getActivePaymentGateway() {
  try {
    const snapshot = await db.collection('payment_gateways').where('isActive', '==', true).limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      const creds = data.credentials || {};

      const isLive = Boolean(data.isLive);
      const provider = (data.provider || data.name || doc.id || 'myfatoorah').toLowerCase();

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

      const rawTokenOrKey = data.token || data.apiKey || creds.apiKey || creds.token || creds.secretKey || creds.apiSecretKey;
      const rawSecret = data.secretKey || creds.secretKey || '';
      const rawMerchantId = data.merchantId || creds.merchantId || '';

      return {
        id: doc.id,
        name: data.name || provider,
        provider: provider,
        isLive: isLive,
        token: decrypt(rawTokenOrKey),
        apiKey: decrypt(rawTokenOrKey),
        secretKey: decrypt(rawSecret),
        webhookSecret: decrypt(data.webhookSecret || creds.webhookSecret),
        apiUrl: targetApiUrl,
        sandboxUrl: sandboxUrl,
        liveUrl: liveUrl,
        merchantId: decrypt(rawMerchantId) || rawMerchantId,
        iframeId: data.iframeId || creds.iframeId || ''
      };
    }
  } catch (err) {
    console.error('Error fetching active payment gateway from Firestore:', err.message);
  }

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
        tokenSet: !!(data.token || data.apiKey || data.credentials),
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
// 💳 UNIFIED STORE PAYMENT ROUTE (Supports MyFatoorah SendPayment & Kashier)
// ==========================================

app.post('/api/:gatewayKey/create-payment', async (req, res) => {
  try {
    const gatewayKey = req.params.gatewayKey.toLowerCase();
    const gateway = await getActivePaymentGateway();

    const order = req.body || {};
    const amount = money(order.total);
    const customerName = order.customer?.name || 'Fox Games Customer';
    const customerPhone = cleanPhone(order.customer?.phone || '');
    const customerEmail = order.customer?.email || order.email || 'customer@foxgames.local';
    const items = Array.isArray(order.items) ? order.items : [];

    // 1. معالجة ماي فاتورة باستخدام SendPayment ليعرض كل وسائل الدفع المتاحة للعميل
    if (gatewayKey === 'myfatoorah' || gateway.provider === 'myfatoorah') {
      if (!gateway.token) {
        return res.status(500).json({ success: false, message: 'Missing payment token/API key for active gateway.' });
      }

      const invoiceBody = {
        InvoiceValue: amount,
        DisplayCurrencyIso: 'EGP',
        CustomerEmail: customerEmail,
        CustomerName: customerName,
        CustomerMobile: customerPhone,
        CallBackUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=success`,
        ErrorUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=failed`,
        UserDefinedField: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, price: i.price })))
      };

      const executeResponse = await myfatoorahPost(gateway, 'SendPayment', invoiceBody);

      if (executeResponse.data?.IsSuccess && executeResponse.data?.Data?.InvoiceURL) {
        return res.json({ success: true, paymentUrl: executeResponse.data.Data.InvoiceURL });
      }
      
      return res.status(400).json({ success: false, message: getMyFatoorahError(executeResponse.data) });
    }

    // 2. معالجة بوابة Kashier (كاشير) بدون مشاكل الـ undefined
    if (gatewayKey === 'kashier' || gateway.provider === 'kashier') {
      const merchantId = gateway.merchantId;
      const secretKey = gateway.secretKey;

      if (!merchantId || !secretKey) {
        return res.status(500).json({ success: false, message: 'Missing Kashier Merchant ID or Secret Key.' });
      }

      const orderId = 'ORD_' + Date.now();
      const currency = 'EGP';
      const mode = gateway.isLive ? 'live' : 'test';

      const baseUrl = mode === 'live' ? 'https://iframe.kashier.io' : 'https://test-iframe.kashier.io';
      const pathString = `/?merchantId=${merchantId}&orderId=${orderId}&amount=${amount}&currency=${currency}`;
      const hash = crypto.createHmac('sha256', secretKey).update(pathString).digest('hex');

      const kashierUrl = `${baseUrl}${pathString}&hash=${hash}&mode=${mode}&redirect=true`;

      return res.json({ success: true, paymentUrl: kashierUrl });
    }

    return res.status(400).json({ success: false, message: `Gateway ${gatewayKey} is not supported.` });

  } catch (e) {
    console.error('Unified Payment Creation Error:', e.response?.data || e.message);
    return res.status(400).json({ success: false, message: e.response?.data?.message || e.message });
  }
});

// ==========================================
// 📦 WEBHOOKS & EMAIL NOTIFICATIONS
// ==========================================

app.post('/api/myfatoorah/webhook', async (req, res) => {
  try {
    const gateway = await getActivePaymentGateway();
    const invoice = req.body?.Data?.Invoice;
    const status = String(invoice?.Status || '').toUpperCase();

    if (!invoice || status !== 'PAID') {
      return res.status(200).send('Ignored');
    }

    const invoiceId = invoice.Id;
    if (!invoiceId) return res.status(200).send('Missing invoice id');

    const verification = await myfatoorahPost(gateway, 'GetPaymentStatus', {
      Key: invoiceId,
      KeyType: 'InvoiceId'
    });

    const paymentData = verification.data?.Data || {};
    const customerEmail = paymentData.CustomerEmail || invoice.CustomerEmail || '';

    let cartItems = [];
    try {
      cartItems = JSON.parse(paymentData.UserDefinedField || invoice.UserDefinedField || '[]');
    } catch (parseErr) {
      cartItems = [];
    }

    if (!customerEmail || !cartItems.length) return res.status(200).send('Invalid data');

    const orderId = paymentData.InvoiceId || invoiceId;
    const purchasedCodes = [];

    await db.runTransaction(async (transaction) => {
      for (const item of cartItems) {
        const productId = item.id || item.productId;
        if (!productId) continue;

        const codesRef = db.collection('productCodes');
        const availableCodeQuery = codesRef.where('productId', '==', productId).where('status', '==', 'available').limit(1);
        const codeSnapshot = await transaction.get(availableCodeQuery);

        if (codeSnapshot.empty) continue;

        const codeDoc = codeSnapshot.docs[0];
        const codeData = codeDoc.data();

        transaction.update(codeDoc.ref, {
          status: 'used',
          orderId,
          customerEmail,
          usedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        purchasedCodes.push({
          productName: item.name || productId,
          code: codeData.code
        });
      }
    });

    if (!purchasedCodes.length) return res.status(200).send('No codes available');

    await db.collection('orders').doc(String(orderId)).set({
      orderId: String(orderId),
      customerEmail,
      amount: Number(paymentData.InvoiceValue || 0),
      currency: paymentData.CurrencyIso || 'EGP',
      orderStatus: 'paid',
      paymentStatus: 'paid',
      codes: purchasedCodes,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await sendCodesEmail(customerEmail, orderId, purchasedCodes);
    return res.status(200).send('SUCCESS');

  } catch (error) {
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
      </div>`
  };

  if (!RESEND_API_KEY) return;

  await axios.post('https://api.resend.com/emails', {
    from: RESEND_FROM,
    to: [email],
    subject: mailOptions.subject,
    html: mailOptions.html
  }, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 30000
  });
}

app.listen(PORT, () => {
  console.log(`Fox Games running on http://localhost:${PORT}`);
});
