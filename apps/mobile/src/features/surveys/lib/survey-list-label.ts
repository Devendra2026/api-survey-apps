const TEMPORARY_PROPERTY_ID_PREFIX = "TEMP-MOBILE-"

export type SurveyListLabelInput = {
  propertyId: string
  houseDoorNo: string | null
  respondentName: string | null
  wardNumber: string | null
}

export type SurveyListLabel = {
  title: string
  subtitle: string
}

/**
 * Card title for survey lists. Temporary mobile ids stay hidden until the real property id exists.
 */
export function surveyListLabel(input: SurveyListLabelInput): SurveyListLabel {
  const ward = input.wardNumber ? `Ward ${input.wardNumber}` : "Ward —"
  const house = input.houseDoorNo?.trim() ?? ""
  const respondent = input.respondentName?.trim() ?? ""
  const propertyId = input.propertyId.trim()
  if (propertyId.length > 0 && !propertyId.startsWith(TEMPORARY_PROPERTY_ID_PREFIX)) {
    return {
      title: propertyId,
      subtitle: [house, respondent, ward].filter((part) => part.length > 0).join(" · "),
    }
  }
  const title = house || respondent || "Draft"
  const subtitleName = title === respondent ? "" : respondent
  return {
    title,
    subtitle: [subtitleName, ward].filter((part) => part.length > 0).join(" · "),
  }
}
