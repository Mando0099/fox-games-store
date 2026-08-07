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
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// 🔄 تنقل التابات والصفحات مع الإغلاق التلقائي الأكيد للموبايل
function showPage(pageName, btn) {
    // إخفاء كافة الصفحات وتفعيل الصفحة المطلوبة بناءً على الصيغة الجديدة id-page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = $(`${pageName}-page`);
    if (targetPage) targetPage.classList.add('active');

    // تحديث حالة أزرار القائمة الجانبية (الزر النشط)
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
    } else {
        const targetBtn = document.querySelector(`[onclick*="'${pageName}'"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }

    // إغلاق القائمة والـ Overlay فوراً عند التنقل على الأجهزة المحمولة
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// دالة جلب قيم المدخلات
function val(id) {
    return ($(id)?.value || '').trim();
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
  await loadAll();
});

// تحميل كافة البيانات والعدادات فور الدخول للوحة
async function loadAll() {
  await loadCategories(); // جلب التصنيفات أولاً لتغذية القوائم المنسدلة
  await loadProducts();
  await loadCodes();
  await loadOrders();
  await loadCoupons();
  await loadCustomers();
  await loadStats();
  await loadPaymentGateways(); // جلب بوابات الدفع وإدارتها
}

// 🌐 تهيئة مستمعي الأحداث والـ Drag & Drop لمنطقة رفع صور المنتجات
function initEventListeners() {
    const dropzone = $('dropzone');
    const fileInput = $('product-image');
    const previewContainer = $('img-preview-container');
    const imagePreview = $('imagePreview');
    const removeImgBtn = $('remove-img');
    const clearFormBtn = $('clear-form');
    const menuBtn = $('menuBtn');

    if (menuBtn) {
        menuBtn.addEventListener('click', toggleSidebar);
    }

    if (dropzone && fileInput) {
        dropzone.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', function() {
            handleProductFileSelect(this.files[0]);
        });

        // تأثيرات السحب فوق المنطقة
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

    // زر إزالة معاينة الصورة
    if (removeImgBtn) {
        removeImgBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // منع فتح نافذة اختيار الملفات
            if (fileInput) fileInput.value = '';
            if (previewContainer) previewContainer.classList.remove('active');
            if (imagePreview) imagePreview.src = '';
        });
    }

    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearProductForm);
    }

    // ربط فلاتر جدول الأكواد المتقدم تلقائياً
    if ($('search-codes-input')) {
        $('search-codes-input').addEventListener('input', filterCodesTablePro);
    }
    if ($('filter-status-select')) {
        $('filter-status-select').addEventListener('change', filterCodesTablePro);
    }
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

// تفريغ فورم المنتجات بالكامل وإعادة ضبط غلاف المعاينة التفاعلي
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

// 📸 دالة رفع الصور إلى Cloudinary مع معالجة الأخطاء
async function uploadImage(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'FOX-GAMES');

    const res = await fetch(
      'https://api.cloudinary.com/v1_1/denwwcqoe/image/upload',
      { method: 'POST', body: formData }
    );

    if (!res.ok) {
      throw new Error('فشل رفع الصورة إلى سيرفر الصور');
    }

    const data = await res.json();
    return data.secure_url;
  } catch (error) {
    console.error("Upload Error:", error);
    throw error;
  }
}

// 💾 حفظ أو تحديث منتج بشكل آمن ومحمي
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
      image: imageUrl.startsWith('data:') ? '' : imageUrl, // تأمين خلو الرابط من بيانات الكاش المحلية
      description: val('description'),
      active: $('active') ? $('active').checked : true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const id = val('productId');

    if (id) {
      await db.collection('products').doc(id).set(data, { merge: true });
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

// جلب المنتجات وعرضها بالتصميم الـ Gaming الجديد المتجاوب
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
                <button class="edit-btn" onclick="editProduct('${doc.id}')" title="تعديل"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="delete-btn" onclick="deleteProduct('${doc.id}')" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  });
}

// تعديل منتج وإرسال بياناته للفورم مع تفعيل الغلاف التفاعلي
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

// حذف منتج بأكشن وتأكيد داخلي متقدم
async function deleteProduct(id) {
  Swal.fire({
    title: 'تأكيد حذف المنتج؟',
    text: "سيتم إزالة هذا المنتج نهائياً من المتجر واختفاء كروته التعريفية للعملاء!",
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
      if (prodCard) {
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

// حفظ تصنيف جديد آمن
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
      text: 'تم حفظ التصنيف بنجاح فوري وجاري تغذية الفورم.',
      timer: 1500,
      showConfirmButton: false,
      ...swalConfig
    });
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'خطأ في الإضافة',
      text: 'تعذر رفع الصورة أو حفظ التصنيف، يرجى المحاولة لاحقاً.',
      ...swalConfig
    });
  }
}

// جلب التصنيفات الحقيقية وتحديث الكروت وقوائم الاختيارات المنسدلة
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
async function deleteCategory(id) {
  Swal.fire({
    title: 'هل تريد حذف هذا التصنيف؟',
    text: "تأكد أنه لا توجد منتجات نشطة معتمدة عليه حالياً لتفادي تلف العرض الداخلي للعميل.",
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
      if (catCard) {
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
async function saveCodes() {
  const productId = val('codeProductId');
  const raw = val('codesInput');

  if (!productId || !raw) {
    Swal.fire({
      icon: 'warning',
      title: 'بيانات غير مكتملة',
      text: 'برجاء اختيار المنتج واكتب الأكواد أولاً داخل الحقل المخصص للشحن التلقائي.',
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
    text: `تم حفظ وحقن (${codes.length}) كود رقمي بنجاح فوري وجاهز للتسليم الآلي!`,
    ...swalConfig
  });
}

// 📊 جلب وتوليد صفوف جدول الأكواد المتطورة داخل الحاوية الجديدة
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
      ? 'background: rgba(101, 204, 0, 0.1); color: #65cc00; border: 1px solid rgba(101, 204, 0, 0.2);' 
      : 'background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2);';

    rowsHtml += `
      <tr id="row-${doc.id}" data-status="${c.status}" data-product-name="${productName.toLowerCase()}">
        <td style="font-family: monospace; letter-spacing: 1px; font-weight: 600; color: #fff; text-align: right; direction: ltr; padding-right: 20px;">${c.code || '-'}</td>
        <td><span style="color: #3b82f6; font-weight: 600; font-size: 14px;">${productName}</span></td>
        <td><span class="status-badge" style="padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block; ${badgeStyle}">${statusText}</span></td>
        <td>
          <button class="delete-btn" style="padding: 6px 10px; font-size: 12px; background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.1);" onclick="deleteCode('${doc.id}')" title="حذف الكود نهائياً">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });

  container.innerHTML = rowsHtml;
}

