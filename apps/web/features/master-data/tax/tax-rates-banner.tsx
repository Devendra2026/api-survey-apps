"use client"

export function TaxRatesBanner() {
  return (
    <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/25">
      <p className="text-sm text-emerald-900 dark:text-emerald-200">
        <span className="font-semibold">Ward-wise rental rates</span>
        <span className="text-emerald-800/85 dark:text-emerald-300/80">
          {" "}
          — each ward has its own matrix; drafts save until you publish.
        </span>
      </p>
    </div>
  )
}
