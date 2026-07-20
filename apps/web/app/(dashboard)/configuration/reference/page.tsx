"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { ConfigurationWorkspace } from "@/features/configuration/components/ConfigurationWorkspace"
import { ReferenceCategoryCard } from "@/features/configuration/components/ReferenceCategoryCard"
import { useReferenceCategories } from "@/features/configuration/hooks/use-configuration"
import { useAuthStore } from "@/stores/app-store"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useRouter } from "next/navigation"

export default function ReferenceIndexPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("settings:view") || hasPermission("settings:manage") || hasPermission("role:assign")
  const { data: categories, isLoading } = useReferenceCategories()
  const router = useRouter()

  if (!canView) {
    return <EmptyState title="Reference Data unavailable" description="Requires settings:view." />
  }

  return (
    <ConfigurationWorkspace
      title="Reference Data"
      description="Editable configuration catalogs consumed by surveys, tax engine, and demand notices."
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories?.map((category) => (
            <ReferenceCategoryCard
              key={category.id}
              category={category}
              onCreate={() => router.push(`/configuration/reference/${category.code}`)}
              onAudit={() => router.push(`/configuration/reference/${category.code}`)}
            />
          ))}
        </div>
      )}
    </ConfigurationWorkspace>
  )
}
