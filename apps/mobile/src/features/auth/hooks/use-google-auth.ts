import { useSSO } from "@clerk/expo"
import type { SignInResource } from "@clerk/expo/types"
import * as WebBrowser from "expo-web-browser"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  DEVICE_MUST_BE_VERIFIED_MESSAGE,
  ENTER_DEVICE_TRUST_CODE_MESSAGE,
  EXPIRED_VERIFICATION_CODE_MESSAGE,
} from "../lib/clerk-auth-copy"
import {
  extractClerkRetryAfterSeconds,
  getClerkErrorMessage,
  getGoogleAuthErrorMessage,
  incompleteAuthMessage,
} from "../lib/clerk-errors"
import { getNativeSsoRedirectUrl } from "../lib/native-sso-redirect"
import {
  findEmailCodeFactor,
  findPhoneCodeFactor,
  resolveClientTrustChannel,
  unsupportedClientTrustMessage,
  type ClientTrustChannel,
  type SignInFactorLike,
} from "../lib/sign-in-factors"
import { resolveSsoSessionId } from "../session/profile-identity"
import { useWarmUpBrowser } from "./use-warm-up-browser"

WebBrowser.maybeCompleteAuthSession()

export type GoogleAuthStep = "idle" | "device_trust"

type SetActiveFn = NonNullable<Awaited<ReturnType<ReturnType<typeof useSSO>["startSSOFlow"]>>["setActive"]>

function authLog(message: string): void {
  if (__DEV__) {
    console.log(`[AUTH] Google SSO: ${message}`)
  }
}

export function useGoogleAuth() {
  useWarmUpBrowser()

  const { startSSOFlow } = useSSO()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [step, setStep] = useState<GoogleAuthStep>("idle")
  const [emailUsed, setEmailUsed] = useState("")
  const [trustChannel, setTrustChannel] = useState<ClientTrustChannel>("email_code")
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const pendingSignInRef = useRef<SignInResource | null>(null)
  const setActiveRef = useRef<SetActiveFn | null>(null)

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

  async function beginLegacyDeviceTrust(signIn: SignInResource): Promise<boolean> {
    const factors = (signIn.supportedSecondFactors ?? []) as SignInFactorLike[]
    const channel = resolveClientTrustChannel(factors)
    if (!channel) {
      setError(unsupportedClientTrustMessage(factors))
      return false
    }

    if (channel === "email_code") {
      await signIn.prepareSecondFactor({ strategy: "email_code" })
    } else {
      await signIn.prepareSecondFactor({ strategy: "phone_code" })
    }

    pendingSignInRef.current = signIn
    setTrustChannel(channel)
    setEmailUsed(signIn.identifier?.trim() || "")
    setStep("device_trust")
    setError(null)
    return true
  }

  async function signInWithGoogle() {
    setError(null)
    setLoading(true)
    try {
      const redirectUrl = getNativeSsoRedirectUrl()

      authLog(`startSSOFlow redirectUrl=${redirectUrl}`)

      const { createdSessionId, setActive, signIn, signUp, authSessionResult } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      })

      const browserType = authSessionResult && "type" in authSessionResult ? String(authSessionResult.type) : "unknown"
      authLog(
        `browser=${browserType} createdSessionId=${createdSessionId ? "yes" : "no"} signIn=${signIn?.status ?? "none"} signUp=${signUp?.status ?? "none"}`
      )

      if (browserType === "cancel" || browserType === "dismiss") {
        setError("Google sign-in cancelled.")
        return
      }

      // Device Trust on a new client — do not activate a session until verification completes.
      if (signIn?.status === "needs_client_trust") {
        setActiveRef.current = setActive ?? null
        setError(DEVICE_MUST_BE_VERIFIED_MESSAGE)
        const started = await beginLegacyDeviceTrust(signIn)
        if (started) {
          setError(null)
        }
        return
      }

      const sessionId = resolveSsoSessionId({
        createdSessionId,
        signInCreatedSessionId: signIn?.createdSessionId,
        signUpCreatedSessionId: signUp?.createdSessionId,
      })

      if (sessionId && setActive) {
        // Activate the Clerk session. Root AppSessionProvider owns profile load
        // and navigation — do not router.replace here (avoids Login flash races).
        await setActive({ session: sessionId })
        authLog(`setActive complete sessionId=${sessionId}`)
        return
      }

      if (signUp?.status === "missing_requirements") {
        setError("Google sign-in needs a few more profile details. Finish setup on the web admin, then return here.")
        return
      }

      if (signIn?.status === "needs_identifier" || signIn?.status === "needs_first_factor") {
        setError("Google sign-in needs additional verification. Complete sign-in on the web admin, then return here.")
        return
      }

      if (signIn?.status === "needs_second_factor") {
        setError(incompleteAuthMessage("sign_in", "needs_second_factor"))
        return
      }

      setError("Google sign-in did not complete a session. Try again, or use email and password.")
    } catch (err) {
      setError(getGoogleAuthErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function submitDeviceTrustCode(code: string) {
    const signIn = pendingSignInRef.current
    const setActive = setActiveRef.current
    if (!signIn || step !== "device_trust") {
      return
    }
    if (!code.trim()) {
      setError(ENTER_DEVICE_TRUST_CODE_MESSAGE)
      return
    }

    setError(null)
    setLoading(true)
    try {
      if (signIn.secondFactorVerification.status === "expired") {
        setError(EXPIRED_VERIFICATION_CODE_MESSAGE)
        return
      }

      const strategy = trustChannel === "phone_code" ? "phone_code" : "email_code"
      const result = await signIn.attemptSecondFactor({
        strategy,
        code: code.trim(),
      })

      if (result.status === "complete" && result.createdSessionId && setActive) {
        await setActive({ session: result.createdSessionId })
        pendingSignInRef.current = null
        setActiveRef.current = null
        setStep("idle")
        authLog(`device trust setActive complete sessionId=${result.createdSessionId}`)
        return
      }

      setError(incompleteAuthMessage("sign_in", result.status))
    } catch (err) {
      setError(getClerkErrorMessage(err, "Verification failed"))
    } finally {
      setLoading(false)
    }
  }

  async function resendDeviceTrustCode() {
    const signIn = pendingSignInRef.current
    if (!signIn || step !== "device_trust" || cooldownSeconds > 0 || resending || loading) {
      return
    }

    setError(null)
    setResending(true)
    try {
      const factors = (signIn.supportedSecondFactors ?? []) as SignInFactorLike[]
      if (trustChannel === "phone_code" && findPhoneCodeFactor(factors)) {
        await signIn.prepareSecondFactor({ strategy: "phone_code" })
        return
      }
      if (findEmailCodeFactor(factors)) {
        await signIn.prepareSecondFactor({ strategy: "email_code" })
        return
      }
      setError("Could not resend the verification code. Try signing in again.")
    } catch (err) {
      setError(getClerkErrorMessage(err, "Could not resend verification code"))
      applyRetryAfterFromError(err)
    } finally {
      setResending(false)
    }
  }

  function cancelDeviceTrust() {
    pendingSignInRef.current = null
    setActiveRef.current = null
    setStep("idle")
    setEmailUsed("")
    setTrustChannel("email_code")
    setCooldownSeconds(0)
    setError(null)
  }

  return {
    error,
    loading,
    resending,
    cooldownSeconds,
    step,
    emailUsed,
    trustChannel,
    signInWithGoogle,
    submitDeviceTrustCode,
    resendDeviceTrustCode,
    cancelDeviceTrust,
    setError,
  }
}
