import { useSignIn } from "@clerk/expo/legacy"
import { useState } from "react"
import { getClerkErrorMessage, incompleteAuthMessage, validateSignInInput } from "../lib/clerk-errors"

/**
 * Email/password sign-in. Session navigation is owned by root/index redirects
 * after Clerk `setActive` — do not `router.replace` here (avoids double nav races).
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
      const result = await signIn.create({
        identifier: email.trim(),
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
