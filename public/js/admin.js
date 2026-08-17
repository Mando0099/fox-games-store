/* ==========================================================================
   Fox Store Admin - Ultimate Core Logic & Live Database Sync (Secured Pro)
   ========================================================================== */

let db = null;
let currentUser = null;
let revenueChartInstance = null;
let currentAdminData = null; // تخزين صلاحيات الأدمن الحالي

const $ = (id) => document.getElementById(id);

const swalConfig = {
  background: '#0b1320',
  color: '#fff',
  confirmButtonColor: '#38bdf8',
  cancelButtonColor: '#475569'
};

// 📱 دالة تشغيل وإغلاق القائمة الجانبية بنظام الكلاسات النظيف
function toggleSidebar() {
  const sidebar = document.getElementById('appSidebar') || document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (sidebar) sidebar.classList.toggle('active');
  if (overlay) overlay.classList.toggle('active');
}

// 🔄 التنقل بين التابات وإغلاق القائمة فوراً
function showPage(pageName, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const targetPage = $(`${pageName}-page`);
  if (targetPage) targetPage.classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) {
    btn.classList.add('active');
  } else {
    const targetBtn = document.querySelector(`[onclick*="'${pageName}'"]`);
    if (targetBtn) targetBtn.classList.add('active');
  }

  const sidebar = document.getElementById('appSidebar') || document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (sidebar) sidebar.classList.remove('active');
  if (overlay) overlay.classList.remove('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// دالة جلب قيم المدخلات
function val(id) {
  return ($(id)?.value || '').trim();
}

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = $('menuBtn');
  if (menuBtn) menuBtn.onclick = toggleSidebar;
});

// 🔐 التحقق الأمني الصارم وصلاحيات الأدمن
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.replace('/login.html');
    return;
  }

  currentUser = user;
  db = firebase.firestore();
  if ($('adminEmail')) $('adminEmail').textContent = user.email;

  try {
    const adminCheck = await db.collection('admins')
      .where('email', '==', user.email.toLowerCase().trim())
      .limit(1)
      .get();

    if (adminCheck.empty) {
      await Swal.fire({
        icon: 'error',
        title: 'وصول مرفوض',
        text: 'هذا الحساب ليس لديه صلاحيات أدمن للوصول إلى لوحة التحكم!',
        ...swalConfig
      });
      await firebase.auth().signOut();
      window.location.replace('/login.html');
      return;
    }

    currentAdminData = adminCheck.docs[0].data();

    if (currentAdminData.active === false) {
      await Swal.fire({
        icon: 'error',
        title: 'حساب محجوب',
        text: 'تم إيقاف صلاحيات وصولك إلى لوحة التحكم من قبل الإدارة!',
        ...swalConfig
      });
      await firebase.auth().signOut();
      window.location.replace('/login.html');
      return;
    }

    initEventListeners();
    await loadAll();
    await loadAdminsManagement();

  } catch (error) {
    console.error("خطأ في التحقق من صلاحيات الأدمن:", error);
    window.location.replace('/login.html');
  }
});

async function loadAll() {
  await loadCategories();
  await loadProducts();
  await loadCodes();
  await loadOrders();
  await loadTransactions();
  await loadCoupons();
  await loadCustomers();
  await loadStats();
  await loadConfiguredGateways();
  await loadAdminsManagement();
}

// ==========================================
// 🛡️ دوال نظام إدارة الصلاحيات والأدمنه
// ==========================================

