"use client"

import { glassInsetClass, glassPanelClass } from "@/components/surveys/survey-view-field"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

export function SurveyViewSkeleton() {
  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[2rem]">
        <div className="absolute -top-24 left-1/4 size-72 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-600/20" />
        <div className="absolute top-40 right-0 size-80 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-500/10" />
      </div>

      <div className={cn(glassPanelClass, "space-y-4 p-5")}>
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-32 rounded-full bg-white/50 dark:bg-white/10" />
          <Skeleton className="h-6 w-40 rounded-full bg-white/50 dark:bg-white/10" />
          <Skeleton className="h-8 w-24 rounded-full bg-white/50 dark:bg-white/10" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn(glassInsetClass, "p-3")}>
              <Skeleton className="mb-2 h-3 w-16 bg-white/60 dark:bg-white/10" />
              <Skeleton className="h-5 w-28 bg-white/60 dark:bg-white/10" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn(glassPanelClass, "p-5")}>
            <Skeleton className="mb-2 h-5 w-44 bg-white/60 dark:bg-white/10" />
            <Skeleton className="mb-5 h-3 w-64 bg-white/50 dark:bg-white/10" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((__, j) => (
                <Skeleton key={j} className="h-14 w-full rounded-xl bg-white/50 dark:bg-white/10" />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={cn(glassPanelClass, "p-5")}>
        <Skeleton className="mb-4 h-5 w-40 bg-white/60 dark:bg-white/10" />
        <Skeleton className="h-48 w-full rounded-xl bg-white/50 dark:bg-white/10" />
      </div>
    </div>
  )
}
