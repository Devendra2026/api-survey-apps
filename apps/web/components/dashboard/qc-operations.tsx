import { SectionHeading } from "@/components/dashboard/section-heading"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatDashboardNumber, type QcOpsCard } from "@/lib/dashboard-mock"
import { Badge } from "@workspace/ui/components/badge"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

export function QcOperations({ cards }: { cards: QcOpsCard[] }) {
  return (
    <section>
      <SectionHeading title="QC Operations" subtitle="Review workload and approval throughput" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const isQueue = card.id === "queue-health"
          return (
            <StatCard key={card.id} accent={card.accent} className="flex flex-col gap-3">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
              {isQueue && card.badge ? (
                <Badge className="w-fit border-0 bg-amber-50 text-amber-700 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400">
                  {card.badge}
                </Badge>
              ) : (
                <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-50">
                  {typeof card.value === "number" ? formatDashboardNumber(card.value) : card.value}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">{card.subtext}</p>
              {card.actionLabel && card.actionHref ? (
                <Link
                  href={card.actionHref}
                  className="mt-auto inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {card.actionLabel}
                  <ArrowUpRight className="size-3.5" />
                </Link>
              ) : null}
            </StatCard>
          )
        })}
      </div>
    </section>
  )
}
