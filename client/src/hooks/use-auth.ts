"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { authApi, UserMeResponse, SigninRequest, SignupRequest, VerifyOtpRequest } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export type AuthState = "INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED";

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Canonical Current User Query
  const {
    data: user,
    isLoading,
    isError,
    error,
    refetch: refetchUser,
  } = useQuery<UserMeResponse, Error>({
    queryKey: queryKeys.auth.user(),
    queryFn: () => authApi.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: false, // Do not retry 401/403
  });

  const authState: AuthState = isLoading
    ? "INITIALIZING"
    : user
    ? "AUTHENTICATED"
    : "UNAUTHENTICATED";

  // Canonical Signin Mutation
  const signinMutation = useMutation({
    mutationFn: (credentials: SigninRequest) => authApi.signin(credentials),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });

  // Canonical Signup Mutation
  const signupMutation = useMutation({
    mutationFn: (data: SignupRequest) => authApi.signup(data),
  });

  // Canonical Verify OTP Mutation
  const verifyOtpMutation = useMutation({
    mutationFn: (data: VerifyOtpRequest) => authApi.verifyOtp(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.all });
    },
  });

  // Canonical Signout Mutation: cleans all server and tenant state
  const signout = useCallback(async () => {
    try {
      await authApi.signout();
    } catch {
      // Ignore network errors during signout to ensure client cleanup
    } finally {
      // Cancel all active queries
      await queryClient.cancelQueries();
      // Clear entire server state cache to isolate data between sessions
      queryClient.clear();
      // Route cleanly to signin
      router.replace("/signin");
    }
  }, [queryClient, router]);

  return {
    user,
    authState,
    isLoading,
    isAuthenticated: authState === "AUTHENTICATED",
    isError,
    error,
    refetchUser,
    signin: signinMutation.mutateAsync,
    isSigningIn: signinMutation.isPending,
    signup: signupMutation.mutateAsync,
    isSigningUp: signupMutation.isPending,
    verifyOtp: verifyOtpMutation.mutateAsync,
    isVerifyingOtp: verifyOtpMutation.isPending,
    signout,
  };
}
