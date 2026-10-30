import type { Metadata, Viewport } from "next";
import "./globals.css";
import Footer from "./components/Footer";
import { pageTitle, APP_DESCRIPTION, COLORS } from "@/lib/constants";

export const metadata: Metadata = {
  title: pageTitle(),
  description: APP_DESCRIPTION,
  // PWA — see public/manifest.json, public/sw.js and lib/push.ts (same
  // setup as TASKS).
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, title: "Campagnes", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: COLORS.primary,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
