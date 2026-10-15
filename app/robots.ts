import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/supplier/", "/admin/", "/account/", "/cart/", "/auth/"],
      },
    ],
  };
}
