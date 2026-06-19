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

async function goAfterLogin(user){
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
    await goAfterLogin(r.user);
  }catch(e){ show(e.message); }
}

async function resetPassword(){
  try{
    const email = valueOf('email');
    if(!email) return show('Enter your email first.');
    await firebase.auth().sendPasswordResetEmail(email);
    show('Password reset email sent.');
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

    sessionStorage.setItem('pendingVerifyEmail', email);
    location.href = '/verify-email.html';
  }catch(e){ show(e.message); }
}

async function checkEmailVerified(){
  try{
    const user = firebase.auth().currentUser;
    if(!user) return location.href = '/login.html';
    await user.reload();
    const fresh = firebase.auth().currentUser;
    if(!fresh.emailVerified) return show('Email is not verified yet.');
    await goAfterLogin(fresh);
  }catch(e){ show(e.message); }
}

async function resendVerification(){
  try{
    const user = firebase.auth().currentUser;
    if(!user) return location.href = '/login.html';
    await user.sendEmailVerification();
    show('Verification email sent again.');
  }catch(e){ show(e.message); }
}

async function registerEmail(){ return createAccount(); }

async function loginGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    const r = await firebase.auth().signInWithPopup(provider);
    await goAfterLogin(r.user);
  }catch(e){ show(e.message); }
}

async function loginFacebook(){
  try{
    const provider = new firebase.auth.FacebookAuthProvider();
    const r = await firebase.auth().signInWithPopup(provider);
    await goAfterLogin(r.user);
  }catch(e){ show(e.message); }
}

function setupRecaptcha(){
  if(window.recaptchaVerifier) return;
  window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
    size:'invisible'
  });
}

async function sendPhoneCode(){
  try{
    setupRecaptcha();
    const countryCode = valueOf('countryCode') || '+20';
    const phone = valueOf('phone');
    if(!phone) return show('Enter phone number.');
    const fullPhone = `${countryCode}${phone}`;
    window.confirmationResult = await firebase.auth().signInWithPhoneNumber(fullPhone, window.recaptchaVerifier);
    document.getElementById('phoneCodeBox')?.classList.remove('hidden');
    show('SMS code sent.');
  }catch(e){ show(e.message); }
}

async function confirmPhoneCode(){
  try{
    const code = valueOf('phoneCode');
    if(!code) return show('Enter SMS code.');
    const r = await window.confirmationResult.confirm(code);
    await saveUser(r.user, {phone:valueOf('phone'), countryCode:valueOf('countryCode') || '+20'});
    location.href = '/';
  }catch(e){ show(e.message); }
}
