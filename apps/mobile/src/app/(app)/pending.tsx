import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import { Redirect } from "expo-router";

export default function PendingScreen() {
  const { state, refresh, signOut } = useAppSession();

  if (state.status === "ready") {
    return <Redirect href="/" />;
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
            ? `You are signed in as ${email}. Your account has not been assigned an application role. Please contact your administrator.`
            : "Your account has not been assigned an application role. Please contact your administrator."
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
