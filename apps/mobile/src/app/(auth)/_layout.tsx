import { Screen, StatusView } from "@/components/ui";
import { useAppSession } from "@/features/auth/session/AppSessionProvider";
import { colors } from "@/theme";
import { Redirect, Stack } from "expo-router";

/**
 * Keep the auth Stack mounted only while signed out.
 * After sign-in, redirect to `/` immediately so forms unmount cleanly
 * and the root index owns the session loading UI (avoids Expo Go crashes).
 */
export default function AuthLayout() {
  const { state } = useAppSession();

  if (state.status === "booting") {
    return (
      <Screen>
        <StatusView variant="loading" title="Loading…" />
      </Screen>
    );
  }

  if (state.status !== "signed_out") {
    return <Redirect href="/" />;
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
