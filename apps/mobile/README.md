# Mobile (Expo)

Expo SDK 57 / React Native field client in the `api-survey-apps` Turborepo.

Package name: `mobile` (`pnpm --filter mobile …`).

## Prerequisites

- From the **repository root**: Node 24+, pnpm (`corepack enable`)
- For Android: Android Studio, Android SDK, an emulator (AVD), and `ANDROID_HOME` / `ANDROID_SDK_ROOT`
- Do not hardcode emulator names; the launch script discovers AVDs (override with `ANDROID_AVD=<name>`)

## Environment

Copy [`deploy/env/mobile.env.example`](../../deploy/env/mobile.env.example) to `apps/mobile/.env` (or `.env.local`):

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_…
```

| Variable                            | Purpose                                                               |
| ----------------------------------- | --------------------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`               | Nest API base URL (no trailing slash). Required for production HTTPS. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk **publishable** key only. Never put `CLERK_SECRET_KEY` here.    |

### Clerk keys: development vs production

Local Expo / Metro should use a Clerk **development** publishable key (`pk_test_…`). The LogBox warning _“Clerk has been loaded with development keys”_ is **expected** in that setup — Clerk limits development instances and reminds you not to ship them to production.

#### Preview vs production (EAS)

`apps/mobile/eas.json` defines three build profiles bound to EAS environments:

| Profile       | EAS environment | Typical API                  | Clerk key family      |
| ------------- | --------------- | ---------------------------- | --------------------- |
| `development` | `development`   | local / staging Nest         | `pk_test_…`           |
| `preview`     | `preview`       | staging/preview Nest (HTTPS) | staging / `pk_test_…` |
| `production`  | `production`    | production Nest HTTPS        | `pk_live_…`           |

One-time: from `apps/mobile`, run `eas init` (project was not linked yet), then set the three `EXPO_PUBLIC_*` names in each EAS environment. Preview must not use the production API URL unless product explicitly chooses that (document if you do).

#### Production / release builds

Before bundling a store or other release binary, set release env (EAS environment `production`, CI, or a local release `.env`) so Expo inlines the production values at build time:

```bash
EXPO_PUBLIC_API_URL=https://your-api.example.com
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
```

- Use the same Clerk **production** instance publishable key as web (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `pk_live_…` from the Clerk Dashboard).
- Never put `CLERK_SECRET_KEY` in the mobile app.
- Nest API must use the matching production Clerk secret so session JWTs validate.
- Non-dev builds reject `pk_test_` keys and reject non-HTTPS / loopback API URLs (see `src/lib/env.ts`).

### Local API URL by device

| Client                   | URL when env unset / typical local value                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Android emulator         | `http://10.0.2.2:4000`                                                                                                             |
| iOS simulator / Expo web | `http://localhost:4000`                                                                                                            |
| Physical device          | LAN IP of your machine on port 4000 (e.g. `http://192.168.1.20:4000`). If unset, the app uses the Expo Metro host IP on port 4000. |

Start Nest (`pnpm --filter api dev`) before signing in. The app calls `GET /users/me` with the Clerk session JWT after login.

Never put API secrets, Clerk secret keys, database URLs, or AWS credentials in the mobile app.

## Auth & onboarding

1. Sign up / sign in with Clerk (email + password with email verification, or **Continue with Google** browser OAuth). Use **Forgot password?** on the sign-in screen to reset via email code.
2. Nest upserts the user on the first authenticated API call and assigns `PENDING_APPROVAL` (or bootstrap `ADMIN`).
3. Until an admin assigns a working role (web **User onboard**), the app shows **Access pending**. Use **Refresh status** after onboarding.
4. Disabled accounts (`isActive: false`) show **Account disabled** and must sign out.

### Surveyor vs admin

| Who                                                                                                                     | After first mobile login                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bootstrap admin (Clerk ID in `BOOTSTRAP_ADMIN_CLERK_USER_IDS`, or first signed-in user when no admin has logged in yet) | Nest promotes to **ADMIN** → **ready** → **Admin dashboard** (`/(app)/admin`)                                                                          |
| Surveyor / Field supervisor / QC supervisor (after web onboarding)                                                      | Nest assigns working role + permissions → **ready** → **Survey dashboard** (`/(app)/survey`)                                                           |
| Typical new user                                                                                                        | Nest assigns **PENDING_APPROVAL** (no permissions) → **Access pending** until a web admin assigns **SURVEYOR** (with ULB/ward) or another working role |

Mobile never auto-assigns SURVEYOR. Role and geography are granted only via the web admin.

### Session verification errors (“Unable to continue”)

After Clerk sign-in the app calls Nest `GET /users/me` with the session JWT. Failures show **Unable to continue** with a status-specific message (no longer a blanket “server temporarily unavailable” for every 5xx).

Important distinctions:

| Message                                 | Meaning                                                                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication session expired…         | Nest reported an expired session token, or Clerk JWT subject never aligned after rotation retries                                            |
| Could not obtain a session token…       | Clerk still reports signed-in but `getToken()` returned nothing — Retry or Sign out                                                          |
| The server rejected this session token… | Nest rejected the JWT — often **wrong Clerk instance** (invalid signature / issuer) or a **present** `azp` not on `CLERK_AUTHORIZED_PARTIES` |

Checklist:

