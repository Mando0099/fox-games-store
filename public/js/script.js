let products=[
{name:'PUBG Mobile UC 660',category:'PUBG',desc:'Fast PUBG Mobile UC top-up.',price:420,bg:'/assets/bg-pubg.svg',img:'/assets/item-uc.svg',popular:10},
{name:'PUBG Mobile UC 1800',category:'PUBG',desc:'High value UC recharge pack.',price:1050,bg:'/assets/bg-pubg.svg',img:'/assets/item-uc.svg',popular:9},
{name:'Fortnite V-Bucks 1000',category:'Fortnite',desc:'V-Bucks digital wallet code.',price:520,bg:'/assets/bg-fortnite.svg',img:'/assets/item-vbucks.svg',popular:10},
{name:'Fortnite Crew 1 Month',category:'Fortnite',desc:'Fortnite Crew subscription.',price:650,bg:'/assets/bg-fortnite.svg',img:'/assets/item-vbucks.svg',popular:8},
{name:'Steam Wallet 10 USD',category:'Steam',desc:'Steam wallet gift card.',price:520,bg:'/assets/bg-steam.svg',img:'/assets/item-steam.svg',popular:9},
{name:'PlayStation Store Card 10 USD',category:'PlayStation',desc:'PSN wallet digital card.',price:570,bg:'/assets/bg-psn.svg',img:'/assets/item-psn.svg',popular:8},
{name:'Xbox Game Pass 1 Month',category:'Xbox',desc:'Xbox Game Pass subscription.',price:450,bg:'/assets/bg-xbox.svg',img:'/assets/item-xbox.svg',popular:7},
{name:'Valorant Points 475 VP',category:'Valorant',desc:'Valorant points digital code.',price:250,bg:'/assets/bg-valorant.svg',img:'/assets/item-valorant.svg',popular:7}
];

let categories=[
{name:'PUBG',desc:'UC recharge',bg:'/assets/bg-pubg.svg'},
{name:'Fortnite',desc:'V-Bucks & Crew',bg:'/assets/bg-fortnite.svg'},
{name:'Steam',desc:'Wallet cards',bg:'/assets/bg-steam.svg'},
{name:'PlayStation',desc:'PSN cards',bg:'/assets/bg-psn.svg'},
{name:'Xbox',desc:'Game Pass',bg:'/assets/bg-xbox.svg'},
{name:'Valorant',desc:'Points & codes',bg:'/assets/bg-valorant.svg'}
];

let cart=JSON.parse(localStorage.getItem('foxgames_cart'))||[];
let coupon=Number(localStorage.getItem('foxgames_coupon'))||0;
const $=id=>document.getElementById(id);

window.addEventListener('load',()=>{
  renderCategories();
  renderFilters();
  renderProducts();
  updateCart();
  reveal();
});

window.addEventListener('scroll',reveal);

function imageOf(p){return p.img || p.image || '/assets/item-uc.svg'}
function bgOf(p){return p.bg || p.image || p.img || '/assets/bg-pubg.svg'}

function renderMiniSlider(){}

function renderCategories(){
  const grid=$('categoryGrid');
  if(!grid)return;
  grid.innerHTML=categories.map(cat=>`
    <div class="trendCard reveal" onclick="selectCategory('${cat.name}')" style="background-image:url('${cat.bg || cat.image || '/assets/bg-pubg.svg'}')">
      <div><h3>${cat.name}</h3><p>${cat.desc || ''}</p></div>
    </div>
  `).join('');
}

function renderFilters(){
  const filter=$('categoryFilter');
  if(!filter)return;
  const list=['All',...new Set(products.map(p=>p.category))];
  filter.innerHTML=list.map(x=>`<option value="${x}">${x}</option>`).join('');
}

