import type { TokenCache } from "@clerk/expo";
import * as ClerkExpo from "@clerk/expo";
import { createElement, type ReactNode } from "react";

export type AppClerkProviderProps = {
  publishableKey: string;
  tokenCache?: TokenCache;
  children?: ReactNode;
};

type ClerkProviderComponent = (
  props: AppClerkProviderProps,
) => React.ReactElement | null;

/**
 * Typed ClerkProvider for Expo (`@clerk/expo`).
 *
 * Namespace import + cast keeps a stable typed API when editor hosts struggle
 * with re-exported named types from the Clerk package graph.
 */
export function ClerkProvider(props: AppClerkProviderProps) {
  const Provider = (
    ClerkExpo as unknown as { ClerkProvider: ClerkProviderComponent }
  ).ClerkProvider;
  return createElement(Provider, props);
}
