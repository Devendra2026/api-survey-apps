import { cn } from "@workspace/ui/lib/utils"
import { Badge } from "@workspace/ui/components/badge"
import { statusColors, statusLabels } from "@/lib/navigation"

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", statusColors[status])}>
      {statusLabels[status] ?? status}
    </Badge>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
      <h3 className="text-lg font-medium">{title}</h3>
      {description ? <p className="text-muted-foreground mt-2 max-w-md text-sm">{description}</p> : null}
    </div>
  )
}

export function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-muted/50 h-28 animate-pulse rounded-xl" />
      ))}
    </div>
  )
}