function renderProducts(){
  const grid=$('productGrid');
  if(!grid)return;

  const search=($('searchInput')?.value||'').toLowerCase();
  const filter=$('categoryFilter')?.value||'All';
  const sort=$('sortFilter')?.value;

  let list=products.filter(p=>`${p.name} ${p.category} ${p.desc}`.toLowerCase().includes(search)&&(filter==='All'||p.category===filter));

  if(sort==='low')list.sort((a,b)=>a.price-b.price);
  if(sort==='high')list.sort((a,b)=>b.price-a.price);
  if(sort==='popular')list.sort((a,b)=>(b.popular||0)-(a.popular||0));

  grid.innerHTML=list.map(p=>{
    const i=products.indexOf(p);
    return `
      <article class="productCard reveal">
        <div class="productCover" style="background-image:url('${bgOf(p)}')">
          <img src="${imageOf(p)}" alt="${p.name}">
        </div>
        <div class="productInfo">
          <small>${p.category}</small>
          <h3>${p.name}</h3>
          <p>${p.desc || ''}</p>
          <div class="priceRow">
            <div class="price">${p.price} EGP</div>
            <button class="add" onclick="addToCart(${i})">Buy</button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  reveal();
}

function selectCategory(c){
  const filter=$('categoryFilter');
  if(filter)filter.value=c;
  renderProducts();
  scrollToId('products');
}

function addToCart(i){
  cart.push({...products[i],id:Date.now()+Math.random()});
  save();
  updateCart();
  $('cartDrawer')?.classList.add('open');
}

function removeItem(id){
  cart=cart.filter(x=>x.id!==id);
  save();
  updateCart();
}

function updateCart(){
  const cartCount=$('cartCount');
  const cartCountTop=$('cartCountTop');
  if(cartCount)cartCount.textContent=cart.length;
  if(cartCountTop)cartCountTop.textContent=cart.length;

  const items=$('cartItems');
  if(items){
    items.innerHTML=cart.length?cart.map(item=>`
      <div class="cartItem">
        <div class="row">
          <div><b>${item.name}</b><br><small>${item.category}</small></div>
          <b>${item.price} EGP</b>
        </div>
        <button onclick="removeItem(${item.id})">Remove</button>
      </div>
    `).join(''):`<p style="color:#b8abc8">Your cart is empty.</p>`;
  }

  const subtotal=cart.reduce((s,i)=>s+Number(i.price||0),0);
  const discountValue=Math.round(subtotal*coupon/100);
  if($('subtotal'))$('subtotal').textContent=`${subtotal} EGP`;
  if($('discount'))$('discount').textContent=`${discountValue} EGP`;
  if($('total'))$('total').textContent=`${subtotal-discountValue} EGP`;
}

function applyCoupon(){
  const code=($('couponInput')?.value||'').trim().toUpperCase();
  if(code==='FOX10'){coupon=10;save();updateCart();alert('Coupon FOX10 applied.')}
  else alert('Try coupon: FOX10');
}

async function checkout(){
  if(!cart.length)return alert('Your cart is empty.');
  const name=$('customerName')?.value||'Customer';
  const phone=$('customerPhone')?.value||'Not provided';
  const payment=$('paymentMethod')?.value;
  const subtotal=cart.reduce((s,i)=>s+Number(i.price||0),0);
  const discountValue=Math.round(subtotal*coupon/100);
  const total=subtotal-discountValue;

  try{
    const r=await fetch('/api/kashier/create-payment',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        customer:{name,phone},
        paymentMethod:payment,
        currency:'EGP',
        subtotal,
        discount:discountValue,
        total,
        items:cart.map(i=>({name:i.name,category:i.category,price:i.price}))
      })
    });
    const data=await r.json();
    if(!r.ok||!data.paymentUrl)throw new Error(data.message||'Payment link was not created.');
    window.location.href=data.paymentUrl;
  }catch(e){
    alert('Kashier error: '+e.message);
  }
}

function sendWhatsappOrder(){
  if(!cart.length)return alert('Your cart is empty.');
  const name=$('customerName')?.value||'Customer';
  const phone=$('customerPhone')?.value||'Not provided';
  const payment=$('paymentMethod')?.value;
  const subtotal=cart.reduce((s,i)=>s+Number(i.price||0),0);
  const discountValue=Math.round(subtotal*coupon/100);
  const total=subtotal-discountValue;

  let msg=`Fox Games Order:%0AName: ${encodeURIComponent(name)}%0APhone: ${encodeURIComponent(phone)}%0APayment: ${encodeURIComponent(payment)}%0A%0A`;
  cart.forEach((item,i)=>msg+=`${i+1}- ${encodeURIComponent(item.name)} - ${item.price} EGP%0A`);
  msg+=`%0ATotal: ${total} EGP`;
  window.open(`https://wa.me/201010502795?text=${msg}`,'_blank');
}

function save(){
  localStorage.setItem('foxgames_cart',JSON.stringify(cart));
  localStorage.setItem('foxgames_coupon',String(coupon));
}

function toggleCart(){$('cartDrawer')?.classList.toggle('open')}
function toggleMenu(){}
function scrollToId(id){document.getElementById(id)?.scrollIntoView({behavior:'smooth'})}
function focusSearch(){scrollToId('products');setTimeout(()=>$('searchInput')?.focus(),500)}
function openAuth(){window.location.href='/login.html'}
function closeAuth(){window.location.href='/'}
function toggleChat(){$('chat')?.classList.toggle('open')}

function reveal(){
  document.querySelectorAll('.reveal').forEach(el=>{
    if(el.getBoundingClientRect().top<innerHeight-80)el.classList.add('visible');
  });
}

function stars(){}
