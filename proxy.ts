import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/cart/:path*",
    "/checkout/:path*",
    "/orders/:path*",
    "/supplier/:path*",
    "/admin/:path*",
    "/auth/:path*",
  ],
};
