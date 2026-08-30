import type { MetadataRoute } from "next";
import { getBusiness } from "@/lib/data";

export const dynamic = "force-static";

// Shortcuts show up on Android/Chrome when you long-press the installed
// app's home-screen icon — a quick way into the public site plus each
// admin app without going through the /admin launcher first. iOS Safari
// doesn't support shortcuts (or "Add to Home Screen" reading the manifest
// at all pre-iOS 16.4), so this is an Android/desktop-Chrome enhancement,
// not a cross-platform guarantee.
export default function manifest(): MetadataRoute.Manifest {
  const business = getBusiness();

  return {
    name: business.name,
    short_name: business.name,
    description: business.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fdf8ee",
    theme_color: "#16302e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Android caps the long-press shortcut menu at 4 entries — keep exactly
    // these, in this order.
    shortcuts: [
      { name: "Menu", url: "/menu" },
      { name: "Shiftly", url: "/shiftly" },
      { name: "Pantrly", url: "/pantrly" },
      { name: "Ledgerly", url: "/ledgerly" },
    ],
  };
}
