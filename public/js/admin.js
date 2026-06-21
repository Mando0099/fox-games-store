let db = null;
let currentUser = null;
let revenueChartInstance = null;

const $ = (id) => document.getElementById(id);

// تنقل التابات والصفحات
function showPage(id, btn){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if($(id)) $(id).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
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
    alert('هذا الحساب ليس أدمن');
    location.href = '/';
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
    alert('اسم المنتج، التصنيف، والسعر حقول مطلوبة');
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
  alert('تم حفظ المنتج بنجاح');
}

// جلب المنتجات وعرضها
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
        <div class="panel">
          ${p.image ? `<img src="${p.image}" style="width:100%;height:160px;object-fit:cover;border-radius:14px;margin-bottom:12px">` : ''}
          <h3>${p.name || '-'}</h3>
          <p>التصنيف: ${p.category || '-'}</p>
          <p>اللعبة: ${p.game || '-'}</p>
          <p>السعر: ${p.price || 0} EGP</p>
          <p>الحالة: ${p.active ? 'نشط' : 'مخفي'}</p>
          <div class="actions">
            <button onclick="editProduct('${doc.id}')">تعديل</button>
            <button class="ghost delete-btn" onclick="deleteProduct('${doc.id}')">حذف</button>
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

// حذف منتج
async function deleteProduct(id){
  if(!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
  await db.collection('products').doc(id).delete();
  await loadProducts();
  await loadStats();
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
  const image = file ? await uploadImage(file) : '';

  if(!name){
    alert('اسم التصنيف مطلوب');
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
  alert('تم حفظ التصنيف بنجاح');
}

// جلب التصنيفات الحقيقية وتحديث قائمة الخيارات (Dropdown) في صفحة المنتجات فوراً
async function loadCategories(){
  const snap = await db.collection('categories').get();
  const list = $('categoriesList');
  const productCatSelect = $('category'); // استهداف عنصر السيلكت في إضافة المنتجات
  
  if(list) list.innerHTML = '';
  if(productCatSelect){
     productCatSelect.innerHTML = '<option value="">اختر التصنيف المتاح...</option>';
  }

  snap.forEach(doc => {
    const c = doc.data();
    
    // 1. إضافة التصنيف كخيار داخل قائمة إضافة المنتجات لمنع التعليق
    if(productCatSelect && c.name){
       productCatSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    }

    // 2. عرض التصنيفات في قسم إدارة التصنيفات المخصصة باللوحة
    if(list){
      list.innerHTML += `
        <div class="panel">
          ${c.image ? `<img src="${c.image}" style="width:100%;height:140px;object-fit:cover;border-radius:14px;margin-bottom:12px">` : ''}
          <h3>${c.name || '-'}</h3>
          <button class="delete-btn" onclick="deleteCategory('${doc.id}')">حذف</button>
        </div>
      `;
    }
  });
}

// حذف تصنيف
async function deleteCategory(id){
  if(!confirm('هل تريد حذف هذا التصنيف؟')) return;
  await db.collection('categories').doc(id).delete();
  await loadCategories();
}

// حفظ أكواد المنتجات
async function saveCodes(){
  const productId = val('codeProductId');
  const raw = val('codesInput');

  if(!productId || !raw){
    alert('اختر المنتج واكتب الأكواد أولاً');
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

  alert('تم حفظ الأكواد بنجاح، العدد: ' + codes.length);
}

// جلب الأكواد
async function loadCodes(){
  const snap = await db.collection('productCodes').limit(100).get();
  const list = $('codesList');
  if(list) list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();
    if(list){
      list.innerHTML += `
        <div class="panel">
          <h3>${c.code || '-'}</h3>
          <p>Product ID: ${c.productId || '-'}</p>
          <p>الحالة: ${c.status || '-'}</p>
        </div>
      `;
    }
  });
}

// حفظ الكوبونات
async function saveCoupon(){
  const code = val('couponCode').toUpperCase();
  const value = Number(val('couponValue') || 0);

  if(!code || !value){
    alert('الكود وقيمة الخصم مطلوبين');
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
  alert('تم حفظ الكوبون بنجاح');
}

// جلب الكوبونات
async function loadCoupons(){
  const snap = await db.collection('coupons').get();
  const list = $('couponsList');
  if(list) list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();
    if(list){
      list.innerHTML += `
        <div class="panel">
          <h3>${c.code}</h3>
          <p>خصم: ${c.value}%</p>
          <p>${c.active ? 'مفعل' : 'مغلق'}</p>
        </div>
      `;
    }
  });
}

// جلب وعرض الطلبات
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

// دالة تحديث الرسوم البيانية
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

// تسجيل الخروج
function logout(){
  firebase.auth().signOut().then(() => {
      location.href = '/login.html';
  });
}
