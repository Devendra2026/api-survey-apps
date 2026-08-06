export function assertDistrictId(districtId: string | null | undefined): string {
  const id = districtId?.trim() ?? ""
  if (!id) throw new Error("districtId is required")
  return id
}

export function isSurveyInDistrictScope(
  surveyDistrictId: string | null | undefined,
  scopeDistrictId: string,
): boolean {
  return Boolean(surveyDistrictId) && surveyDistrictId === scopeDistrictId
}
