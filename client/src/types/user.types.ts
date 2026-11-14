export type UserRole = "Owner" | "Admin" | "Manager" | "Member" | "Viewer";

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}