async function loadAdminsManagement() {
  const container = $('adminsListTable');
  if (!container) return;

  try {
    const snap = await db.collection('admins').get();
    if (snap.empty) {
      container.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">لا توجد إيميلات مضافة حالياً</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const d = doc.data();
      const isActive = d.active !== false;
      const isSuper = d.role === 'superadmin' || d.role === 'super_admin';
      const canControl = currentAdminData && (currentAdminData.role === 'superadmin' || currentAdminData.role === 'super_admin');

      html += `
        <tr>
          <td><strong>${d.email}</strong></td>
          <td>
            <span class="status-badge" style="background:${isSuper ? 'rgba(157,78,221,0.15)' : 'rgba(56,189,248,0.15)'}; color:${isSuper ? '#9d4edd' : '#38bdf8'};">
              ${isSuper ? 'مشرف رئيسي (Super Admin)' : 'أدمن عام'}
            </span>
          </td>
          <td>
            <span style="color: ${isActive ? '#22c55e' : '#ef4444'}; font-weight:600;">
              ${isActive ? '● مفعل (نشط)' : '○ محجوب (موقوف)'}
            </span>
          </td>
          <td>
            ${canControl ? `
              <button class="delete-btn" style="padding: 6px 12px; font-size: 12px; background:${isActive ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}; color:${isActive ? '#ef4444' : '#22c55e'}; border:none; border-radius:6px; cursor:pointer;" onclick="toggleAdminStatus('${doc.id}', ${!isActive})">
                ${isActive ? '<i class="fa-solid fa-ban"></i> حجب الدخول' : '<i class="fa-solid fa-check"></i> تفعيل'}
              </button>
            ` : '<span style="color:#64748b; font-size:12px;">صلاحيات مقيدة</span>'}
          </td>
        </tr>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading admins:", err);
  }
}

async function addNewAdmin() {
  const isSuper = currentAdminData && (currentAdminData.role === 'superadmin' || currentAdminData.role === 'super_admin');
  if (!isSuper) {
    Swal.fire({ icon: 'error', title: 'غير مسموح', text: 'عذراً، لا تملك صلاحية إضافة أدمنه جدد!', ...swalConfig });
    return;
  }

  const email = (val('newAdminEmail') || '').toLowerCase().trim();
  const role = $('newAdminRole')?.value || 'admin';

  if (!email) return;

  try {
    const check = await db.collection('admins').where('email', '==', email).get();
    if (!check.empty) {
      Swal.fire({ icon: 'warning', title: 'موجود مسبقاً', text: 'هذا البريد الإلكتروني مسجل كأدمن بالفعل!', ...swalConfig });
      return;
    }

    await db.collection('admins').add({
      email: email,
      role: role,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $('newAdminEmail').value = '';
    await loadAdminsManagement();

    Swal.fire({ icon: 'success', title: 'تمت الإضافة بنجاح', text: 'تم منح صلاحيات الأدمن لهذا البريد.', timer: 2000, showConfirmButton: false, ...swalConfig });
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر إضافة الأدمن الجديد.', ...swalConfig });
  }
}

async function toggleAdminStatus(docId, newStatus) {
  const isSuper = currentAdminData && (currentAdminData.role === 'superadmin' || currentAdminData.role === 'super_admin');
  if (!isSuper) {
    Swal.fire({ icon: 'error', title: 'غير مسموح', text: 'عذراً، لا تملك صلاحية حجب أو تفعيل الأدمنه!', ...swalConfig });
    return;
  }

  try {
    await db.collection('admins').doc(docId).update({ active: newStatus });
    await loadAdminsManagement();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: newStatus ? 'تم تفعيل الأدمن' : 'تم حجب الأدمن بنجاح', showConfirmButton: false, timer: 1500, background: '#101a26', color: '#fff' });
  } catch (err) {
    console.error("Error updating status:", err);
  }
}

// ==========================================
// 💳 دوال بوابات الدفع الديناميكية والاحترافية
// ==========================================

const gatewayConfigs = {
  fawaterak: [
    { id: 'clientId', label: 'Client ID (معرف OAuth) *', type: 'text', placeholder: 'مثال: a286b810-2d18-4413-9ea8-c029fab5d091' },
    { id: 'clientSecret', label: 'Client Secret (المفتاح السري لـ OAuth) *', type: 'password', placeholder: 'أدخل الـ Secret من فواتيرك' },
    { id: 'apiKey', label: 'HASH API Key *', type: 'text', placeholder: 'أدخل HASH API key' },
    { id: 'merchantId', label: 'Provider Key (رقم التاجر) *', type: 'text', placeholder: 'مثال: FAWATERAK.29879' },
    { id: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://tech-gaming.store/api/fawaterak/webhook', defaultValue: 'https://tech-gaming.store/api/fawaterak/webhook' }
  ],
  kashier: [
    { id: 'merchantId', label: 'Merchant ID (معرف التاجر) *', type: 'text', placeholder: 'مثال: MID-XXXX-XXXX' },
    { id: 'apiKey', label: 'Payment API Key (مفتاح الـ API) *', type: 'password', placeholder: 'أدخل الـ API Key من كاشير' }
  ],
  myfatoorah: [
    { id: 'token', label: 'API Token (رمز التوثيق) *', type: 'password', placeholder: 'أدخل الـ Live Token من ماي فاتورة' },
    { id: 'liveUrl', label: 'API URL (رابط المنصة)', type: 'text', placeholder: 'https://api-eg.myfatoorah.com', defaultValue: 'https://api-eg.myfatoorah.com' }
  ],
  paymob: [
    { id: 'apiKey', label: 'API Key *', type: 'password', placeholder: 'Paymob API Key' },
    { id: 'iframeId', label: 'Integration ID *', type: 'text', placeholder: 'مثال: 123456' },
    { id: 'secretKey', label: 'HMAC Secret *', type: 'password', placeholder: 'Paymob HMAC Secret' }
  ],
  fawry: [
    { id: 'merchantId', label: 'Merchant Code (كود التاجر) *', type: 'text', placeholder: 'Fawry Merchant Code' },
    { id: 'secretKey', label: 'Security Key / Hash *', type: 'password', placeholder: 'Fawry Security Secret' }
  ],
  stripe: [
    { id: 'apiKey', label: 'Publishable Key *', type: 'text', placeholder: 'pk_live_...' },
    { id: 'secretKey', label: 'Secret Key *', type: 'password', placeholder: 'sk_live_...' }
  ],
  paypal: [
    { id: 'clientId', label: 'Client ID *', type: 'text', placeholder: 'PayPal Client ID' },
    { id: 'secretKey', label: 'Secret Key *', type: 'password', placeholder: 'PayPal Secret Key' }
  ],
  instapay: [
    { id: 'merchantId', label: 'رقم الهاتف / عنوان الدفع (IPA) *', type: 'text', placeholder: '010xxxxxxxx أو username@instapay' },
    { id: 'token', label: 'اسم المستلم الثلاثي *', type: 'text', placeholder: 'محمد أشرف ...' }
  ]
};

function renderGatewayFields() {
  const selectedGateway = $('gatewaySelect')?.value;
  const container = $('dynamicGatewayInputs');
  if (!container) return;

  if (!selectedGateway || !gatewayConfigs[selectedGateway]) {
    container.innerHTML = '<div class="form-group" style="grid-column: 1/-1;"><label>متطلبات البوابة</label><input type="text" disabled placeholder="يرجى اختيار بوابة الدفع من القائمة بالأعلى لإظهار الحقول الخاصة بها..." /></div>';
    return;
  }

  let fieldsHtml = '';
  gatewayConfigs[selectedGateway].forEach(field => {
    fieldsHtml += `
      <div class="form-group">
        <label for="gw_${field.id}">${field.label}</label>
        <input type="${field.type}" id="gw_${field.id}" placeholder="${field.placeholder}" value="${field.defaultValue || ''}" />
      </div>
    `;
  });
  container.innerHTML = fieldsHtml;
}

async function saveAndActivateGateway() {
  const gatewayKey = $('gatewaySelect')?.value;
  if (!gatewayKey) return Swal.fire({ icon: 'warning', title: 'خطأ', text: 'اختر بوابة أولاً', ...swalConfig });

  const fields = gatewayConfigs[gatewayKey];
  const payload = {
    id: gatewayKey,
    provider: gatewayKey,
    name: $('gatewaySelect').options[$('gatewaySelect').selectedIndex]?.text || gatewayKey,
    isActive: $('gatewayIsActive') ? $('gatewayIsActive').checked : true
  };

  for (let field of fields) {
    const valInput = $(`gw_${field.id}`)?.value?.trim();
    if (field.label.includes('*') && !valInput) {
      return Swal.fire({ icon: 'warning', title: 'نقص بيانات', text: `حقل ${field.label.replace('*', '')} مطلوب أساسي!`, ...swalConfig });
    }
    payload[field.id] = valInput || '';
  }

  try {
    Swal.fire({ title: 'جاري تشفير وحفظ بيانات البوابة بالسيرفر...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), ...swalConfig });

    const res = await fetch('/api/admin/payment-gateways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!data.success) throw new Error(data.message || 'فشل حفظ البوابة');

    $('gatewaySelect').value = '';
    renderGatewayFields();
    await loadConfiguredGateways();

    Swal.fire({ icon: 'success', title: 'تم الربط والتشفير بنجاح', text: 'تم حفظ مفاتيح البوابة في السيرفر وتفعيلها.', timer: 2000, showConfirmButton: false, ...swalConfig });
  } catch (err) {
    console.error(err);
    Swal.fire({ icon: 'error', title: 'خطأ', text: err.message || 'فشل حفظ الإعدادات.', ...swalConfig });
  }
}

async function loadConfiguredGateways() {
  const container = $('configuredGatewaysList');
  if (!container) return;
  try {
    const res = await fetch('/api/admin/payment-gateways');
    const data = await res.json();

    if (!data.success || !data.gateways || data.gateways.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#94a3b8; grid-column: 1/-1; padding: 20px;">لا توجد بوابات دفع مضافة حالياً.</p>';
      return;
    }

    let html = '';
    data.gateways.forEach(g => {
      const isActive = g.isActive === true;

      html += `
        <div class="panel" style="background: #0d1722; border: 1px solid ${isActive ? '#38bdf8' : 'rgba(255,255,255,0.05)'}; margin-bottom: 0; position: relative; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h4 style="color: #fff; font-size: 18px; margin: 0;"><i class="fa-solid fa-shield-halved" style="color: #38bdf8;"></i> ${g.name || g.id}</h4>
            <button class="delete-btn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 6px 14px; border-radius: 8px; font-weight: 600; cursor: pointer;" onclick="deleteGateway('${g.id}')"><i class="fa-solid fa-trash"></i> حذف</button>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">الحالة: <strong style="color: ${isActive ? '#38bdf8' : '#ef4444'}">${isActive ? '● مفعلة لتلقي المدفوعات' : '○ متوقفة'}</strong></p>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 15px;">الأمان: <strong style="color: #22c55e">🔒 المفاتيح مشفرة بالـ Backend</strong></p>
          
          <div style="display: flex; gap: 10px; flex-direction: column;">
            <button class="btn-submit" style="width: 100%; padding: 10px; font-size: 13px; background: ${isActive ? '#38bdf8' : '#1e293b'} !important; color: ${isActive ? '#050b14' : '#fff'}; border-radius: 10px; font-weight: bold; border: none; cursor: pointer;" onclick="setExclusiveActiveGateway('${g.id}')">
              ${isActive ? '<i class="fa-solid fa-check-circle"></i> مفعلة حالياً كبوابة رئيسية' : '<i class="fa-solid fa-power-off"></i> تفعيل هذه البوابة'}
            </button>
          </div>
        </div>`;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading gateways:", err);
  }
}

async function setExclusiveActiveGateway(activeId) {
  try {
    const res = await fetch('/api/admin/payment-gateways/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    await loadConfiguredGateways();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم تفعيل البوابة بنجاح وإيقاف الباقي', showConfirmButton: false, timer: 1500, background: '#101a26', color: '#fff' });
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'خطأ', text: err.message || 'تعذر تفعيل البوابة.', ...swalConfig });
  }
}

async function deleteGateway(id) {
  Swal.fire({
    title: 'حذف البوابة؟',
    text: "لن يتمكن العملاء من الدفع عبر هذه البوابة بعد الآن!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'نعم، احذف',
    cancelButtonText: 'إلغاء',
    ...swalConfig
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/admin/payment-gateways/${id}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (!data.success) throw new Error(data.message || 'فشل الحذف');
        
        await loadConfiguredGateways();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم الحذف بنجاح', showConfirmButton: false, timer: 1500, background: '#101a26', color: '#fff' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر حذف البوابة من السيرفر.', ...swalConfig });
      }
    }
  });
}

// ==========================================
// 🎟️ دوال قسائم وأكواد الخصم الاحترافية
// ==========================================

async function saveCoupon() {
  const docId = val('couponDocId');
  const code = val('couponCode').toUpperCase();
  const value = Number(val('couponValue') || 0);
  const expiryDate = val('couponExpiry');
  const maxUses = val('couponMaxUses') ? Number(val('couponMaxUses')) : null;

  if (!code || !value) {
    Swal.fire({
      icon: 'warning',
      title: 'بيانات ناقصة',
      text: 'رمز الكود ونسبة الخصم حقول أساسية مطلوبة!',
      ...swalConfig
    });
    return;
  }

  try {
    const couponData = {
      code,
      value,
      expiryDate: expiryDate || '',
      maxUses: maxUses,
      type: 'percent',
      active: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (docId) {
      const res = await fetch(`/api/admin/coupons/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(couponData)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'فشل التحديث');
    } else {
      await db.collection('coupons').doc(code).set({
        ...couponData,
        usedCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    resetCouponForm();
    await loadCoupons();

    Swal.fire({
      icon: 'success',
      title: 'تم الحفظ بنجاح',
      text: 'تم تفعيل وضبط إعدادات الكوبون بالمتجر.',
      timer: 1500,
      showConfirmButton: false,
      ...swalConfig
    });

  } catch (err) {
    console.error("Error saving coupon:", err);
    Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر حفظ الكوبون.', ...swalConfig });
  }
}

async function loadCoupons() {
  const snap = await db.collection('coupons').get();
  const list = $('couponsList');
  if (!list) return;
  
  list.innerHTML = '';

  if (snap.empty) {
    list.innerHTML = '<p style="color:#94a3b8; grid-column: 1/-1;">لا توجد قسائم خصم مضافة حالياً.</p>';
    return;
  }

  snap.forEach(doc => {
    const c = doc.data();
    const expiryText = c.expiryDate ? `📅 ينتهي في: ${c.expiryDate}` : '📅 بدون تاريخ انتهاء';
    const usesText = c.maxUses ? `🔄 الاستخدام: ${c.usedCount || 0} / ${c.maxUses}` : '🔄 استخدام غير محدود';

    list.innerHTML += `
      <div class="panel" style="border-bottom: 3px solid #38bdf8; background: #0d1722; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 0;">
        <div>
          <h4 style="display:flex; justify-content:space-between; align-items:center; color:#fff;">
            <span>الكود: <span style="color:#38bdf8; font-family:monospace;">${c.code}</span></span>
            <span style="font-size: 14px; background: rgba(56,189,248,0.15); color: #38bdf8; padding: 2px 8px; border-radius: 6px;">${c.value}% خصم</span>
          </h4>
          <p style="margin: 10px 0 5px 0; font-size: 12px; color: #94a3b8;">${expiryText}</p>
          <p style="margin: 0 0 10px 0; font-size: 12px; color: #94a3b8;">${usesText}</p>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">
          <button class="edit-btn" style="flex:1; padding: 8px; font-size: 12px; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); border-radius:8px; color:#38bdf8; cursor:pointer;" onclick="editCoupon('${doc.id}', '${c.code}', ${c.value}, '${c.expiryDate || ''}', '${c.maxUses || ''}')">
            <i class="fa-solid fa-pen"></i> تعديل
          </button>
          <button class="delete-btn" style="flex:1; padding: 8px; font-size: 12px; background: rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); border-radius:8px; color:#ef4444; cursor:pointer;" onclick="deleteCoupon('${doc.id}')">
            <i class="fa-solid fa-trash"></i> حذف
          </button>
        </div>
      </div>
    `;
  });
}

function editCoupon(docId, code, value, expiry, maxUses) {
  $('couponDocId').value = docId;
  $('couponCode').value = code;
  $('couponValue').value = value;
  $('couponExpiry').value = expiry !== 'undefined' ? expiry : '';
  $('couponMaxUses').value = maxUses !== 'undefined' ? maxUses : '';
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteCoupon(docId) {
  Swal.fire({
    title: 'حذف الكوبون؟',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'نعم، احذف',
    cancelButtonText: 'إلغاء',
    ...swalConfig
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/admin/coupons/${docId}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (!data.success) throw new Error(data.message || 'فشل الحذف');
        
        await loadCoupons();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم الحذف بنجاح', showConfirmButton: false, timer: 1500, background: '#101a26', color: '#fff' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر حذف الكوبون.', ...swalConfig });
      }
    }
  });
}

function resetCouponForm() {
  $('couponDocId').value = '';
  $('couponCode').value = '';
  $('couponValue').value = '';
  $('couponExpiry').value = '';
  $('couponMaxUses').value = '';
}

// ==========================================
// إدارة أحداث المتجر والمنتجات
// ==========================================

function initEventListeners() {
  const dropzone = $('dropzone');
  const fileInput = $('product-image');
  const previewContainer = $('img-preview-container');
  const imagePreview = $('imagePreview');
  const removeImgBtn = $('remove-img');
  const clearFormBtn = $('clear-form');
  const menuBtn = $('menuBtn');

  const gatewaySelect = $('gatewaySelect');
  if (gatewaySelect) {
    gatewaySelect.addEventListener('change', renderGatewayFields);
  }

  if (menuBtn) {
    menuBtn.onclick = toggleSidebar;
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', function() {
      handleProductFileSelect(this.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'));
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleProductFileSelect(e.dataTransfer.files[0]);
      }
    });
  }

  if (removeImgBtn) {
    removeImgBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (fileInput) fileInput.value = '';
      if (previewContainer) previewContainer.classList.remove('active');
      if (imagePreview) imagePreview.src = '';
    });
  }

  if (clearFormBtn) {
    clearFormBtn.addEventListener('click', clearProductForm);
  }

  if ($('search-codes-input')) {
    $('search-codes-input').addEventListener('input', filterCodesTablePro);
  }
  if ($('filter-status-select')) {
    $('filter-status-select').addEventListener('change', filterCodesTablePro);
  }
}

