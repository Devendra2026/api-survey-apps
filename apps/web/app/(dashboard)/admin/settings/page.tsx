"use client"

import { PageHeader } from "@/components/shared/page-elements"
import { useAuthStore } from "@/stores/app-store"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Separator } from "@workspace/ui/components/separator"

export default function AdminSettingsPage() {
  const profile = useAuthStore((s) => s.profile)
  const roles = profile?.tenantRoles?.filter((r) => r.isActive) ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" description="Profile and application preferences" />

      <Card className="shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Name</p>
              <p className="mt-0.5 font-medium">{profile?.fullName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Email</p>
              <p className="mt-0.5 font-medium">{profile?.email ?? "—"}</p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Active roles</p>
            <div className="flex flex-wrap gap-1.5">
              {roles.length ? (
                roles.map((r) => (
                  <Badge key={r.id} variant="secondary" className="rounded-md font-normal">
                    {r.role.name}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">No active roles</span>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">
              Permissions ({profile?.permissions.length ?? 0})
            </p>
            <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {(profile?.permissions ?? []).map((p) => (
                <Badge key={p} variant="outline" className="rounded-md font-mono text-[11px] font-normal">
                  {p}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
