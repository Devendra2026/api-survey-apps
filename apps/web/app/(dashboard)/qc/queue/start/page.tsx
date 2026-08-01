"use client"

import { EmptyState } from "@/components/shared/page-elements"
import { apiGet, getApiErrorMessage } from "@/lib/api/client"
import type { QcQueueParcel } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { useQcWorkingContext } from "@/stores/qc-working-context"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import { toast } from "sonner"

function QcQueueStartInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const wardId = searchParams.get("wardId")?.trim() || null
  const ulbId = searchParams.get("ulbId")?.trim() || null
  const canApprove = useAuthStore((s) => s.hasPermission("survey:approve"))
  const setActiveWard = useQcWorkingContext((s) => s.setActiveWard)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canApprove) return
    if (!wardId) {
      setError("Ward is required to start QC.")
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        if (ulbId) setActiveWard({ wardId, ulbId })
        const first = await apiGet<QcQueueParcel | null>(`/qc/queue/first?wardId=${encodeURIComponent(wardId)}`)
        if (cancelled) return
        if (first?.id) {
          router.replace(`/qc/review/${encodeURIComponent(first.id)}`)
          return
        }
        toast.message("No pending parcels in this ward")
        router.replace(
          `/qc/registry?wardId=${encodeURIComponent(wardId)}${ulbId ? `&ulbId=${encodeURIComponent(ulbId)}` : ""}&status=pendingQc`
        )
      } catch (err) {
        if (cancelled) return
        setError(getApiErrorMessage(err) || "Unable to start QC queue")
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [canApprove, wardId, ulbId, router, setActiveWard])

  if (!canApprove) {
    return <EmptyState title="QC Review unavailable" description="You need survey approval permission to start QC." />
  }

  if (error) {
    return <EmptyState title="Unable to start QC" description={error} />
  }

  return (
    <div className="space-y-3 p-6">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <p className="text-sm text-muted-foreground">Opening first pending parcel…</p>
    </div>
  )
}

export default function QcQueueStartPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 p-6">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      }
    >
      <QcQueueStartInner />
    </Suspense>
  )
}
