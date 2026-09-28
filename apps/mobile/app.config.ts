import type { ConfigContext, ExpoConfig } from "expo/config"

/**
 * Cleartext HTTP is only for local Nest (`http://…`).
 * Production must use HTTPS via EXPO_PUBLIC_API_URL.
 */
function allowCleartextTraffic(): boolean {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? ""
  if (!apiUrl) {
    return true
  }
  return apiUrl.startsWith("http://")
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const cleartext = allowCleartextTraffic()

  return {
    ...config,
    name: "mobile",
    slug: "mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "mobile",
    userInterfaceStyle: "automatic",
    ios: {
      bundleIdentifier: "com.sdvedutech.surveymobile",
      icon: "./assets/expo.icon",
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
          backgroundColor: "#208AEF",
          image: "./assets/images/splash-icon.png",
          imageWidth: 76,
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
  }
}
