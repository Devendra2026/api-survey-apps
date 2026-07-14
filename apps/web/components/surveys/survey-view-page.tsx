"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { SurveyViewContent } from "@/components/surveys/survey-view-content"
import { SurveyViewSkeleton } from "@/components/surveys/survey-view-skeleton"
import { useSurveyAuditHistory, useSurveyDetails } from "@/hooks/use-api"
import { useAuthStore } from "@/stores/app-store"

/**
 * Pro Max read-only Survey View page composition.
 * Next.js route: `app/(dashboard)/surveys/[id]/page.tsx`
 * Demo preview: `/surveys/DEMO-PROP-001`
 */
export function SurveyViewPage({ propertyId }: { propertyId: string }) {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("survey:view")

  const detailsQuery = useSurveyDetails(propertyId, Boolean(canView))
  const auditQuery = useSurveyAuditHistory(propertyId, Boolean(canView) && Boolean(propertyId))

  if (!canView) {
    return (
      <EmptyState title="Survey unavailable" description="You do not have permission to view this survey record." />
    )
  }

  if (detailsQuery.isLoading) {
    return <SurveyViewSkeleton />
  }

  if (detailsQuery.isError || !detailsQuery.data) {
    return (
      <EmptyState
        title="Survey not found"
        description="This survey may be outside your tenant scope or the identifier is invalid."
      />
    )
  }

  return <SurveyViewContent survey={detailsQuery.data} audits={auditQuery.data ?? []} />
}
