/* ==========================================================================
   Fox Store Admin - Ultimate Core Logic & Live Database Sync (Updated Pro)
   ========================================================================== */

let db = null;
let currentUser = null;
let revenueChartInstance = null;
let currentLang = localStorage.getItem('fox_lang') || 'ar'; // حفظ حالة اللغة المفضلة للمستخدم

const $ = (id) => document.getElementById(id);

// تيسير تخصيص التنبيهات المظلمة المتناسقة مع اللوحة
const swalConfig = {
  background: '#0b1320',
  color: '#fff',
  confirmButtonColor: '#3b82f6',
  cancelButtonColor: '#475569'
};

// قاموس الترجمة الفورية للوحة التحكم لقلب اللغة بالكامل
const translations = {
  ar: {
    dashboard: "لوحة التحكم",
    products: "المنتجات",
    orders: "الطلبات",
    codes: "الأكواد الرقمية",
    coupons: "الكوبونات",
    customers: "العملاء",
    searchPlaceholder: "بحث عن طلب، منتج، عميل...",
    totalSales: "إجمالي المبيعات",
    productsCount: "المنتجات النشطة",
    ordersCount: "إجمالي الطلبات",
    codesCount: "الأكواد المتاحة",
    logout: "تسجيل الخروج",
    newOrderAlert: "طلب جديد وارد!"
  },
  en: {
    dashboard: "Dashboard",
    products: "Products",
    orders: "Orders",
    codes: "Digital Codes",
    coupons: "Coupons",
    customers: "Customers",
    searchPlaceholder: "Search for order, product, customer...",
    totalSales: "Total Sales",
    productsCount: "Active Products",
    ordersCount: "Total Orders",
    codesCount: "Available Codes",
    logout: "Logout",
    newOrderAlert: "New Order Received!"
  }
};

// 📱 تحكم السايدبار الذكي للموبايل (قائمة برجر والـ Overlay الخلفي)
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// 🔄 تنقل التابات والصفحات مع الإغلاق التلقائي الأكيد للموبايل
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

    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// دالة جلب قيم المدخلات
function val(id) {
    return ($(id)?.value || '').trim();
}

// 🌐 تفعيل تحويل اللغة (عربي / إنجليزي) ديناميكياً مع قلب اتجاه التصميم
function initLanguage() {
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;
  
  // تحديث النصوص الحية التي تحمل الكلاس الخاص بالترجمة
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang][key]) {
      if (el.tagName === 'INPUT' && el.placeholder) {
        el.placeholder = translations[currentLang][key];
      } else {
        el.textContent = translations[currentLang][key];
      }
    }
  });
}

// زر تحويل اللغة في الـ HTML يفضل ربطه بهذه الدالة
function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('fox_lang', currentLang);
  initLanguage();
}

// التحقق من صلاحيات الأدمن والـ Authentication
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) {
    location.href = '/login.html';
    return;
  }

  currentUser = user;
  db = firebase.firestore();
  if ($('adminEmail')) $('adminEmail').textContent = user.email;

  const adminCheck = await db.collection('admins')
    .where('email', '==', user.email)
    .where('active', '==', true)
    .limit(1)
    .get();

  if (adminCheck.empty) {
    Swal.fire({
      icon: 'error',
      title: 'وصول مرفوض',
      text: 'هذا الحساب ليس لديه صلاحيات أدمن!',
      ...swalConfig
    }).then(() => {
      location.href = '/';
    });
    return;
  }

  // تهيئة مستمعي الأحداث والـ Drag & Drop فور تأكيد الصلاحيات
  initEventListeners();
  initLanguage();
  await loadAll();
  listenToLiveOrders(); // تشغيل نظام الإشعارات اللحظية الفعلي
});

// تحميل كافة البيانات والعدادات فور الدخول للوحة
async function loadAll() {
  await loadCategories(); 
  await loadProducts();
  await loadCodes();
  await loadCoupons();
  await loadCustomers();
  await loadStats();
}

