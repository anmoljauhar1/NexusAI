"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { z } from "zod";
import { useSession } from "@/lib/session";
import { get, workspace } from "@/lib/workspace";

const selectionChange = "nexusai-workspace-selection";

export function useWorkspaceSelection() {
  const session = useSession();
  const user = session.isError ? null : session.data;
  const key = user ? `nexusai-workspace-${user.id}` : "";
  const memberships = useQuery({
    queryKey: ["private", "workspaces", user?.id],
    enabled: Boolean(user),
    queryFn: ({ signal }) => get("workspaces", z.array(workspace), signal),
    retry: false,
  });
  const subscribe = useCallback((notify: () => void) => {
    const fromStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) notify(); };
    window.addEventListener("storage", fromStorage);
    window.addEventListener(selectionChange, notify);
    return () => {
      window.removeEventListener("storage", fromStorage);
      window.removeEventListener(selectionChange, notify);
    };
  }, [key]);
  const read = useCallback(() => {
    try { return key ? localStorage.getItem(key) ?? "" : ""; } catch { return ""; }
  }, [key]);
  const selected = useSyncExternalStore(subscribe, read, () => "");
  const active = memberships.data?.find((item) => item.id === selected) ?? memberships.data?.[0];
  function choose(id: string) {
    if (!key) return;
    try {
      localStorage.setItem(key, id);
      window.dispatchEvent(new Event(selectionChange));
    } catch { /* The default workspace remains available. */ }
  }
  return { session, user, memberships, active, choose };
}
