// Firebase Config for Fox Games
// Replace these values with your Firebase Web App config from Firebase Console.
window. firebaseConfig = {
  apiKey: "AIzaSyAslaKipcL_4qDS8_i1UYsWEgxzPfHRDQc",
  authDomain: "fox-games-store.firebaseapp.com",
  projectId: "fox-games-store",
  storageBucket: "fox-games-store.firebasestorage.app",
  messagingSenderId: "498526472891",
  appId: "1:498526472891:web:12abbb2f29293ecfe9379e",
  measurementId: "G-JXZ1DMDD5F"
};

// Put your admin email here exactly as it exists in Firestore admins collection.
window.FOX_ADMIN_EMAIL = "namy9585@gmail.com";

try {
    if (!firebase.apps.length) {
        firebase.initializeApp(window.firebaseConfig);
    }
} catch (e) {
    console.warn('Firebase not initialized:', e.message);
}
