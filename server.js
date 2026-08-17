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
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html', 'htm']
}));

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
const RESEND_FROM = process.env.RESEND_FROM || 'Tech Gaming <onboarding@resend.dev>';

// ==========================================
// ⚙️ DYNAMIC PAYMENT GATEWAY RETRIEVER
// ==========================================
async function getActivePaymentGateway() {
  try {
    const snapshot = await db.collection('payment_gateways').where('isActive', '==', true).limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      const creds = data.credentials || {};
      const provider = (data.provider || data.key || doc.id || 'myfatoorah').toLowerCase();
      
      const rawTokenOrKey = data.token || data.apiKey || creds.apiKey || creds.token || creds.secretKey || creds.apiSecretKey;
      const rawSecret = data.secretKey || creds.secretKey || creds.apiSecret || creds.clientSecret || data.clientSecret || '';
      const rawClientId = data.clientId || creds.clientId || '';
      const rawMerchantId = data.merchantId || creds.merchantId || '';
      
      return {
        id: doc.id,
        provider: provider,
        isLive: true,
        token: decrypt(rawTokenOrKey),
        apiKey: decrypt(rawTokenOrKey),
        clientId: decrypt(rawClientId) || rawClientId,
        secretKey: decrypt(rawSecret) || rawSecret,
        merchantId: decrypt(rawMerchantId) || rawMerchantId,
        apiUrl: data.liveUrl || 'https://api-eg.myfatoorah.com'
      };
    }
  } catch (err) { console.error('Gateway fetch error:', err.message); }

  return {
    id: 'env_fallback',
    provider: 'myfatoorah',
    isLive: true,
    token: ENV_MYFATOORAH_TOKEN,
    clientId: '',
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
// 🛠️ ADMIN GATEWAY & MANAGEMENT APIs
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
        tokenSet: !!(data.token || data.apiKey || data.clientId || data.credentials),
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
      token, secretKey, apiKey, clientId, clientSecret, merchantId, iframeId, webhookSecret, 
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
    const inputClientId = clientId;
    const inputSecretKey = secretKey || clientSecret;

    const gatewayPayload = {
      name: name || existingData.name || 'Payment Gateway',
      provider: provider || existingData.provider || 'myfatoorah',
      sandboxUrl: sandboxUrl || existingData.sandboxUrl || '',
      liveUrl: liveUrl || existingData.liveUrl || '',
      merchantId: merchantId ?? existingData.merchantId ?? '',
      iframeId: iframeId ?? existingData.iframeId ?? '',
      isActive: isActive !== undefined ? Boolean(isActive) : (existingData.isActive || false),
      isLive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (inputToken) gatewayPayload.token = encrypt(inputToken);
    if (inputClientId) gatewayPayload.clientId = encrypt(inputClientId);
    if (inputSecretKey) gatewayPayload.secretKey = encrypt(inputSecretKey);
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

app.delete('/api/admin/payment-gateways/:id', async (req, res) => {
  try {
    await db.collection('payment_gateways').doc(req.params.id).delete();
    return res.json({ success: true, message: 'تم حذف بوابة الدفع بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/admin/products/:id', async (req, res) => {
  try {
    await db.collection('products').doc(req.params.id).set({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return res.json({ success: true, message: 'تم تحديث المنتج بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    await db.collection('products').doc(req.params.id).delete();
    return res.json({ success: true, message: 'تم حذف المنتج بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/admin/coupons/:id', async (req, res) => {
  try {
    await db.collection('coupons').doc(req.params.id).set({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return res.json({ success: true, message: 'تم تحديث الكوبون بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/admin/coupons/:id', async (req, res) => {
  try {
    await db.collection('coupons').doc(req.params.id).delete();
    return res.json({ success: true, message: 'تم حذف الكوبون بنجاح' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// 💳 FAWATERAK HANDLER (OAUTH & FULL DATA)
// ==========================================
async function handleFawaterakPayment(gateway, order, res) {
  const clientId = (gateway.clientId || '').trim();
  const clientSecret = (gateway.secretKey || '').trim();
  const providerKey = gateway.merchantId || 'FAWATERAK.29879';

  if (!clientId || !clientSecret) {
    return res.status(400).json({ success: false, message: 'Fawaterak Client ID or Client Secret is missing.' });
  }

  try {
    // 1. طلب رمز الوصول (OAuth) مع دعم Form-Urlencoded و JSON
    const tokenParams = new URLSearchParams();
    tokenParams.append('client_id', clientId);
    tokenParams.append('client_secret', clientSecret);
    tokenParams.append('grant_type', 'client_credentials');

    let tokenRes;
    try {
      tokenRes = await axios.post('https://app.fawaterk.com/oauth/token', tokenParams.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 30000
      });
    } catch (authErr) {
      tokenRes = await axios.post('https://app.fawaterk.com/oauth/token', {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
    }

    const accessToken = tokenRes.data?.access_token || tokenRes.data?.data?.access_token;
    if (!accessToken) {
      return res.status(400).json({ success: false, message: 'فشل المصادقة مع بوابة فواتيرك (OAuth Token Error).' });
    }

    const orderId = 'ORD_' + Date.now();
    const amount = money(order.total);
    const fullName = (order.customer?.name || 'Gamer Client').trim();
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || 'Gamer';
    const lastName = nameParts.slice(1).join(' ') || 'Customer';
    const customerEmail = order.customer?.email || 'customer@tech-gaming.store';
    const customerPhone = cleanPhone(order.customer?.phone || '01000000000');
    const items = Array.isArray(order.items) ? order.items : [];
    const firstProductName = items.length > 0 ? (items[0].name || '') : '';

    // 2. تجهيز كائن الفاتورة
    const fawaterakBody = {
      cartTotal: amount,
      currency: 'EGP',
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: customerEmail,
        phone: customerPhone,
        address: 'Egypt'
      },
      redirectionUrls: {
        successUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=success&paymentId=${orderId}&productName=${encodeURIComponent(firstProductName)}`,
        failUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=failed&paymentId=${orderId}`,
        pendingUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=pending&paymentId=${orderId}`
      },
      cartItems: items.map(i => ({
        name: i.name || 'منتج رقمي',
        price: money(i.price),
        quantity: i.quantity || 1
      })),
      payLoad: { orderId: orderId, providerKey: providerKey }
    };

    await db.collection('pending_orders').doc(orderId).set({
      orderId,
      customerEmail,
      amount,
      currency: 'EGP',
      items,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 3. إنشاء رابط الدفع
    let response;
    try {
      response = await axios.post('https://app.fawaterk.com/api/v2/createInvoiceLink', fawaterakBody, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    } catch (apiErr) {
      response = await axios.post('https://app.fawaterk.com/api/v2/invoice/initiate-payment', fawaterakBody, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
    }

    const paymentUrl = response.data?.data?.url || response.data?.data?.payment_url;
    if (paymentUrl) {
      return res.json({ success: true, paymentUrl });
    }
    return res.status(400).json({ success: false, message: response.data?.message || 'فشل إنشاء رابط الدفع من فواتيرك.' });
  } catch (err) {
    console.error('Fawaterak OAuth/Payment Error:', err.response?.data || err.message);
    const errorMsg = err.response?.data?.message || err.response?.data?.error_description || err.message;
    return res.status(400).json({ success: false, message: errorMsg });
  }
}

// ==========================================
// 💳 MAIN DYNAMIC PAYMENT ROUTE
// ==========================================

app.post(['/api/myfatoorah/create-payment', '/api/create-payment', '/api/:gatewayKey/create-payment'], async (req, res) => {
  try {
    const gateway = await getActivePaymentGateway();
    
    if (!gateway) {
      return res.status(500).json({ success: false, message: 'Payment gateway is not configured.' });
    }

    const order = req.body || {};
    const amount = money(order.total);
    const customerName = (order.customer?.name || 'Gamer').substring(0, 50);
    const customerEmail = (order.customer?.email || 'customer@tech-gaming.store');
    const customerPhone = cleanPhone(order.customer?.phone || '01000000000');
    const items = Array.isArray(order.items) ? order.items : [];
    const provider = (gateway.provider || '').toLowerCase();
    const firstProductName = items.length > 0 ? (items[0].name || '') : '';

    // 1. FAWATERAK
    if (provider.includes('fawaterak') || provider.includes('fawaterk')) {
      return await handleFawaterakPayment(gateway, order, res);
    }

    // 2. KASHIER
    if (provider.includes('kashier')) {
      const paymentApiKey = gateway.token || gateway.apiKey;
      if (!gateway.merchantId || !paymentApiKey) {
        return res.status(400).json({
          success: false,
          message: 'Kashier Merchant ID or Payment API Key is missing.'
        });
      }

      const orderId = 'ORD_' + Date.now();
      const currency = 'EGP';
      const mode = 'live';
      const amountForKashier = Number(amount).toFixed(2);
      const merchantRedirect = `${PUBLIC_BASE_URL}/payment-result.html?productName=${encodeURIComponent(firstProductName)}`;

      await db.collection('pending_orders').doc(orderId).set({
        orderId,
        customerEmail,
        amount: amountForKashier,
        currency,
        items,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const hashSource = `/?payment=${gateway.merchantId}.${orderId}.${amountForKashier}.${currency}`;
      const hash = crypto.createHmac('sha256', paymentApiKey)
        .update(hashSource, 'utf8')
        .digest('hex');

      const params = new URLSearchParams({
        merchantId: gateway.merchantId,
        orderId,
        mode,
        amount: amountForKashier,
        currency,
        hash,
        merchantRedirect,
        allowedMethods: 'card,wallet,bank_installments',
        display: 'en'
      });

      const paymentUrl = `https://checkout.kashier.io/?${params.toString()}`;

      return res.json({ success: true, paymentUrl });
    }

    // 3. MYFATOORAH
    if (provider.includes('myfatoorah') || !provider) {
      const tokenToUse = gateway.token || gateway.apiKey || ENV_MYFATOORAH_TOKEN;
      if (!tokenToUse) {
        return res.status(400).json({ success: false, message: 'MyFatoorah Token is missing.' });
      }

      const orderId = 'ORD_' + Date.now();
      const invoiceBody = {
        InvoiceValue: amount,
        DisplayCurrencyIso: 'EGP',
        CustomerName: customerName,
        CustomerEmail: customerEmail,
        CustomerMobile: customerPhone,
        CallBackUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=success&paymentId=${orderId}&productName=${encodeURIComponent(firstProductName)}`,
        ErrorUrl: `${PUBLIC_BASE_URL}/payment-result.html?status=failed&paymentId=${orderId}`,
        UserDefinedField: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, price: i.price })))
      };

      await db.collection('pending_orders').doc(orderId).set({
        orderId,
        customerEmail,
        amount,
        currency: 'EGP',
        items,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

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
// 📦 FULFILLMENT & EMAIL HELPER
// ==========================================

async function fulfillOrderAndSendCodes(orderId, customerEmail, amount, currency, cartItems, paymentDetails = {}) {
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
        orderId: String(orderId),
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
    amount: Number(amount || 0),
    currency: currency || 'EGP',
    orderStatus: 'paid',
    paymentStatus: 'paid',
    codes: purchasedCodes,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  if (purchasedCodes.length > 0) {
    await sendCodesEmail(customerEmail, orderId, purchasedCodes, { amount, ...paymentDetails });
  }
}

// ==========================================
// 🌐 WEBHOOKS & TRANSACTIONS
// ==========================================

// Fawaterak Webhook
app.post('/api/fawaterak/webhook', async (req, res) => {
  try {
    const data = req.body;
    console.log("Fawaterak Webhook Received:", JSON.stringify(data));

    const orderId = data.merchantInvoiceId || data.invoiceId || data.payLoad?.orderId;
    const invoiceStatus = String(data.invoice_status || data.status).toLowerCase();

    if (orderId && (invoiceStatus === 'paid' || invoiceStatus === 'complete' || invoiceStatus === 'success')) {
      let pendingDoc = await db.collection('pending_orders').doc(String(orderId)).get();
      if (pendingDoc.exists) {
        const orderData = pendingDoc.data();
        const existingOrder = await db.collection('orders').doc(String(orderId)).get();
        
        if (!existingOrder.exists && orderData.items) {
          await fulfillOrderAndSendCodes(orderId, orderData.customerEmail, orderData.amount, orderData.currency, orderData.items);
          console.log("Order fulfilled via Fawaterak Webhook for:", orderId);
        }
      }
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Fawaterak Webhook Error:', err.message);
    return res.status(500).json({ success: false });
  }
});

// MyFatoorah Webhook
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

    await fulfillOrderAndSendCodes(orderId, customerEmail, paymentData.InvoiceValue, paymentData.CurrencyIso, cartItems);

    return res.status(200).send('SUCCESS');
  } catch (error) { 
    console.error('Webhook Error:', error.message);
    return res.status(500).send('Internal Server Error'); 
  }
});

// Kashier Webhook & Callback
app.post(['/api/kashier/webhook', '/api/kashier/callback'], async (req, res) => {
  try {
    const data = { ...(req.body || {}), ...(req.query || {}) };
    console.log("Kashier Webhook/Callback Received:", JSON.stringify(data));

    const orderId = data.merchantOrderId || data.orderId || data.paymentId;
    const paymentStatus = String(data.paymentStatus || data.status || '').toLowerCase();
    const cardLast4 = data.cardLast4 || data.maskedCard || data.brand || 'بطاقة إلكترونية';

    if (orderId) {
      const isPaid = paymentStatus === 'success' || paymentStatus === 'paid' || paymentStatus === 'approved' || paymentStatus === 'completed' || data.success === true || data.success === 'true';
      
      await db.collection('transactions').doc(String(orderId)).set({
        paymentId: String(orderId),
        status: isPaid ? 'paid' : 'failed',
        gatewayResponse: data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      if (isPaid) {
        let pendingDoc = await db.collection('pending_orders').doc(String(orderId)).get();
        let orderData = null;
        let finalOrderId = orderId;

        if (!pendingDoc.exists) {
          const latestPending = await db.collection('pending_orders').orderBy('createdAt', 'desc').limit(1).get();
          if (!latestPending.empty) {
            const doc = latestPending.docs[0];
            orderData = doc.data();
            finalOrderId = doc.id;
          }
        } else {
          orderData = pendingDoc.data();
        }

        if (orderData && orderData.items) {
          const existingOrder = await db.collection('orders').doc(String(finalOrderId)).get();
          if (!existingOrder.exists) {
            await fulfillOrderAndSendCodes(finalOrderId, orderData.customerEmail, orderData.amount, orderData.currency, orderData.items, { cardLast4 });
            console.log("Order fulfilled instantly via Kashier Webhook for:", finalOrderId);
          }
        }
      }
    }
    return res.status(200).send('SUCCESS');
  } catch (error) {
    console.error('Kashier Webhook Error:', error.message);
    return res.status(500).send('Internal Server Error');
  }
});

// Record Transaction (Frontend Fallback)
app.post('/api/record-transaction', async (req, res) => {
  try {
    const { paymentId, status, gatewayResponse } = req.body;
    if (!paymentId) return res.status(400).json({ success: false });

    const isPaidStatus = String(status).toLowerCase() === 'success' || String(status).toLowerCase() === 'paid' || String(status).toLowerCase() === 'approved';

    if (isPaidStatus) {
      const existingOrder = await db.collection('orders').doc(String(paymentId)).get();
      
      if (!existingOrder.exists) {
        let pendingDoc = await db.collection('pending_orders').doc(String(paymentId)).get();
        let orderData = null;
        let finalOrderId = paymentId;

        if (!pendingDoc.exists) {
          const latestPending = await db.collection('pending_orders').orderBy('createdAt', 'desc').limit(1).get();
          if (!latestPending.empty) {
            const doc = latestPending.docs[0];
            orderData = doc.data();
            finalOrderId = doc.id;
          }
        } else {
          orderData = pendingDoc.data();
        }

        if (orderData && orderData.items) {
          const checkAgain = await db.collection('orders').doc(String(finalOrderId)).get();
          if (!checkAgain.exists) {
            await fulfillOrderAndSendCodes(
              finalOrderId, 
              orderData.customerEmail, 
              orderData.amount, 
              orderData.currency, 
              orderData.items
            );
          }
        }
      }
    }

    await db.collection('transactions').doc(String(paymentId)).set({
      paymentId: String(paymentId),
      status: isPaidStatus ? 'paid' : (status || 'unknown'),
      gatewayResponse: gatewayResponse || {},
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return res.json({ success: true });
  } catch (err) {
    console.error('Record Transaction Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// ✉️ EMAIL SERVICE (RESEND)
// ==========================================
async function sendCodesEmail(email, orderId, codes, paymentDetails = {}) {
  let codesHtml = '';
  codes.forEach(c => {
    codesHtml += `
      <div style="background: #0d1722; border: 1px solid #38bdf8; padding: 15px; border-radius: 10px; margin-bottom: 12px; text-align: center; box-shadow: 0 0 10px rgba(56,189,248,0.15);">
        <p style="margin: 0 0 6px 0; color: #94a3b8; font-size: 13px; font-weight: 600;">${c.productName}</p>
        <div style="background: #05080e; padding: 10px; border-radius: 6px; border: 1px dashed #38bdf8; display: inline-block;">
          <span style="font-size: 20px; font-weight: bold; letter-spacing: 2px; color: #38bdf8; font-family: monospace; direction: ltr; display: inline-block;">${c.code}</span>
        </div>
      </div>`;
  });

  const purchaseDate = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' });
  const amountPaid = paymentDetails.amount || 'حسب الفاتورة';
  const cardLast4 = paymentDetails.cardLast4 || 'بطاقة إلكترونية';

  const mailOptions = {
    from: RESEND_FROM,
    to: email,
    subject: `فاتورة وأكواد طلبك #${orderId} - TECH GAMING 🎮`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; padding: 30px; background: #070b12; color: #fff; max-width: 600px; margin: auto; border: 2px solid #38bdf8; border-radius: 16px; box-shadow: 0 0 25px rgba(56,189,248,0.25);">
        
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="color: #38bdf8; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: 2px; text-shadow: 0 0 10px rgba(56,189,248,0.6); font-family: monospace;">TECH GAMING</h1>
          <p style="color: #60a5fa; font-size: 13px; margin-top: 6px; text-shadow: 0 0 8px rgba(96,165,250,0.4);">منصتك الأولى للشحن الفوري والأكواد الرقمية</p>
        </div>

        <hr style="border: none; border-top: 1px solid rgba(56,189,248,0.3); margin: 20px 0;">

        <h3 style="color: #fff; font-size: 18px; margin-bottom: 10px;">أهلاً بك يا بطل،</h3>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
          تم تأكيد عملية الدفع بنجاح وتسجيل طلبك بالمتجر. إليك تفاصيل المعاملة والأكواد الخاصة بك:
        </p>

        <div style="background: #0b1320; border: 1px solid rgba(56,189,248,0.3); padding: 15px; border-radius: 10px; margin-bottom: 20px; font-size: 13px; color: #cbd5e1;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #94a3b8;">رقم المعاملة:</td>
              <td style="padding: 6px 0; text-align: left; font-family: monospace; color: #38bdf8; font-weight: bold;">#${orderId}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94a3b8;">ميعاد الشراء:</td>
              <td style="padding: 6px 0; text-align: left; color: #fff;">${purchaseDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94a3b8;">طريقة الدفع:</td>
              <td style="padding: 6px 0; text-align: left; color: #fff;">بطاقة (${cardLast4})</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.08);">الإجمالي المدفوع:</td>
              <td style="padding: 6px 0; text-align: left; color: #38bdf8; font-weight: bold; font-size: 15px; border-top: 1px solid rgba(255,255,255,0.08);">${amountPaid} EGP</td>
            </tr>
          </table>
        </div>

        <h4 style="color: #38bdf8; font-size: 15px; margin-bottom: 12px; border-right: 3px solid #38bdf8; padding-right: 8px;">الأكواد الرقمية الفورية:</h4>

        ${codesHtml}

        <div style="background: rgba(56,189,248,0.05); border: 1px dashed rgba(56,189,248,0.3); padding: 12px 15px; border-radius: 8px; margin-top: 20px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #38bdf8; line-height: 1.5;">
            ⚡ إذا واجهتك أي مشكلة في تفعيل الكود، تواصل معنا فوراً عبر الدعم الفني بالمتجر.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px;">
          <p style="color: #64748b; font-size: 12px; margin: 0;">شكراً لثقتك في <strong>TECH GAMING</strong> 🚀</p>
        </div>

      </div>`
  };

  if (!RESEND_API_KEY) {
    console.error("Resend API Key is missing.");
    return;
  }

  try {
    const response = await axios.post('https://api.resend.com/emails', {
      from: RESEND_FROM,
      to: [email],
      subject: mailOptions.subject,
      html: mailOptions.html
    }, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    console.log("Email sent successfully to:", email, response.data);
  } catch (error) {
    console.error('Resend Email Error Details:', error.response?.data || error.message);
  }
}

app.listen(PORT, () => {
  console.log(`Tech Gaming running on port ${PORT}`);
});
