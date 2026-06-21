// ==========================================================================
// Fox Store Admin - Core JavaScript (Firebase & UI Logic)
// ==========================================================================

let db = null;
let currentUser = null;

// دالة اختصار جلب العناصر من الصفحات
const $ = (id) => document.getElementById(id);

// دالة اختصار جلب القيم من حقول الإدخال وتنظيفها
function val(id){
    return ($(id)?.value || '').trim();
}

// 1. تشغيل تابات التنقل (Sidebar Tabs Fix)
function showPage(id, btn){
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = $(id);
    if(targetPage) targetPage.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if(btn) {
        btn.classList.add('active');
    } else {
        // لو الانتقال تم من زرار خارجي، يتم تعليم زرار السايدبار المناسب تلقائياً
        const sidebarBtn = document.querySelector(`button[onclick*="'${id}'"]`);
        if (sidebarBtn) sidebarBtn.classList.add('active');
    }
}

// دالة تسجيل الخروج
function logout(){
    firebase.auth().signOut().then(() => {
        window.location.href = '/login.html';
    });
}

// 2. مراقبة حالة تسجيل دخول الأدمن والتحقق من الصلاحيات
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
            .where('email', '==', user.email)
            .where('active', '==', true)
            .limit(1)
            .get();

        if(adminCheck.empty){
            alert('هذا الحساب ليس أدمن أو تم إلغاء تفعيله.');
            location.href = '/';
            return;
        }

        // تشغيل الوظائف الإضافية للـ UI بعد تحميل قاعدة البيانات
        initExtraUILogic();
        
        // تحميل كافة البيانات داخل لوحة التحكم
        await loadAll();

    } catch (error) {
        console.error("Authentication Error: ", error);
    }
});

// تحميل كافة الأقسام بالتوازي
async function loadAll(){
    await Promise.all([
        loadProducts(),
        loadCategories(),
        loadCodes(),
        loadOrders(),
        loadCoupons(),
        loadCustomers(),
        loadStats()
    ]);
}

