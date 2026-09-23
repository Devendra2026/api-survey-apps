import { useAuth } from "@clerk/clerk-expo";
import { useEffect } from "react";
import { setApiTokenGetter } from "@/services/api/client";

/**
 * Bridges Clerk `getToken` into the shared API client.
 * Never logs the token.
 */
export function AuthTokenBridge() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    setApiTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
  }, [isLoaded, getToken]);

  return null;
}
