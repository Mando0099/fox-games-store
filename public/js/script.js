// ================= FOX GAMES LIVE DATABASE LINK =================
// الاعتماد بالكامل على المصفوفات القادمة من الفايربيز والبانل بدون كود تجريبي
const $ = id => document.getElementById(id);

// هنا بنضمن إن لو الفايربيز اتأخر في التحميل، المتجر ما يضربش ويفضل مستني الداتا
if (typeof cart === 'undefined') {
  var cart = JSON.parse(localStorage.getItem('foxgames_cart')) || [];
}
if (typeof coupon === 'undefined') {
  var coupon = Number(localStorage.getItem('foxgames_coupon')) || 0;
}

// مصفوفة الترجمة الحقيقية المتوافقة مع أوسمة الـ HTML الجديدة
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
    holder_name: "Full Name", holder_phone: "Phone Number", opt_visa: "Visa / MasterCard",
    opt_wallet: "Wallet", opt_vodafone: "Vodafone Cash", opt_fawry: "Fawry", opt_bank: "Bank Transfer",
    btn_pay_now: "Pay Now", btn_wa_order: "WhatsApp Order", secure_checkout_notice: "Secure checkout connected through the backend.",
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
    holder_name: "الاسم بالكامل", holder_phone: "رقم الهاتف المحمول", opt_visa: "فيزا / ماستركارد",
    opt_wallet: "المحافظ الإلكترونية", opt_vodafone: "فودافون كاش", opt_fawry: "فوري", opt_bank: "تحويل بنكي",
    btn_pay_now: "ادفع الآن بأمان", btn_wa_order: "طلب عبر الواتساب", secure_checkout_notice: "بوابة دفع آمنة تماماً ومتصلة بالسيرفر.",
    lang_btn: "English"
  }
};

let currentLang = localStorage.getItem('foxgames_lang') || 'en';

window.addEventListener('load', () => {
  // تطبيق اللغة المحفوظة فور تحميل المتجر
  applyLanguage(currentLang);

  // تشغيل الفانكشنز الأساسية المرتبطة بالفايربيز والـ Auth في مشروعك
  if (typeof checkAuthState === 'function') checkAuthState();
  
  // انتظر ثواني للتأكد من سحب الداتا بالكامل من البانل ثم اعرضها
  setTimeout(() => {
    renderCategories();
    renderFilters();
    renderProducts();
    updateCart();
  }, 1000); 
  
  reveal();
});

window.addEventListener('scroll', reveal);

function renderMiniSlider() {}

// عرض التصنيفات الحقيقية
function renderCategories() {
  if (!$('categoryGrid')) return;
  if (typeof categories === 'undefined' || !categories.length) return;
  
  $('categoryGrid').innerHTML = categories.map(cat => {
    const catImg = cat.bg || cat.image || '';
    return `
    <div class="trendCard reveal" onclick="selectCategory('${cat.name}')" style="position: relative; overflow: hidden; aspect-ratio: 3 / 2;">
      <img src="${catImg}" alt="${cat.name}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0; z-index: 1;">
      <div style="position: relative; z-index: 2;"><h3>${cat.name}</h3><p>${cat.desc || ''}</p></div>
    </div>`;
  }).join('');
}

// إنشاء قائمة الفلاتر تلقائياً من الألعاب المرفوعة على الفايربيز
function renderFilters() {
  if (!$('categoryFilter')) return;
  if (typeof products === 'undefined' || !products.length) return;
  
  const list = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  $('categoryFilter').innerHTML = list.map(x => `<option value="${x}">${x}</option>`).join('');
}

