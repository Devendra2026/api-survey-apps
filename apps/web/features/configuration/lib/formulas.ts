export function num(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0
  return typeof value === "number" ? value : Number(value)
}

export const TAX_FORMULAS = [
  "Gross ALV = Area × Annual Rate",
  "Assessable ALV = Gross ALV × Assessable %",
  "Property Tax = Assessable ALV × Property Tax %",
  "Water Tax = Assessable ALV × Water Tax %",
  "Drainage Tax = Assessable ALV × Drainage Tax %",
  "Penalty = Property Tax × Penalty %",
  "Demand = Property + Water + Drainage + Penalty",
] as const

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount)
}
