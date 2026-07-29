import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/healthz"])

export default clerkMiddleware(
  async (auth, request) => {
    if (!isPublicRoute(request)) {
      // Always redirect to in-app /sign-in — never fall through to Account Portal.
      await auth.protect({ unauthenticatedUrl: "/sign-in" })
    }
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  }
)

export const config = {
  matcher: [
    "/((?!_next|healthz|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
