// ================= TECH GAMING LIVE DATABASE LINK =================
// الاعتماد بالكامل على مصفوفات الفايربيز والبانل
const $ = id => document.getElementById(id);

// هنا بنضمن إن لو الفايربيز اتأخر في التحميل، المتجر ما يضربش ويفضل مستني الداتا
if (typeof cart === 'undefined') {
  var cart = JSON.parse(localStorage.getItem('techgaming_cart')) || [];
}
// إلغاء أي خصم تلقائي مسبق - الكوبون يبدأ دائماً من الصفر
if (typeof coupon === 'undefined') {
  var coupon = 0; 
  localStorage.setItem('techgaming_coupon', '0');
}

// مصفوفة الترجمة المتوافقة مع هوية TECH GAMING (لبيع الحسابات والخدمات الرقمية)
const translations = {
  en: {
    nav_home: "Home", nav_store: "Store", nav_categories: "Categories", nav_support: "Support",
    search_placeholder: "Search for accounts, codes...", btn_login: "Login", btn_cart: "Cart",
    hero_title: "Digital Accounts & Top-Ups", hero_subtitle: "Instant delivery. Premium digital services. Best prices.",
    btn_shop_now: "Shop Now", btn_browse_cat: "Browse Categories",
    feat_delivery: "Instant Delivery", feat_secure: "Secure Payments", feat_support: "24/7 Support",
    title_popular: "Products", sort_popular: "Most Popular", sort_low: "Price Low", sort_high: "Price High",
    title_categories: "Shop by Categories", btn_view_all: "View All",
    b_feat1_title: "Instant Delivery", b_feat1_desc: "Get your digital product instantly after payment",
    b_feat2_title: "Secure Payments", b_feat2_desc: "100% secure encrypted payment methods",
    b_feat3_title: "24/7 Support", b_feat3_desc: "We are here to help you anytime",
    b_feat4_title: "Best Prices", b_feat4_desc: "Competitive prices on all accounts and services",
    check_title: "Secure Payment Methods", check_desc: "Choose your product, add it to cart, and complete the order securely.",
    sup_title: "Need Help With Your Order?", sup_desc: "Payment failed, code delayed, or account issue — contact support instantly.",
    btn_live_chat: "Live Chat", cart_title: "Your Cart", btn_apply: "Apply",
    cart_subtotal: "Subtotal", cart_discount: "Discount", cart_total: "Total",
    holder_name: "Full Name", holder_phone: "Phone Number", holder_email: "Email Address",
    btn_pay_now: "Secure Checkout", secure_checkout_notice: "Secure checkout connected through the backend.",
    lang_btn: "العربية"
  },
  ar: {
    nav_home: "الرئيسية", nav_store: "المتجر", nav_categories: "الأقسام", nav_support: "الدعم الفني",
    search_placeholder: "ابحث عن الحسابات والخدمات...", btn_login: "تسجيل الدخول", btn_cart: "السلة",
    hero_title: "الحسابات الرقمية وشحن الرصيد", hero_subtitle: "تسليم فوري. خدمات رقمية مميزة. أفضل الأسعار.",
    btn_shop_now: "تسوق الآن", btn_browse_cat: "تصفح الأقسام",
    feat_delivery: "تسليم فوري", feat_secure: "دفع آمن", feat_support: "دعم 24/7",
    title_popular: "المنتجات", sort_popular: "الأكثر شعبية", sort_low: "السعر من الأقل", sort_high: "السعر من الأعلى",
    title_categories: "تسوق حسب الأقسام", btn_view_all: "عرض الكل",
    b_feat1_title: "تسليم فوري وسريع", b_feat1_desc: "احصل على حسابك أو الكود مباشرة فور الدفع",
    b_feat2_title: "دفع آمن 100%", b_feat2_desc: "نوفر لك خيارات دفع محلية وعالمية مشفرة",
    b_feat3_title: "دعم فني متواصل", b_feat3_desc: "فريق الدعم الفني معك دائماً لحل أي استفسار",
    b_feat4_title: "أفضل الأسعار", b_feat4_desc: "عروض حصرية وأسعار لا تقبل المنافسة",
    check_title: "طرق دفع آمنة وموثوقة", check_desc: "اختر منتجك المفضّل، أضفه إلى سلة المشتريات، وأكمل الدفع بأمان.",
    sup_title: "هل تحتاج مساعدة في طلبك؟", sup_desc: "تأخر الكود، مشكلة في الحساب، فشل الدفع — تواصل مع الدعم فوراً.",
    btn_live_chat: "المحادثة المباشرة", cart_title: "سلة المشتريات", btn_apply: "تطبيق",
    cart_subtotal: "المجموع الفرعي", cart_discount: "الخصم", cart_total: "الإجمالي الكلي",
    holder_name: "الاسم بالكامل", holder_phone: "رقم الهاتف المحمول", holder_email: "البريد الإلكتروني",
    btn_pay_now: "دفع آمن", secure_checkout_notice: "بوابة دفع آمنة تماماً ومتصلة بالسيرفر.",
    lang_btn: "English"
  }
};

