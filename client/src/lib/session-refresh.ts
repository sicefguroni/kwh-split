/**
 * Single-flight POST /api/auth/refresh using fetch (not api-client) to avoid circular imports.
 */
let refreshInFlight: Promise<boolean> | null = null;

export function resetSessionRefreshForTests(): void {
  refreshInFlight = null;
}

export async function ensureSessionRefreshed(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) {
    return false;
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const init: RequestInit = {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        };
        if (signal) {
          init.signal = signal;
        }
        const response = await fetch("/api/auth/refresh", init);
        return response.ok;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}
