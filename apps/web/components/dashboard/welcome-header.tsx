import { Button } from "@workspace/ui/components/button"
import { ClipboardCheck, Plus } from "lucide-react"
import Link from "next/link"

export function WelcomeHeader({
  name,
  canCreate,
  canApprove,
}: {
  name: string
  canCreate: boolean
  canApprove: boolean
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl dark:text-slate-50">
          Welcome back, {name}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Here is your survey operations snapshot for today.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canApprove ? (
          <Button variant="outline" className="cursor-pointer border-slate-100 dark:border-slate-800" asChild>
            <Link href="/qc?pipeline=pending">
              <ClipboardCheck className="size-4" />
              Open QC Queue
            </Link>
          </Button>
        ) : null}
        {canCreate ? (
          <Button
            className="cursor-pointer border-0 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            asChild
          >
            <Link href="/surveys/new">
              <Plus className="size-4" />
              New Survey
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
