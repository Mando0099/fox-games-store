if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

const msg = document.getElementById('msg');
const db = firebase.firestore();

function show(text){ if(msg) msg.textContent = text; }
function valueOf(id){ const el = document.getElementById(id); return el ? el.value.trim() : ''; }

async function saveUser(user, extra = {}){
  if(!user) return;
  const countryCode = extra.countryCode || '';
  const phoneOnly = extra.phone || '';
  const fullPhone = phoneOnly ? `${countryCode}${phoneOnly}` : '';

  await db.collection('users').doc(user.uid).set({
    uid:user.uid,
    name:extra.name || user.displayName || '',
    email:user.email || extra.email || '',
    countryCode,
    phone:phoneOnly,
    fullPhone,
    role:'user',
    active:true,
    emailVerified:!!user.emailVerified,
    updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
}

async function afterLogin(user){
  await user.reload();
  user = firebase.auth().currentUser;

  if(!user.emailVerified){
    await user.sendEmailVerification();
    await firebase.auth().signOut();
    show('Please verify your email first. We sent a new verification email.');
    return;
  }

  await saveUser(user);

  const adminSnap = await db.collection('admins')
    .where('email','==',user.email || '')
    .where('active','==',true)
    .limit(1)
    .get();

  location.href = adminSnap.empty ? '/' : '/admin.html';
}

async function loginEmail(){
  try{
    const email = valueOf('email');
    const password = valueOf('password');
    if(!email || !password) return show('Please enter email and password.');
    const r = await firebase.auth().signInWithEmailAndPassword(email, password);
    await afterLogin(r.user);
  }catch(e){ show(e.message); }
}

async function createAccount(){
  try{
    const name = valueOf('fullName');
    const countryCode = valueOf('countryCode');
    const phone = valueOf('phone');
    const email = valueOf('email');
    const password = valueOf('password');
    const confirmPassword = valueOf('confirmPassword');

    if(!name || !email || !password) return show('Name, email and password are required.');
    if(password.length < 6) return show('Password must be at least 6 characters.');
    if(password !== confirmPassword) return show('Passwords do not match.');

    const r = await firebase.auth().createUserWithEmailAndPassword(email, password);
    await r.user.updateProfile({displayName:name});
    await saveUser(r.user, {name,email,countryCode,phone});
    await r.user.sendEmailVerification();
    await firebase.auth().signOut();

    show('Account created. Check your email and verify it before logging in.');
  }catch(e){ show(e.message); }
}

async function registerEmail(){ return createAccount(); }

async function loginGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    const r = await firebase.auth().signInWithPopup(provider);
    await saveUser(r.user);
    await afterLogin(r.user);
  }catch(e){ show(e.message); }
}
