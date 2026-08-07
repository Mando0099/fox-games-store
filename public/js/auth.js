if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

const msg = document.getElementById('msg');
const db = firebase.firestore();

// دالة إظهار النافذة المنبثقة الاحترافية
function show(text, isSuccess = false){
  const modal = document.getElementById('customModal');
  const msgEl = document.getElementById('modalMessage');
  const iconEl = document.getElementById('modalIcon');
  
  if(msgEl && modal) {
    msgEl.textContent = text;
    if(isSuccess) {
      iconEl.textContent = '✅';
      modal.querySelector('div > div').style.borderColor = '#00f3ff';
    } else {
      iconEl.textContent = '⚠️';
      modal.querySelector('div > div').style.borderColor = '#f59e0b';
    }
    modal.style.display = 'flex';
  } else {
    alert(text);
  }
}

// دالة إغلاق النافذة المنبثقة
function closeModal() {
  const modal = document.getElementById('customModal');
  if(modal) {
    modal.style.display = 'none';
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

  try {
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
  } catch(err) {
    console.error("Error saving user to Firestore:", err);
  }
}

// تعديل دالة التحويل بعد تسجيل الدخول لتصبح آمنة 100% ولا تعلق أبداً
async function goAfterLogin(user){
  if(!user) return;
  
  // حفظ بيانات المستخدم أولاً
  await saveUser(user);

  try {
    // محاولة التحقق إذا كان أدمن
    const adminSnap = await db.collection('admins')
      .where('email', '==', user.email || '')
      .where('active', '==', true)
      .limit(1)
      .get();

    if (!adminSnap.empty) {
      location.href = '/admin.html';
      return;
    }
  } catch (e) {
    console.log("Not an admin or error checking admin, redirecting to home.", e);
  }

  // التوجيه الافتراضي لصفحة المتجر الرئيسية لو مش أدمن
  location.href = '/';
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
    await r.user.updateProfile({displayName:name});
    await saveUser(r.user, {name, email, countryCode, phone});
    await r.user.sendEmailVerification();

    show('تم إنشاء الحساب بنجاح! تم إرسال رسالة تفعيل إلى بريدك الإلكتروني.', true);
    setTimeout(() => location.href = '/login.html', 3500);
  }catch(e){ 
    handleAuthError(e); 
  }
}

async function loginGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithRedirect(provider);
  }catch(e){ handleAuthError(e); }
}

async function loginFacebook(){
  try{
    const provider = new firebase.auth.FacebookAuthProvider();
    await firebase.auth().signInWithRedirect(provider);
  }catch(e){ handleAuthError(e); }
}

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

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const result = await firebase.auth().getRedirectResult();
    if (result && result.user) {
      await goAfterLogin(result.user);
    }
  } catch (e) {
    handleAuthError(e);
  }
});
