import { useSignIn } from "@clerk/expo/legacy"
import { useState } from "react"
import {
  getClerkErrorMessage,
  incompleteAuthMessage,
  MIN_PASSWORD_LENGTH,
  validateResetEmail,
} from "../lib/clerk-errors"

export type ForgotPasswordStep = "request" | "reset"

export function useForgotPasswordForm() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [step, setStep] = useState<ForgotPasswordStep>("request")
  const [emailUsed, setEmailUsed] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function requestCode(email: string) {
    if (!isLoaded || !signIn) {
      return
    }

    const validationError = validateResetEmail(email)
    if (validationError) {
      setError(validationError)
      return
    }

    const trimmed = email.trim()
    setError(null)
    setLoading(true)
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: trimmed,
      })
      setEmailUsed(trimmed)
      setStep("reset")
    } catch (err) {
      setError(getClerkErrorMessage(err, "Unable to send reset code"))
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    if (!isLoaded || !signIn || step !== "reset" || !emailUsed) {
      return
    }

    setError(null)
    setResending(true)
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: emailUsed,
      })
    } catch (err) {
      setError(getClerkErrorMessage(err, "Could not resend reset code"))
    } finally {
      setResending(false)
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
    setEmailUsed("")
  }

  return {
    isLoaded,
    step,
    error,
    loading,
    resending,
    requestCode,
    resendCode,
    resetPassword,
    backToRequest,
    setError,
  }
}
