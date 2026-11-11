import type { Metadata, Viewport } from "next";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "StationsView · Monitoreo de estaciones",
  description: "Tanques, alarmas, ventas y cierres de sus estaciones",
  // iOS home-screen app (Safari ignores most of the manifest).
  appleWebApp: { capable: true, title: "StationsView", statusBarStyle: "default" },
  icons: { apple: "/180x180.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
