"use client"

import { DashboardShell } from "@/components/layout/dashboard-shell"
import { useCurrentUser } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { hasDashboardAccess } from "@/lib/auth/dashboard-access"
import { useValidateQcWorkingContext } from "@/lib/qc/use-validate-qc-working-context"
import { useAuthStore } from "@/stores/app-store"
import { SignOutButton, useAuth } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useRouter } from "next/navigation"
import { useEffect, useLayoutEffect, useTransition } from "react"

function LoadingSkeleton() {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function AccessPendingPanel({ onRefresh }: { onRefresh: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="surface-elevated w-full max-w-md space-y-3 p-8">
        <p className="text-lg font-semibold tracking-tight">Access pending</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your account has been created successfully. An administrator must assign a platform role before you can
          continue.
        </p>
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Status: Pending approval</p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="rounded-xl"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                onRefresh()
                router.refresh()
              })
            }}
          >
            {isPending ? "Refreshing…" : "Refresh status"}
          </Button>
          <SignOutButton redirectUrl="/sign-in">
            <Button type="button" variant="outline" size="sm" className="rounded-xl">
              Sign out
            </Button>
          </SignOutButton>
        </div>
      </div>
    </div>
  )
}

export function ProtectedDashboardLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const router = useRouter()
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const clearProfile = useAuthStore((s) => s.clearProfile)
  const { data: user, isLoading, isError, error, refetch, isFetching } = useCurrentUser()

  useValidateQcWorkingContext()

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      clearProfile()
      router.replace("/sign-in")
    }
  }, [isLoaded, isSignedIn, router, clearProfile])

  useEffect(() => {
    if (!isError) return
    const message = getApiErrorMessage(error)
    if (/disabled/i.test(message)) {
      router.replace("/account-disabled")
    }
  }, [isError, error, router])

  useLayoutEffect(() => {
    if (!isSignedIn || !userId) {
      clearProfile()
      return
    }
    if (user && user.clerkUserId === userId) {
      setProfile({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        permissions: user.permissions ?? [],
        tenantRoles: user.tenantRoles ?? [],
      })
      return
    }
    clearProfile()
  }, [user, userId, isSignedIn, setProfile, clearProfile])

  if (!isLoaded || !isSignedIn || isLoading || (isFetching && !user)) {
    return <LoadingSkeleton />
  }

  if (user && userId && user.clerkUserId !== userId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="surface-elevated w-full max-w-md space-y-3 p-8">
          <p className="text-sm font-medium text-destructive">Session profile mismatch.</p>
          <p className="text-xs text-muted-foreground">
            Your session user does not match the loaded profile. Sign out and try again.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void refetch()}>
              Retry
            </Button>
            <SignOutButton redirectUrl="/sign-in">
              <Button type="button" variant="outline" size="sm" className="rounded-xl">
                Sign out
              </Button>
            </SignOutButton>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    const message = getApiErrorMessage(error)
    const isDisabled = /disabled/i.test(message)

    if (isDisabled) {
      return <LoadingSkeleton />
    }

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="surface-elevated w-full max-w-md space-y-3 p-8">
          <p className="text-sm font-medium text-destructive">Unable to load your profile.</p>
          <p className="text-xs text-muted-foreground">{message}</p>
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const permissions = user?.permissions ?? []
  if (!hasDashboardAccess(permissions)) {
    return <AccessPendingPanel onRefresh={() => void refetch()} />
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
