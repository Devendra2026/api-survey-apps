"use client"

import { SignOutButton } from "@clerk/nextjs"
import { Button } from "@workspace/ui/components/button"

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="w-full max-w-md space-y-3">
        <h1 className="text-lg font-semibold tracking-tight">Access pending</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your account is signed in but has no dashboard permissions yet. If you are the first admin, ask ops to set{" "}
          <code className="text-xs">BOOTSTRAP_ADMIN_CLERK_USER_IDS</code> to your Clerk user id and restart the API.
          Otherwise wait for an administrator to assign a role.
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
