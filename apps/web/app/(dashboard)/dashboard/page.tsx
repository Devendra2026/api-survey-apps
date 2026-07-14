"use client"

import { EmptyState, LoadingGrid, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useDashboardSummary, useNotifications } from "@/hooks/use-api"
import { statusLabels } from "@/lib/navigation"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { ClipboardList, FileCheck2, Layers, TrendingUp } from "lucide-react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canView = hasPermission("dashboard:view")
  const { data, isLoading, isError } = useDashboardSummary()
  const { data: notifications } = useNotifications(1)

  if (!canView) {
    return <EmptyState title="Dashboard unavailable" description="You do not have permission to view the dashboard." />
  }

  if (isLoading) return <LoadingGrid count={4} />
  if (isError || !data) {
    return <EmptyState title="Dashboard unavailable" description="Could not load summary metrics." />
  }

  const chartData = Object.entries(data.byStatus).map(([status, count]) => ({
    status: statusLabels[status] ?? status,
    count,
  }))

  const approved = data.byStatus.APPROVED ?? 0
  const submitted = data.byStatus.SUBMITTED ?? 0
  const inProgress = (data.byStatus.IN_PROGRESS ?? 0) + (data.byStatus.DRAFT ?? 0)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of municipal property surveys in your tenant scope"
        actions={
          <Button asChild>
            <Link href="/surveys/new">New survey</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total surveys" value={data.total} icon={Layers} />
        <StatCard title="In progress" value={inProgress} icon={ClipboardList} />
        <StatCard title="Awaiting QC" value={submitted} icon={TrendingUp} />
        <StatCard title="Approved" value={approved} icon={FileCheck2} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Surveys by status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState title="No survey data yet" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(notifications?.items ?? []).slice(0, 5).map((n) => (
              <div key={n.id} className="rounded-lg border p-3 text-sm">
                <p>{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.changedAt).toLocaleString()}</p>
              </div>
            ))}
            {!notifications?.items.length ? (
              <p className="text-sm text-muted-foreground">No recent notifications</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent surveys</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href="/surveys">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Property ID</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((survey) => (
                  <tr key={survey.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{survey.propertyId}</td>
                    <td className="py-3">
                      <StatusBadge status={survey.surveyStatus} />
                    </td>
                    <td className="py-3 text-muted-foreground">{new Date(survey.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/surveys/${survey.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.recent.length ? (
              <EmptyState title="No surveys yet" description="Create your first property survey to get started." />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