1. Nest API is running (`pnpm --filter api dev`) and reachable — Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`.
2. Database migrations are applied after pulling schema changes: `pnpm db:deploy` (includes `User.requestedRole`). A missing column returns HTTP 500 with a schema message — apply migrations, then Retry.
3. Mobile `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and API `CLERK_SECRET_KEY` are from the **same** Clerk instance (`pk_test_` with `sk_test_`).
4. Local API: leave `CLERK_AUTHORIZED_PARTIES` **empty**, or set only browser Origins. Expo tokens usually have **no** `azp`; the API accepts missing `azp` after signature verification. Do not invent a `mobile://` party.
5. Production: `CLERK_AUTHORIZED_PARTIES` should list web Origins (`https://admin…`). A wrong **present** `azp` still 401s; missing `azp` (native) does not.
6. In `__DEV__`, network/timeout errors include the API base URL to speed up diagnosis.

If sign-in asks for a **verification code**, that is Clerk second-factor / email verification — enter the code on mobile (do not treat it as a dead-end “use web admin” unless TOTP/SMS is required).

The Clerk LogBox toast about **development keys** is expected for local Expo and is not this error.

### Google OAuth (Clerk Dashboard)

Canonical native SSO redirect URI (exact match, **no trailing slash**):

```text
surveyapp://sso-callback
```

This matches `scheme: "surveyapp"` in `app.config.ts` and the Expo Router route `src/app/sso-callback.tsx`. The app builds it via `getNativeSsoRedirectUrl()` in `src/features/auth/lib/native-sso-redirect.ts`.

1. Enable the **Google** social connection on the **same** Clerk instance as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` for that build.
2. Clerk Dashboard → **Native applications** → **Allowlist for mobile SSO redirect** → add exactly `surveyapp://sso-callback`.
3. Repeat step 2 on **every** Clerk instance used by mobile:
   - **Local / development** (`pk_test_…` in Metro / EAS `development`)
   - **Preview** (EAS environment `preview` publishable key — often a staging `pk_test_` instance)
   - **Production** (`pk_live_…` in EAS `production`)
     Allowlisting Preview does **not** apply to Production (and the reverse).
4. Ensure **Email + password** and **Email verification code** are enabled for email flows.
5. Keep **Account linking** enabled for social connections so Google sign-in joins the existing email/password Clerk user instead of creating a second Clerk user for the same verified email.
6. If custom mobile sign-up/sign-in fail with captcha errors, disable or reconfigure **Bot protection** for that Clerk instance so custom Expo flows are allowed.

Do not confuse this with Google Cloud “Authorized redirect URIs” for the Google OAuth client — those belong to Clerk’s Google connection setup (`https://clerk.sdvedutech.in/v1/oauth_callback`). The error `does not match an authorized redirect URI` with `surveyapp://sso-callback` is the **Clerk native allowlist**.

When Google still creates a separate Clerk user (legacy duplicates), Nest rebinds the application `User.clerkUserId` to the authenticated session subject only when Clerk reports a **verified** email match — preserving the same `User.id`, roles, and survey history. Unverified email matches are refused.

### Nest API auth notes

- Nest validates the Clerk session JWT with `CLERK_SECRET_KEY` from the **same** Clerk instance as the mobile publishable key (test with test, live with live).
- If `CLERK_AUTHORIZED_PARTIES` is set, browser tokens with a present `azp` must match that list. Expo/native tokens that omit `azp` are accepted after signature verification (do not invent a mobile party URL).
- CORS (`CORS_ORIGIN`) applies to browsers (Expo web / Next). Native Android/iOS clients do not use CORS.

## Commands (run from repo root)

```bash
pnpm install
pnpm --filter mobile dev       # Expo Metro (same as pnpm dev:mobile)
pnpm mobile:android            # Boot emulator (wait until ready) + Expo --android
pnpm mobile:android:boot       # Boot / wait for emulator only (use when Metro already runs)
pnpm mobile:ios                # Expo start --ios (macOS)
pnpm --filter mobile web       # Expo web
pnpm --filter mobile lint
pnpm --filter mobile typecheck
```

`pnpm dev` at the root also starts the mobile Expo server together with api, web, and worker. It does **not** auto-launch an emulator.

### Recommended Android workflow

**A — single command**

```bash
pnpm mobile:android
```

This waits until `adb` reports a fully booted device (`sys.boot_completed=1`) before Expo connects. That avoids the common Windows error:

`could not connect to TCP port 5554 … actively refused`

It also runs `adb reverse` for Metro ports and sets `REACT_NATIVE_PACKAGER_HOSTNAME=localhost` so Expo Go on the emulator does not try a Docker/WSL LAN IP (which shows as Expo Go’s “Something went wrong” screen).

**B — Metro already running** (`pnpm dev` / `pnpm --filter mobile dev`)

```bash
pnpm mobile:android:boot   # wait until emulator is ready
# then press "a" in the Expo terminal
```

Do **not** press `a` while the emulator is still starting — Expo will race ADB and fail on port 5554.

### Emulator stuck / offline recovery

```powershell
taskkill /F /IM qemu-system-x86_64.exe
taskkill /F /IM emulator.exe
adb kill-server
adb start-server
adb devices
pnpm mobile:android
```

If it keeps failing: Android Studio → Device Manager → **Cold Boot Now** or **Wipe Data**.

## Layout

```
src/app/                 # Expo Router only (thin screens)
src/features/auth/
  session/               # AppSessionProvider + profile gate
  hooks/                 # sign-in / sign-up / forgot / Google
  ui/                    # AuthBrandHeader, AuthScreenShell
  lib/                   # clerk-errors
src/features/home/       # Admin / survey role home shells
src/components/ui/       # Screen, Button, TextField, StatusView
src/theme/               # colors, spacing, typography
src/lib/                 # env helpers
src/services/api/        # Nest HTTP client + resources
src/services/auth/       # ClerkProvider + token cache
src/types/               # profile / role helpers
```

Auth uses `@clerk/expo` (Core 3). Custom email flows use `@clerk/expo/legacy` hooks for stable `create` / `setActive` APIs.

Business logic belongs in features/services/hooks — not in route files.
