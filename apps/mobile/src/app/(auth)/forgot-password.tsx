import { Button, PasswordInput, Screen, Text, TextField } from "@/components/ui"
import { useForgotPasswordForm } from "@/features/auth/hooks/use-forgot-password-form"
import { AuthError } from "@/features/auth/ui/AuthError"
import { AuthFooterLinkRow } from "@/features/auth/ui/AuthFooter"
import { AuthScreenShell } from "@/features/auth/ui/AuthScreenShell"
import { OtpInput, isCompleteOtp } from "@/features/auth/ui/OtpInput"
import { PasswordStrength } from "@/features/auth/ui/PasswordStrength"
import { spacing } from "@/theme"
import { Link, router } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet } from "react-native"

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const {
    isLoaded,
    step,
    emailUsed,
    error,
    loading,
    resending,
    requestCode,
    resendCode,
    resetPassword,
    backToRequest,
  } = useForgotPasswordForm()

  const isRequest = step === "request"
  const isSuccess = step === "success"
  const busy = loading || resending

  if (isSuccess) {
    return (
      <Screen scroll>
        <AuthScreenShell
          title="Password reset"
          caption="Your password was updated successfully. Sign in with your new password."
        >
          <Button
            title="Sign in"
            onPress={() => {
              router.replace("/(auth)/sign-in")
            }}
          />
        </AuthScreenShell>
      </Screen>
    )
  }

  return (
    <Screen scroll keyboard>
      <AuthScreenShell
        title={isRequest ? "Forgot password?" : "Reset password"}
        caption={
          isRequest
            ? "Enter your work email and we will send a one-time reset code."
            : `Enter the code sent to ${emailUsed || "your email"} and choose a new password.`
        }
        footer={
          <AuthFooterLinkRow
            prompt="Remember your password?"
            action={
              <Link href="/(auth)/sign-in">
                <Text variant="bodyStrong" tone="primary">
                  Sign in
                </Text>
              </Link>
            }
          />
        }
      >
        {isRequest ? (
          <TextField
            label="Email *"
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
            <OtpInput value={code} onChange={setCode} disabled={busy} />
            <PasswordInput
              label="New password *"
              value={password}
              onChangeText={setPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              editable={!busy}
            />
            <PasswordStrength password={password} />
          </>
        )}

        {error ? <AuthError message={error} /> : null}

        <Button
          title={
            loading
              ? isRequest
                ? "Sending…"
                : "Resetting password…"
              : isRequest
                ? "Send reset code"
                : "Update password"
          }
          loading={loading}
          disabled={
            !isLoaded ||
            resending ||
            (isRequest ? !email.trim() : !isCompleteOtp(code) || !password)
          }
          onPress={() => {
            if (isRequest) {
              void requestCode(email)
              return
            }
            void resetPassword(code, password)
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
                void resendCode()
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
  )
}

const styles = StyleSheet.create({
  backLink: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
})
