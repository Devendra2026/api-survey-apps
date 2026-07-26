import { redirect } from "next/navigation"

export default async function ReferenceCategoryRedirectPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params
  redirect(`/master-data?tab=reference&category=${encodeURIComponent(category)}`)
}
