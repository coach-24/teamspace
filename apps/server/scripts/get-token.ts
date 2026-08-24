import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const { data, error } = await supabase.auth.signInWithPassword({
  email: "alice@teamspace.dev",
  password: process.env.TEST_USER_PASSWORD!,
});

if (error) {
  console.error("❌ Login failed:", error.message);
  process.exit(1);
}

console.log("✅ Login successful");
console.log("User ID:", data.user.id);
console.log("Access token:");
console.log(data.session.access_token);