let cart=JSON.parse(localStorage.getItem('foxgames_cart'))||[];
let coupon=Number(localStorage.getItem('foxgames_coupon'))||0;
const $=id=>document.getElementById(id);

window.addEventListener('load',()=>{renderCategories();renderFilters();renderProducts();updateCart();reveal();});
window.addEventListener('scroll',reveal);

function renderMiniSlider(){}
function renderCategories(){
  if(!$('categoryGrid'))return;
  $('categoryGrid').innerHTML=categories.map(cat=>`
    <div class="trendCard reveal" onclick="selectCategory('${cat.name}')" style="background-image:url('${cat.bg}')">
      <div><h3>${cat.name}</h3><p>${cat.desc}</p></div>
    </div>`).join('');
}
function renderFilters(){
  if(!$('categoryFilter'))return;
  const list=['All',...new Set(products.map(p=>p.category))];
  $('categoryFilter').innerHTML=list.map(x=>`<option value="${x}">${x}</option>`).join('');
}
function renderProducts(){
  if(!$('productGrid'))return;
  const search=($('searchInput')?.value||'').toLowerCase();
  const filter=$('categoryFilter')?.value||'All';
  const sort=$('sortFilter')?.value;
  let list=products.filter(p=>`${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(search)&&(filter==='All'||p.category===filter));
  if(sort==='low')list.sort((a,b)=>a.price-b.price);
  if(sort==='high')list.sort((a,b)=>b.price-a.price);
  if(sort==='popular')list.sort((a,b)=>b.popular-a.popular);
  $('productGrid').innerHTML=list.map(p=>{
    const i=products.indexOf(p);
    return `<article class="productCard reveal">
      <div class="productCover" style="background-image:url('${p.bg}')"><img src="${p.img}" alt="${p.name}"></div>
      <div class="productInfo"><h3>${p.name}</h3><p>${p.desc}</p>
      <div class="priceRow"><div class="price">${p.price}.00 EGP</div><span class="rating">★ 4.9</span></div>
      <button class="add" onclick="addToCart(${i})">Buy Now</button></div>
    </article>`;
  }).join('');
  reveal();
}
function selectCategory(c){const f=$('categoryFilter');if(f)f.value='All';renderProducts();scrollToId('products')}
function addToCart(i){cart.push({...products[i],id:Date.now()+Math.random()});save();updateCart();$('cartDrawer')?.classList.add('open')}
function removeItem(id){cart=cart.filter(x=>x.id!==id);save();updateCart()}
function updateCart(){
  if($('cartCount'))$('cartCount').textContent=cart.length;
  if($('cartCountTop'))$('cartCountTop').textContent=cart.length;
  if($('cartItems'))$('cartItems').innerHTML=cart.length?cart.map(item=>`<div class="cartItem"><div class="row"><div><b>${item.name}</b><br><small>${item.category}</small></div><b>${item.price} EGP</b></div><button onclick="removeItem(${item.id})">Remove</button></div>`).join(''):`<p style="color:#b8abc8">Your cart is empty.</p>`;
  const subtotal=cart.reduce((s,i)=>s+Number(i.price||0),0),discountValue=Math.round(subtotal*coupon/100);
  if($('subtotal'))$('subtotal').textContent=`${subtotal} EGP`;
  if($('discount'))$('discount').textContent=`${discountValue} EGP`;
  if($('total'))$('total').textContent=`${subtotal-discountValue} EGP`;
}
function applyCoupon(){const code=($('couponInput')?.value||'').trim().toUpperCase();if(code==='FOX10'){coupon=10;save();updateCart();alert('Coupon FOX10 applied.')}else alert('Try coupon: FOX10')}
async function checkout(){if(!cart.length)return alert('Your cart is empty.');alert('Checkout is ready. Connect Kashier backend when needed.')}
function sendWhatsappOrder(){if(!cart.length)return alert('Your cart is empty.');let msg='Fox Games Order:%0A';cart.forEach((item,i)=>msg+=`${i+1}- ${encodeURIComponent(item.name)} - ${item.price} EGP%0A`);window.open(`https://wa.me/201010502795?text=${msg}`,'_blank')}
function save(){localStorage.setItem('foxgames_cart',JSON.stringify(cart));localStorage.setItem('foxgames_coupon',String(coupon))}
function toggleCart(){$('cartDrawer')?.classList.toggle('open')}
function toggleMenu(){}
function scrollToId(id){document.getElementById(id)?.scrollIntoView({behavior:'smooth'})}
function focusSearch(){scrollToId('products');setTimeout(()=>$('searchInput')?.focus(),500)}
function openAuth(){window.location.href='/login.html'}
function closeAuth(){window.location.href='/'}
function toggleChat(){$('chat')?.classList.toggle('open')}
function reveal(){document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'))}
function stars(){}
