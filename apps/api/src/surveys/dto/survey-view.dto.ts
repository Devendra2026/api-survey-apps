export class FloorDetailDto {
  sNo!: number
  floor!: string
  usageType!: string
  usageFactor!: string
  construction!: string
  area!: string
}

export class OwnerDto {
  propertyId!: string
  name!: string
  fatherHusband!: string
  mobile!: string
  altMobile!: string
}

export class SurveyPhotoDto {
  id!: string
  photoType!: string
  label!: string
  url!: string
  capturedAt!: string | null
  surveyorName!: string
}

export class QcRemarkItemDto {
  id!: string
  body!: string
  author!: string
  createdAt!: string
}

export class SurveyDetailsDto {
  id!: string
  propertyId!: string
  ulbName!: string
  wardNo!: string
  parcelNo!: string
  ownerName!: string
  status!: string
  surveyStatus!: string
  qcStatus!: string | null
  district!: string
  sectorZone!: string
  unitSubNo!: string
  propertyIdOld!: string
  constructedYear!: string
  surveyor!: string
  slumArea!: string
  respondentName!: string
  mobileNumber!: string
  familySize!: number | null
  relationshipWithOwner!: string
  altMobile!: string
  fatherHusbandName!: string
  houseDoorNo!: string
  colonySociety!: string
  localityLandmark!: string
  city!: string
  pinCode!: string
  coordinates!: string
  latitude!: number | null
  longitude!: number | null
  gpsAccuracyMeters!: number | null
  assessmentYear!: string
  ownershipType!: string
  propertyUse!: string
  propertyType!: string
  situation!: string
  roadType!: string
  taxRateZone!: string
  plotArea!: string
  plinthArea!: string
  builtUpArea!: string
  waterConnection!: string
  sourceOfWater!: string
  sanitationType!: string
  doorToDoorCollection!: string
  electricityConsumerNo!: string
  frontPhotoUrl!: string | null
  sidePhotoUrl!: string | null
  owners!: OwnerDto[]
  floors!: FloorDetailDto[]
  photos!: SurveyPhotoDto[]
  qcRemarks!: string | null
  qcRemarkItems!: QcRemarkItemDto[]
}

export class AuditHistoryDto {
  propertyId!: string
  when!: string
  action!: string
  actor!: string
}
