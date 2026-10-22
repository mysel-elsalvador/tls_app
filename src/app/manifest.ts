import type { MetadataRoute } from "next";

// Static export: generated once at build time.
export const dynamic = "force-static";

/** Web app manifest: lets phones install the site as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "hub · Monitoreo de tanques",
    short_name: "hub",
    description: "Inventario y alarmas de las consolas Veeder-Root de sus estaciones",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f9f9f7",
    theme_color: "#2a78d6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
