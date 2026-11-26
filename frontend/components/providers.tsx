"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { sessionChanged, sessionKey, sessionRecheck, updateSession } from "@/lib/session";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: {
      staleTime: 15_000,
      retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.status >= 500),
      refetchOnWindowFocus: false,
    } },
  }));
  useEffect(() => {
    const recheck = () => { void queryClient.invalidateQueries({ queryKey: sessionKey }); };
    const sync = (event: StorageEvent) => {
      if (event.key !== sessionChanged) return;
      updateSession(queryClient, null);
      recheck();
    };
    window.addEventListener("storage", sync);
    window.addEventListener(sessionRecheck, recheck);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(sessionRecheck, recheck);
    };
  }, [queryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
