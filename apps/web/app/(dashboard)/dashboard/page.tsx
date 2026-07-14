"use client"

import { DashboardError } from "@/components/dashboard/dashboard-error"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { LowerGrid } from "@/components/dashboard/lower-grid"
import { MetricKpiRow } from "@/components/dashboard/metric-kpi-row"
import { OrgOverview } from "@/components/dashboard/org-overview"
import { ProductivityAnalytics } from "@/components/dashboard/productivity-analytics"
import { QcOperations } from "@/components/dashboard/qc-operations"
import { WelcomeHeader } from "@/components/dashboard/welcome-header"
import { EmptyState } from "@/components/shared/page-elements"
import { useDashboardSummary, useOrganizationOverview, useProductivityAnalytics } from "@/hooks/use-api"
import {
  applySummaryToProMaxDashboard,
  formatDashboardNumber,
  type OrgMiniCard,
  type QcOpsCard,
} from "@/lib/dashboard-mock"
import { useAuthStore } from "@/stores/app-store"
import { useMemo } from "react"

export default function DashboardPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("dashboard:view")
  const canCreate = hasPermission("survey:create")
  const canApprove = hasPermission("survey:approve")

  const summaryQuery = useDashboardSummary()
  const organizationQuery = useOrganizationOverview()
  const analyticsQuery = useProductivityAnalytics()

  const isLoading = summaryQuery.isLoading || organizationQuery.isLoading || analyticsQuery.isLoading
  const isError = summaryQuery.isError || organizationQuery.isError || analyticsQuery.isError

  const summaryView = useMemo(() => {
    if (!summaryQuery.data || typeof summaryQuery.data.totalSurveys !== "number") return null
    return applySummaryToProMaxDashboard({
      totalSurveys: summaryQuery.data.totalSurveys,
      draft: summaryQuery.data.draft,
      pendingQc: summaryQuery.data.pendingQc,
      createdToday: summaryQuery.data.createdToday,
      createdTodaySubmitted: summaryQuery.data.createdTodaySubmitted,
      approvedQc: summaryQuery.data.approvedQc,
      rejections: summaryQuery.data.rejections,
      rejectionRate: summaryQuery.data.rejectionRate,
      queueHealth: summaryQuery.data.queueHealth,
    })
  }, [summaryQuery.data])

  const orgCards = useMemo((): OrgMiniCard[] => {
    const org = organizationQuery.data
    if (!org) return []
    return [
      {
        id: "surveyors",
        label: "Active Surveyors",
        value: org.activeSurveyors,
        subtext: "Field workforce",
        icon: "users",
      },
      {
        id: "qc-supervisors",
        label: "Active QC Supervisors",
        value: org.activeQcSupervisors,
        subtext: "Review workforce",
        icon: "shieldCheck",
      },
      {
        id: "districts",
        label: "Districts",
        value: org.districts,
        subtext: "Geographic scope",
        icon: "mapPin",
      },
      {
        id: "municipalities",
        label: "Municipalities",
        value: org.municipalities,
        subtext: "ULBs in scope",
        icon: "landmark",
      },
    ]
  }, [organizationQuery.data])

  const qcOps = useMemo((): QcOpsCard[] => {
    if (!summaryView) return []
    return summaryView.qcOps
  }, [summaryView])

  const retryAll = () => {
    void summaryQuery.refetch()
    void organizationQuery.refetch()
    void analyticsQuery.refetch()
  }

  if (!canView) {
    return <EmptyState title="Dashboard unavailable" description="You do not have permission to view the dashboard." />
  }

  if (isLoading) return <DashboardSkeleton />

  if (isError || !summaryView || !organizationQuery.data || !analyticsQuery.data) {
    const message =
      (summaryQuery.error instanceof Error && summaryQuery.error.message) ||
      (organizationQuery.error instanceof Error && organizationQuery.error.message) ||
      (analyticsQuery.error instanceof Error && analyticsQuery.error.message) ||
      undefined
    return <DashboardError message={message} onRetry={retryAll} />
  }

  const analytics = analyticsQuery.data

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:gap-8">
      <WelcomeHeader name="Tarun" canCreate={canCreate} canApprove={canApprove} />
      <MetricKpiRow kpis={summaryView.kpis} />
      <QcOperations cards={qcOps} />
      <OrgOverview cards={orgCards} />
      <ProductivityAnalytics trend={analytics.dailyTrend} surveyors={analytics.surveyorProductivity} />
      <LowerGrid
        supervisors={analytics.qcSupervisors}
        municipalities={analytics.municipalities}
        activity={analytics.recentActivity}
      />
      <p className="text-center text-[11px] text-slate-500 dark:text-slate-400">
        Live metrics · {formatDashboardNumber(summaryView.kpis[0]?.value ?? 0)} surveys in scope
      </p>
    </div>
  )
}
