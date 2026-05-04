import type { Metadata, Viewport } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "./components/theme-provider";
import { UnlockCelebration } from "./components/unlock-celebration";
import { AppShell } from "./components/app-shell/app-shell";
import { SwRegister } from "./components/pwa/sw-register";
import { InstallPrompt } from "./components/pwa/install-prompt";
import { WeeklyBriefingModalHost } from "./components/coach/weekly-briefing-modal-host";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Flux",
  description: "Deine private Fitness-App",
  applicationName: "Flux",
  appleWebApp: {
    capable: true,
    title: "Flux",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png?v=4", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=4", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png?v=4", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1C1917",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`dark ${manrope.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" style={{ fontFeatureSettings: '"ss01", "cv11"' }}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
          <UnlockCelebration />
          <InstallPrompt />
          <SwRegister />
          <WeeklyBriefingModalHost />
          <Toaster
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
