// ================= FOX GAMES LIVE DATABASE LINK =================
const $ = id => document.getElementById(id);

if (typeof cart === 'undefined') {
  var cart = JSON.parse(localStorage.getItem('foxgames_cart')) || [];
}
if (typeof coupon === 'undefined') {
  var coupon = 0; 
  localStorage.setItem('foxgames_coupon', '0');
}

// مصفوفات عامة نخزن فيها الداتا لو اتسحبت من الفايربيز
window.products = window.products || [];
window.categories = window.categories || [];

const translations = {
  en: {
    nav_home: "Home", nav_store: "Store", nav_categories: "Categories", nav_support: "Support",
    search_placeholder: "Search for products...", btn_login: "Login", btn_cart: "Cart",
    hero_title: "Game Cards & Top-Ups", hero_subtitle: "Instant delivery. Secure payments. Best prices.",
    btn_shop_now: "Shop Now", btn_browse_cat: "Browse Categories",
    feat_delivery: "Instant Delivery", feat_secure: "Secure Payments", feat_support: "24/7 Support",
    title_popular: "Popular Products", sort_popular: "Most Popular", sort_low: "Price Low", sort_high: "Price High",
    title_categories: "Shop by Categories", btn_view_all: "View All",
    b_feat1_title: "Instant Delivery", b_feat1_desc: "Get your products instantly after payment",
    b_feat2_title: "Secure Payments", b_feat2_desc: "100% secure payment methods",
    b_feat3_title: "24/7 Support", b_feat3_desc: "We are here to help you anytime",
    b_feat4_title: "Best Prices", b_feat4_desc: "Competitive prices on all products",
    check_title: "Secure Payment Methods", check_desc: "Choose your product, add it to cart, and complete the order using your preferred payment method.",
    sup_title: "Need Help With Your Order?", sup_desc: "Payment failed, code delayed, top-up issue, account problem — contact support instantly.",
    btn_live_chat: "Live Chat", cart_title: "Your Cart", btn_apply: "Apply",
    cart_subtotal: "Subtotal", cart_discount: "Discount", cart_total: "Total",
    holder_name: "Full Name", holder_phone: "Phone Number",
    btn_pay_now: "Pay Now", secure_checkout_notice: "Secure checkout connected through the backend.",
    lang_btn: "العربية"
  },
  ar: {
    nav_home: "الرئيسية", nav_store: "المتجر", nav_categories: "الأقسام", nav_support: "الدعم الفني",
    search_placeholder: "ابحث عن الألعاب والمنتجات...", btn_login: "تسجيل الدخول", btn_cart: "السلة",
    hero_title: "بطاقات الألعاب وشحن الرصيد", hero_subtitle: "تسليم فوري. دفع آمن. أفضل الأسعار التنافسية.",
    btn_shop_now: "تسوق الآن", btn_browse_cat: "تصفح الأقسام",
    feat_delivery: "تسليم فوري", feat_secure: "طرق دفع آمنة", feat_support: "دعم 24/7",
    title_popular: "المنتجات الشائعة", sort_popular: "الأكثر شعبية", sort_low: "السعر من الأقل", sort_high: "السعر من الأعلى",
    title_categories: "تسوق حسب الأقسام", btn_view_all: "عرض الكل",
    b_feat1_title: "تسليم فوري وسريع", b_feat1_desc: "احصل على منتجك مباشرة كود رقمي فور الدفع",
    b_feat2_title: "دفع آمن 100%", b_feat2_desc: "نوفر لك خيارات دفع محلية وعالمية مشفرة",
    b_feat3_title: "دعم فني متواصل", b_feat3_desc: "فريق الدعم الفني معك دائماً لحل أي استفسار",
    b_feat4_title: "أفضل الأسعار", b_feat4_desc: "عروض حصرية وأسعار لا تقبل المنافسة",
    check_title: "طرق دفع آمنة وموثوقة", check_desc: "اختر منتجك المفضّل، أضفه إلى سلة المشتريات، وأكمل الدفع بالطريقة التي تناسبك.",
    sup_title: "هل تحتاج مساعدة في طلبك؟", sup_desc: "تأخر الكود، مشكلة في الشحن، فشل عملية الدفع — تواصل مع الدعم فوراً.",
    btn_live_chat: "المحادثة المباشرة", cart_title: "سلة المشتريات", btn_apply: "تطبيق",
    cart_subtotal: "المجموع الفرعي", cart_discount: "الخصم", cart_total: "الإجمالي الكلي",
    holder_name: "الاسم بالكامل", holder_phone: "رقم الهاتف المحمول",
    btn_pay_now: "Pay Now", secure_checkout_notice: "بوابة دفع آمنة تماماً ومتصلة بالسيرفر.",
    lang_btn: "English"
  }
};

let currentLang = localStorage.getItem('foxgames_lang') || 'en';

window.addEventListener('load', async () => {
  applyLanguage(currentLang);
  if (typeof checkAuthState === 'function') checkAuthState();
  
  // جلب البيانات مباشرة من فايربيز لو مش محملة
  await loadDataFromFirebase();

  renderCategories();
  renderFilters();
  renderProducts();
  updateCart();
  reveal();
});

window.addEventListener('scroll', reveal);

