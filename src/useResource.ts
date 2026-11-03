import { useCallback, useEffect, useRef, useState } from "react";
import { retryDelay } from "./data";

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  retryAt: number;
  checkedAt: number | null;
  retry: () => void;
}

export function useResource<T>(
  url: string,
  parse: (value: unknown) => T,
  interval: number,
): Resource<T> {
  const [state, setState] = useState<Omit<Resource<T>, "retry">>({
    data: null,
    error: null,
    loading: true,
    retryAt: 0,
    checkedAt: null,
  });
  const run = useRef<() => void>(() => {});
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let nextAllowed = 0;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | null = null;
    let failures = 0;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(
        () => {
          void load();
        },
        Math.min(delay, 2_147_483_647),
      );
    };
    async function load(manual = false) {
      if (!alive || inFlight) return;
      if (Date.now() < nextAllowed) {
        schedule(nextAllowed - Date.now());
        return;
      }
      if (document.hidden && !manual) {
        schedule(interval);
        return;
      }
      inFlight = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 12_000);
      let delay = interval;
      setState((s) => ({ ...s, loading: true }));
      try {
        // Browser HTTP caching revalidates ETags without relying on CORS-exposed headers.
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-cache",
          credentials: "omit",
          referrerPolicy: "no-referrer",
        });
        if (response.status === 429 || response.status === 503) {
          delay = retryDelay(response.headers.get("Retry-After"));
          nextAllowed = Date.now() + delay;
          throw new Error(
            response.status === 429
              ? "Too many requests. Waiting before trying again."
              : "Readings are temporarily unavailable. Retrying automatically.",
          );
        }
        if (!response.ok)
          throw new Error(
            `Readings could not be loaded (${response.status}). Retrying automatically.`,
          );
        const data = parse(await response.json());
        failures = 0;
        nextAllowed = Date.now() + interval;
        if (alive)
          setState({
            data,
            error: null,
            loading: false,
            retryAt: 0,
            checkedAt: Date.now(),
          });
      } catch (error) {
        failures += 1;
        delay = Math.max(
          delay,
          Math.min(interval * 2 ** Math.min(failures - 1, 4), 300_000),
        );
        nextAllowed = Math.max(nextAllowed, Date.now() + delay);
        const message =
          error instanceof TypeError
            ? "Unable to reach the public readings. Check your connection; retrying automatically."
            : error instanceof SyntaxError
              ? "The public readings could not be understood. Retrying automatically."
              : error instanceof Error && error.name !== "AbortError"
                ? error.message
                : "The signal timed out. Check your connection; retrying automatically.";
        if (alive)
          setState((s) => ({
            ...s,
            loading: false,
            retryAt: nextAllowed,
            error: message,
          }));
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (alive) schedule(Math.max(delay, nextAllowed - Date.now()));
      }
    }
    run.current = () => {
      void load(true);
    };
    const visible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visible);
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", visible);
    };
  }, [url, parse, interval]);
  const retry = useCallback(() => run.current(), []);
  return { ...state, retry };
}
