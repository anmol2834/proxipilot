import { env } from "@/config/env";
import { logger } from "../logger";

export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
}

class AnalyticsService {
  private enabled = env.NEXT_PUBLIC_ENABLE_ANALYTICS;

  public track(event: string, properties?: Record<string, unknown>): void {
    if (!this.enabled) {
      logger.debug(`[Analytics:Mock] Event: ${event}`, properties);
      return;
    }

    try {
      // Future vendor integration hook (e.g. PostHog, Segment, Plausible)
      logger.info(`[Analytics:Track] ${event}`, properties);
    } catch (err) {
      logger.error("Failed to track analytics event", err);
    }
  }

  public identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.enabled) {
      logger.debug(`[Analytics:Mock] Identify: ${userId}`, traits);
      return;
    }

    try {
      logger.info(`[Analytics:Identify] ${userId}`, traits);
    } catch (err) {
      logger.error("Failed to identify user in analytics", err);
    }
  }

  public pageView(url: string): void {
    if (!this.enabled) {
      logger.debug(`[Analytics:Mock] PageView: ${url}`);
      return;
    }

    try {
      logger.info(`[Analytics:PageView] ${url}`);
    } catch (err) {
      logger.error("Failed to track pageview", err);
    }
  }
}

export const analytics = new AnalyticsService();
export const track = (event: string, properties?: Record<string, unknown>) =>
  analytics.track(event, properties);
