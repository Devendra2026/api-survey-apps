"use client"

import { statusColors, statusLabels } from "@/lib/navigation"
import { Badge } from "@workspace/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"
import { Inbox } from "lucide-react"
import Link from "next/link"
import { Fragment } from "react"

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="secondary" className={cn("rounded-md font-medium", statusColors[status])}>
      {statusLabels[status] ?? status}
    </Badge>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
}) {
  return (
    <div className="animate-in-slide space-y-4">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => (
              <Fragment key={`${crumb.label}-${i}`}>
                {i > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
                  {crumb.href && i < breadcrumbs.length - 1 ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground md:text-[1.75rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center",
        className
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function QueryErrorBanner({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-destructive">{title}</p>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  onClick,
  active,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "info"
  onClick?: () => void
  active?: boolean
}) {
  const toneClass = {
    default: "from-primary/8 to-transparent text-primary",
    success: "from-emerald-500/10 to-transparent text-emerald-700 dark:text-emerald-300",
    warning: "from-amber-500/10 to-transparent text-amber-700 dark:text-amber-300",
    danger: "from-rose-500/10 to-transparent text-rose-700 dark:text-rose-300",
    info: "from-cyan-500/10 to-transparent text-cyan-700 dark:text-cyan-300",
  }[tone]

  const Comp = onClick ? "button" : "div"

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "surface-elevated group relative overflow-hidden p-4 text-left transition-all duration-200",
        onClick && "cursor-pointer hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary/40 ring-2 ring-primary/20"
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-linear-to-br opacity-80", toneClass)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/80 shadow-sm",
              toneClass.split(" ").slice(-1)[0]
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </Comp>
  )
}

export function LoadingGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}
