if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

const msg = document.getElementById('msg');
const db = firebase.firestore();

// دالة العرض (الجديدة)
function show(text, isSuccess = false){
  const modal = document.getElementById('customModal');
  const msgEl = document.getElementById('modalMessage');
  const iconEl = document.getElementById('modalIcon');
  if(msgEl && modal) {
    msgEl.textContent = text;
    iconEl.textContent = isSuccess ? '🔥' : '⚡';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show-modal'), 10);
  } else {
    alert(text);
  }
}

function closeModal() {
  const modal = document.getElementById('customModal');
  if(modal) {
    modal.classList.remove('show-modal');
    setTimeout(() => modal.style.display = 'none', 300);
  }
}

function valueOf(id){ const el = document.getElementById(id); return el ? el.value.trim() : ''; }

// 1. الدالة الأساسية اللي كانت شغالة معاك (بدون تعقيدات)
async function goAfterLogin(user){
  // حفظ بيانات المستخدم
  await saveUser(user);
  
  // التحقق من الأدمن (بشكل بسيط ومباشر)
  try {
    const adminSnap = await db.collection('admins')
      .where('email', '==', user.email)
      .where('active', '==', true)
      .limit(1)
      .get();
      
    if (!adminSnap.empty) {
      location.href = '/admin.html';
    } else {
      location.href = '/';
    }
  } catch (err) {
    // لو حصل خطأ في الاتصال بقاعدة البيانات، يدخل المستخدم للمتجر فوراً
    location.href = '/';
  }
}

// 2. دالة تسجيل الدخول (الأصلية)
async function loginEmail(){
  const email = valueOf('email');
  const password = valueOf('password');
  if(!email || !password) return show('الرجاء إدخال البريد الإلكتروني وكلمة المرور.');
  
  try {
    const r = await firebase.auth().signInWithEmailAndPassword(email, password);
    await goAfterLogin(r.user);
  } catch(e) {
    show(e.message); // عرض رسالة الخطأ الأصلية عشان نتأكد إنها شغالة
  }
}

// 3. باقي الدوال (createAccount, loginGoogle, إلخ...) زي ما هي
async function createAccount(){
  try{
    const name = valueOf('fullName');
    const email = valueOf('email');
    const password = valueOf('password');
    const r = await firebase.auth().createUserWithEmailAndPassword(email, password);
    await r.user.updateProfile({displayName: name});
    await saveUser(r.user, {name, email});
    await r.user.sendEmailVerification();
    show('تم إنشاء الحساب بنجاح! تم إرسال رسالة تفعيل.', true);
    setTimeout(() => location.href = '/login.html', 3000);
  }catch(e){ show(e.message); }
}

async function loginGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    const r = await firebase.auth().signInWithPopup(provider);
    await goAfterLogin(r.user);
  }catch(e){ show(e.message); }
}

async function saveUser(user, extra = {}){
  if(!user) return;
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    name: extra.name || user.displayName || '',
    email: user.email || extra.email || '',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
}
