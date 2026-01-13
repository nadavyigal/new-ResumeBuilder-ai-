import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), {
      message: 'must start with "https://"',
    }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

const serverSchemaBase = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  OPENAI_API_KEY: z
    .string()
    .min(20)
    .refine((value) => value.startsWith("sk-"), {
      message: 'must start with "sk-"',
    }),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
});

const serverSchema =
  process.env.NODE_ENV === "production"
    ? serverSchemaBase
    : serverSchemaBase.extend({
        SUPABASE_SERVICE_ROLE_KEY: serverSchemaBase.shape.SUPABASE_SERVICE_ROLE_KEY.optional(),
        OPENAI_API_KEY: serverSchemaBase.shape.OPENAI_API_KEY.optional(),
      });

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof publicSchema>;

let cachedServerEnv: ServerEnv | null = null;
let cachedClientEnv: ClientEnv | null = null;

function formatZodError(error: z.ZodError): string {
  const formattedErrors = error.errors
    .map((err) => `${err.path.join(".")}: ${err.message}`)
    .join("\\n");

  return `Invalid environment variables:
${formattedErrors}

Please check your .env.local file.`;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  try {
    cachedServerEnv = serverSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });

    return cachedServerEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(formatZodError(error));
    }
    throw error;
  }
}

export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  try {
    cachedClientEnv = publicSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    });

    return cachedClientEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(formatZodError(error));
    }
    throw error;
  }
}

if (process.env.NODE_ENV === "production" && typeof window === "undefined") {
  getServerEnv();
}