let currentLang = localStorage.getItem('techgaming_lang') || 'en';

window.addEventListener('load', () => {
  applyLanguage(currentLang);

  if (typeof checkAuthState === 'function') checkAuthState();
  
  setTimeout(() => {
    renderCategories();
    renderFilters();
    renderProducts();
    updateCart();
  }, 1000); 
  
  reveal();
});

window.addEventListener('scroll', reveal);

// --- 1. إدارة الجلسة (Session Timeout - 60 Minutes) ---
function setSessionTimer() {
    localStorage.setItem('techgaming_login_time', new Date().getTime());
}

function checkSession() {
    const loginTime = localStorage.getItem('techgaming_login_time');
    if (loginTime) {
        const currentTime = new Date().getTime();
        const oneHour = 60 * 60 * 1000; // 60 دقيقة بالملي ثانية
        
        if (currentTime - loginTime > oneHour) {
            if (typeof firebase !== 'undefined' && firebase.auth) {
                firebase.auth().signOut().then(() => {
                    localStorage.removeItem('techgaming_login_time');
                    Swal.fire({
                        icon: 'info',
                        title: currentLang === 'ar' ? 'انتهت الجلسة' : 'Session Expired',
                        text: currentLang === 'ar' ? 'مرت ساعة على تسجيل دخولك، يرجى تسجيل الدخول مرة أخرى.' : 'Your session has expired. Please log in again.',
                        background: '#090f17', color: '#fff', confirmButtonColor: '#00f3ff'
                    }).then(() => window.location.reload());
                });
            }
        }
    }
}
setInterval(checkSession, 60000); // فحص كل دقيقة


// عرض التصنيفات
function renderCategories() {
  if (!$('categoryGrid')) return;
  if (typeof categories === 'undefined' || !categories.length) return;
  
  $('categoryGrid').innerHTML = categories.map(cat => {
    const catImg = cat.bg || cat.image || '';
    return `
    <div class="trendCard reveal" onclick="filterByCategory('${cat.name}')">
      <img src="${catImg}" alt="${cat.name}">
      <div><h3>${cat.name}</h3><p>${cat.desc || ''}</p></div>
    </div>`;
  }).join('');
}

function renderFilters() {
  if (!$('categoryFilter')) return;
  if (typeof products === 'undefined' || !products.length) return;
  
  const list = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  $('categoryFilter').innerHTML = list.map(x => `<option value="${x}">${x === 'All' ? (currentLang === 'ar' ? 'الكل' : 'All') : x}</option>`).join('');
}