// دالة لجلب الأقسام والمنتجات من فايربيز مباشرة لو مش موجودة
async function loadDataFromFirebase() {
  if (typeof firebase === 'undefined' || !firebase.firestore) return;
  try {
    const db = firebase.firestore();
    
    // سحب المنتجات
    if (!products.length) {
      const prodSnapshot = await db.collection('products').get();
      products = prodSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    // سحب التصنيفات
    if (!categories.length) {
      const catSnapshot = await db.collection('categories').get();
      categories = catSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (e) {
    console.error("Error loading data from Firebase:", e);
  }
}

function renderMiniSlider() {}

// عرض التصنيفات الحقيقية
function renderCategories() {
  const grid = $('categoryGrid');
  if (!grid) return;
  
  if (!categories.length) {
    grid.innerHTML = `<p style="color:#94a3b8; text-align:center; padding: 20px; grid-column: 1/-1;">No categories available.</p>`;
    return;
  }
  
  grid.innerHTML = categories.map(cat => {
    const catImg = cat.bg || cat.image || 'https://picsum.photos/300/200';
    return `
    <div class="trendCard reveal" onclick="selectCategory('${cat.name}')">
      <img src="${catImg}" alt="${cat.name}">
      <div><h3>${cat.name}</h3><p>${cat.desc || ''}</p></div>
    </div>`;
  }).join('');
}

function renderFilters() {
  const f = $('categoryFilter');
  if (!f) return;
  if (!products.length) return;
  
  const list = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  f.innerHTML = list.map(x => `<option value="${x}">${x}</option>`).join('');
}

// عرض المنتجات
function renderProducts() {
  const grid = $('productGrid');
  if (!grid) return;
  
  if (!products.length) {
    grid.innerHTML = `<p style="color:var(--muted); grid-column: 1/-1; text-align:center; padding: 40px 0;">Loading products from Firebase...</p>`;
    return;
  }

  const search = ($('searchInput')?.value || '').toLowerCase();
  const filter = $('categoryFilter')?.value || 'All';
  const sort = $('sortFilter')?.value;

  let list = products.filter(p => 
    `${p.name || ''} ${p.category || ''} ${p.desc || ''}`.toLowerCase().includes(search) && 
    (filter === 'All' || p.category === filter)
  );

  if (sort === 'low') list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  if (sort === 'high') list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
  if (sort === 'popular') list.sort((a, b) => (b.popular || 0) - (a.popular || 0));

  grid.innerHTML = list.map(p => {
    const i = products.indexOf(p);
    const imgUrl = p.img || p.image || 'https://picsum.photos/300/200';
    
    return `<article class="productCard reveal">
      <div class="productCover">
        <img src="${imgUrl}" alt="${p.name || 'Product'}">
      </div>
      <div class="productInfo">
        <h3>${p.name || ''}</h3>
        <p>${p.desc || ''}</p>
        <div class="priceRow">
          <div class="price">${p.price || 0}.00 EGP</div>
          <span class="rating">★ ${p.rating || '4.9'}</span>
        </div>
        <button class="add" onclick="addToCart(${i})">Buy Now</button>
      </div>
    </article>`;
  }).join('');
  reveal();
}

function selectCategory(c) {
  const f = $('categoryFilter');
  if (f) f.value = c; 
  renderProducts();
  scrollToId('products');
}

function resetCategoryFilter() {
  const f = $('categoryFilter');
  if (f) f.value = 'All';
  renderProducts();
  scrollToId('products');
}

function addToCart(i) {
  if (!products[i]) return;
  cart.push({ 
    ...products[i], 
    cartId: Date.now() + Math.random(),
    id: products[i].id || i
  });
  save();
  updateCart();
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
          const imgUrl = item.img || item.image || 'https://picsum.photos/150';
          return `
            <div class="cartItem">
              <img src="${imgUrl}" class="cartItem-img" alt="${item.name || ''}">
              <div class="cartItem-details">
                <span class="cartItem-name">${item.name || ''}</span>
                <span class="cartItem-cat">${item.category || ''}</span>
                <span class="cartItem-price">${item.price || 0} EGP</span>
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
  localStorage.setItem('foxgames_lang', currentLang);
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
  if (!code) return;
  if (typeof firebase === 'undefined' || !firebase.firestore) return;

  try {
    const couponDoc = await firebase.firestore().collection('coupons').doc(code).get();
    if (couponDoc.exists) {
      coupon = parseFloat(couponDoc.data().value || 0); 
      save();
      updateCart();
    }
  } catch (error) {
    console.error("Error fetching coupon:", error);
  }
}

async function checkout() {
  if (!cart.length) return;
  const name = ($('customerName')?.value || '').trim();
  const phone = ($('customerPhone')?.value || '').trim();
  const email = ($('customerEmail')?.value || '').trim();

  if (!name || !phone || !email) return;

  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const total = subtotal - Math.round(subtotal * coupon / 100);

  try {
    const res = await fetch('https://fox-games-store-1.onrender.com/api/myfatoorah/create-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name, phone, email },
        total,
        items: cart.map(item => ({ id: item.id, name: item.name, category: item.category || '', price: Number(item.price || 0) }))
      })
    });
    const data = await res.json();
    if (data.paymentUrl) window.location.href = data.paymentUrl;
  } catch (e) {
    console.error('Checkout error:', e);
  }
}

function save() {
  localStorage.setItem('foxgames_cart', JSON.stringify(cart));
  localStorage.setItem('foxgames_coupon', String(coupon));
}

function toggleCart(event) {
  if (event && typeof event.stopPropagation === 'function') {
    event.stopPropagation();
  }
  $('cartDrawer')?.classList.toggle('open');
}

function toggleMenu() {}
function scrollToId(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
function focusSearch() { scrollToId('products'); setTimeout(() => $('searchInput')?.focus(), 500); }
function openAuth() { window.location.href = 'login.html'; }
function closeAuth() { window.location.href = 'index.html'; }
function toggleChat() { $('chat')?.classList.toggle('open'); }
function reveal() { document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); }
function stars() {}
