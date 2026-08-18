import type { FloorUsageWarning } from "../floors/floor-usage-warnings.util.js"
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

export type QcSurveyCoOwnerEditable = {
  id?: string
  name: string
  fatherOrHusbandName: string | null
  mobile: string | null
  alternateMobile: string | null
}

export type QcSurveyEditable = {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  assignedToId: string | null
  respondentName: string | null
  mobileNumber: string | null
  alternateMobile: string | null
  relationshipWithOwner: string | null
  familySize: number | null
  fatherHusbandName: string | null
  houseDoorNo: string | null
  colony: string | null
  locality: string | null
  city: string | null
  pinCode: string | null
  sectorNo: string | null
  unitSubNo: string | null
  parcelNumber: string | null
  propertyIdOld: string | null
  constructedYear: number | null
  isSlum: boolean
  ownershipType: string | null
  propertyUse: string | null
  propertyType: string | null
  situation: string | null
  roadType: string | null
  taxRateZone: string | null
  assessmentYear: string
  plotAreaSqFt: number | null
  plinthAreaSqFt: number | null
  waterConnection: string | null
  sourceOfWater: string | null
  sanitationType: string | null
  solidWasteCollection: boolean | null
  electricityConsumerNo: string | null
  latitude: number | null
  longitude: number | null
  floors: QcSurveyFloorEditable[]
  coOwners: QcSurveyCoOwnerEditable[]
}

export type QcSurveyDetailDto = SurveyDetailsDto & {
  editable: QcSurveyEditable
  stateName?: string
  warnings: FloorUsageWarning[]
}

type SurveyForEditable = {
  stateId: string
  districtId: string
  ulbId: string
  wardId: string
  assignedToId: string | null
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
  sectorNo: string | null
  unitSubNo: string | null
  parcelNumber: string | null
  propertyIdOld: string | null
  constructedYear: number | null
  isSlum: boolean
  ownershipType: string | null
  propertyUse: string | null
  propertyType: string | null
  situation: string | null
  roadType: string | null
  taxRateZone: string | null
  assessmentYear: string
  plotAreaSqFt: DecimalLike
  plinthAreaSqFt: DecimalLike
  totalBuiltAreaSqFt?: DecimalLike
  waterConnection: string | null
  sourceOfWater: string | null
  sanitationType: string | null
  solidWasteCollection: boolean | null
  electricityConsumerNo: string | null
  latitude: DecimalLike
  longitude: DecimalLike
  state?: { name: string } | null
  floors?: Array<{
    id: string
    floorPosition: string
    usageType: string | null
    usageFactor: string | null
    constructionType: string | null
    areaSqFt: DecimalLike
    position: number
  }>
  coOwners?: Array<{
    id: string
    name: string
    fatherOrHusbandName: string | null
    mobile: string | null
    alternateMobile: string | null
    ownerIndex: number
  }>
}

const DEFAULT_USAGE_FACTOR = "RESIDENTIAL"
const DEFAULT_CONSTRUCTION_TYPE = "PAKKA_BUILDING_WITH_RCC_ROOF"

function normalizeFloorFields(floor: { usageFactor: string | null; constructionType: string | null }): {
  usageFactor: string
  constructionType: string
} {
  return {
    usageFactor: floor.usageFactor || DEFAULT_USAGE_FACTOR,
    constructionType: floor.constructionType || DEFAULT_CONSTRUCTION_TYPE,
  }
}

export function mapQcEditable(survey: SurveyForEditable): QcSurveyEditable {
  const floors = [...(survey.floors ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((floor) => {
      const normalized = normalizeFloorFields(floor)
      return {
        id: floor.id,
        floorPosition: floor.floorPosition,
        usageType: floor.usageType,
        usageFactor: normalized.usageFactor,
        constructionType: normalized.constructionType,
        areaSqFt: toNumber(floor.areaSqFt),
        position: floor.position,
      }
    })

  const coOwners = [...(survey.coOwners ?? [])]
    .sort((a, b) => a.ownerIndex - b.ownerIndex)
    .map((owner) => ({
      id: owner.id,
      name: owner.name,
      fatherOrHusbandName: owner.fatherOrHusbandName,
      mobile: owner.mobile,
      alternateMobile: owner.alternateMobile,
    }))

  return {
    stateId: survey.stateId,
    districtId: survey.districtId,
    ulbId: survey.ulbId,
    wardId: survey.wardId,
    assignedToId: survey.assignedToId,
    respondentName: survey.respondentName,
    mobileNumber: survey.mobileNumber,
    alternateMobile: survey.alternateMobile,
    relationshipWithOwner: survey.relationshipWithOwner,
    familySize: survey.familySize,
    fatherHusbandName: coOwners[0]?.fatherOrHusbandName ?? null,
    houseDoorNo: survey.houseDoorNo,
    colony: survey.colony,
    locality: survey.locality,
    city: survey.city,
    pinCode: survey.pinCode,
    sectorNo: survey.sectorNo,
    unitSubNo: survey.unitSubNo,
    parcelNumber: survey.parcelNumber,
    propertyIdOld: survey.propertyIdOld,
    constructedYear: survey.constructedYear,
    isSlum: survey.isSlum,
    ownershipType: survey.ownershipType,
    propertyUse: survey.propertyUse,
    propertyType: survey.propertyType,
    situation: survey.situation,
    roadType: survey.roadType,
    taxRateZone: survey.taxRateZone,
    assessmentYear: survey.assessmentYear,
    plotAreaSqFt: toNumber(survey.plotAreaSqFt),
    plinthAreaSqFt: toNumber(survey.plinthAreaSqFt),
    waterConnection: survey.waterConnection,
    sourceOfWater: survey.sourceOfWater,
    sanitationType: survey.sanitationType,
    solidWasteCollection: survey.solidWasteCollection,
    electricityConsumerNo: survey.electricityConsumerNo,
    latitude: toNumber(survey.latitude),
    longitude: toNumber(survey.longitude),
    floors,
    coOwners,
  }
}
