export type UserRole = 'user' | 'admin' | 'super_admin';

export type AdminPermission =
  | 'admin.read'
  | 'admin.security.read'
  | 'admin.users.manage'
  | 'admin.roles.manage';

const ROLE_PERMISSIONS: Record<UserRole, AdminPermission[]> = {
  user: [],
  admin: ['admin.read', 'admin.security.read'],
  super_admin: ['admin.read', 'admin.security.read', 'admin.users.manage', 'admin.roles.manage'],
};

export const hasAdminPermission = (role: UserRole, permission: AdminPermission): boolean => {
  return ROLE_PERMISSIONS[role].includes(permission);
};

export const isAdminRole = (role: UserRole): boolean => {
  return role === 'admin' || role === 'super_admin';
};
