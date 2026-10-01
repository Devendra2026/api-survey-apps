import { Screen, StatusView } from "@/components/ui";
import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

/**
 * Landing route for Clerk Google SSO (`surveyapp://sso-callback`).
 *
 * Session activation is owned by `useSSO` / `setActive` in the sign-in flow.
 * Do NOT immediately treat an unsigned-in deep-link as "go to Login" — that
 * races setActive and bounces Surveyors back to the login screen after Google
 * succeeds in the browser.
 */
const SSO_ACTIVATION_WAIT_MS = 8_000;

export default function SsoCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    if (!isLoaded || isSignedIn) {
      return;
    }
    // Defer setState to satisfy react-hooks/set-state-in-effect.
    const timer = setTimeout(() => {
      setWaited(true);
    }, SSO_ACTIVATION_WAIT_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || (!isSignedIn && !waited)) {
    return (
      <Screen>
        <StatusView
          variant="loading"
          title="Completing Google sign-in…"
          description="Activating your session."
        />
      </Screen>
    );
  }

  // Signed in → root owns profile load + Survey Dashboard.
  // Still unsigned after wait → root will show Login (SSO did not activate).
  return <Redirect href="/" />;
}
