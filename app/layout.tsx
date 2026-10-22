import { Geist_Mono, Inter } from "next/font/google"
import type { Metadata, Viewport } from "next"
import { MotionConfig } from "motion/react"

import "./globals.css"
import { Toaster } from "@/components/ui/toast"
import { PhoneGate } from "@/components/auth/phone-gate-lazy"
import { cn } from "@/lib/utils"
import { SITE_NAME, SITE_URL } from "@/lib/site"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Wholesale Sourcing from Verified Indian Suppliers`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "Source wholesale products directly from verified Indian manufacturers and suppliers. Live pricing, MOQs and negotiated deals across categories.",
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FF6A00",
}

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  // Only used on order/payment and dashboard screens; don't preload it on
  // the storefront's first paint.
  preload: false,
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "light",
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        {/* Motion honours prefers-reduced-motion app-wide (apple-design §14). */}
        <MotionConfig reducedMotion="user">
          {children}
          <PhoneGate />
          <Toaster />
        </MotionConfig>
      </body>
    </html>
  )
}
