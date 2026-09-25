import * as WebBrowser from "expo-web-browser"
import { useEffect } from "react"
import { Platform } from "react-native"

/**
 * Preloads the Android custom tab so OAuth feels faster.
 * @see https://docs.expo.dev/guides/authentication/#improving-user-experience
 */
export function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") {
      return
    }
    void WebBrowser.warmUpAsync()
    return () => {
      void WebBrowser.coolDownAsync()
    }
  }, [])
}
