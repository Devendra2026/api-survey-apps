import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import {
  isListFilterId,
  SurveyListScreen,
} from "@/features/surveys/screens/SurveyListScreen";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function SurveyListRoute() {
  const { state } = useAppSession();
  const { filter, surveyorId, title } = useLocalSearchParams<{
    filter?: string;
    surveyorId?: string;
    title?: string;
  }>();

  if (state.status !== "ready") {
    return <Redirect href="/" />;
  }

  const scopedSurveyor = typeof surveyorId === "string" && surveyorId ? surveyorId : null;
  return (
    <SurveyListScreen
      key={`${scopedSurveyor ?? "all"}`}
      profile={state.profile}
      initialFilter={typeof filter === "string" && isListFilterId(filter) ? filter : "all"}
      surveyorId={scopedSurveyor}
      title={
        typeof title === "string" && title
          ? title
          : scopedSurveyor === state.profile.id
            ? "My surveys"
            : "Surveys"
      }
    />
  );
}
