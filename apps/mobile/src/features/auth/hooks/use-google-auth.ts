import { useSSO } from "@clerk/expo"
import * as AuthSession from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import { useState } from "react"
import { getClerkErrorMessage } from "../lib/clerk-errors"
import { useWarmUpBrowser } from "./use-warm-up-browser"

WebBrowser.maybeCompleteAuthSession()

const MOBILE_SCHEME = "mobile"
const SSO_CALLBACK_PATH = "sso-callback"

export function useGoogleAuth() {
  useWarmUpBrowser()

  const { startSSOFlow } = useSSO()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function signInWithGoogle() {
    setError(null)
    setLoading(true)
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: MOBILE_SCHEME,
        path: SSO_CALLBACK_PATH,
      })

      const { createdSessionId, setActive, signUp } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl,
      })

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
        return
      }

      if (signUp?.status === "missing_requirements") {
        setError("Google sign-in needs a few more profile details. Finish setup on the web admin, then return here.")
        return
      }

      setError("Google sign-in did not complete a session. Try again, or use email and password.")
    } catch (err) {
      setError(getClerkErrorMessage(err, "Google sign-in failed"))
    } finally {
      setLoading(false)
    }
  }

  return {
    error,
    loading,
    signInWithGoogle,
    setError,
  }
}
