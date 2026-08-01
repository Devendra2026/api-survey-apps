import { clerkMiddleware } from "@clerk/nextjs/server"

/**
 * Next.js 16 uses `proxy.ts` (formerly middleware).
 * Auth checks live on resources (e.g. `(dashboard)/layout.tsx` via `auth.protect()`).
 * Keep `clerkMiddleware()` so Clerk session context is available to those calls.
 */
export default clerkMiddleware({
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files (unless in search params)
    "/((?!_next|healthz|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
