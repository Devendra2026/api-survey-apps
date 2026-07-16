import type { SurveyDetailsDto } from "../surveys/dto/survey-view.dto.js"

type DecimalLike = { toString(): string } | number | string | null | undefined

function toNumber(value: DecimalLike): number | null {
  if (value == null) return null
  const n = Number(value.toString())
  return Number.isNaN(n) ? null : n
}

export type QcSurveyFloorEditable = {
  id: string
  floorPosition: string
  usageType: string | null
  usageFactor: string | null
  constructionType: string | null
  areaSqFt: number | null
  position: number
}

export type QcSurveyEditable = {
  respondentName: string | null
  mobileNumber: string | null
  alternateMobile: string | null
  relationshipWithOwner: string | null
  familySize: number | null
  houseDoorNo: string | null
  colony: string | null
  locality: string | null
  city: string | null
  pinCode: string | null
  ownershipType: string | null
  propertyUse: string | null
  propertyType: string | null
  situation: string | null
  roadType: string | null
  taxRateZone: string | null
  assessmentYear: string
  floors: QcSurveyFloorEditable[]
}

export type QcSurveyDetailDto = SurveyDetailsDto & {
  editable: QcSurveyEditable
}

type SurveyForEditable = {
  respondentName: string | null
  mobileNumber: string | null
  alternateMobile: string | null
  relationshipWithOwner: string | null
  familySize: number | null
  houseDoorNo: string | null
  colony: string | null
  locality: string | null
  city: string | null
  pinCode: string | null
  ownershipType: string | null
  propertyUse: string | null
  propertyType: string | null
  situation: string | null
  roadType: string | null
  taxRateZone: string | null
  assessmentYear: string
  floors?: Array<{
    id: string
    floorPosition: string
    usageType: string | null
    usageFactor: string | null
    constructionType: string | null
    areaSqFt: DecimalLike
    position: number
  }>
}

export function mapQcEditable(survey: SurveyForEditable): QcSurveyEditable {
  const floors = [...(survey.floors ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((floor) => ({
      id: floor.id,
      floorPosition: floor.floorPosition,
      usageType: floor.usageType,
      usageFactor: floor.usageFactor,
      constructionType: floor.constructionType,
      areaSqFt: toNumber(floor.areaSqFt),
      position: floor.position,
    }))

  return {
    respondentName: survey.respondentName,
    mobileNumber: survey.mobileNumber,
    alternateMobile: survey.alternateMobile,
    relationshipWithOwner: survey.relationshipWithOwner,
    familySize: survey.familySize,
    houseDoorNo: survey.houseDoorNo,
    colony: survey.colony,
    locality: survey.locality,
    city: survey.city,
    pinCode: survey.pinCode,
    ownershipType: survey.ownershipType,
    propertyUse: survey.propertyUse,
    propertyType: survey.propertyType,
    situation: survey.situation,
    roadType: survey.roadType,
    taxRateZone: survey.taxRateZone,
    assessmentYear: survey.assessmentYear,
    floors,
  }
}
