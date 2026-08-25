import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.ALICE_TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const workspaceId =
  "8a60cb7b-78e5-4b25-8e96-b8ce74583cf1";

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
        password: process.env.TEST_PASSWORD,
      }),
    },
  );

  const loginData = await loginResponse.json();

  if (!loginResponse.ok) {
    console.error("❌ Alice login failed:");
    console.error(loginData);
    process.exit(1);
  }

  const accessToken = loginData.access_token;

  console.log("✅ Alice logged in successfully.");
  console.log("👤 User:", loginData.user?.email);

  const body = {
    name: "Frontend",
    slug: "frontend",
    description: "Frontend development discussions",
    isPrivate: false,
  };

  console.log("\n🚀 Creating Frontend channel...");

  const response = await fetch(
    `${API_URL}/api/workspaces/${workspaceId}/channels`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const result = await response.json();

  console.log("\n📡 API Response");
  console.log("======================");
  console.log("HTTP Status:", response.status);
  console.log("Response:", JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});