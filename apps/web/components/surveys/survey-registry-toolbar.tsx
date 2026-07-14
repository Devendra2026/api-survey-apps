"use client"

import { Button } from "@workspace/ui/components/button"
import { Download, Loader2, Upload, UserRoundPen } from "lucide-react"
import { useRef } from "react"

export function SurveyRegistryToolbar({
  onExport,
  onImportFile,
  onReassign,
  exportDisabled,
  importPending,
  canImport,
  canReassign,
}: {
  onExport: () => void
  onImportFile: (file: File) => void
  onReassign: () => void
  exportDisabled?: boolean
  importPending?: boolean
  canImport?: boolean
  canReassign?: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer border-slate-200 dark:border-slate-800"
        disabled={exportDisabled}
        onClick={onExport}
      >
        <Download className="size-3.5" />
        Export Excel
      </Button>

      {canImport ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImportFile(file)
              e.target.value = ""
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer border-slate-200 dark:border-slate-800"
            disabled={importPending}
            onClick={() => fileRef.current?.click()}
          >
            {importPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Import Excel
          </Button>
        </>
      ) : null}

      {canReassign ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer border-slate-200 dark:border-slate-800"
          onClick={onReassign}
        >
          <UserRoundPen className="size-3.5" />
          Reassign Drafts
        </Button>
      ) : null}
    </div>
  )
}
