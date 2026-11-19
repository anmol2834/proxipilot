import type { QueryClient } from "@tanstack/react-query";
import type { OnboardingStateData } from "@/lib/api";
import { queryKeys } from "./query-keys";

/**
 * Drop everything cached under the previous login before entering the app with a new session.
 *
 * Why: the cache outlives sign-in/sign-out within one tab. After a password reset (which revokes
 * every session) the dashboard could start from the old session's cached user/onboarding data,
 * and DashboardGuard hid the whole page until a background refetch (e.g. tab focus) replaced it.
 *
 * Pass the onboarding state the sign-in form just fetched so the dashboard has fresh,
 * authoritative data on its first render instead of waiting on another request.
 */
export function startFreshSession(queryClient: QueryClient, onboarding?: OnboardingStateData) {
  queryClient.cancelQueries();
  queryClient.clear();
  if (onboarding) {
    queryClient.setQueryData(queryKeys.auth.onboarding(), onboarding);
  }
}