// 🌐 تهيئة مستمعي الأحداث والبحث المتقدم الشامل لقاعدة البيانات
function initEventListeners() {
    const dropzone = $('dropzone');
    const fileInput = $('product-image');
    const previewContainer = $('img-preview-container');
    const imagePreview = $('imagePreview');
    const removeImgBtn = $('remove-img');
    const clearFormBtn = $('clear-form');
    const menuBtn = $('menuBtn');
    const globalSearch = $('globalSearchInput'); // تأكد من إضافة id="globalSearchInput" لخانة البحث الرئيسية

    if (menuBtn) menuBtn.addEventListener('click', toggleSidebar);

    // تفعيل البحث اللحظي الفعلي والشامل في المتجر
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        filterGlobalDashboardData(query);
      });
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', function() { handleProductFileSelect(this.files[0]); });
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        ['dragleave', 'drop'].forEach(ev => dropzone.addEventListener(ev, () => dropzone.classList.remove('dragover')));
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

    if (clearFormBtn) clearFormBtn.addEventListener('click', clearProductForm);
    if ($('search-codes-input')) $('search-codes-input').addEventListener('input', filterCodesTablePro);
    if ($('filter-status-select')) $('filter-status-select').addEventListener('change', filterCodesTablePro);
}

// 🔍 فلترة البحث الفوري للمنتجات، الجداول والطلبات دفعة واحدة
function filterGlobalDashboardData(query) {
  // 1. فلترة كروت المنتجات
  document.querySelectorAll('.product-card-custom').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? '' : 'none';
  });

  // 2. فلترة صفوف الجداول (مثل الطلبات والعملاء)
  document.querySelectorAll('table tbody tr').forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(query) ? '' : 'none';
  });
}

// 🔔 نظام الإشعارات اللحظي الحقيقي (Real-time Listening) عند حدوث عملية شراء
let isInitialLoad = true;
function listenToLiveOrders() {
  db.collection('orders').orderBy('createdAt', 'desc').limit(1)
    .onSnapshot(snapshot => {
      if (isInitialLoad) {
        isInitialLoad = false; // تخطي جلب البيانات القديمة عند فتح الصفحة لأول مرة
        loadOrders();
        return;
      }
      
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const newOrder = change.doc.data();
          
          // 1. تحديث قوائم الطلبات في الواجهة فوراً
          loadOrders();
          loadStats();
          
          // 2. تفعيل جرس العداد الخاص بالإشعارات (تحديث الرقم الأحمر في الـ UI)
          const notifyBadge = $('notificationBadge');
          if (notifyBadge) {
            let currentCount = parseInt(notifyBadge.textContent) || 0;
            notifyBadge.textContent = currentCount + 1;
            notifyBadge.style.display = 'block';
          }

          // 3. إظهار نافذة منبثقة تفاعلية فخمة بالأمر الجديد
          Swal.fire({
            icon: 'success',
            title: translations[currentLang].newOrderAlert,
            text: `العميل ${newOrder.customerName || 'مجهول'} قام بشراء ${newOrder.productName || 'منتج'} بقيمة ${newOrder.total || 0} EGP`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 5000,
            ...swalConfig
          });
        }
      });
    });
}

// دالة معالجة وعرض معاينة ملف الصورة المرفوع
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

// تفريغ فورم المنتجات بالكامل
function clearProductForm() {
  ['productId', 'name', 'category', 'game', 'amount', 'price', 'description']
    .forEach(id => { const el = $(id); if (el) el.value = ''; });
  if ($('product-image')) $('product-image').value = '';
  if ($('img-preview-container')) $('img-preview-container').classList.remove('active');
  if ($('imagePreview')) $('imagePreview').src = '';
  if ($('active')) $('active').checked = true;
}

