import { Redirect } from "expo-router";
import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/AppSessionProvider";

export default function Index() {
  const { state, refresh, signOut } = useAppSession();

  if (state.status === "booting" || state.status === "loading_profile") {
    return (
      <Screen>
        <StatusView variant="loading" title="Loading…" description="Checking your session." />
      </Screen>
    );
  }

  if (state.status === "signed_out") {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (state.status === "disabled") {
    return <Redirect href="/(app)/disabled" />;
  }

  if (state.status === "pending") {
    return <Redirect href="/(app)/pending" />;
  }

  if (state.status === "ready") {
    return <Redirect href="/(app)/index" />;
  }

  return (
    <Screen>
      <StatusView
        variant="error"
        title="Unable to continue"
        description={state.message}
        actionLabel="Retry"
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
