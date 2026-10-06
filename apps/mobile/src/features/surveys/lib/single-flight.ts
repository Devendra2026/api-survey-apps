/** Allows one overlapping operation. A second call while the first is running is ignored. */
export function createSingleFlight(): { tryBegin: () => boolean; end: () => void } {
  let locked = false
  return {
    tryBegin(): boolean {
      if (locked) {
        return false
      }
      locked = true
      return true
    },
    end(): void {
      locked = false
    },
  }
}
