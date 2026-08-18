"use client"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { useCurrentUser } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { hasDashboardAccess } from "@/lib/auth/dashboard-access"
import { useValidateQcWorkingContext } from "@/lib/qc/use-validate-qc-working-context"
import { useAuthStore } from "@/stores/app-store"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect } from "react"

function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export function ProtectedDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const clearProfile = useAuthStore((s) => s.clearProfile)
  const { data: user, isLoading, isError, error, refetch, isFetching } = useCurrentUser()

  useValidateQcWorkingContext()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in")
    }
  }, [isLoaded, isSignedIn, router])

  useLayoutEffect(() => {
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
    return <LoadingSkeleton />
  }

  if (isError) {
    const message = getApiErrorMessage(error)
    const isDisabled = message.includes("disabled") || message.includes("Your account has been disabled")

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="surface-elevated w-full max-w-md space-y-3 p-8">
          {isDisabled ? (
            <>
              <p className="text-lg font-semibold tracking-tight">Account disabled</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your account has been disabled. Please contact the system administrator.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-destructive">Unable to load your profile.</p>
              <p className="text-xs text-muted-foreground">{message}</p>
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void refetch()}>
                Retry
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  const permissions = user?.permissions ?? []
  if (!hasDashboardAccess(permissions)) {
    return null
  }

  const tenantRoles = user?.tenantRoles ?? []
  const isProfileSynced =
    user != null &&
    profile != null &&
    profile.id === user.id &&
    profile.permissions.join() === permissions.join() &&
    profile.tenantRoles.length === tenantRoles.length

  if (!isProfileSynced) {
    return <LoadingSkeleton />
  }

  return <DashboardShell>{children}</DashboardShell>
}
