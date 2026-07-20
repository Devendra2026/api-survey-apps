"use client"

import { Button } from "@workspace/ui/components/button"
import { motion, useReducedMotion } from "framer-motion"
import { RotateCcw, Save, Undo2 } from "lucide-react"

export function RolesUnsavedBar({
  saving,
  dirty = true,
  onSave,
  onCancel,
  onReset,
}: {
  saving?: boolean
  dirty?: boolean
  onSave: () => void
  onCancel: () => void
  onReset: () => void
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduceMotion ? false : { y: 24, opacity: 0 }}
      animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
      exit={reduceMotion ? undefined : { y: 24, opacity: 0 }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-500/30 bg-background/95 shadow-[0_-12px_40px_rgba(0,0,0,0.1)] backdrop-blur-md md:left-(--sidebar-offset,0px)"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 md:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            {dirty ? "You have unsaved permission changes." : "Edit mode — toggle permissions in the matrix."}
          </p>
          <p className="text-xs text-muted-foreground">
            {dirty
              ? "Save updates the database. Every assignee inherits this role\u2019s permissions."
              : "Cancel to exit without changes. Save appears after you change a checkbox."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={onReset}
            disabled={saving || !dirty}
          >
            <Undo2 className="mr-1.5 size-3.5" aria-hidden />
            Reset
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onCancel} disabled={saving}>
            <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
            Cancel
          </Button>
          <Button type="button" size="sm" className="rounded-xl" onClick={onSave} disabled={saving || !dirty}>
            <Save className="mr-1.5 size-3.5" aria-hidden />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
