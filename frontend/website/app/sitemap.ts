import type { MetadataRoute } from "next";
import { getBusiness } from "@/lib/data";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const { site_url } = getBusiness();
  const routes = ["", "/menu", "/about", "/gallery", "/reservations", "/contact"];

  return routes.map((route) => ({
    url: `${site_url}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "/menu" ? "weekly" : "monthly",
    priority: route === "" ? 1 : route === "/menu" ? 0.9 : 0.6,
  }));
}
