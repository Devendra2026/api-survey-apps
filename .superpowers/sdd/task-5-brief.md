### Task 5: Dashboard HTTP 403 authorization

**Files:**

- Modify: `apps/web/app/(dashboard)/layout.tsx`
- Modify: `apps/web/components/layout/protected-layout.tsx`
- Create (if helpful): `apps/web/lib/auth/dashboard-access.ts`
- Modify: `.env.example` to document `BOOTSTRAP_ADMIN_CLERK_USER_IDS`

**Interfaces:**

- Consumes: `GET /users/me` shape (`permissions: string[]`) already used by `useCurrentUser`
- Produces: Server `forbidden()` when permissions empty; client no longer shows Pending User panel

- [ ] **Step 1: Add shared access helper**

Create `apps/web/lib/auth/dashboard-access.ts`:

```typescript
export function hasDashboardAccess(permissions: string[] | null | undefined): boolean {
  return Array.isArray(permissions) && permissions.length > 0
}
```

- [ ] **Step 2: Server-gate dashboard layout**

Update `apps/web/app/(dashboard)/layout.tsx` to:

1. `await auth.protect()`
2. Obtain session JWT via `auth()` / `getToken()`
3. Fetch `${process.env.NEXT_PUBLIC_API_URL}/users/me` with `Authorization: Bearer <token>`
4. If fetch fails with 401 → redirect sign-in; if profile has no permissions → `import { forbidden } from "next/navigation"` and call `forbidden()`
5. Otherwise render `ProtectedDashboardLayout`

Concrete implementation:

```typescript
import { ProtectedDashboardLayout } from "@/components/layout/protected-layout"
import { hasDashboardAccess } from "@/lib/auth/dashboard-access"
import { auth } from "@clerk/nextjs/server"
import { forbidden, redirect } from "next/navigation"

async function fetchMe(token: string) {
  const base = process.env.NEXT_PUBLIC_API_URL
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured")
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (res.status === 401 || res.status === 403) {
    return { status: res.status as 401 | 403, body: null }
  }
  if (!res.ok) {
    throw new Error(`Failed to load profile (${res.status})`)
  }
  return { status: 200 as const, body: (await res.json()) as { permissions?: string[] } }
}

export default async function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  await session.protect()
  const token = await session.getToken()
  if (!token) {
    redirect("/sign-in")
  }
  const me = await fetchMe(token)
  if (me.status === 401) {
    redirect("/sign-in")
  }
  if (!hasDashboardAccess(me.body?.permissions)) {
    forbidden()
  }
  return <ProtectedDashboardLayout>{children}</ProtectedDashboardLayout>
}
```

Adjust `auth()` API to match `@clerk/nextjs` v7 in the lockfile (if `auth.protect()` is the only pattern, keep protect then `const { getToken } = await auth()`).

- [ ] **Step 3: Remove Pending User UI**

In `apps/web/components/layout/protected-layout.tsx`, delete the block:

```typescript
if (permissions.length === 0) {
  return ( /* Pending User ... */ )
}
```

Replace with:

```typescript
if (!hasDashboardAccess(permissions)) {
  return null
}
```

(Server layout already issued 403; client should not soft-render Pending.)

- [ ] **Step 4: Manual checklist**

1. User with no roles / PENDING only → dashboard URL returns 403
2. Bootstrap admin after first API hit → permissions non-empty → dashboard loads
3. Operational role with permissions → dashboard loads

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/layout.tsx apps/web/components/layout/protected-layout.tsx apps/web/lib/auth/dashboard-access.ts .env.example
git commit -m "fix(web): return HTTP 403 for dashboard users without permissions"
```

---
