import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("ProxiPilot"),
  NEXT_PUBLIC_APP_ENV: z
    .enum(["development", "staging", "production", "test"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:8000/api/v1"),
  NEXT_PUBLIC_API_TIMEOUT_MS: z.coerce.number().positive().default(15000),
  NEXT_PUBLIC_ENABLE_ANALYTICS: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
  NEXT_PUBLIC_ENABLE_MOCK_API: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
});

const parseEnv = () => {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api/v1";

  const result = envSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: apiUrl,
    NEXT_PUBLIC_API_TIMEOUT_MS: process.env.NEXT_PUBLIC_API_TIMEOUT_MS,
    NEXT_PUBLIC_ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS,
    NEXT_PUBLIC_ENABLE_MOCK_API: process.env.NEXT_PUBLIC_ENABLE_MOCK_API,
  });

  if (!result.success) {
    // In development or test, log a warning with missing/invalid fields
    console.warn("Invalid environment variables:", result.error.flatten().fieldErrors);
    // Provide sensible defaults for uninterrupted development
    return envSchema.parse({ NEXT_PUBLIC_API_URL: apiUrl });
  }

  return result.data;
};

const parsedEnv = parseEnv();

export const env = {
  ...parsedEnv,
  API_BASE_URL: parsedEnv.NEXT_PUBLIC_API_URL,
};
export type Env = z.infer<typeof envSchema> & { API_BASE_URL: string };
