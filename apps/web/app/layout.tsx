import { ClerkProvider } from "@clerk/nextjs"
import { Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "@workspace/ui/components/sonner"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppProviders } from "@/providers/app-providers"
import { cn } from "@workspace/ui/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

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
    <ClerkProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={cn("antialiased", fontMono.variable, "font-sans", geist.variable)}
      >
        <body>
          <ThemeProvider>
            <AppProviders>
              {children}
              <Toaster richColors closeButton position="top-right" />
            </AppProviders>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
