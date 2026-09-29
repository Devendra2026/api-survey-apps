/**
 * Autosave status for the survey header chip. Pure reducer so the transitions are unit-tested
 * independently of timers, network and React.
 */
export type SyncStatus =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "synced"; at: number }
  | { kind: "offline"; message: string }
  | { kind: "failed"; message: string }

export type SyncEvent =
  | { type: "edit" }
  | { type: "saveStart" }
  | { type: "saveSuccess"; at: number; hasMoreChanges: boolean }
  | { type: "saveError"; message: string; network: boolean }
  | { type: "reset" }

export function syncReducer(state: SyncStatus, event: SyncEvent): SyncStatus {
  switch (event.type) {
    case "edit":
      return state.kind === "saving" ? state : { kind: "dirty" }
    case "saveStart":
      return { kind: "saving" }
    case "saveSuccess":
      return event.hasMoreChanges ? { kind: "dirty" } : { kind: "synced", at: event.at }
    case "saveError":
      return event.network ? { kind: "offline", message: event.message } : { kind: "failed", message: event.message }
    case "reset":
      return { kind: "idle" }
    default: {
      const exhaustive: never = event
      return exhaustive
    }
  }
}

export type SyncChipTone = "neutral" | "progress" | "success" | "warning" | "danger"

function formatSavedAt(at: number): string {
  try {
    return new Date(at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

export function syncChip(state: SyncStatus): { label: string; tone: SyncChipTone; canRetry: boolean } {
  switch (state.kind) {
    case "idle":
      return { label: "Saved", tone: "neutral", canRetry: false }
    case "dirty":
      return { label: "Pending save…", tone: "neutral", canRetry: false }
    case "saving":
      return { label: "Saving…", tone: "progress", canRetry: false }
    case "synced": {
      const time = formatSavedAt(state.at)
      return { label: time ? `Saved ${time}` : "Saved", tone: "success", canRetry: false }
    }
    case "offline":
      return { label: "Offline saved locally", tone: "warning", canRetry: true }
    case "failed":
      return { label: "Sync failed", tone: "danger", canRetry: true }
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}

/** True while local edits are not yet confirmed by the server. Submit must wait for this to be false. */
export function hasUnsyncedChanges(state: SyncStatus): boolean {
  return state.kind === "dirty" || state.kind === "saving" || state.kind === "offline" || state.kind === "failed"
}
