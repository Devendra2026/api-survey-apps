"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { PageHeader } from "@/components/shared/page-elements"
import { useAuthStore } from "@/stores/app-store"

export default function AdminSettingsPage() {
  const profile = useAuthStore((s) => s.profile)

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Profile and application preferences" />

      <Card>
        <CardHeader>
          <CardTitle>Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Name:</span> {profile?.fullName}</p>
          <p><span className="text-muted-foreground">Email:</span> {profile?.email}</p>
          <p><span className="text-muted-foreground">Permissions:</span> {profile?.permissions.length ?? 0}</p>
        </CardContent>
      </Card>
    </div>
  )
}
