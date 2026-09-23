import { ClerkProvider } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Screen, StatusView } from "@/components/ui";
import { AuthTokenBridge } from "@/features/auth/AuthTokenBridge";
import { AppSessionProvider } from "@/features/auth/AppSessionProvider";
import { getClerkPublishableKey } from "@/lib/env";
import { colors } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in fast refresh.
});

function MissingClerkConfig() {
  return (
    <Screen>
      <StatusView
        variant="error"
        title="Clerk is not configured"
        description="Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in apps/mobile/.env (publishable key only). See deploy/env/mobile.env.example."
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
        <AuthTokenBridge />
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
