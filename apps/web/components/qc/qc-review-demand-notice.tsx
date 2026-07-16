"use client"

import type { QcSurveyDetail } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

export function QcReviewDemandNotice({
  open,
  onOpenChange,
  survey,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  survey: QcSurveyDetail
}) {
  const printNotice = () => {
    window.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Demand Notice Preview</DialogTitle>
          <DialogDescription>Client-side print mockup for QC demand notice generation.</DialogDescription>
        </DialogHeader>

        <div
          id="qc-demand-notice"
          className="space-y-4 rounded-xl border bg-white p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-50"
        >
          <div className="border-b pb-3 text-center">
            <p className="text-[10px] font-semibold tracking-[0.18em] text-teal-700 uppercase">
              Municipal Demand Notice
            </p>
            <h2 className="mt-1 text-xl font-bold">{survey.ulbName}</h2>
            <p className="text-sm text-muted-foreground">Assessment Year {survey.assessmentYear}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <p>
              <span className="text-muted-foreground">Property ID:</span>{" "}
              <span className="font-mono font-medium">{survey.propertyId}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Owner:</span>{" "}
              <span className="font-medium">{survey.ownerName}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Ward:</span> <span className="font-medium">{survey.wardNo}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Parcel:</span>{" "}
              <span className="font-medium">{survey.parcelNo}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Property Use:</span>{" "}
              <span className="font-medium">{survey.propertyUse}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Built-Up Area:</span>{" "}
              <span className="font-medium">{survey.builtUpArea}</span>
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-900">
            <p className="font-semibold">Address</p>
            <p className="mt-1 text-muted-foreground">
              {[survey.houseDoorNo, survey.colonySociety, survey.localityLandmark, survey.city, survey.pinCode]
                .filter((v) => v && v !== "—")
                .join(", ") || "—"}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            This is a provisional demand notice preview generated from QC-reviewed survey data. Final tax computation
            and official seal apply after finance verification.
          </p>
        </div>

        <DialogFooter className="print:hidden">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            className="cursor-pointer bg-teal-600 text-white hover:bg-teal-700"
            onClick={printNotice}
          >
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
