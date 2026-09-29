import { useSignIn } from "@clerk/expo/legacy"
import { useState } from "react"
import { getClerkErrorMessage, incompleteAuthMessage, validateSignInInput } from "../lib/clerk-errors"
import {
  findEmailCodeFactor,
  hasPasswordFactor,
  passwordUnavailableMessage,
  unsupportedSecondFactorMessage,
  type SignInFactorLike,
} from "../lib/sign-in-factors"

export type SignInStep = "credentials" | "email_code"

type SignInAttemptResult = {
  status: string | null
  createdSessionId: string | null
  supportedSecondFactors?: SignInFactorLike[] | null
  supportedFirstFactors?: SignInFactorLike[] | null
}

/**
 * Email/password sign-in with Clerk-supported email_code second factor.
 * Session navigation is owned by root redirects after `setActive`.
 */
export function useSignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [step, setStep] = useState<SignInStep>("credentials")
  const [emailUsed, setEmailUsed] = useState("")

  async function activateSession(sessionId: string) {
    if (!setActive) {
      throw new Error("Clerk session activation is not available yet. Try again.")
    }
    await setActive({ session: sessionId })
  }

  async function beginEmailCodeSecondFactor(factors: SignInFactorLike[] | null | undefined) {
    const emailFactor = findEmailCodeFactor(factors)
    if (!emailFactor || !signIn) {
      setError(unsupportedSecondFactorMessage(factors))
      return false
    }

    await signIn.prepareSecondFactor({
      strategy: "email_code",
    })
    setStep("email_code")
    setError(null)
    return true
  }

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

      const result = (await signIn.attemptFirstFactor({
        strategy: "password",
        password,
      })) as SignInAttemptResult

      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId)
        return
      }

      if (result.status === "needs_second_factor") {
        setEmailUsed(email.trim())
        const started = await beginEmailCodeSecondFactor(
          (result.supportedSecondFactors ?? signIn.supportedSecondFactors ?? []) as SignInFactorLike[]
        )
        if (started) {
          return
        }
        return
      }

      // Rare: password accepted path still needs an email_code first factor (org policies).
      if (result.status === "needs_first_factor") {
        const emailFactor = findEmailCodeFactor(
          (result.supportedFirstFactors ?? signIn.supportedFirstFactors ?? factors) as SignInFactorLike[]
        )
        if (emailFactor?.emailAddressId) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailFactor.emailAddressId,
          })
          setEmailUsed(email.trim())
          setStep("email_code")
          setError(null)
          return
        }
      }

      setError(
        __DEV__
          ? `${incompleteAuthMessage("sign_in", result.status)} (status=${result.status ?? "unknown"})`
          : incompleteAuthMessage("sign_in", result.status)
      )
    } catch (err) {
      setError(getClerkErrorMessage(err, "Sign in failed"))
    } finally {
      setLoading(false)
    }
  }

  async function submitEmailCode(code: string) {
    if (!isLoaded || !signIn) {
      return
    }
    if (!code.trim()) {
      setError("Enter the verification code from your email.")
      return
    }

    setError(null)
    setLoading(true)
    try {
      const secondFactors = (signIn.supportedSecondFactors ?? []) as SignInFactorLike[]
      const useSecondFactor = Boolean(findEmailCodeFactor(secondFactors))

      const result = (
        useSecondFactor
          ? await signIn.attemptSecondFactor({
              strategy: "email_code",
              code: code.trim(),
            })
          : await signIn.attemptFirstFactor({
              strategy: "email_code",
              code: code.trim(),
            })
      ) as SignInAttemptResult

      if (result.status === "complete" && result.createdSessionId) {
        await activateSession(result.createdSessionId)
        return
      }

      if (result.status === "needs_second_factor") {
        const started = await beginEmailCodeSecondFactor(
          (result.supportedSecondFactors ?? signIn.supportedSecondFactors ?? []) as SignInFactorLike[]
        )
        if (started) {
          return
        }
        return
      }

      setError(incompleteAuthMessage("sign_in", result.status))
    } catch (err) {
      setError(getClerkErrorMessage(err, "Verification failed"))
    } finally {
      setLoading(false)
    }
  }

  async function resendEmailCode() {
    if (!isLoaded || !signIn || step !== "email_code") {
      return
    }

    setError(null)
    setResending(true)
    try {
      const secondFactors = (signIn.supportedSecondFactors ?? []) as SignInFactorLike[]
      if (findEmailCodeFactor(secondFactors)) {
        await signIn.prepareSecondFactor({ strategy: "email_code" })
        return
      }
      const firstFactors = (signIn.supportedFirstFactors ?? []) as SignInFactorLike[]
      const emailFactor = findEmailCodeFactor(firstFactors)
      if (emailFactor?.emailAddressId) {
        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailFactor.emailAddressId,
        })
        return
      }
      setError("Could not resend the verification code. Try signing in again.")
    } catch (err) {
      setError(getClerkErrorMessage(err, "Could not resend verification code"))
    } finally {
      setResending(false)
    }
  }

  function backToCredentials() {
    setStep("credentials")
    setError(null)
    setEmailUsed("")
  }

  return {
    isLoaded,
    error,
    loading,
    resending,
    step,
    emailUsed,
    submit,
    submitEmailCode,
    resendEmailCode,
    backToCredentials,
    setError,
  }
}