// عرض المنتجات مع ربط زر الشراء بالنافذة المنبثقة
function renderProducts() {
  if (!$('productGrid')) return;
  if (typeof products === 'undefined' || !products.length) {
    $('productGrid').innerHTML = `<p style="color:var(--muted); grid-column: 1/-1; text-align:center; padding: 40px 0;">Loading products...</p>`;
    return;
  }

  const search = ($('searchInput')?.value || '').toLowerCase();
  const filter = $('categoryFilter')?.value || 'All';
  const sort = $('sortFilter')?.value;

  let list = products.filter(p => 
    `${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(search) && 
    (filter === 'All' || p.category === filter)
  );

  if (sort === 'low') list.sort((a, b) => a.price - b.price);
  if (sort === 'high') list.sort((a, b) => b.price - a.price);
  if (sort === 'popular') list.sort((a, b) => (b.popular || 0) - (a.popular || 0));

  $('productGrid').innerHTML = list.map(p => {
    const originalIndex = products.indexOf(p);
    const imgUrl = p.img || p.image || '';
    const btnText = currentLang === 'ar' ? 'عرض التفاصيل' : 'View Details';
    
    return `<article class="productCard reveal">
      <div class="productCover">
        <img src="${imgUrl}" alt="${p.name}">
      </div>
      <div class="productInfo">
        <h3>${p.name}</h3>
        <p>${p.desc || ''}</p>
        <div class="priceRow">
          <div class="price">${p.price}.00 EGP</div>
          <span class="rating">★ ${p.rating || '5.0'}</span>
        </div>
        <button class="add" onclick="openProductModal(${originalIndex})">${btnText}</button>
      </div>
    </article>`;
  }).join('');
  reveal();
}

// --- 2. إدارة النافذة المنبثقة لتفاصيل المنتج (Product Modal) ---
let currentSelectedProduct = null;
let currentProductStock = 0;

function openProductModal(index) {
    const p = products[index];
    if(!p) return;
    currentSelectedProduct = p;
    
    // إذا لم يكن هناك تخزين محدد في الداتا بيز نعتبره 100 افتراضياً
    currentProductStock = p.stock || 100; 

    $('modalProductName').innerText = p.name;
    $('modalProductPrice').innerText = p.price + ' EGP';
    $('modalProductImg').src = p.img || p.image || '';
    $('modalProductCategory').innerText = p.category;
    $('modalProductDesc').innerText = p.desc || (currentLang === 'ar' ? 'لا يوجد وصف متاح.' : 'No description available.');
    $('modalProductStock').innerText = currentProductStock;
    $('modalQty').value = 1;

    $('productModal').classList.add('active');
}

function closeProductModal() {
    $('productModal').classList.remove('active');
}

function increaseQty() {
    let input = $('modalQty');
    if (parseInt(input.value) < currentProductStock) {
        input.value = parseInt(input.value) + 1;
    } else {
        Swal.fire({
            icon: 'warning',
            title: currentLang === 'ar' ? 'تنبيه' : 'Attention',
            text: currentLang === 'ar' ? 'الكمية المطلوبة تتخطى المخزون المتاح!' : 'Requested quantity exceeds available stock!',
            background: '#090f17', color: '#fff'
        });
    }
}

function decreaseQty() {
    let input = $('modalQty');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
    }
}

function addToCartFromModal() {
    if(!currentSelectedProduct) return;
    
    let qty = parseInt($('modalQty').value);
    
    for(let i = 0; i < qty; i++) {
        cart.push({ 
            ...currentSelectedProduct, 
            cartId: Date.now() + Math.random(),
            id: currentSelectedProduct.id || currentSelectedProduct.docId || Date.now()
        });
    }
    
    save();
    updateCart();
    closeProductModal();
    
    Swal.fire({
        icon: 'success',
        title: currentLang === 'ar' ? 'تمت الإضافة' : 'Added',
        text: currentLang === 'ar' ? 'تم إضافة المنتج للسلة بنجاح' : 'Product added to cart successfully',
        timer: 1500,
        showConfirmButton: false,
        background: '#090f17', color: '#fff'
    });
    
    $('cartDrawer')?.classList.add('open');
}

function removeItem(cartId) {
  cart = cart.filter(x => x.cartId !== cartId);
  save();
  updateCart();
}

function updateCart() {
  if ($('cartCount')) $('cartCount').textContent = cart.length;
  if ($('cartCountTop')) $('cartCountTop').textContent = cart.length;
  
  if ($('cartItems')) {
    $('cartItems').innerHTML = cart.length 
      ? cart.map(item => {
          const imgUrl = item.img || item.image || 'https://via.placeholder.com/150';
          return `
            <div class="cartItem">
              <img src="${imgUrl}" class="cartItem-img" alt="${item.name}">
              <div class="cartItem-details">
                <span class="cartItem-name">${item.name}</span>
                <span class="cartItem-cat">${item.category || ''}</span>
                <span class="cartItem-price">${item.price} EGP</span>
              </div>
              <button class="cartItem-remove-btn" onclick="removeItem(${item.cartId})" title="Remove">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>`;
        }).join('')
      : `<p style="color:#94a3b8; text-align:center; padding:30px; font-size:13px;">${currentLang === 'ar' ? 'سلة المشتريات فارغة حالياً.' : 'Your cart is empty.'}</p>`;
  }

  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const discountValue = Math.round(subtotal * coupon / 100);
  
  if ($('subtotal')) $('subtotal').textContent = `${subtotal} EGP`;
  if ($('discount')) $('discount').textContent = `${discountValue} EGP`;
  if ($('total')) $('total').textContent = `${subtotal - discountValue} EGP`;
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  localStorage.setItem('techgaming_lang', currentLang);
  applyLanguage(currentLang);
  updateCart();
}

function applyLanguage(lang) {
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      const icon = el.querySelector('i');
      if (icon) {
        el.innerHTML = '';
        el.appendChild(icon);
        el.appendChild(document.createTextNode(' ' + translations[lang][key]));
      } else {
        el.textContent = translations[lang][key];
      }
    }
  });

  document.querySelectorAll('[data-i18n-holder]').forEach(el => {
    const key = el.getAttribute('data-i18n-holder');
    if (translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });

  if ($('langToggleBtn')) {
    $('langToggleBtn').textContent = translations[lang]['lang_btn'];
  }
}

async function applyCoupon() {
  const code = ($('couponInput')?.value || '').trim().toUpperCase();
  
  if (!code) {
    Swal.fire({
      icon: 'warning',
      text: currentLang === 'ar' ? 'يرجى إدخال كود الخصم أولاً!' : 'Please enter a coupon code first!',
      confirmButtonText: currentLang === 'ar' ? 'حسناً' : 'OK',
      background: '#090f17', color: '#fff', confirmButtonColor: '#00f3ff'
    });
    return;
  }

  if (typeof firebase === 'undefined' || !firebase.firestore) return;

  try {
    const couponDoc = await firebase.firestore().collection('coupons').doc(code).get();

    if (couponDoc.exists) {
      const couponData = couponDoc.data();
      coupon = parseFloat(couponData.value || 0); 
      save();
      updateCart();

      Swal.fire({
        icon: 'success',
        title: currentLang === 'ar' ? 'تم تطبيق الخصم!' : 'Coupon Applied!',
        text: currentLang === 'ar' ? `تم تفعيل خصم بقيمة ${coupon}% بنجاح 🎉` : `Successfully applied ${coupon}% discount 🎉`,
        timer: 2000, showConfirmButton: false,
        background: '#090f17', color: '#fff'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: currentLang === 'ar' ? 'كود غير صحيح' : 'Invalid Coupon',
        text: currentLang === 'ar' ? 'قسيمة الخصم غير موجودة أو منتهية.' : 'This coupon does not exist or expired.',
        confirmButtonText: currentLang === 'ar' ? 'محاولة أخرى' : 'Try Again',
        background: '#090f17', color: '#fff', confirmButtonColor: '#ef4444'
      });
    }
  } catch (error) {
    console.error("Error fetching coupon:", error);
  }
}

// ================= دوال Firebase الإضافية (تحديث المخزون وتوثيق المشترين) =================

// 1. خصم الكمية من المخزون
async function updateProductStockAfterPurchase(purchasedItems) {
    if (typeof firebase === 'undefined' || !firebase.firestore) return;
    const db = firebase.firestore();
    const batch = db.batch();

    try {
        purchasedItems.forEach(item => {
            if (item.id) {
                const productRef = db.collection('products').doc(String(item.id));
                batch.update(productRef, {
                    stock: firebase.firestore.FieldValue.increment(-1)
                });
            }
        });
        await batch.commit();
        console.log("تم تحديث المخزون بنجاح.");
    } catch (error) {
        console.error("حدث خطأ أثناء تحديث المخزون:", error);
    }
}

// 2. توثيق المشتري لإتاحة التعليقات الحقيقية فقط
async function registerVerifiedBuyer(purchasedItems, userId) {
    if (typeof firebase === 'undefined' || !firebase.firestore || !userId) return;
    const db = firebase.firestore();
    const batch = db.batch();

    try {
        purchasedItems.forEach(item => {
            if (item.id) {
                const productRef = db.collection('products').doc(String(item.id));
                batch.update(productRef, {
                    verifiedBuyers: firebase.firestore.FieldValue.arrayUnion(userId)
                });
            }
        });
        await batch.commit();
        console.log("تم توثيق المشتري بنجاح.");
    } catch (error) {
        console.error("حدث خطأ في توثيق المشتري:", error);
    }
}

// ================= نهاية دوال Firebase الإضافية =================

// دالة تفريغ السلة
function clearCartAfterPurchase() {
    cart = [];
    save();
    updateCart();
}

async function checkout() {
  if (!cart.length) {
    Swal.fire({
      icon: 'warning',
      text: currentLang === 'ar' ? 'سلة المشتريات فارغة.' : 'Your cart is empty.',
      confirmButtonText: currentLang === 'ar' ? 'حسناً' : 'OK',
      background: '#090f17', color: '#fff', confirmButtonColor: '#00f3ff'
    });
    return;
  }

  const name = ($('customerName')?.value || '').trim();
  const phone = ($('customerPhone')?.value || '').trim();
  const email = ($('customerEmail')?.value || '').trim();

  if (!name || !phone || !email) {
    Swal.fire({
      icon: 'warning',
      title: currentLang === 'ar' ? 'بيانات غير مكتملة' : 'Incomplete Information',
      text: currentLang === 'ar' ? 'برجاء ملء جميع الحقول لإتمام عملية الشراء.' : 'Please fill out all fields.',
      confirmButtonText: currentLang === 'ar' ? 'تعديل البيانات' : 'Edit Info',
      background: '#090f17', color: '#fff', confirmButtonColor: '#00f3ff'
    });
    return;
  }

  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const discountValue = Math.round(subtotal * coupon / 100);
  const total = subtotal - discountValue;

  if (total <= 0) return;

  Swal.fire({
    title: currentLang === 'ar' ? 'جاري تجهيز بوابة الدفع...' : 'Preparing Secure Gateway...',
    allowOutsideClick: false,
    background: '#090f17', color: '#fff',
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const res = await fetch('https://tech-gaming.store/api/myfatoorah/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name, phone, email },
        total,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category || '',
          price: Number(item.price || 0)
        }))
      })
    });

    const data = await res.json();

    if (!res.ok || !data.paymentUrl) {
      throw new Error(data.message || 'Payment link was not created.');
    }

    // --- العمليات التي تحدث فور نجاح إنشاء طلب الدفع --- //
    
    // 1. استخراج الـ User ID الخاص بالمشتري المسجل الدخول حالياً
    const currentUser = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : null;
    
    // 2. تحديث المخزون (خصم الكمية من قاعدة البيانات)
    await updateProductStockAfterPurchase(cart);
    
    // 3. توثيق عملية الشراء للعميل (إذا كان مسجلاً للدخول) للسماح له بالتعليق لاحقاً
    if (currentUser) {
        await registerVerifiedBuyer(cart, currentUser.uid);
    }
    
    // 4. تفريغ السلة بالكامل بعد كل الخطوات السابقة
    clearCartAfterPurchase();

    // 5. توجيه العميل لصفحة الدفع بأمان
    window.location.href = data.paymentUrl;

  } catch (e) {
    console.error('Checkout error:', e);
    Swal.fire({
      icon: 'error',
      title: currentLang === 'ar' ? 'خطأ في معالجة الدفع' : 'Payment Error',
      text: e.message,
      confirmButtonText: currentLang === 'ar' ? 'إغلاق' : 'Close',
      background: '#090f17', color: '#fff', confirmButtonColor: '#ef4444'
    });
  }
}

function save() {
  localStorage.setItem('techgaming_cart', JSON.stringify(cart));
  localStorage.setItem('techgaming_coupon', String(coupon));
}

function toggleCart() { $('cartDrawer')?.classList.toggle('open'); }
function scrollToId(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
function focusSearch() { scrollToId('products'); setTimeout(() => $('searchInput')?.focus(), 500); }

function openAuth() { window.location.href = 'login.html'; }
function closeAuth() { window.location.href = 'index.html'; }
function toggleChat() { $('chat')?.classList.toggle('open'); }
function reveal() { document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); }
