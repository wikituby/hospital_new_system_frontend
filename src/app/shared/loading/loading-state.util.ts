import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

type LoadingTarget = Record<string, boolean>;

/**
 * Keeps legacy paired loader flags in sync (showDiv* + isLoadingNew*).
 */
export function setPairedLoadingFlag(
  target: LoadingTarget,
  showKey: string,
  loadingKey: string,
  value: boolean
): void {
  target[showKey] = value;
  target[loadingKey] = value;
}

/**
 * Runs an observable while toggling a single loading flag; always clears on complete/error.
 */
export function runWithLoadingFlag<T>(
  target: LoadingTarget,
  flagKey: string,
  source: Observable<T>,
  setLoading: (value: boolean) => void = (value) => {
    target[flagKey] = value;
  }
): Observable<T> {
  setLoading(true);
  return source.pipe(finalize(() => setLoading(false)));
}

/**
 * Helper for components that still use manual subscribe blocks.
 */
export function subscribeWithLoading<T>(
  source: Observable<T>,
  setLoading: (value: boolean) => void,
  handlers: {
    next: (value: T) => void;
    error?: (error: unknown) => void;
  }
): Subscription {
  setLoading(true);
  return source.subscribe({
    next: handlers.next,
    error: (error) => {
      setLoading(false);
      handlers.error?.(error);
    },
    complete: () => setLoading(false)
  });
}
