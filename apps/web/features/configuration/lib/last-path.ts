import { CONFIG_BASE } from "./types"

export const LAST_PATH_KEY = "config.registry.lastPath"

export function loadConfigLastPath(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(LAST_PATH_KEY)
    if (!raw || !raw.startsWith(CONFIG_BASE)) return null
    return raw
  } catch {
    return null
  }
}

export function saveConfigLastPath(path: string): void {
  if (typeof window === "undefined") return
  if (!path.startsWith(CONFIG_BASE)) return
  try {
    sessionStorage.setItem(LAST_PATH_KEY, path)
  } catch {
    /* ignore quota */
  }
}
