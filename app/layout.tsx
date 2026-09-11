import { Geist_Mono, Figtree } from "next/font/google"

import "./globals.css"
import { Toaster } from "@/components/ui/toast"
import { cn } from "@/lib/utils";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'})

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
      className={cn("light", "antialiased", fontMono.variable, "font-sans", figtree.variable)}
    >
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
