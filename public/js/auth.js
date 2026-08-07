if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

const msg = document.getElementById('msg');
const db = firebase.firestore();

function show(text){ if(msg) msg.textContent = text; }
function valueOf(id){ const el = document.getElementById(id); return el ? el.value.trim() : ''; }

function togglePass(){
  const p = document.getElementById('password');
  if(p) p.type = p.type === 'password' ? 'text' : 'password';
}

async function saveUser(user, extra = {}){
  if(!user) return;
  const countryCode = extra.countryCode || '';
  const phoneOnly = extra.phone || '';
  const fullPhone = phoneOnly ? `${countryCode}${phoneOnly}` : '';

  try {
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      name: extra.name || user.displayName || 'Gamer',
      email: user.email || extra.email || '',
      countryCode,
      phone: phoneOnly,
      fullPhone,
      role: 'user',
      active: true,
      emailVerified: !!user.emailVerified,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
  } catch (err) {
    console.error("خطأ أثناء حفظ بيانات المستخدم:", err);
  }
}

async function goAfterLogin(user){
  // حفظ بيانات المستخدم أولاً بأمان
  await saveUser(user);

  try {
    // التحقق من صلاحيات الأدمن بحذر لعدم كسر الصفحة إذا لم تكن مجموعة admins موجودة
    const adminSnap = await db.collection('admins')
      .where('email','==',user.email || '')
      .where('active','==',true)
      .limit(1)
      .get();

    location.href = adminSnap.empty ? '/' : '/admin.html';
  } catch (err) {
    console.warn("تنبيه في التحقق من الأدمن، سيتم توجيهك للصفحة الرئيسية:", err.message);
    location.href = '/';
  }
}

async function loginEmail(){
  try{
    const email = valueOf('email');
    const password = valueOf('password');

    if(!email || !password) return show('Please enter email and password.');

    if(!email.includes('@')) return show('Phone login uses SMS OTP. Use email here or enable phone OTP form.');

    const r = await firebase.auth().signInWithEmailAndPassword(email, password);
    await goAfterLogin(r.user);
  }catch(e){ show(e.message); }
}

async function resetPassword(){
  try{
    const email = valueOf('email');
    if(!email || !email.includes('@')) return show('Enter your email first.');
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

    show('Account created. Verification email sent. You can login now.');
    setTimeout(() => location.href = '/login.html', 1200);
  }catch(e){ show(e.message); }
}

// دالة تسجيل الدخول عبر Google مع معالجة النوافذ المنبثقة وتحويلها تلقائياً عند الحظر
async function loginGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    let r;
    try {
      r = await firebase.auth().signInWithPopup(provider);
    } catch (popupError) {
      if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
        // الحل البديل في حال حظر المتصفح للنافذة المنبثقة
        await firebase.auth().signInWithRedirect(provider);
        return;
      }
      throw popupError;
    }

    if (r && r.user) {
      await goAfterLogin(r.user);
    }
  }catch(e){ show(e.message); }
}

// دالة تسجيل الدخول عبر Facebook مع معالجة النوافذ المنبثقة
async function loginFacebook(){
  try{
    const provider = new firebase.auth.FacebookAuthProvider();
    let r;
    try {
      r = await firebase.auth().signInWithPopup(provider);
    } catch (popupError) {
      if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/cancelled-popup-request') {
        await firebase.auth().signInWithRedirect(provider);
        return;
      }
      throw popupError;
    }

    if (r && r.user) {
      await goAfterLogin(r.user);
    }
  }catch(e){ show(e.message); }
}
