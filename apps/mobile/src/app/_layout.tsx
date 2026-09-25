import { Screen, StatusView } from "@/components/ui";
import { AppSessionProvider } from "@/features/auth/session/AppSessionProvider";
import { getClerkPublishableKey } from "@/lib/env";
import { ClerkProvider } from "@/services/auth/clerk-provider";
import { colors } from "@/theme";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in fast refresh.
});

function MissingClerkConfig() {
  return (
    <Screen>
      <StatusView
        variant="error"
        title="Clerk is not configured"
        description="Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/mobile/.env (publishable key only). Local: pk_test_…. Release builds must use pk_live_…. See deploy/env/mobile.env.example."
      />
    </Screen>
  );
}

export default function RootLayout() {
  const publishableKey = getClerkPublishableKey();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  if (!publishableKey) {
    return <MissingClerkConfig />;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <AppSessionProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </AppSessionProvider>
    </ClerkProvider>
  );
}
