/**
 * Ensure an Android emulator/device is online and fully booted, then start Expo.
 * Cross-platform (Windows / macOS / Linux). Does not hardcode AVD names.
 *
 * Fixes the common race where Expo opens Pixel_* before ADB accepts :5554
 * ("could not connect to TCP port 5554 … actively refused").
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const BOOT_TIMEOUT_MS = 180_000;
const POLL_MS = 2_000;

function sdkRoot() {
  const root = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "";
  return root.trim();
}

function exe(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function toolPath(...segments) {
  return path.join(sdkRoot(), ...segments);
}

function requireSdk() {
  const root = sdkRoot();
  if (!root) {
    console.error(
      "[android] ANDROID_HOME / ANDROID_SDK_ROOT is not set.\n" +
        "Install Android Studio, then set ANDROID_HOME to your SDK path\n" +
        "(typical Windows: %LOCALAPPDATA%\\Android\\Sdk).",
    );
    process.exit(1);
  }
  const adb = toolPath("platform-tools", exe("adb"));
  if (!existsSync(adb)) {
    console.error(`[android] adb not found at ${adb}`);
    process.exit(1);
  }
  return { root, adb, emulator: toolPath("emulator", exe("emulator")) };
}

function run(bin, args, opts = {}) {
  const result = spawnSync(bin, args, {
    encoding: "utf8",
    windowsHide: true,
    ...opts,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseAdbDevices(stdout) {
  const devices = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("List of devices")) continue;
    const [serial, state] = trimmed.split(/\s+/);
    if (!serial || !state) continue;
    devices.push({ serial, state });
  }
  return devices;
}

function listDevices(adb) {
  const { stdout } = run(adb, ["devices"]);
  return parseAdbDevices(stdout);
}

function onlineDevices(adb) {
  return listDevices(adb).filter((d) => d.state === "device");
}

function hasOfflineEmulator(adb) {
  return listDevices(adb).some(
    (d) => d.state === "offline" && d.serial.startsWith("emulator-"),
  );
}

function resetAdb(adb) {
  console.log("[android] Resetting ADB…");
  run(adb, ["kill-server"]);
  run(adb, ["start-server"]);
}

function listAvds(emulatorBin) {
  if (!existsSync(emulatorBin)) {
    console.error(`[android] emulator binary not found at ${emulatorBin}`);
    process.exit(1);
  }
  const { stdout, status, stderr } = run(emulatorBin, ["-list-avds"]);
  if (status !== 0) {
    console.error(stderr || "[android] Failed to list AVDs");
    process.exit(1);
  }
  return stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function pickAvd(avds) {
  const preferred = process.env.ANDROID_AVD?.trim();
  if (preferred) {
    if (!avds.includes(preferred)) {
      console.error(
        `[android] ANDROID_AVD=${preferred} not found. Available: ${avds.join(", ") || "(none)"}`,
      );
      process.exit(1);
    }
    return preferred;
  }
  if (avds.length === 0) {
    console.error(
      "[android] No AVDs found. Create one in Android Studio → Device Manager.",
    );
    process.exit(1);
  }
  if (avds.length > 1) {
    console.log(
      `[android] Multiple AVDs found (${avds.join(", ")}). Using "${avds[0]}".\n` +
        "          Set ANDROID_AVD=<name> to choose a different one.",
    );
  }
  return avds[0];
}

function startEmulator(emulatorBin, avd) {
  console.log(`[android] Starting emulator "${avd}" (cold boot, no snapshot)…`);
  const child = spawn(
    emulatorBin,
    ["-avd", avd, "-no-snapshot-load"],
    {
      detached: true,
      stdio: "ignore",
      windowsHide: false,
      env: {
        ...process.env,
        ANDROID_HOME: sdkRoot(),
        ANDROID_SDK_ROOT: sdkRoot(),
      },
    },
  );
  child.unref();
}

function bootCompleted(adb, serial) {
  const { stdout, status } = run(adb, [
    "-s",
    serial,
    "shell",
    "getprop",
    "sys.boot_completed",
  ]);
  if (status !== 0) return false;
  return stdout.trim() === "1";
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBootedDevice(adb) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (hasOfflineEmulator(adb)) {
      console.log("[android] Emulator reported offline — resetting ADB…");
      resetAdb(adb);
    }

    const online = onlineDevices(adb);
    for (const device of online) {
      if (bootCompleted(adb, device.serial)) {
        console.log(`[android] Device ready: ${device.serial}`);
        return device.serial;
      }
      console.log(`[android] Waiting for boot: ${device.serial}…`);
    }

    if (online.length === 0) {
      console.log("[android] Waiting for emulator/device…");
    }
    await sleep(POLL_MS);
  }

  console.error(
    "[android] Timed out waiting for a booted Android device.\n" +
      "  1. Close any hung emulator windows / Task Manager → qemu-system-x86_64\n" +
      "  2. Android Studio → Device Manager → Cold Boot Now (or Wipe Data)\n" +
      "  3. Confirm: adb devices  (state must be \"device\", not \"offline\")\n" +
      "  4. Re-run: pnpm mobile:android\n" +
      "If the AVD uses a *ps16k* system image and keeps failing, create a new AVD\n" +
      "with a standard google_apis image (non-ps16k).",
  );
  process.exit(1);
}

async function ensureAndroidDevice({ adb, emulator }) {
  resetAdb(adb);

  if (hasOfflineEmulator(adb)) {
    console.log(
      "[android] Found offline emulator entry. Reset ADB again; if it persists,\n" +
        "          kill qemu-system-x86_64.exe in Task Manager, then retry.",
    );
    resetAdb(adb);
    await sleep(1500);
    if (hasOfflineEmulator(adb)) {
      console.error(
        "[android] Emulator is stuck offline (ADB port 5554 race).\n" +
          "Kill qemu-system-x86_64.exe / emulator.exe in Task Manager, then:\n" +
          "  adb kill-server && adb start-server && pnpm mobile:android",
      );
      process.exit(1);
    }
  }

  let online = onlineDevices(adb);
  if (online.length === 0) {
    const avd = pickAvd(listAvds(emulator));
    startEmulator(emulator, avd);
  } else {
    console.log(
      `[android] Using already-connected device: ${online.map((d) => d.serial).join(", ")}`,
    );
  }

  return waitForBootedDevice(adb);
}

function startExpoAndroid(serial) {
  console.log(`[android] Starting Expo with ANDROID_SERIAL=${serial}`);
  const child = spawn("pnpm", ["exec", "expo", "start", "--android"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ANDROID_HOME: sdkRoot(),
      ANDROID_SDK_ROOT: sdkRoot(),
      ANDROID_SERIAL: serial,
    },
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

const ensureOnly = process.argv.includes("--ensure-only");
const tools = requireSdk();
const serial = await ensureAndroidDevice(tools);
if (ensureOnly) {
  console.log(`[android] Device ready (${serial}). Press "a" in Expo, or open Expo Go.`);
  process.exit(0);
}
startExpoAndroid(serial);