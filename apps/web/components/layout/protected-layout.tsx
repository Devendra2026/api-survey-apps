"use client"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { useCurrentUser } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function ProtectedDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const setProfile = useAuthStore((s) => s.setProfile)
  const clearProfile = useAuthStore((s) => s.clearProfile)
  const { data: user, isLoading, isError, error, refetch, isFetching } = useCurrentUser()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in")
    }
  }, [isLoaded, isSignedIn, router])

  useEffect(() => {
    if (user) {
      setProfile({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        permissions: user.permissions ?? [],
        tenantRoles: user.tenantRoles ?? [],
      })
    } else {
      clearProfile()
    }
  }, [user, setProfile, clearProfile])

  if (!isLoaded || !isSignedIn || isLoading || (isFetching && !user)) {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">Unable to load your profile.</p>
        <p className="max-w-md text-xs text-muted-foreground">{getApiErrorMessage(error)}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const permissions = user?.permissions ?? []
  if (permissions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold">Account pending role assignment</p>
        <p className="max-w-md text-sm text-muted-foreground">
          You are signed in, but no application role has been assigned yet. Contact an administrator to grant access, or
          ensure your Clerk user ID is listed in <code className="text-xs">BOOTSTRAP_ADMIN_CLERK_USER_IDS</code> for
          first-admin setup.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
          Refresh profile
        </Button>
      </div>
    )
  }

  // Keep store in sync before mounting children so permission-gated queries enable immediately
  const storeProfile = useAuthStore.getState().profile
  const tenantRoles = user?.tenantRoles ?? []
  if (
    user &&
    (!storeProfile ||
      storeProfile.id !== user.id ||
      storeProfile.permissions.join() !== permissions.join() ||
      storeProfile.tenantRoles.length !== tenantRoles.length)
  ) {
    useAuthStore.getState().setProfile({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      permissions,
      tenantRoles,
    })
  }

  return <DashboardShell>{children}</DashboardShell>
}
