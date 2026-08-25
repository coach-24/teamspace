import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const channelId =
  "d09b8ec6-4059-4203-bc94-be2a81bce0d7";

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
    console.error("❌ Login failed:");
    console.error(loginData);
    process.exit(1);
  }

  console.log("✅ Alice logged in.");

  const response = await fetch(
    `${API_URL}/api/channels/${channelId}`,
    {
      method: "GET",
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
    console.log("\n🎉 CHANNEL DETAILS TEST PASSED!");
  } else {
    console.log("\n❌ CHANNEL DETAILS TEST FAILED.");
  }
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});