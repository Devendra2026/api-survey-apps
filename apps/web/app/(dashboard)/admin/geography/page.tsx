import { redirect } from "next/navigation"

export default function AdminGeographyRedirectPage() {
  redirect("/master-data?tab=tenants")
}
