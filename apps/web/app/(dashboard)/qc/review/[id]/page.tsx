"use client"

import { QcReviewDetail } from "@/components/qc/qc-review-detail"
import { SurveyViewSkeleton } from "@/components/surveys/survey-view-skeleton"
import { useParams } from "next/navigation"
import { Suspense } from "react"

export default function QcReviewDetailPage() {
  const params = useParams<{ id: string }>()
  const id = decodeURIComponent(params.id ?? "")

  return (
    <Suspense fallback={<SurveyViewSkeleton />}>
      <QcReviewDetail propertyId={id} />
    </Suspense>
  )
}
