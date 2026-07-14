export function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl animate-pulse flex-col gap-6 md:gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-80 rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-28 rounded-lg bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-4 h-3 w-20 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-7 w-16 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="mt-2 h-3 w-28 rounded bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-80 rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900" />
        <div className="h-80 rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-72 rounded-xl border border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
    </div>
  )
}
