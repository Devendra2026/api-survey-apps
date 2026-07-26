"use client"

import { DemandNoticeDocumentView } from "@/components/demand-notice/demand-notice-document"
import { apiGet } from "@/lib/api/client"
import type { DemandNoticeDocument } from "@/lib/demand-notice/types"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ArrowLeft, Printer } from "lucide-react"
import { Noto_Sans_Devanagari } from "next/font/google"
import Link from "next/link"
import { use, useEffect } from "react"

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
})

export default function DemandNoticeDetailPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params)
  const { data, isLoading, error } = useQuery({
    queryKey: ["demand-notice", surveyId],
    queryFn: () => apiGet<DemandNoticeDocument>(`/demand-notices/${surveyId}`),
    enabled: Boolean(surveyId),
  })

  useEffect(() => {
    document.documentElement.classList.add("demand-notice-print-mode")
    return () => {
      document.documentElement.classList.remove("demand-notice-print-mode")
    }
  }, [])

  return (
    <div className={`demand-notice-page mx-auto w-full max-w-[210mm] space-y-4 p-4 ${notoDevanagari.variable}`}>
      <div className="print-hidden sticky top-4 z-40 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <Button asChild variant="outline" size="sm" className="cursor-pointer gap-1.5">
          <Link href="/reports/demand-notices">
            <ArrowLeft className="size-4" aria-hidden />
            Back to panel
          </Link>
        </Button>
        <Button size="sm" className="cursor-pointer gap-1.5" onClick={() => window.print()} disabled={!data}>
          <Printer className="size-4" aria-hidden />
          Print one copy
        </Button>
      </div>

      {isLoading ? (
        <div className="print-hidden space-y-3 rounded-xl border bg-white p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error || !data ? (
        <p className="print-hidden text-sm text-red-600">
          {error instanceof Error ? error.message : "Notice not found"}
        </p>
      ) : (
        <div className="demand-notice-print-root">
          <DemandNoticeDocumentView
            doc={data}
            className="mx-auto border border-slate-200 shadow-sm print:border-0 print:shadow-none"
          />
        </div>
      )}
    </div>
  )
}
