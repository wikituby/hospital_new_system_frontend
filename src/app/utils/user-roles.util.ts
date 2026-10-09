/** Session keys for primary + secondary roles. */
export const USER_ROLE_SESSION_KEY = 'userrole';
export const USER_SECONDARY_ROLES_SESSION_KEY = 'userSecondaryRoles';

/** Split a comma-separated roles string into trimmed unique values. */
export function parseRolesCsv(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  const seen = new Set<string>();
  const roles: string[] = [];
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    roles.push(trimmed);
  }
  return roles;
}

export function rolesToCsv(roles: string[] | null | undefined): string {
  return parseRolesCsv((roles || []).join(',')).join(',');
}

/** Primary role used for post-login redirect. */
export function getPrimaryRole(user?: { role?: string } | null): string {
  if (user?.role != null && String(user.role).trim()) {
    return String(user.role).trim();
  }
  return (sessionStorage.getItem(USER_ROLE_SESSION_KEY) || '').trim();
}

/** Secondary roles (excludes primary). */
export function getSecondaryRoles(user?: { role?: string; secondaryRoles?: string } | null): string[] {
  const primary = getPrimaryRole(user).toLowerCase();
  const fromUser = user?.secondaryRoles != null
    ? parseRolesCsv(user.secondaryRoles)
    : parseRolesCsv(sessionStorage.getItem(USER_SECONDARY_ROLES_SESSION_KEY));
  return fromUser.filter((role) => role.toLowerCase() !== primary);
}

/** All roles: primary first, then secondaries. */
export function getAllUserRoles(user?: { role?: string; secondaryRoles?: string } | null): string[] {
  const primary = getPrimaryRole(user);
  const secondary = getSecondaryRoles(user);
  if (!primary) {
    return secondary;
  }
  return [primary, ...secondary.filter((role) => role.toLowerCase() !== primary.toLowerCase())];
}

export function userHasRole(roleName: string, user?: { role?: string; secondaryRoles?: string } | null): boolean {
  const target = (roleName || '').toLowerCase().trim();
  if (!target) {
    return false;
  }
  return getAllUserRoles(user).some((role) => role.toLowerCase() === target);
}

export function userHasAnyRole(
  roleNames: string[],
  user?: { role?: string; secondaryRoles?: string } | null
): boolean {
  return roleNames.some((name) => userHasRole(name, user));
}

/** Primary role plus secondaries, ignoring blank and placeholder values. */
const UNASSIGNED_ROLE_NAMES = new Set(['undefined', 'null', 'none', 'n/a', 'unassigned', '-']);

export function userHasAssignedRole(user?: { role?: string; secondaryRoles?: string } | null): boolean {
  return getAllUserRoles(user).some((role) => {
    const key = role.toLowerCase().trim();
    return !!key && !UNASSIGNED_ROLE_NAMES.has(key);
  });
}

export const NO_ROLE_ASSIGNED_MESSAGE =
  'Your account has no role assigned. Contact an administrator to get a role assigned.';

/** Persist primary + secondary roles after login (or profile refresh). */
export function persistUserRolesToSession(user: { role?: string; secondaryRoles?: string } | null | undefined): void {
  const primary = (user?.role || '').toString().trim();
  const secondaryCsv = rolesToCsv(getSecondaryRoles(user));
  if (primary) {
    sessionStorage.setItem(USER_ROLE_SESSION_KEY, primary);
  } else {
    sessionStorage.removeItem(USER_ROLE_SESSION_KEY);
  }
  if (secondaryCsv) {
    sessionStorage.setItem(USER_SECONDARY_ROLES_SESSION_KEY, secondaryCsv);
  } else {
    sessionStorage.removeItem(USER_SECONDARY_ROLES_SESSION_KEY);
  }
}

export function clearUserRolesFromSession(): void {
  sessionStorage.removeItem(USER_ROLE_SESSION_KEY);
  sessionStorage.removeItem(USER_SECONDARY_ROLES_SESSION_KEY);
}