// 🔍 محرك الفلترة والبحث اللحظي لجدول الأكواد المحدث 
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

// 🗑️ دالة حذف كود محدد نهائياً مع أنيميشن سلس وبوب-آب داخلي
async function deleteCode(id) {
  Swal.fire({
    title: 'هل أنت متأكد؟',
    text: "لن تتمكن من استعادة هذا الكود الرقمي التسلسلي بعد حذفه من السجلات!",
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
          row.style.transform = "translateX(-30px)";
          
          setTimeout(() => {
            row.remove();
            const container = $('codes-list-container');
            if (container && container.children.length === 0) {
              container.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#64748b;">لا توجد أكواد مضافة حالياً في قاعدة البيانات</td></tr>';
            }
          }, 300);
        }
        
        await loadStats();

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
        console.error("حدث خطأ أثناء محاولة حذف الكود: ", err);
      }
    }
  });
}

// حفظ الكوبونات وقسائم التخفيض المالي
async function saveCoupon() {
  const code = val('couponCode').toUpperCase();
  const value = Number(val('couponValue') || 0);

  if (!code || !value) {
    Swal.fire({
      icon: 'warning',
      title: 'بيانات ناقصة',
      text: 'الرمز وقيمة نسبة الخصم المئوية مطلوبين لتوليد الكوبون الفعال الحركي!',
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

  if ($('couponCode')) $('couponCode').value = '';
  if ($('couponValue')) $('couponValue').value = '';

  await loadCoupons();
  
  Swal.fire({
    icon: 'success',
    title: 'تم تفعيل الكوبون',
    text: 'تم حفظ الكوبون بنجاح وهو متاح للمستعملين بالمتجر الرقمي حالياً.',
    timer: 1500,
    showConfirmButton: false,
    ...swalConfig
  });
}

// جلب الكوبونات لعرضها
async function loadCoupons() {
  const snap = await db.collection('coupons').get();
  const list = $('couponsList');
  if (list) list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();
    if (list) {
      list.innerHTML += `
        <div class="panel" style="border-bottom: 3px solid #f97316;">
          <h4>رمز الكوبون: <span style="color:#f97316; font-family:monospace;">${c.code}</span></h4>
          <p style="margin: 8px 0 4px 0;">نسبة الخصم الحالية: <strong>${c.value}%</strong></p>
          <small style="color: ${c.active ? '#22c55e' : '#ec4899'}; font-weight: 600;">
            ${c.active ? '● مفعل حالياً بالمتجر' : '○ معطل وموقوف'}
          </small>
        </div>
      `;
    }
  });
}

// جلب وعرض الطلبات وفواتير الشراء تلقائياً
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
        const pName = o.productName || o.name || o.title || o.product_name || 'منتج رقمي الشحنة';
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
      </tbody>
    </table>
  `;

  if ($('ordersList')) $('ordersList').innerHTML = table;
  if ($('latestOrders')) $('latestOrders').innerHTML = table;
}

// جلب وسجلات قاعدة بيانات العملاء
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

// ==========================================
// 💳 إدارة بوابات الدفع (Payment Gateways API)
// ==========================================

// 1. جلب وعرض بوابات الدفع المسجلة وحالتها الحالية
async function loadPaymentGateways() {
  const container = $('paymentGatewaysList') || $('payment-gateways-container');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/payment-gateways');
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div style="color: #f43f5e; padding: 15px; text-align: center;">فشل جلب بيانات البوابات: ${data.message}</div>`;
      return;
    }

    const gateways = data.gateways || [];
    if (!gateways.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 25px; color: #64748b;">
          لا توجد بوابات دفع مضافة حالياً. يمكنك إضافة بوابة MyFatoorah أو Paymob أدناه.
        </div>`;
      return;
    }

    let html = '';
    gateways.forEach(g => {
      const isLive = Boolean(g.isLive);
      const isActive = Boolean(g.isActive);

      html += `
        <div class="panel" style="border: 1px solid ${isActive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.08)'}; margin-bottom: 15px; padding: 18px; border-radius: 12px; background: #0f172a; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="margin: 0; color: #fff; font-size: 18px; display: flex; align-items: center; gap: 8px;">
                ${g.name || g.provider}
                <span style="font-size: 11px; padding: 3px 10px; border-radius: 20px; ${isActive ? 'background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.3);' : 'background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3);'}">
                  ${isActive ? '● نشط حالياً بالمتجر' : '○ غير مفعل'}
                </span>
              </h3>
              <span style="font-size: 12px; color: #64748b; margin-top: 4px; display: block;">مزود الخدمة: <strong>${(g.provider || 'myfatoorah').toUpperCase()}</strong></span>
            </div>

            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <!-- زر التحويل بين Live و Demo -->
              <button class="btn" onclick="toggleGatewayLive('${g.id}', ${!isLive})" style="padding: 6px 14px; font-size: 12px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; ${isLive ? 'background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4);' : 'background: rgba(59, 130, 246, 0.2); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.4);'}">
                <i class="fa-solid ${isLive ? 'fa-bolt' : 'fa-vial'}"></i> ${isLive ? 'الوضع الحقيقي (Live)' : 'وضع التجربة (Demo)'}
              </button>

              <!-- زر تفعيل البوابة للمتجر -->
              ${!isActive ? `
                <button class="btn" onclick="activateGateway('${g.id}')" style="padding: 6px 14px; font-size: 12px; background: #22c55e; color: #fff; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                  تفعيل للبوابة
                </button>
              ` : ''}

              <!-- زر تعديل الإعدادات -->
              <button class="edit-btn" onclick='fillGatewayForm(${JSON.stringify(g).replace(/'/g, "&apos;")})' style="padding: 6px 12px; font-size: 12px; border-radius: 8px;">
                <i class="fa-solid fa-gear"></i> تعديل
              </button>
            </div>
          </div>

          <!-- تفاصيل المفاتيح المشفرة والروابط -->
          <div style="margin-top: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; font-size: 12px; background: rgba(0,0,0,0.25); padding: 12px; border-radius: 8px; color: #94a3b8;">
            <div>🔐 المفتاح الأساسي (Token): <strong style="color: ${g.tokenSet ? '#22c55e' : '#f43f5e'};">${g.tokenSet ? '🔒 مشفر ومحفوظ' : '❌ غير مضاف'}</strong></div>
            <div>🛡️ المفتاح السري (Secret Key): <strong style="color: ${g.secretKeySet ? '#22c55e' : '#64748b'};">${g.secretKeySet ? '🔒 مشفر ومحفوظ' : '⚪ اختياري'}</strong></div>
            <div style="grid-column: span 2;">🌐 الرابط المستخدم حالياً: <code style="color: #60a5fa; direction: ltr; display: inline-block;">${isLive ? (g.liveUrl || 'Live Default') : (g.sandboxUrl || 'https://apitest.myfatoorah.com')}</code></div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    console.error("Error loading gateways:", err);
  }
}

