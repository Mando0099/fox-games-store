// ================= TECH GAMING LIVE DATABASE & MULTI-CURRENCY =================
const $ = id => document.getElementById(id);

if (typeof cart === 'undefined') {
  var cart = JSON.parse(localStorage.getItem('techgaming_cart')) || [];
}
if (typeof coupon === 'undefined') {
  var coupon = 0; 
  localStorage.setItem('techgaming_coupon', '0');
}

// 💱 إعدادات العملات والدول وأسعار الصرف (Base: EGP)
const currencyRates = {
  EGP: { symbol: 'EGP', rate: 1, flag: '🇪🇬', name: 'مصر (EGP)' },
  USD: { symbol: 'USD', rate: 0.021, flag: '🇺🇸', name: 'أمريكا / دولي (USD)' },
  SAR: { symbol: 'SAR', rate: 0.078, flag: '🇸🇦', name: 'السعودية (SAR)' },
  AED: { symbol: 'AED', rate: 0.076, flag: '🇦🇪', name: 'الإمارات (AED)' },
  KWD: { symbol: 'KWD', rate: 0.0064, flag: '🇰🇼', name: 'الكويت (KWD)' }
};

let currentCurrency = localStorage.getItem('techgaming_currency') || 'EGP';
let currentLang = localStorage.getItem('techgaming_lang') || 'en';

function formatPrice(egpPrice) {
  const c = currencyRates[currentCurrency] || currencyRates.EGP;
  const converted = (Number(egpPrice || 0) * c.rate);
  return `${converted.toFixed(2)} ${c.symbol}`;
}

function getConvertedAmount(egpPrice) {
  const c = currencyRates[currentCurrency] || currencyRates.EGP;
  return Number((Number(egpPrice || 0) * c.rate).toFixed(2));
}

function setStoreCurrency(cur) {
  if (currencyRates[cur]) {
    currentCurrency = cur;
    localStorage.setItem('techgaming_currency', cur);
    
    // مزامنة كافة القوائم المنسدلة للعملات في الصفحة والسلة
    const curSelectTop = $('storeCurrencySelector');
    if (curSelectTop) curSelectTop.value = cur;
    const curSelectCart = $('currencySelect');
    if (curSelectCart) curSelectCart.value = cur;
    
    renderProducts();
    updateCart();
  }
}

