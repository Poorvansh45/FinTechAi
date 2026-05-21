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
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 shadow-2xl backdrop-blur-xl ${
      isOnline ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'
    }`}>
      {isOnline ? (
        <>
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-full border border-emerald-500/30 animate-ping opacity-75" />
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-500">Connection Restored</div>
            <div className="text-xs text-emerald-500/70 font-medium">Reconnected to market data feed</div>
          </div>
        </>
      ) : (
        <>
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <WifiOff className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-bold text-red-500 flex items-center gap-2">
              System Offline <Loader2 className="w-3 h-3 animate-spin opacity-50" />
            </div>
            <div className="text-xs text-red-500/70 font-medium">Waiting for network connection...</div>
          </div>
        </>
      )}
    </div>
  );
}
