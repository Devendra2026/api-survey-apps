import type { AuthenticatedProfile } from "@/types/user"
import { surveyAssignments, type SurveyAssignment } from "../lib/assignments"
import { ulbTypeLabel } from "../lib/labels"
import type { UlbListItem } from "@/services/api/surveys"
import type { SurveyRecord } from "../types"
import type { StartOption } from "./start-survey-model"

export type UlbChoice = {
  id: string
  name: string
  typeLabel: string
  districtId: string
  stateId: string
}

function assignmentStateId(assignments: readonly SurveyAssignment[], districtId: string, ulbId: string | null): string | null {
  const byUlb = ulbId ? assignments.find((row) => row.ulbId === ulbId) : undefined
  return byUlb?.stateId ?? assignments.find((row) => row.districtId === districtId)?.stateId ?? null
}

/** Districts the signed-in surveyor may open a draft in. */
export function buildDistrictOptions(profile: AuthenticatedProfile, record: SurveyRecord | null): StartOption[] {
  const options = new Map<string, StartOption>()
  for (const row of surveyAssignments(profile)) {
    if (options.has(row.districtId)) continue
    options.set(row.districtId, {
      value: row.districtId,
      label: `${row.districtName} (${row.stateName})`,
    })
  }
  if (record && !options.has(record.districtId)) {
    const districtName = record.district?.name ?? "District"
    const stateName = record.state?.name ?? "State"
    options.set(record.districtId, { value: record.districtId, label: `${districtName} (${stateName})` })
  }
  return [...options.values()]
}

/** ULBs in the chosen district, limited to the surveyor's assignments. */
export function buildUlbChoices(input: {
  profile: AuthenticatedProfile
  districtId: string | null
  listed: readonly UlbListItem[]
  record: SurveyRecord | null
}): UlbChoice[] {
  if (!input.districtId) return []
  const assignments = surveyAssignments(input.profile).filter((row) => row.districtId === input.districtId)
  const allowed = new Set(assignments.map((row) => row.ulbId))
  const fromApi = input.listed
    .filter((ulb) => ulb.districtId === input.districtId && allowed.has(ulb.id))
    .map((ulb) => ({
      id: ulb.id,
      name: ulb.name,
      typeLabel: ulbTypeLabel(ulb.type),
      districtId: ulb.districtId,
      stateId: assignmentStateId(assignments, input.districtId!, ulb.id) ?? "",
    }))
  const choices = fromApi.length > 0 ? fromApi : assignments.map((row) => ({
    id: row.ulbId,
    name: row.ulbName,
    typeLabel: ulbTypeLabel(row.ulbType),
    districtId: row.districtId,
    stateId: row.stateId,
  }))
  const unique = new Map(choices.map((choice) => [choice.id, choice]))
  if (input.record && input.record.districtId === input.districtId && !unique.has(input.record.ulbId)) {
    unique.set(input.record.ulbId, {
      id: input.record.ulbId,
      name: input.record.ulb?.name ?? "ULB",
      typeLabel: ulbTypeLabel(input.record.ulb?.type),
      districtId: input.record.districtId,
      stateId: input.record.stateId,
    })
  }
  return [...unique.values()]
}

export function buildPinOptions(codes: readonly string[]): StartOption[] {
  return [...new Set(codes.filter((code) => /^\d{6}$/.test(code)))].sort().map((code) => ({
    value: code,
    label: code,
  }))
}
