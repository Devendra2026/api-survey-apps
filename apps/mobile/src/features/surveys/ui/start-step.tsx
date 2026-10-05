import { Text, TextField } from "@/components/ui"
import { spacing } from "@/theme"
import { padUlbCode } from "@workspace/validation"
import { useMemo } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useUlbWards } from "../hooks/queries"
import { sortWardsByNumber } from "../lib/ward-order"
import type { SurveyEditableFields, SurveyPatch, SurveyRecord, WardOption } from "../types"
import { AssessmentYearField } from "./assessment-year-field"
import { WardDropdown } from "./ward-dropdown"

type Props = {
  record: SurveyRecord
  fields: SurveyEditableFields
  editable: boolean
  canPickWard: boolean
  propertyIdLabel: string
  propertyIdHint: string
  setFields: (patch: SurveyPatch) => void
}

function wardLabel(ward: Pick<WardOption, "wardNumber" | "wardName" | "kind">): string {
  if (ward.kind === "ZERO") return `ZERO · ${ward.wardName}`
  return `${ward.wardNumber} · ${ward.wardName}`
}

function displayUlbCode(code: string | null | undefined): string {
  return padUlbCode((code ?? "").trim())
}

/**
 * Saved-survey Start step: assessment year, ward, ULB, and the read-only Property ID.
 */
export function StartStep({ record, fields, editable, canPickWard, propertyIdLabel, propertyIdHint, setFields }: Props) {
  const wardsQuery = useUlbWards(canPickWard ? record.ulbId : null)
  const wards = useMemo(() => sortWardsByNumber(wardsQuery.data?.items ?? []), [wardsQuery.data?.items])
  const wardOptions = useMemo(() => {
    const options = wards.map((ward) => ({ value: ward.id, label: wardLabel(ward) }))
    if (fields.wardId && record.ward && !options.some((option) => option.value === fields.wardId)) {
      options.unshift({ value: record.ward.id, label: wardLabel(record.ward) })
    }
    return options
  }, [fields.wardId, record.ward, wards])
  const ulbCode = displayUlbCode(record.ulbCode ?? record.ulb?.code)
  const lockedWard = record.ward ? wardLabel(record.ward) : "Assigned ward"
  return (
    <View style={styles.stack}>
      <AssessmentYearField year={fields.assessmentYear} />
      <TextField label="ULB" value={record.ulb?.name ?? "—"} editable={false} />
      <TextField label="ULB code" value={ulbCode || "ULB code unavailable"} editable={false} />
      {canPickWard ? (
        <View style={styles.wards}>
          <WardDropdown
            options={wardOptions}
            value={fields.wardId || null}
            disabled={!editable || wardOptions.length === 0}
            onChange={(wardId) => setFields({ wardId })}
          />
          {wardsQuery.isPending ? <ActivityIndicator /> : null}
        </View>
      ) : (
        <TextField label="Ward" value={lockedWard} editable={false} />
      )}
      <TextField label="Property ID" value={propertyIdLabel} editable={false} />
      <Text variant="caption" tone="secondary">
        {propertyIdHint}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  wards: { gap: spacing.sm },
})
