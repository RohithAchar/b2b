import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { Toaster } from "@/components/ui/toast"
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn("light", "antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}