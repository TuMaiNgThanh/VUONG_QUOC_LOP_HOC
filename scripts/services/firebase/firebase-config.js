import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYGc9AnGSaRrV6Sa3Nj274MKgFMMAw21Y",
  authDomain: "vuongquoclophoc.firebaseapp.com",
  projectId: "vuongquoclophoc",
  storageBucket: "vuongquoclophoc.firebasestorage.app",
  messagingSenderId: "445467355941",
  appId: "1:445467355941:web:840cb5c6c950ab1e43c8cc",
  measurementId: "G-GEN7MLWV2X"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
