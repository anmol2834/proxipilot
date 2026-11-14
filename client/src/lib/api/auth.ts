/**
 * Authentication & Onboarding API Client — ProxiPilot
 *
 * Enterprise-grade, strongly typed client functions interacting with
 * the backend FastAPI v1 endpoints.
 */

import { apiClient } from "./client";

export interface SignupRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  agreed_to_terms?: boolean;
}

export interface SignupResponse {
  user_id: string;
  email: string;
  challenge_id: string;
  status: string;
  message: string;
}

export interface VerifyOtpRequest {
  email: string;
  challenge_id: string;
  otp: string;
}

export interface VerifyOtpResponse {
  user_id: string;
  email: string;
  is_verified: boolean;
  access_token: string;
  session_id: string;
}

export interface ResendOtpRequest {
  challenge_id: string;
  email: string;
}

export interface ResendOtpResponse {
  challenge_id: string;
  cooldown_seconds: number;
  message: string;
}

export interface SigninRequest {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface SigninResponse {
  user_id: string;
  email: string;
  access_token: string;
  session_id: string;
  organization_id?: string | null;
  role?: string;
}

export interface UserMeResponse {
  user_id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  organizations: Array<{
    organization_id: string;
    name: string;
    slug: string;
    role: string;
    status: string;
    /** Active members of this organization (real count from the server). */
    member_count?: number;
  }>;
  first_name?: string;
  /** Sign-ins completed after registration: 0 = first session ("Welcome"), >0 = returning ("Welcome back"). */
  login_count?: number;
}

export interface OnboardingStateData {
  current_step: "account" | "organization" | "business" | "workspace" | "completed";
  completed_steps: string[];
  is_completed: boolean;
  next_route: string;
  organization_id?: string | null;
  organization_name?: string | null;
}

export interface OrganizationCreateData {
  name: string;
  slug?: string;
  website?: string;
  industry?: string;
  company_size?: string;
}

export interface BusinessProfileData {
  description: string;
  industry_served?: string;
  products_services: string;
  customer_type?: string;
  additional_context?: string;
}

export interface WorkspacePreferencesData {
  timezone?: string;
  default_response_style?: string;
  language?: string;
}

export interface ActivationStatusData {
  account_created: boolean;
  email_connected: boolean;
  connected_accounts_count: number;
  knowledge_added: boolean;
  knowledge_items_count: number;
}

export const authApi = {
  /**
   * Fetch authoritative workspace activation status (mailboxes & knowledge items).
   */
  async getActivationStatus(organizationId?: string): Promise<ActivationStatusData> {
    const options = organizationId ? { tenantId: organizationId } : undefined;
    const res = await apiClient.get<{ success: boolean; data: ActivationStatusData }>(
      "/onboarding/activation-status",
      options
    );
    return res.data.data;
  },

  /**
   * Register a new user account and initiate email OTP verification challenge.
   */
  async signup(data: SignupRequest): Promise<SignupResponse> {
    const res = await apiClient.post<SignupResponse>("/auth/signup", data);
    return res.data;
  },

  /**
   * Submit OTP code to activate account and establish initial authenticated session.
   */
  async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    const res = await apiClient.post<VerifyOtpResponse>("/auth/verify-otp", data);
    return res.data;
  },

  /**
   * Request a new OTP code if 45s cooldown period has elapsed.
   */
  async resendOtp(data: ResendOtpRequest): Promise<ResendOtpResponse> {
    const res = await apiClient.post<ResendOtpResponse>("/auth/resend-otp", data);
    return res.data;
  },

  /**
   * Sign in with email and password to receive secure session.
   */
  async signin(data: SigninRequest): Promise<SigninResponse> {
    const res = await apiClient.post<SigninResponse>("/auth/signin", data);
    return res.data;
  },

  /**
   * Revoke current session and clear session cookies.
   */
  async signout(): Promise<void> {
    await apiClient.post("/auth/signout");
  },

  /**
   * Fetch authenticated user identity and membership context.
   */
  async getCurrentUser(): Promise<UserMeResponse> {
    const res = await apiClient.get<UserMeResponse>("/auth/me");
    return res.data;
  },

  /**
   * Resolve authoritative onboarding step and route.
   */
  async getOnboardingState(organizationId?: string): Promise<OnboardingStateData> {
    const options = organizationId ? { tenantId: organizationId } : undefined;
    const res = await apiClient.get<{ success: boolean; data: OnboardingStateData }>(
      "/onboarding/state",
      options
    );
    return res.data.data;
  },

  /**
   * Atomically create an organization and assign caller OWNER role.
   */
  async createOrganization(data: OrganizationCreateData): Promise<any> {
    const res = await apiClient.post<{ success: boolean; data: any }>("/organizations", data);
    return res.data.data;
  },

  /**
   * Save organization business profile.
   */
  async updateBusinessProfile(organizationId: string, data: BusinessProfileData): Promise<any> {
    const res = await apiClient.patch<{ success: boolean; data: any }>(
      `/organizations/${organizationId}/business-profile`,
      data
    );
    return res.data.data;
  },

  /**
   * Save workspace preferences and mark onboarding complete.
   */
  async updateWorkspacePreferences(organizationId: string, data: WorkspacePreferencesData): Promise<any> {
    const res = await apiClient.patch<{ success: boolean; data: any }>(
      `/organizations/${organizationId}/preferences`,
      data
    );
    return res.data.data;
  },
};
