"use client"

import { Database } from "lucide-react"

export function MasterDataHero() {
  return (
    <header className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-primary uppercase">Configuration</p>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Database className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Master Data Hub</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Configure dropdown reference values and the geographic tenant hierarchy used across surveys and user
            assignments.
          </p>
        </div>
      </div>
    </header>
  )
}
