import { Text } from "@/components/ui"
import type { StepId, StepProgress, SurveySnapshot } from "../lib/requirements"
import { STEP_TITLES } from "../lib/requirements"
import {
  ASSESSMENT_YEARS,
  OWNERSHIP_TYPES,
  PROPERTY_TYPES,
  PROPERTY_USES,
  ROAD_TYPES,
  SANITATION_TYPES,
  SITUATIONS,
  SOURCES_OF_WATER,
  TAX_RATE_ZONES,
  WATER_CONNECTIONS,
  type DecimalWire,
  type SurveyEditableFields,
  type SurveyPatch,
  type SurveyRecord,
} from "../types"
import { CoOwnersEditor, FloorsEditor } from "./ChildEditors"
import { GpsStep } from "./GpsStep"
import { PhotosStep } from "./PhotosStep"
import { BoundNumberField, BoundTextField, OptionChips, SectionCard, YesNoChips } from "./primitives"

type TextKey =
  | "parcelNumber"
  | "unitSubNo"
  | "propertyIdOld"
  | "respondentName"
  | "relationshipWithOwner"
  | "mobileNumber"
  | "alternateMobile"
  | "houseDoorNo"
  | "locality"
  | "colony"
  | "city"
  | "pinCode"

function toNumber(value: DecimalWire): number | null {
  if (value === null) return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

type Props = {
  step: StepId
  record: SurveyRecord
  fields: SurveyEditableFields
  snapshot: SurveySnapshot
  progress: StepProgress
  editable: boolean
  setFields: (patch: SurveyPatch, options?: { immediate?: boolean }) => void
}

export function SurveyStepBody({ step, record, fields, snapshot, progress, editable, setFields }: Props) {
  const setText = (key: TextKey, text: string) => {
    const patch: SurveyPatch = {}
    const trimmed = text.trim()
    patch[key] = trimmed === "" ? null : trimmed
    setFields(patch)
  }
  const text = (key: TextKey, label: string, extra?: { keyboard?: "phone-pad" | "number-pad"; max?: number; caps?: "words" | "characters" }) => (
    <BoundTextField
      label={label}
      value={fields[key]}
      editable={editable}
      keyboardType={extra?.keyboard}
      maxLength={extra?.max}
      autoCapitalize={extra?.caps ?? "none"}
      onCommit={(t) => setText(key, t)}
    />
  )

  switch (step) {
    case "start":
      return (
        <SectionCard title={STEP_TITLES.start} progress={progress}>
          <Field label="Ward" value={snapshot.wardLabel ?? "—"} />
          <Field label="ULB" value={record.ulb?.name ?? "—"} />
          <BoundTextField
            label="Property ID"
            required
            value={fields.propertyId}
            editable={editable}
            autoCapitalize="characters"
            maxLength={100}
            error={fields.propertyId.trim() === "" ? "Property ID required" : undefined}
            onCommit={(t) => {
              const trimmed = t.trim()
              if (trimmed) setFields({ propertyId: trimmed })
            }}
          />
          {fields.propertyId.startsWith("TEMP-") ? (
            <Text variant="caption" tone="secondary">
              A formula Property ID is assigned automatically once ward, parcel, unit and property use are filled.
            </Text>
          ) : null}
        </SectionCard>
      )
    case "property":
      return (
        <SectionCard title={STEP_TITLES.property} progress={progress}>
          {text("parcelNumber", "Parcel number")}
          {text("unitSubNo", "Unit / Sub no.")}
          {text("propertyIdOld", "Old property ID", { caps: "characters" })}
          <OptionChips
            label="Ownership type"
            required
            options={OWNERSHIP_TYPES}
            value={fields.ownershipType}
            disabled={!editable}
            onChange={(v) => setFields({ ownershipType: v })}
          />
          <OptionChips
            label="Property use"
            required
            options={PROPERTY_USES}
            value={fields.propertyUse}
            disabled={!editable}
            onChange={(v) => setFields({ propertyUse: v })}
          />
          <OptionChips
            label="Property type"
            required
            options={PROPERTY_TYPES}
            value={fields.propertyType}
            disabled={!editable}
            onChange={(v) => setFields({ propertyType: v })}
          />
        </SectionCard>
      )
    case "owner":
      return (
        <SectionCard title={STEP_TITLES.owner} progress={progress}>
          {text("respondentName", "Owner / Respondent name", { caps: "words" })}
          {text("relationshipWithOwner", "Relationship with owner", { caps: "words" })}
          {text("mobileNumber", "Mobile number", { keyboard: "phone-pad", max: 15 })}
          {text("alternateMobile", "Alternate mobile", { keyboard: "phone-pad", max: 15 })}
          <BoundNumberField
            label="Family size"
            integer
            value={fields.familySize}
            editable={editable}
            onCommit={(v) => setFields({ familySize: v })}
          />
          <CoOwnersEditor
            surveyId={record.id}
            coOwners={record.coOwners}
            editable={editable}
            required={fields.ownershipType === "JOINT"}
          />
        </SectionCard>
      )
    case "address":
      return (
        <SectionCard title={STEP_TITLES.address} progress={progress}>
          {text("houseDoorNo", "House / Door no.")}
          {text("locality", "Locality", { caps: "words" })}
          {text("colony", "Colony", { caps: "words" })}
          {text("city", "City", { caps: "words" })}
          {text("pinCode", "PIN code", { keyboard: "number-pad", max: 6 })}
        </SectionCard>
      )
    case "taxation":
      return (
        <SectionCard title={STEP_TITLES.taxation} progress={progress}>
          <OptionChips
            label="Situation"
            options={SITUATIONS}
            value={fields.situation}
            disabled={!editable}
            onChange={(v) => setFields({ situation: v })}
          />
          <OptionChips
            label="Road type"
            options={ROAD_TYPES}
            value={fields.roadType}
            disabled={!editable}
            onChange={(v) => setFields({ roadType: v })}
          />
          <OptionChips
            label="Road width (tax rate zone)"
            options={TAX_RATE_ZONES}
            value={fields.taxRateZone}
            disabled={!editable}
            onChange={(v) => setFields({ taxRateZone: v })}
          />
          <OptionChips
            label="Assessment year"
            required
            options={ASSESSMENT_YEARS}
            value={fields.assessmentYear}
            disabled={!editable}
            onChange={(v) => {
              if (v) setFields({ assessmentYear: v })
            }}
          />
        </SectionCard>
      )
    case "area":
      return (
        <SectionCard title={STEP_TITLES.area} progress={progress}>
          <BoundNumberField
            label="Plot area (sq ft)"
            value={toNumber(fields.plotAreaSqFt)}
            editable={editable}
            onCommit={(v) => setFields({ plotAreaSqFt: v })}
          />
          <BoundNumberField
            label="Plinth area (sq ft)"
            value={toNumber(fields.plinthAreaSqFt)}
            editable={editable}
            onCommit={(v) => setFields({ plinthAreaSqFt: v })}
          />
          <FloorsEditor surveyId={record.id} floors={record.floors} editable={editable} />
        </SectionCard>
      )
    case "services":
      return (
        <SectionCard title={STEP_TITLES.services} progress={progress}>
          <OptionChips
            label="Water connection"
            options={WATER_CONNECTIONS}
            value={fields.waterConnection}
            disabled={!editable}
            onChange={(v) => setFields({ waterConnection: v })}
          />
          <OptionChips
            label="Source of water"
            options={SOURCES_OF_WATER}
            value={fields.sourceOfWater}
            disabled={!editable}
            onChange={(v) => setFields({ sourceOfWater: v })}
          />
          <OptionChips
            label="Sanitation"
            options={SANITATION_TYPES}
            value={fields.sanitationType}
            disabled={!editable}
            onChange={(v) => setFields({ sanitationType: v })}
          />
          <YesNoChips
            label="Solid waste collection"
            value={fields.solidWasteCollection}
            disabled={!editable}
            onChange={(v) => setFields({ solidWasteCollection: v })}
          />
        </SectionCard>
      )
    case "gps":
      return (
        <SectionCard title={STEP_TITLES.gps} progress={progress}>
          <GpsStep fields={fields} editable={editable} onCapture={(patch) => setFields(patch, { immediate: true })} />
        </SectionCard>
      )
    case "photos":
      return (
        <SectionCard title={STEP_TITLES.photos} progress={progress}>
          <PhotosStep surveyId={record.id} photos={record.photos} editable={editable} />
        </SectionCard>
      )
    default: {
      const exhaustive: never = step
      return exhaustive
    }
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </>
  )
}
