import { getApiBaseUrl } from "@/lib/env";
import { ApiClientError, isApiClientError, setApiTokenGetter } from "@/services/api/client";
import { getMe, syncUser } from "@/services/api/users";
import {
  canEnterAppHome,
  primaryRoleName,
  type AuthenticatedProfile,
} from "@/types/user";
import { useAuth, useUser } from "@clerk/expo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  isTransientTokenUserMismatch,
  profileMatchesSession,
  readJwtSubject,
  shouldAutoSignOutOnProfile401,
  shouldCommitProfileResponse,
} from "./profile-identity";

export type AppSessionState =
  | { status: "booting" }
  | { status: "signed_out" }
  | { status: "loading_profile" }
  | { status: "ready"; profile: AuthenticatedProfile }
  | { status: "pending"; profile: AuthenticatedProfile }
  | { status: "disabled"; message: string }
  | { status: "error"; message: string };

type AppSessionContextValue = {
  state: AppSessionState;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

const MISSING_BEARER_RETRY_MS = 250;
const TOKEN_ALIGN_RETRY_MS = 300;
const TOKEN_ALIGN_ATTEMPTS = 5;
const GET_TOKEN_TIMEOUT_MS = 12_000;

function isDisabledAccountError(error: unknown): boolean {
  if (!isApiClientError(error) || error.statusCode !== 401) {
    return false;
  }
  return /disabled/i.test(error.message);
}

function isMissingBearerError(error: unknown): boolean {
  if (!isApiClientError(error) || error.statusCode !== 401) {
    return false;
  }
  return /missing bearer token/i.test(error.message);
}

function clerkPhone(user: {
  primaryPhoneNumber?: { phoneNumber: string } | null;
} | null | undefined): string | undefined {
  const phone = user?.primaryPhoneNumber?.phoneNumber?.trim();
  return phone && phone.length > 0 ? phone : undefined;
}

function authLog(scope: "AUTH" | "API" | "ROLE" | "CACHE", message: string): void {
  if (__DEV__) {
    console.log(`[${scope}] ${message}`);
  }
}

/**
 * POST /users/sync returns the bare User row (no permissions / tenantRoles).
 * Merge name/phone only so authorization from GET /users/me is preserved.
 */
async function maybeSyncProfile(
  profile: AuthenticatedProfile,
  clerkFullName: string | null | undefined,
  clerkPhoneNumber: string | undefined,
): Promise<AuthenticatedProfile> {
  const nextName = clerkFullName?.trim();
  const patch: { fullName?: string; phone?: string } = {};

  if (nextName && nextName !== profile.fullName) {
    patch.fullName = nextName;
  }
  if (clerkPhoneNumber && clerkPhoneNumber !== (profile.phone ?? undefined)) {
    patch.phone = clerkPhoneNumber;
  }

  if (!patch.fullName && !patch.phone) {
    return profile;
  }

  try {
    const synced = await syncUser(patch);
    return {
      ...profile,
      fullName: synced.fullName ?? profile.fullName,
      phone: synced.phone !== undefined ? synced.phone : profile.phone,
    };
  } catch {
    return profile;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getTokenWithTimeout(
  getToken: () => Promise<string | null>,
  timeoutMs: number,
): Promise<string | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      getToken(),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

type ProfileGate =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; profile: AuthenticatedProfile }
  | { status: "pending"; profile: AuthenticatedProfile }
  | { status: "disabled"; message: string }
  | { status: "error"; message: string };

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const {
    isLoaded,
    isSignedIn,
    userId: authUserId,
    sessionId,
    getToken,
    signOut: clerkSignOut,
  } = useAuth();
  const { user } = useUser();
  const [profileGate, setProfileGate] = useState<ProfileGate>({ status: "idle" });
  const requestIdRef = useRef(0);
  const getTokenRef = useRef(getToken);
  const mismatchRefetchRef = useRef<string | null>(null);
  const sessionUserId = authUserId ?? null;
  const sessionUserIdRef = useRef<string | null>(sessionUserId);
  const [tokenSubject, setTokenSubject] = useState<string | null>(null);
  const userFullName = user?.fullName;
  const userPhone = clerkPhone(user);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    sessionUserIdRef.current = sessionUserId;
  }, [sessionUserId]);

  // Register the token getter as soon as Clerk is loaded so API calls never race.
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    setApiTokenGetter(async () => {
      try {
        return await getTokenWithTimeout(getTokenRef.current, GET_TOKEN_TIMEOUT_MS);
      } catch {
        return null;
      }
    });
  }, [isLoaded]);

  const fetchProfile = useCallback(async () => {
    const expectedClerkUserId = sessionUserIdRef.current;
    if (!expectedClerkUserId) {
      authLog("AUTH", "Skip profile fetch — no Clerk userId yet");
      return;
    }

    const requestId = ++requestIdRef.current;
    setProfileGate({ status: "loading" });
    authLog(
      "AUTH",
      `Fetching profile clerkUserId=${expectedClerkUserId} sessionId=${sessionId ?? "none"}`,
    );

    const load = async (allowMissingBearerRetry: boolean): Promise<void> => {
      try {
        let token: string | null = null;
        let tokenSubjectFromJwt: string | null = null;

        // After Google/SSO setActive, userId can update before getToken rotates.
        for (let attempt = 1; attempt <= TOKEN_ALIGN_ATTEMPTS; attempt += 1) {
          token = await getTokenWithTimeout(
            getTokenRef.current,
            GET_TOKEN_TIMEOUT_MS,
          );
          if (requestId !== requestIdRef.current) {
            return;
          }
          if (!token) {
            authLog("AUTH", `No token yet (attempt ${attempt}/${TOKEN_ALIGN_ATTEMPTS})`);
            if (attempt < TOKEN_ALIGN_ATTEMPTS) {
              await delay(TOKEN_ALIGN_RETRY_MS);
              continue;
            }
            break;
          }
          tokenSubjectFromJwt = readJwtSubject(token);
          if (
            !isTransientTokenUserMismatch(expectedClerkUserId, tokenSubjectFromJwt)
          ) {
            break;
          }
          authLog(
            "AUTH",
            `Transient token/user mismatch attempt=${attempt} tokenSub=${tokenSubjectFromJwt ?? "none"} expected=${expectedClerkUserId}`,
          );
          if (attempt < TOKEN_ALIGN_ATTEMPTS) {
            await delay(TOKEN_ALIGN_RETRY_MS);
          }
        }

        if (requestId !== requestIdRef.current) {
          return;
        }
        if (!token) {
          authLog("AUTH", "No Clerk session token within timeout");
          setProfileGate({
            status: "error",
            message: __DEV__
              ? `No Clerk session token yet (API: ${getApiBaseUrl()}). Retry or sign in again.`
              : "Your session could not be verified. Please try again.",
          });
          return;
        }

        setTokenSubject(tokenSubjectFromJwt);
        authLog(
          "API",
          `GET /users/me tokenSub=${tokenSubjectFromJwt ?? "none"} authUserId=${expectedClerkUserId} sessionId=${sessionId ?? "none"}`,
        );

        if (isTransientTokenUserMismatch(expectedClerkUserId, tokenSubjectFromJwt)) {
          authLog(
            "AUTH",
            `Token subject still mismatched after retries tokenSub=${tokenSubjectFromJwt ?? "none"} expected=${expectedClerkUserId}`,
          );
          setProfileGate({
            status: "error",
            message:
              "Your session user does not match the loaded profile. Sign out and try again.",
          });
          return;
        }

        // Use the same bearer for identity check and the API call (no second getToken).
        let profile = await getMe(token);
        profile = await maybeSyncProfile(profile, userFullName, userPhone);

        if (
          !shouldCommitProfileResponse({
            requestId,
            currentRequestId: requestIdRef.current,
            expectedClerkUserId,
            currentClerkUserId: sessionUserIdRef.current,
            profileClerkUserId: profile.clerkUserId,
          })
        ) {
          authLog(
            "CACHE",
            `Dropped stale profile response profile=${profile.clerkUserId} expected=${expectedClerkUserId} current=${sessionUserIdRef.current ?? "none"}`,
          );
          return;
        }

        if (!profileMatchesSession(profile.clerkUserId, expectedClerkUserId, tokenSubjectFromJwt)) {
          authLog(
            "AUTH",
            `Profile clerkUserId=${profile.clerkUserId} mismatches session=${expectedClerkUserId}`,
          );
          // Invalidate and allow the mismatch effect to refetch once; do not navigate.
          setProfileGate({
            status: "error",
            message:
              "Your session user does not match the loaded profile. Sign out and try again.",
          });
          return;
        }

        const role = primaryRoleName(profile);
        authLog(
          "ROLE",
          `profile id=${profile.id} clerkUserId=${profile.clerkUserId} role=${role ?? "none"} active=${String(profile.isActive)}`,
        );
        authLog(
          "AUTH",
          `NAV decision=${canEnterAppHome(profile) ? "ready→home" : "pending"}`,
        );

        if (canEnterAppHome(profile)) {
          setProfileGate({ status: "ready", profile });
        } else {
          setProfileGate({ status: "pending", profile });
        }
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (isDisabledAccountError(error)) {
          setProfileGate({
            status: "disabled",
            message:
              error instanceof ApiClientError
                ? error.message
                : "Your account has been disabled. Please contact the system administrator.",
          });
          return;
        }
        if (allowMissingBearerRetry && isMissingBearerError(error)) {
          await delay(MISSING_BEARER_RETRY_MS);
          if (requestId !== requestIdRef.current) {
            return;
          }
          await load(false);
          return;
        }
        if (isApiClientError(error) && error.statusCode === 401) {
          const message = error.message;
          authLog("AUTH", `401 from profile load — keep session unless disabled (msg logged above)`);
          // Never auto-sign-out here: Google SSO was succeeding then bouncing to Login
          // because account-resolution 401s triggered clerkSignOut().
          if (shouldAutoSignOutOnProfile401(message)) {
            requestIdRef.current += 1;
            mismatchRefetchRef.current = null;
            setTokenSubject(null);
            setProfileGate({ status: "idle" });
            await clerkSignOut();
            return;
          }
          setProfileGate({
            status: "error",
            message:
              message ||
              "Unable to load your profile. Please try again or sign out.",
          });
          return;
        }
        const status =
          isApiClientError(error) ? ` status=${error.statusCode}` : "";
        authLog("API", `Profile load failed${status}`);
        setProfileGate({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load your profile. Please try again.",
        });
      }
    };

    await load(true);
  }, [userFullName, userPhone, clerkSignOut, sessionId]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!isSignedIn || !sessionUserId) {
      requestIdRef.current += 1;
      mismatchRefetchRef.current = null;
      // Defer setState — same pattern as fetchProfile — to satisfy react-hooks/set-state-in-effect.
      // signOut() already clears profile synchronously before Clerk signs out.
      const timer = setTimeout(() => {
        setTokenSubject(null);
        setProfileGate({ status: "idle" });
        authLog("AUTH", "Signed out — profile cleared");
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    }

    // Defer so profile fetch setState is not synchronous inside the effect body.
    const timer = setTimeout(() => {
      void fetchProfile();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [isLoaded, isSignedIn, sessionUserId, fetchProfile]);

  // Refetch application user when returning to foreground so role changes apply without reinstall.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionUserId) {
      return;
    }
    const onChange = (next: AppStateStatus) => {
      if (next === "active") {
        authLog("AUTH", "App foreground — refreshing profile");
        void fetchProfile();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      sub.remove();
    };
  }, [isLoaded, isSignedIn, sessionUserId, fetchProfile]);

  // Clerk user id changed after a profile was cached — refetch once, then error.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || (!sessionUserId && !tokenSubject)) {
      return;
    }
    if (profileGate.status !== "ready" && profileGate.status !== "pending") {
      return;
    }
    if (profileMatchesSession(profileGate.profile.clerkUserId, sessionUserId, tokenSubject)) {
      mismatchRefetchRef.current = null;
      return;
    }

    const mismatchKey = `${profileGate.profile.clerkUserId}->${sessionUserId ?? tokenSubject}`;
    if (mismatchRefetchRef.current === mismatchKey) {
      authLog("AUTH", "Clerk user id still mismatched after refetch");
      setProfileGate({
        status: "error",
        message:
          "Your session user does not match the loaded profile. Sign out and try again.",
      });
      return;
    }

    mismatchRefetchRef.current = mismatchKey;
    authLog("AUTH", "Clerk user id mismatch — clearing and refetching profile");
    setProfileGate({ status: "idle" });
    void fetchProfile();
  }, [isLoaded, isSignedIn, sessionUserId, tokenSubject, profileGate, fetchProfile]);

  const state: AppSessionState = useMemo(() => {
    if (!isLoaded) {
      return { status: "booting" };
    }
    if (!isSignedIn) {
      return { status: "signed_out" };
    }
    if (profileGate.status === "idle" || profileGate.status === "loading") {
      return { status: "loading_profile" };
    }
    if (profileGate.status === "ready") {
      if (
        (sessionUserId || tokenSubject) &&
        !profileMatchesSession(
          profileGate.profile.clerkUserId,
          sessionUserId,
          tokenSubject,
        )
      ) {
        return { status: "loading_profile" };
      }
      return { status: "ready", profile: profileGate.profile };
    }
    if (profileGate.status === "pending") {
      if (
        (sessionUserId || tokenSubject) &&
        !profileMatchesSession(
          profileGate.profile.clerkUserId,
          sessionUserId,
          tokenSubject,
        )
      ) {
        return { status: "loading_profile" };
      }
      return { status: "pending", profile: profileGate.profile };
    }
    if (profileGate.status === "disabled") {
      return { status: "disabled", message: profileGate.message };
    }
    return { status: "error", message: profileGate.message };
  }, [isLoaded, isSignedIn, profileGate, sessionUserId, tokenSubject]);

  const signOut = useCallback(async () => {
    requestIdRef.current += 1;
    mismatchRefetchRef.current = null;
    sessionUserIdRef.current = null;
    setTokenSubject(null);
    setProfileGate({ status: "idle" });
    authLog("AUTH", "Sign out — profile and request generation cleared");
    await clerkSignOut();
  }, [clerkSignOut]);

  const value = useMemo(
    () => ({
      state,
      refresh: fetchProfile,
      signOut,
    }),
    [state, fetchProfile, signOut],
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession(): AppSessionContextValue {
  const ctx = useContext(AppSessionContext);
  if (!ctx) {
    throw new Error("useAppSession must be used within AppSessionProvider");
  }
  return ctx;
}