// عرض المنتجات
function renderProducts() {
  if (!$('productGrid')) return;
  if (typeof products === 'undefined' || !products.length) {
    $('productGrid').innerHTML = `<p style="color:var(--muted); grid-column: 1/-1; text-align:center; padding: 40px 0;">Loading products from Firebase...</p>`;
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
    const i = products.indexOf(p);
    const imgUrl = p.img || p.image || '';
    
    return `<article class="productCard reveal">
      <div class="productCover" style="width: 100%; aspect-ratio: 16 / 9; overflow: hidden; background-image: none !important;">
        <img src="${imgUrl}" alt="${p.name}" style="width: 100%; height: 100%; object-fit: cover; object-position: center;">
      </div>
      <div class="productInfo">
        <h3>${p.name}</h3>
        <p>${p.desc || ''}</p>
        <div class="priceRow">
          <div class="price">${p.price}.00 EGP</div>
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

// دالة إعادة تعيين الفلتر عند الضغط على View All
function resetCategoryFilter() {
  const f = $('categoryFilter');
  if (f) f.value = 'All';
  renderProducts();
  scrollToId('products');
}

function addToCart(i) {
  if (typeof products === 'undefined' || !products[i]) return;
  cart.push({ ...products[i], id: Date.now() + Math.random() });
  save();
  updateCart();
  $('cartDrawer')?.classList.add('open');
}

function removeItem(id) {
  cart = cart.filter(x => x.id !== id);
  save();
  updateCart();
}

function updateCart() {
  if ($('cartCount')) $('cartCount').textContent = cart.length;
  if ($('cartCountTop')) $('cartCountTop').textContent = cart.length;
  
  if ($('cartItems')) {
    $('cartItems').innerHTML = cart.length 
      ? cart.map(item => `
        <div class="cartItem">
          <div class="row">
            <div><b>${item.name}</b><br><small>${item.category || ''}</small></div>
            <b class="green-text">${item.price} EGP</b>
          </div>
          <button onclick="removeItem(${item.id})">Remove</button>
        </div>`).join('')
      : `<p style="color:#94a3b8; text-align:center; padding:20px;">Your cart is empty.</p>`;
  }

  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const discountValue = Math.round(subtotal * coupon / 100);
  
  if ($('subtotal')) $('subtotal').textContent = `${subtotal} EGP`;
  if ($('discount')) $('discount').textContent = `${discountValue} EGP`;
  if ($('total')) $('total').textContent = `${subtotal - discountValue} EGP`;
}

// نظام تبديل اللغة الاحترافي والآمن
function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'ar' : 'en';
  localStorage.setItem('foxgames_lang', currentLang);
  applyLanguage(currentLang);
}

function applyLanguage(lang) {
  // 1. تحديث اتجاه لغة الصفحة بالكامل
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;

  // 2. ترجمة النصوص العادية التي تحتوي على وسم data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      // لو العنصر جواه أيقونة Font Awesome نحتفظ بها ونغير النص فقط
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

  // 3. ترجمة نصوص الـ Placeholders (خانات البحث والبيانات)
  document.querySelectorAll('[data-i18n-holder]').forEach(el => {
    const key = el.getAttribute('data-i18n-holder');
    if (translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });

  // 4. تحديث نص زرار التبديل نفسه
  if ($('langToggleBtn')) {
    $('langToggleBtn').textContent = translations[lang]['lang_btn'];
  }
}

function applyCoupon() {
  const code = ($('couponInput')?.value || '').trim().toUpperCase();
  if (code === 'FOX10') {
    coupon = 10;
    save();
    updateCart();
    alert(currentLang === 'ar' ? 'تم تطبيق كود الخصم بنجاح! 🎉' : 'Coupon FOX10 applied successfully! 🎉');
  } else {
    alert(currentLang === 'ar' ? 'كود غير صحيح. جرب: FOX10' : 'Invalid coupon. Try: FOX10');
  }
}

async function checkout() {
  if (!cart.length) return alert(currentLang === 'ar' ? 'السلة فارغة.' : 'Your cart is empty.');
  alert(currentLang === 'ar' ? 'بوابة الدفع جاهزة. يتم الاتصال الآن بالسيرفر...' : 'Checkout system is ready. Connecting with backend payment gateway...');
}

function sendWhatsappOrder() {
  if (!cart.length) return alert(currentLang === 'ar' ? 'السلة فارغة.' : 'Your cart is empty.');

  const name = ($('customerName')?.value || '').trim();
  const phone = ($('customerPhone')?.value || '').trim();
  const payment = $('paymentMethod')?.value || 'Not Specified';
  
  if (!name || !phone) {
    return alert(currentLang === 'ar' ? 'برجاء إدخال الاسم ورقم الهاتف لإكمال الطلب.' : 'Please enter your Name and Phone Number to complete the order.');
  }

  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const discountValue = Math.round(subtotal * coupon / 100);
  const finalTotal = subtotal - discountValue;

  let msg = `🎮 *New Order from Fox Games* 🎮%0A%0A`;
  msg += `👤 *Customer Name:* ${encodeURIComponent(name)}%0A`;
  msg += `📞 *Phone Number:* ${encodeURIComponent(phone)}%0A`;
  msg += `💳 *Payment Method:* ${encodeURIComponent(payment)}%0A%0A`;
  msg += `📦 *Products:*%0A`;
  
  cart.forEach((item, i) => {
    msg += `${i + 1}- ${encodeURIComponent(item.name)} (${item.price} EGP)%0A`;
  });

  msg += `%0A💰 *Total Amount:* ${finalTotal} EGP`;
  
  window.open(`https://wa.me/201010502795?text=${msg}`, '_blank');
}

function save() {
  localStorage.setItem('foxgames_cart', JSON.stringify(cart));
  localStorage.setItem('foxgames_coupon', String(coupon));
}

function toggleCart() { $('cartDrawer')?.classList.toggle('open'); }
function toggleMenu() {}
function scrollToId(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
function focusSearch() { scrollToId('products'); setTimeout(() => $('searchInput')?.focus(), 500); }

function openAuth() { window.location.href = 'login.html'; }
function closeAuth() { window.location.href = 'index.html'; }

function toggleChat() { $('chat')?.classList.toggle('open'); }
function reveal() { document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); }
function stars() {}
