import { getApiBaseUrl } from "@/lib/env";
import { ApiClientError, isApiClientError, setApiTokenGetter } from "@/services/api/client";
import { profileLoadUserMessage } from "@/services/api/error-messages";
import { getMe, syncUser } from "@/services/api/users";
import {
  canEnterAppHome,
  isRequestableRole,
  primaryRoleName,
  type AuthenticatedProfile,
  type RequestableRole,
} from "@/types/user";
import { useAuth, useUser } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
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
  clearSignupRequestedRole,
  consumeSignupRequestedRole,
  peekSignupRequestedRole,
} from "../lib/signup-intent";
import {
  SESSION_MESSAGES,
  formatIdentityDiagnostics,
  isApiTokenRejectedMessage,
  isProfileRequestCurrent,
  isSessionExpiredMessage,
  isTransientTokenUserMismatch,
  profileCacheKey,
  profileMatchesSession,
  readJwtSubject,
  shouldAutoSignOutOnProfile401,
  shouldCommitProfileResponse,
} from "./profile-identity";

export type AppSessionState =
  | { status: "booting" }
  | { status: "signed_out" }
  | { status: "loading_profile"; message?: string }
  | { status: "ready"; profile: AuthenticatedProfile }
  | { status: "pending"; profile: AuthenticatedProfile }
  | { status: "disabled"; message: string }
  | { status: "error"; message: string };

type AppSessionContextValue = {
  state: AppSessionState;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Persist signup role intent while still pending approval. */
  submitRequestedRole: (role: RequestableRole) => Promise<void>;
};

const AppSessionContext = createContext<AppSessionContextValue | null>(null);

const MISSING_BEARER_RETRY_MS = 250;
const TOKEN_ALIGN_RETRY_MS = 400;
const TOKEN_ALIGN_ATTEMPTS = 6;
const GET_TOKEN_TIMEOUT_MS = 12_000;
const PENDING_POLL_MS = 20_000;

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

function readClerkRequestedRole(user: {
  unsafeMetadata?: Record<string, unknown> | null;
} | null | undefined): RequestableRole | null {
  const value = user?.unsafeMetadata?.requestedRole;
  return isRequestableRole(value) ? value : null;
}

function authLog(scope: "AUTH" | "API" | "ROLE" | "CACHE", message: string): void {
  if (__DEV__) {
    console.log(`[${scope}] ${message}`);
  }
}

function logIdentity(
  context: string,
  input: {
    expectedClerkUserId: string | null;
    tokenSubject: string | null;
    profile: AuthenticatedProfile | null;
    navigationState: string;
  },
): void {
  const { profile } = input;
  authLog(
    "AUTH",
    `${context} ${formatIdentityDiagnostics({
      clerkUserId: input.expectedClerkUserId,
      authenticatedUserId: input.tokenSubject,
      databaseUserId: profile?.id ?? null,
      databaseClerkUserId: profile?.clerkUserId ?? null,
      profileClerkUserId: profile?.clerkUserId ?? null,
      role: profile ? primaryRoleName(profile) : null,
      status: profile
        ? profile.isActive
          ? canEnterAppHome(profile)
            ? "ACTIVE"
            : "PENDING"
          : "DISABLED"
        : null,
      assignmentIds: (profile?.tenantRoles ?? []).filter((r) => r.isActive).map((r) => r.id),
      cacheKey: input.expectedClerkUserId ? profileCacheKey(input.expectedClerkUserId) : null,
      navigationState: input.navigationState,
    })}`,
  );
}

/**
 * POST /users/sync returns the bare User row (no permissions / tenantRoles).
 * Merge name/phone/requestedRole only so authorization from GET /users/me is preserved.
 */
