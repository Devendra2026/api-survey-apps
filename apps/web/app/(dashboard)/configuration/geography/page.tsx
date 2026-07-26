import { redirect } from "next/navigation"

export default function GeographyRedirectPage() {
  redirect("/master-data?tab=tenants")
}
