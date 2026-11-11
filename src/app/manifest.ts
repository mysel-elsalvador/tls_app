import type { MetadataRoute } from "next";

// Static export: generated once at build time.
export const dynamic = "force-static";

/** Web app manifest: lets phones install the site as an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "StationsView · Monitoreo integral de estaciones",
    short_name: "StationsView",
    description: "Tanques, ventas y alarmas de sus estaciones",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f9f9f7",
    theme_color: "#2a78d6",
    icons: [
      {
        src: "/192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
