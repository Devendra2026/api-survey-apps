"use client"

import { EmptyState } from "@/components/shared/page-elements"
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
import { loadConfigLastPath } from "@/features/configuration/lib/last-path"
import { CONFIG_BASE } from "@/features/configuration/lib/types"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useLayoutEffect, useMemo, useState } from "react"
import { toast } from "sonner"

export default function ConfigurationHomePage() {
  const router = useRouter()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")
  const canManage = hasPermission("settings:manage") || hasPermission("role:assign")
  const [allowOverview, setAllowOverview] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  useLayoutEffect(() => {
    if (!canView) return
    const stay = new URLSearchParams(window.location.search).get("stay") === "1"
    const last = loadConfigLastPath()
    if (!stay && !last) {
      setRedirecting(true)
      router.replace(`${CONFIG_BASE}/geography`)
      return
    }
    setAllowOverview(true)
  }, [canView, router])

  const { data: categories, isLoading, isError, error, refetch } = useReferenceCategories()
  const mutations = useReferenceMutations()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createCategory, setCreateCategory] = useState("OWNERSHIP_TYPE")
  const [auditOpen, setAuditOpen] = useState(false)
  const audit = useConfigAudit({ entityType: "ReferenceEntry" })

  const stats = useMemo(() => {
    const totalEntries = categories?.reduce((sum, category) => sum + category._count.entries, 0) ?? 0
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

  if (redirecting || !allowOverview) {
    return (
      <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading configuration">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <ConfigurationWorkspace
      title="Configuration Registry"
      description="Enterprise master data for surveys, assessments, tax calculation, and demand notices."
      actions={
        <>
          <Button asChild variant="outline" className="cursor-pointer">
            <Link href={`${CONFIG_BASE}/geography`}>Geography</Link>
          </Button>
          <Button asChild className="cursor-pointer">
            <Link href={`${CONFIG_BASE}/tax-engine`}>Tax Engine</Link>
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
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-40 rounded-lg" />
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
