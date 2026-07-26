"use client"

import { DemandNoticeDocumentView } from "@/components/demand-notice/demand-notice-document"
import type { DemandNoticeDocument } from "@/lib/demand-notice/types"
import { apiGet } from "@/lib/api/client"
import { useQuery } from "@tanstack/react-query"
import { Noto_Sans_Devanagari } from "next/font/google"
import { useSearchParams } from "next/navigation"

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
})

export default function PrintWardDemandNoticesPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const wardId = searchParams.get("wardId") ?? ""
  const assessmentYearId = searchParams.get("assessmentYearId") ?? ""

  const qs = new URLSearchParams({ token, wardId })
  if (assessmentYearId) qs.set("assessmentYearId", assessmentYearId)

  const { data, isLoading, error } = useQuery({
    queryKey: ["demand-notice-print-ward", wardId, assessmentYearId, token],
    queryFn: () => apiGet<DemandNoticeDocument[]>(`/demand-notices/print/ward?${qs.toString()}`),
    enabled: Boolean(token && wardId),
    retry: false,
  })

  if (!token || !wardId) {
    return <p className="p-8 text-sm text-red-600">Missing wardId or print token</p>
  }
  if (isLoading) return <p className="p-8 text-sm text-slate-500">Loading ward notices…</p>
  if (error || !data) {
    return <p className="p-8 text-sm text-red-600">{error instanceof Error ? error.message : "Failed to load"}</p>
  }

  return (
    <div
      className={`${notoDevanagari.variable} bg-white`}
      style={{ fontFamily: "var(--font-devanagari), system-ui, sans-serif" }}
      data-print-ready="true"
      data-notice-count={data.length}
    >
      {data.length === 0 ? (
        <p className="p-8 text-sm text-slate-500">No QC-approved demand notices in this ward.</p>
      ) : (
        data.map((doc) => (
          <div key={doc.surveyId} className="demand-notice-print-page">
            <DemandNoticeDocumentView doc={doc} />
          </div>
        ))
      )}
    </div>
  )
}
