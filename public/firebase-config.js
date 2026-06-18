// Firebase Config for Fox Games
// Replace these values with your Firebase Web App config from Firebase Console.
window.firebaseConfig = {
  apiKey: "PASTE_FIREBASE_API_KEY",
  authDomain: "fox-games-store.firebaseapp.com",
  projectId: "fox-games-store",
  storageBucket: "fox-games-store.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};

// Put your admin email here exactly as it exists in Firestore admins collection.
window.FOX_ADMIN_EMAIL = "namy9585@gmail.com";

try {
  if (!firebase.apps.length && !window.firebaseConfig.apiKey.includes('PASTE_')) {
    firebase.initializeApp(window.firebaseConfig);
  }
} catch (e) {
  console.warn('Firebase not initialized:', e.message);
}
