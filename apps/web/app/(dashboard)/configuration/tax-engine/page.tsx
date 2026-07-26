import { redirect } from "next/navigation"

export default function TaxEngineRedirectPage() {
  redirect("/master-data?tab=tax-rates")
}
