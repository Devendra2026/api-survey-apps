import { ClerkProvider } from "@clerk/nextjs"
import { Toaster } from "@workspace/ui/components/sonner"
import { Geist, Geist_Mono } from "next/font/google"

import { ThemeProvider } from "@/components/theme-provider"
import { AppProviders } from "@/providers/app-providers"
import "@workspace/ui/globals.css"
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
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInForceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
      afterSignOutUrl="/sign-in"
    >
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
