import type { MetadataRoute } from "next";
import { getBusiness } from "@/lib/data";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  const { site_url } = getBusiness();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${site_url}/sitemap.xml`,
  };
}
