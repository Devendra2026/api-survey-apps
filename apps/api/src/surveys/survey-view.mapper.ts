import type { AuditHistoryDto, OwnerDto, SurveyDetailsDto, SurveyPhotoDto } from "./dto/survey-view.dto.js"

type DecimalLike = { toString(): string } | number | string | null | undefined

function dash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}

function enumLabel(value: string | null | undefined): string {
  if (!value) return "—"
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")
}

function formatArea(sqFt: DecimalLike, sqM: DecimalLike): string {
  if (sqFt == null && sqM == null) return "—"
  const ft = sqFt != null ? Number(sqFt.toString()) : null
  const m = sqM != null ? Number(sqM.toString()) : null
  if (ft != null && !Number.isNaN(ft) && m != null && !Number.isNaN(m)) {
    return `${ft} (${m} sq m)`
  }
  if (ft != null && !Number.isNaN(ft)) return String(ft)
  if (m != null && !Number.isNaN(m)) return `${m} sq m`
  return "—"
}

function formatCoordinates(lat: DecimalLike, lng: DecimalLike, accuracy: DecimalLike): string {
  if (lat == null || lng == null) return "—"
  const latitude = Number(lat.toString())
  const longitude = Number(lng.toString())
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return "—"
  const acc = accuracy != null ? Number(accuracy.toString()) : null
  const accText = acc != null && !Number.isNaN(acc) ? ` ± ${acc} m` : ""
  return `${latitude.toFixed(6)} N, ${longitude.toFixed(6)} E${accText}`
}

function displayStatus(surveyStatus: string, qcStatus?: string | null): string {
  if (surveyStatus === "APPROVED" || qcStatus === "APPROVED") return "Approved"
  if (surveyStatus === "REJECTED" || qcStatus === "REJECTED") return "Rejected"
  if (surveyStatus === "SUBMITTED") return "Submitted"
  if (surveyStatus === "DRAFT") return "Draft"
  if (surveyStatus === "IN_PROGRESS") return "In Progress"
  if (surveyStatus === "REOPENED") return "Reopened"
  return enumLabel(surveyStatus)
}

function photoLabel(photoType: string): string {
  if (photoType === "FRONT") return "Front View"
  if (photoType === "SIDE") return "Side View"
  if (photoType === "INSIDE") return "Inside View"
  return enumLabel(photoType)
}

function formatWhen(value: Date): string {
  return value.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
}

type SurveyForView = {
  id: string
  propertyId: string
  parcelNumber: string | null
  sectorNo: string | null
  unitSubNo: string | null
  propertyIdOld: string | null
  constructedYear: number | null
  isSlum: boolean
  wardNumber: string | null
  respondentName: string | null
  mobileNumber: string | null
  familySize: number | null
  relationshipWithOwner: string | null
  alternateMobile: string | null
  houseDoorNo: string | null
  colony: string | null
  locality: string | null
  city: string | null
  pinCode: string | null
  latitude: DecimalLike
  longitude: DecimalLike
  gpsAccuracyMeters: DecimalLike
  assessmentYear: string
  ownershipType: string | null
  propertyUse: string | null
  propertyType: string | null
  situation: string | null
  roadType: string | null
  taxRateZone: string | null
  plotAreaSqFt: DecimalLike
  plotAreaSqMeter: DecimalLike
  plinthAreaSqFt: DecimalLike
  plinthAreaSqMeter: DecimalLike
  totalBuiltAreaSqFt: DecimalLike
  totalBuiltAreaSqMeter: DecimalLike
  waterConnection: string | null
  sourceOfWater: string | null
  sanitationType: string | null
  solidWasteCollection: boolean | null
  electricityConsumerNo: string | null
  surveyStatus: string
  qcStatus: string | null
  qcRemarks: string | null
  ulb?: { name: string } | null
  ward?: { wardNumber: string; wardName: string } | null
  district?: { name: string } | null
  assignedTo?: { fullName: string } | null
  createdBy?: { fullName: string } | null
  coOwners?: Array<{
    name: string
    fatherOrHusbandName: string | null
    mobile: string | null
    alternateMobile: string | null
  }>
  floors?: Array<{
    floorPosition: string
    usageType: string | null
    usageFactor: string | null
    constructionType: string | null
    areaSqFt: DecimalLike
    position: number
  }>
  photos?: Array<{
    id: string
    photoType: string
    url: string
    capturedAt: Date | null
  }>
  qcRemarkThread?: Array<{
    id: string
    body: string
    createdAt: Date
    author?: { fullName: string } | null
  }>
}

