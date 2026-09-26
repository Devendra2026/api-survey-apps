import { Button, PasswordInput, Screen, Text, TextField } from "@/components/ui";
import { useForgotPasswordForm } from "@/features/auth/hooks/use-forgot-password-form";
import { AuthScreenShell } from "@/features/auth/ui/AuthScreenShell";
import { spacing } from "@/theme";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const {
    isLoaded,
    step,
    error,
    loading,
    resending,
    requestCode,
    resendCode,
    resetPassword,
    backToRequest,
  } = useForgotPasswordForm();

  const isRequest = step === "request";
  const busy = loading || resending;

  return (
    <Screen scroll keyboard>
      <AuthScreenShell
        title={isRequest ? "Reset password" : "Set new password"}
        caption={
          isRequest
            ? "Enter your work email and we will send a one-time reset code."
            : "Enter the code from your email and choose a new password."
        }
        footer={
          <View style={styles.footerRow}>
            <Text variant="body" tone="secondary">
              Remember your password?{" "}
            </Text>
            <Link href="/(auth)/sign-in">
              <Text variant="bodyStrong" tone="primary">
                Sign in
              </Text>
            </Link>
          </View>
        }
      >
        {isRequest ? (
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
        ) : (
          <>
            <TextField
              label="Reset code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              placeholder="123456"
              editable={!busy}
            />
            <PasswordInput
              label="New password"
              value={password}
              onChangeText={setPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              editable={!busy}
            />
          </>
        )}

        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}

        <Button
          title={isRequest ? "Send reset code" : "Update password"}
          loading={loading}
          disabled={
            !isLoaded ||
            resending ||
            (isRequest ? !email.trim() : !code.trim() || !password)
          }
          onPress={() => {
            if (isRequest) {
              void requestCode(email);
              return;
            }
            void resetPassword(code, password);
          }}
        />

        {!isRequest ? (
          <>
            <Button
              title="Resend code"
              variant="ghost"
              loading={resending}
              disabled={!isLoaded || loading}
              onPress={() => {
                void resendCode();
              }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={backToRequest}
              style={styles.backLink}
            >
              <Text variant="bodyStrong" tone="primary">
                Use a different email
              </Text>
            </Pressable>
          </>
        ) : null}
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
  backLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
});
