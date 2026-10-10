const RELOAD_KEY = "wf:stale-chunk-reload";

/** True when a route/module failed to load (often after a fresh deploy with an old tab open). */
export function isStaleChunkError(error: unknown): boolean {
  if (!error) return false;
  const name = typeof error === "object" && error && "name" in error ? String((error as any).name) : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error && "message" in error
          ? String((error as any).message)
          : String(error);

  if (name === "ChunkLoadError") return true;
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk [\w.-]+ failed|Unable to preload CSS|error loading CSS chunk/i.test(
    message,
  );
}

/** One-time hard reload to pick up the latest deploy assets. Returns true if a reload was triggered. */
export function tryRecoverFromStaleChunk(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isStaleChunkError(error)) return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") {
      sessionStorage.removeItem(RELOAD_KEY);
      return false;
    }
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    // sessionStorage blocked — still attempt a single reload via URL flag
    if (window.location.search.includes("wf_reload=1")) return false;
    const url = new URL(window.location.href);
    url.searchParams.set("wf_reload", "1");
    window.location.replace(url.toString());
    return true;
  }
  window.location.reload();
  return true;
}

export function clearStaleChunkReloadFlag() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("wf_reload")) {
      url.searchParams.delete("wf_reload");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
  } catch {
    /* ignore */
  }
}
