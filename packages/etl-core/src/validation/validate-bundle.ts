import type { ConvexSurveyBundle } from "../domain/types.js"

export interface ValidationIssue {
  field: string
  message: string
}

export function validateConvexBundle(bundle: ConvexSurveyBundle): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!bundle._id?.trim()) {
    issues.push({ field: "legacySurveyId", message: "Missing Convex survey _id" })
  }
  if (!bundle.districtCode?.trim()) {
    issues.push({ field: "districtCode", message: "Missing district code" })
  }
  if (!bundle.municipalityCode?.trim()) {
    issues.push({ field: "municipalityCode", message: "Missing municipality / ULB code" })
  }
  if (!bundle.wardNo?.trim()) {
    issues.push({ field: "wardNo", message: "Missing ward number" })
  }
  if (!bundle.parcelNo?.trim() && !bundle.propertyId?.trim() && !bundle.localId?.trim()) {
    issues.push({
      field: "propertyId",
      message: "Missing property identity (propertyId, parcelNo, or localId)",
    })
  }
  if (!bundle.assessmentYear?.trim()) {
    issues.push({ field: "assessmentYear", message: "Missing assessment year" })
  }

  if (bundle.gps) {
    const { latitude, longitude } = bundle.gps
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      issues.push({ field: "gps.latitude", message: "Invalid latitude" })
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      issues.push({ field: "gps.longitude", message: "Invalid longitude" })
    }
  }

  for (const photo of bundle.photos ?? []) {
    if (!photo.slot) {
      issues.push({ field: "photos.slot", message: "Photo missing slot" })
      continue
    }
    if (photo.url != null && photo.url !== "" && !/^https?:\/\//i.test(photo.url)) {
      issues.push({
        field: `photos.${photo.slot}.url`,
        message: "Broken or non-HTTP photo URL",
      })
    }
  }

  return issues
}
