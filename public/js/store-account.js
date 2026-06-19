// ================= FOX GAMES ACCOUNT COMPATIBILITY =================
if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);

const accountDb = firebase.firestore();

function showStoreUser(data, user){
  // جلب عناصر البروفايل الجديد المعتمد في الـ index.html
  const mainLoginBtn = document.getElementById('mainLoginBtn');
  const userProfileWrapper = document.getElementById('userProfileWrapper');
  const topNavUserName = document.getElementById('topNavUserName');
  const dropdownUserName = document.getElementById('dropdownUserName');
  const dropdownUserEmail = document.getElementById('dropdownUserEmail');
  const profileUserAvatar = document.getElementById('profileUserAvatar');

  // استخراج البيانات القادمة من الفايربيز
  const name = data.name || user.displayName || 'Gamer';
  const email = data.email || user.email || 'No Email';
  const phone = data.fullPhone || data.phone || '';
  const photoURL = user.photoURL || "https://via.placeholder.com/150";

  // إخفاء زر تسجيل الدخول وإظهار كارت البروفايل الجديد فوراً
  if (mainLoginBtn) mainLoginBtn.classList.add('foxHidden');
  if (userProfileWrapper) userProfileWrapper.classList.remove('foxHidden');

  // ربط الداتا الحقيقية بالتصميم الجديد
  if (topNavUserName) topNavUserName.innerText = name.split(' ')[0]; 
  if (dropdownUserName) dropdownUserName.innerText = name;
  if (dropdownUserEmail) dropdownUserEmail.innerText = email;
  if (profileUserAvatar) profileUserAvatar.src = photoURL;

  // ملء بيانات العميل تلقائياً في خانات الشراء والسلة إذا كانت فارغة
  const customerName = document.getElementById('customerName');
  const customerPhone = document.getElementById('customerPhone');
  if(customerName && !customerName.value) customerName.value = name;
  if(customerPhone && !customerPhone.value) customerPhone.value = phone;
}

// الاستماع المستمر لحالة تسجيل الدخول وجلب البيانات من الفايربيز ستور
firebase.auth().onAuthStateChanged(async user => {
  const mainLoginBtn = document.getElementById('mainLoginBtn');
  const userProfileWrapper = document.getElementById('userProfileWrapper');

  if(!user) {
    // في حال عدم وجود مستخدم، نضمن بقاء زر اللوجن ظاهراً والبروفايل الجديد مخفياً
    if (mainLoginBtn) mainLoginBtn.classList.remove('foxHidden');
    if (userProfileWrapper) userProfileWrapper.classList.add('foxHidden');
    return;
  }

  // جلب بيانات الحساب الإضافية (مثل رقم الهاتف الموثق) من الفايربيز
  const doc = await accountDb.collection('users').doc(user.uid).get();
  const data = doc.exists ? doc.data() : {};
  
  // تشغيل الدالة لتغذية التصميم الجديد بالبيانات الصحيحة
  showStoreUser(data, user);
});
