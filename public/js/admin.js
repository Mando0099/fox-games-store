/* ==========================================================================
   Fox Store Admin - Ultimate Core Logic & Live Database Sync (Fixed & Pro)
   ========================================================================== */

let db = null;
let currentUser = null;
let revenueChartInstance = null;

const $ = (id) => document.getElementById(id);

// 📱 تحكم السايدبار الذكي للموبايل (قائمة برجر والـ Overlay الخلفي)
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
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
        const targetBtn = document.querySelector(`[onclick*="${id}"]`);
        if (targetBtn) targetBtn.classList.add('active');
    }

    // 3. الحل الجذري للموبايل: إجبار القائمة والـ Overlay على الإغلاق فوراً عند التنقل
    const sidebar = document.querySelector('.sidebar');
    const overlay = $('sidebarOverlay');
    
    if (sidebar) sidebar.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

// دالة جلب قيم المدخلات بأمان
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

  try {
    const adminCheck = await db.collection('admins')
      .where('email','==',user.email)
      .where('active','==',true)
      .limit(1)
      .get();

    if(adminCheck.empty){
      alert('عذراً، هذا الحساب ليس لديه صلاحيات المسؤول (Admin)');
      location.href = '/';
      return;
    }

    await loadAll();
  } catch (error) {
      console.error("خطأ أثناء فحص صلاحيات الأدمن:", error);
  }
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

// تفريغ فورم المنتجات بالكامل وإعادة ضبط المعاينة
function clearProductForm(){
  ['productId','name','category','game','amount','price','description']
    .forEach(id => {
      const el = $(id);
      if(el) el.value = '';
    });

  const imageFile = $('imageFile');
  if(imageFile) imageFile.value = '';

  const preview = $('imagePreview');
  if(preview) {
      preview.src = '';
      preview.style.display = 'none';
  }

  const active = $('active');
  if(active) active.checked = true;
}

