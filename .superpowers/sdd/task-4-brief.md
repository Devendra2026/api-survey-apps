### Task 4: Clerk middleware hardening

**Files:**

- Modify: `apps/web/proxy.ts`
- Test: manual sign-in + `/healthz` (or add a small unit test if the repo already tests middleware)

**Interfaces:**

- Produces: Public routes for sign-in/sign-up/healthz; all other matched routes protected

- [ ] **Step 1: Replace bare middleware**

Replace `apps/web/proxy.ts` contents with:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/healthz"])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    "/((?!_next|healthz|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
}
```

Note: If this Next app uses `proxy.ts` instead of `middleware.ts`, keep the filename the project already uses; only change the export body.

- [ ] **Step 2: Verify build**

```bash
pnpm --filter web build
```

Expected: exit 0; no Clerk deprecation errors in build log.

- [ ] **Step 3: Commit**

```bash
git add apps/web/proxy.ts
git commit -m "fix(web): protect non-public routes in Clerk middleware"
```

---