function handleProductFileSelect(file) {
  const previewContainer = $('img-preview-container');
  const imagePreview = $('imagePreview');
  
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = function(e) {
      if (imagePreview) imagePreview.src = e.target.result;
      if (previewContainer) previewContainer.classList.add('active');
    }
    reader.readAsDataURL(file);
  }
}

function clearProductForm() {
  ['productId', 'name', 'category', 'game', 'amount', 'price', 'description']
    .forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });

  const fileInput = $('product-image');
  if (fileInput) fileInput.value = '';

  const previewContainer = $('img-preview-container');
  if (previewContainer) previewContainer.classList.remove('active');

  const imagePreview = $('imagePreview');
  if (imagePreview) imagePreview.src = '';

  const active = $('active');
  if (active) active.checked = true;
}

async function uploadImage(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'FOX-GAMES');

    const res = await fetch(
      'https://api.cloudinary.com/v1_1/denwwcqoe/image/upload',
      { method: 'POST', body: formData }
    );

    if (!res.ok) throw new Error('فشل رفع الصورة إلى سيرفر الصور');

    const data = await res.json();
    return data.secure_url;
  } catch (error) {
    console.error("Upload Error:", error);
    throw error;
  }
}

async function saveProduct() {
  const file = $('product-image')?.files[0];
  let imageUrl = $('imagePreview')?.src || '';

  const name = val('name');
  const price = Number(val('price') || 0);
  const category = val('category');

  if (!name || !price || !category) {
    Swal.fire({
      icon: 'warning',
      title: 'حقول ناقصة',
      text: 'اسم المنتج، التصنيف، والسعر حقول مطلوبة لإتمام العملية!',
      ...swalConfig
    });
    return;
  }

  try {
    if (file) {
      Swal.fire({
        title: 'جاري رفع صورة غلاف المنتج...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); },
        ...swalConfig
      });
      imageUrl = await uploadImage(file);
    }

    const data = {
      name: name,
      category: category, 
      game: val('game'),
      amount: Number(val('amount') || 0),
      price: price,
      image: imageUrl.startsWith('data:') ? '' : imageUrl,
      description: val('description'),
      active: $('active') ? $('active').checked : true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const id = val('productId');

    if (id) {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || 'فشل التحديث');
    } else {
      await db.collection('products').add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    clearProductForm();
    await loadProducts();
    await loadStats();

    Swal.fire({
      icon: 'success',
      title: 'تم الحفظ بنجاح',
      text: 'تمت مزامنة بيانات المنتج وتحديثها في اللوحة فوراً.',
      timer: 2000,
      showConfirmButton: false,
      ...swalConfig
    });
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'خطأ في الحفظ',
      text: 'تعذر رفع الصورة أو حفظ البيانات، يرجى إعادة المحاولة.',
      ...swalConfig
    });
  }
}