// حفظ أو تحديث منتج
async function saveProduct(){
  const file = document.getElementById('imageFile').files[0];
  let imageUrl = '';
  
  // حل مشكلة الاحتفاظ بالصورة القديمة عند تعديل المنتج
  const preview = $('imagePreview');
  if (preview && preview.style.display !== 'none') {
      imageUrl = preview.src;
  }
  
  if(file){
    imageUrl = await uploadImage(file);
  }

  const data = {
    name: val('name'),
    category: val('category'), 
    game: val('game'),
    amount: Number(val('amount') || 0),
    price: Number(val('price') || 0),
    image: imageUrl,
    description: val('description'),
    active: $('active').checked,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if(!data.name || !data.price || !data.category){
    alert('اسم المنتج، التصنيف، والسعر حقول مطلوبة واجبارية!');
    return;
  }

  const id = val('productId');

  try {
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
    alert('تم حفظ المنتج وتحديث قواعد البيانات بنجاح 💎');
  } catch(err) {
      console.error("خطأ أثناء حفظ المنتج:", err);
      alert("فشل حفظ المنتج، راجع 콘솔 اللوحة لمزيد من التفاصيل.");
  }
}

// جلب المنتجات وعرضها بالتصميم الـ Gaming الجديد المتجاوب
async function loadProducts(){
  const snap = await db.collection('products').get();
  const list = $('productsList');
  const select = $('codeProductId');

  if(list) list.innerHTML = '';
  if(select) select.innerHTML = '<option value="">اختر المنتج</option>';

  snap.forEach(doc => {
    const p = doc.data();

    if(select){
      select.innerHTML += `<option value="${doc.id}">${p.name || 'منتج بدون اسم'}</option>`;
    }

    if(list){
      list.innerHTML += `
        <div class="product-card-custom">
          <div class="product-card-hero">
            <img src="${p.image || '/assets/default-game.jpg'}" alt="${p.name}">
            <span class="product-badge" style="background: ${p.active ? 'var(--neon-blue)' : 'var(--neon-pink)'};">
                ${p.active ? 'نشط' : 'مخفي'}
            </span>
          </div>
          <div class="product-card-body">
            <div>
              <h4>${p.name || '-'}</h4>
              <p style="margin-bottom: 4px;">التصنيف: <span style="color:var(--text-main);">${p.category || '-'}</span></p>
              <p>اللعبة: <span style="color:var(--text-main);">${p.game || '-'}</span></p>
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

// تعديل منتج وجلبه للفورم علوياً
async function editProduct(id){
  const doc = await db.collection('products').doc(id).get();
  const p = doc.data();

  if($('productId')) $('productId').value = id;
  if($('name')) $('name').value = p.name || '';
  if($('category')) $('category').value = p.category || '';
  if($('game')) $('game').value = p.game || '';
  if($('amount')) $('amount').value = p.amount || '';
  if($('price')) $('price').value = p.price || '';
  if($('description')) $('description').value = p.description || '';
  if($('active')) $('active').checked = p.active !== false;

  // إظهار معاينة الصورة القديمة بالفورم
  const preview = $('imagePreview');
  if(preview && p.image) {
      preview.src = p.image;
      preview.style.display = 'block';
  }

  showPage('products', document.querySelector('[onclick*="products"]'));
  scrollTo({top:0, behavior:'smooth'});
}

// حذف منتج
async function deleteProduct(id){
  if(!confirm('هل أنت متأكد من حذف هذا المنتج نهائياً من المتجر؟')) return;
  await db.collection('products').doc(id).delete();
  await loadProducts();
  await loadStats();
}

// رفع الصور إلى سيرفرات Cloudinary
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
  const image = file ? await uploadImage(file) : '';

  if(!name){
    alert('اسم التصنيف حقل إلزامي!');
    return;
  }

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
  alert('تم إضافة التصنيف الجديد بنجاح');
}

// جلب التصنيفات الحقيقية وتحديث الكروت وقوائم الاختيارات المنسدلة
async function loadCategories(){
  const snap = await db.collection('categories').get();
  const list = $('categoriesList');
  const productCatSelect = $('category');
  
  if(list) list.innerHTML = '';
  if(productCatSelect) productCatSelect.innerHTML = '<option value="">اختر التصنيف المتاح...</option>';

  snap.forEach(doc => {
    const c = doc.data();
    
    if(productCatSelect && c.name){
       productCatSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    }

    if(list){
      list.innerHTML += `
        <div class="product-card-custom">
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
async function deleteCategory(id){
  if(!confirm('هل تريد حذف هذا التصنيف بالكامل؟')) return;
  await db.collection('categories').doc(id).delete();
  await loadCategories();
}

// حفظ أكواد المنتجات (تسريب الأكواد كأجزاء منفصلة)
async function saveCodes(){
  const productId = val('codeProductId');
  const raw = val('codesInput');

  if(!productId || !raw){
    alert('الرجاء اختيار المنتج أولاً ثم كتابة الأكواد');
    return;
  }

  const codes = raw.split('\n').map(c => c.trim()).filter(Boolean);

  for(const code of codes){
    await db.collection('productCodes').add({
      productId,
      code,
      status: 'available',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  if($('codesInput')) $('codesInput').value = '';
  await loadCodes();
  await loadStats();

  alert(`تم حفظ وتخزين (${codes.length}) كود رقمي بنجاح فوري!`);
}

// جلب الأكواد لعرضها في الكروت
async function loadCodes(){
  const snap = await db.collection('productCodes').limit(100).get();
  const list = $('codesList');
  if(list) list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();
    if(list){
      list.innerHTML += `
        <div class="panel" style="border-left: 3px solid var(--neon-blue); padding: 15px; margin-bottom:10px;">
          <h3 style="font-size:15px; color:var(--text-main); font-family: monospace; letter-spacing: 1px;">${c.code || '-'}</h3>
          <p style="font-size:12px; color:var(--text-muted); margin-top:5px;">ID المنتج: ${c.productId || '-'}</p>
          <span class="status-badge" style="display:inline-block; margin-top:8px; font-size:11px; background: rgba(59,130,246,0.1); color: var(--neon-blue); padding:2px 8px; border-radius:4px;">${c.status || '-'}</span>
        </div>
      `;
    }
  });
}

// حفظ الكوبونات لـ داتابيز فوكس استور
async function saveCoupon(){
  const code = val('couponCode').toUpperCase();
  const value = Number(val('couponValue') || 0);

  if(!code || !value){
    alert('رمز الكوبون وقيمة الخصم مطلوبين');
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
  alert('تم تفعيل وحفظ كوبون الخصم بنجاح');
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
        <div class="panel" style="border-bottom: 3px solid var(--neon-orange); margin-bottom:15px;">
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

// جلب وعرض الطلبات في جدول منسق ومحمي للموبايل مع تلوين الحالات ذكياً
async function loadOrders(){
  const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(50).get();

  const tableBody = snap.docs.map(doc => {
        const o = doc.data();
        const pName = o.productName || o.name || o.title || o.product_name || 'منتج رقمي';
        const orderPrice = Number(o.total || o.price || o.amount || 0);
        const customer = o.customerName || o.email || o.username || '-';
        const status = (o.status || o.paymentStatus || o.payment_status || '-').toLowerCase();
        const code = o.assignedCode || o.code || 'في انتظار الدفع';

        // تلوين ذكي لحالة الطلب والدفع لقيم احترافية نيون بالجدول
        let statusColor = 'var(--text-muted)';
        if(status === 'completed' || status === 'paid' || status === 'نجاح') statusColor = 'var(--neon-green)';
        if(status === 'pending' || status === 'قيد الانتظار') statusColor = 'var(--neon-orange)';
        if(status === 'failed' || status === 'فشل') statusColor = 'var(--neon-pink)';

        return `
          <tr>
            <td>${o.orderId || doc.id.substring(0,8)}</td>
            <td>${customer}</td>
            <td>${pName}</td>
            <td><strong style="color:var(--neon-green);">${orderPrice} EGP</strong></td>
            <td><span class="status-badge" style="color: ${statusColor}; font-weight:700;">${status.toUpperCase()}</span></td>
            <td><code style="background:var(--bg-input); padding:4px 8px; border-radius:6px; color:var(--neon-purple);">${code}</code></td>
          </tr>
        `;
  }).join('');

  const tableHTML = `
    <table>
      <tr>
        <th>رقم الطلب</th>
        <th>العميل</th>
        <th>المنتج</th>
        <th>الإجمالي</th>
        <th>الحالة</th>
        <th>الكود المُسلم</th>
      </tr>
      ${tableBody}
    </table>
  `;

  if($('ordersList')) $('ordersList').innerHTML = tableHTML;
  if($('latestOrders')) $('latestOrders').innerHTML = tableHTML;
}

// جلب بيانات العملاء بالجدول الخاص بهم
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
              <td><span style="color: ${u.role === 'admin' ? 'var(--neon-purple)' : 'var(--text-muted)'}; font-weight:600;">${u.role || 'user'}</span></td>
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
          <div class="alert success" style="margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:rgba(101,204,0,0.03); border:1px solid rgba(101,204,0,0.08); padding:12px; border-radius:10px;">
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

    // الحل النهائي: منع تداخل كائنات الرسم البياني وتحديث البيانات حياً بشكل مباشر ومستقر
    if (revenueChartInstance) {
        revenueChartInstance.data.labels = finalLabels;
        revenueChartInstance.data.datasets[0].data = finalData;
        revenueChartInstance.update();
    } else {
        const ctxGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        ctxGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
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
                    pointHoverBackgroundColor: '#fff',
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#142032',
                      titleFont: { family: 'Cairo' },
                      bodyFont: { family: 'Cairo' },
                      borderColor: 'rgba(255,255,255,0.08)',
                      borderWidth: 1
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: 'Cairo' } } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#94a3b8', font: { family: 'Cairo' } } }
                }
            }
        });
    }
}

// تسجيل الخروج
function logout(){
  if(!confirm('هل تود تسجيل الخروج من لوحة التحكم؟')) return;
  firebase.auth().signOut().then(() => {
      location.href = '/login.html';
  });
}
