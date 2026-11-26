"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const key = "nexusai-theme";
const eventName = "nexusai-theme-change";

function readTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(notify: () => void) {
  const syncStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      document.documentElement.dataset.theme = event.newValue === "light" ? "light" : "dark";
      notify();
    }
  };
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", syncStorage);
  return () => {
    window.removeEventListener(eventName, notify);
    window.removeEventListener("storage", syncStorage);
  };
}

function setTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(key, theme); } catch { /* Theme remains available for this visit. */ }
  window.dispatchEvent(new Event(eventName));
}

export function ThemeControl({ expanded = false }: { expanded?: boolean }) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark");
  if (expanded) {
    return <div className="theme-options" aria-label="Color theme">
      <button className="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Moon size={17} /> Dark</button>
      <button className="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sun size={17} /> Light</button>
    </div>;
  }
  const target = theme === "dark" ? "light" : "dark";
  return <button className="icon-button" type="button" aria-label={`Switch to ${target} theme`} title={`Switch to ${target} theme`} onClick={() => setTheme(target)}>
    {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
  </button>;
}
