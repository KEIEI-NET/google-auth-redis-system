import { Employee, UserRole, Permission } from '../types';

// Note: Token management is now handled via httpOnly cookies on the backend
// These utilities are kept for backward compatibility but no longer manage tokens directly

// Role checking utilities
export function hasRole(user: Employee | null, role: UserRole): boolean {
  if (!user) return false;
  return user.roles.includes(role);
}

export function hasAnyRole(user: Employee | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.some(role => user.roles.includes(role));
}

export function hasAllRoles(user: Employee | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.every(role => user.roles.includes(role));
}

// Permission checking utilities
export function hasPermission(user: Employee | null, permission: Permission): boolean {
  if (!user || !user.permissions) return false;
  return user.permissions.includes(permission);
}

export function hasAnyPermission(user: Employee | null, permissions: Permission[]): boolean {
  if (!user || !user.permissions) return false;
  return permissions.some(permission => user.permissions!.includes(permission));
}

export function hasAllPermissions(user: Employee | null, permissions: Permission[]): boolean {
  if (!user || !user.permissions) return false;
  return permissions.every(permission => user.permissions!.includes(permission));
}

// Check if user is admin
export function isAdmin(user: Employee | null): boolean {
  return hasAnyRole(user, [UserRole.SUPER_ADMIN, UserRole.ADMIN]);
}

// Check if user is manager or above
export function isManagerOrAbove(user: Employee | null): boolean {
  return hasAnyRole(user, [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER]);
}