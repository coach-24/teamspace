import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const ALICE_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const channelId =
  "3b16e91f-7d77-4de5-8fba-2d26ac5b6151";

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

  console.log("✅ Alice logged in.\n");

  for (let i = 1; i <= 5; i++) {
    const response = await fetch(
      `${API_URL}/api/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${loginData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `Pagination test message ${i}`,
        }),
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Failed to create message ${i}`);
      console.error(result);
      process.exit(1);
    }

    console.log(`✅ Created message ${i}: ${result.data.id}`);

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log("\n🎉 Pagination test data created!");
};

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});