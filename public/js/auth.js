if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

const msg = document.getElementById('msg');
const db = firebase.firestore();

// دالة إظهار البوب أب العائم مع أنيميشن احترافي من الأعلى
function show(text, isSuccess = false){
  const modal = document.getElementById('customModal');
  const msgEl = document.getElementById('modalMessage');
  const iconEl = document.getElementById('modalIcon');
  
  if(msgEl && modal) {
    msgEl.textContent = text;
    
    if(isSuccess) {
      iconEl.textContent = '🔥'; // أيقونة نجاح حماسية تليق بالجيمنج
    } else {
      iconEl.textContent = '⚡'; // أيقونة تنبيه شيك للخطأ
    }
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show-modal'), 10);
  } else {
    alert(text);
  }
}

// دالة إغلاق البوب أب بانيميشن ناعم
function closeModal() {
  const modal = document.getElementById('customModal');
  if(modal) {
    modal.classList.remove('show-modal');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  }
}

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

  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    name: extra.name || user.displayName || '',
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
}

// الطريقة الأصلية والمضمونة للتحويل بعد تسجيل الدخول
async function goAfterLogin(user){
  await saveUser(user);
  const adminSnap = await db.collection('admins')
    .where('email', '==', user.email || '')
    .where('active', '==', true)
    .limit(1)
    .get();

  location.href = adminSnap.empty ? '/' : '/admin.html';
}

async function loginEmail(){
  try{
    const email = valueOf('email');
    const password = valueOf('password');

    if(!email || !password) return show('الرجاء إدخال البريد الإلكتروني وكلمة المرور.');

    if(!email.includes('@')) return show('تسجيل الدخول برقم الهاتف يتطلب رمز تحقق SMS. استخدم البريد الإلكتروني هنا.');

    const r = await firebase.auth().signInWithEmailAndPassword(email, password);
    await goAfterLogin(r.user);
  }catch(e){ 
    handleAuthError(e); 
  }
}

async function resetPassword(){
  try{
    const email = valueOf('email');
    if(!email || !email.includes('@')) return show('الرجاء إدخال البريد الإلكتروني أولاً.');
    await firebase.auth().sendPasswordResetEmail(email);
    show('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.', true);
  }catch(e){ 
    handleAuthError(e); 
  }
}

async function createAccount(){
  try{
    const name = valueOf('fullName');
    const countryCode = valueOf('countryCode');
    const phone = valueOf('phone');
    const email = valueOf('email');
    const password = valueOf('password');
    const confirmPassword = valueOf('confirmPassword');

    if(!name || !email || !password) return show('الاسم، البريد الإلكتروني، وكلمة المرور حقول مطلوبة.');
    if(password.length < 6) return show('يجب ألا تقل كلمة المرور عن 6 أحرف.');
    if(password !== confirmPassword) return show('كلمتا المرور غير متطابقتين.');

    const r = await firebase.auth().createUserWithEmailAndPassword(email, password);
    await r.user.updateProfile({displayName: name});
    await saveUser(r.user, {name, email, countryCode, phone});
    await r.user.sendEmailVerification();

    show('تم إنشاء الحساب بنجاح! تم إرسال رسالة تفعيل إلى بريدك الإلكتروني.', true);
    setTimeout(() => location.href = '/login.html', 3000);
  }catch(e){ 
    handleAuthError(e); 
  }
}

// العودة للطريقة الأصلية المضمونة (Popup) لجوجل
async function loginGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    const r = await firebase.auth().signInWithPopup(provider);
    await goAfterLogin(r.user);
  }catch(e){ 
    handleAuthError(e); 
  }
}

// العودة للطريقة الأصلية المضمونة (Popup) لـ فيسبوك
async function loginFacebook(){
  try{
    const provider = new firebase.auth.FacebookAuthProvider();
    const r = await firebase.auth().signInWithPopup(provider);
    await goAfterLogin(r.user);
  }catch(e){ 
    handleAuthError(e); 
  }
}

// دالة ترجمة الأخطاء لعرضها في النافذة المنبثقة العائمة
function handleAuthError(error) {
  let message = 'حدث خطأ ما، يرجى المحاولة مرة أخرى.';

  switch (error.code) {
    case 'auth/email-already-in-use':
      message = 'هذا الحساب مستخدم من قبل، يرجى تسجيل الدخول أو استخدام بريد آخر.';
      break;
    case 'auth/invalid-email':
      message = 'صيغة البريد الإلكتروني غير صحيحة.';
      break;
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      message = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      break;
    case 'auth/weak-password':
      message = 'كلمة المرور ضعيفة جداً، يرجى اختيار كلمة مرور أقوى.';
      break;
    case 'auth/too-many-requests':
      message = 'تم حظر المحاولات مؤقتاً بسبب كثرة الطلبات، حاول لاحقاً.';
      break;
    case 'auth/operation-not-allowed':
      message = 'طريقة تسجيل الدخول هذه غير مفعلة حالياً في لوحة التحكم.';
      break;
    default:
      message = error.message;
      break;
  }

  show(message, false);
}
