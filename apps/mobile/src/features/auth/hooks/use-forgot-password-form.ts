import { useSignIn } from "@clerk/expo/legacy"
import { useState } from "react"
import { getClerkErrorMessage, incompleteAuthMessage, MIN_PASSWORD_LENGTH } from "../lib/clerk-errors"

export type ForgotPasswordStep = "request" | "reset"

export function useForgotPasswordForm() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [step, setStep] = useState<ForgotPasswordStep>("request")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function requestCode(email: string) {
    if (!isLoaded || !signIn) {
      return
    }

    const trimmed = email.trim()
    if (!trimmed) {
      setError("Enter your email address.")
      return
    }

    setError(null)
    setLoading(true)
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: trimmed,
      })
      setStep("reset")
    } catch (err) {
      setError(getClerkErrorMessage(err, "Unable to send reset code"))
    } finally {
      setLoading(false)
    }
  }

  async function resetPassword(code: string, password: string) {
    if (!isLoaded || !signIn) {
      return
    }

    const trimmedCode = code.trim()
    if (!trimmedCode) {
      setError("Enter the reset code from your email.")
      return
    }
    if (!password) {
      setError("Enter a new password.")
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    setError(null)
    setLoading(true)
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: trimmedCode,
        password,
      })

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        return
      }

      setError(incompleteAuthMessage("sign_in", result.status))
    } catch (err) {
      setError(getClerkErrorMessage(err, "Unable to reset password"))
    } finally {
      setLoading(false)
    }
  }

  function backToRequest() {
    setStep("request")
    setError(null)
  }

  return {
    isLoaded,
    step,
    error,
    loading,
    requestCode,
    resetPassword,
    backToRequest,
    setError,
  }
}
