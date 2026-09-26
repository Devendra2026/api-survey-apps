import { useSignUp } from "@clerk/expo/legacy"
import { useState } from "react"
import { getClerkErrorMessage, incompleteAuthMessage, validateSignUpInput } from "../lib/clerk-errors"

export function useSignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const [pendingVerification, setPendingVerification] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  async function signUpWithDetails(fullName: string, email: string, password: string, confirmPassword: string) {
    if (!isLoaded || !signUp) {
      return
    }

    const validationError = validateSignUpInput(fullName, email, password, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setLoading(true)
    try {
      const nameParts = fullName.trim().split(/\s+/).filter(Boolean)
      const firstName = nameParts[0]
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined

      await signUp.create({
        emailAddress: email.trim(),
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      })

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      setPendingVerification(true)
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign up failed"))
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(code: string) {
    if (!isLoaded || !signUp) {
      return
    }

    if (!code.trim()) {
      setError("Enter the verification code from your email.")
      return
    }

    setError(null)
    setLoading(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      })

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        return
      }

      setError(incompleteAuthMessage("sign_up", result.status))
    } catch (err) {
      setError(getClerkErrorMessage(err, "Verification failed"))
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    if (!isLoaded || !signUp || !pendingVerification) {
      return
    }

    setError(null)
    setResending(true)
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
    } catch (err) {
      setError(getClerkErrorMessage(err, "Could not resend verification code"))
    } finally {
      setResending(false)
    }
  }

  return {
    isLoaded,
    pendingVerification,
    error,
    loading,
    resending,
    signUpWithDetails,
    verifyCode,
    resendCode,
    setError,
  }
}
