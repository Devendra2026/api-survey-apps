"use client"

import { useReassignDraftsMutation, useRegistryDraftSources, useUsers } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { Button } from "@workspace/ui/components/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Label } from "@workspace/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowRightLeft, Check, ChevronsUpDown } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

function SurveyorSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyText,
  disabled,
}: {
  value?: string
  onChange: (id: string) => void
  options: Array<{ id: string; fullName: string; draftCount?: number }>
  placeholder: string
  emptyText: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="h-10 w-full cursor-pointer justify-between border-slate-200 font-normal dark:border-slate-800"
        >
          <span className="truncate">{selected ? selected.fullName : placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search surveyor..." />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.fullName} ${option.id}`}
                  onSelect={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === option.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{option.fullName}</span>
                  {typeof option.draftCount === "number" ? (
                    <span className="text-xs text-muted-foreground">{option.draftCount}</span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ReassignDraftsDialog({
  open,
  onOpenChange,
  districtId,
  ulbId,
  wardId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  districtId?: string
  ulbId?: string
  wardId?: string
}) {
  const [mode, setMode] = useState<"from" | "orphaned">("from")
  const [fromSurveyorId, setFromSurveyorId] = useState<string>()
  const [toSurveyorId, setToSurveyorId] = useState<string>()

  const canViewUsers = useAuthStore((s) => s.hasPermission("user:view"))
  const sourcesQuery = useRegistryDraftSources(
    { districtId, ulbId, wardId, orphaned: mode === "orphaned" },
    open && mode === "from"
  )
  const { data: users } = useUsers(canViewUsers && open ? { limit: 100 } : {})
  const mutation = useReassignDraftsMutation()

  const fromOptions = sourcesQuery.data ?? []
  const toOptions = useMemo(() => (users?.items ?? []).map((u) => ({ id: u.id, fullName: u.fullName })), [users?.items])

  const canTransfer =
    Boolean(toSurveyorId) && (mode === "orphaned" || Boolean(fromSurveyorId)) && fromSurveyorId !== toSurveyorId

  const helperText =
    mode === "from" && !fromOptions.length
      ? "No drafts match the current scope."
      : mode === "orphaned"
        ? "Orphaned drafts have no active surveyor assignment."
        : `${fromOptions.find((o) => o.id === fromSurveyorId)?.draftCount ?? 0} draft(s) will move with this transfer.`

  const reset = () => {
    setMode("from")
    setFromSurveyorId(undefined)
    setToSurveyorId(undefined)
  }

  const onTransfer = async () => {
    if (!toSurveyorId) return
    try {
      const result = await mutation.mutateAsync({
        fromSurveyorId: mode === "from" ? fromSurveyorId : undefined,
        toSurveyorId,
        scopeId: wardId,
        districtId,
        ulbId,
        wardId,
      })
      toast.success(result.message)
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <ArrowRightLeft className="size-4" />
            </span>
            Reassign draft surveys
          </DialogTitle>
          <DialogDescription>
            Move in-progress field data to another surveyor. Prior assignee details stay in the audit log only — the new
            surveyor sees the drafts as their own.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="inline-flex rounded-lg bg-muted p-1">
            <Button
              type="button"
              size="sm"
              variant={mode === "from" ? "default" : "ghost"}
              className={cn("cursor-pointer", mode === "from" && "bg-violet-600 text-white hover:bg-violet-700")}
              onClick={() => {
                setMode("from")
                setFromSurveyorId(undefined)
              }}
            >
              From surveyor
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "orphaned" ? "default" : "ghost"}
              className={cn("cursor-pointer", mode === "orphaned" && "bg-violet-600 text-white hover:bg-violet-700")}
              onClick={() => {
                setMode("orphaned")
                setFromSurveyorId(undefined)
              }}
            >
              Orphaned
            </Button>
          </div>

          {mode === "from" ? (
            <div className="space-y-1.5">
              <Label>From surveyor</Label>
              <SurveyorSelect
                value={fromSurveyorId}
                onChange={setFromSurveyorId}
                options={fromOptions}
                placeholder="No draft surveys in current filters"
                emptyText="No draft surveys in current filters"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>To surveyor</Label>
            <SurveyorSelect
              value={toSurveyorId}
              onChange={setToSurveyorId}
              options={toOptions}
              placeholder="Select target surveyor"
              emptyText="No surveyors available"
              disabled={!canViewUsers}
            />
          </div>

          <p className="text-xs text-muted-foreground">{helperText}</p>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            disabled={!canTransfer || mutation.isPending}
            onClick={() => void onTransfer()}
          >
            Transfer drafts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
