import { Button } from "@workspace/ui/components/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

export function DashboardError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center shadow-sm dark:border-rose-900/50 dark:bg-rose-950/40">
      <span className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
        <AlertTriangle className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Could not load dashboard</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {message ?? "Something went wrong while fetching operations metrics. Please try again."}
        </p>
      </div>
      <Button
        type="button"
        className="cursor-pointer bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        onClick={onRetry}
      >
        <RefreshCw className="size-4" />
        Retry
      </Button>
    </div>
  )
}
