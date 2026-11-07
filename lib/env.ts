import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(16).default("dev-only-socialflow-session-secret"),
  TOKEN_ENCRYPTION_KEY: z.string().min(16).default("dev-only-encryption-key"),
  META_MODE: z.enum(["mock", "real"]).default("mock"),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
export const isDev = process.env.NODE_ENV !== "production";
export const isMockMeta = env.META_MODE === "mock" || !env.META_APP_ID || !env.META_APP_SECRET;
export const isDiscordConfigured = Boolean(env.DISCORD_BOT_TOKEN);
