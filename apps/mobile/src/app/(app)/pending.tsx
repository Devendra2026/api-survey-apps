import { Redirect } from "expo-router";
import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/AppSessionProvider";

export default function PendingScreen() {
  const { state, refresh, signOut } = useAppSession();

  if (state.status === "ready") {
    return <Redirect href="/(app)/index" />;
  }
  if (state.status === "disabled") {
    return <Redirect href="/(app)/disabled" />;
  }
  if (state.status === "signed_out") {
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (state.status === "booting" || state.status === "loading_profile") {
    return (
      <Screen>
        <StatusView variant="loading" title="Checking access…" />
      </Screen>
    );
  }

  const email =
    state.status === "pending" ? state.profile.email : undefined;

  return (
    <Screen>
      <StatusView
        variant="pending"
        title="Access pending"
        description={
          email
            ? `You are signed in as ${email}, but an administrator has not assigned a working role yet. Pull to refresh after they onboard you, or sign out.`
            : "Your account is signed in but has no working role yet. Ask an administrator to complete onboarding."
        }
        actionLabel="Refresh status"
        onAction={() => {
          void refresh();
        }}
        secondaryLabel="Sign out"
        onSecondary={() => {
          void signOut();
        }}
      />
    </Screen>
  );
}
