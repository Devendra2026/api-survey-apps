"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { useAuthStore } from "@/stores/app-store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

export default function ConfigurationSettingsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")

  if (!canView) {
    return <EmptyState title="Settings unavailable" description="Requires settings:view." />
  }

  return (
    <ConfigurationWorkspace
      title="Registry Settings"
      description="Permissions and operational notes for the Configuration Registry."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Permissions</CardTitle>
            <CardDescription>RBAC capabilities for this module</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <code className="rounded bg-muted px-1.5 py-0.5">settings:view</code> — browse catalogs, geography, tax
              drafts, and audit
            </p>
            <p>
              <code className="rounded bg-muted px-1.5 py-0.5">settings:manage</code> — mutate reference entries,
              geography, and tax drafts
            </p>
            <p>
              <code className="rounded bg-muted px-1.5 py-0.5">settings:publish</code> — publish and rollback tax
              configurations
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">Import / migration</CardTitle>
            <CardDescription>How surveys relate to catalogs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Reference catalogs are seeded from legacy Prisma enums. Surveys still store enum codes during the dual-map
              window; use <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">enumCodeToCatalogCode</code>{" "}
              when resolving entry IDs.
            </p>
            <p>Geography bulk import remains available under Administration → Import.</p>
          </CardContent>
        </Card>
      </div>
    </ConfigurationWorkspace>
  )
}
