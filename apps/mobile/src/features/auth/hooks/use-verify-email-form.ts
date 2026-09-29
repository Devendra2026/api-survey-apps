import { useSignUp } from "@clerk/expo/legacy"
import { useCallback, useEffect, useState } from "react"
import { getClerkErrorMessage, incompleteAuthMessage } from "../lib/clerk-errors"
import { isCompleteOtp } from "../ui/OtpInput"

const RESEND_COOLDOWN_SECONDS = 30

/**
 * Email verification after sign-up.create + prepareEmailAddressVerification.
 * Relies on Clerk's in-progress SignUp resource (not local React state from the sign-up screen).
 */
export function useVerifyEmailForm() {
  const { isLoaded, signUp, setActive } = useSignUp()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return
    }
    const timer = setTimeout(() => {
      setCooldownSeconds((seconds) => Math.max(0, seconds - 1))
    }, 1000)
    return () => {
      clearTimeout(timer)
    }
  }, [cooldownSeconds])

  const startCooldown = useCallback(() => {
    setCooldownSeconds(RESEND_COOLDOWN_SECONDS)
  }, [])

  async function verifyCode(code: string) {
    if (!isLoaded || !signUp) {
      return false
    }

    if (!isCompleteOtp(code)) {
      setError("Enter the 6-digit code from your email.")
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
    if (!isLoaded || !signUp) {
      return
    }
    if (cooldownSeconds > 0) {
      setError("Please wait a moment before requesting another code.")
      return
    }

    setError(null)
    setResending(true)
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" })
      startCooldown()
    } catch (err) {
      setError(getClerkErrorMessage(err, "Could not resend verification code"))
    } finally {
      setResending(false)
    }
  }

  return {
    isLoaded,
    error,
    loading,
    resending,
    cooldownSeconds,
    verifyCode,
    resendCode,
    setError,
  }
}
