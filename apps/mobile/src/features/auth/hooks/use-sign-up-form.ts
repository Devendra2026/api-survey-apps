import type { RequestableRole } from "@/types/user"
import { useSignUp } from "@clerk/expo/legacy"
import { useState } from "react"
import {
  getClerkErrorMessage,
  incompleteAuthMessage,
  validateRequestedRole,
  validateSignUpInput,
} from "../lib/clerk-errors"
import { setSignupRequestedRole } from "../lib/signup-intent"

export function useSignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const [pendingVerification, setPendingVerification] = useState(false)
  const [emailForVerify, setEmailForVerify] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldownUntil, setResendCooldownUntil] = useState(0)

  async function signUpWithDetails(
    fullName: string,
    email: string,
    password: string,
    requestedRole: RequestableRole | null,
    confirmPassword?: string
  ) {
    if (!isLoaded || !signUp) {
      return false
    }

    const validationError = validateSignUpInput(fullName, email, password, confirmPassword)
    if (validationError) {
      setError(validationError)
      return false
    }

    const roleError = validateRequestedRole(requestedRole)
    if (roleError || !requestedRole) {
      setError(roleError ?? "Select Surveyor or Supervisor.")
      return false
    }

    setError(null)
    setLoading(true)
    try {
      const nameParts = fullName.trim().split(/\s+/).filter(Boolean)
      const firstName = nameParts[0]
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : undefined

      setSignupRequestedRole(requestedRole)

      await signUp.create({
        emailAddress: email.trim(),
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        unsafeMetadata: {
          requestedRole,
        },
      })

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      setEmailForVerify(email.trim())
      setPendingVerification(true)
      setResendCooldownUntil(Date.now() + 30_000)
      return true
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign up failed"))
      return false
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(code: string) {
    if (!isLoaded || !signUp) {
      return false
    }

    if (!code.trim()) {
      setError("Enter the verification code from your email.")
      return false
    }

    setError(null)
    setLoading(true)
    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      })

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId })
        return true
      }

      setError(incompleteAuthMessage("sign_up", result.status))
      return false
    } catch (err) {
      setError(getClerkErrorMessage(err, "Verification failed"))
      return false
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    if (!isLoaded || !signUp || !pendingVerification) {
      return
    }
    if (Date.now() < resendCooldownUntil) {
      setError("Please wait a moment before requesting another code.")
      return
    }

    setError(null)
    setResending(true)
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      setResendCooldownUntil(Date.now() + 30_000)
    } catch (err) {
      setError(getClerkErrorMessage(err, "Could not resend verification code"))
    } finally {
      setResending(false)
    }
  }

  return {
    isLoaded,
    pendingVerification,
    emailForVerify,
    error,
    loading,
    resending,
    resendCooldownUntil,
    signUpWithDetails,
    verifyCode,
    resendCode,
    setError,
    setPendingVerification,
    setEmailForVerify,
  }
}
