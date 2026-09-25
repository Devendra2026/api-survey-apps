import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import { Redirect } from "expo-router";

export default function DisabledScreen() {
  const { state, signOut } = useAppSession();

  if (state.status === "signed_out") {
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (state.status === "ready") {
    return <Redirect href="/" />;
  }
  if (state.status === "pending") {
    return <Redirect href="/(app)/pending" />;
  }
  if (state.status !== "disabled") {
    return <Redirect href="/" />;
  }

  return (
    <Screen>
      <StatusView
        variant="disabled"
        title="Account disabled"
        description={state.message}
        actionLabel="Sign out"
        onAction={() => {
          void signOut();
        }}
      />
    </Screen>
  );
}
