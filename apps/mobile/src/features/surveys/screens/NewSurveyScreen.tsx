import { Screen, StatusView } from "@/components/ui"
import type { AuthenticatedProfile } from "@/types/user"
import { useRouter } from "expo-router"
import { useMemo } from "react"
import { useInvalidateSurveyLists } from "../hooks/queries"
import { surveyAssignments } from "../lib/assignments"
import type { StepId } from "../lib/requirements"
import { StartSurveyScreen } from "../ui/start-survey-screen"

/** Creates a draft from district, ULB, and PIN. Ward is chosen on the Property step. */
export function NewSurveyScreen({ profile }: { profile: AuthenticatedProfile }) {
  const router = useRouter()
  const invalidateLists = useInvalidateSurveyLists()
  const assignments = useMemo(() => surveyAssignments(profile), [profile])
  const leave = () => {
    if (router.canGoBack()) router.back()
    else router.replace("/(app)/survey")
  }
  const openCreated = (id: string, step: StepId) => {
    invalidateLists()
    router.replace({ pathname: "/(app)/surveys/[id]", params: { id, step } })
  }
  if (assignments.length === 0) {
    return (
      <Screen>
        <StatusView
          variant="empty"
          title="No ward assigned"
          description="Ask an administrator to assign a district and ULB before starting a survey."
          actionLabel="Back"
          onAction={leave}
        />
      </Screen>
    )
  }
  return <StartSurveyScreen mode="create" profile={profile} onBack={leave} onCreated={openCreated} />
}
