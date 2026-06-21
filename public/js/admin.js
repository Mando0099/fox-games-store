let db = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);

// تنقل التابات والصفحات
function showPage(id, btn){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    if($(id)) $(id).classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');
}

// دالة جلب قيم المدخلات بدون تكرار
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
  await loadProducts();
  await loadCategories();
  await loadCodes();
  await loadOrders();
  await loadCoupons();
  await loadCustomers();
  await loadStats();
}

// تفريغ فورم المنتجات بعد الحفظ أو التعديل
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
  console.log("FILE =", file);

  let imageUrl = '';
  if(file){
    imageUrl = await uploadImage(file);
    console.log("IMAGE URL =", imageUrl);
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

  if(!data.name || !data.price){
    alert('اسم المنتج والسعر مطلوبين');
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

// جلب المنتجات وعرضها في كروت اللوحة والـ Select
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

// تعديل منتج موجود مسبقاً
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
    {
      method: 'POST',
      body: formData
    }
  );

  const data = await res.json();
  console.log(data);
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

// جلب التصنيفات
async function loadCategories(){
  const snap = await db.collection('categories').get();
  const list = $('categoriesList');
  if(list) list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();
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

// حفظ أكواد المنتجات الرقمية
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

// جلب وعرض الأكواد
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
  const snap = await db.collection('orders').limit(50).get();

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
        return `
          <tr>
            <td>${o.orderId || doc.id}</td>
            <td>${o.customerName || o.email || '-'}</td>
            <td>${o.productName || '-'}</td>
            <td>${o.total || o.price || 0} EGP</td>
            <td>${o.status || o.paymentStatus || '-'}</td>
            <td>${o.assignedCode || '-'}</td>
          </tr>
        `;
      }).join('')}
    </table>
  `;

  if($('ordersList')) $('ordersList').innerHTML = table;
  if($('latestOrders')) $('latestOrders').innerHTML = table;
}

// جلب بيانات العملاء المسجلين بالـ Database
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

// 🔧 دالة حساب المبيعات والعدادات الذكية الحية 🔧
async function loadStats(){
  try {
    const products = await db.collection('products').get();
    const orders = await db.collection('orders').get();
    const users = await db.collection('users').get();
    const codes = await db.collection('productCodes').where('status','==','available').get();

    let total = 0;
    orders.forEach(doc => {
      const o = doc.data();
      // جمع الحقل المتاح سواء كان اسمه total أو price وتحويله لرقم لضمان عدم حدوث مشاكل
      total += Number(o.total || o.price || 0);
    });

    if($('productsCount')) $('productsCount').textContent = products.size;
    if($('ordersCount')) $('ordersCount').textContent = orders.size;
    if($('codesCount')) $('codesCount').textContent = codes.size;
    if($('customersCount')) $('customersCount').textContent = users.size;
    
    // عرض إجمالي المبيعات بتنسيق قراءة مميز وحقيقي
    if($('salesTotal')) $('salesTotal').textContent = total.toLocaleString() + ' EGP';

    // تحديث قائمة أفضل المنتجات مبيعاً باللوحة بشكل فخم
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
      console.error("حدث خطأ أثناء جلب العدادات: ", error);
  }
}

// دالة تسجيل الخروج ونقل المستخدم لصفحة تسجيل الدخول
function logout(){
  firebase.auth().signOut().then(() => {
      location.href = '/login.html';
  });
}