// 2. حفظ أو تحديث بوابة دفع مع إرسال المفاتيح لتشفيرها بالسيرفر
async function savePaymentGateway() {
  const id = val('gwId') || val('gwProvider');
  const name = val('gwName');
  const provider = val('gwProvider') || 'myfatoorah';
  const sandboxUrl = val('gwSandboxUrl');
  const liveUrl = val('gwLiveUrl');
  const token = val('gwToken');
  const secretKey = val('gwSecretKey');
  const webhookSecret = val('gwWebhookSecret');
  const merchantId = val('gwMerchantId');
  const isLive = $('gwIsLive') ? $('gwIsLive').checked : false;
  const isActive = $('gwIsActive') ? $('gwIsActive').checked : false;

  if (!name || !provider) {
    Swal.fire({
      icon: 'warning',
      title: 'بيانات ناقصة',
      text: 'اسم البوابة ومزود الخدمة حقول مطلوبة لإكمال عملية التكوين!',
      ...swalConfig
    });
    return;
  }

  try {
    Swal.fire({
      title: 'جاري حفظ وتشفير المفاتيح...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); },
      ...swalConfig
    });

    const res = await fetch('/api/admin/payment-gateways', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id, name, provider, sandboxUrl, liveUrl, token, secretKey, webhookSecret, merchantId, isLive, isActive
      })
    });

    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: 'تم التحديث بنجاح',
        text: data.message,
        timer: 1800,
        showConfirmButton: false,
        ...swalConfig
      });
      clearPaymentGatewayForm();
      await loadPaymentGateways();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'خطأ في الحفظ',
      text: err.message || 'تعذر حفظ إعدادات البوابة، يرجى المحاولة لاحقاً.',
      ...swalConfig
    });
  }
}

