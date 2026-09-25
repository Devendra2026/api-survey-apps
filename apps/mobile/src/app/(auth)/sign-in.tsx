import { Button, Screen, Text, TextField } from "@/components/ui";
import { useGoogleAuth } from "@/features/auth/hooks/use-google-auth";
import { useSignInForm } from "@/features/auth/hooks/use-sign-in-form";
import { AuthScreenShell } from "@/features/auth/ui/AuthScreenShell";
import { colors, spacing } from "@/theme";
import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { isLoaded, error, loading, submit, setError } = useSignInForm();
  const {
    error: googleError,
    loading: googleLoading,
    signInWithGoogle,
    setError: setGoogleError,
  } = useGoogleAuth();

  const busy = loading || googleLoading;
  const displayError = googleError ?? error;

  return (
    <Screen scroll keyboard>
      <AuthScreenShell
        title="Sign in"
        caption="Municipal survey field access — use your assigned account."
        footer={
          <View style={styles.footerRow}>
            <Text variant="body" tone="secondary">
              Need an account?{" "}
            </Text>
            <Link href="/(auth)/sign-up">
              <Text variant="bodyStrong" tone="primary">
                Sign up
              </Text>
            </Link>
          </View>
        }
      >
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          placeholder="you@example.com"
          editable={!busy}
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          placeholder="••••••••"
          editable={!busy}
        />

        <View style={styles.forgotRow}>
          <Link href="/(auth)/forgot-password">
            <Text variant="bodyStrong" tone="primary" style={styles.forgotLink}>
              Forgot password?
            </Text>
          </Link>
        </View>

        {displayError ? (
          <Text variant="caption" tone="danger">
            {displayError}
          </Text>
        ) : null}

        <Button
          title="Sign in"
          loading={loading}
          disabled={!email.trim() || !password || !isLoaded || googleLoading}
          onPress={() => {
            setGoogleError(null);
            void submit(email, password);
          }}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text variant="caption" tone="secondary">
            or
          </Text>
          <View style={styles.dividerLine} />
        </View>

        <Button
          title="Continue with Google"
          variant="secondary"
          loading={googleLoading}
          disabled={!isLoaded || loading}
          onPress={() => {
            setError(null);
            void signInWithGoogle();
          }}
        />
      </AuthScreenShell>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  forgotRow: {
    alignItems: "flex-end",
    marginTop: -spacing.sm,
  },
  forgotLink: {
    fontSize: 14,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
