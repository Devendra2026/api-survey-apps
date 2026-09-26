"use client"

import { SignOutButton } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

export default function ForbiddenPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [refreshHint, setRefreshHint] = useState<string | null>(null)

  function refreshStatus() {
    setRefreshHint(null)
    startTransition(() => {
      router.refresh()
      setRefreshHint("If an administrator already assigned your role, you will enter the dashboard automatically.")
    })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="w-full max-w-md space-y-3">
        <h1 className="text-lg font-semibold tracking-tight">Access pending</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your account has been created successfully. An administrator must assign a platform role (Surveyor,
          Supervisor, QC Supervisor, or Admin) before you can continue.
        </p>
        <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Status: Pending approval</p>
        {refreshHint ? <p className="text-xs text-muted-foreground">{refreshHint}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="rounded-xl"
            disabled={isPending}
            onClick={refreshStatus}
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