// 3. التحويل اللحظي بين وضع التجربة Sandbox والوضع الحقيقي Live
async function toggleGatewayLive(id, targetIsLive) {
  try {
    const res = await fetch('/api/admin/payment-gateways/toggle-live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isLive: targetIsLive })
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: data.message,
        showConfirmButton: false,
        timer: 2000,
        background: '#101a26',
        color: '#fff'
      });
      await loadPaymentGateways();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'خطأ', text: err.message, ...swalConfig });
  }
}

// 4. تفعيل البوابة المحددة وإلغاء تفعيل الباقين
async function activateGateway(id) {
  try {
    const res = await fetch('/api/admin/payment-gateways/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: data.message,
        showConfirmButton: false,
        timer: 2000,
        background: '#101a26',
        color: '#fff'
      });
      await loadPaymentGateways();
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'خطأ', text: err.message, ...swalConfig });
  }
}

// 5. تعبئة بيانات البوابة بالفورم عند الضغط على زر التعديل
function fillGatewayForm(g) {
  if ($('gwId')) $('gwId').value = g.id || '';
  if ($('gwName')) $('gwName').value = g.name || '';
  if ($('gwProvider')) $('gwProvider').value = g.provider || '';
  if ($('gwSandboxUrl')) $('gwSandboxUrl').value = g.sandboxUrl || '';
  if ($('gwLiveUrl')) $('gwLiveUrl').value = g.liveUrl || '';
  if ($('gwMerchantId')) $('gwMerchantId').value = g.merchantId || '';
  if ($('gwIsLive')) $('gwIsLive').checked = Boolean(g.isLive);
  if ($('gwIsActive')) $('gwIsActive').checked = Boolean(g.isActive);

  // يترك حقل المفاتيح فارغاً للأمان إلا إذا رغب الأدمن بتحديثها
  if ($('gwToken')) $('gwToken').value = '';
  if ($('gwSecretKey')) $('gwSecretKey').value = '';
  if ($('gwWebhookSecret')) $('gwWebhookSecret').value = '';

  scrollTo({ top: 0, behavior: 'smooth' });
}

// 6. تفريغ فورم البوابات
function clearPaymentGatewayForm() {
  ['gwId', 'gwName', 'gwProvider', 'gwSandboxUrl', 'gwLiveUrl', 'gwToken', 'gwSecretKey', 'gwWebhookSecret', 'gwMerchantId']
    .forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });
  if ($('gwIsLive')) $('gwIsLive').checked = false;
  if ($('gwIsActive')) $('gwIsActive').checked = false;
}

// ⚡ حساب المبيعات الحقيقية والعدادات الشاملة بسرعة فائقة عبر Promise.all
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

    if ($('topProducts')) {
      $('topProducts').innerHTML = products.docs.slice(0, 3).map((doc, i) => {
        const p = doc.data();
        return `
          <div class="alert success" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:rgba(101,204,0,0.05); border:1px solid rgba(101,204,0,0.1); padding:10px; border-radius:10px;">
            <span style="font-size:13px; font-weight:600;">#${i+1} — ${p.name || 'منتج'}</span>
            <strong style="color:#22c55e; font-size:14px;">${p.price || 0} EGP</strong>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
      console.error("حدث خطأ أثناء جلب العدادات الشاملة والرسم البياني: ", error);
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

// تسجيل الخروج بأكشن تأكيدي متكامل
function logout() {
  Swal.fire({
    title: 'تسجيل الخروج؟',
    text: "هل أنت متأكد من رغبتك في مغادرة لوحة التحكم الحالية؟",
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3b82f6',
    confirmButtonText: 'خروج أكيد',
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
