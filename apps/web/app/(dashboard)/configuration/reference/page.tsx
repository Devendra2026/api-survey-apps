import { redirect } from "next/navigation"

export default function ReferenceIndexRedirectPage() {
  redirect("/master-data?tab=reference")
}
