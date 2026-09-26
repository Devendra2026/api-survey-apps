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

  const home = resolveAppHomeHref(state.profile);
  if (home !== "/(app)/admin") {
    return <Redirect href={home ?? "/(app)/pending"} />;
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
