import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "hub · Monitoreo de tanques",
  description: "Inventario y alarmas de las consolas Veeder-Root de sus estaciones",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
