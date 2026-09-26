import { useSSO } from "@clerk/expo"
import * as AuthSession from "expo-auth-session"
import * as WebBrowser from "expo-web-browser"
import { useState } from "react"
import { getGoogleAuthErrorMessage } from "../lib/clerk-errors"
import { resolveSsoSessionId } from "../session/profile-identity"
import { useWarmUpBrowser } from "./use-warm-up-browser"

WebBrowser.maybeCompleteAuthSession()

const MOBILE_SCHEME = "mobile"
const SSO_CALLBACK_PATH = "sso-callback"

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

  async function signInWithGoogle() {
    setError(null)
    setLoading(true)
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: MOBILE_SCHEME,
        path: SSO_CALLBACK_PATH,
      })

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
        setError("Google sign-in was cancelled.")
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

      setError("Google sign-in did not complete a session. Try again, or use email and password.")
    } catch (err) {
      setError(getGoogleAuthErrorMessage(err))
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
