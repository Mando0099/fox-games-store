// ================= DATA (البيانات) =================
// تأكد من تعديل الروابط والأسماء هنا لتطابق منتجاتك الحقيقية
const categories = [
  { name: "PUBG Mobile", desc: "UC & Packs", bg: "/assets/pubg-bg.jpg" },
  { name: "Free Fire", desc: "Diamonds", bg: "/assets/ff-bg.jpg" },
  { name: "Valorant", desc: "Points", bg: "/assets/val-bg.jpg" },
  { name: "Steam", desc: "Gift Cards", bg: "/assets/steam-bg.jpg" },
  { name: "PlayStation", desc: "Cards & Plus", bg: "/assets/ps-bg.jpg" }
];

const products = [
  { name: "PUBG Mobile 60 UC", category: "PUBG Mobile", desc: "Instant recharge via ID", price: 60, img: "/assets/uc60.jpg", bg: "/assets/pubg-bg.jpg", popular: 90 },
  { name: "PUBG Mobile 325 UC", category: "PUBG Mobile", desc: "Instant recharge via ID", price: 300, img: "/assets/uc325.jpg", bg: "/assets/pubg-bg.jpg", popular: 95 },
  { name: "Valorant 1000 VP", category: "Valorant", desc: "Riot Games prepaid card", price: 450, img: "/assets/vp1000.jpg", bg: "/assets/val-bg.jpg", popular: 85 },
  { name: "Free Fire 100 Diamonds", category: "Free Fire", desc: "Instant recharge via ID", price: 80, img: "/assets/ff100.jpg", bg: "/assets/ff-bg.jpg", popular: 80 },
  { name: "Steam $10 Gift Card", category: "Steam", desc: "Global Wallet Code", price: 550, img: "/assets/steam10.jpg", bg: "/assets/steam-bg.jpg", popular: 88 }
];

// ================= APP LOGIC (الكود الأساسي) =================
let cart = JSON.parse(localStorage.getItem('foxgames_cart')) || [];
let coupon = Number(localStorage.getItem('foxgames_coupon')) || 0;
const $ = id => document.getElementById(id);

window.addEventListener('load', () => {
  renderCategories();
  renderFilters();
  renderProducts();
  updateCart();
  reveal();
});
window.addEventListener('scroll', reveal);

function renderMiniSlider() {}

// عرض التصنيفات بشكل صحيح
function renderCategories() {
  if (!$('categoryGrid')) return;
  $('categoryGrid').innerHTML = categories.map(cat => `
    <div class="trendCard reveal" onclick="selectCategory('${cat.name}')" style="background-image:url('${cat.bg}')">
      <div><h3>${cat.name}</h3><p>${cat.desc}</p></div>
    </div>`).join('');
}

// إنشاء قائمة الفلاتر تلقائياً بناءً على المنتجات المتاحة
function renderFilters() {
  if (!$('categoryFilter')) return;
  const list = ['All', ...new Set(products.map(p => p.category))];
  $('categoryFilter').innerHTML = list.map(x => `<option value="${x}">${x}</option>`).join('');
}

// عرض المنتجات بناءً على البحث والفلترة والترتيب
function renderProducts() {
  if (!$('productGrid')) return;

  const search = ($('searchInput')?.value || '').toLowerCase();
  const filter = $('categoryFilter')?.value || 'All';
  const sort = $('sortFilter')?.value;

  let list = products.filter(p => 
    `${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(search) && 
    (filter === 'All' || p.category === filter)
  );

  if (sort === 'low') list.sort((a, b) => a.price - b.price);
  if (sort === 'high') list.sort((a, b) => b.price - a.price);
  if (sort === 'popular') list.sort((a, b) => b.popular - a.popular);

  $('productGrid').innerHTML = list.map(p => {
    const i = products.indexOf(p);
    return `<article class="productCard reveal">
      <div class="productCover" style="background-image:url('${p.bg}')"><img src="${p.img}" alt="${p.name}"></div>
      <div class="productInfo">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="priceRow">
          <div class="price">${p.price}.00 EGP</div>
          <span class="rating">★ 4.9</span>
        </div>
        <button class="add" onclick="addToCart(${i})">Buy Now</button>
      </div>
    </article>`;
  }).join('');
  reveal();
}

// عند اختيار تصنيف يتم فلترة المنتجات بناءً عليه مباشرة
function selectCategory(c) {
  const f = $('categoryFilter');
  if (f) {
    f.value = c; 
  }
  renderProducts();
  scrollToId('products');
}

// إضافة منتج للسلة
function addToCart(i) {
  cart.push({ ...products[i], id: Date.now() + Math.random() });
  save();
  updateCart();
  $('cartDrawer')?.classList.add('open');
}

// حذف منتج من السلة
function removeItem(id) {
  cart = cart.filter(x => x.id !== id);
  save();
  updateCart();
}

// تحديث السلة والعدادات والمجاميع لحظياً وبدون ريفريش
function updateCart() {
  if ($('cartCount')) $('cartCount').textContent = cart.length;
  if ($('cartCountTop')) $('cartCountTop').textContent = cart.length;
  
  if ($('cartItems')) {
    $('cartItems').innerHTML = cart.length 
      ? cart.map(item => `
        <div class="cartItem">
          <div class="row">
            <div><b>${item.name}</b><br><small>${item.category}</small></div>
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

// تفعيل الكوبون
function applyCoupon() {
  const code = ($('couponInput')?.value || '').trim().toUpperCase();
  if (code === 'FOX10') {
    coupon = 10;
    save();
    updateCart();
    alert('Coupon FOX10 applied successfully! 🎉');
  } else {
    alert('Invalid coupon. Try: FOX10');
  }
}

// تجهيز الدفع أوتوماتيكياً
async function checkout() {
  if (!cart.length) return alert('Your cart is empty.');
  alert('Checkout system is ready. Connecting with backend payment gateway...');
}

// تطوير كود الواتساب ليسحب بيانات العميل والطلب بالكامل
function sendWhatsappOrder() {
  if (!cart.length) return alert('Your cart is empty.');

  const name = ($('customerName')?.value || '').trim();
  const phone = ($('customerPhone')?.value || '').trim();
  const payment = $('paymentMethod')?.value || 'Not Specified';
  
  if (!name || !phone) {
    return alert('Please enter your Name and Phone Number to complete the order.');
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

function toggleCart() {
  $('cartDrawer')?.classList.toggle('open');
}

function toggleMenu() {}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function focusSearch() {
  scrollToId('products');
  setTimeout(() => $('searchInput')?.focus(), 500);
}

function openAuth() { window.location.href = '/login.html'; }
function closeAuth() { window.location.href = '/'; }

function toggleChat() {
  $('chat')?.classList.toggle('open');
}

function reveal() {
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
}

function stars() {}
