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

#### Production / release builds

Before bundling a store or other release binary, set release env (EAS secrets, CI, or a local release `.env`) so Expo inlines the production values at build time:

```bash
EXPO_PUBLIC_API_URL=https://your-api.example.com
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
```

- Use the same Clerk **production** instance publishable key as web (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `pk_live_…` from the Clerk Dashboard).
- Never put `CLERK_SECRET_KEY` in the mobile app.
- Nest API must use the matching production Clerk secret so session JWTs validate.
- Non-dev builds reject `pk_test_` keys (see `getClerkPublishableKey` in `src/lib/env.ts`).

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

After Clerk sign-in the app calls Nest `GET /users/me` with the session JWT. A **401** shows **Unable to continue** / session could not be verified.

Checklist:

1. Nest API is running (`pnpm --filter api dev`) and reachable — Android emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`.
2. Mobile `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and API `CLERK_SECRET_KEY` are from the **same** Clerk instance (`pk_test_` with `sk_test_`).
3. Local API: leave `CLERK_AUTHORIZED_PARTIES` **empty**. A web-only value such as `http://localhost:3000` will 401 mobile after Clerk login with **Invalid or expired token**.
4. Production: if you set `CLERK_AUTHORIZED_PARTIES`, include the mobile JWT `azp` (decode a session token) in addition to web origins — web-only lists break native clients.
5. In `__DEV__`, the error screen includes the Nest message and API base URL to speed up diagnosis.

The Clerk LogBox toast about **development keys** is expected for local Expo and is not this error.

### Google OAuth (Clerk Dashboard)

1. Enable the **Google** social connection on the same Clerk instance as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`.
2. Under Clerk redirect / native allowlist, add the Expo redirect URI for this app scheme, e.g. `mobile://sso-callback` (and any Expo AuthSession URI shown in logs for your build).
3. Ensure **Email + password** and **Email verification code** are enabled for email flows.
4. If custom mobile sign-up/sign-in fail with captcha errors, disable or reconfigure **Bot protection** for that Clerk instance so custom Expo flows are allowed.

### Nest API auth notes

- Nest validates the Clerk session JWT with `CLERK_SECRET_KEY` from the **same** Clerk instance as the mobile publishable key (test with test, live with live).
- If `CLERK_AUTHORIZED_PARTIES` is set on the API, the JWT `azp` from mobile sessions must be included—or leave the variable empty (web-only party lists will 401 mobile with **Invalid or expired token** after an otherwise successful Clerk login).
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
