"use client";

import { useQuery, type QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { account, get, type Account } from "@/lib/workspace";
export { sessionRecheck } from "@/lib/workspace";

export const sessionKey = ["account", "session"] as const;
export const sessionChanged = "nexusai-session-changed";

export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async ({ signal }) => {
      try {
        return await get("auth/session", account, signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function updateSession(cache: QueryClient, value: Account | null) {
  void cache.cancelQueries({ queryKey: sessionKey });
  cache.removeQueries({
    predicate: ({ queryKey: [key] }) => key === "private" ||
      (typeof key === "string" && key.startsWith("workspaces/")),
  });
  cache.setQueryData(sessionKey, value);
}

export function announceSession(cache: QueryClient, value: Account | null) {
  updateSession(cache, value);
  try { localStorage.setItem(sessionChanged, crypto.randomUUID()); } catch { /* Other tabs recheck on focus. */ }
}
