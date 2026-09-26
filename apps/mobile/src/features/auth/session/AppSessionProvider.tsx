import { getApiBaseUrl } from "@/lib/env";
import { ApiClientError, isApiClientError, setApiTokenGetter } from "@/services/api/client";
import { getMe, syncUser } from "@/services/api/users";
import {
  canEnterAppHome,
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

function sessionVerificationMessage(error: unknown): string {
  if (__DEV__ && isApiClientError(error)) {
    const server = error.message?.trim() || "Unauthorized";
    return `${server} (API: ${getApiBaseUrl()})`;
  }
  return "Your session could not be verified. Please sign in again.";
}

function clerkPhone(user: {
  primaryPhoneNumber?: { phoneNumber: string } | null;
} | null | undefined): string | undefined {
  const phone = user?.primaryPhoneNumber?.phoneNumber?.trim();
  return phone && phone.length > 0 ? phone : undefined;
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

type ProfileGate =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; profile: AuthenticatedProfile }
  | { status: "pending"; profile: AuthenticatedProfile }
  | { status: "disabled"; message: string }
  | { status: "error"; message: string };

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken, signOut: clerkSignOut } = useAuth();
  const { user } = useUser();
  const [profileGate, setProfileGate] = useState<ProfileGate>({ status: "idle" });
  const requestIdRef = useRef(0);
  const getTokenRef = useRef(getToken);
  const userId = user?.id;
  const userFullName = user?.fullName;
  const userPhone = clerkPhone(user);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  // Register the token getter as soon as Clerk is loaded so API calls never race.
  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    setApiTokenGetter(async () => {
      try {
        return await getTokenRef.current();
      } catch {
        return null;
      }
    });
  }, [isLoaded]);

  const fetchProfile = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setProfileGate({ status: "loading" });

    const load = async (allowMissingBearerRetry: boolean): Promise<void> => {
      try {
        const token = await getTokenRef.current();
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (!token) {
          setProfileGate({
            status: "error",
            message: __DEV__
              ? `No Clerk session token yet (API: ${getApiBaseUrl()}). Retry or sign in again.`
              : "Your session could not be verified. Please sign in again.",
          });
          return;
        }

        let profile = await getMe();
        profile = await maybeSyncProfile(profile, userFullName, userPhone);

        if (requestId !== requestIdRef.current) {
          return;
        }

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
          setProfileGate({
            status: "error",
            message: sessionVerificationMessage(error),
          });
          return;
        }
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
  }, [userFullName, userPhone]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      requestIdRef.current += 1;
      return;
    }

    // Defer so profile fetch setState is not synchronous inside the effect body.
    const timer = setTimeout(() => {
      void fetchProfile();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, [isLoaded, isSignedIn, userId, fetchProfile]);

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
      if (userId && profileGate.profile.clerkUserId !== userId) {
        return { status: "loading_profile" };
      }
      return { status: "ready", profile: profileGate.profile };
    }
    if (profileGate.status === "pending") {
      if (userId && profileGate.profile.clerkUserId !== userId) {
        return { status: "loading_profile" };
      }
      return { status: "pending", profile: profileGate.profile };
    }
    if (profileGate.status === "disabled") {
      return { status: "disabled", message: profileGate.message };
    }
    return { status: "error", message: profileGate.message };
  }, [isLoaded, isSignedIn, profileGate, userId]);

  const signOut = useCallback(async () => {
    requestIdRef.current += 1;
    setProfileGate({ status: "idle" });
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
