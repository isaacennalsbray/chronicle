import type { MetadataRoute } from "next";

// Asks crawlers to skip file downloads. Polite crawlers obey; the rest are stopped by the login
// that downloads need (see canDownload in src/lib/access.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: ["/chronicles/*/download", "/login"] },
  };
}
