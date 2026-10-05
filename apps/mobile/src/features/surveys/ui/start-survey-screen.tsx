import { getApiErrorMessage } from "@/services/api/client"
import { createSurvey, patchSurveyLocation } from "@/services/api/surveys"
import type { AuthenticatedProfile } from "@/types/user"
import { randomUUID } from "expo-crypto"
import { useMemo, useRef, useState } from "react"
import { useDistrictUlbs, useUlbPinCodes } from "../hooks/queries"
import { temporaryPropertyId } from "../lib/assignments"
import { defaultAssessmentYear, optionLabel } from "../lib/labels"
import { overallCompletionPercent } from "../lib/navigation"
import { stepProgress, type StepId, type SurveySnapshot } from "../lib/requirements"
import { ASSESSMENT_YEARS, type AssessmentYear, type SurveyEditableFields, type SurveyRecord } from "../types"
import { buildDistrictOptions, buildPinOptions, buildUlbChoices, type UlbChoice } from "./start-survey-options"
import { StartSurveyView } from "./start-survey-view"

type CreateProps = {
  mode: "create"
  profile: AuthenticatedProfile
  onBack: () => void
  onCreated: (id: string, step: StepId) => void
}

type EditProps = {
  mode: "edit"
  profile: AuthenticatedProfile
  record: SurveyRecord
  completionPercent: number
  editable: boolean
  onBack: () => void
  onLeave: (record: SurveyRecord, step: StepId) => void
  onNewSurvey: () => void
}

type Props = CreateProps | EditProps

const EMPTY_FIELDS: SurveyEditableFields = {
  propertyId: "",
  parcelNumber: null,
  unitSubNo: null,
  propertyIdOld: null,
  respondentName: null,
  relationshipWithOwner: null,
  mobileNumber: null,
  alternateMobile: null,
  familySize: null,
  houseDoorNo: null,
  locality: null,
  colony: null,
  city: null,
  pinCode: null,
  ownershipType: null,
  propertyUse: null,
  propertyType: null,
  situation: null,
  roadType: null,
  taxRateZone: null,
  assessmentYear: "AY_2026_2027",
  plotAreaSqFt: null,
  plinthAreaSqFt: null,
  waterConnection: null,
  sourceOfWater: null,
  sanitationType: null,
  solidWasteCollection: null,
  latitude: null,
  longitude: null,
  gpsAccuracyMeters: null,
  capturedAt: null,
}

function draftPercent(year: AssessmentYear, pin: string | null): number {
  const snapshot: SurveySnapshot = {
    ...EMPTY_FIELDS,
    assessmentYear: year,
    wardLabel: null,
    locationPinCode: pin,
    floorCount: 0,
    coOwnerCount: 0,
    uploadedPhotoTypes: [],
  }
  return overallCompletionPercent(stepProgress(snapshot))
}

function labelFor(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? ""
}

function resolvePin(
  chosen: string | null,
  options: readonly { value: string }[],
  loaded: boolean,
): string | null {
  if (!loaded) return chosen
  if (chosen && options.some((option) => option.value === chosen)) return chosen
  if (options.length === 1) return options[0]!.value
  return null
}

