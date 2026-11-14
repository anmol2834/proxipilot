import { UserRole } from "@/types/user.types";

export const PERMISSIONS = {
  // Inbox / Email
  "email.read": ["Owner", "Admin", "Manager", "Member", "Viewer"],
  "email.reply": ["Owner", "Admin", "Manager", "Member"],
  "email.send": ["Owner", "Admin", "Manager", "Member"],
  "email.delete": ["Owner", "Admin"],

  // Automation
  "automation.read": ["Owner", "Admin", "Manager", "Member", "Viewer"],
  "automation.create": ["Owner", "Admin", "Manager"],
  "automation.update": ["Owner", "Admin", "Manager"],
  "automation.delete": ["Owner", "Admin"],
  "automation.execute": ["Owner", "Admin", "Manager", "Member"],

  // Knowledge base
  "knowledge.read": ["Owner", "Admin", "Manager", "Member", "Viewer"],
  "knowledge.upload": ["Owner", "Admin", "Manager", "Member"],
  "knowledge.delete": ["Owner", "Admin"],

  // Analytics
  "analytics.view": ["Owner", "Admin", "Manager", "Member", "Viewer"],
  "analytics.export": ["Owner", "Admin", "Manager"],

  // Billing
  "billing.view": ["Owner", "Admin"],
  "billing.manage": ["Owner"],

  // Workspace / Team management
  "team.invite": ["Owner", "Admin", "Manager"],
  "team.manage_roles": ["Owner", "Admin"],
  "team.remove_members": ["Owner", "Admin"],

  // Settings
  "settings.view": ["Owner", "Admin", "Manager", "Member", "Viewer"],
  "settings.manage": ["Owner", "Admin"],
} as const;

export type AppPermission = keyof typeof PERMISSIONS;

export interface PermissionSubject {
  role?: UserRole;
  [key: string]: unknown;
}

/**
 * Evaluates whether a subject has permission to perform an action.
 * NOTE: Frontend checks are strictly for UI conditional presentation (hiding buttons, disabling inputs).
 * True authorization MUST be strictly verified on the backend API on every request.
 */
export function can(
  subject: PermissionSubject | null | undefined,
  permission: AppPermission
): boolean {
  if (!subject || !subject.role) {
    return false;
  }

  // The backend stores role names upper-case ("OWNER"); compare case-insensitively.
  const role = String(subject.role).trim().toLowerCase();
  const allowedRoles = PERMISSIONS[permission] as readonly UserRole[];
  return allowedRoles.some((r) => r.toLowerCase() === role);
}
