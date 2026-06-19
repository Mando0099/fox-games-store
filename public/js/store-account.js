if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

const accountDb = firebase.firestore();

function showStoreUser(data, user){
  const targets = document.querySelectorAll('.navActions');
  const name = data.name || user.displayName || 'User';
  const email = data.email || user.email || '';
  const phone = data.fullPhone || data.phone || '';

  let box = document.getElementById('userProfileMenu');
  if(!box){
    box = document.createElement('div');
    box.id = 'userProfileMenu';
    box.innerHTML = `
      <button id="profileToggle" class="profileBtn">👤 ${name.split(' ')[0]}</button>
      <div id="profileDrop" class="profileDrop">
        <b>${name}</b>
        <small>${email}</small>
        ${phone ? `<small>${phone}</small>` : ''}
        <button id="logoutBtn">Logout</button>
      </div>
    `;

    box.style.cssText = 'position:relative;display:inline-block;';
    const style = document.createElement('style');
    style.textContent = `
      .profileBtn{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:white;border-radius:16px;padding:12px 14px;font-weight:900;cursor:pointer}
      .profileDrop{display:none;position:absolute;right:0;top:54px;width:250px;background:#0f172a;border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:14px;box-shadow:0 18px 50px rgba(0,0,0,.35);z-index:5000}
      .profileDrop.open{display:block}
      .profileDrop b,.profileDrop small{display:block;color:white;margin-bottom:6px}
      .profileDrop small{color:#b8abc8}
      .profileDrop button{width:100%;border:0;border-radius:12px;padding:10px;background:#a3ff12;color:#07100b;font-weight:900;cursor:pointer;margin-top:8px}
    `;
    document.head.appendChild(style);

    const nav = targets[0];
    if(nav) nav.prepend(box);
  }

  document.getElementById('profileToggle').onclick = () => document.getElementById('profileDrop').classList.toggle('open');
  document.getElementById('logoutBtn').onclick = async () => { await firebase.auth().signOut(); location.reload(); };

  const customerName = document.getElementById('customerName');
  const customerPhone = document.getElementById('customerPhone');
  if(customerName && !customerName.value) customerName.value = name;
  if(customerPhone && !customerPhone.value) customerPhone.value = phone;
}

firebase.auth().onAuthStateChanged(async user => {
  if(!user) return;
  const doc = await accountDb.collection('users').doc(user.uid).get();
  const data = doc.exists ? doc.data() : {};
  showStoreUser(data, user);
});
