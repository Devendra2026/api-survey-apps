import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import { isStepId } from "@/features/surveys/lib/requirements";
import { SurveyWizard } from "@/features/surveys/screens/SurveyWizard";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function SurveyDetailRoute() {
  const { state } = useAppSession();
  const { id, step } = useLocalSearchParams<{ id?: string; step?: string }>();

  if (state.status !== "ready") {
    return <Redirect href="/" />;
  }
  if (typeof id !== "string" || !id) {
    return (
      <Screen>
        <StatusView variant="error" title="Survey not found" />
      </Screen>
    );
  }

  return (
    <SurveyWizard
      key={id}
      surveyId={id}
      profile={state.profile}
      initialStep={typeof step === "string" && isStepId(step) ? step : null}
    />
  );
}
