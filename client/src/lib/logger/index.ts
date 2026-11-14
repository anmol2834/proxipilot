import { env } from "@/config/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogPayload {
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
}

class Logger {
  private isDevelopment = env.NEXT_PUBLIC_APP_ENV === "development";

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] [ProxiPilot]: ${message}`;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.debug(this.formatMessage("debug", message), context ?? "");
    }
  }

  public info(message: string, context?: Record<string, unknown>): void {
    if (this.isDevelopment) {
      // eslint-disable-next-line no-console
      console.info(this.formatMessage("info", message), context ?? "");
    }
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    console.warn(this.formatMessage("warn", message), context ?? "");
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    console.error(this.formatMessage("error", message), { error, context });
  }
}

export const logger = new Logger();
