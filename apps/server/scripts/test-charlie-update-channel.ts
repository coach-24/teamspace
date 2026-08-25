import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const CHARLIE_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const channelId =
  "02451e5a-74bf-448a-a038-fae32cd6b9c4";

const main = async () => {
  console.log("🔐 Logging in as Charlie...");

  const loginResponse = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "charlie@teamspace.dev",
        password: CHARLIE_PASSWORD,
      }),
    },
  );

  const loginData = await loginResponse.json();

  if (!loginResponse.ok) {
    console.error("❌ Charlie login failed:");
    console.error(loginData);
    process.exit(1);
  }

  console.log("✅ Charlie logged in.");
  console.log("👤 User:", loginData.user?.email);

  console.log(
    "\n🚫 Charlie (MEMBER) is trying to update the channel...",
  );

  const response = await fetch(
    `${API_URL}/api/channels/${channelId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Charlie Should Not Change This",
        description: "Unauthorized update attempt",
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
    result?.error?.code === "INSUFFICIENT_PERMISSIONS"
  ) {
    console.log("\n🎉 MEMBER CHANNEL UPDATE RBAC PASSED!");
    console.log("Charlie cannot update the channel.");
  } else {
    console.log("\n❌ MEMBER CHANNEL UPDATE RBAC FAILED.");
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});