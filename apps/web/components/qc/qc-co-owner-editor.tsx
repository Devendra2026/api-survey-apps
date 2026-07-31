"use client"

import { glassInsetClass } from "@/components/surveys/survey-view-field"
import type { QcSurveyCoOwnerEditable, SurveyOwnerRow } from "@/lib/api/types"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type CoOwnerForm = {
  name: string
  fatherOrHusbandName: string
  mobile: string
  alternateMobile: string
}

const emptyForm = (): CoOwnerForm => ({
  name: "",
  fatherOrHusbandName: "",
  mobile: "",
  alternateMobile: "",
})

function formFromOwner(owner: QcSurveyCoOwnerEditable): CoOwnerForm {
  return {
    name: owner.name,
    fatherOrHusbandName: owner.fatherOrHusbandName ?? "",
    mobile: owner.mobile ?? "",
    alternateMobile: owner.alternateMobile ?? "",
  }
}

function ownerKey(owner: QcSurveyCoOwnerEditable, index: number) {
  return owner.id ?? `new-${index}`
}

export function QcCoOwnerEditor({
  editMode,
  displayOwners,
  editableOwners,
  onChange,
}: {
  editMode: boolean
  displayOwners: SurveyOwnerRow[]
  editableOwners: QcSurveyCoOwnerEditable[]
  onChange: (next: QcSurveyCoOwnerEditable[]) => void
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<CoOwnerForm>(emptyForm)

  const startAdd = () => {
    setEditingIndex(null)
    setAdding(true)
    setForm(emptyForm())
  }

  const startEdit = (index: number, owner: QcSurveyCoOwnerEditable) => {
    setAdding(false)
    setEditingIndex(index)
    setForm(formFromOwner(owner))
  }

  const cancel = () => {
    setAdding(false)
    setEditingIndex(null)
    setForm(emptyForm())
  }

  const save = () => {
    const name = form.name.trim()
    if (!name) {
      toast.error("Co-owner name is required")
      return
    }
    const nextOwner: QcSurveyCoOwnerEditable = {
      ...(editingIndex != null ? editableOwners[editingIndex] : {}),
      name,
      fatherOrHusbandName: form.fatherOrHusbandName.trim() || null,
      mobile: form.mobile.trim() || null,
      alternateMobile: form.alternateMobile.trim() || null,
    }
    if (adding) {
      onChange([...editableOwners, nextOwner])
    } else if (editingIndex != null) {
      onChange(editableOwners.map((o, i) => (i === editingIndex ? nextOwner : o)))
    }
    cancel()
  }

  const remove = (index: number) => {
    onChange(editableOwners.filter((_, i) => i !== index))
    if (editingIndex === index) cancel()
    else if (editingIndex != null && editingIndex > index) setEditingIndex(editingIndex - 1)
  }

  if (!editMode) {
    return (
      <div className="overflow-x-auto rounded-xl border border-white/30 dark:border-white/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Father/Husband</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Alt Mobile</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayOwners.length ? (
              displayOwners.map((row, i) => (
                <TableRow key={`${row.propertyId}-${row.name}-${i}`}>
                  <TableCell className="font-mono text-xs">{row.propertyId}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.fatherHusband}</TableCell>
                  <TableCell>{row.mobile}</TableCell>
                  <TableCell>{row.altMobile}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No co-owner records.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-white/30 dark:border-white/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Father/Husband</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Alt Mobile</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editableOwners.length ? (
              editableOwners.map((owner, index) => (
                <TableRow key={ownerKey(owner, index)}>
                  <TableCell>{owner.name}</TableCell>
                  <TableCell>{owner.fatherOrHusbandName || "—"}</TableCell>
                  <TableCell>{owner.mobile || "—"}</TableCell>
                  <TableCell>{owner.alternateMobile || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={() => startEdit(index, owner)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="cursor-pointer"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No co-owner records.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!adding && editingIndex == null ? (
        <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={startAdd}>
          <Plus className="size-3.5" />
          Add Co-owner
        </Button>
      ) : (
        <div className={cn(glassInsetClass, "space-y-3 p-4")}>
          <p className="text-sm font-medium">{adding ? "Add Co-owner" : "Edit Co-owner"}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Name</p>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Father / Husband</p>
              <Input
                value={form.fatherOrHusbandName}
                onChange={(e) => setForm((f) => ({ ...f, fatherOrHusbandName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Mobile</p>
              <Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase">Alt Mobile</p>
              <Input
                value={form.alternateMobile}
                onChange={(e) => setForm((f) => ({ ...f, alternateMobile: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="cursor-pointer" onClick={save}>
              Save co-owner
            </Button>
            <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
