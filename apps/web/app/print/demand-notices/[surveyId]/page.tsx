"use client"

import { DemandNoticeDocumentView } from "@/components/demand-notice/demand-notice-document"
import type { DemandNoticeDocument } from "@/lib/demand-notice/types"
import { apiGet } from "@/lib/api/client"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Noto_Sans_Devanagari } from "next/font/google"
import { use } from "react"

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-devanagari",
  display: "swap",
})

export default function PrintDemandNoticePage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""

  const { data, isLoading, error } = useQuery({
    queryKey: ["demand-notice-print", surveyId, token],
    queryFn: () =>
      apiGet<DemandNoticeDocument>(`/demand-notices/print/document/${surveyId}?token=${encodeURIComponent(token)}`),
    enabled: Boolean(surveyId && token),
    retry: false,
  })

  if (!token) {
    return <p className="p-8 text-sm text-red-600">Missing print token</p>
  }
  if (isLoading) return <p className="p-8 text-sm text-slate-500">Loading notice…</p>
  if (error || !data) {
    return <p className="p-8 text-sm text-red-600">{error instanceof Error ? error.message : "Failed to load"}</p>
  }

  return (
    <div
      className={`${notoDevanagari.variable} bg-white p-0`}
      style={{ fontFamily: "var(--font-devanagari), system-ui, sans-serif" }}
    >
      <DemandNoticeDocumentView doc={data} />
    </div>
  )
}