// 3. تشغيل البحث الفوري والإشعارات واللغات (Extra UI Logic)
function initExtraUILogic() {
    // تفعيل السيرش الذكي
    const searchInput = document.querySelector('.search-container input');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            
            // فلترة الطلبات فورا
            document.querySelectorAll('.table-box table tbody tr').forEach((row, index) => {
                if(index === 0) return; // تخطي الهيدر
                row.style.display = row.innerText.toLowerCase().includes(searchTerm) ? '' : 'none';
            });

            // فلترة كروت المنتجات فورا
            document.querySelectorAll('#productsList .product-card-custom').forEach(card => {
                card.style.display = card.innerText.toLowerCase().includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // زر التنبيهات
    const notificationBtn = document.querySelector('.icon-btn');
    if (notificationBtn) {
        notificationBtn.onclick = function() {
            alert('🔔 مركز التنبيهات: تم تحديث كافة عمليات الدفع وتوصيل الأكواد بنجاح.');
        };
    }

    // زر تغيير اللغة
    const langBtn = document.querySelector('.lang-btn');
    if (langBtn) {
        langBtn.onclick = function() {
            alert('🌐 ميزة تعدد اللغات (English / العربية) قيد المراجعة حالياً.');
        };
    }
}

// ==========================================================================
// إدارة المنتجات والتصنيفات (النسخة الاحترافية)
// ==========================================================================

function clearProductForm(){
    ['productId', 'name', 'productCategorySelect', 'game', 'amount', 'price', 'description']
    .forEach(id => {
        const el = $(id);
        if(el) el.value = '';
    });

    if($('imageFile')) $('imageFile').value = '';
    if($('active')) $('active').checked = true;
    if($('imagePreview')) $('imagePreview').style.display = 'none';
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'FOX-GAMES');

    const res = await fetch('https://api.cloudinary.com/v1_1/denwwcqoe/image/upload', {
        method: 'POST',
        body: formData
    });

    const data = await res.json();
    return data.secure_url;
}

async function saveProduct(){
    const file = document.getElementById('imageFile').files[0];
    let imageUrl = '';

    if(file){
        imageUrl = await uploadImage(file);
    } else {
        // إذا كان تعديل ولم نرفع صورة جديدة، نحتفظ بالصورة القديمة
        const id = val('productId');
        if(id) {
            const doc = await db.collection('products').doc(id).get();
            imageUrl = doc.data()?.image || '';
        }
    }

    const data = {
        name: val('name'),
        category: val('productCategorySelect'), // يقرأ من القائمة المنسدلة الذكية
        game: val('game'),
        amount: Number(val('amount') || 0),
        price: Number(val('price') || 0),
        image: imageUrl,
        description: val('description'),
        active: $('active').checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if(!data.name || !data.price){
        alert('اسم المنتج والسعر مطلوبين مضافين بشكل صحيح');
        return;
    }

    const id = val('productId');

    if(id){
        await db.collection('products').doc(id).set(data, {merge:true});
    } else {
        await db.collection('products').add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    clearProductForm();
    await loadProducts();
    await loadStats();
    alert('تم حفظ وتحديث المنتج بنجاح 🎉');
}

async function loadProducts(){
    const snap = await db.collection('products').get();
    const list = $('productsList');
    const select = $('codeProductId');

    if(list) list.innerHTML = '';
    if(select) select.innerHTML = '<option value="">اختر المنتج لربط الأكواد</option>';

    snap.forEach(doc => {
        const p = doc.data();

        if(select){
            select.innerHTML += `<option value="${doc.id}">${p.name || 'منتج بدون اسم'}</option>`;
        }

        if(list) {
            list.innerHTML += `
              <div class="panel product-card-custom">
                <div class="product-card-hero">
                    <img src="${p.image || '/img/placeholder.jpg'}" alt="${p.name}">
                    <span class="product-badge">${p.category || 'عام'}</span>
                </div>
                <div class="product-card-body">
                    <h4>${p.name || '-'}</h4>
                    <p>اللعبة: ${p.game || '-'} | المتاح: ${p.amount || 0}</p>
                    <p style="font-size:11px; color:var(--text-muted)">الحالة: ${p.active ? '🟢 نشط بالمتجر' : '🔴 مخفي'}</p>
                    <div class="product-card-footer">
                        <strong class="price-tag">${p.price || 0} EGP</strong>
                        <div class="card-actions">
                            <button class="edit-btn" onclick="editProduct('${doc.id}')"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
                            <button class="delete-btn" onclick="deleteProduct('${doc.id}')"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                </div>
              </div>
            `;
        }
    });
}

async function editProduct(id){
    const doc = await db.collection('products').doc(id).get();
    const p = doc.data();

    $('productId').value = id;
    $('name').value = p.name || '';
    $('productCategorySelect').value = p.category || '';
    $('game').value = p.game || '';
    $('amount').value = p.amount || '';
    $('price').value = p.price || '';
    $('description').value = p.description || '';
    $('active').checked = p.active !== false;

    if(p.image && $('imagePreview')) {
        $('imagePreview').src = p.image;
        $('imagePreview').style.display = 'block';
    }

    showPage('products', document.querySelector('[onclick*="products"]'));
    scrollTo({top:0, behavior:'smooth'});
}

async function deleteProduct(id){
    if(!confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) return;
    await db.collection('products').doc(id).delete();
    await loadProducts();
    await loadStats();
}

// ==========================================================================
// إدارة التصنيفات والأكواد والكوبونات والطلبات
// ==========================================================================

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

    $('catName').value = '';
    if(document.getElementById('categoryImageFile')) document.getElementById('categoryImageFile').value = '';

    await loadCategories();
    alert('تم حفظ التصنيف بنجاح');
}

async function loadCategories(){
    const snap = await db.collection('categories').get();
    const list = $('categoriesList');
    const productCatSelect = $('productCategorySelect'); // القائمة داخل إضافة المنتج
    
    if(list) list.innerHTML = '';
    if(productCatSelect) productCatSelect.innerHTML = '<option value="">اختر التصنيف (PUBG, VALORANT...)</option>';

    snap.forEach(doc => {
        const c = doc.data();

        // حقن التصنيف داخل الـ Select الخاص بإضافة منتج
        if(productCatSelect) {
            productCatSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
        }

        // عرض التصنيفات في صفحة التصنيفات
        if(list) {
            list.innerHTML += `
              <div class="panel" style="text-align:center;">
                ${c.image ? `<img src="${c.image}" style="width:100%;height:130px;object-fit:cover;border-radius:14px;margin-bottom:12px">` : ''}
                <h3 style="margin-bottom:15px;">${c.name || '-'}</h3>
                <button class="delete-btn" style="width:100%; padding:10px;" onclick="deleteCategory('${doc.id}')"><i class="fa-solid fa-trash-can"></i> حذف التصنيف</button>
              </div>
            `;
        }
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

    $('codesInput').value = '';
    await loadCodes();
    await loadStats();

    alert('تم حفظ الأكواد بنجاح، العدد المضاف: ' + codes.length);
}

async function loadCodes(){
    const snap = await db.collection('productCodes').limit(100).get();
    const list = $('codesList');
    if(!list) return;
    list.innerHTML = '';

    snap.forEach(doc => {
        const c = doc.data();
        list.innerHTML += `
          <div class="panel">
            <h3 style="color:var(--neon-blue); margin-bottom:8px;">${c.code || '-'}</h3>
            <p style="font-size:12px; color:var(--text-muted)">رقم المنتج: ${c.productId || '-'}</p>
            <p style="font-size:13px; margin-top:5px;">الحالة: <span class="trend positive">${c.status === 'available' ? '💡 متاح للتسليم' : '❌ مبيوع'}</span></p>
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
        type: 'percent',
        active: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    $('couponCode').value = '';
    $('couponValue').value = '';

    await loadCoupons();
    alert('تم حفظ وتفعيل الكوبون');
}

async function loadCoupons(){
    const snap = await db.collection('coupons').get();
    const list = $('couponsList');
    if(!list) return;
    list.innerHTML = '';

    snap.forEach(doc => {
        const c = doc.data();
        list.innerHTML += `
          <div class="panel" style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="color:var(--neon-purple)">${c.code}</h3>
                <p style="color:var(--text-muted); font-size:13px;">خصم نسبة: ${c.value}%</p>
            </div>
            <span class="product-badge" style="position:static; background:rgba(101,204,0,0.2); color:var(--neon-green)">${c.active ? 'نشط' : 'ملغي'}</span>
          </div>
        `;
    });
}

async function loadOrders(){
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(50).get();

    const buildTable = (docs) => `
        <table style="width:100%; text-align:right; border-collapse:collapse; font-size:14px;">
          <tr style="border-bottom:1px solid rgba(255,255,255,0.05); color:var(--text-muted);">
            <th style="padding:12px;">رقم الطلب</th>
            <th style="padding:12px;">العميل</th>
            <th style="padding:12px;">المنتج</th>
            <th style="padding:12px;">الإجمالي</th>
            <th style="padding:12px;">الحالة</th>
            <th style="padding:12px;">الكود المسلم</th>
          </tr>
          ${docs.map(doc => {
            const o = doc.data();
            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                <td style="padding:14px; font-weight:bold; color:var(--neon-blue);">${o.orderId || doc.id.substring(0,8)}</td>
                <td style="padding:14px;">${o.customerName || o.email || '-'}</td>
                <td style="padding:14px;">${o.productName || '-'}</td>
                <td style="padding:14px; color:var(--neon-green); font-weight:bold;">${o.total || o.price || 0} EGP</td>
                <td style="padding:14px;"><span style="background:rgba(59,130,246,0.1); padding:4px 8px; border-radius:6px; font-size:12px;">${o.status || o.paymentStatus || 'Completed'}</span></td>
                <td style="padding:14px; font-family:monospace; color:var(--neon-orange);">${o.assignedCode || 'توصيل تلقائي'}</td>
              </tr>
            `;
          }).join('')}
        </table>
    `;

    const tableHTML = buildTable(snap.docs);
    if($('ordersList')) $('ordersList').innerHTML = tableHTML;
    if($('latestOrders')) $('latestOrders').innerHTML = tableHTML;
}

async function loadCustomers(){
    const snap = await db.collection('users').limit(100).get();

    if($('customersList')) {
        $('customersList').innerHTML = `
            <table style="width:100%; text-align:right; border-collapse:collapse; font-size:14px;">
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05); color:var(--text-muted);">
                <th style="padding:12px;">الاسم</th>
                <th style="padding:12px;">البريد الإلكتروني</th>
                <th style="padding:12px;">الهاتف</th>
                <th style="padding:12px;">الصلاحية</th>
              </tr>
              ${snap.docs.map(doc => {
                const u = doc.data();
                return `
                  <tr style="border-bottom:1px solid rgba(255,255,255,0.02);">
                    <td style="padding:14px; font-weight:600;">${u.name || '-'}</td>
                    <td style="padding:14px; color:var(--text-muted);">${u.email || '-'}</td>
                    <td style="padding:14px;">${u.phone || '-'}</td>
                    <td style="padding:14px;"><span style="color:var(--neon-purple)">${u.role || 'user'}</span></td>
                  </tr>
                `;
              }).join('')}
            </table>
        `;
    }
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

    if($('productsCount')) $('productsCount').textContent = products.size;
    if($('ordersCount')) $('ordersCount').textContent = orders.size;
    if($('codesCount')) $('codesCount').textContent = codes.size;
    if($('customersCount')) $('customersCount').textContent = users.size;
    if($('salesTotal')) $('salesTotal').textContent = total.toLocaleString() + ' EGP';

    if($('topProducts')) {
        $('topProducts').innerHTML = products.docs.slice(0, 4).map((doc, i) => {
            const p = doc.data();
            return `
              <div class="alert success" style="margin-bottom:8px; display:flex; justify-content:space-between;">
                <span>#${i+1} — ${p.name || 'منتج'}</span>
                <strong>${p.price || 0} EGP</strong>
              </div>
            `;
        }).join('');
    }
}
