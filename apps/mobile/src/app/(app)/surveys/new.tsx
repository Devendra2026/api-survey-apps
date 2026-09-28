import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import { NewSurveyScreen } from "@/features/surveys/screens/NewSurveyScreen";
import { Redirect } from "expo-router";

export default function NewSurveyRoute() {
  const { state } = useAppSession();
  if (state.status !== "ready") {
    return <Redirect href="/" />;
  }
  return <NewSurveyScreen profile={state.profile} />;
}
