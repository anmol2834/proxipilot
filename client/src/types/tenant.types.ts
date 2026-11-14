export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  plan: "starter" | "growth" | "enterprise";
  createdAt: string;
}

export interface TenantMembership {
  id: string;
  tenantId: string;
  userId: string;
  role: "Owner" | "Admin" | "Manager" | "Member" | "Viewer";
}
