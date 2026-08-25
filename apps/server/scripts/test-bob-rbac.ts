import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const API_URL = "http://127.0.0.1:4000";

const workspaceId = "8a60cb7b-78e5-4b25-8e96-b8ce74583cf1";
const charlieUserId = "936c9de4-283b-4a0f-b6aa-e810de7cd7c8";

const email = "bob@teamspace.dev";
const password = process.env.BOB_TEST_PASSWORD;

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
        email,
        password,
      }),
    },
  );

  const loginData = await loginResponse.json();

  if (!loginResponse.ok) {
    console.error("❌ Bob login failed:");
    console.error(loginData);
    process.exit(1);
  }

  const accessToken = loginData.access_token;

  if (!accessToken) {
    console.error("❌ No access token returned.");
    process.exit(1);
  }

  console.log("✅ Bob logged in successfully.");
  console.log("👤 User:", loginData.user?.email);

  console.log("\n🚀 Bob is trying to add Charlie...");

  const response = await fetch(
    `${API_URL}/api/workspaces/${workspaceId}/members`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: charlieUserId,
      }),
    },
  );

  const result = await response.json();

  console.log("\n📡 API Response");
  console.log("======================");
  console.log("HTTP Status:", response.status);
  console.log("Response:", JSON.stringify(result, null, 2));

  if (
    response.status === 403 &&
    result?.error?.code === "INSUFFICIENT_PERMISSIONS"
  ) {
    console.log("\n🎉 RBAC TEST PASSED!");
    console.log("Bob is MEMBER and cannot add members.");
  } else {
    console.log("\n❌ RBAC TEST FAILED.");
  }
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});