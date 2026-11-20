/**
 * Firebase client initialisation (public web config only - no secrets here).
 * Values come from Vite env vars (frontend/.env, not committed).
 */
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error("Firebase env vars missing. Copy frontend/.env.example to frontend/.env.");
}

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

// SDK-managed persistence (IndexedDB). We never copy tokens into localStorage ourselves.
setPersistence(auth, browserLocalPersistence).catch((e) =>
  console.error("Failed to set auth persistence", e)
);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
