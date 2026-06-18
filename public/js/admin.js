let db;
let currentUser;
const statusEl = document.getElementById('status');
const content = document.getElementById('adminContent');

firebase.auth().onAuthStateChanged(async user => {
  if(!user){ location.href='/login.html'; return; }
  currentUser = user; db = firebase.firestore();
  const q = await db.collection('admins').where('email','==',user.email || '').where('active','==',true).limit(1).get();
  if(q.empty){ statusEl.textContent='Access denied. This email is not admin.'; return; }
  statusEl.textContent = 'Welcome admin: ' + user.email;
  content.classList.remove('hidden');
  loadProducts(); loadOrders(); loadTransactions();
});

function val(id){ return document.getElementById(id).value.trim(); }
function clearForm(){ ['productId','name','game','amount','price','image','description'].forEach(id=>document.getElementById(id).value=''); document.getElementById('active').value='true'; }

async function saveProduct(){
  const data = {
    name: val('name'), category: val('category'), game: val('game'), amount: Number(val('amount')||0), price: Number(val('price')||0), image: val('image'), description: val('description'), active: val('active')==='true', updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  if(!data.name || !data.price) return alert('Name and price required');
  const id = val('productId');
  if(id) await db.collection('products').doc(id).set(data, {merge:true});
  else await db.collection('products').add({...data, createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  clearForm(); loadProducts();
}

async function loadProducts(){
  const snap = await db.collection('products').orderBy('createdAt','desc').get().catch(()=>db.collection('products').get());
  productsTable.innerHTML = '';
  snap.forEach(doc=>{ const p=doc.data(); productsTable.innerHTML += `<tr><td>${p.name||''}</td><td>${p.game||p.category||''}</td><td>${p.price||0}</td><td>${p.active?'Yes':'No'}</td><td><button class="btn" onclick="editProduct('${doc.id}')">Edit</button> <button class="btn danger" onclick="deleteProduct('${doc.id}')">Delete</button></td></tr>`; });
}
async function editProduct(id){
  const d = await db.collection('products').doc(id).get(); const p=d.data();
  productId.value=id; name.value=p.name||''; game.value=p.game||p.category||''; amount.value=p.amount||''; price.value=p.price||''; image.value=p.image||''; description.value=p.description||''; active.value=String(p.active!==false); scrollTo(0,0);
}
async function deleteProduct(id){ if(confirm('Delete product?')){ await db.collection('products').doc(id).delete(); loadProducts(); } }

async function loadOrders(){
  const snap = await db.collection('orders').limit(50).get(); ordersTable.innerHTML='';
  snap.forEach(doc=>{ const o=doc.data(); ordersTable.innerHTML += `<tr><td>${o.orderId||doc.id}</td><td>${o.customerName||o.email||''}</td><td>${o.total||o.price||0}</td><td>${o.paymentStatus||'pending'}</td><td>${o.orderStatus||'new'}</td></tr>`; });
}
async function loadTransactions(){
  const snap = await db.collection('transactions').limit(50).get(); transactionsTable.innerHTML='';
  snap.forEach(doc=>{ const t=doc.data(); transactionsTable.innerHTML += `<tr><td>${t.merchantOrderId||''}</td><td>${t.amount||0} ${t.currency||'EGP'}</td><td>${t.paymentStatus||t.kashierStatus||''}</td><td>${t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString() : ''}</td></tr>`; });
}
async function saveCodes(){
  const productId = val('codeProductId');
  const raw = val('codes');

  if(!productId || !raw) {
    return alert('Product ID and codes required');
  }

  const codes = raw.split('\n').map(c=>c.trim()).filter(Boolean);

  for(const code of codes){
    await db.collection('productCodes').add({
      productId,
      code,
      status:'available',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  alert('Codes saved');
}

function logout(){
  firebase.auth().signOut().then(()=>location.href='/login.html');
}
