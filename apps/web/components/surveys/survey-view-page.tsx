"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { SurveyViewContent } from "@/components/surveys/survey-view-content"
import { SurveyViewSkeleton } from "@/components/surveys/survey-view-skeleton"
import { useSurveyAuditHistory, useSurveyDetails } from "@/hooks/use-api"
import { useAuthStore } from "@/stores/app-store"
import { useEffect } from "react"

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

  // #region agent log
  useEffect(() => {
    if (!auditQuery.isFetched && !auditQuery.isError) return
    fetch("http://127.0.0.1:7548/ingest/d4e91970-7ad5-429b-8326-a482939a5101", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "10c5b7" },
      body: JSON.stringify({
        sessionId: "10c5b7",
        runId: "pre-fix",
        hypothesisId: "A,E",
        location: "survey-view-page.tsx:auditQuery",
        message: "Frontend audit history payload",
        data: {
          propertyId,
          status: auditQuery.status,
          isError: auditQuery.isError,
          errorMessage: auditQuery.error instanceof Error ? auditQuery.error.message : String(auditQuery.error ?? ""),
          rowCount: auditQuery.data?.length ?? 0,
          rows: (auditQuery.data ?? []).map((r) => ({
            when: r.when,
            action: r.action,
            actor: r.actor,
            propertyId: r.propertyId,
          })),
          surveyCreatedHint: detailsQuery.data
            ? {
                id: detailsQuery.data.id,
                propertyId: detailsQuery.data.propertyId,
                status: detailsQuery.data.status,
              }
            : null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
  }, [
    propertyId,
    auditQuery.isFetched,
    auditQuery.isError,
    auditQuery.status,
    auditQuery.data,
    auditQuery.error,
    detailsQuery.data,
  ])
  // #endregion

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
