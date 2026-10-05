type OwnerFlush = () => Promise<void>

const flushers = new Set<OwnerFlush>()

/** Registers an owner-row save so Save draft persists co-owners before the survey patch. */
export function registerOwnerFlush(flush: OwnerFlush): () => void {
  flushers.add(flush)
  return () => {
    flushers.delete(flush)
  }
}

export async function flushOwnerEdits(): Promise<void> {
  const pending = [...flushers]
  await Promise.all(pending.map((flush) => flush()))
}
