/* What a visitor has already seen, kept in localStorage. Every access is
   guarded: storage throws in private windows, with site data blocked, and does
   not exist at all during SSR. A tour that cannot remember is a tour that shows
   again, never an error in the host. Nothing here runs at module scope. */

export interface IntroState {
  v: 1;
  /** The visitor's "show intro on new pages" preference. */
  autoStart: boolean;
  /** route -> revision the visitor last finished or dismissed. */
  seen: Record<string, number>;
}

export const DEFAULT_STORAGE_KEY = "starterkit-intro";

const defaults = (): IntroState => ({ v: 1, autoStart: true, seen: {} });

export function readIntroState(key: string = DEFAULT_STORAGE_KEY): IntroState {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaults();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return defaults();
    const candidate = parsed as Record<string, unknown>;
    if (candidate["v"] !== 1 || typeof candidate["autoStart"] !== "boolean") return defaults();
    const seenRaw = candidate["seen"];
    if (typeof seenRaw !== "object" || seenRaw === null || Array.isArray(seenRaw)) return defaults();
    const seen: Record<string, number> = {};
    for (const [route, revision] of Object.entries(seenRaw)) {
      if (typeof revision !== "number" || !Number.isFinite(revision)) return defaults();
      seen[route] = revision;
    }
    return { v: 1, autoStart: candidate["autoStart"], seen };
  } catch {
    return defaults();
  }
}

/** Returns false when the write did not stick (blocked or full storage). */
export function writeIntroState(key: string, state: IntroState): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
