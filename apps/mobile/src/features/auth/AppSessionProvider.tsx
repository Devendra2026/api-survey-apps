import { useAuth, useUser } from "@clerk/clerk-expo";
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
import { ApiClientError, isApiClientError } from "@/services/api/client";
import { getMe, syncUser } from "@/services/api/users";
import {
  hasAppAccess,
  type AuthenticatedProfile,
} from "@/types/user";

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

function isDisabledAccountError(error: unknown): boolean {
  if (!isApiClientError(error) || error.statusCode !== 401) {
    return false;
  }
  return /disabled/i.test(error.message);
}

function clerkPhone(user: {
  primaryPhoneNumber?: { phoneNumber: string } | null;
} | null | undefined): string | undefined {
  const phone = user?.primaryPhoneNumber?.phoneNumber?.trim();
  return phone && phone.length > 0 ? phone : undefined;
}

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
    return await syncUser(patch);
  } catch {
    return profile;
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
  const { isLoaded, isSignedIn, signOut: clerkSignOut } = useAuth();
  const { user } = useUser();
  const [profileGate, setProfileGate] = useState<ProfileGate>({ status: "idle" });
  const requestIdRef = useRef(0);
  const userId = user?.id;
  const userFullName = user?.fullName;
  const userPhone = clerkPhone(user);

  const fetchProfile = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setProfileGate({ status: "loading" });

    try {
      let profile = await getMe();
      profile = await maybeSyncProfile(profile, userFullName, userPhone);

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (hasAppAccess(profile)) {
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
      if (isApiClientError(error) && error.statusCode === 401) {
        setProfileGate({
          status: "error",
          message: "Your session could not be verified. Please sign in again.",
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