/** Shared start-step state for a new draft and an existing survey. */
export function StartSurveyScreen(props: Props) {
  const record = props.mode === "edit" ? props.record : null
  const editable = props.mode === "create" || props.editable
  const [year, setYear] = useState<AssessmentYear>(record?.assessmentYear ?? defaultAssessmentYear(ASSESSMENT_YEARS))
  const [districtId, setDistrictId] = useState<string | null>(record?.districtId ?? null)
  const [ulbId, setUlbId] = useState<string | null>(record?.ulbId ?? null)
  const [pin, setPin] = useState<string | null>(record?.locationPinCode ?? null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const lockRef = useRef(false)
  const districtOptions = useMemo(() => buildDistrictOptions(props.profile, record), [props.profile, record])
  const selectedDistrictId = districtId ?? (districtOptions.length === 1 ? districtOptions[0]!.value : null)
  const ulbsQuery = useDistrictUlbs(selectedDistrictId)
  const ulbChoices = useMemo(
    () => buildUlbChoices({
      profile: props.profile,
      districtId: selectedDistrictId,
      listed: ulbsQuery.data?.items ?? [],
      record,
    }),
    [props.profile, selectedDistrictId, ulbsQuery.data, record],
  )
  const selectedUlbId = ulbChoices.some((choice) => choice.id === ulbId)
    ? ulbId
    : ulbChoices.length === 1
      ? ulbChoices[0]!.id
      : null
  const pinsQuery = useUlbPinCodes(selectedUlbId)
  const ulbOptions = ulbChoices.map((choice) => ({
    value: choice.id,
    label: `${choice.name} · ${choice.typeLabel}`,
  }))
  const pinOptions = useMemo(
    () => buildPinOptions((pinsQuery.data ?? []).map((item) => item.code)),
    [pinsQuery.data],
  )
  const selectedPin = resolvePin(pin, pinOptions, pinsQuery.isSuccess)
  const yearOptions = ASSESSMENT_YEARS.map((value) => ({ value, label: optionLabel(value) }))
  const selectedUlb = ulbChoices.find((choice) => choice.id === selectedUlbId) ?? null
  const catalogError = pinsQuery.isError
    ? getApiErrorMessage(pinsQuery.error, "Could not load PIN codes.")
    : ulbsQuery.isError
      ? getApiErrorMessage(ulbsQuery.error, "Could not load ULBs.")
      : null
  const emptyPinError = selectedUlbId && pinsQuery.isSuccess && (pinsQuery.data ?? []).length === 0
    ? "No PIN codes are registered for this ULB."
    : null
  const canContinue = editable
    && Boolean(selectedDistrictId && selectedUlbId && selectedPin && selectedUlb?.stateId)
    && pinsQuery.isSuccess
    && !pinsQuery.isError
    && pinOptions.some((option) => option.value === selectedPin)
  const completionPercent = props.mode === "edit" ? props.completionPercent : draftPercent(year, selectedPin)

  const resetCreate = () => {
    setYear(defaultAssessmentYear(ASSESSMENT_YEARS))
    setDistrictId(null)
    setUlbId(null)
    setPin(null)
    setActionError(null)
  }

  const persist = async (step: StepId): Promise<void> => {
    if (!canContinue || !selectedDistrictId || !selectedUlbId || !selectedPin || !selectedUlb || lockRef.current) {
      setActionError("Choose district, ULB, and PIN first.")
      return
    }
    lockRef.current = true
    setSaving(true)
    setActionError(null)
    try {
      if (props.mode === "create") {
        const created = await createSurvey({
          stateId: selectedUlb.stateId,
          districtId: selectedDistrictId,
          ulbId: selectedUlbId,
          propertyId: temporaryPropertyId(randomUUID()),
          assessmentYear: year,
          locationPinCode: selectedPin,
        })
        props.onCreated(created.id, step)
        return
      }
      const next = await patchSurveyLocation(props.record.id, {
        stateId: selectedUlb.stateId,
        districtId: selectedDistrictId,
        ulbId: selectedUlbId,
        assessmentYear: year,
        locationPinCode: selectedPin,
      })
      props.onLeave(next, step)
    } catch (error) {
      setActionError(getApiErrorMessage(error, "Could not save the survey. Check your connection and try again."))
    } finally {
      lockRef.current = false
      setSaving(false)
    }
  }

  const selectStep = (step: StepId) => {
    if (step === "start") return
    void persist(step)
  }

  return (
    <StartSurveyView
      completionPercent={completionPercent}
      currentStep="start"
      yearValue={year}
      yearLabel={optionLabel(year)}
      yearOptions={yearOptions}
      districtValue={selectedDistrictId ?? ""}
      districtLabel={labelFor(districtOptions, selectedDistrictId ?? "")}
      districtOptions={districtOptions}
      ulbValue={selectedUlbId ?? ""}
      ulbLabel={labelFor(ulbOptions, selectedUlbId ?? "")}
      ulbOptions={ulbOptions}
      pinValue={selectedPin ?? ""}
      pinLabel={selectedPin ?? ""}
      pinOptions={pinOptions}
      scopeTitle={selectedUlb?.name ?? ""}
      scopeLine={scopeLine(selectedUlb, selectedPin, districtOptions, selectedDistrictId)}
      showScope={Boolean(selectedUlb && selectedPin)}
      error={actionError ?? catalogError ?? emptyPinError}
      saving={saving}
      canContinue={canContinue}
      editable={editable}
      onBack={props.onBack}
      onSelectStep={selectStep}
      onNewSurvey={() => {
        if (props.mode === "create") resetCreate()
        else props.onNewSurvey()
      }}
      onYear={(value) => {
        if (isAssessmentYear(value)) setYear(value)
        setActionError(null)
      }}
      onDistrict={(value) => {
        setDistrictId(value)
        setUlbId(null)
        setPin(null)
        setActionError(null)
      }}
      onUlb={(value) => {
        setUlbId(value)
        setPin(null)
        setActionError(null)
      }}
      onPin={(value) => {
        setPin(value)
        setActionError(null)
      }}
      onSaveDraft={() => void persist("start")}
      onNext={() => void persist("property")}
    />
  )
}

function isAssessmentYear(value: string): value is AssessmentYear {
  return (ASSESSMENT_YEARS as readonly string[]).includes(value)
}

function scopeLine(
  ulb: UlbChoice | null,
  pin: string | null,
  districts: readonly { value: string; label: string }[],
  districtId: string | null,
): string {
  if (!ulb || !pin) return ""
  const district = districts.find((option) => option.value === districtId)?.label ?? ""
  const districtName = district.replace(/\s*\([^)]*\)\s*$/, "")
  return `${pin} · ${ulb.typeLabel} · ${districtName}`
}
