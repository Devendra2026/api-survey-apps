# Mobile (Expo)

Expo SDK 57 / React Native field client in the `api-survey-apps` Turborepo.

Package name: `mobile` (`pnpm --filter mobile …`).

## Prerequisites

- From the **repository root**: Node 24+, pnpm 11 (`corepack enable`)
- For Android: Android Studio, Android SDK, an emulator (AVD), and `ANDROID_HOME` / `ANDROID_SDK_ROOT`
- Do not hardcode emulator names; the launch script discovers AVDs (override with `ANDROID_AVD=<name>`)

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

Your `Pixel_9` AVD uses a `ps16k` system image. If it remains unstable, create a new AVD with a standard **google_apis** image (non-`ps16k`).

## API URL (Android emulator)

`localhost` on the Android emulator is not your host machine. Point the app at:

- Android emulator: `http://10.0.2.2:4000`
- iOS simulator / Expo web: `http://localhost:4000`

See [`deploy/env/mobile.env.example`](../../deploy/env/mobile.env.example) (`EXPO_PUBLIC_API_URL`). Defaults are applied in `src/lib/env.ts` when the env var is unset.

Never put API secrets, Clerk secret keys, database URLs, or AWS credentials in the mobile app.

## Layout

```
src/app/              # Expo Router (thin routes)
src/lib/              # env helpers
src/services/api/     # centralized fetch client
src/services/auth/    # auth surface (Clerk wired later)
```

Business logic belongs in features/services/hooks — not in route files.
