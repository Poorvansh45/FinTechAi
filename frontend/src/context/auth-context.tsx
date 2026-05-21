'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/firebase';

// ── Types ─────────────────────────────────────────────────────
interface AuthContextValue {
  user: User | null;
  username: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  saveUsername: (name: string) => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
          let retries = 3;
          let success = false;
          while (retries > 0 && !success) {
            try {
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists() && userDoc.data().username) {
                setUsername(userDoc.data().username);
              } else {
                setUsername(null);
              }
              success = true;
            } catch (error: any) {
              if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
                retries--;
                if (retries === 0) {
                  console.error('Error fetching user profile (offline):', error);
                  setUsername(null);
                  success = true;
                } else {
                  // Wait 1.5s before retrying
                  await new Promise(r => setTimeout(r, 1500));
                }
              } else {
                console.error('Error fetching user profile:', error);
                setUsername(null);
                success = true;
              }
            }
          }
      } else {
        setUsername(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setUsername(null);
  }, []);

  const saveUsername = useCallback(async (name: string) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    await setDoc(doc(db, 'users', auth.currentUser.uid), { username: name }, { merge: true });
    setUsername(name);
  }, []);

  return (
    <AuthContext.Provider value={{ user, username, loading, signInWithGoogle, logout, saveUsername }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
