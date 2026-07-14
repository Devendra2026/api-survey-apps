"use client"

import { SurveyViewPage } from "@/components/surveys/survey-view-page"
import { SurveyViewSkeleton } from "@/components/surveys/survey-view-skeleton"
import { useParams } from "next/navigation"
import { Suspense } from "react"

export default function SurveyDetailRoutePage() {
  const params = useParams<{ id: string }>()
  return (
    <Suspense fallback={<SurveyViewSkeleton />}>
      <SurveyViewPage propertyId={params.id} />
    </Suspense>
  )
}