const translations = {
  en: {
    nav_home: "Home", nav_store: "Store", nav_categories: "Categories", nav_support: "Support",
    search_placeholder: "Search for accounts, codes...", btn_login: "Login", btn_cart: "Cart",
    hero_title: "TECH GAMING", hero_subtitle: "Instant delivery. Premium digital services. Best prices.",
    btn_shop_now: "Shop Now", btn_browse_cat: "Browse Categories",
    feat_delivery: "Instant Delivery", feat_secure: "Secure Payments", feat_support: "24/7 Support",
    title_popular: "Products", sort_popular: "Most Popular", sort_low: "Price Low", sort_high: "Price High",
    title_categories: "Shop by Categories", btn_view_all: "View All",
    b_feat1_title: "Instant Delivery", b_feat1_desc: "Get your digital product instantly after payment",
    b_feat2_title: "Secure Payments", b_feat2_desc: "100% secure encrypted payment methods",
    b_feat3_title: "24/7 Support", b_feat3_desc: "We are here to help you anytime",
    b_feat4_title: "Best Prices", b_feat4_desc: "Competitive prices on all accounts and services",
    check_title: "Secure Payment Methods", check_desc: "Choose your product, add it to cart, and complete the order securely.",
    sup_title: "Need Help With Your Order?", sup_desc: "Payment failed, code delayed— contact support instantly.",
    btn_live_chat: "Live Chat", cart_title: "Your Cart", btn_apply: "Apply",
    cart_subtotal: "Subtotal", cart_discount: "Discount", cart_total: "Total",
    holder_name: "Full Name", holder_phone: "Phone Number", holder_email: "Email Address",
    btn_pay_now: "Secure Checkout", secure_checkout_notice: "Secure checkout connected through the backend.",
    lang_btn: "العربية"
  },
  ar: {
    nav_home: "الرئيسية", nav_store: "المتجر", nav_categories: "الأقسام", nav_support: "الدعم الفني",
    search_placeholder: "بحث", btn_login: "تسجيل الدخول", btn_cart: "السلة",
    hero_title: "تك جيمنج", hero_subtitle: "تسليم فوري. خدمات رقمية مميزة. أفضل الأسعار.",
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

window.addEventListener('load', () => {
  applyLanguage(currentLang);
  if (typeof checkAuthState === 'function') checkAuthState();
  
  const curSelectTop = $('storeCurrencySelector');
  if (curSelectTop) curSelectTop.value = currentCurrency;
  const curSelectCart = $('currencySelect');
  if (curSelectCart) curSelectCart.value = currentCurrency;

  waitForDataAndRender();
  reveal();
});

function waitForDataAndRender(attempt = 0) {
  const maxAttempts = 20;      
  const dataIsReady = typeof products !== 'undefined' && products.length > 0;

  if (dataIsReady) {
    renderCategories();
    renderFilters();
    renderProducts();
    updateCart();
    return;
  }

  if (attempt >= maxAttempts) {
    const grid = $('categoryGrid');
    if (grid) {
      grid.innerHTML = `<p style="color:var(--muted); grid-column:1/-1; text-align:center; padding:20px;">
        ${currentLang === 'ar' ? 'تعذر تحميل الأقسام، جرّب تحديث الصفحة.' : 'Could not load categories. Please refresh.'}
      </p>`;
    }
    if ($('productGrid')) {
      $('productGrid').innerHTML = `<p style="color:var(--muted); grid-column:1/-1; text-align:center; padding:40px 0;">
        ${currentLang === 'ar' ? 'تعذر تحميل المنتجات، جرّب تحديث الصفحة.' : 'Could not load products. Please refresh.'}
      </p>`;
    }
    return;
  }

  setTimeout(() => waitForDataAndRender(attempt + 1), 500);
}

window.addEventListener('scroll', reveal);

function setSessionTimer() {
  localStorage.setItem('techgaming_login_time', new Date().getTime());
}

function checkSession() {
  const loginTime = localStorage.getItem('techgaming_login_time');
  if (loginTime) {
    const currentTime = new Date().getTime();
    const oneHour = 60 * 60 * 1000;
    if (currentTime - loginTime > oneHour) {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        firebase.auth().signOut().then(() => {
          localStorage.removeItem('techgaming_login_time');
          Swal.fire({
            icon: 'info',
            title: currentLang === 'ar' ? 'انتهت الجلسة' : 'Session Expired',
            text: currentLang === 'ar' ? 'مرت ساعة على تسجيل دخولك، يرجى تسجيل الدخول مرة أخرى.' : 'Your session has expired. Please log in again.',
            background: '#090f17', color: '#fff', confirmButtonColor: '#00f3ff',
            customClass: { container: 'high-z-index-alert' }
          }).then(() => window.location.reload());
        });
      }
    }
  }
}
setInterval(checkSession, 60000);

function renderCategories() {
  const grid = $('categoryGrid');
  if (!grid) return;

  if ((typeof categories === 'undefined' || !categories.length) && typeof products !== 'undefined' && products.length > 0) {
    const uniqueCats = [...new Set(products.map(p => p.category).filter(Boolean))];
    window.categories = uniqueCats.map(c => ({
      name: c,
      desc: `${c} Accounts & Services`,
      bg: '/assets/bg-pubg.svg'
    }));
  }

  if (typeof categories === 'undefined' || !categories.length) return;
  
  grid.innerHTML = categories.map(cat => {
    const catImg = cat.bg || cat.image || '/assets/bg-pubg.svg';
    return `
    <div class="trendCard reveal" onclick="filterByCategory('${cat.name}')">
      <img src="${catImg}" alt="${cat.name}">
      <div><h3>${cat.name}</h3><p>${cat.desc || ''}</p></div>
    </div>`;
  }).join('');
  
  reveal();
}

function filterByCategory(categoryName) {
  const categoryFilterSelect = $('categoryFilter');
  if (categoryFilterSelect) categoryFilterSelect.value = categoryName;
  scrollToId('products');
  renderProducts();
}

function resetCategoryFilter() {
  const categoryFilterSelect = $('categoryFilter');
  if (categoryFilterSelect) categoryFilterSelect.value = 'All';
  renderProducts();
  scrollToId('products');
}

function renderFilters() {
  if (!$('categoryFilter')) return;
  if (typeof products === 'undefined' || !products.length) return;
  
  const list = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  $('categoryFilter').innerHTML = list.map(x => `<option value="${x}">${x === 'All' ? (currentLang === 'ar' ? 'الكل' : 'All') : x}</option>`).join('');
}

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
    const stockCount = Number(p.stock || 0);
    const isOutOfStock = stockCount <= 0;
    const btnText = isOutOfStock 
      ? (currentLang === 'ar' ? 'نفذت الكمية' : 'Out of Stock') 
      : (currentLang === 'ar' ? 'عرض التفاصيل' : 'View Details');
    
    return `<article class="productCard reveal">
      <div class="productCover">
        <img src="${imgUrl}" alt="${p.name}">
      </div>
      <div class="productInfo">
        <h3>${p.name}</h3>
        <p>${p.desc || ''}</p>
        <div class="priceRow">
          <div class="price">${formatPrice(p.price)}</div>
          <span class="rating" style="${isOutOfStock ? 'color: #ef4444;' : 'color: var(--accent);'}">📦 ${stockCount}</span>
        </div>
        <button class="${isOutOfStock ? 'add out-of-stock-btn' : 'add'}" ${isOutOfStock ? 'disabled' : `onclick="openProductModal(${originalIndex})"`}>${btnText}</button>
      </div>
    </article>`;
  }).join('');
  reveal();
}

