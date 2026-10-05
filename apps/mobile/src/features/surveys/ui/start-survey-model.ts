import type { StepId } from "../lib/requirements"

export const SURVEY_HEADER = "#1A4FBF"

export type StartOption = {
  value: string
  label: string
}

export type StartSurveyViewProps = {
  completionPercent: number
  currentStep: StepId
  yearValue: string
  yearLabel: string
  yearOptions: readonly StartOption[]
  districtValue: string
  districtLabel: string
  districtOptions: readonly StartOption[]
  ulbValue: string
  ulbLabel: string
  ulbOptions: readonly StartOption[]
  pinValue: string
  pinLabel: string
  pinOptions: readonly StartOption[]
  scopeTitle: string
  scopeLine: string
  showScope: boolean
  error: string | null
  saving: boolean
  canContinue: boolean
  editable: boolean
  onBack: () => void
  onSelectStep: (step: StepId) => void
  onNewSurvey: () => void
  onYear: (value: string) => void
  onDistrict: (value: string) => void
  onUlb: (value: string) => void
  onPin: (value: string) => void
  onSaveDraft: () => void
  onNext: () => void
}
