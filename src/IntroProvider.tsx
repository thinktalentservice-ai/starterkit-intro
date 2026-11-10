import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { IntroContext } from "./context";
import { IntroTour } from "./IntroTour";
import { normalizeRoute, routeToIntroPath, validateIntro } from "./schema";
import type { IntroDocument } from "./schema";
import { DEFAULT_STORAGE_KEY, readIntroState, writeIntroState } from "./storage";
import type { IntroCloseReason, IntroContextValue, IntroEvent, IntroLabels, IntroTourEvent } from "./types";

export interface IntroProviderProps {
  /** Current pathname from the host's router. Query and hash are ignored. */
  pathname: string;
  /** Where the intro JSON files live, e.g. "/starterkit-user/intro". */
  baseUrl: string;
  /** Start the tour on its own the first time a visitor sees a revision. */
  autoStart?: boolean;
  /** Milliseconds to wait after the document loads before auto-starting. */
  autoStartDelay?: number;
  storageKey?: string;
  /** Return the parsed JSON, or null/undefined for "no intro here". Throw for a failure. */
  fetchIntro?: (url: string, signal: AbortSignal) => Promise<unknown>;
  onEvent?: (event: IntroEvent) => void;
  labels?: Partial<IntroLabels>;
  children?: ReactNode;
}

const TAG = "[starterkit-intro]";

/** 404 is "this page has no intro", which is normal; anything else not ok is a fault. */
const defaultFetchIntro = async (url: string, signal: AbortSignal): Promise<unknown> => {
  const response = await fetch(url, { cache: "no-cache", signal, credentials: "same-origin" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

const joinUrl = (base: string, file: string) => `${base.replace(/\/+$/, "")}/${file}`;

export function IntroProvider({
  pathname,
  baseUrl,
  autoStart = true,
  autoStartDelay = 700,
  storageKey = DEFAULT_STORAGE_KEY,
  fetchIntro = defaultFetchIntro,
  onEvent,
  labels,
  children,
}: IntroProviderProps) {
  const [doc, setDoc] = useState<IntroDocument | null>(null);
  const [route, setRoute] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [autoStartEnabled, setAutoStartEnabledState] = useState(true);

  // Props the async code reads at call time. Putting them in effect deps would
  // refetch on every render for a host passing an inline arrow.
  const fetchRef = useRef(fetchIntro);
  const eventRef = useRef(onEvent);
  const docRef = useRef<IntroDocument | null>(null);
  const runningRef = useRef(false);
  const keyRef = useRef(storageKey);
  const warned = useRef(new Set<string>());
  useEffect(() => {
    fetchRef.current = fetchIntro;
    eventRef.current = onEvent;
    keyRef.current = storageKey;
  });

  const emit = useCallback((type: IntroEvent["type"], extra?: { stepId?: string; index?: number }) => {
    const current = docRef.current;
    if (!current) return;
    eventRef.current?.({ type, route: current.route, ...extra });
  }, []);

  // The stored preference is only known in the browser; start from the default
  // so the server render and the first client render agree.
  useEffect(() => {
    setAutoStartEnabledState(readIntroState(storageKey).autoStart);
  }, [storageKey]);

  useEffect(() => {
    // A new page: whatever was running belongs to the old one.
    runningRef.current = false;
    docRef.current = null;
    setIsRunning(false);
    setDoc(null);

    const normalized = normalizeRoute(pathname);
    const file = routeToIntroPath(pathname);
    setRoute(normalized);
    if (!normalized || !file) return;

    const url = joinUrl(baseUrl, file);
    const controller = new AbortController();
    const warnOnce = (problems: string[]) => {
      if (warned.current.has(url)) return;
      warned.current.add(url);
      console.warn(`${TAG} ignoring ${url}:\n  ${problems.join("\n  ")}`);
    };

    void (async () => {
      try {
        const raw = await fetchRef.current(url, controller.signal);
        if (controller.signal.aborted || raw === null || raw === undefined) return;
        const result = validateIntro(raw);
        if (!result.ok) return warnOnce(result.errors);
        if (result.doc.route !== normalized) {
          return warnOnce([`route: document says "${result.doc.route}" but it was loaded for "${normalized}"`]);
        }
        const steps = result.doc.steps.filter((s) => !s.draft);
        if (steps.length === 0) return;
        const loaded: IntroDocument = { ...result.doc, steps };
        docRef.current = loaded;
        setDoc(loaded);
        emit("loaded");
      } catch (error) {
        if (controller.signal.aborted) return;
        warnOnce([error instanceof Error ? error.message : String(error)]);
      }
    })();

    return () => controller.abort();
  }, [pathname, baseUrl, emit]);

  const start = useCallback(() => {
    if (!docRef.current || runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    emit("start");
  }, [emit]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);
  }, []);

  // Auto-start decides at the moment the timer fires, from storage as it is
  // then, not as it was at render: another tab may have finished this tour.
  useEffect(() => {
    if (!doc || !autoStart) return;
    const timer = window.setTimeout(() => {
      const state = readIntroState(keyRef.current);
      if (!state.autoStart || state.seen[doc.route] === doc.revision) return;
      start();
    }, autoStartDelay);
    return () => window.clearTimeout(timer);
  }, [doc, autoStart, autoStartDelay, start]);

  const handleClose = useCallback(
    (reason: IntroCloseReason) => {
      const current = docRef.current;
      runningRef.current = false;
      setIsRunning(false);
      // Nothing was shown, so there is nothing to remember: the targets may just
      // not have rendered yet, and the next visit should try again.
      if (!current || reason === "empty") return;
      const state = readIntroState(keyRef.current);
      writeIntroState(keyRef.current, { ...state, seen: { ...state.seen, [current.route]: current.revision } });
      emit(reason === "done" ? "complete" : "skip");
    },
    [emit],
  );

  const handleTourEvent = useCallback(
    (event: IntroTourEvent) => emit(event.type, { stepId: event.stepId, index: event.index }),
    [emit],
  );

  const setAutoStartEnabled = useCallback((enabled: boolean) => {
    setAutoStartEnabledState(enabled);
    const state = readIntroState(keyRef.current);
    writeIntroState(keyRef.current, { ...state, autoStart: enabled });
  }, []);

  const value = useMemo<IntroContextValue>(
    () => ({
      hasIntro: doc !== null,
      isRunning,
      route,
      doc,
      start,
      stop,
      autoStartEnabled,
      setAutoStartEnabled,
    }),
    [doc, isRunning, route, start, stop, autoStartEnabled, setAutoStartEnabled],
  );

  return (
    <IntroContext.Provider value={value}>
      {children}
      {isRunning && doc && (
        <IntroTour key={`${doc.route}@${doc.revision}`} steps={doc.steps} labels={labels} onClose={handleClose} onEvent={handleTourEvent} />
      )}
    </IntroContext.Provider>
  );
}
