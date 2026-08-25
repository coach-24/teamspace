import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

// Replace with the fresh Alice message ID.
const messageId = "d14b4bbf-6527-4f72-b0d1-a79d9a38b5e7";

const main = async () => {
  // ============================================
  // Login
  // ============================================

  console.log("🔐 Logging in as Bob...");

  const loginResponse = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "bob@teamspace.dev",
        password: BOB_PASSWORD,
      }),
    },
  );

  const loginData = await loginResponse.json();

  if (!loginResponse.ok) {
    console.error("❌ Bob login failed:");
    console.error(loginData);
    process.exit(1);
  }

  console.log("✅ Bob logged in.");
  console.log("👤 User:", loginData.user?.email);

  // ============================================
  // Attempt deletion
  // ============================================

  console.log(
    "\n🚫 Bob is trying to delete Alice's message...",
  );
  console.log("🆔 Message ID:", messageId);

  const response = await fetch(
    `${API_URL}/api/messages/${messageId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${loginData.access_token}`,
      },
    },
  );

  console.log("\n📡 API Response");
  console.log("======================");
  console.log("HTTP Status:", response.status);

  const result =
    response.status === 204
      ? null
      : await response.json();

  if (result) {
    console.log(
      "Response:",
      JSON.stringify(result, null, 2),
    );
  }

  // ============================================
  // Verify RBAC
  // ============================================

  if (
    response.status === 403 &&
    result?.error?.code === "MESSAGE_DELETE_DENIED"
  ) {
    console.log(
      "\n🎉 MESSAGE DELETE RBAC PASSED!",
    );
    console.log(
      "Bob cannot delete Alice's message.",
    );
    return;
  }

  console.log(
    "\n❌ MESSAGE DELETE RBAC FAILED.",
  );

  process.exit(1);
};

main().catch((error) => {
  console.error("\n❌ Unexpected error:");
  console.error(error);
  process.exit(1);
});