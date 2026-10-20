'use client';

import { WifiOff, Loader2 } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show banner when offline
    if (!isOnline) {
      setShow(true);
    } else {
      // Keep it up for 2 seconds after reconnecting to show success state
      if (show) {
        const timer = setTimeout(() => setShow(false), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOnline, show]);

  if (!show) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 shadow-2xl ${
      isOnline ? 'bg-positive-500/10 border border-positive-500/20' : 'bg-negative-500/10 border border-negative-500/20'
    }`}>
      {isOnline ? (
        <>
          <div className="w-8 h-8 rounded-full bg-positive-500/20 flex items-center justify-center relative">
            <div className="w-2 h-2 rounded-full bg-positive-500" />
          </div>
          <div>
            <div className="text-sm font-bold text-positive-400">Connection Restored</div>
            <div className="text-xs text-positive-400 font-medium">Reconnected to market data feed</div>
          </div>
        </>
      ) : (
        <>
          <div className="w-8 h-8 rounded-full bg-negative-500/20 flex items-center justify-center">
            <WifiOff className="w-4 h-4 text-negative-400 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-bold text-negative-400 flex items-center gap-2">
              System Offline <Loader2 className="w-3 h-3 animate-spin opacity-50" />
            </div>
            <div className="text-xs text-negative-400 font-medium">Waiting for network connection...</div>
          </div>
        </>
      )}
    </div>
  );
}
