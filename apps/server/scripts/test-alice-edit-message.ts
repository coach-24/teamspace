import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const messageId = "5b68ed6b-5ed8-4706-ad01-8d390b26ffc2";

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

  console.log("\n✏️ Alice is editing her message...");

  const response = await fetch(
    `${API_URL}/api/messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${loginData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: "Edited message from Alice ✏️",
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
    response.status === 200 &&
    result?.data?.content === "Edited message from Alice ✏️"
  ) {
    console.log("\n🎉 ALICE MESSAGE EDIT PASSED!");
  } else {
    console.log("\n❌ ALICE MESSAGE EDIT FAILED.");
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});