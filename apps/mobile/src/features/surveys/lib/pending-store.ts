import AsyncStorage from "@react-native-async-storage/async-storage"
import type { SurveyPatch } from "../types"
import { isEmptyPatch, sanitizePatch } from "./patch"

/**
 * Unsent survey edits, persisted per application user so a killed app or a lost network never drops
 * typed data. The server row in PostgreSQL stays the source of truth once a save is confirmed.
 */
const PREFIX = "survey-pending:v1"

function key(userId: string, surveyId: string): string {
  return `${PREFIX}:${userId}:${surveyId}`
}

export async function loadPendingPatch(userId: string, surveyId: string): Promise<SurveyPatch> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, surveyId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return sanitizePatch(parsed)
  } catch {
    return {}
  }
}

export async function savePendingPatch(userId: string, surveyId: string, patch: SurveyPatch): Promise<void> {
  try {
    if (isEmptyPatch(patch)) {
      await AsyncStorage.removeItem(key(userId, surveyId))
      return
    }
    await AsyncStorage.setItem(key(userId, surveyId), JSON.stringify(patch))
  } catch {
    // Storage full or unavailable: the in-memory patch still syncs while the screen is open.
  }
}

export async function clearPendingPatch(userId: string, surveyId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId, surveyId))
  } catch {
    // Best effort.
  }
}

/** Survey ids with unsent edits for this user (drives the "unsynced" badge on lists). */
export async function listPendingSurveyIds(userId: string): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys()
    const prefix = `${PREFIX}:${userId}:`
    return keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length))
  } catch {
    return []
  }
}
