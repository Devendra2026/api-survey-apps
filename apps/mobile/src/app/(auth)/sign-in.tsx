import { Button, PasswordInput, Screen, Text, TextField } from "@/components/ui"
import { useGoogleAuth } from "@/features/auth/hooks/use-google-auth"
import { useSignInForm } from "@/features/auth/hooks/use-sign-in-form"
import { isValidEmail } from "@/features/auth/lib/clerk-errors"
import { AuthDivider } from "@/features/auth/ui/AuthDivider"
import { AuthError } from "@/features/auth/ui/AuthError"
import { AuthFooterLinkRow } from "@/features/auth/ui/AuthFooter"
import { AuthScreenShell } from "@/features/auth/ui/AuthScreenShell"
import { GoogleSignInButton } from "@/features/auth/ui/GoogleSignInButton"
import { OtpInput, isCompleteOtp } from "@/features/auth/ui/OtpInput"
import { spacing } from "@/theme"
import { Link } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

export default function SignInScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const {
    isLoaded,
    error,
    loading,
    resending,
    step,
    emailUsed,
    submit,
    submitEmailCode,
    resendEmailCode,
    backToCredentials,
    setError,
  } = useSignInForm()
  const {
    error: googleError,
    loading: googleLoading,
    signInWithGoogle,
    setError: setGoogleError,
  } = useGoogleAuth()

  const busy = loading || resending || googleLoading
  const displayError = googleError ?? error
  const canSubmitCredentials = isValidEmail(email) && Boolean(password) && isLoaded && !googleLoading

  if (step === "email_code") {
    return (
      <Screen scroll keyboard>
        <AuthScreenShell
          title="Verify sign-in"
          caption={
            emailUsed
              ? `Enter the 6-digit code we sent to ${emailUsed} to finish signing in.`
              : "Enter the 6-digit code from your email to finish signing in."
          }
          footer={
            <AuthFooterLinkRow
              prompt=""
              action={
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    setCode("")
                    backToCredentials()
                  }}
                >
                  <Text variant="bodyStrong" tone="primary">
                    Back to sign in
                  </Text>
                </Pressable>
              }
            />
          }
        >
          <OtpInput value={code} onChange={setCode} disabled={busy} />
          {displayError ? <AuthError message={displayError} /> : null}
          <Button
            title={loading ? "Verifying…" : "Verify"}
            loading={loading}
            disabled={!isLoaded || resending || !isCompleteOtp(code)}
            onPress={() => {
              setGoogleError(null)
              void submitEmailCode(code)
            }}
          />
          <Button
            title="Resend code"
            variant="ghost"
            loading={resending}
            disabled={!isLoaded || loading}
            onPress={() => {
              void resendEmailCode()
            }}
          />
        </AuthScreenShell>
      </Screen>
    )
  }

  return (
    <Screen scroll keyboard>
      <AuthScreenShell
        title="Sign in"
        caption="Municipal survey field access — sign in with your assigned email or Google account."
        footer={
          <AuthFooterLinkRow
            prompt="Do not have an account?"
            action={
              <Link href="/(auth)/sign-up">
                <Text variant="bodyStrong" tone="primary">
                  Sign up
                </Text>
              </Link>
            }
          />
        }
      >
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
        <PasswordInput
          label="Password *"
          value={password}
          onChangeText={setPassword}
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

        {displayError ? <AuthError message={displayError} /> : null}

        <Button
          title={loading ? "Signing in…" : "Sign in"}
          loading={loading}
          disabled={!canSubmitCredentials}
          onPress={() => {
            setGoogleError(null)
            void submit(email, password)
          }}
        />

        <AuthDivider />

        <GoogleSignInButton
          loading={googleLoading}
          disabled={!isLoaded || loading}
          onPress={() => {
            setError(null)
            void signInWithGoogle()
          }}
        />
      </AuthScreenShell>
    </Screen>
  )
}

const styles = StyleSheet.create({
  forgotRow: {
    alignItems: "flex-end",
    marginTop: -spacing.sm,
  },
  forgotLink: {
    fontSize: 14,
  },
})
