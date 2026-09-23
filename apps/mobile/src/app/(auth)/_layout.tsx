import { Redirect, Stack } from "expo-router";
import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/AppSessionProvider";
import { colors } from "@/theme";

export default function AuthLayout() {
  const { state } = useAppSession();

  if (state.status === "booting" || state.status === "loading_profile") {
    return (
      <Screen>
        <StatusView variant="loading" title="Loading…" />
      </Screen>
    );
  }

  if (state.status === "ready") {
    return <Redirect href="/(app)/index" />;
  }
  if (state.status === "pending") {
    return <Redirect href="/(app)/pending" />;
  }
  if (state.status === "disabled") {
    return <Redirect href="/(app)/disabled" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
