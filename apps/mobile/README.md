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

### Local API URL by device

| Client                   | URL when env unset / typical local value                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Android emulator         | `http://10.0.2.2:4000`                                                                                                             |
| iOS simulator / Expo web | `http://localhost:4000`                                                                                                            |
| Physical device          | LAN IP of your machine on port 4000 (e.g. `http://192.168.1.20:4000`). If unset, the app uses the Expo Metro host IP on port 4000. |

Start Nest (`pnpm --filter api dev`) before signing in. The app calls `GET /users/me` with the Clerk session JWT after login.

Never put API secrets, Clerk secret keys, database URLs, or AWS credentials in the mobile app.

## Auth & onboarding

1. Sign up / sign in with Clerk (email + password; email verification on sign-up).
2. Nest upserts the user on the first authenticated API call and assigns `PENDING_APPROVAL` (or bootstrap `ADMIN`).
3. Until an admin assigns a working role (web **User onboard**), the app shows **Access pending**.
4. Disabled accounts (`isActive: false`) show **Account disabled** and must sign out.

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
src/app/              # Expo Router (thin routes)
src/features/auth/    # session gate, Clerk token bridge
src/components/ui/    # Screen, Button, TextField, StatusView
src/theme/            # colors, spacing, typography
src/lib/              # env helpers
src/services/api/     # centralized fetch client + users
src/services/auth/    # auth surface re-exports
src/types/            # profile / role helpers
```

Business logic belongs in features/services/hooks — not in route files.
