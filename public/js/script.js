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
  if (typeof categories === 'undefined') return; // حماية في حال لم يتم تحميل مصفوفة البيانات بعد
  $('categoryGrid').innerHTML = categories.map(cat => `
    <div class="trendCard reveal" onclick="selectCategory('${cat.name}')" style="background-image:url('${cat.bg}')">
      <div><h3>${cat.name}</h3><p>${cat.desc}</p></div>
    </div>`).join('');
}

// إنشاء قائمة الفلاتر تلقائياً بناءً على المنتجات المتاحة
function renderFilters() {
  if (!$('categoryFilter')) return;
  if (typeof products === 'undefined') return;
  const list = ['All', ...new Set(products.map(p => p.category))];
  $('categoryFilter').innerHTML = list.map(x => `<option value="${x}">${x}</option>`).join('');
}

// عرض المنتجات بناءً على البحث والفلترة والترتيب
function renderProducts() {
  if (!$('productGrid')) return;
  if (typeof products === 'undefined') return;

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
          <span class="rating"><i class="fas fa-star"></i> 4.9</span>
        </div>
        <button class="add" onclick="addToCart(${i})">Buy Now</button>
      </div>
    </article>`;
  }).join('');
  reveal();
}

// إصلاح البج: الآن عند اختيار تصنيف يتم فلترة المنتجات بناءً عليه مباشرة
function selectCategory(c) {
  const f = $('categoryFilter');
  if (f) {
    f.value = c; // تعديل لجعل الفلتر يختار التصنيف المضغطوط عليه بدلاً من 'All'
  }
  renderProducts();
  scrollToId('products');
}

// إضافة منتج للسلة
function addToCart(i) {
  if (typeof products === 'undefined') return;
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
          <button onclick="removeItem(${item.id})"><i class="fas fa-trash-alt"></i> Remove</button>
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

// تطوير كود الواتساب ليسحب بيانات العميل والطلب بالكامل بشكل احترافي
function sendWhatsappOrder() {
  if (!cart.length) return alert('Your cart is empty.');

  // سحب بيانات الفورم الجديدة
  const name = ($('customerName')?.value || '').trim();
  const phone = ($('customerPhone')?.value || '').trim();
  const payment = $('paymentMethod')?.value || 'Not Specified';
  
  if (!name || !phone) {
    return alert('Please enter your Name and Phone Number to complete the order.');
  }

  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0), 0);
  const discountValue = Math.round(subtotal * coupon / 100);
  const finalTotal = subtotal - discountValue;

  // بناء الرسالة المنسقة لتصلك على الواتساب جاهزة
  let msg = `🎮 *New Order from Fox Games* 🎮%0A%0A`;
  msg += `👤 *Customer Name:* ${encodeURIComponent(name)}%0A`;
  msg += `📞 *Phone Number:* ${encodeURIComponent(phone)}%0A`;
  msg += `💳 *Payment Method:* ${encodeURIComponent(payment)}%0A%0A`;
  msg += `📦 *Products:*%0A`;
  
  cart.forEach((item, i) => {
    msg += `${i + 1}- ${encodeURIComponent(item.name)} (${item.price} EGP)%0A`;
  });

  msg += `%0A💰 *Total Amount:* ${finalTotal} EGP`;
  
  // فتح الواتساب مباشرة برقمك المحدد
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
