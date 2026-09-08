import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

const accentBorders = {
  amber: "border-amber-200 dark:border-amber-800/60",
  emerald: "border-emerald-200 dark:border-emerald-800/60",
  rose: "border-rose-200 dark:border-rose-800/60",
  neutral: "border-slate-100 dark:border-slate-800",
  none: "border-slate-100 dark:border-slate-800",
} as const

export function StatCard({
  children,
  className,
  accent = "none",
  hoverLift = true,
}: {
  children: ReactNode
  className?: string
  accent?: keyof typeof accentBorders
  hoverLift?: boolean
}) {
  return (
    <div
      className={cn(
        "h-full rounded-xl border bg-white p-4 shadow-sm transition-colors duration-200 dark:bg-slate-900",
        accentBorders[accent],
        hoverLift && "hover:border-slate-200 hover:shadow-md dark:hover:border-slate-700",
        className
      )}
    >
      {children}
    </div>
  )
}