export function mapSurveyToDetailsDto(survey: SurveyForView): SurveyDetailsDto {
  const surveyor = survey.assignedTo?.fullName ?? survey.createdBy?.fullName ?? "—"
  const owners: OwnerDto[] = (survey.coOwners ?? []).map((owner) => ({
    propertyId: survey.propertyId,
    name: owner.name,
    fatherHusband: dash(owner.fatherOrHusbandName),
    mobile: dash(owner.mobile),
    altMobile: dash(owner.alternateMobile),
  }))

  const floors = [...(survey.floors ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((floor, index) => ({
      sNo: index + 1,
      floor: enumLabel(floor.floorPosition),
      usageType: enumLabel(floor.usageType),
      usageFactor: enumLabel(floor.usageFactor),
      construction: enumLabel(floor.constructionType),
      area: floor.areaSqFt != null ? String(floor.areaSqFt) : "—",
    }))

  const photos: SurveyPhotoDto[] = (survey.photos ?? []).map((photo) => ({
    id: photo.id,
    photoType: photo.photoType,
    label: photoLabel(photo.photoType),
    url: photo.url,
    capturedAt: photo.capturedAt ? formatWhen(photo.capturedAt) : null,
    surveyorName: surveyor,
  }))

  const front = photos.find((p) => p.photoType === "FRONT")
  const side = photos.find((p) => p.photoType === "SIDE")
  const fatherHusbandName = owners[0]?.fatherHusband ?? "—"

  const lat = survey.latitude != null ? Number(survey.latitude.toString()) : null
  const lng = survey.longitude != null ? Number(survey.longitude.toString()) : null
  const acc = survey.gpsAccuracyMeters != null ? Number(survey.gpsAccuracyMeters.toString()) : null

  return {
    id: survey.id,
    propertyId: survey.propertyId,
    ulbName: survey.ulb?.name ?? "—",
    wardNo: survey.ward?.wardNumber ?? survey.wardNumber ?? "—",
    parcelNo: dash(survey.parcelNumber),
    ownerName: dash(survey.respondentName),
    status: displayStatus(survey.surveyStatus, survey.qcStatus),
    surveyStatus: survey.surveyStatus,
    qcStatus: survey.qcStatus,
    district: survey.district?.name ?? "—",
    sectorZone: dash(survey.sectorNo),
    unitSubNo: dash(survey.unitSubNo),
    propertyIdOld: dash(survey.propertyIdOld),
    constructedYear: survey.constructedYear != null ? String(survey.constructedYear) : "—",
    surveyor,
    slumArea: survey.isSlum ? "Yes" : "No",
    respondentName: dash(survey.respondentName),
    mobileNumber: dash(survey.mobileNumber),
    familySize: survey.familySize,
    relationshipWithOwner: dash(survey.relationshipWithOwner),
    altMobile: dash(survey.alternateMobile),
    fatherHusbandName,
    houseDoorNo: dash(survey.houseDoorNo),
    colonySociety: dash(survey.colony),
    localityLandmark: dash(survey.locality),
    city: dash(survey.city) !== "—" ? dash(survey.city) : (survey.ulb?.name ?? "—"),
    pinCode: dash(survey.pinCode),
    coordinates: formatCoordinates(survey.latitude, survey.longitude, survey.gpsAccuracyMeters),
    latitude: lat != null && !Number.isNaN(lat) ? lat : null,
    longitude: lng != null && !Number.isNaN(lng) ? lng : null,
    gpsAccuracyMeters: acc != null && !Number.isNaN(acc) ? acc : null,
    assessmentYear: enumLabel(survey.assessmentYear),
    ownershipType: enumLabel(survey.ownershipType),
    propertyUse: enumLabel(survey.propertyUse),
    propertyType: enumLabel(survey.propertyType),
    situation: enumLabel(survey.situation),
    roadType: enumLabel(survey.roadType),
    taxRateZone: enumLabel(survey.taxRateZone),
    plotArea: formatArea(survey.plotAreaSqFt, survey.plotAreaSqMeter),
    plinthArea: formatArea(survey.plinthAreaSqFt, survey.plinthAreaSqMeter),
    builtUpArea: formatArea(survey.totalBuiltAreaSqFt, survey.totalBuiltAreaSqMeter),
    waterConnection: enumLabel(survey.waterConnection),
    sourceOfWater: enumLabel(survey.sourceOfWater),
    sanitationType: enumLabel(survey.sanitationType),
    doorToDoorCollection: survey.solidWasteCollection == null ? "—" : survey.solidWasteCollection ? "Yes" : "No",
    electricityConsumerNo: dash(survey.electricityConsumerNo),
    frontPhotoUrl: front?.url ?? null,
    sidePhotoUrl: side?.url ?? null,
    owners,
    floors,
    photos,
    qcRemarks: survey.qcRemarks,
    qcRemarkItems: (survey.qcRemarkThread ?? []).map((item) => ({
      id: item.id,
      body: item.body,
      author: item.author?.fullName ?? "—",
      createdAt: formatWhen(item.createdAt),
    })),
  }
}

export function mapAuditsToHistoryDto(
  propertyId: string,
  audits: Array<{
    action: string
    changedAt: Date
    changer?: { fullName: string } | null
  }>
): AuditHistoryDto[] {
  return audits.map((audit) => ({
    propertyId,
    when: formatWhen(audit.changedAt),
    action: enumLabel(audit.action.replace(/^SURVEY_/, "")),
    actor: audit.changer?.fullName ?? "—",
  }))
}
