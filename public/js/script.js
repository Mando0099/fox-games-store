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

window.addEventListener('load', () => {
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

// عرض التصنيفات الحقيقية القادمة من البانل
function renderCategories() {
  if (!$('categoryGrid')) return;
  if (typeof categories === 'undefined' || !categories.length) return;
  
  $('categoryGrid').innerHTML = categories.map(cat => `
    <div class="trendCard reveal" onclick="selectCategory('${cat.name}')" style="background-image:url('${cat.bg || cat.image || ''}')">
      <div><h3>${cat.name}</h3><p>${cat.desc || ''}</p></div>
    </div>`).join('');
}

// إنشاء قائمة الفلاتر تلقائياً من الألعاب المرفوعة على الفايربيز
function renderFilters() {
  if (!$('categoryFilter')) return;
  if (typeof products === 'undefined' || !products.length) return;
  
  const list = ['All', ...new Set(products.map(p => p.category).filter(Boolean))];
  $('categoryFilter').innerHTML = list.map(x => `<option value="${x}">${x}</option>`).join('');
}

// عرض منتجات الفايربيز والبانل الحقيقية داخل الكروت المطورة
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
    // دعم قراءة رابط الصورة سواء كان المفتاح اسمه img أو image في البانل عندك
    const imgUrl = p.img || p.image || '';
    const bgUrl = p.bg || p.image || '';
    
    return `<article class="productCard reveal">
      <div class="productCover" style="background-image:url('${bgUrl}')"><img src="${imgUrl}" alt="${p.name}"></div>
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

async function checkout() {
  if (!cart.length) return alert('Your cart is empty.');
  alert('Checkout system is ready. Connecting with backend payment gateway...');
}

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

function toggleCart() { $('cartDrawer')?.classList.toggle('open'); }
function toggleMenu() {}
function scrollToId(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
function focusSearch() { scrollToId('products'); setTimeout(() => $('searchInput')?.focus(), 500); }

// تشغيل اللوجين والـ Auth المربوط بالفايربيز عندك
function openAuth() { window.location.href = 'login.html'; }
// الرجوع للمتجر الأساسي بشكل صحيح
function closeAuth() { window.location.href = 'index.html'; }

function toggleChat() { $('chat')?.classList.toggle('open'); }
function reveal() { document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible')); }
function stars() {}
