import { Screen, StatusView } from "@/components/ui";
import { AppSessionProvider } from "@/features/auth/session/AppSessionProvider";
import { getClerkPublishableKey } from "@/lib/env";
import { ClerkProvider } from "@/services/auth/clerk-provider";
import { QueryProvider } from "@/services/query/QueryProvider";
import { colors } from "@/theme";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync().catch(() => {
  // Splash may already be hidden in fast refresh.
});

function RootProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function MissingClerkConfig() {
  return (
    <Screen>
      <StatusView
        variant="error"
        title="Clerk is not configured"
        description="Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (publishable key only). Local Metro: apps/mobile/.env with pk_test_…. EAS preview/production: set the same name in the matching EAS environment (pk_live_… for production), then rebuild. See deploy/env/mobile.env.example."
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
    return (
      <RootProviders>
        <MissingClerkConfig />
      </RootProviders>
    );
  }

  return (
    <RootProviders>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        <QueryProvider>
          <AppSessionProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="sso-callback" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(app)" />
            </Stack>
          </AppSessionProvider>
        </QueryProvider>
      </ClerkProvider>
    </RootProviders>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
