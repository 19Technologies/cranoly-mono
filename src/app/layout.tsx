import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Instrument_Sans } from "next/font/google";
import AppShell from "@/components/AppShell";
import ServiceWorker from "@/components/ServiceWorker";
import "./globals.css";

// Cranoly Mono type: Fraunces (soft, variable serif) for display, Instrument Sans for text.
const display = Fraunces({ subsets: ["latin", "latin-ext"], variable: "--font-display", axes: ["opsz", "SOFT", "WONK"] });
const ui = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-ui" });
const mono = Geist_Mono({ subsets: ["latin", "latin-ext"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Cranoly Mono",
  applicationName: "Cranoly Mono",
  description: "A language notebook: linked notes, with flashcards written right inside them.",
  appleWebApp: { capable: true, title: "Cranoly Mono", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Applies the saved theme before first paint so the page never flashes the wrong one.
// Inside the Android app every page address serves the start page's HTML, so if Android ever
// reloads the app on another page, go back to the start (before React loads) instead of
// rendering the wrong page. The website serves every page's own HTML and is unaffected.
const APP_START_SCRIPT = `try{var C=window.Capacitor;if(C&&C.isNativePlatform&&C.isNativePlatform()&&location.pathname!=="/")location.replace("/")}catch(e){}`;
// Graphite (dark) is the default. A Paper install switches to it once (loadState in vault.ts saves that).
const THEME_SCRIPT = `try{var s=JSON.parse(localStorage.getItem("cranoly-vault")||localStorage.getItem("green-graphite-vault")||"{}").settings||{};var t=s.theme||"graphite";if(t==="paper"&&!localStorage.getItem("cranoly-dark-default"))t="graphite";if(t==="system")t=matchMedia("(prefers-color-scheme: dark)").matches?"graphite":"paper";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="graphite"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`} data-theme="graphite" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APP_START_SCRIPT + THEME_SCRIPT }} />
      </head>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
