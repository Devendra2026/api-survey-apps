"use client"

import {
  PIN_DUPLICATE_MESSAGE,
  PIN_EMPTY_MESSAGE,
  PIN_NETWORK_FAILURE_MESSAGE,
  ULB_NOT_FOUND_MESSAGE,
  pinCodeInputError,
} from "@/features/configuration/lib/pin-code-input"
import {
  createUlbPinCode,
  deleteUlbPinCode,
  listUlbPinCodes,
  type UlbPinCodeItem,
} from "@/features/configuration/lib/ulb-pin-codes-api"
import { useDistrict, useUlb } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { useAuthStore } from "@/stores/app-store"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import axios from "axios"
import Link from "next/link"
import { use, useState } from "react"

function formatUlbType(type: string): string {
  if (type === "TOWN_PANCHAYAT") return "Town Panchayat"
  if (type === "MUNICIPAL_COUNCIL") return "Municipal Council"
  return type
}

function isNotFound(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404
}

function isNetworkFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response
}

type RetryAction = { kind: "add"; code: string } | { kind: "remove"; pinCodeId: string }

export default function UlbPinCodesPage({ params }: { params: Promise<{ ulbId: string }> }) {
  const { ulbId } = use(params)
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const canManage = hasPermission("settings:manage")
  const queryClient = useQueryClient()
  const ulbQuery = useUlb(ulbId)
  const districtQuery = useDistrict(ulbQuery.data?.districtId)
  const pinsQuery = useQuery({
    queryKey: ["ulb-pin-codes", ulbId],
    queryFn: () => listUlbPinCodes(ulbId),
    enabled: Boolean(ulbId) && ulbQuery.isSuccess,
  })
  const [draft, setDraft] = useState("")
  const [formError, setFormError] = useState<string | null>(null)
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null)
  const [pending, setPending] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<UlbPinCodeItem | null>(null)
  const pins = pinsQuery.data ?? []

  async function refreshPins(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ["ulb-pin-codes", ulbId] })
  }

  async function runAdd(code: string): Promise<void> {
    setPending(true)
    setFormError(null)
    setRetryAction(null)
    try {
      await createUlbPinCode(ulbId, code)
      setDraft("")
      await refreshPins()
    } catch (error) {
      setFormError(isNetworkFailure(error) ? PIN_NETWORK_FAILURE_MESSAGE : getApiErrorMessage(error))
      if (isNetworkFailure(error)) setRetryAction({ kind: "add", code })
    } finally {
      setPending(false)
    }
  }

  async function runRemove(pinCodeId: string): Promise<void> {
    setPending(true)
    setFormError(null)
    setRetryAction(null)
    setRemoveTarget(null)
    try {
      await deleteUlbPinCode(ulbId, pinCodeId)
      await refreshPins()
    } catch (error) {
      setFormError(isNetworkFailure(error) ? PIN_NETWORK_FAILURE_MESSAGE : getApiErrorMessage(error))
      if (isNetworkFailure(error)) setRetryAction({ kind: "remove", pinCodeId })
    } finally {
      setPending(false)
    }
  }

  function submitAdd(): void {
    const error = pinCodeInputError(draft)
    if (error) {
      setFormError(error)
      setRetryAction(null)
      return
    }
    const code = draft.trim()
    if (pins.some((pin) => pin.code === code)) {
      setFormError(PIN_DUPLICATE_MESSAGE)
      setRetryAction(null)
      return
    }
    void runAdd(code)
  }

  function retry(): void {
    if (!retryAction) return
    if (retryAction.kind === "add") {
      void runAdd(retryAction.code)
      return
    }
    void runRemove(retryAction.pinCodeId)
  }

  if (ulbQuery.isError && isNotFound(ulbQuery.error)) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-6">
        <p className="text-sm">{ULB_NOT_FOUND_MESSAGE}</p>
        <Link href="/configuration/geography" className="text-sm underline">
          Back to Geography
        </Link>
      </div>
    )
  }

  if (ulbQuery.isError) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-3 p-6">
        <Link href="/configuration/geography" className="text-sm underline">
          Back
        </Link>
        <p className="text-sm text-destructive">{getApiErrorMessage(ulbQuery.error)}</p>
        <Button type="button" variant="outline" onClick={() => void ulbQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const ulb = ulbQuery.data
  const districtName = districtQuery.data?.name
  const subtitle =
    ulb && districtName
      ? `${ulb.name}, ${formatUlbType(ulb.type)}, ${districtName}. These codes are the mobile survey-start PIN menu for this ULB.`
      : "These codes are the mobile survey-start PIN menu for this ULB."

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <Link href="/configuration/geography" className="text-sm underline">
        Back
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>PIN codes</CardTitle>
          <CardDescription>{subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pinsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading PIN codes…</p> : null}
          {pinsQuery.isError ? <p className="text-sm text-destructive">{getApiErrorMessage(pinsQuery.error)}</p> : null}
          {pinsQuery.isSuccess && pins.length === 0 ? (
            <p className="text-sm text-muted-foreground">{PIN_EMPTY_MESSAGE}</p>
          ) : null}
          {pins.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {pins.map((pin) => (
                <li key={pin.id} className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm">{pin.code}</span>
                  {canManage ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setRemoveTarget(pin)}>
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {canManage ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                submitAdd()
              }}
            >
              <Label htmlFor="ulb-pin-code">PIN</Label>
              <div className="flex gap-2">
                <Input
                  id="ulb-pin-code"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="6 digits"
                />
                <Button type="submit" disabled={pending}>
                  Add
                </Button>
              </div>
            </form>
          ) : null}
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          {retryAction ? (
            <Button type="button" variant="outline" disabled={pending} onClick={retry}>
              Retry
            </Button>
          ) : null}
        </CardContent>
      </Card>
      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeTarget?.code}?</DialogTitle>
            <DialogDescription>
              This PIN leaves the survey-start menu. Surveys that already saved it keep that value.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !removeTarget}
              onClick={() => {
                if (removeTarget) void runRemove(removeTarget.id)
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
