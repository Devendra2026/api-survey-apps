import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import { colors } from "@/theme";
import { Redirect, Stack } from "expo-router";

export default function AppLayout() {
  const { state, refresh, signOut } = useAppSession();

  if (state.status === "booting" || state.status === "loading_profile") {
    return (
      <Screen>
        <StatusView variant="loading" title="Loading profile…" />
      </Screen>
    );
  }

  if (state.status === "signed_out") {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (state.status === "error") {
    return (
      <Screen>
        <StatusView
          variant="error"
          title="Unable to load profile"
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

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="survey" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="disabled" />
    </Stack>
  );
}
