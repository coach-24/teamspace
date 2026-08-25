import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const BOB_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const messageId = "5b68ed6b-5ed8-4706-ad01-8d390b26ffc2";

const main = async () => {
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
  console.log("\n🚫 Bob is trying to edit Alice's message...");

  const response = await fetch(
    `${API_URL}/api/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Bob should NOT be able to edit this ❌",
      }),
    },
  );

  const result = await response.json();

  console.log("\n📡 API Response");
  console.log("======================");
  console.log("HTTP Status:", response.status);
  console.log(
    "Response:",
    JSON.stringify(result, null, 2),
  );

  if (
    response.status === 403 &&
    result?.error?.code === "MESSAGE_EDIT_DENIED"
  ) {
    console.log("\n🎉 MESSAGE OWNERSHIP RBAC PASSED!");
    console.log("Bob cannot edit Alice's message.");
  } else {
    console.log("\n❌ MESSAGE OWNERSHIP RBAC FAILED.");
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});