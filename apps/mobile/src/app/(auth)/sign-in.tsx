import { Button, PasswordInput, Screen, Text, TextField } from "@/components/ui"
import { useGoogleAuth } from "@/features/auth/hooks/use-google-auth"
import { useSignInForm } from "@/features/auth/hooks/use-sign-in-form"
import { ENTER_DEVICE_TRUST_CODE_MESSAGE } from "@/features/auth/lib/clerk-auth-copy"
import { isValidEmail, normalizeAuthEmail } from "@/features/auth/lib/clerk-errors"
import { AuthDivider } from "@/features/auth/ui/AuthDivider"
import { AuthError } from "@/features/auth/ui/AuthError"
import { AuthFooterLinkRow } from "@/features/auth/ui/AuthFooter"
import { AuthScreenShell } from "@/features/auth/ui/AuthScreenShell"
import { GoogleSignInButton } from "@/features/auth/ui/GoogleSignInButton"
import { OtpInput, isCompleteOtp } from "@/features/auth/ui/OtpInput"
import { spacing } from "@/theme"
import { Link, useLocalSearchParams } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, View } from "react-native"

function emailFromParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) {
    return ""
  }
  return normalizeAuthEmail(raw)
}

export default function SignInScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>()
  const [email, setEmail] = useState(() => emailFromParam(params.email))
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const {
    isLoaded,
    error,
    loading,
    resending,
    cooldownSeconds,
    step,
    emailUsed,
    trustChannel,
    submit,
    submitEmailCode,
    resendEmailCode,
    backToCredentials,
    setError,
  } = useSignInForm()
  const {
    error: googleError,
    loading: googleLoading,
    resending: googleResending,
    cooldownSeconds: googleCooldownSeconds,
    step: googleStep,
    emailUsed: googleEmailUsed,
    trustChannel: googleTrustChannel,
    signInWithGoogle,
    submitDeviceTrustCode: submitGoogleDeviceTrustCode,
    resendDeviceTrustCode: resendGoogleDeviceTrustCode,
    cancelDeviceTrust: cancelGoogleDeviceTrust,
    setError: setGoogleError,
  } = useGoogleAuth()

  const busy = loading || resending || googleLoading || googleResending
  const displayError = googleError ?? error
  const canSubmitCredentials = isValidEmail(email) && Boolean(password) && isLoaded && !googleLoading

  const isGoogleDeviceTrust = googleStep === "device_trust"
  const isDeviceTrust = step === "device_trust" || isGoogleDeviceTrust
  const isMfaEmailCode = step === "email_code"

  if (isDeviceTrust || isMfaEmailCode) {
    const verificationEmail = isGoogleDeviceTrust ? googleEmailUsed : emailUsed
    const activeChannel = isGoogleDeviceTrust ? googleTrustChannel : trustChannel
    const activeCooldown = isGoogleDeviceTrust ? googleCooldownSeconds : cooldownSeconds
    const activeResending = isGoogleDeviceTrust ? googleResending : resending
    const activeLoading = isGoogleDeviceTrust ? googleLoading : loading
    const cooldownActive = activeCooldown > 0
    const title = isDeviceTrust ? "Verify this device" : "Verify sign-in"
    const deviceTrustBody =
      activeChannel === "phone_code"
        ? "For security, verify this device using the code sent to your phone."
        : "For security, verify this device using the code sent to your email."
    const caption = isDeviceTrust
      ? `${deviceTrustBody} ${ENTER_DEVICE_TRUST_CODE_MESSAGE}`
      : verificationEmail
        ? `Enter the 6-digit code we sent to ${verificationEmail} to finish signing in.`
        : "Enter the 6-digit code from your email to finish signing in."

    return (
      <Screen scroll keyboard>
        <AuthScreenShell
          title={title}
          caption={caption}
          footer={
            <AuthFooterLinkRow
              prompt=""
              action={
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    setCode("")
                    if (isGoogleDeviceTrust) {
                      cancelGoogleDeviceTrust()
                    } else {
                      backToCredentials()
                    }
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
          {verificationEmail ? (
            <Text variant="body" tone="secondary">
              {verificationEmail}
            </Text>
          ) : null}
          <OtpInput value={code} onChange={setCode} disabled={busy} />
          {displayError ? <AuthError message={displayError} /> : null}
          <Button
            title={activeLoading ? "Verifying…" : "Verify"}
            loading={activeLoading}
            disabled={!isLoaded || activeResending || !isCompleteOtp(code)}
            onPress={() => {
              setGoogleError(null)
              if (isGoogleDeviceTrust) {
                void submitGoogleDeviceTrustCode(code)
              } else {
                void submitEmailCode(code)
              }
            }}
          />
          <Button
            title={
              cooldownActive
                ? `Resend code (${activeCooldown}s)`
                : activeResending
                  ? "Sending…"
                  : "Resend code"
            }
            variant="ghost"
            loading={activeResending}
            disabled={!isLoaded || activeLoading || cooldownActive}
            onPress={() => {
              if (isGoogleDeviceTrust) {
                void resendGoogleDeviceTrustCode()
              } else {
                void resendEmailCode()
              }
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
