import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import { resolveAppHomeHref } from "@/types/user";
import { Redirect } from "expo-router";

export default function Index() {
  const { state, refresh, signOut } = useAppSession();

  if (state.status === "booting" || state.status === "loading_profile") {
    return (
      <Screen>
        <StatusView
          variant="loading"
          title="Signing you in…"
          description="Verifying your session with the API."
        />
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
    const home = resolveAppHomeHref(state.profile);
    if (!home) {
      return <Redirect href="/(app)/pending" />;
    }
    return <Redirect href={home} />;
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
