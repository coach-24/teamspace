import type { Pool } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthenticatedUser } from "./types/auth.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Pool;
    supabase: SupabaseClient;
  }

  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }

  interface FastifyContextConfig {
    requiresAuth?: boolean;
  }
}