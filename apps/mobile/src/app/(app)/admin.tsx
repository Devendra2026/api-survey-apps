import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import {
  ADMIN_HOME_COPY,
  RoleHomeShell,
} from "@/features/home/role-home-shell";
import { resolveAppHomeHref } from "@/types/user";
import { Redirect } from "expo-router";

export default function AdminHomeScreen() {
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

  if (resolveAppHomeHref(state.profile) !== "/(app)/admin") {
    return <Redirect href={resolveAppHomeHref(state.profile)} />;
  }

  return (
    <RoleHomeShell
      profile={state.profile}
      copy={ADMIN_HOME_COPY}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}
