if (!firebase.apps.length) {
  firebase.initializeApp(window.firebaseConfig);
}

const msg = document.getElementById('msg');
const db = firebase.firestore();

function show(text){
  if(msg) msg.textContent = text;
}

function valueOf(id){
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function saveUser(user, extra = {}){
  if(!user) return;

  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    name: extra.name || user.displayName || '',
    email: user.email || extra.email || '',
    phone: extra.phone || user.phoneNumber || '',
    role: 'user',
    active: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function afterLogin(user){
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

    if(!email || !password){
      show('Please enter email and password.');
      return;
    }

    const r = await firebase.auth().signInWithEmailAndPassword(email, password);
    await afterLogin(r.user);
  }catch(e){
    show(e.message);
  }
}

async function createAccount(){
  try{
    const name = valueOf('fullName');
    const phone = valueOf('phone');
    const email = valueOf('email');
    const password = valueOf('password');
    const confirmPassword = valueOf('confirmPassword');

    if(!name || !phone || !email || !password){
      show('Please fill all fields.');
      return;
    }

    if(password.length < 6){
      show('Password must be at least 6 characters.');
      return;
    }

    if(password !== confirmPassword){
      show('Passwords do not match.');
      return;
    }

    const r = await firebase.auth().createUserWithEmailAndPassword(email, password);
    await r.user.updateProfile({ displayName: name });

    await saveUser(r.user, { name, phone, email });

    show('Account created successfully.');
    setTimeout(() => location.href = '/', 700);
  }catch(e){
    show(e.message);
  }
}

async function registerEmail(){
  return createAccount();
}

async function loginGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    const r = await firebase.auth().signInWithPopup(provider);
    await afterLogin(r.user);
  }catch(e){
    show(e.message);
  }
}
