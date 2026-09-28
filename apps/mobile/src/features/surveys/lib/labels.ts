const ACRONYMS = new Set(["RCC", "AY"])

/** `PAKKA_BUILDING_WITH_RCC_ROOF` → `Pakka building with RCC roof`. */
export function humanizeEnum(value: string): string {
  const words = value.split("_").filter(Boolean)
  return words
    .map((word, index) => {
      if (ACRONYMS.has(word)) return word
      const lower = word.toLowerCase()
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower
    })
    .join(" ")
}

const OVERRIDES: Record<string, string> = {
  AY_2025_2026: "2025–2026",
  AY_2026_2027: "2026–2027",
  BELOW_9M: "Below 9 m",
  METER_9_TO_12: "9–12 m",
  METER_12_TO_24: "12–24 m",
  ABOVE_24M: "Above 24 m",
  MIX_PROPERTY: "Mixed property",
  MUNICIPAL_COUNCIL_TOWN_PANCHAYAT: "Municipal council / Town panchayat",
  LIMITED_COMPANY_FIRM: "Limited company / Firm",
  TRUST_SOCIETY: "Trust / Society",
  SHOP_BAKERY: "Shop / Bakery",
  BANK_OFFICE: "Bank / Office",
  SCHOOL_COLLEGE: "School / College",
  MALL_SHOWROOM: "Mall / Showroom",
  HOTEL_MARRIAGE_RESTAURANT: "Hotel / Marriage hall / Restaurant",
  HOSPITAL_NURSING_PATHOLOGY: "Hospital / Nursing / Pathology",
  RESIDENTIAL_SELF: "Residential (self)",
  RESIDENTIAL_RENTED: "Residential (rented)",
  DAMBAR: "Dambar (bitumen)",
  FRONT: "Front view",
  SIDE: "Side view",
  INSIDE: "Inside view",
  DOCUMENT: "Document",
}

export function optionLabel(value: string): string {
  return OVERRIDES[value] ?? humanizeEnum(value)
}

export function toOptions<T extends string>(values: readonly T[]): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: optionLabel(value) }))
}

/** Financial year runs April–March; picks the current AY when it exists in the enum. */
export function defaultAssessmentYear<T extends string>(years: readonly T[], now: Date = new Date()): T {
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const current = `AY_${startYear}_${startYear + 1}`
  const match = years.find((year) => year === current)
  return match ?? years[years.length - 1]!
}
