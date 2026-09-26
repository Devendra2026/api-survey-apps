import { useSignIn } from "@clerk/expo/legacy"
import { useState } from "react"
import { getClerkErrorMessage, incompleteAuthMessage, validateSignInInput } from "../lib/clerk-errors"
import { hasPasswordFactor, passwordUnavailableMessage, type SignInFactorLike } from "../lib/sign-in-factors"

/**
 * Email/password sign-in. Session navigation is owned by root/index redirects
 * after Clerk `setActive` — do not `router.replace` here (avoids double nav races).
 *
 * Creates the sign-in with the identifier first, then attempts password only when
 * Clerk lists `password` in `supportedFirstFactors`. Google-only accounts are
 * directed to Continue with Google instead of a password attempt.
 */
export function useSignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(email: string, password: string) {
    if (!isLoaded || !signIn) {
      return
    }

    const validationError = validateSignInInput(email, password)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setLoading(true)
    try {
      const created = await signIn.create({
        identifier: email.trim(),
      })

      const factors = (created.supportedFirstFactors ?? []) as SignInFactorLike[]

      if (!hasPasswordFactor(factors)) {
        setError(passwordUnavailableMessage(factors))
        return
      }

      const result = await signIn.attemptFirstFactor({
        strategy: "password",
        password,
      })

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        return
      }

      setError(incompleteAuthMessage("sign_in", result.status))
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign in failed"))
    } finally {
      setLoading(false)
    }
  }

  return {
    isLoaded,
    error,
    loading,
    submit,
    setError,
  }
}
