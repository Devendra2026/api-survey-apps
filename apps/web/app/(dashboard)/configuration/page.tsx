"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { AuditTimeline } from "@/features/configuration/components/AuditTimeline"
import { ConfigurationStats } from "@/features/configuration/components/ConfigurationStats"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { ReferenceCategoryCard } from "@/features/configuration/components/ReferenceCategoryCard"
import { ReferenceDrawer } from "@/features/configuration/components/ReferenceDrawer"
import {
  useConfigAudit,
  useReferenceCategories,
  useReferenceMutations,
} from "@/features/configuration/hooks/use-configuration"
import Link from "next/link"

export default function ConfigurationHomePage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")

  const { data: categories, isLoading, isError, error, refetch } = useReferenceCategories()
  const mutations = useReferenceMutations()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createCategory, setCreateCategory] = useState("OWNERSHIP_TYPE")
  const [auditOpen, setAuditOpen] = useState(false)
  const audit = useConfigAudit({ entityType: "ReferenceEntry" })

  const stats = useMemo(() => {
    const totalEntries = categories?.reduce((sum, c) => sum + c._count.entries, 0) ?? 0
    return [
      { label: "Catalogs", value: categories?.length ?? 0, hint: "Reference categories" },
      { label: "Entries", value: totalEntries, hint: "Active + archived values" },
      { label: "Geography", value: "Tree", hint: "State → Ward hierarchy" },
      { label: "Tax Engine", value: "Ward × AY", hint: "Rate matrix + publish" },
    ]
  }, [categories])

  if (!canView) {
    return (
      <EmptyState
        title="Configuration Registry unavailable"
        description="You need settings:view permission to access the configuration registry."
      />
    )
  }

  return (
    <ConfigurationWorkspace
      title="Configuration Registry"
      description="Enterprise master data for surveys, assessments, tax calculation, and demand notices."
      actions={
        <>
          <Button asChild variant="outline" className="cursor-pointer">
            <Link href="/configuration/geography">Geography</Link>
          </Button>
          <Button asChild className="cursor-pointer">
            <Link href="/configuration/tax-engine">Tax Engine</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <ConfigurationStats stats={stats} loading={isLoading} />

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Reference Data</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setAuditOpen(true)}
            >
              Registry audit
            </Button>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              title="Failed to load catalogs"
              description={error instanceof Error ? error.message : "Unknown error"}
              action={
                <Button type="button" className="cursor-pointer" onClick={() => void refetch()}>
                  Retry
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {categories?.map((category) => (
                <ReferenceCategoryCard
                  key={category.id}
                  category={category}
                  onCreate={() => {
                    if (!canManage) {
                      toast.error("You need settings:manage to create entries")
                      return
                    }
                    setCreateCategory(category.code)
                    setDrawerOpen(true)
                  }}
                  onAudit={() => setAuditOpen(true)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ReferenceDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode="create"
        categoryCode={createCategory}
        saving={mutations.create.isPending}
        onSubmit={async (values) => {
          try {
            await mutations.create.mutateAsync(values)
            toast.success("Entry created")
            setDrawerOpen(false)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Create failed")
          }
        }}
      />
      <AuditTimeline open={auditOpen} onOpenChange={setAuditOpen} logs={audit.data} loading={audit.isLoading} />
    </ConfigurationWorkspace>
  )
}
