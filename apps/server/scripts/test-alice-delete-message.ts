import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

// Replace this with the ID of a fresh message created by Alice.
const messageId = "50e91046-77a5-4145-8a98-da5891318bd6";

const main = async () => {
  // ============================================
  // Login
  // ============================================

  console.log("🔐 Logging in as Alice...");

  const loginResponse = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "alice@teamspace.dev",
        password: ALICE_PASSWORD,
      }),
    },
  );

  const loginData = await loginResponse.json();

  if (!loginResponse.ok) {
    console.error("❌ Alice login failed:");
    console.error(loginData);
    process.exit(1);
  }

  console.log("✅ Alice logged in.");
  console.log("👤 User:", loginData.user?.email);

  // ============================================
  // Delete message
  // ============================================

  console.log("\n🗑️ Alice is deleting her own message...");
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

  // 204 responses have no body.
  if (response.status === 204) {
    console.log(
      "\n🎉 ALICE MESSAGE DELETE PASSED!",
    );
    console.log(
      "Alice successfully deleted her own message.",
    );
    return;
  }

  const result = await response.json();

  console.log(
    "Response:",
    JSON.stringify(result, null, 2),
  );

  console.log("\n❌ ALICE MESSAGE DELETE FAILED.");
  process.exit(1);
};

main().catch((error) => {
  console.error("\n❌ Unexpected error:");
  console.error(error);
  process.exit(1);
});