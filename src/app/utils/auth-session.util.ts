export const AUTH_SESSION_CHANGED_EVENT = 'app-auth-session-changed';

export function notifyAuthSessionChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
}