let currentSelectedProduct = null;
let currentProductStock = 0;

function openProductModal(index) {
  const p = products[index];
  if(!p) return;
  currentSelectedProduct = p;
  currentProductStock = (p.stock !== undefined) ? Number(p.stock) : 0; 

  $('modalProductName').innerText = p.name;
  $('modalProductPrice').innerText = formatPrice(p.price);
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
  if (parseInt(input.value) < currentProductStock) input.value = parseInt(input.value) + 1;
}

function decreaseQty() {
  let input = $('modalQty');
  if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
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
                <span class="cartItem-price">${formatPrice(item.price)}</span>
              </div>
              <button class="cartItem-remove-btn" onclick="removeItem(${item.cartId})" title="Remove">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>`;
        }).join('')
      : `<p style="color:#94a3b8; text-align:center; padding:30px; font-size:13px;">${currentLang === 'ar' ? 'سلة المشتريات فارغة حالياً.' : 'Your cart is empty.'}</p>`;
  }

  const subtotalEGP = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const discountEGP = Math.round(subtotalEGP * coupon / 100);
  const totalEGP = subtotalEGP - discountEGP;
  
  if ($('subtotal')) $('subtotal').textContent = formatPrice(subtotalEGP);
  if ($('discount')) $('discount').textContent = formatPrice(discountEGP);
  if ($('total')) $('total').textContent = formatPrice(totalEGP);
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
    if (translations[lang][key]) el.placeholder = translations[lang][key];
  });

  if ($('langToggleBtn')) $('langToggleBtn').textContent = translations[lang]['lang_btn'];
}

async function applyCoupon() {
  const code = ($('couponInput')?.value || '').trim().toUpperCase();
  if (!code || typeof firebase === 'undefined' || !firebase.firestore) return;

  try {
    const couponDoc = await firebase.firestore().collection('coupons').doc(code).get();
    if (couponDoc.exists) {
      coupon = parseFloat(couponDoc.data().value || 0); 
      save();
      updateCart();
      Swal.fire({ icon: 'success', title: currentLang === 'ar' ? 'تم تطبيق الخصم!' : 'Coupon Applied!', timer: 2000, showConfirmButton: false, background: '#090f17', color: '#fff' });
    } else {
      Swal.fire({ icon: 'error', title: currentLang === 'ar' ? 'كود غير صحيح' : 'Invalid Coupon', background: '#090f17', color: '#fff' });
    }
  } catch (error) { console.error(error); }
}

async function updateProductStockAfterPurchase(purchasedItems) {
  if (typeof firebase === 'undefined' || !firebase.firestore) return;
  const db = firebase.firestore();
  const batch = db.batch();
  purchasedItems.forEach(item => {
    if (item.id) {
      batch.update(db.collection('products').doc(String(item.id)), { stock: firebase.firestore.FieldValue.increment(-1) });
    }
  });
  await batch.commit();
}

function clearCartAfterPurchase() {
  cart = [];
  save();
  updateCart();
}

function processSecureCheckout() {
  const currentUser = typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser;
  const drawer = $('cartDrawer');
  if (drawer) { drawer.classList.remove('open'); drawer.style.display = 'none'; }
  
  if (!currentUser) {
    setTimeout(() => {
      Swal.fire({
        icon: 'warning',
        title: currentLang === 'ar' ? 'تسجيل الدخول مطلوب' : 'Login Required',
        text: currentLang === 'ar' ? 'يجب عليك تسجيل الدخول لإتمام عملية الشراء.' : 'You must log in to complete your purchase.',
        confirmButtonText: currentLang === 'ar' ? 'تسجيل الدخول الآن' : 'Log In Now',
        background: '#090f17', color: '#fff', confirmButtonColor: '#00f3ff'
      }).then((result) => {
        if (drawer) drawer.style.display = 'block';
        if (result.isConfirmed && typeof openAuth === 'function') openAuth();
      });
    }, 150);
    return;
  }
  checkout();
}

async function checkout() {
  const drawer = $('cartDrawer');
  if (drawer) { drawer.classList.remove('open'); drawer.style.display = 'none'; }

  if (!cart.length) return;

  const name = ($('customerName')?.value || '').trim();
  const phone = ($('customerPhone')?.value || '').trim();
  const email = ($('customerEmail')?.value || '').trim();

  if (!name || !phone || !email) {
    setTimeout(() => {
      Swal.fire({
        icon: 'warning',
        title: currentLang === 'ar' ? 'بيانات غير مكتملة' : 'Incomplete Information',
        text: currentLang === 'ar' ? 'برجاء ملء جميع الحقول المطلوبة.' : 'Please fill in all fields.',
        background: '#090f17', color: '#fff', confirmButtonColor: '#00f3ff'
      }).then(() => { if (drawer) { drawer.style.display = 'block'; drawer.classList.add('open'); } });
    }, 150);
    return;
  }

  const subtotalEGP = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const discountEGP = Math.round(subtotalEGP * coupon / 100);
  const totalEGP = subtotalEGP - discountEGP;
  const finalConvertedTotal = getConvertedAmount(totalEGP);

  Swal.fire({
    title: currentLang === 'ar' ? 'جاري تحويلك لبوابة الدفع الآمنة...' : 'Connecting to Secure Gateway...',
    allowOutsideClick: false,
    background: '#090f17', color: '#fff',
    didOpen: () => Swal.showLoading()
  });

  try {
    const apiRes = await fetch(`/api/create-payment?v=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { 
          name: name.substring(0, 50), 
          phone: phone.replace(/\D/g, '').slice(-11) || '01000000000', 
          email: email 
        },
        total: finalConvertedTotal,
        currency: currentCurrency,
        items: cart.map(item => ({
          id: String(item.id || item.docId || '1'),
          name: String(item.name || 'Digital Product').substring(0, 100),
          category: String(item.category || ''),
          price: getConvertedAmount(item.price),
          quantity: 1
        }))
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok || !data.paymentUrl) {
      throw new Error(data.message || 'فشل إنشاء رابط الدفع.');
    }

    await updateProductStockAfterPurchase(cart);
    clearCartAfterPurchase();
    window.location.href = data.paymentUrl;

  } catch (e) {
    console.error('Checkout error:', e);
    if (drawer) drawer.style.display = 'block';
    Swal.fire({
      icon: 'error',
      title: currentLang === 'ar' ? 'خطأ في معالجة الدفع' : 'Payment Error',
      text: e.message,
      background: '#090f17', color: '#fff', confirmButtonColor: '#ef4444'
    });
  }
}

function save() {
  localStorage.setItem('techgaming_cart', JSON.stringify(cart));
  localStorage.setItem('techgaming_coupon', String(coupon));
}

function toggleCart() { 
  const drawer = $('cartDrawer');
  if (drawer) {
    if (drawer.style.display === 'none') drawer.style.display = 'block';
    drawer.classList.toggle('open');
  }
}

function scrollToId(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
function focusSearch() { scrollToId('products'); setTimeout(() => $('searchInput')?.focus(), 500); }
function openAuth() { window.location.href = 'login.html'; }
function reveal() { document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); }
