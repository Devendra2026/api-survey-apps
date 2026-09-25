import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import {
  RoleHomeShell,
  SURVEY_HOME_COPY,
} from "@/features/home/role-home-shell";
import { resolveAppHomeHref } from "@/types/user";
import { Redirect } from "expo-router";

export default function SurveyHomeScreen() {
  const { state, signOut } = useAppSession();

  if (state.status === "pending") {
    return <Redirect href="/(app)/pending" />;
  }
  if (state.status === "disabled") {
    return <Redirect href="/(app)/disabled" />;
  }
  if (state.status !== "ready") {
    return <Redirect href="/" />;
  }

  if (resolveAppHomeHref(state.profile) !== "/(app)/survey") {
    return <Redirect href={resolveAppHomeHref(state.profile)} />;
  }

  return (
    <RoleHomeShell
      profile={state.profile}
      copy={SURVEY_HOME_COPY}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}
