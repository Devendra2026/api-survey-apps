"use client"

import type { QcCorrectionItemInput } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import {
  isQcCorrectionSection,
  QC_CORRECTION_FIELD_MAX,
  QC_CORRECTION_MAX_ITEMS,
  QC_CORRECTION_NOTE_MAX,
  QC_CORRECTION_REASONS,
  QC_CORRECTION_SECTION_LABELS,
  QC_CORRECTION_SECTIONS,
} from "@workspace/validation"
import { PlusIcon, Trash2Icon } from "lucide-react"

export function emptyCorrectionItem(): QcCorrectionItemInput {
  return { section: "owner", field: "", reason: QC_CORRECTION_REASONS[0], note: "" }
}

/** Trim and drop empty optional strings before sending to the API. */
export function normalizeCorrectionItems(items: QcCorrectionItemInput[]): QcCorrectionItemInput[] {
  return items.map((item) => {
    const field = item.field?.trim()
    const note = item.note?.trim()
    return {
      section: item.section,
      reason: item.reason.trim(),
      ...(field ? { field } : {}),
      ...(note ? { note } : {}),
    }
  })
}

export function QcCorrectionItemsEditor({
  items,
  onChange,
  disabled,
}: {
  items: QcCorrectionItemInput[]
  onChange: (items: QcCorrectionItemInput[]) => void
  disabled?: boolean
}) {
  const update = (index: number, patch: Partial<QcCorrectionItemInput>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Items to correct</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={disabled || items.length >= QC_CORRECTION_MAX_ITEMS}
          onClick={() => onChange([...items, emptyCorrectionItem()])}
        >
          <PlusIcon className="size-4" aria-hidden />
          Add item
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Optional. Add items so the surveyor sees exactly which section and field to fix in the mobile app.
        </p>
      ) : null}
      {items.map((item, index) => (
        <fieldset key={index} className="grid gap-2 rounded-md border p-2 sm:grid-cols-2" disabled={disabled}>
          <legend className="sr-only">Correction item {index + 1}</legend>
          <Select
            value={item.section}
            onValueChange={(value) => {
              if (isQcCorrectionSection(value)) update(index, { section: value })
            }}
          >
            <SelectTrigger className="w-full cursor-pointer" aria-label={`Section for item ${index + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QC_CORRECTION_SECTIONS.map((section) => (
                <SelectItem key={section} value={section} className="cursor-pointer">
                  {QC_CORRECTION_SECTION_LABELS[section]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={item.reason} onValueChange={(value) => update(index, { reason: value })}>
            <SelectTrigger className="w-full cursor-pointer" aria-label={`Reason for item ${index + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QC_CORRECTION_REASONS.map((reason) => (
                <SelectItem key={reason} value={reason} className="cursor-pointer">
                  {reason}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={item.field ?? ""}
            maxLength={QC_CORRECTION_FIELD_MAX}
            onChange={(e) => update(index, { field: e.target.value })}
            placeholder="Field (e.g. Mobile number)"
            aria-label={`Field for item ${index + 1}`}
          />
          <div className="flex gap-2">
            <Input
              value={item.note ?? ""}
              maxLength={QC_CORRECTION_NOTE_MAX}
              onChange={(e) => update(index, { note: e.target.value })}
              placeholder="Instruction (optional)"
              aria-label={`Instruction for item ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 cursor-pointer"
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2Icon className="size-4" aria-hidden />
            </Button>
          </div>
        </fieldset>
      ))}
    </div>
  )
}
