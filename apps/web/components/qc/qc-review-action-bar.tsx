"use client"

import {
  glassInsetClass,
  glassPanelClass,
  statusBadgeClass,
  SurveyViewField,
} from "@/components/surveys/survey-view-field"
import type { QcSurveyDetail } from "@/lib/api/types"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowLeft, FileText, Pencil, RotateCcw, Trash2 } from "lucide-react"
import Link from "next/link"

export function QcReviewActionBar({
  survey,
  editMode,
  pending,
  onReopen,
  onApprove,
  onReject,
  onDelete,
  onDemandNotice,
  onToggleEdit,
}: {
  survey: QcSurveyDetail
  editMode: boolean
  pending?: boolean
  onReopen: () => void
  onApprove: () => void
  onReject: () => void
  onDelete: () => void
  onDemandNotice: () => void
  onToggleEdit: () => void
}) {
  const isApproved = survey.surveyStatus === "APPROVED" || survey.qcStatus === "APPROVED"
  const isPendingQc = survey.surveyStatus === "SUBMITTED" && (survey.qcStatus === "PENDING" || !survey.qcStatus)
  const isRejected = survey.surveyStatus === "REJECTED" || survey.qcStatus === "REJECTED"

  return (
    <div className="mb-4 space-y-3">
      <header
        className={cn(
          glassPanelClass,
          "sticky top-16 z-30 -mx-1 border-b border-white/40 px-5 py-5 backdrop-blur-2xl dark:border-white/10"
        )}
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit cursor-pointer rounded-full border border-white/40 bg-white/40 px-3 backdrop-blur-md hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            asChild
          >
            <Link href="/qc/registry">
              <ArrowLeft className="size-4" />
              Back to QC queue
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {(isApproved || isRejected) && (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
                disabled={pending}
                onClick={onReopen}
              >
                <RotateCcw className="size-3.5" />
                Reopen for Review
              </Button>
            )}
            {isPendingQc && (
              <>
                <Button
                  size="sm"
                  className="cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={pending}
                  onClick={onApprove}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="cursor-pointer"
                  disabled={pending}
                  onClick={onReject}
                >
                  Return
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="cursor-pointer" disabled={pending} onClick={onDemandNotice}>
              <FileText className="size-3.5" />
              Generate Demand Notice
            </Button>
            <Button
              size="sm"
              variant={editMode ? "default" : "outline"}
              className={cn("cursor-pointer", editMode && "bg-teal-600 text-white hover:bg-teal-700")}
              disabled={pending}
              onClick={onToggleEdit}
            >
              <Pencil className="size-3.5" />
              {editMode ? "Cancel Edit" : "Update / Edit"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
              disabled={pending}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
              Delete Survey
            </Button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge className="rounded-full border border-teal-400/30 bg-teal-600 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-white uppercase">
            QC Review
          </Badge>
          <Badge
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase",
              statusBadgeClass(survey.status)
            )}
          >
            {survey.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField
              label="Property ID"
              value={<span className="font-mono text-xs">{survey.propertyId}</span>}
            />
          </div>
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField label="ULB Name" value={survey.ulbName} />
          </div>
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField label="Ward No" value={survey.wardNo} />
          </div>
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField label="Parcel No" value={survey.parcelNo} />
          </div>
          <div className={cn(glassInsetClass, "col-span-2 p-3 xl:col-span-1")}>
            <SurveyViewField label="Owner Name" value={survey.ownerName} />
          </div>
        </div>
      </header>

      {isApproved ? (
        <div className="rounded-xl border border-emerald-300/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-500/10 dark:text-emerald-200">
          This survey is approved. Use <strong>Reopen for review</strong> in the action bar if the data is incorrect.
          Surveyor: <strong>{survey.surveyor}</strong>
        </div>
      ) : null}
    </div>
  )
}
