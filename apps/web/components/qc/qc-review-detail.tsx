"use client"

import { QcReviewActionBar } from "@/components/qc/qc-review-action-bar"
import { QcReviewSections } from "@/components/qc/qc-review-sections"
import { EmptyState } from "@/components/shared/page-elements"
import { SurveyViewSkeleton } from "@/components/surveys/survey-view-skeleton"
import {
  useQcQueueNeighbors,
  useQcSurveyActions,
  useQcSurveyAuditHistory,
  useQcSurveyDetail,
  useWards,
} from "@/hooks/use-api"
import { apiGet, getApiErrorMessage } from "@/lib/api/client"
import type { QcQueueParcel, QcSurveyDetail, QcSurveyEditable } from "@/lib/api/types"
import { useAuthStore } from "@/stores/app-store"
import { useQcWorkingContext } from "@/stores/qc-working-context"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

export function QcReviewDetail({ surveyId }: { surveyId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canApprove = hasPermission("survey:approve")
  const canDelete = hasPermission("survey:delete")

  const activeWardId = useQcWorkingContext((s) => s.activeWardId)
  const activeUlbId = useQcWorkingContext((s) => s.activeUlbId)
  const setActiveWard = useQcWorkingContext((s) => s.setActiveWard)

  const detailQuery = useQcSurveyDetail(surveyId, Boolean(canApprove))
  const auditQuery = useQcSurveyAuditHistory(surveyId, Boolean(canApprove) && Boolean(surveyId))
  const actions = useQcSurveyActions()

  const survey = detailQuery.data
  const effectiveWardId = activeWardId || survey?.editable.wardId || null
  const neighborsQuery = useQcQueueNeighbors(effectiveWardId, survey?.id, Boolean(canApprove) && Boolean(survey?.id))

  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<QcSurveyEditable | null>(() => survey?.editable ?? null)
  const [draftSurveyId, setDraftSurveyId] = useState<string | null>(() => survey?.id ?? null)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [wardSwitchId, setWardSwitchId] = useState<string | null>(null)
  const [wardSwitchPending, setWardSwitchPending] = useState(false)

  const switchUlbId = activeUlbId || survey?.editable.ulbId
  const { data: switchWards } = useWards(wardSwitchId ? switchUlbId || undefined : undefined)

  // Sync draft when survey loads or the URL/id changes (including prefetched cache hits).
  if (survey?.editable && (draft === null || draftSurveyId !== survey.id)) {
    setDraft(survey.editable)
    setDraftSurveyId(survey.id)
    if (editMode) setEditMode(false)
  } else if (!survey && draftSurveyId !== null) {
    setDraft(null)
    setDraftSurveyId(null)
    if (editMode) setEditMode(false)
  }

  // Seed working context from the loaded survey when empty.
  useEffect(() => {
    if (!survey?.editable.wardId || !survey.editable.ulbId) return
    if (activeWardId) return
    setActiveWard({ wardId: survey.editable.wardId, ulbId: survey.editable.ulbId })
  }, [survey?.editable.wardId, survey?.editable.ulbId, activeWardId, setActiveWard])

  // Keep draft floors in sync when floor CRUD refreshes QC detail during edit.
  useEffect(() => {
    if (!editMode || !survey?.editable) return
    const nextFloors = survey.editable.floors
    setDraft((prev) => {
      if (!prev) return prev
      const same =
        prev.floors.length === nextFloors.length &&
        prev.floors.every((f, i) => {
          const n = nextFloors[i]
          return (
            n &&
            f.id === n.id &&
            f.floorPosition === n.floorPosition &&
            f.usageType === n.usageType &&
            f.usageFactor === n.usageFactor &&
            f.constructionType === n.constructionType &&
            f.areaSqFt === n.areaSqFt
          )
        })
      return same ? prev : { ...prev, floors: nextFloors }
    })
  }, [editMode, survey?.editable.floors, survey?.id])

  // Bookmark compat: old /qc/review/{propertyId} links redirect to stable survey UUID.
  useEffect(() => {
    if (!survey?.id) return
    if (survey.id === surveyId) return
    router.replace(`/qc/review/${encodeURIComponent(survey.id)}`)
  }, [router, survey?.id, surveyId])

  const goToNeighbor = (id: string | null | undefined) => {
    if (!id) return
    router.push(`/qc/review/${encodeURIComponent(id)}`)
  }

  const advanceAfterComplete = async () => {
    const nextId = neighborsQuery.data?.nextId
    if (nextId) {
      goToNeighbor(nextId)
      return
    }
    toast.message("No more pending parcels in this ward")
    router.push("/qc/registry")
  }

  const confirmWardSwitch = async () => {
    if (!wardSwitchId || !switchUlbId) return
    setWardSwitchPending(true)
    try {
      const target = (switchWards?.items ?? []).find((w) => w.id === wardSwitchId)
      const ulbId = switchUlbId
      setActiveWard({ wardId: wardSwitchId, ulbId })
      const first = await apiGet<QcQueueParcel | null>(`/qc/queue/first?wardId=${encodeURIComponent(wardSwitchId)}`)
      setWardSwitchId(null)
      if (first?.id) {
        router.push(`/qc/review/${encodeURIComponent(first.id)}`)
      } else {
        toast.message(`No pending parcels in ${target ? "the selected ward" : "this ward"}`)
        router.push("/qc/registry")
      }
      void queryClient.invalidateQueries({ queryKey: ["qc", "queue"] })
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    } finally {
      setWardSwitchPending(false)
    }
  }

  if (!canApprove) {
    return (
      <EmptyState
        title="QC Review unavailable"
        description="You need survey approval permission to review and correct surveys."
      />
    )
  }

  if (detailQuery.isLoading || (survey && !draft)) {
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
    actions.remove.isPending ||
    actions.correct.isPending ||
    wardSwitchPending

  const startEdit = () => {
    setDraft(survey.editable)
    setEditMode(true)
  }

  const cancelEdit = () => {
    setDraft(survey.editable)
    setEditMode(false)
  }

  const saveCorrection = async () => {
    try {
      const updated = await actions.correct.mutateAsync({
        id: survey.id,
        patch: {
          stateId: draft.stateId,
          districtId: draft.districtId,
          ulbId: draft.ulbId,
          wardId: draft.wardId,
          assignedToId: draft.assignedToId,
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
          sectorNo: draft.sectorNo,
          unitSubNo: draft.unitSubNo,
          parcelNumber: draft.parcelNumber,
          propertyIdOld: draft.propertyIdOld,
          constructedYear: draft.constructedYear,
          isSlum: draft.isSlum,
          ownershipType: draft.ownershipType,
          propertyUse: draft.propertyUse,
          propertyType: draft.propertyType,
          situation: draft.situation,
          roadType: draft.roadType,
          taxRateZone: draft.taxRateZone,
          assessmentYear: draft.assessmentYear,
          plotAreaSqFt: draft.plotAreaSqFt,
          plinthAreaSqFt: draft.plinthAreaSqFt,
          waterConnection: draft.waterConnection,
          sourceOfWater: draft.sourceOfWater,
          sanitationType: draft.sanitationType,
          solidWasteCollection: draft.solidWasteCollection,
          electricityConsumerNo: draft.electricityConsumerNo,
          latitude: draft.latitude,
          longitude: draft.longitude,
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
      if (updated && typeof updated === "object" && "id" in updated && "editable" in updated) {
        const detail = updated as QcSurveyDetail
        queryClient.setQueryData(["qc", "survey", survey.id], detail)
        setDraft(detail.editable)
        setDraftSurveyId(detail.id)
      }
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
        canDelete={canDelete}
        activeWardId={effectiveWardId}
        activeUlbId={activeUlbId || survey.editable.ulbId}
        prevId={neighborsQuery.data?.prevId ?? null}
        nextId={neighborsQuery.data?.nextId ?? null}
        onActiveWardChange={(wardId) => {
          if (wardId === effectiveWardId) return
          setWardSwitchId(wardId)
        }}
        onPrev={() => goToNeighbor(neighborsQuery.data?.prevId)}
        onNext={() => goToNeighbor(neighborsQuery.data?.nextId)}
        onReopen={() => setReopenOpen(true)}
        onApprove={async () => {
          try {
            await actions.approve.mutateAsync(survey.id)
            toast.success("Survey approved")
            await advanceAfterComplete()
          } catch (error) {
            toast.error(getApiErrorMessage(error))
          }
        }}
        onDelete={() => setDeleteOpen(true)}
        onEdit={startEdit}
        onSave={() => void saveCorrection()}
        onCancel={cancelEdit}
      />

      <QcReviewSections
        survey={survey}
        audits={auditQuery.data ?? []}
        editMode={editMode}
        draft={draft}
        onDraftChange={setDraft}
      />

      <Dialog open={Boolean(wardSwitchId)} onOpenChange={(open) => !open && setWardSwitchId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch active ward</DialogTitle>
            <DialogDescription>
              Switching ward will redirect to the first parcel of the selected ward. Proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={wardSwitchPending}
              onClick={() => setWardSwitchId(null)}
            >
              Cancel
            </Button>
            <Button className="cursor-pointer" disabled={wardSwitchPending} onClick={() => void confirmWardSwitch()}>
              {wardSwitchPending ? "Switching…" : "Proceed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
