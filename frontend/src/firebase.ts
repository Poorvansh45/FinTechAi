// firebase.ts — Client-only Firebase initialization module
// NOTE: Do NOT add 'use client' here. This is a utility module, not a React component.
// It is imported by 'use client' components (e.g. auth-context.tsx), which is correct.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableNetwork, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCIahJRmjByCBeJ1-lFgZw6PwVcLdDOuY4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "fintech-ai-baed6.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "fintech-ai-baed6",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "fintech-ai-baed6.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1093639715479",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1093639715479:web:4c5e36ce48da1142ce87d2",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-469YTCPV6Z",
};

// Ensure Firebase is initialized only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Next.js Turbopack often disrupts Firebase WebSockets. Force long polling.
let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (e) {
  // Fallback if already initialized
  dbInstance = getFirestore(app);
}
export const db = dbInstance;

export const reconnectFirestore = async () => {
  if (typeof window !== 'undefined' && db) {
    try {
      await enableNetwork(db);
    } catch (err) {
      console.error('[Firebase] Failed to reconnect Firestore:', err);
    }
  }
};

export default app;