// حفظ أو تحديث منتج
async function saveProduct() {
  const file = $('product-image')?.files[0];
  let imageUrl = $('imagePreview')?.src || '';
  
  if (file) {
    Swal.fire({ title: 'جاري رفع صورة غلاف... ', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }, ...swalConfig });
    imageUrl = await uploadImage(file);
  }

  const data = {
    name: val('name'),
    category: val('category'), 
    game: val('game'),
    amount: Number(val('amount') || 0),
    price: Number(val('price') || 0),
    image: imageUrl.startsWith('data:') ? '' : imageUrl,
    description: val('description'),
    active: $('active').checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (!data.name || !data.price || !data.category) {
    Swal.fire({ icon: 'warning', title: 'حقول ناقصة', text: 'اسم المنتج، التصنيف، والسعر حقول مطلوبة!', ...swalConfig });
    return;
  }

  const id = val('productId');
  if (id) {
    await db.collection('products').doc(id).set(data, { merge: true });
  } else {
    await db.collection('products').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  clearProductForm();
  await loadProducts();
  await loadStats();
  Swal.fire({ icon: 'success', title: 'تم الحفظ بنجاح', timer: 2000, showConfirmButton: false, ...swalConfig });
}

// جلب المنتجات وعرضها
async function loadProducts() {
  const snap = await db.collection('products').get();
  const list = $('productsList');
  const select = $('codeProductId');

  if (list) list.innerHTML = '';
  if (select) select.innerHTML = '<option value="">-- اضغط لتحديد المنتج الرقمي --</option>';

  snap.forEach(doc => {
    const p = doc.data();
    if (select) select.innerHTML += `<option value="${doc.id}">${p.name || 'منتج بدون اسم'}</option>`;
    if (list) {
      list.innerHTML += `
        <div class="product-card-custom" id="product-${doc.id}">
          <div class="product-card-hero">
            <img src="${p.image || '/assets/default-game.jpg'}" alt="${p.name}">
            <span class="product-badge">${p.active ? 'نشط' : 'مخفي'}</span>
          </div>
          <div class="product-card-body">
            <div>
              <h4>${p.name || '-'}</h4>
              <p>التصنيف: ${p.category || '-'}</p>
              <p>اللعبة: ${p.game || '-'}</p>
            </div>
            <div class="product-card-footer">
              <span class="price-tag">${p.price || 0} EGP</span>
              <div class="card-actions">
                <button class="edit-btn" onclick="editProduct('${doc.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="delete-btn" onclick="deleteProduct('${doc.id}')"><i class="fa-solid fa-trash-can"></i></button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
}

// تعديل منتج
async function editProduct(id) {
  const doc = await db.collection('products').doc(id).get();
  const p = doc.data();
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
  scrollTo({ top: 0, behavior: 'smooth' });
}

// حذف منتج
async function deleteProduct(id) {
  Swal.fire({ title: 'تأكيد حذف المنتج؟', text: "سيتم إزالة هذا المنتج نهائياً من المتجر!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', confirmButtonText: 'نعم، احذفه', ...swalConfig }).then(async (result) => {
    if (result.isConfirmed) {
      await db.collection('products').doc(id).delete();
      const prodCard = document.getElementById(`product-${id}`);
      if (prodCard) { prodCard.style.transition = "all 0.3s"; prodCard.style.opacity = "0"; setTimeout(() => prodCard.remove(), 300); }
      else { await loadProducts(); }
      await loadStats();
    }
  });
}

// رفع الصور إلى Cloudinary
async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'FOX-GAMES');
  const res = await fetch('https://api.cloudinary.com/v1_1/denwwcqoe/image/upload', { method: 'POST', body: formData });
  const data = await res.json();
  return data.secure_url;
}

// حفظ تصنيف جديد
async function saveCategory() {
  const name = val('catName');
  const file = document.getElementById('categoryImageFile')?.files?.[0];
  if (!name) { Swal.fire({ icon: 'warning', title: 'عذراً', text: 'اسم التصنيف مطلوب!', ...swalConfig }); return; }
  Swal.fire({ title: 'جاري حفظ التصنيف...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }, ...swalConfig });
  const image = file ? await uploadImage(file) : '';
  await db.collection('categories').add({ name, image, active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  if ($('catName')) $('catName').value = '';
  await loadCategories();
  Swal.fire({ icon: 'success', title: 'تم الإضافة', timer: 1500, showConfirmButton: false, ...swalConfig });
}

// جلب التصنيفات
async function loadCategories() {
  const snap = await db.collection('categories').get();
  const list = $('categoriesList');
  const productCatSelect = $('category');
  if (list) list.innerHTML = '';
  if (productCatSelect) productCatSelect.innerHTML = '<option value="">-- اختر التصنيف --</option>';

  snap.forEach(doc => {
    const c = doc.data();
    if (productCatSelect && c.name) productCatSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    if (list) {
      list.innerHTML += `
        <div class="product-card-custom" id="cat-${doc.id}">
          <div class="product-card-hero" style="height: 140px;">
            <img src="${c.image || '/assets/default-cat.jpg'}" alt="${c.name}">
          </div>
          <div class="product-card-body" style="padding: 15px; display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0;">${c.name || '-'}</h4>
            <button class="delete-btn" style="padding: 8px 12px;" onclick="deleteCategory('${doc.id}')"><i class="fa-solid fa-trash-can"></i> حذف</button>
          </div>
        </div>
      `;
    }
  });
}

// حذف تصنيف
async function deleteCategory(id) {
  Swal.fire({ title: 'هل تريد الحذف؟', icon: 'warning', showCancelButton: true, confirmButtonColor: '#f43f5e', ...swalConfig }).then(async (result) => {
    if (result.isConfirmed) {
      await db.collection('categories').doc(id).delete();
      await loadCategories();
    }
  });
}

// حفظ الأكواد
async function saveCodes() {
  const productId = val('codeProductId');
  const raw = val('codesInput');
  if (!productId || !raw) { Swal.fire({ icon: 'warning', title: 'بيانات ناقصة', ...swalConfig }); return; }
  const codes = raw.split('\n').map(c => c.trim()).filter(Boolean);
  const batch = db.batch();
  codes.forEach(code => {
    const docRef = db.collection('productCodes').doc();
    batch.set(docRef, { productId, code, status: 'available', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  if ($('codesInput')) $('codesInput').value = '';
  await loadCodes();
  await loadStats();
}

// جلب الأكواد الرقمية
async function loadCodes() {
  const container = $('codes-list-container');
  if (!container) return;
  const productsSnap = await db.collection('products').get();
  const productsMap = {};
  productsSnap.forEach(pDoc => { productsMap[pDoc.id] = pDoc.data().name || 'منتج غير معروف'; });

  const snap = await db.collection('productCodes').orderBy('createdAt', 'desc').limit(200).get();
  let rowsHtml = '';
  if (snap.empty) {
      container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px;">لا توجد أكواد مضافة</td></tr>';
      return;
  }
  snap.forEach(doc => {
    const c = doc.data();
    const productName = productsMap[c.productId] || 'منتج غير معروف';
    const isAvailable = c.status === 'available';
    const badgeStyle = isAvailable ? 'background: rgba(101, 204, 0, 0.1); color: #65cc00;' : 'background: rgba(244, 63, 94, 0.1); color: #f43f5e;';
    rowsHtml += `
      <tr id="row-${doc.id}" data-status="${c.status}" data-product-name="${productName.toLowerCase()}">
        <td style="font-family: monospace; text-align: right; direction: ltr;">${c.code || '-'}</td>
        <td><span style="color: #3b82f6; font-weight: 600;">${productName}</span></td>
        <td><span class="status-badge" style="padding: 4px 12px; border-radius: 6px; ${badgeStyle}">${isAvailable ? 'متاح' : 'مُستخدم'}</span></td>
        <td><button class="delete-btn" onclick="deleteCode('${doc.id}')"><i class="fa-solid fa-trash-can"></i></button></td>
      </tr>
    `;
  });
  container.innerHTML = rowsHtml;
}

function filterCodesTablePro() {
  const query = ($('search-codes-input')?.value || '').toLowerCase().trim();
  const statusFilter = $('filter-status-select')?.value || 'all';
  document.querySelectorAll('#codesTablePro tbody tr').forEach(row => {
    if (row.cells.length < 4) return;
    const matchesSearch = row.cells[0].textContent.toLowerCase().includes(query) || row.getAttribute('data-product-name').includes(query);
    const matchesStatus = statusFilter === 'all' || row.getAttribute('data-status') === statusFilter;
    row.style.display = (matchesSearch && matchesStatus) ? '' : 'none';
  });
}

async function deleteCode(id) {
  await db.collection('productCodes').doc(id).delete();
  document.getElementById(`row-${id}`)?.remove();
  await loadStats();
}

async function saveCoupon() {
  const code = val('couponCode').toUpperCase();
  const value = Number(val('couponValue') || 0);
  if (!code || !value) return;
  await db.collection('coupons').doc(code).set({ code, value, type: 'percent', active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  await loadCoupons();
}

async function loadCoupons() {
  const snap = await db.collection('coupons').get();
  const list = $('couponsList');
  if (list) list.innerHTML = '';
  snap.forEach(doc => {
    const c = doc.data();
    if (list) {
      list.innerHTML += `
        <div class="panel" style="border-bottom: 3px solid #f97316;">
          <h4>الرمز: <span style="color:#f97316;">${c.code}</span></h4>
          <p>الخصم: <strong>${c.value}%</strong></p>
        </div>
      `;
    }
  });
}

// جلب وعرض الطلبات وفواتير الشراء تلقائياً وتحديث كروت المنتجات التي تم شراؤها
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
        return `
          <tr>
            <td>${o.orderId || doc.id.substring(0,8)}</td>
            <td>${o.customerName || o.email || '-'}</td>
            <td>${o.productName || 'منتج رقمي'}</td>
            <td><strong>${Number(o.total || 0)} EGP</strong></td>
            <td><span class="status-badge">${o.status || 'Paid'}</span></td>
            <td><code>${o.assignedCode || o.code || '-'}</code></td>
          </tr>
        `;
      }).join('')}
      </tbody>
    </table>
  `;
  if ($('ordersList')) $('ordersList').innerHTML = table;
  if ($('latestOrders')) $('latestOrders').innerHTML = table;
}

// جلب سجلات العملاء
async function loadCustomers() {
  const snap = await db.collection('users').limit(100).get();
  if ($('customersList')) {
    $('customersList').innerHTML = `
      <table>
        <thead><tr><th>الاسم الكامل</th><th>البريد الإلكتروني</th><th>الهاتف</th><th>الدور</th></tr></thead>
        <tbody>
        ${snap.docs.map(doc => {
          const u = doc.data();
          return `<tr><td>${u.name || '-'}</td><td>${u.email || '-'}</td><td>${u.phone || '-'}</td><td>${u.role || 'user'}</td></tr>`;
        }).join('')}
        </tbody>
      </table>
    `;
  }
}

// حساب الإيرادات الحقيقية وحساب النسب المئوية ديناميكياً تحت كل تابة (Real % Not Fake)
async function loadStats() {
  try {
    const products = await db.collection('products').get();
    const orders = await db.collection('orders').get();
    const users = await db.collection('users').get();
    const codes = await db.collection('productCodes').where('status', '==', 'available').get();

    let totalSales = 0;
    let todaySales = 0;
    let yesterdaySales = 0;
    let chartDataMap = {};

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    orders.forEach(doc => {
      const o = doc.data();
      const price = Number(o.total || o.price || 0);
      totalSales += price;

      let orderDate = null;
      if (o.createdAt) {
        orderDate = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        const dateKey = orderDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
        chartDataMap[dateKey] = (chartDataMap[dateKey] || 0) + price;
        
        // حساب مبيعات اليوم ومبيعات الأمس لغرض مقارنة النسبة المئوية الفركتالية الحقيقية
        if (orderDate.toDateString() === todayStr) todaySales += price;
        if (orderDate.toDateString() === yesterdayStr) yesterdaySales += price;
      }
    });

    // حساب نسبة الزيادة أو النقصان الفعلية للمبيعات مقارنة بالأمس
    let percentageGrowth = 0;
    if (yesterdaySales > 0) {
      percentageGrowth = ((todaySales - yesterdaySales) / yesterdaySales) * 100;
    } else if (todaySales > 0) {
      percentageGrowth = 100; // مبيعات كاملة جديدة اليوم
    }

    // تحديث الأرقام والنسب المئوية الحية بالـ UI
    if ($('productsCount')) $('productsCount').textContent = products.size;
    if ($('ordersCount')) $('ordersCount').textContent = orders.size;
    if ($('codesCount')) $('codesCount').textContent = codes.size;
    if ($('customersCount')) $('customersCount').textContent = users.size;
    if ($('salesTotal')) $('salesTotal').textContent = totalSales.toLocaleString() + ' EGP';

    // حقن النسبة المئوية الحقيقية وتلوينها ديناميكياً تحت تابة المبيعات
    const salesPercentEl = $('salesPercentageUpdate'); // تأكد من وضع هذا المعرف id="salesPercentageUpdate" تحت تابة المبيعات
    if (salesPercentEl) {
      const sign = percentageGrowth >= 0 ? '+' : '';
      salesPercentEl.textContent = `${sign}${percentageGrowth.toFixed(1)}% مقارنة بالأمس`;
      salesPercentEl.style.color = percentageGrowth >= 0 ? '#22c55e' : '#f43f5e';
    }

    const chartLabels = Object.keys(chartDataMap).reverse();
    const chartValues = Object.values(chartDataMap).reverse();
    updateRevenueChart(chartLabels, chartValues);

  } catch (error) {
      console.error("حدث خطأ في العدادات الشاملة والرسم البياني: ", error);
  }
}

// دالة تحديث الرسوم البيانية بسلاسة وبدون تداخلات برمجية للـ Canvas
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
        const ctxGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        ctxGradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
        ctxGradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        revenueChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                 Tir: { labels: finalLabels },
                datasets: [{
                    data: finalData,
                    borderColor: '#3b82f6',
                    borderWidth: 3,
                    backgroundColor: ctxGradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3b82f6',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Cairo' } } },
                    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }
}

// تسجيل الخروج
function logout() {
  Swal.fire({ title: 'تسجيل الخروج؟', icon: 'question', showCancelButton: true, ...swalConfig }).then((result) => {
    if (result.isConfirmed) { firebase.auth().signOut().then(() => { location.href = '/login.html'; }); }
  });
}