async function maybeSyncProfile(
  profile: AuthenticatedProfile,
  clerkFullName: string | null | undefined,
  clerkPhoneNumber: string | undefined,
  clerkRequestedRole: RequestableRole | null,
): Promise<AuthenticatedProfile> {
  const nextName = clerkFullName?.trim();
  const patch: { fullName?: string; phone?: string; requestedRole?: RequestableRole } = {};

  if (nextName && nextName !== profile.fullName) {
    patch.fullName = nextName;
  }
  if (clerkPhoneNumber && clerkPhoneNumber !== (profile.phone ?? undefined)) {
    patch.phone = clerkPhoneNumber;
  }

  const stagedRole = peekSignupRequestedRole() ?? clerkRequestedRole;
  if (!profile.requestedRole && stagedRole && !canEnterAppHome(profile) && profile.isActive) {
    patch.requestedRole = stagedRole;
  }

  if (!patch.fullName && !patch.phone && !patch.requestedRole) {
    return profile;
  }

  try {
    const synced = await syncUser(patch);
    if (patch.requestedRole) {
      consumeSignupRequestedRole();
    }
    return {
      ...profile,
      fullName: synced.fullName ?? profile.fullName,
      phone: synced.phone !== undefined ? synced.phone : profile.phone,
      requestedRole: synced.requestedRole !== undefined ? synced.requestedRole : profile.requestedRole,
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
  | { status: "loading"; message?: string }
  | { status: "ready"; profile: AuthenticatedProfile }
  | { status: "pending"; profile: AuthenticatedProfile }
  | { status: "disabled"; message: string }
  | { status: "error"; message: string };

type LoadOptions = {
  allowMissingBearerRetry: boolean;
  /** One /users/me refetch with a fresh token when the profile belongs to another Clerk user. */
  allowIdentityRefetch: boolean;
  /** Bypass Clerk's token cache on the first attempt (identity refetch). */
  forceFreshToken: boolean;
};

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
  const queryClient = useQueryClient();
  const [profileGate, setProfileGate] = useState<ProfileGate>({ status: "idle" });
  const requestIdRef = useRef(0);
  const getTokenRef = useRef(getToken);
  const mismatchRefetchRef = useRef<string | null>(null);
  const sessionUserId = authUserId ?? null;
  const sessionUserIdRef = useRef<string | null>(sessionUserId);
  const lastCacheOwnerRef = useRef<string | null>(null);
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
        return await getTokenWithTimeout(() => getTokenRef.current(), GET_TOKEN_TIMEOUT_MS);
      } catch {
        return null;
      }
    });
  }, [isLoaded]);

  // Server data belongs to one Clerk user: drop every cached query on sign-out or user switch.
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    const owner = isSignedIn ? sessionUserId : null;
    if (lastCacheOwnerRef.current !== null && lastCacheOwnerRef.current !== owner) {
      void queryClient.cancelQueries();
      queryClient.clear();
      authLog("CACHE", `Query cache cleared previousOwner=${lastCacheOwnerRef.current} nextOwner=${owner ?? "none"}`);
    }
    lastCacheOwnerRef.current = owner;
  }, [isLoaded, isSignedIn, sessionUserId, queryClient]);

  const fetchProfile = useCallback(async (options?: { background?: boolean }) => {
    const expectedClerkUserId = sessionUserIdRef.current;
    if (!expectedClerkUserId) {
      authLog("AUTH", "Skip profile fetch — no Clerk userId yet");
      return;
    }

    const requestId = ++requestIdRef.current;
    const isCurrent = () =>
      isProfileRequestCurrent({
        requestId,
        currentRequestId: requestIdRef.current,
        expectedClerkUserId,
        currentClerkUserId: sessionUserIdRef.current,
      });

    // Background refresh keeps the current ready/pending profile mounted so open screens
    // (e.g. a survey form after the camera returns) are not unmounted by a loading gate.
    if (options?.background) {
      setProfileGate((prev) =>
        prev.status === "ready" || prev.status === "pending" ? prev : { status: "loading" },
      );
    } else {
      setProfileGate({ status: "loading" });
    }
    const failTransient = (message: string) => {
      setProfileGate((prev) =>
        options?.background && (prev.status === "ready" || prev.status === "pending")
          ? prev
          : { status: "error", message },
      );
    };
    authLog(
      "AUTH",
      `Fetching profile clerkUserId=${expectedClerkUserId} sessionId=${sessionId ?? "none"} cacheKey=${profileCacheKey(expectedClerkUserId)}`,
    );

    const load = async (opts: LoadOptions): Promise<void> => {
      try {
        let token: string | null = null;
        let tokenSubjectFromJwt: string | null = null;

        // After Google/SSO setActive, userId can update before the cached JWT rotates.
        // Retries bypass Clerk's token cache so the bearer belongs to the current user.
        for (let attempt = 1; attempt <= TOKEN_ALIGN_ATTEMPTS; attempt += 1) {
          const skipCache = opts.forceFreshToken || attempt > 1;
          token = await getTokenWithTimeout(
            () => getTokenRef.current(skipCache ? { skipCache: true } : undefined),
            GET_TOKEN_TIMEOUT_MS,
          );
          if (!isCurrent()) {
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
          if (!isTransientTokenUserMismatch(expectedClerkUserId, tokenSubjectFromJwt)) {
            break;
          }
          authLog(
            "AUTH",
            `Token not yet rotated attempt=${attempt} tokenSub=${tokenSubjectFromJwt ?? "none"} expected=${expectedClerkUserId}`,
          );
          if (attempt < TOKEN_ALIGN_ATTEMPTS) {
            await delay(TOKEN_ALIGN_RETRY_MS);
          }
        }

        if (!isCurrent()) {
          return;
        }
        if (!token) {
          // Signed in according to Clerk hooks, but no JWT yet — not the same as an expired session.
          authLog("AUTH", "No Clerk session token within timeout");
          failTransient(
            __DEV__
              ? `${SESSION_MESSAGES.sessionTokenUnavailable} (API: ${getApiBaseUrl()})`
              : SESSION_MESSAGES.sessionTokenUnavailable,
          );
          return;
        }

        if (isTransientTokenUserMismatch(expectedClerkUserId, tokenSubjectFromJwt)) {
          // Clerk never issued a bearer for the current user: the session itself is not usable.
          logIdentity("Token subject never matched Clerk userId", {
            expectedClerkUserId,
            tokenSubject: tokenSubjectFromJwt,
            profile: null,
            navigationState: "error:session_token_mismatch",
          });
          setProfileGate({ status: "error", message: SESSION_MESSAGES.sessionExpired });
          return;
        }

        setTokenSubject(tokenSubjectFromJwt);
        authLog(
          "API",
          `GET /users/me tokenSub=${tokenSubjectFromJwt ?? "none"} authUserId=${expectedClerkUserId} sessionId=${sessionId ?? "none"}`,
        );

        // Use the same bearer for identity check and the API call (no second getToken).
        const loaded = await getMe(token);

        if (!isCurrent()) {
          authLog(
            "CACHE",
            `Dropped stale profile response profile=${loaded.clerkUserId} expected=${expectedClerkUserId} current=${sessionUserIdRef.current ?? "none"}`,
          );
          return;
        }

        if (!profileMatchesSession(loaded.clerkUserId, expectedClerkUserId, tokenSubjectFromJwt)) {
          if (opts.allowIdentityRefetch) {
            logIdentity("Profile identity mismatch — clearing profile and refetching", {
              expectedClerkUserId,
              tokenSubject: tokenSubjectFromJwt,
              profile: loaded,
              navigationState: "loading_profile:identity_refetch",
            });
            setTokenSubject(null);
            setProfileGate({ status: "loading", message: SESSION_MESSAGES.identityRefreshing });
            await load({ ...opts, allowIdentityRefetch: false, forceFreshToken: true });
            return;
          }
          logIdentity("Profile identity mismatch persists after refetch", {
            expectedClerkUserId,
            tokenSubject: tokenSubjectFromJwt,
            profile: loaded,
            navigationState: "error:identity_mismatch",
          });
          setProfileGate({ status: "error", message: SESSION_MESSAGES.identityMismatch });
          return;
        }

        const profile = await maybeSyncProfile(
          loaded,
          userFullName,
          userPhone,
          readClerkRequestedRole(user),
        );

        if (
          !shouldCommitProfileResponse({
            requestId,
            currentRequestId: requestIdRef.current,
            expectedClerkUserId,
            currentClerkUserId: sessionUserIdRef.current,
            profileClerkUserId: profile.clerkUserId,
          })
        ) {
          authLog("CACHE", `Dropped stale profile after sync profile=${profile.clerkUserId}`);
          return;
        }

        if (!profile.isActive) {
          setProfileGate({
            status: "disabled",
            message: "Your account has been disabled. Please contact the system administrator.",
          });
          return;
        }

        const enterHome = canEnterAppHome(profile);
        logIdentity("Profile resolved", {
          expectedClerkUserId,
          tokenSubject: tokenSubjectFromJwt,
          profile,
          navigationState: enterHome ? "ready" : "pending",
        });

        if (enterHome) {
          setProfileGate({ status: "ready", profile });
        } else {
          setProfileGate({ status: "pending", profile });
        }
      } catch (error) {
        if (!isCurrent()) {
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
        if (opts.allowMissingBearerRetry && isMissingBearerError(error)) {
          await delay(MISSING_BEARER_RETRY_MS);
          if (!isCurrent()) {
            return;
          }
          await load({ ...opts, allowMissingBearerRetry: false });
          return;
        }
        if (isApiClientError(error) && error.statusCode === 401) {
          const message = error.message;
          authLog("AUTH", `401 from profile load message=${message}`);
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
          // Preserve Nest business copy (disabled / email linked / resolve failures).
          // Map generic JWT verification failures — do not treat every 401 as "session expired".
          const nextMessage =
            !message
              ? SESSION_MESSAGES.apiTokenRejected
              : isSessionExpiredMessage(message)
                ? SESSION_MESSAGES.sessionExpired
                : isApiTokenRejectedMessage(message)
                  ? SESSION_MESSAGES.apiTokenRejected
                  : message;
          setProfileGate({
            status: "error",
            message: nextMessage,
          });
          return;
        }
        const status = isApiClientError(error) ? ` status=${error.statusCode}` : "";
        const detail = error instanceof Error ? error.message : String(error);
        authLog("API", `Profile load failed${status} detail=${detail}`);
        const userMessage = isApiClientError(error)
          ? profileLoadUserMessage(error)
          : SESSION_MESSAGES.profileUnavailable;
        failTransient(
          __DEV__ && isApiClientError(error) && (error.kind === "network" || error.kind === "timeout")
            ? `${userMessage} (API: ${getApiBaseUrl()})`
            : userMessage,
        );
      }
    };

    await load({ allowMissingBearerRetry: true, allowIdentityRefetch: true, forceFreshToken: false });
  }, [userFullName, userPhone, user, clerkSignOut, sessionId]);

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
        void fetchProfile({ background: true });
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      sub.remove();
    };
  }, [isLoaded, isSignedIn, sessionUserId, fetchProfile]);

  // While awaiting admin approval, poll so PENDING → ACTIVE does not require reinstall.
  useEffect(() => {
    if (profileGate.status !== "pending") {
      return;
    }
    authLog("AUTH", `Pending poll started intervalMs=${PENDING_POLL_MS}`);
    const timer = setInterval(() => {
      void fetchProfile({ background: true });
    }, PENDING_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [profileGate.status, fetchProfile]);

  // Clerk user id changed after a profile was loaded — clear it and refetch once, then error.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionUserId) {
      return;
    }
    if (profileGate.status !== "ready" && profileGate.status !== "pending") {
      return;
    }
    if (profileMatchesSession(profileGate.profile.clerkUserId, sessionUserId, tokenSubject)) {
      mismatchRefetchRef.current = null;
      return;
    }

    const mismatchKey = `${profileGate.profile.clerkUserId}->${sessionUserId}`;
    if (mismatchRefetchRef.current === mismatchKey) {
      logIdentity("Loaded profile still belongs to another Clerk user", {
        expectedClerkUserId: sessionUserId,
        tokenSubject,
        profile: profileGate.profile,
        navigationState: "error:identity_mismatch",
      });
      setProfileGate({ status: "error", message: SESSION_MESSAGES.identityMismatch });
      return;
    }

    mismatchRefetchRef.current = mismatchKey;
    logIdentity("Clerk userId changed under a loaded profile — refetching", {
      expectedClerkUserId: sessionUserId,
      tokenSubject,
      profile: profileGate.profile,
      navigationState: "loading_profile:identity_refetch",
    });
    setProfileGate({ status: "loading", message: SESSION_MESSAGES.identityRefreshing });
    void fetchProfile();
  }, [isLoaded, isSignedIn, sessionUserId, tokenSubject, profileGate, fetchProfile]);

  const state: AppSessionState = useMemo(() => {
    if (!isLoaded) {
      return { status: "booting" };
    }
    if (!isSignedIn) {
      return { status: "signed_out" };
    }
    if (!sessionUserId) {
      return { status: "loading_profile" };
    }
    if (profileGate.status === "idle") {
      return { status: "loading_profile" };
    }
    if (profileGate.status === "loading") {
      return profileGate.message
        ? { status: "loading_profile", message: profileGate.message }
        : { status: "loading_profile" };
    }
    if (profileGate.status === "ready" || profileGate.status === "pending") {
      // Never expose a profile that belongs to a different Clerk user than the live session.
      if (!profileMatchesSession(profileGate.profile.clerkUserId, sessionUserId, tokenSubject)) {
        return { status: "loading_profile", message: SESSION_MESSAGES.identityRefreshing };
      }
      return { status: profileGate.status, profile: profileGate.profile };
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
    clearSignupRequestedRole();
    setTokenSubject(null);
    setProfileGate({ status: "idle" });
    await queryClient.cancelQueries();
    queryClient.clear();
    authLog("AUTH", "Sign out — profile, request generation and query cache cleared");
    await clerkSignOut();
  }, [clerkSignOut, queryClient]);

  const submitRequestedRole = useCallback(
    async (role: RequestableRole) => {
      if (!isRequestableRole(role)) {
        return;
      }
      try {
        const synced = await syncUser({ requestedRole: role });
        consumeSignupRequestedRole();
        setProfileGate((prev) => {
          if (prev.status !== "pending" && prev.status !== "ready") {
            return prev;
          }
          return {
            ...prev,
            profile: {
              ...prev.profile,
              requestedRole: synced.requestedRole ?? role,
            },
          };
        });
        authLog("ROLE", `requestedRole synced=${role}`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        authLog("ROLE", `requestedRole sync failed detail=${detail}`);
        throw error;
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!isLoaded) {
      return;
    }
    if (!isSignedIn || !sessionUserIdRef.current) {
      // Retry with no usable Clerk session → signed-out path (index redirects to login).
      requestIdRef.current += 1;
      mismatchRefetchRef.current = null;
      setTokenSubject(null);
      setProfileGate({ status: "idle" });
      authLog("AUTH", "Retry with no Clerk session — clearing profile gate");
      return;
    }
    // One profile reload with a fresh token alignment pass. No infinite loop.
    await fetchProfile();
  }, [isLoaded, isSignedIn, fetchProfile]);

  const value = useMemo(
    () => ({
      state,
      refresh,
      signOut,
      submitRequestedRole,
    }),
    [state, refresh, signOut, submitRequestedRole],
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
