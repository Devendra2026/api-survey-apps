"use client"

import {
  glassInsetClass,
  glassPanelClass,
  statusBadgeClass,
  SurveyViewField,
} from "@/components/surveys/survey-view-field"
import { useWards } from "@/hooks/use-api"
import type { QcSurveyDetail } from "@/lib/api/types"
import { formatParcelDisplay } from "@/lib/format-parcel"
import { formatWardOptionLabel } from "@/lib/format-ward-label"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Pencil, RotateCcw, Save, Trash2, X } from "lucide-react"
import Link from "next/link"

export function QcReviewActionBar({
  survey,
  editMode,
  pending,
  canDelete,
  propertyIdDisplay,
  parcelDisplay,
  wardNoDisplay,
  activeWardId,
  activeUlbId,
  prevId,
  nextId,
  onActiveWardChange,
  onPrev,
  onNext,
  onReopen,
  onApprove,
  onDelete,
  onEdit,
  onSave,
  onCancel,
}: {
  survey: QcSurveyDetail
  editMode: boolean
  pending?: boolean
  canDelete: boolean
  propertyIdDisplay?: string
  parcelDisplay?: string
  wardNoDisplay?: string
  activeWardId: string | null
  activeUlbId: string | null
  prevId: string | null
  nextId: string | null
  onActiveWardChange: (wardId: string) => void
  onPrev: () => void
  onNext: () => void
  onReopen: () => void
  onApprove: () => void
  onDelete: () => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}) {
  const isApproved = survey.surveyStatus === "APPROVED" || survey.qcStatus === "APPROVED"
  const isPendingQc = survey.surveyStatus === "SUBMITTED" && (survey.qcStatus === "PENDING" || !survey.qcStatus)
  const isRejected = survey.surveyStatus === "REJECTED" || survey.qcStatus === "REJECTED"
  const canEdit = isPendingQc && !editMode
  const locked = isApproved && !editMode

  const ulbId = activeUlbId || survey.editable.ulbId
  const { data: wards, isLoading: wardsLoading } = useWards(ulbId || undefined)

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
              Back to QC Review
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={pending || !prevId}
              onClick={onPrev}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              disabled={pending || !nextId}
              onClick={onNext}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>

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

            {editMode ? (
              <>
                <Button
                  size="sm"
                  className="cursor-pointer bg-teal-600 text-white hover:bg-teal-700"
                  disabled={pending}
                  onClick={onSave}
                >
                  <Save className="size-3.5" />
                  Save
                </Button>
                <Button size="sm" variant="outline" className="cursor-pointer" disabled={pending} onClick={onCancel}>
                  <X className="size-3.5" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                {canEdit ? (
                  <Button size="sm" variant="outline" className="cursor-pointer" disabled={pending} onClick={onEdit}>
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                ) : null}
                {isPendingQc ? (
                  <Button
                    size="sm"
                    className="cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={pending}
                    onClick={onApprove}
                  >
                    <Check className="size-3.5" />
                    Approve
                  </Button>
                ) : null}
              </>
            )}

            {canDelete ? (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
                disabled={pending}
                onClick={onDelete}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5 sm:max-w-md sm:min-w-64">
            <Label htmlFor="qc-active-ward" className="text-xs font-medium text-muted-foreground">
              Active Ward
            </Label>
            <Select
              value={activeWardId || survey.editable.wardId || undefined}
              onValueChange={onActiveWardChange}
              disabled={pending || wardsLoading || !ulbId}
            >
              <SelectTrigger id="qc-active-ward" className="cursor-pointer bg-white/60 dark:bg-white/5">
                <SelectValue placeholder={wardsLoading ? "Loading wards…" : "Select active ward"} />
              </SelectTrigger>
              <SelectContent>
                {(wards?.items ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id} className="cursor-pointer">
                    {formatWardOptionLabel(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          {editMode ? (
            <Badge className="rounded-full border border-teal-300/40 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-800 dark:text-teal-200">
              Editing
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField
              label="Property ID"
              value={<span className="font-mono text-xs">{propertyIdDisplay ?? survey.propertyId}</span>}
            />
          </div>
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField label="ULB Name" value={survey.ulbName} />
          </div>
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField label="Ward No" value={wardNoDisplay ?? survey.wardNo} />
          </div>
          <div className={cn(glassInsetClass, "p-3")}>
            <SurveyViewField
              label="Parcel No"
              value={
                <span className="font-mono text-xs">
                  {formatParcelDisplay(parcelDisplay ?? survey.editable.parcelNumber ?? survey.parcelNo)}
                </span>
              }
            />
          </div>
          <div className={cn(glassInsetClass, "col-span-2 p-3 xl:col-span-1")}>
            <SurveyViewField label="Owner Name" value={survey.ownerName} />
          </div>
        </div>
      </header>

      {locked ? (
        <div className="rounded-xl border border-emerald-300/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-500/10 dark:text-emerald-200">
          This survey is QC approved and locked. Use <strong>Reopen for Review</strong> if corrections are required.
          Surveyor: <strong>{survey.surveyor}</strong>
        </div>
      ) : null}
    </div>
  )
}
