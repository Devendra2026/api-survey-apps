import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import {
  RoleHomeShell,
  surveyHomeCopyForRole,
} from "@/features/home/role-home-shell";
import { hasActiveRole } from "@/features/surveys/lib/assignments";
import { SupervisorHome } from "@/features/surveys/screens/SupervisorHome";
import { SurveyorHome } from "@/features/surveys/screens/SurveyorHome";
import { primaryRoleName, resolveAppHomeHref } from "@/types/user";
import { Redirect, useLocalSearchParams } from "expo-router";

export default function SurveyHomeScreen() {
  const { state, signOut } = useAppSession();
  const { submitted } = useLocalSearchParams<{ submitted?: string }>();

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
  const onSignOut = () => {
    void signOut();
  };

  if (role === "FIELD_SUPERVISOR" || role === "QC_SUPERVISOR") {
    return <SupervisorHome profile={state.profile} role={role} onSignOut={onSignOut} />;
  }
  if (role === "SURVEYOR" || hasActiveRole(state.profile, "SURVEYOR")) {
    return (
      <SurveyorHome
        profile={state.profile}
        submittedId={typeof submitted === "string" && submitted ? submitted : null}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <RoleHomeShell
      profile={state.profile}
      copy={surveyHomeCopyForRole(role)}
      onSignOut={onSignOut}
    />
  );
}
