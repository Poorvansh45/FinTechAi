import React from "react";

export const ScannerContext = React.createContext<{
  registerData: (rows: any[]) => void;
  registerRefresh: (fn: () => void) => void;
  registerSearch: (ref: React.RefObject<HTMLInputElement>) => void;
  scanMeta?: any;
}>({
  registerData: () => {},
  registerRefresh: () => {},
  registerSearch: () => {},
  scanMeta: null,
});
