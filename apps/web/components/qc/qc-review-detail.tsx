"use client"

import { QcReviewActionBar } from "@/components/qc/qc-review-action-bar"
import { QcReviewDemandNotice } from "@/components/qc/qc-review-demand-notice"
import { QcReviewSections } from "@/components/qc/qc-review-sections"
import { EmptyState } from "@/components/shared/page-elements"
import { SurveyViewSkeleton } from "@/components/surveys/survey-view-skeleton"
import { useQcSurveyActions, useQcSurveyAuditHistory, useQcSurveyDetail } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import type { QcSurveyEditable } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Textarea } from "@workspace/ui/components/textarea"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function QcReviewDetail({ propertyId }: { propertyId: string }) {
  const router = useRouter()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")

  const detailQuery = useQcSurveyDetail(propertyId, Boolean(canApprove))
  const auditQuery = useQcSurveyAuditHistory(propertyId, Boolean(canApprove) && Boolean(propertyId))
  const actions = useQcSurveyActions()

  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<QcSurveyEditable | null>(null)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [demandOpen, setDemandOpen] = useState(false)
  const [qcRemarks, setQcRemarks] = useState("")

  const survey = detailQuery.data

  useEffect(() => {
    if (survey?.editable) {
      setDraft(survey.editable)
    }
  }, [survey?.editable])

  if (!canApprove) {
    return (
      <EmptyState
        title="QC Review unavailable"
        description="You need survey approval permission to review and correct surveys."
      />
    )
  }

  if (detailQuery.isLoading && !survey) {
    return <SurveyViewSkeleton />
  }

  if (detailQuery.isError || !survey || !draft) {
    return (
      <EmptyState
        title="Survey not found"
        description="This survey may be outside your tenant scope or the identifier is invalid."
      />
    )
  }

  const pending =
    actions.reopen.isPending ||
    actions.approve.isPending ||
    actions.reject.isPending ||
    actions.remove.isPending ||
    actions.correct.isPending

  const toggleEdit = () => {
    if (editMode) {
      setDraft(survey.editable)
      setEditMode(false)
      return
    }
    setDraft(survey.editable)
    setEditMode(true)
  }

  const saveCorrection = async () => {
    try {
      await actions.correct.mutateAsync({
        id: survey.id,
        patch: {
          respondentName: draft.respondentName,
          mobileNumber: draft.mobileNumber,
          alternateMobile: draft.alternateMobile,
          relationshipWithOwner: draft.relationshipWithOwner,
          familySize: draft.familySize,
          houseDoorNo: draft.houseDoorNo,
          colony: draft.colony,
          locality: draft.locality,
          city: draft.city,
          pinCode: draft.pinCode,
          ownershipType: draft.ownershipType,
          propertyUse: draft.propertyUse,
          propertyType: draft.propertyType,
          situation: draft.situation,
          roadType: draft.roadType,
          taxRateZone: draft.taxRateZone,
          assessmentYear: draft.assessmentYear,
          floors: draft.floors.map((f) => ({
            id: f.id,
            floorPosition: f.floorPosition,
            usageType: f.usageType,
            usageFactor: f.usageFactor,
            constructionType: f.constructionType,
            areaSqFt: f.areaSqFt,
          })),
        },
      })
      toast.success("QC corrections saved")
      setEditMode(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 pb-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-[8%] size-80 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-600/15" />
        <div className="absolute top-52 right-[-4%] size-96 rounded-full bg-cyan-300/15 blur-3xl dark:bg-cyan-500/10" />
      </div>

      <QcReviewActionBar
        survey={survey}
        editMode={editMode}
        pending={pending}
        onReopen={() => setReopenOpen(true)}
        onApprove={async () => {
          try {
            await actions.approve.mutateAsync(survey.id)
            toast.success("Survey approved")
          } catch (error) {
            toast.error(getApiErrorMessage(error))
          }
        }}
        onReject={() => setRejectOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        onDemandNotice={() => setDemandOpen(true)}
        onToggleEdit={toggleEdit}
      />

      {editMode ? (
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="cursor-pointer" disabled={pending} onClick={toggleEdit}>
            Cancel
          </Button>
          <Button
            className="cursor-pointer bg-teal-600 text-white hover:bg-teal-700"
            disabled={pending}
            onClick={() => void saveCorrection()}
          >
            Save corrections
          </Button>
        </div>
      ) : null}

      <QcReviewSections
        survey={survey}
        audits={auditQuery.data ?? []}
        editMode={editMode}
        draft={draft}
        onDraftChange={setDraft}
      />

      <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen for Review</DialogTitle>
            <DialogDescription>
              This will move the survey back to Pending QC so corrections can be made. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setReopenOpen(false)}>
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-amber-600 text-white hover:bg-amber-700"
              disabled={actions.reopen.isPending}
              onClick={async () => {
                try {
                  await actions.reopen.mutateAsync(survey.id)
                  toast.success("Survey reopened for QC review")
                  setReopenOpen(false)
                } catch (error) {
                  toast.error(getApiErrorMessage(error))
                }
              }}
            >
              Reopen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return survey</DialogTitle>
            <DialogDescription>QC remarks are required when returning a survey to the field.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={qcRemarks}
            onChange={(e) => setQcRemarks(e.target.value)}
            placeholder="Describe why this survey is being returned…"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={actions.reject.isPending}
              onClick={async () => {
                if (!qcRemarks.trim()) {
                  toast.error("QC remarks are required for returns")
                  return
                }
                try {
                  await actions.reject.mutateAsync({ id: survey.id, qcRemarks: qcRemarks.trim() })
                  toast.success("Survey returned")
                  setRejectOpen(false)
                  setQcRemarks("")
                } catch (error) {
                  toast.error(getApiErrorMessage(error))
                }
              }}
            >
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete survey</DialogTitle>
            <DialogDescription>
              Soft-delete this survey from the QC registry. This action is audited and can be restored by an
              administrator.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={actions.remove.isPending}
              onClick={async () => {
                try {
                  await actions.remove.mutateAsync(survey.id)
                  toast.success("Survey deleted")
                  setDeleteOpen(false)
                  router.push("/qc/registry")
                } catch (error) {
                  toast.error(getApiErrorMessage(error))
                }
              }}
            >
              Delete Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QcReviewDemandNotice open={demandOpen} onOpenChange={setDemandOpen} survey={survey} />
    </div>
  )
}
