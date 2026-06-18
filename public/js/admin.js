let db = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);

function showPage(id){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(id).classList.add('active');
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

  const adminCheck = await db.collection('admins')
    .where('email', '==', user.email)
    .where('active', '==', true)
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
  const data = {
    name: val('name'),
    category: val('category'),
    game: val('game'),
    amount: Number(val('amount') || 0),
    price: Number(val('price') || 0),
    image: val('image'),
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
    await db.collection('products').doc(id).set(data, { merge:true });
  }else{
    await db.collection('products').add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  clearProductForm();
  await loadProducts();
  await loadCategories();
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

    select.innerHTML += `
      <option value="${doc.id}">
        ${p.name || 'منتج بدون اسم'}
      </option>
    `;

    list.innerHTML += `
      <div class="card">
        ${p.image ? `<img src="${p.image}">` : ''}
        <h3>${p.name || ''}</h3>
        <p>التصنيف: ${p.category || p.game || '-'}</p>
        <p>اللعبة: ${p.game || '-'}</p>
        <p>السعر: ${p.price || 0} EGP</p>
        <p>الحالة: ${p.active ? 'نشط' : 'مخفي'}</p>

        <button onclick="editProduct('${doc.id}')">تعديل</button>
        <button onclick="deleteProduct('${doc.id}')">حذف</button>
      </div>
    `;
  });
}

async function editProduct(id){
  const doc = await db.collection('products').doc(id).get();
  const p = doc.data();

  $('productId').value = id;
  $('name').value = p.name || '';
  $('category').value = p.category || p.game || '';
  $('game').value = p.game || '';
  $('amount').value = p.amount || '';
  $('price').value = p.price || '';
  $('image').value = p.image || '';
  $('description').value = p.description || '';
  $('active').checked = p.active !== false;

  showPage('products');
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteProduct(id){
  if(!confirm('حذف المنتج؟')) return;
  await db.collection('products').doc(id).delete();
  await loadProducts();
  await loadStats();
}

async function saveCategory(){
  const name = val('catName');
  const image = val('catImage');

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

  $('catName').value = '';
  $('catImage').value = '';

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
      <div class="card">
        ${c.image ? `<img src="${c.image}">` : ''}
        <h3>${c.name || ''}</h3>
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
      <div class="card">
        <h3>${c.code || ''}</h3>
        <p>Product ID: ${c.productId || ''}</p>
        <p>الحالة: ${c.status || ''}</p>
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
      <div class="card">
        <h3>${c.code}</h3>
        <p>خصم: ${c.value}%</p>
        <p>${c.active ? 'مفعل' : 'مغلق'}</p>
      </div>
    `;
  });
}

async function loadOrders(){
  const snap = await db.collection('orders').limit(50).get();
  const list = $('ordersList');

  list.innerHTML = `
    <table>
      <tr>
        <th>العميل</th>
        <th>المنتج</th>
        <th>الإجمالي</th>
        <th>الحالة</th>
        <th>الكود</th>
      </tr>
    </table>
  `;

  const table = list.querySelector('table');

  snap.forEach(doc => {
    const o = doc.data();

    table.innerHTML += `
      <tr>
        <td>${o.customerName || o.email || '-'}</td>
        <td>${o.productName || '-'}</td>
        <td>${o.total || o.price || 0}</td>
        <td>${o.status || o.paymentStatus || '-'}</td>
        <td>${o.assignedCode || '-'}</td>
      </tr>
    `;
  });
}

async function loadCustomers(){
  const snap = await db.collection('users').limit(100).get();
  const list = $('customersList');

  list.innerHTML = `
    <table>
      <tr>
        <th>الاسم</th>
        <th>الإيميل</th>
        <th>الهاتف</th>
        <th>الدور</th>
      </tr>
    </table>
  `;

  const table = list.querySelector('table');

  snap.forEach(doc => {
    const u = doc.data();

    table.innerHTML += `
      <tr>
        <td>${u.name || '-'}</td>
        <td>${u.email || '-'}</td>
        <td>${u.phone || '-'}</td>
        <td>${u.role || 'user'}</td>
      </tr>
    `;
  });
}

async function loadStats(){
  const products = await db.collection('products').get();
  const orders = await db.collection('orders').get();
  const codes = await db.collection('productCodes')
    .where('status','==','available')
    .get();

  let total = 0;
  orders.forEach(doc => {
    const o = doc.data();
    total += Number(o.total || o.price || 0);
  });

  $('productsCount').textContent = products.size;
  $('ordersCount').textContent = orders.size;
  $('codesCount').textContent = codes.size;
  $('salesTotal').textContent = total + ' EGP';
}

function logout(){
  firebase.auth().signOut().then(() => location.href = '/login.html');
}
  alert('Codes saved');
}

function logout(){
  firebase.auth().signOut().then(()=>location.href='/login.html');
}