async function loadProducts() {
  const snap = await db.collection('products').get();
  const list = $('productsList');
  const select = $('codeProductId');

  if (list) list.innerHTML = '';
  if (select) {
    select.innerHTML = '<option value="">-- اضغط لتحديد المنتج الرقمي --</option>';
  }

  snap.forEach(doc => {
    const p = doc.data();

    if (select) {
      select.innerHTML += `<option value="${doc.id}">${p.name || 'منتج بدون اسم'}</option>`;
    }

    if (list) {
      list.innerHTML += `
        <div class="product-card-custom" id="product-${doc.id}" style="background: #0d1722; border: 1px solid rgba(56,189,248,0.2); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;">
          <div class="product-card-hero" style="position: relative; height: 160px; background: #050b14;">
            <img src="${p.image || '/assets/default-game.jpg'}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover;">
            <span class="product-badge" style="position: absolute; top: 10px; right: 10px; background: rgba(56,189,248,0.2); color: #38bdf8; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold;">${p.active ? 'نشط' : 'مخفي'}</span>
          </div>
          <div class="product-card-body" style="padding: 15px; display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
            <div>
              <h4 style="color: #fff; margin: 0 0 8px 0; font-size: 16px;">${p.name || '-'}</h4>
              <p style="color: #94a3b8; font-size: 13px; margin: 4px 0;">التصنيف: ${p.category || '-'}</p>
              <p style="color: #94a3b8; font-size: 13px; margin: 4px 0;">اللعبة: ${p.game || '-'}</p>
            </div>
            <div class="product-card-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); pt-12;">
              <span class="price-tag" style="color: #65cc00; font-weight: bold; font-size: 15px;">${p.price || 0} EGP</span>
              <div class="card-actions" style="display: flex; gap: 8px;">
                <button class="edit-btn" onclick="editProduct('${doc.id}')" title="تعديل" style="background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.3); color: #38bdf8; padding: 8px 12px; border-radius: 8px; cursor: pointer;"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="delete-btn" onclick="deleteProduct('${doc.id}')" title="حذف" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; padding: 8px 12px; border-radius: 8px; cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
}

async function editProduct(id) {
  const docSnap = await db.collection('products').doc(id).get();
  if (!docSnap.exists) return;
  const p = docSnap.data();

  if ($('productId')) $('productId').value = id;
  if ($('name')) $('name').value = p.name || '';
  if ($('category')) $('category').value = p.category || '';
  if ($('game')) $('game').value = p.game || '';
  if ($('amount')) $('amount').value = p.amount || '';
  if ($('price')) $('price').value = p.price || '';
  if ($('description')) $('description').value = p.description || '';
  if ($('active')) $('active').checked = p.active !== false;

  const previewContainer = $('img-preview-container');
  const imagePreview = $('imagePreview');
  if (p.image && imagePreview && previewContainer) {
      imagePreview.src = p.image;
      previewContainer.classList.add('active');
  }

  showPage('products');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProduct(id) {
  Swal.fire({
    title: 'تأكيد حذف المنتج؟',
    text: "سيتم إزالة هذا المنتج نهائياً من المتجر!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'نعم، احذفه',
    cancelButtonText: 'إلغاء',
    ...swalConfig
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (!data.success) throw new Error(data.message || 'فشل الحذف');

        const prodCard = document.getElementById(`product-${id}`);
        if (prodCard) prodCard.remove();
        else await loadProducts();
        
        await loadStats();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم الحذف بنجاح', showConfirmButton: false, timer: 1500, background: '#101a26', color: '#fff' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر حذف المنتج من السيرفر.', ...swalConfig });
      }
    }
  });
}

async function saveCategory() {
  const name = val('catName');
  const file = document.getElementById('categoryImageFile')?.files?.[0];
  
  if (!name) {
    Swal.fire({
      icon: 'warning',
      title: 'عذراً',
      text: 'اسم التصنيف مطلوب لإتمام العملية!',
      ...swalConfig
    });
    return;
  }

  try {
    Swal.fire({
      title: 'جاري رفع البيانات والتصنيف...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); },
      ...swalConfig
    });

    const image = file ? await uploadImage(file) : '';

    await db.collection('categories').add({
      name,
      image,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if ($('catName')) $('catName').value = '';
    const catFile = document.getElementById('categoryImageFile');
    if (catFile) catFile.value = '';
    if ($('categoryImagePreview')) $('categoryImagePreview').style.display = 'none';

    await loadCategories();
    
    Swal.fire({
      icon: 'success',
      title: 'تم إضافة التصنيف',
      text: 'تم حفظ التصنيف بنجاح.',
      timer: 1500,
      showConfirmButton: false,
      ...swalConfig
    });
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'خطأ في الإضافة',
      text: 'تعذر رفع الصورة أو حفظ التصنيف.',
      ...swalConfig
    });
  }
}

async function loadCategories() {
  const snap = await db.collection('categories').get();
  const list = $('categoriesList');
  const productCatSelect = $('category');
  
  if (list) list.innerHTML = '';
  if (productCatSelect) {
     productCatSelect.innerHTML = '<option value="">-- اختر التصنيف المتاح حالياً --</option>';
  }

  snap.forEach(doc => {
    const c = doc.data();
    
    if (productCatSelect && c.name) {
       productCatSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    }

    if (list) {
      list.innerHTML += `
        <div class="product-card-custom" id="cat-${doc.id}" style="background: #0d1722; border: 1px solid rgba(56,189,248,0.2); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;">
          <div class="product-card-hero" style="height: 140px; background: #050b14;">
            <img src="${c.image || '/assets/default-cat.jpg'}" alt="${c.name}" style="width: 100%; height: 100%; object-fit: cover;">
          </div>
          <div class="product-card-body" style="padding: 15px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; color: #fff; font-size: 16px;">${c.name || '-'}</h4>
            <button class="delete-btn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; padding: 6px 12px; border-radius: 8px; cursor: pointer;" onclick="deleteCategory('${doc.id}')"><i class="fa-solid fa-trash-can"></i> حذف</button>
          </div>
        </div>
      `;
    }
  });
}

async function deleteCategory(id) {
  Swal.fire({
    title: 'هل تريد حذف هذا التصنيف؟',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'نعم، احذفه',
    cancelButtonText: 'إلغاء',
    ...swalConfig
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'فشل الحذف');

        const catCard = document.getElementById(`cat-${id}`);
        if (catCard) catCard.remove();
        else await loadCategories();

        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم حذف التصنيف', showConfirmButton: false, timer: 1500, background: '#101a26', color: '#fff' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر حذف التصنيف.', ...swalConfig });
      }
    }
  });
}

async function saveCodes() {
  const productId = val('codeProductId');
  const raw = val('codesInput');

  if (!productId || !raw) {
    Swal.fire({
      icon: 'warning',
      title: 'بيانات غير مكتملة',
      text: 'برجاء اختيار المنتج واكتب الأكواد أولاً.',
      ...swalConfig
    });
    return;
  }

  const codes = raw.split('\n').map(c => c.trim()).filter(Boolean);

  const batch = db.batch();
  codes.forEach(code => {
    const docRef = db.collection('productCodes').doc();
    batch.set(docRef, {
      productId,
      code,
      status: 'available',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();

  if ($('codesInput')) $('codesInput').value = '';
  await loadCodes();
  await loadStats();

  Swal.fire({
    icon: 'success',
    title: 'اكتمل التخزين والتعبئة',
    text: `تم حفظ وحقن (${codes.length}) كود رقمي بنجاح!`,
    ...swalConfig
  });
}

async function loadCodes() {
  const container = $('codes-list-container');
  if (!container) return;

  const productsSnap = await db.collection('products').get();
  const productsMap = {};
  productsSnap.forEach(pDoc => {
    productsMap[pDoc.id] = pDoc.data().name || 'منتج غير معروف';
  });

  const snap = await db.collection('productCodes').orderBy('createdAt', 'desc').limit(200).get();

  let rowsHtml = '';
  if (snap.empty) {
      rowsHtml = '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#64748b;">لا توجد أكواد مضافة حالياً في قاعدة البيانات</td></tr>';
      container.innerHTML = rowsHtml;
      return;
  }

  snap.forEach(doc => {
    const c = doc.data();
    const productName = productsMap[c.productId] || 'منتج غير معروف أو محذوف';
    
    const isAvailable = c.status === 'available';
    const statusText = isAvailable ? 'متاح' : 'مُستخدم';
    
    const badgeStyle = isAvailable 
      ? 'background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.2);' 
      : 'background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2);';

    rowsHtml += `
      <tr id="row-${doc.id}" data-status="${c.status}" data-product-name="${productName.toLowerCase()}">
        <td style="font-family: monospace; letter-spacing: 1px; font-weight: 600; color: #fff; text-align: right; direction: ltr; padding-right: 20px;">${c.code || '-'}</td>
        <td><span style="color: #38bdf8; font-weight: 600; font-size: 14px;">${productName}</span></td>
        <td><span class="status-badge" style="padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block; ${badgeStyle}">${statusText}</span></td>
        <td>
          <button class="delete-btn" style="padding: 6px 10px; font-size: 12px; background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 6px; cursor: pointer;" onclick="deleteCode('${doc.id}')" title="حذف الكود نهائياً">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = rowsHtml;
}

function filterCodesTablePro() {
  const query = ($('search-codes-input')?.value || '').toLowerCase().trim();
  const statusFilter = $('filter-status-select')?.value || 'all';
  const rows = document.querySelectorAll('#codesTablePro tbody tr');

  rows.forEach(row => {
    if (row.cells.length < 4) return;
    
    const codeText = row.cells[0].textContent.toLowerCase();
    const productName = row.getAttribute('data-product-name') || '';
    const rowStatus = row.getAttribute('data-status');
    
    const matchesSearch = codeText.includes(query) || productName.includes(query);
    const matchesStatus = statusFilter === 'all' || rowStatus === statusFilter;

    if (matchesSearch && matchesStatus) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

async function deleteCode(id) {
  Swal.fire({
    title: 'هل أنت متأكد؟',
    text: "لن تتمكن من استعادة هذا الكود التسلسلي!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f43f5e',
    confirmButtonText: 'نعم، احذفه!',
    cancelButtonText: 'إلغاء',
    ...swalConfig
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        const res = await fetch(`/api/admin/codes/${id}`, { method: 'DELETE' });
        const data = await res.json();

        if (!data.success) throw new Error(data.message || 'فشل الحذف');

        const row = document.getElementById(`row-${id}`);
        if (row) row.remove();
        else await loadCodes();

        await loadStats();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم حذف الكود بنجاح', showConfirmButton: false, timer: 1500, background: '#101a26', color: '#fff' });
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'خطأ', text: 'تعذر حذف الكود.', ...swalConfig });
      }
    }
  });
}

async function loadOrders() {
  const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(50).get();

  const table = `
    <table>
      <thead>
        <tr>
          <th>رقم الطلب</th>
          <th>العميل</th>
          <th>المنتج</th>
          <th>الإجمالي</th>
          <th>الحالة</th>
          <th>الكود الرقمي</th>
        </tr>
      </thead>
      <tbody>
      ${snap.docs.map(doc => {
        const o = doc.data();
        const pName = o.productName || o.name || o.title || o.product_name || 'منتج رقمي';
        const orderPrice = Number(o.total || o.price || o.amount || 0);
        const customer = o.customerName || o.email || o.username || '-';
        const status = o.status || o.paymentStatus || o.payment_status || '-';
        const code = o.assignedCode || o.code || (o.codes && o.codes[0]?.code) || '-';

        return `
          <tr>
            <td>${o.orderId || doc.id.substring(0,8)}</td>
            <td>${customer}</td>
            <td>${pName}</td>
            <td><strong>${orderPrice} EGP</strong></td>
            <td><span class="status-badge" style="background: rgba(56,189,248,0.1); color: #38bdf8; padding: 4px 8px; border-radius: 6px;">${status}</span></td>
            <td><code style="color: #38bdf8;">${code}</code></td>
          </tr>
        `;
      }).join('')}
      </tbody>
    </table>
  `;

  if ($('ordersList')) $('ordersList').innerHTML = table;
  if ($('latestOrders')) $('latestOrders').innerHTML = table;
}

async function loadTransactions() {
  const container = $('transactionsListTable') || $('transactionsList');
  if (!container) return;

  try {
    const snap = await db.collection('transactions').orderBy('updatedAt', 'desc').limit(50).get();
    
    if (snap.empty) {
      container.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8; padding: 20px;">لا توجد معاملات مسجلة حالياً</td></tr>';
      return;
    }

    let html = '';
    snap.forEach(doc => {
      const t = doc.data();
      const isPaid = t.status === 'paid';
      html += `
        <tr>
          <td><strong style="font-family:monospace; color:#38bdf8;">${t.paymentId || doc.id}</strong></td>
          <td>
            <span class="status-badge" style="background:${isPaid ? 'rgba(56,189,248,0.15)' : 'rgba(239,68,68,0.15)'}; color:${isPaid ? '#38bdf8' : '#ef4444'}; padding: 4px 10px; border-radius: 6px;">
              ${isPaid ? 'مدفوعة (Paid)' : 'مرفوضة / فاشلة'}
            </span>
          </td>
          <td>${t.updatedAt ? t.updatedAt.toDate().toLocaleString('ar-EG') : 'وقت حديث'}</td>
        </tr>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error("خطأ في تحميل المعاملات:", err);
  }
}

async function loadCustomers() {
  const snap = await db.collection('users').limit(100).get();

  if ($('customersList')) {
    $('customersList').innerHTML = `
      <table>
        <thead>
          <tr>
            <th>الاسم الكامل</th>
            <th>البريد الإلكتروني</th>
            <th>الهاتف المحمول</th>
            <th>الدور الوظيفي</th>
          </tr>
        </thead>
        <tbody>
        ${snap.docs.map(doc => {
          const u = doc.data();
          return `
            <tr>
              <td>${u.name || '-'}</td>
              <td>${u.email || '-'}</td>
              <td>${u.phone || '-'}</td>
              <td>${u.role || 'user'}</td>
            </tr>
          `;
        }).join('')}
        </tbody>
      </table>
    `;
  }
}

async function loadStats() {
  try {
    const [products, orders, users, codes] = await Promise.all([
      db.collection('products').get(),
      db.collection('orders').get(),
      db.collection('users').get(),
      db.collection('productCodes').where('status', '==', 'available').get()
    ]);

    let totalSales = 0;
    let chartDataMap = {};

    orders.forEach(doc => {
      const o = doc.data();
      const price = Number(o.total || o.price || o.amount || 0);
      totalSales += price;

      let dateKey = 'أخرى';
      if (o.createdAt) {
         const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
         dateKey = d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
      }
      chartDataMap[dateKey] = (chartDataMap[dateKey] || 0) + price;
    });

    if ($('productsCount')) $('productsCount').textContent = products.size;
    if ($('ordersCount')) $('ordersCount').textContent = orders.size;
    if ($('codesCount')) $('codesCount').textContent = codes.size;
    if ($('customersCount')) $('customersCount').textContent = users.size;
    if ($('salesTotal')) $('salesTotal').textContent = totalSales.toLocaleString() + ' EGP';

    const chartLabels = Object.keys(chartDataMap).reverse();
    const chartValues = Object.values(chartDataMap).reverse();
    updateRevenueChart(chartLabels, chartValues);
  } catch (error) {
    console.error("خطأ في جلب العدادات: ", error);
  }
}

function updateRevenueChart(labels, dataValues) {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;

  const finalLabels = labels.length ? labels : ['أبريل', '4 مايو', '11 مايو', '18 مايو', 'اليوم'];
  const finalData = dataValues.length ? dataValues : [0, 0, 0, 0, 0];

  if (revenueChartInstance) {
    revenueChartInstance.data.labels = finalLabels;
    revenueChartInstance.data.datasets[0].data = finalData;
    revenueChartInstance.update();
  } else {
    revenueChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: finalLabels,
        datasets: [{
          data: finalData,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56,189,248,0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

function logout() {
  Swal.fire({
    title: 'تسجيل الخروج؟',
    text: "هل أنت متأكد من رغبتك في مغادرة لوحة التحكم؟",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#38bdf8',
    cancelButtonColor: '#475569',
    ...swalConfig
  }).then((result) => {
    if (result.isConfirmed) {
      firebase.auth().signOut().then(() => {
        window.location.replace('/login.html');
      });
    }
  });
}
