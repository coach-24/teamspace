import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const channelId =
  "02451e5a-74bf-448a-a038-fae32cd6b9c4";

const bobUserId =
  "23498c3d-1077-4abb-8d7c-ea5e48f29aae";

const main = async () => {
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

  console.log("\n🗑️ Removing Bob from private channel...");

  const response = await fetch(
    `${API_URL}/api/channels/${channelId}/members/${bobUserId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${loginData.access_token}`,
      },
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

  if (response.status === 200) {
    console.log("\n🎉 REMOVE MEMBER PASSED!");
  } else {
    console.log("\n❌ REMOVE MEMBER FAILED.");
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});