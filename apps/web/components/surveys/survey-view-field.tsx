"use client"

import { cn } from "@workspace/ui/lib/utils"

/** Shared glassmorphic surface used across Survey View sections. */
export const glassPanelClass =
  "rounded-2xl border border-white/40 bg-white/55 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/45 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]"

export const glassInsetClass =
  "rounded-xl border border-white/50 bg-white/40 backdrop-blur-md dark:border-white/10 dark:bg-white/5"

export function SurveyViewField({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
        {label}
      </p>
      <p className="text-sm font-medium wrap-break-word text-slate-900 dark:text-slate-50">{value ?? "—"}</p>
    </div>
  )
}

export function statusBadgeClass(status: string) {
  const key = status.toLowerCase()
  if (key.includes("approved")) {
    return "border-emerald-400/30 bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]"
  }
  if (key.includes("reject")) {
    return "border-rose-400/30 bg-rose-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]"
  }
  if (key.includes("submitted")) {
    return "border-indigo-400/30 bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.35)]"
  }
  if (key.includes("draft") || key.includes("progress")) {
    return "border-amber-400/30 bg-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.35)]"
  }
  return "border-slate-400/30 bg-slate-600 text-white"
}
