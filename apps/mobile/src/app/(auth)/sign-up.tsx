import { Button, Screen, Text, TextField } from "@/components/ui";
import { useGoogleAuth } from "@/features/auth/hooks/use-google-auth";
import { useSignUpForm } from "@/features/auth/hooks/use-sign-up-form";
import { AuthScreenShell } from "@/features/auth/ui/AuthScreenShell";
import { colors, spacing } from "@/theme";
import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

export default function SignUpScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const {
    isLoaded,
    pendingVerification,
    error,
    loading,
    resending,
    signUpWithDetails,
    verifyCode,
    resendCode,
    setError,
  } = useSignUpForm();
  const {
    error: googleError,
    loading: googleLoading,
    signInWithGoogle,
    setError: setGoogleError,
  } = useGoogleAuth();

  const busy = loading || resending || googleLoading;
  const displayError = googleError ?? error;

  return (
    <Screen scroll keyboard>
      <AuthScreenShell
        title={pendingVerification ? "Verify email" : "Create account"}
        caption={
          pendingVerification
            ? "Enter the code we sent to your email to finish registration."
            : "Request field access. An administrator must approve your role before surveys unlock."
        }
        footer={
          <View style={styles.footerRow}>
            <Text variant="body" tone="secondary">
              Already have an account?{" "}
            </Text>
            <Link href="/(auth)/sign-in">
              <Text variant="bodyStrong" tone="primary">
                Sign in
              </Text>
            </Link>
          </View>
        }
      >
        {pendingVerification ? (
          <TextField
            label="Verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            placeholder="123456"
            editable={!busy}
          />
        ) : (
          <>
            <TextField
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              placeholder="Your name"
              editable={!busy}
            />
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
              textContentType="newPassword"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              editable={!busy}
            />
          </>
        )}

        {displayError ? (
          <Text variant="caption" tone="danger">
            {displayError}
          </Text>
        ) : null}

        <Button
          title={pendingVerification ? "Verify and continue" : "Create account"}
          loading={loading}
          disabled={
            !isLoaded ||
            googleLoading ||
            resending ||
            (pendingVerification
              ? !code.trim()
              : !email.trim() || !password || !fullName.trim())
          }
          onPress={() => {
            if (pendingVerification) {
              setGoogleError(null);
              void verifyCode(code);
              return;
            }
            setGoogleError(null);
            void signUpWithDetails(fullName, email, password);
          }}
        />

        {pendingVerification ? (
          <Button
            title="Resend code"
            variant="ghost"
            loading={resending}
            disabled={!isLoaded || loading || googleLoading}
            onPress={() => {
              setGoogleError(null);
              void resendCode();
            }}
          />
        ) : (
          <>
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
          </>
        )}
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
