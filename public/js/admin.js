let db = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);

function showPage(id, btn){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(id).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

function val(id){
  return ($(id)?.value || '').trim();
}

firebase.auth().onAuthStateChanged(async (user) => {
  if(!user){
    location.href = '/login.html';
    return;
  }

  currentUser = user;
  db = firebase.firestore();
  $('adminEmail').textContent = user.email;

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

async function loadAll(){
  await loadProducts();
  await loadCategories();
  await loadCodes();
  await loadOrders();
  await loadCoupons();
  await loadCustomers();
  await loadStats();
}

function clearProductForm(){
  ['productId','name','category','game','amount','price','image','description']
    .forEach(id => $(id).value = '');
  $('active').checked = true;
}

async function saveProduct(){
  const file = document.getElementById('imageFile')?.files?.[0];
  const imageUrl = file ? await uploadImage(file, 'products') : '';

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

async function saveProduct(){
const file = document.getElementById('imageFile').files[0];

let imageUrl = '';

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
  alert('تم حفظ المنتج');
}

async function loadProducts(){
  const snap = await db.collection('products').get();
  const list = $('productsList');
  const select = $('codeProductId');

  list.innerHTML = '';
  select.innerHTML = '<option value="">اختر المنتج</option>';

  snap.forEach(doc => {
    const p = doc.data();

    select.innerHTML += `<option value="${doc.id}">${p.name || 'منتج بدون اسم'}</option>`;

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
          <button class="ghost" onclick="deleteProduct('${doc.id}')">حذف</button>
        </div>
      </div>
    `;
  });
}

async function editProduct(id){
  const doc = await db.collection('products').doc(id).get();
  const p = doc.data();

  $('productId').value = id;
  $('name').value = p.name || '';
  $('category').value = p.category || '';
  $('game').value = p.game || '';
  $('amount').value = p.amount || '';
  $('price').value = p.price || '';
  $('image').value = p.image || '';
  $('description').value = p.description || '';
  $('active').checked = p.active !== false;

  showPage('products', document.querySelector('[onclick*="products"]'));
  scrollTo({top:0, behavior:'smooth'});
}

async function deleteProduct(id){
  if(!confirm('حذف المنتج؟')) return;
  await db.collection('products').doc(id).delete();
  await loadProducts();
  await loadStats();
}

async function saveCategory(){
  const name = val('catName');
  const file = document.getElementById('categoryImageFile')?.files?.[0];
  const image = file ? await uploadImage(file, 'categories') : '';

  if(!name){
    alert('اسم التصنيف مطلوب');
    return;
  }

  await db.collection('categories').add({
    name,
    image,
    active:true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  await db.collection('categories').add({
    name,
    image,
    active:true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  $('catName').value = '';

document.getElementById('categoryImageFile').value = '';

  await loadCategories();
  alert('تم حفظ التصنيف');
}

async function loadCategories(){
  const snap = await db.collection('categories').get();
  const list = $('categoriesList');
  list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();

    list.innerHTML += `
      <div class="panel">
        ${c.image ? `<img src="${c.image}" style="width:100%;height:140px;object-fit:cover;border-radius:14px;margin-bottom:12px">` : ''}
        <h3>${c.name || '-'}</h3>
        <button onclick="deleteCategory('${doc.id}')">حذف</button>
      </div>
    `;
  });
}

async function deleteCategory(id){
  if(!confirm('حذف التصنيف؟')) return;
  await db.collection('categories').doc(id).delete();
  await loadCategories();
}

async function saveCodes(){
  const productId = val('codeProductId');
  const raw = val('codesInput');

  if(!productId || !raw){
    alert('اختر المنتج واكتب الأكواد');
    return;
  }

  const codes = raw.split('\n').map(c => c.trim()).filter(Boolean);

  for(const code of codes){
    await db.collection('productCodes').add({
      productId,
      code,
      status:'available',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  $('codesInput').value = '';
  await loadCodes();
  await loadStats();

  alert('تم حفظ الأكواد: ' + codes.length);
}

async function loadCodes(){
  const snap = await db.collection('productCodes').limit(100).get();
  const list = $('codesList');
  list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();

    list.innerHTML += `
      <div class="panel">
        <h3>${c.code || '-'}</h3>
        <p>Product ID: ${c.productId || '-'}</p>
        <p>الحالة: ${c.status || '-'}</p>
      </div>
    `;
  });
}

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
    type:'percent',
    active:true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  $('couponCode').value = '';
  $('couponValue').value = '';

  await loadCoupons();
  alert('تم حفظ الكوبون');
}

async function loadCoupons(){
  const snap = await db.collection('coupons').get();
  const list = $('couponsList');
  list.innerHTML = '';

  snap.forEach(doc => {
    const c = doc.data();

    list.innerHTML += `
      <div class="panel">
        <h3>${c.code}</h3>
        <p>خصم: ${c.value}%</p>
        <p>${c.active ? 'مفعل' : 'مغلق'}</p>
      </div>
    `;
  });
}

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
            <td>${o.total || o.price || 0}</td>
            <td>${o.status || o.paymentStatus || '-'}</td>
            <td>${o.assignedCode || '-'}</td>
          </tr>
        `;
      }).join('')}
    </table>
  `;

  $('ordersList').innerHTML = table;
  $('latestOrders').innerHTML = table;
}

async function loadCustomers(){
  const snap = await db.collection('users').limit(100).get();

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

async function loadStats(){
  const products = await db.collection('products').get();
  const orders = await db.collection('orders').get();
  const users = await db.collection('users').get();
  const codes = await db.collection('productCodes').where('status','==','available').get();

  let total = 0;
  orders.forEach(doc => {
    const o = doc.data();
    total += Number(o.total || o.price || 0);
  });

  $('productsCount').textContent = products.size;
  $('ordersCount').textContent = orders.size;
  $('codesCount').textContent = codes.size;
  $('customersCount').textContent = users.size;
  $('salesTotal').textContent = total + ' EGP';

  $('topProducts').innerHTML = products.docs.slice(0,3).map((doc, i) => {
    const p = doc.data();
    return `
      <div class="alert success">
        ${i+1}. ${p.name || 'منتج'} — ${p.price || 0} EGP
      </div>
    `;
  }).join('');
}

function logout(){
  firebase.auth().signOut().then(() => location.href='/login.html');
}
