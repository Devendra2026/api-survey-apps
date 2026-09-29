import { Button, Screen, Text } from "@/components/ui"
import { useVerifyEmailForm } from "@/features/auth/hooks/use-verify-email-form"
import { AuthError } from "@/features/auth/ui/AuthError"
import { AuthFooterLinkRow } from "@/features/auth/ui/AuthFooter"
import { AuthScreenShell } from "@/features/auth/ui/AuthScreenShell"
import { OtpInput, isCompleteOtp } from "@/features/auth/ui/OtpInput"
import { Link, useLocalSearchParams } from "expo-router"
import { useMemo, useState } from "react"
import { StyleSheet, View } from "react-native"

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? ""
  }
  return value ?? ""
}

export default function VerifyAccountScreen() {
  const params = useLocalSearchParams<{ email?: string | string[] }>()
  const email = useMemo(() => firstParam(params.email), [params.email])
  const [code, setCode] = useState("")
  const { isLoaded, error, loading, resending, cooldownSeconds, verifyCode, resendCode } =
    useVerifyEmailForm()

  const busy = loading || resending
  const cooldownActive = cooldownSeconds > 0

  return (
    <Screen scroll keyboard>
      <AuthScreenShell
        title="Verify your account"
        caption={
          email
            ? `We sent a 6-digit code to:\n${email}`
            : "We sent a 6-digit code to your email. Enter it below to finish registration."
        }
        footer={
          <AuthFooterLinkRow
            prompt="Back to"
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
        <OtpInput value={code} onChange={setCode} disabled={busy} />

        {error ? <AuthError message={error} /> : null}

        <Button
          title={loading ? "Verifying…" : "Verify"}
          loading={loading}
          disabled={!isLoaded || resending || !isCompleteOtp(code)}
          onPress={() => {
            void verifyCode(code)
          }}
        />

        <View style={styles.resend}>
          <Button
            title={
              cooldownActive ? `Resend code (${cooldownSeconds}s)` : "Resend code"
            }
            variant="ghost"
            loading={resending}
            disabled={!isLoaded || loading || cooldownActive}
            onPress={() => {
              void resendCode()
            }}
          />
        </View>
      </AuthScreenShell>
    </Screen>
  )
}

const styles = StyleSheet.create({
  resend: {
    alignItems: "center",
  },
})
