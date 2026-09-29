import type { ConfigContext, ExpoConfig } from "expo/config"

type AppBuildEnv = "development" | "preview" | "production"

function resolveAppEnv(): AppBuildEnv {
  const raw = (process.env.APP_ENV ?? process.env.EAS_BUILD_PROFILE ?? "").trim().toLowerCase()
  if (raw === "preview" || raw === "production" || raw === "development") {
    return raw
  }
  // Local Metro / unset: treat as development (cleartext allowed for emulator defaults).
  return "development"
}

/**
 * Cleartext HTTP is only for local Nest (`http://…`) in development.
 * Preview and production never enable usesCleartextTraffic (HTTPS required).
 */
function allowCleartextTraffic(appEnv: AppBuildEnv): boolean {
  if (appEnv === "production" || appEnv === "preview") {
    return false
  }
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? ""
  if (!apiUrl) {
    // Local Metro / emulator defaults use http://10.0.2.2 or localhost.
    return true
  }
  return apiUrl.startsWith("http://")
}

function displayName(appEnv: AppBuildEnv): string {
  switch (appEnv) {
    case "development":
      return "SDV Survey (Dev)"
    case "preview":
      return "SDV Survey (Preview)"
    case "production":
      // Keep the established store-facing name unless product asks to rebrand.
      return "mobile"
    default: {
      const _exhaustive: never = appEnv
      return _exhaustive
    }
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appEnv = resolveAppEnv()
  const cleartext = allowCleartextTraffic(appEnv)
  // Public client vars only — stamped into `extra` so runtime can fall back when
  // Metro inlining of process.env.EXPO_PUBLIC_* is missing (common on EAS if
  // env was unset at bundle time). Never put CLERK_SECRET_KEY here.
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? ""
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? ""
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ""

  return {
    ...config,
    name: displayName(appEnv),
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "mobile",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "com.sdvedutech.surveymobile",
      icon: "./assets/expo.icon",
      config: {
        googleMapsApiKey: googleMapsApiKey || undefined,
      },
      ...(cleartext
        ? {
            infoPlist: {
              NSAppTransportSecurity: {
                NSAllowsLocalNetworking: true,
              },
            },
          }
        : {}),
    },
    android: {
      package: "com.sdvedutech.surveymobile",
      config: {
        googleMaps: {
          apiKey: googleMapsApiKey || undefined,
        },
      },
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      "@clerk/expo",
      [
        "expo-splash-screen",
        {
          backgroundColor: "#FFFFFF",
          image: "./assets/logo.png",
          imageWidth: 240,
        },
      ],
      "expo-secure-store",
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Survey GPS coordinates are captured at the property location.",
        },
      ],
      [
        "expo-image-picker",
        {
          cameraPermission: "Survey photos document the property for QC review.",
          photosPermission: "Attach existing property photos to a survey.",
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: cleartext,
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      ...(typeof config.extra === "object" && config.extra !== null ? config.extra : {}),
      appEnv,
      expoPublic: {
        apiUrl,
        clerkPublishableKey,
        googleMapsApiKey,
      },
      eas: {
        projectId: "63ac0139-08a9-4ca8-b5e0-d0640a496c57",
      },
    },
  }
}
