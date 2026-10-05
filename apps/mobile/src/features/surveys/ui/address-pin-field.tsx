import { Text } from "@/components/ui"
import { getApiErrorMessage } from "@/services/api/client"
import { useMemo } from "react"
import { useUlbPinCodes } from "../hooks/queries"
import { pinCodeOptions } from "../lib/pin-code-options"
import type { SurveyPatch } from "../types"
import { SurveySelect } from "./SurveySelect"

const EMPTY_PIN_CATALOG = "No PIN codes are registered for this ULB. Ask an administrator to add them."

type Props = {
  ulbId: string
  pinCode: string | null
  editable: boolean
  setFields: (patch: SurveyPatch) => void
}

/**
 * Address PIN picker. Options come from the ULB catalog. Android uses the
 * Jetpack Compose exposed menu via `SurveySelect`.
 */
export function AddressPinField({ ulbId, pinCode, editable, setFields }: Props) {
  const pinQuery = useUlbPinCodes(ulbId)
  const codes = useMemo(() => (pinQuery.data ?? []).map((item) => item.code), [pinQuery.data])
  const options = useMemo(() => pinCodeOptions(codes, pinCode), [codes, pinCode])
  const catalogEmpty = pinQuery.isSuccess && codes.length === 0
  const canChoose = editable && !pinQuery.isPending && !pinQuery.isError && options.length > 0
  return (
    <>
      <SurveySelect
        label="PIN code"
        placeholder="Select PIN code"
        required
        options={options}
        value={pinCode}
        loading={pinQuery.isPending}
        error={pinQuery.isError ? getApiErrorMessage(pinQuery.error, "Could not load PIN codes") : null}
        onRetry={() => {
          void pinQuery.refetch()
        }}
        disabled={!canChoose}
        onChange={(next) => {
          if (next) setFields({ pinCode: next })
        }}
      />
      {catalogEmpty ? (
        <Text variant="caption" tone="secondary">
          {EMPTY_PIN_CATALOG}
        </Text>
      ) : null}
    </>
  )
}
