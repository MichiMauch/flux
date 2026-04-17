import type { ReactNode } from "react";
import { spaceMono } from "./bento-fonts";

interface BentoPageShellProps {
  children: ReactNode;
}

export function BentoPageShell({ children }: BentoPageShellProps) {
  return (
    <div
      className="dark min-h-screen bg-black text-white relative"
      style={{
        fontFeatureSettings: '"ss01", "cv11"',
        ["--bento-mono" as string]: spaceMono.style.fontFamily,
        backgroundImage:
          "linear-gradient(rgba(255,106,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,106,0,0.035) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-4">
        {children}
      </main>
    </div>
  );
}
