import { SectionHeading } from "@/components/dashboard/section-heading"
import { StatCard } from "@/components/dashboard/stat-card"
import { formatDashboardNumber, type OrgMiniCard } from "@/lib/dashboard-mock"
import type { LucideIcon } from "lucide-react"
import { Landmark, MapPin, ShieldCheck, Users } from "lucide-react"

const iconMap: Record<OrgMiniCard["icon"], LucideIcon> = {
  users: Users,
  shieldCheck: ShieldCheck,
  mapPin: MapPin,
  landmark: Landmark,
}

export function OrgOverview({ cards }: { cards: OrgMiniCard[] }) {
  return (
    <section>
      <SectionHeading title="Organization Overview" subtitle="Workforce capacity and geographic scope" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = iconMap[card.icon]
          return (
            <StatCard key={card.id} className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-slate-50">
                  {formatDashboardNumber(card.value)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{card.subtext}</p>
              </div>
            </StatCard>
          )
        })}
      </div>
    </section>
  )
}
