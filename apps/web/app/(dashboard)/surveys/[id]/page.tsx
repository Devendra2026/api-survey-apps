"use client"

import { FormField } from "@/components/forms/form-field"
import { EmptyState, LoadingGrid, PageHeader, StatusBadge } from "@/components/shared/page-elements"
import { useSurvey, useSurveyMutations } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import { Textarea } from "@workspace/ui/components/textarea"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function SurveyDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const profile = useAuthStore((s) => s.profile)
  const { data: survey, isLoading, isError, refetch } = useSurvey(params.id)
  const { submit, approve, reject, reopen, remove } = useSurveyMutations()
  const [rejectRemarks, setRejectRemarks] = useState("")

  if (isLoading) return <LoadingGrid count={2} />
  if (isError || !survey) {
    return <EmptyState title="Survey not found" description="This survey may be outside your tenant scope." />
  }

  const status = survey.surveyStatus as string
  const isCreator = profile?.id === (survey.createdBy as { id: string } | undefined)?.id
  const canEdit = ["DRAFT", "IN_PROGRESS", "REOPENED"].includes(status) && isCreator
  const canSubmit = canEdit && hasPermission("survey:submit")
  const canApprove = status === "SUBMITTED" && hasPermission("survey:approve") && !isCreator
  const canReject = status === "SUBMITTED" && hasPermission("survey:reject") && !isCreator
  const canReopen = status === "REJECTED" && (isCreator || hasPermission("survey:update"))

  async function runAction(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      toast.success(success)
      void refetch()
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-14 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 md:-mx-6 md:px-6">
        <PageHeader
          title={survey.propertyId}
          description={[survey.locality, survey.ward?.wardName, survey.ulb?.name].filter(Boolean).join(" · ")}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={status} />
              {canSubmit ? (
                <Button
                  size="sm"
                  onClick={() => void runAction(() => submit.mutateAsync(params.id), "Survey submitted")}
                >
                  Submit
                </Button>
              ) : null}
              {canApprove ? (
                <Button
                  size="sm"
                  onClick={() => void runAction(() => approve.mutateAsync(params.id), "Survey approved")}
                >
                  Approve
                </Button>
              ) : null}
              {canReject ? (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Reject
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reject survey</DialogTitle>
                    </DialogHeader>
                    <FormField label="QC remarks" htmlFor="remarks" required>
                      <Textarea
                        id="remarks"
                        value={rejectRemarks}
                        onChange={(e) => setRejectRemarks(e.target.value)}
                        placeholder="Explain what needs correction..."
                      />
                    </FormField>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={!rejectRemarks.trim() || reject.isPending}
                        onClick={() =>
                          void runAction(
                            () =>
                              reject.mutateAsync({
                                id: params.id,
                                qcRemarks: rejectRemarks,
                              }),
                            "Survey rejected"
                          )
                        }
                      >
                        Confirm reject
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ) : null}
              {canReopen ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void runAction(() => reopen.mutateAsync(params.id), "Survey reopened")}
                >
                  Reopen
                </Button>
              ) : null}
              {hasPermission("survey:delete") && status !== "APPROVED" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    void runAction(async () => {
                      await remove.mutateAsync(params.id)
                      router.push("/surveys")
                    }, "Survey deleted")
                  }
                >
                  Delete
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Property</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5 text-sm">
            <Row label="Property ID" value={survey.propertyId} />
            <Row label="Status" value={status} />
            <Row label="Respondent" value={String(survey.respondentName ?? "—")} />
            <Row label="Mobile" value={String(survey.mobileNumber ?? "—")} />
            <Row label="Address" value={[survey.houseDoorNo, survey.locality].filter(Boolean).join(", ") || "—"} />
            <Row label="Ownership" value={String(survey.ownershipType ?? "—")} />
            <Row label="Property use" value={String(survey.propertyUse ?? "—")} />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Workflow</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2.5 text-sm">
            <Row label="Created by" value={(survey.createdBy as { fullName?: string })?.fullName ?? "—"} />
            <Row label="Created" value={new Date(survey.createdAt).toLocaleString()} />
            <Row
              label="Submitted"
              value={survey.submittedAt ? new Date(survey.submittedAt as string).toLocaleString() : "—"}
            />
            <Row
              label="GPS"
              value={
                survey.latitude != null && survey.longitude != null
                  ? `${survey.latitude}, ${survey.longitude}`
                  : "Not captured"
              }
            />
            <Row label="Floors" value={String((survey.floors as unknown[] | undefined)?.length ?? 0)} />
            <Row label="Photos" value={String((survey.photos as unknown[] | undefined)?.length ?? 0)} />
            {survey.qcRemarks ? <Row label="QC remarks" value={String(survey.qcRemarks)} /> : null}
          </CardContent>
        </Card>
      </div>

      {!canEdit && status === "APPROVED" ? (
        <p className="text-sm text-muted-foreground">Approved surveys are read-only.</p>
      ) : null}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
