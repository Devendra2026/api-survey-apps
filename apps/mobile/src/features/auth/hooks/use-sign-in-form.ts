import { useAuth, useSignIn } from "@clerk/expo"
import { useCallback, useEffect, useState } from "react"
import {
  DEVICE_MUST_BE_VERIFIED_MESSAGE,
  ENTER_DEVICE_TRUST_CODE_MESSAGE,
  EXPIRED_VERIFICATION_CODE_MESSAGE,
} from "../lib/clerk-auth-copy"
import {
  extractClerkRetryAfterSeconds,
  getClerkErrorMessage,
  incompleteAuthMessage,
  validateSignInInput,
} from "../lib/clerk-errors"
import {
  findEmailCodeFactor,
  resolveClientTrustChannel,
  unsupportedClientTrustMessage,
  unsupportedSecondFactorMessage,
  type ClientTrustChannel,
  type SignInFactorLike,
} from "../lib/sign-in-factors"

export type SignInStep = "credentials" | "email_code" | "device_trust"

/**
 * Email/password sign-in using Clerk's Signal-based SignInFuture API.
 * Handles Device Trust (`needs_client_trust`) separately from MFA (`needs_second_factor`).
 * Session navigation is owned by root redirects after `finalize()`.
 */
export function useSignInForm() {
  const { isLoaded } = useAuth()
  const { signIn, fetchStatus } = useSignIn()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [step, setStep] = useState<SignInStep>("credentials")
  const [emailUsed, setEmailUsed] = useState("")
  const [trustChannel, setTrustChannel] = useState<ClientTrustChannel>("email_code")
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

  const applyRetryAfterFromError = useCallback((err: unknown) => {
    const seconds = extractClerkRetryAfterSeconds(err)
    if (seconds !== null) {
      setCooldownSeconds(seconds)
    }
  }, [])

  async function finalizeIfComplete(): Promise<boolean> {
    if (signIn.status !== "complete") {
      return false
    }
    const { error: finalizeError } = await signIn.finalize()
    if (finalizeError) {
      setError(getClerkErrorMessage(finalizeError, "Could not activate your session. Try again."))
      return false
    }
    return true
  }

  function verificationExpiredOnSignIn(): boolean {
    return signIn.secondFactorVerification.status === "expired"
  }

  async function beginDeviceTrust(factors: SignInFactorLike[] | null | undefined): Promise<boolean> {
    const channel = resolveClientTrustChannel(factors)
    if (!channel) {
      setError(unsupportedClientTrustMessage(factors))
      return false
    }

    const sendResult = channel === "phone_code" ? await signIn.mfa.sendPhoneCode() : await signIn.mfa.sendEmailCode()

    if (sendResult.error) {
      setError(getClerkErrorMessage(sendResult.error, "Could not send the verification code."))
      applyRetryAfterFromError(sendResult.error)
      return false
    }

    setTrustChannel(channel)
    setStep("device_trust")
    setError(null)
    return true
  }

  async function beginMfaEmailCode(factors: SignInFactorLike[] | null | undefined): Promise<boolean> {
    const emailFactor = findEmailCodeFactor(factors)
    if (!emailFactor) {
      setError(unsupportedSecondFactorMessage(factors))
      return false
    }

    const { error: sendError } = await signIn.mfa.sendEmailCode()
    if (sendError) {
      setError(getClerkErrorMessage(sendError, "Could not send the verification code."))
      applyRetryAfterFromError(sendError)
      return false
    }

    setTrustChannel("email_code")
    setStep("email_code")
    setError(null)
    return true
  }

  async function submit(email: string, password: string) {
    if (!isLoaded) {
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
      const trimmedEmail = email.trim()
      const { error: passwordError } = await signIn.password({
        emailAddress: trimmedEmail,
        password,
      })

      if (passwordError) {
        setError(getClerkErrorMessage(passwordError, "Sign in failed"))
        return
      }

      if (signIn.status === "complete") {
        await finalizeIfComplete()
        return
      }

      if (signIn.status === "needs_client_trust") {
        setEmailUsed(trimmedEmail)
        setError(DEVICE_MUST_BE_VERIFIED_MESSAGE)
        const started = await beginDeviceTrust(signIn.supportedSecondFactors as SignInFactorLike[])
        if (started) {
          setError(null)
        }
        return
      }

      if (signIn.status === "needs_second_factor") {
        setEmailUsed(trimmedEmail)
        await beginMfaEmailCode(signIn.supportedSecondFactors as SignInFactorLike[])
        return
      }

      setError(
        __DEV__
          ? `${incompleteAuthMessage("sign_in", signIn.status)} (status=${signIn.status ?? "unknown"})`
          : incompleteAuthMessage("sign_in", signIn.status)
      )
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign in failed"))
    } finally {
      setLoading(false)
    }
  }

  async function submitEmailCode(code: string) {
    if (!isLoaded) {
      return
    }
    if (!code.trim()) {
      setError(
        step === "device_trust" ? ENTER_DEVICE_TRUST_CODE_MESSAGE : "Enter the verification code from your email."
      )
      return
    }

    setError(null)
    setLoading(true)
    try {
      if (verificationExpiredOnSignIn()) {
        setError(EXPIRED_VERIFICATION_CODE_MESSAGE)
        return
      }

      const verifyResult =
        step === "device_trust" && trustChannel === "phone_code"
          ? await signIn.mfa.verifyPhoneCode({ code: code.trim() })
          : await signIn.mfa.verifyEmailCode({ code: code.trim() })

      if (verifyResult.error) {
        setError(getClerkErrorMessage(verifyResult.error, "Verification failed"))
        return
      }

      if (signIn.status === "complete") {
        await finalizeIfComplete()
        return
      }

      // Device trust can complete first; MFA may still be required.
      if (signIn.status === "needs_second_factor") {
        const started = await beginMfaEmailCode(signIn.supportedSecondFactors as SignInFactorLike[])
        if (started) {
          return
        }
        return
      }

      if (signIn.status === "needs_client_trust") {
        setError(`${DEVICE_MUST_BE_VERIFIED_MESSAGE} ${ENTER_DEVICE_TRUST_CODE_MESSAGE}`)
        return
      }

      setError(incompleteAuthMessage("sign_in", signIn.status))
    } catch (err) {
      setError(getClerkErrorMessage(err, "Verification failed"))
    } finally {
      setLoading(false)
    }
  }

  async function resendEmailCode() {
    if (!isLoaded || (step !== "email_code" && step !== "device_trust")) {
      return
    }
    if (cooldownSeconds > 0 || resending || loading) {
      return
    }

    setError(null)
    setResending(true)
    try {
      const sendResult =
        step === "device_trust" && trustChannel === "phone_code"
          ? await signIn.mfa.sendPhoneCode()
          : await signIn.mfa.sendEmailCode()

      if (sendResult.error) {
        setError(getClerkErrorMessage(sendResult.error, "Could not resend verification code"))
        applyRetryAfterFromError(sendResult.error)
        return
      }
    } catch (err) {
      setError(getClerkErrorMessage(err, "Could not resend verification code"))
      applyRetryAfterFromError(err)
    } finally {
      setResending(false)
    }
  }

  function backToCredentials() {
    void signIn.reset()
    setStep("credentials")
    setError(null)
    setEmailUsed("")
    setTrustChannel("email_code")
    setCooldownSeconds(0)
  }

  return {
    isLoaded,
    error,
    loading: loading || fetchStatus === "fetching",
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
  }
}
