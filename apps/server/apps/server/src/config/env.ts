import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive(),
  HOST: z.string().min(1),
  DATABASE_URL: z.url(),
});

export const env = envSchema.parse(process.env);