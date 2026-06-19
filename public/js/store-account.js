if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

const accountDb = firebase.firestore();

function insertAccountBox(userData, user){
  let box = document.getElementById('storeAccountBox');
  if(!box){
    box = document.createElement('div');
    box.id = 'storeAccountBox';
    box.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:1600;width:280px;max-width:calc(100vw - 40px);background:rgba(15,23,42,.88);color:white;border:1px solid rgba(255,255,255,.14);border-radius:20px;padding:14px;backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(0,0,0,.35);font-family:Inter,Arial,sans-serif;';
    document.body.appendChild(box);
  }

  const name = userData.name || user.displayName || 'User';
  const email = userData.email || user.email || '';
  const phone = userData.fullPhone || userData.phone || '';

  box.innerHTML = `
    <b style="display:block;font-size:15px;margin-bottom:6px;">👤 ${name}</b>
    <small style="display:block;color:#b8abc8;line-height:1.6">${email}</small>
    ${phone ? `<small style="display:block;color:#b8abc8;line-height:1.6">${phone}</small>` : ''}
    <button id="logoutBtn" style="margin-top:10px;width:100%;border:0;border-radius:12px;padding:10px;font-weight:900;cursor:pointer;background:#a3ff12;color:#07100b;">Logout</button>
  `;

  document.getElementById('logoutBtn').onclick = async () => {
    await firebase.auth().signOut();
    location.reload();
  };

  const customerName = document.getElementById('customerName');
  const customerPhone = document.getElementById('customerPhone');
  if(customerName && !customerName.value) customerName.value = name;
  if(customerPhone && !customerPhone.value) customerPhone.value = phone;
}

firebase.auth().onAuthStateChanged(async user => {
  if(!user) return;
  const doc = await accountDb.collection('users').doc(user.uid).get();
  const data = doc.exists ? doc.data() : {};
  insertAccountBox(data, user);
});
