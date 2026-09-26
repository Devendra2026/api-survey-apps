import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import {
  RoleHomeShell,
  surveyHomeCopyForRole,
} from "@/features/home/role-home-shell";
import { primaryRoleName, resolveAppHomeHref } from "@/types/user";
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

  const home = resolveAppHomeHref(state.profile);
  if (home !== "/(app)/survey") {
    return <Redirect href={home ?? "/(app)/pending"} />;
  }

  const role = primaryRoleName(state.profile);

  return (
    <RoleHomeShell
      profile={state.profile}
      copy={surveyHomeCopyForRole(role)}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}
