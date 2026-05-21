'use client';

import { useState, useEffect } from 'react';
import { reconnectFirestore } from '@/firebase';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    const handleOnline = async () => {
      setIsOnline(true);
      console.log('[Network] Connection restored. Reconnecting Firestore...');
      await reconnectFirestore();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.warn('[Network] Connection lost.');
    };

    setIsOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
