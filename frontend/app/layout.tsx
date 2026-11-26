import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/geist/latin-400";
import "@fontsource/geist/latin-500";
import "@fontsource/geist/latin-600";
import "@fontsource/geist/latin-700";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "NexusAI · Research & Decision Intelligence", template: "%s · NexusAI" },
  description: "Explore the NexusAI research, analytics, and evidence workspace.",
};

const setInitialTheme = 'try{document.documentElement.dataset.theme=localStorage.getItem("nexusai-theme")==="light"?"light":"dark"}catch{}';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: setInitialTheme }} /></head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
