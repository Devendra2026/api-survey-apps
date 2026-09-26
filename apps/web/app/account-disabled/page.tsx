"use client"

import { SignOutButton } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"

export default function AccountDisabledPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="w-full max-w-md space-y-3">
        <h1 className="text-lg font-semibold tracking-tight">Account disabled</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your account has been disabled and can no longer access the survey portal. Contact your system administrator
          if you believe this is a mistake.
        </p>
        <SignOutButton redirectUrl="/sign-in">
          <Button type="button" variant="outline" size="sm" className="rounded-xl">
            Sign out
          </Button>
        </SignOutButton>
      </div>
    </div>
  )
}
