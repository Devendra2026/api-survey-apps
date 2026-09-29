import { Button, PasswordInput, Screen, Text, TextField } from "@/components/ui"
import { useGoogleAuth } from "@/features/auth/hooks/use-google-auth"
import { useSignUpForm } from "@/features/auth/hooks/use-sign-up-form"
import { setSignupRequestedRole } from "@/features/auth/lib/signup-intent"
import { AuthDivider } from "@/features/auth/ui/AuthDivider"
import { AuthError } from "@/features/auth/ui/AuthError"
import { AuthFooterLinkRow } from "@/features/auth/ui/AuthFooter"
import { AuthScreenShell } from "@/features/auth/ui/AuthScreenShell"
import { GoogleSignInButton } from "@/features/auth/ui/GoogleSignInButton"
import { PasswordStrength } from "@/features/auth/ui/PasswordStrength"
import { RoleRequestPicker } from "@/features/auth/ui/RoleRequestPicker"
import type { RequestableRole } from "@/types/user"
import { Link, router } from "expo-router"
import { useState } from "react"

export default function SignUpScreen() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [requestedRole, setRequestedRole] = useState<RequestableRole | null>(null)
  const {
    isLoaded,
    error,
    loading,
    signUpWithDetails,
    setError,
  } = useSignUpForm()
  const {
    error: googleError,
    loading: googleLoading,
    signInWithGoogle,
    setError: setGoogleError,
  } = useGoogleAuth()

  const busy = loading || googleLoading
  const displayError = googleError ?? error
  const canSubmit =
    Boolean(fullName.trim()) &&
    Boolean(email.trim()) &&
    Boolean(password) &&
    Boolean(confirmPassword) &&
    Boolean(requestedRole) &&
    isLoaded &&
    !googleLoading

  return (
    <Screen scroll keyboard>
      <AuthScreenShell
        title="Create account"
        caption="Request field access. An administrator must approve your role before surveys unlock."
        footer={
          <AuthFooterLinkRow
            prompt="Already have an account?"
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
        <TextField
          label="Full name *"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          textContentType="name"
          autoComplete="name"
          placeholder="Your name"
          editable={!busy}
        />
        <TextField
          label="Work email *"
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
          textContentType="newPassword"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          editable={!busy}
        />
        <PasswordStrength password={password} />
        <PasswordInput
          label="Confirm password *"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          textContentType="newPassword"
          autoComplete="new-password"
          placeholder="Re-enter password"
          editable={!busy}
        />

        <RoleRequestPicker
          value={requestedRole}
          onChange={setRequestedRole}
          disabled={busy}
        />

        {displayError ? <AuthError message={displayError} /> : null}

        <Button
          title={loading ? "Creating account…" : "Continue"}
          loading={loading}
          disabled={!canSubmit}
          onPress={() => {
            setGoogleError(null)
            void (async () => {
              const ok = await signUpWithDetails(
                fullName,
                email,
                password,
                requestedRole,
                confirmPassword,
              )
              if (ok) {
                router.push({
                  pathname: "/(auth)/verify",
                  params: { email: email.trim() },
                })
              }
            })()
          }}
        />

        <AuthDivider />

        <GoogleSignInButton
          loading={googleLoading}
          disabled={!isLoaded || loading || !requestedRole}
          onPress={() => {
            if (!requestedRole) {
              setError("Select Surveyor or Supervisor before continuing with Google.")
              return
            }
            setError(null)
            setSignupRequestedRole(requestedRole)
            void signInWithGoogle()
          }}
        />
      </AuthScreenShell>
    </Screen>
  )
}
