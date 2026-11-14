import { z } from "zod";

export const commonSchemas = {
  id: z.string().min(1, "ID is required"),

  uuid: z.string().uuid("Invalid UUID format"),

  email: z
    .string()
    .trim()
    .min(1, "Email address is required")
    .email("Please enter a valid email address"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),

  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug cannot exceed 50 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug can only contain lowercase letters, numbers, and hyphens"
    ),

  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  }),
};

export type PaginationQuery = z.infer<typeof commonSchemas.pagination>;
