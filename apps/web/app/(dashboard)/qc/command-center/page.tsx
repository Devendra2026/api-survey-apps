import { redirect } from "next/navigation"

/** QC metrics live on the main dashboard; review queue is under Field Surveys. */
export default function QcCommandCenterPage() {
  redirect("/qc/registry")
}
