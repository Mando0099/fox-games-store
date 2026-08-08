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
// 🔐 ENCRYPTION & DECRYPTION HELPERS
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
    return text;
  }
}

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const ENV_MYFATOORAH_TOKEN = process.env.MYFATOORAH_TOKEN;
const ENV_MYFATOORAH_API_URL = (process.env.MYFATOORAH_API_URL || 'https://api-eg.myfatoorah.com').replace(/\/v2\/?$/, '');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM || 'Fox Games <onboarding@resend.dev>';

// Helper to get active gateway with dynamic provider detection (Supports Kashier & MyFatoorah)
async function getActivePaymentGateway() {
  try {
    const snapshot = await db.collection('payment_gateways').where('isActive', '==', true).limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      const creds = data.credentials || {};
      const provider = (data.provider || data.key || doc.id || 'myfatoorah').toLowerCase();
      
      const rawTokenOrKey = data.token || data.apiKey || creds.apiKey || creds.token || creds.secretKey || creds.apiSecretKey;
      const rawSecret = data.secretKey || creds.secretKey || creds.apiSecret || '';
      const rawMerchantId = data.merchantId || creds.merchantId || '';
      
      return {
        id: doc.id,
        provider: provider,
        isLive: true, // فرض اللامحدود للـ Live
        token: decrypt(rawTokenOrKey),
        apiKey: decrypt(rawTokenOrKey),
        secretKey: decrypt(rawSecret),
        merchantId: decrypt(rawMerchantId) || rawMerchantId,
        apiUrl: 'https://api-eg.myfatoorah.com'
      };
    }
  } catch (err) { console.error('Gateway fetch error:', err.message); }

  return {
    id: 'env_fallback',
    provider: 'myfatoorah',
    isLive: true,
    token: ENV_MYFATOORAH_TOKEN,
    secretKey: '',
    apiUrl: ENV_MYFATOORAH_API_URL,
    merchantId: ''
  };
}

function money(amount) {
  const value = Number(amount || 0);
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
        isLive: true,
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
      isActive 
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
      isLive: true, // فرض حقيقي دائماً
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
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'Gateway ID is required.' });

    const docRef = db.collection('payment_gateways').doc(id);
    await docRef.update({
      isLive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ success: true, message: 'تم تثبيت البوابة على الوضع الحقيقي (Live) بنجاح.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 💳 PAYMENT ROUTES (Unified for Kashier & MyFatoorah)
// ==========================================

app.post(['/api/myfatoorah/create-payment', '/api/:gatewayKey/create-payment'], async (req, res) => {
  try {
    const gateway = await getActivePaymentGateway();
    
    if (!gateway) {
      return res.status(500).json({ success: false, message: 'Payment gateway is not configured.' });
    }

    const order = req.body || {};
    const amount = money(order.total);
    const customerName = (order.customer?.name || 'Gamer').substring(0, 50);
    const customerEmail = (order.customer?.email || 'customer@tech-gaming.store');
    const customerPhone = (order.customer?.phone || '01000000000').replace(/\D/g, '').slice(-11);
    const items = Array.isArray(order.items) ? order.items : [];
    const provider = (gateway.provider || '').toLowerCase();

    // 1. معالجة بوابة كاشير (Kashier) على وضع الـ Live حصرياً لتجاوز أي مشاكل Forbidden
    if (provider.includes('kashier')) {
      if (!gateway.merchantId || !gateway.secretKey) {
        return res.status(400).json({ success: false, message: 'Kashier Merchant ID or Secret Key is missing.' });
      }

      const orderId = 'ORD_' + Date.now();
      const currency = 'EGP';
      const mode = 'live'; // فرض وضع لايف حصرياً
      
      const pathString = `/?merchantId=${gateway.merchantId}&orderId=${orderId}&amount=${amount}&currency=${currency}&mode=${mode}`;
      const hash = crypto.createHmac('sha256', gateway.secretKey).update(pathString).digest('hex');

      const baseUrl = 'https://payments.kashier.io'; // الرابط الحقيقي المباشر لصفحة كاشير
      const kashierUrl = `${baseUrl}${pathString}&hash=${hash}&redirect=true`;
      
      return res.json({ success: true, paymentUrl: kashierUrl });
    }

    // 2. معالجة ماي فاتورة (MyFatoorah) مع دعم الفيزا والماستر كارد مباشرة
    if (provider.includes('myfatoorah') || !provider) {
      const tokenToUse = gateway.token || gateway.apiKey || ENV_MYFATOORAH_TOKEN;
      if (!tokenToUse) {
        return res.status(400).json({ success: false, message: 'MyFatoorah Token is missing.' });
      }

      const invoiceBody = {
        InvoiceValue: amount,
        DisplayCurrencyIso: 'EGP',
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: customerPhone,
        CallBackUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=success`,
        ErrorUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=failed`,
        UserDefinedField: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, price: i.price })))
      };

      let executeResponse;
      try {
        executeResponse = await axios.post(`${gateway.apiUrl}/v2/ExecutePayment`, { ...invoiceBody, PaymentMethodId: 2 }, {
          headers: { Authorization: `Bearer ${tokenToUse}`, 'Content-Type': 'application/json' },
          timeout: 30000
        });
      } catch (err) {
        executeResponse = await axios.post(`${gateway.apiUrl}/v2/SendPayment`, invoiceBody, {
          headers: { Authorization: `Bearer ${tokenToUse}`, 'Content-Type': 'application/json' },
          timeout: 30000
        });
      }

      const paymentUrl = executeResponse.data?.Data?.PaymentURL || executeResponse.data?.Data?.InvoiceURL;

      if (executeResponse.data?.IsSuccess && paymentUrl) {
        return res.json({ success: true, paymentUrl: paymentUrl });
      }
      return res.status(400).json({ success: false, message: getMyFatoorahError(executeResponse.data) || 'Payment request rejected.' });
    }

    return res.status(400).json({ success: false, message: `Gateway provider ${provider} is not supported.` });
  } catch (e) {
    console.error('Payment Error:', e.response?.data || e.message);
    return res.status(400).json({ success: false, message: e.response?.data?.Message || e.message });
  }
});

// ==========================================
// 📦 WEBHOOK & EMAIL NOTIFICATIONS
// ==========================================

app.post('/api/myfatoorah/webhook', async (req, res) => {
  try {
    const gateway = await getActivePaymentGateway();
    const invoice = req.body?.Data?.Invoice;
    if (!invoice || String(invoice?.Status).toUpperCase() !== 'PAID') return res.status(200).send('Ignored');

    const verification = await axios.post(`${gateway.apiUrl}/v2/GetPaymentStatus`, { Key: invoice.Id, KeyType: 'InvoiceId' }, { headers: { Authorization: `Bearer ${gateway.token}` } });
    const paymentData = verification.data?.Data || {};
    
    let cartItems = [];
    try {
      cartItems = JSON.parse(paymentData.UserDefinedField || '[]');
    } catch (parseErr) {
      cartItems = [];
    }

    const orderId = paymentData.InvoiceId || invoice.Id;
    const customerEmail = paymentData.CustomerEmail || 'customer@tech-gaming.store';
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

    return res.status(200).send('SUCCESS');
  } catch (error) { 
    console.error('Webhook Error:', error.message);
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
  console.log(`Fox Games running on port ${PORT}`);
});
