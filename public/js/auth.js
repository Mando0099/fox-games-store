const msg = document.getElementById('msg');
const db = firebase.apps.length ? firebase.firestore() : null;
function show(x){ msg.textContent = x; }
async function saveUser(user){
  if(!db || !user) return;
  await db.collection('users').doc(user.uid).set({
    uid:user.uid, name:user.displayName || '', email:user.email || '', phone:user.phoneNumber || '', role:'user', active:true, createdAt:firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
}
async function afterLogin(user){
  await saveUser(user);
  const admin = await db.collection('admins').where('email','==',user.email || '').where('active','==',true).limit(1).get();
  location.href = admin.empty ? '/' : '/admin.html';
}
async function loginEmail(){
  try{ const r = await firebase.auth().signInWithEmailAndPassword(email.value, password.value); await afterLogin(r.user); }catch(e){ show(e.message); }
}
async function registerEmail(){
  try{ const r = await firebase.auth().createUserWithEmailAndPassword(email.value, password.value); await afterLogin(r.user); }catch(e){ show(e.message); }
}
async function loginGoogle(){
  try{ const p = new firebase.auth.GoogleAuthProvider(); const r = await firebase.auth().signInWithPopup(p); await afterLogin(r.user); }catch(e){ show(e.message); }
}
