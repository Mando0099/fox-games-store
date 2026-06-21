/* ==========================================================================
   Fox Store Admin - Ultimate Core Logic & Live Database Sync (Updated Pro)
   ========================================================================== */

let db = null;
let currentUser = null;
let revenueChartInstance = null;

const $ = (id) => document.getElementById(id);

// تيسير تخصيص التنبيهات المظلمة المتناسقة مع اللوحة
const swalConfig = {
  background: '#0b1320',
  color: '#fff',
  confirmButtonColor: '#3b82f6',
  cancelButtonColor: '#475569'
};

// 📱 تحكم السايدبار الذكي للموبايل (قائمة برجر والـ Overlay الخلفي)
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebarOverlay');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
    if (overlay) {
        overlay.classList.toggle('active');
    }
}

// 🔄 تنقل التابات والصفحات مع الإغلاق التلقائي الأكيد للموبايل
function showPage(id, btn){
    // 1. إخفاء كافة الصفحات وتفعيل الصفحة المطلوبة
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if($(id)) $(id).classList.add('active');

    // 2. تحديث حالة أزرار القائمة الجانبية (الزر النشط)
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(btn) {
        btn.classList.add('active');
    } else {
        // تأمين إضافي: إذا لم يتم تمرير الزر برمجياً، ابحث عنه واجعله نشطاً
        const targetBtn = document.querySelector(`[onclick*="${id}"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }

    // 3. الحل الجذري للموبايل: إجبار القائمة والـ Overlay على الإغلاق فوراً عند التنقل
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebarOverlay');
    
    if (sidebar) {
        sidebar.classList.remove('active');
    }
    if (overlay) {
        overlay.classList.remove('active');
    }
}

// دالة جلب قيم المدخلات
function val(id){
    return ($(id)?.value || '').trim();
}

// التحقق من صلاحيات الأدمن والـ Authentication
firebase.auth().onAuthStateChanged(async (user) => {
  if(!user){
    location.href = '/login.html';
    return;
  }

  currentUser = user;
  db = firebase.firestore();
  if($('adminEmail')) $('adminEmail').textContent = user.email;

  const adminCheck = await db.collection('admins')
    .where('email','==',user.email)
    .where('active','==',true)
    .limit(1)
    .get();

  if(adminCheck.empty){
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

  await loadAll();
});

// تحميل كافة البيانات والعدادات فور الدخول للوحة
async function loadAll(){
  await loadCategories(); // جلب التصنيفات أولاً لتغذية القوائم المنسدلة
  await loadProducts();
  await loadCodes();
  await loadOrders();
  await loadCoupons();
  await loadCustomers();
  await loadStats();
}

// تفريغ فورم المنتجات
function clearProductForm(){
  ['productId','name','category','game','amount','price','description']
    .forEach(id => {
      const el = $(id);
      if(el) el.value = '';
    });

  const imageFile = $('imageFile');
  if(imageFile) imageFile.value = '';

  const active = $('active');
  if(active) active.checked = true;
}

// حفظ أو تحديث منتج
async function saveProduct(){
  const file = document.getElementById('imageFile').files[0];
  let imageUrl = val('image'); // الاحتفاظ بالصورة القديمة عند التعديل إذا لم ترفع صورة جديدة
  
  if(file){
    imageUrl = await uploadImage(file);
  }

  const data = {
    name: val('name'),
    category: val('category'), // سيسحب القيمة المحددة من الـ select الحقيقي الآن
    game: val('game'),
    amount: Number(val('amount') || 0),
    price: Number(val('price') || 0),
    image: imageUrl,
    description: val('description'),
    active: $('active').checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if(!data.name || !data.price || !data.category){
    Swal.fire({
      icon: 'warning',
      title: 'حقول ناقصة',
      text: 'اسم المنتج، التصنيف، والسعر حقول مطلوبة!',
      ...swalConfig
    });
    return;
  }

  const id = val('productId');

  if(id){
    await db.collection('products').doc(id).set(data, {merge:true});
  }else{
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
    title: 'تم الحفظ',
    text: 'تم حفظ المنتج بنجاح داخل اللوحة.',
    timer: 2000,
    showConfirmButton: false,
    ...swalConfig
  });
}

// جلب المنتجات وعرضها بالتصميم الـ Gaming الجديد المتجاوب
async function loadProducts(){
  const snap = await db.collection('products').get();
  const list = $('productsList');
  const select = $('codeProductId');

  if(list) list.innerHTML = '';
  if(select){
    select.innerHTML = '<option value="">اختر المنتج</option>';
  }

  snap.forEach(doc => {
    const p = doc.data();

    if(select){
      select.innerHTML += `<option value="${doc.id}">${p.name || 'منتج بدون اسم'}</option>`;
    }

    if(list){
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
async function editProduct(id){
  const doc = await db.collection('products').doc(id).get();
  const p = doc.data();

  if($('productId')) $('productId').value = id;
  if($('name')) $('name').value = p.name || '';
  if($('category')) $('category').value = p.category || '';
  if($('game')) $('game').value = p.game || '';
  if($('amount')) $('amount').value = p.amount || '';
  if($('price')) $('price').value = p.price || '';
  if($('image')) $('image').value = p.image || '';
  if($('description')) $('description').value = p.description || '';
  if($('active')) $('active').checked = p.active !== false;

  showPage('products', document.querySelector('[onclick*="products"]'));
  scrollTo({top:0, behavior:'smooth'});
}

// حذف منتج بأكشن وتأكيد داخلي
async function deleteProduct(id){
  Swal.fire({
    title: 'تأكيد حذف المنتج؟',
    text: "سيتم إزالة هذا المنتج نهائياً من المتجر واختفاء كروته!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f43f5e',
    confirmButtonText: 'نعم، احذفه',
    cancelButtonText: 'إلغاء',
    ...swalConfig
  }).then(async (result) => {
    if (result.isConfirmed) {
      await db.collection('products').doc(id).delete();
      
      const prodCard = document.getElementById(`product-${id}`);
      if(prodCard) {
        prodCard.style.transition = "all 0.3s";
        prodCard.style.opacity = "0";
        setTimeout(() => prodCard.remove(), 300);
      } else {
        await loadProducts();
      }
      
      await loadStats();
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'تم حذف المنتج بنجاح',
        showConfirmButton: false,
        timer: 1500,
        background: '#101a26',
        color: '#fff'
      });
    }
  });
}

// رفع الصور إلى Cloudinary
async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'FOX-GAMES');

  const res = await fetch(
    'https://api.cloudinary.com/v1_1/denwwcqoe/image/upload',
    { method: 'POST', body: formData }
  );

  const data = await res.json();
  return data.secure_url;
}

// حفظ تصنيف جديد
async function saveCategory(){
  const name = val('catName');
  const file = document.getElementById('categoryImageFile')?.files?.[0];
  
  if(!name){
    Swal.fire({
      icon: 'warning',
      title: 'عذراً',
      text: 'اسم التصنيف مطلوب لإتمام العملية!',
      ...swalConfig
    });
    return;
  }

  // إشعار تحميل بسيط من قلب اللوحة لحين الرفع لكلاوديناري
  Swal.fire({
    title: 'جاري رفع البيانات...',
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

  if($('catName')) $('catName').value = '';
  const catFile = document.getElementById('categoryImageFile');
  if(catFile) catFile.value = '';

  await loadCategories();
  
  Swal.fire({
    icon: 'success',
    title: 'تم الإضافة',
    text: 'تم حفظ التصنيف بنجاح فوري.',
    timer: 1500,
    showConfirmButton: false,
    ...swalConfig
  });
}

// جلب التصنيفات الحقيقية وتحديث الكروت وقوائم الاختيارات المنسدلة
async function loadCategories(){
  const snap = await db.collection('categories').get();
  const list = $('categoriesList');
  const productCatSelect = $('category');
  
  if(list) list.innerHTML = '';
  if(productCatSelect){
     productCatSelect.innerHTML = '<option value="">اختر التصنيف المتاح...</option>';
  }

  snap.forEach(doc => {
    const c = doc.data();
    
    if(productCatSelect && c.name){
       productCatSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    }

    if(list){
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

// حذف تصنيف بأكشن داخلي
async function deleteCategory(id){
  Swal.fire({
    title: 'هل تريد حذف هذا التصنيف؟',
    text: "تأكد أنه لا توجد منتجات معتمدة عليه حالياً.",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f43f5e',
    confirmButtonText: 'نعم، احذفه',
    cancelButtonText: 'إلغاء',
    ...swalConfig
  }).then(async (result) => {
    if (result.isConfirmed) {
      await db.collection('categories').doc(id).delete();
      
      const catCard = document.getElementById(`cat-${id}`);
      if(catCard) {
        catCard.style.transition = "all 0.3s";
        catCard.style.opacity = "0";
        setTimeout(() => catCard.remove(), 300);
      } else {
        await loadCategories();
      }
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'تم حذف التصنيف',
        showConfirmButton: false,
        timer: 1500,
        background: '#101a26',
        color: '#fff'
      });
    }
  });
}

// 💎 حفظ أكواد المنتجات بدعم الـ Batch والـ SweetAlert2 الداخلي
async function saveCodes(){
  const productId = val('codeProductId');
  const raw = val('codesInput');

  if(!productId || !raw){
    Swal.fire({
      icon: 'warning',
      title: 'بيانات غير مكتملة',
      text: 'اختر المنتج واكتب الأكواد أولاً داخل الحقل المخصص.',
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

  if($('codesInput')) $('codesInput').value = '';
  await loadCodes();
  await loadStats();

  Swal.fire({
    icon: 'success',
    title: 'اكتمل التخزين',
    text: `تم حفظ وتخزين (${codes.length}) كود رقمي بنجاح فوري!`,
    ...swalConfig
  });
}

// 📊 جلب الأكواد وتحديث صفوف الـ tbody فقط دون وميض البانل
async function loadCodes() {
  const list = $('codesList');
  if (!list) return;

  const productsSnap = await db.collection('products').get();
  const productsMap = {};
  productsSnap.forEach(pDoc => {
    productsMap[pDoc.id] = pDoc.data().name || 'منتج غير معروف';
  });

  const snap = await db.collection('productCodes').orderBy('createdAt', 'desc').limit(200).get();

  let rowsHtml = '';
  snap.forEach(doc => {
    const c = doc.data();
    const productName = productsMap[c.productId] || 'منتج غير معروف أو محذوف';
    
    const isAvailable = c.status === 'available';
    const statusText = isAvailable ? 'متاح' : 'مُستخدم';
    
    // الألوان الافتراضية السلسة للأكواد (الأخضر للمتاح والأحمر للمستعمل)
    const badgeStyle = isAvailable 
      ? 'background: rgba(101, 204, 0, 0.1); color: #65cc00; border: 1px solid rgba(101, 204, 0, 0.2);' 
      : 'background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2);';

    rowsHtml += `
      <tr id="row-${doc.id}" data-status="${c.status}" data-product="${c.productId}">
        <td style="font-family: monospace; letter-spacing: 1px; font-weight: 600; color: #fff; text-align: left; padding-left: 20px;">${c.code || '-'}</td>
        <td><span style="color: #3b82f6; font-weight: 600; font-size: 14px;">${productName}</span></td>
        <td><span class="status-badge" style="padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block; ${badgeStyle}">${statusText}</span></td>
        <td>
          <button class="delete-btn" style="padding: 6px 10px; font-size: 12px; background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.1);" onclick="deleteCode('${doc.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });

  // التحكم الذكي: تحديث صفوف الجدول فقط لتفادي الفلكر ومسح حقول فلاتر العميل
  const existingTableBody = document.querySelector('#codesTablePro tbody');
  if (existingTableBody) {
    existingTableBody.innerHTML = rowsHtml || '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#64748b;">لا توجد أكواد مضافة حالياً</td></tr>';
    return;
  }

  list.innerHTML = `
    <div class="table-toolbar" style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
      <div style="position: relative; flex: 1; min-width: 250px;">
        <input type="text" id="codeSearch" placeholder="🔍 ابحث عن كود رقمي محدد..." oninput="filterCodesTable()" style="width: 100%; padding: 11px 15px; background: #142032; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; color: #fff; font-size: 14px;">
      </div>
      <select id="filterStatus" onchange="filterCodesTable()" style="padding: 11px 15px; background: #142032; border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; color: #94a3b8; width: 160px; font-family: 'Cairo'; cursor: pointer;">
        <option value="all">كل الأكواد</option>
        <option value="available">🔓 المتاحة فقط</option>
        <option value="used">🔒 المُستخدمة فقط</option>
      </select>
    </div>
    
    <div class="table-responsive" style="max-height: 550px; overflow-y: auto; background: #0b1320; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
      <table id="codesTablePro" style="width: 100%; border-collapse: collapse; text-align: right;">
        <thead>
          <tr style="background: #101a26; position: sticky; top: 0; z-index: 10;">
            <th style="padding: 14px; color: #94a3b8; font-size: 13px; font-weight: 600; text-align: left; padding-left: 20px;">الكود الرقمي</th>
            <th style="padding: 14px; color: #94a3b8; font-size: 13px; font-weight: 600;">المنتج التابع له</th>
            <th style="padding: 14px; color: #94a3b8; font-size: 13px; font-weight: 600;">الحالة</th>
            <th style="padding: 14px; color: #94a3b8; font-size: 13px; font-weight: 600; width: 80px;">إجراء</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#64748b;">لا توجد أكواد مضافة حالياً في قاعدة البيانات</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

// 🔍 دالة الفلترة والبحث اللحظي
function filterCodesTable() {
  const query = $('codeSearch').value.toLowerCase().trim();
  const statusFilter = $('filterStatus').value;
  const rows = document.querySelectorAll('#codesTablePro tbody tr');

  rows.forEach(row => {
    if(row.cells.length < 4) return;
    
    const codeText = row.cells[0].textContent.toLowerCase();
    const rowStatus = row.getAttribute('data-status');
    
    const matchesSearch = codeText.includes(query);
    const matchesStatus = statusFilter === 'all' || rowStatus === statusFilter;

    if (matchesSearch && matchesStatus) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// 🗑️ دالة حذف كود محدد نهائياً مع أنيميشن سلس وبوب-آب داخلي تماماً
async function deleteCode(id) {
  Swal.fire({
    title: 'هل أنت متأكد؟',
    text: "لن تتمكن من استعادة هذا الكود الرقمي بعد حذفه!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#f43f5e',
    confirmButtonText: 'نعم، احذفه!',
    cancelButtonText: 'إلغاء',
    ...swalConfig
  }).then(async (result) => {
    if (result.isConfirmed) {
      try {
        await db.collection('productCodes').doc(id).delete();
        
        const row = document.getElementById(`row-${id}`);
        if (row) {
          row.style.transition = "all 0.3s ease";
          row.style.opacity = "0";
          row.style.transform = "translateX(30px)";
          
          setTimeout(() => {
            row.remove();
            const tbody = document.querySelector('#codesTablePro tbody');
            if (tbody && tbody.children.length === 0) {
              tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#64748b;">لا توجد أكواد مضافة حالياً</td></tr>';
            }
          }, 300);
        }
        
        await loadStats();

        // إشعار هادئ صغير أعلى الصفحة دون تجميد اللوحة
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'تم حذف الكود بنجاح',
          showConfirmButton: false,
          timer: 1500,
          background: '#101a26',
          color: '#fff'
        });

      } catch (err) {
        console.error("حدث خطأ أثناء محاولة حذف الكود السلس:", err);
      }
    }
  });
}

// حفظ الكوبونات
async function saveCoupon(){
  const code = val('couponCode').toUpperCase();
  const value = Number(val('couponValue') || 0);

  if(!code || !value){
    Swal.fire({
      icon: 'warning',
      title: 'بيانات ناقصة',
      text: 'الرمز وقيمة نسبة الخصم مطلوبين لتوليد الكوبون!',
      ...swalConfig
    });
    return;
  }

  await db.collection('coupons').doc(code).set({
    code,
    value,
    type: 'percent',
    active: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  if($('couponCode')) $('couponCode').value = '';
  if($('couponValue')) $('couponValue').value = '';

  await loadCoupons();
  
  Swal.fire({
    icon: 'success',
    title: 'تم تفعيل الكوبون',
    text: 'تم حفظ الكوبون وهو جاهز للاستخدام حالياً.',
    timer: 1500,
    showConfirmButton: false,
    ...swalConfig
  });
}

// جلب الكوبونات لعرضها
async function loadCoupons(){
  const snap = await db.collection('coupons').get();
  const list = $('couponsList');
  if(list) list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();
    if(list){
      list.innerHTML += `
        <div class="panel" style="border-bottom: 3px solid var(--neon-orange);">
          <h4>رمز الكوبون: <span style="color:var(--neon-orange); font-family:monospace;">${c.code}</span></h4>
          <p style="margin: 8px 0 4px 0;">نسبة الخصم: <strong>${c.value}%</strong></p>
          <small style="color: ${c.active ? 'var(--neon-green)' : 'var(--neon-pink)'}; font-weight: 600;">
            ${c.active ? '● مفعل حالياً' : '○ معطل'}
          </small>
        </div>
      `;
    }
  });
}

// جلب وعرض الطلبات في جدول منسق ومحمي للموبايل
async function loadOrders(){
  const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(50).get();

  const table = `
    <table>
      <tr>
        <th>رقم الطلب</th>
        <th>العميل</th>
        <th>المنتج</th>
        <th>الإجمالي</th>
        <th>الحالة</th>
        <th>الكود</th>
      </tr>
      ${snap.docs.map(doc => {
        const o = doc.data();
        const pName = o.productName || o.name || o.title || o.product_name || 'منتج رقمي';
        const orderPrice = Number(o.total || o.price || o.amount || 0);
        const customer = o.customerName || o.email || o.username || '-';
        const status = o.status || o.paymentStatus || o.payment_status || '-';
        const code = o.assignedCode || o.code || '-';

        return `
          <tr>
            <td>${o.orderId || doc.id.substring(0,8)}</td>
            <td>${customer}</td>
            <td>${pName}</td>
            <td><strong>${orderPrice} EGP</strong></td>
            <td><span class="status-badge">${status}</span></td>
            <td><code>${code}</code></td>
          </tr>
        `;
      }).join('')}
    </table>
  `;

  if($('ordersList')) $('ordersList').innerHTML = table;
  if($('latestOrders')) $('latestOrders').innerHTML = table;
}

// جلب بيانات العملاء
async function loadCustomers(){
  const snap = await db.collection('users').limit(100).get();

  if($('customersList')){
    $('customersList').innerHTML = `
      <table>
        <tr>
          <th>الاسم</th>
          <th>الإيميل</th>
          <th>الهاتف</th>
          <th>الدور</th>
        </tr>
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
      </table>
    `;
  }
}

// حساب المبيعات الحقيقية، العدادات، وتحديث الرسم البياني
async function loadStats(){
  try {
    const products = await db.collection('products').get();
    const orders = await db.collection('orders').get();
    const users = await db.collection('users').get();
    const codes = await db.collection('productCodes').where('status','==','available').get();

    let totalSales = 0;
    let chartDataMap = {};

    orders.forEach(doc => {
      const o = doc.data();
      const price = Number(o.total || o.price || o.amount || 0);
      totalSales += price;

      let dateKey = 'أخرى';
      if(o.createdAt) {
         const d = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
         dateKey = d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
      }
      chartDataMap[dateKey] = (chartDataMap[dateKey] || 0) + price;
    });

    if($('productsCount')) $('productsCount').textContent = products.size;
    if($('ordersCount')) $('ordersCount').textContent = orders.size;
    if($('codesCount')) $('codesCount').textContent = codes.size;
    if($('customersCount')) $('customersCount').textContent = users.size;
    if($('salesTotal')) $('salesTotal').textContent = totalSales.toLocaleString() + ' EGP';

    const chartLabels = Object.keys(chartDataMap).reverse();
    const chartValues = Object.values(chartDataMap).reverse();
    updateRevenueChart(chartLabels, chartValues);

    if($('topProducts')){
      $('topProducts').innerHTML = products.docs.slice(0,3).map((doc, i) => {
        const p = doc.data();
        return `
          <div class="alert success" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:rgba(101,204,0,0.05); border:1px solid rgba(101,204,0,0.1); padding:10px; border-radius:10px;">
            <span style="font-size:13px; font-weight:600;">#${i+1} — ${p.name || 'منتج'}</span>
            <strong style="color:var(--neon-green); font-size:14px;">${p.price || 0} EGP</strong>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
      console.error("حدث خطأ أثناء جلب العدادات والرسم البياني: ", error);
  }
}

// دالة تحديث الرسوم البيانية بسلاسة وبدون تداخلات
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
                labels: finalLabels,
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

// تسجيل الخروج بأكشن تأكيدي فخم
function logout(){
  Swal.fire({
    title: 'تسجيل الخروج؟',
    text: "هل أنت متأكد من رغبتك في مغادرة اللوحة الحالية؟",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    confirmButtonText: 'خروج اكيد',
    cancelButtonText: 'بقاء',
    ...swalConfig
  }).then((result) => {
    if (result.isConfirmed) {
      firebase.auth().signOut().then(() => {
          location.href = '/login.html';
      });
    }
  });
}
