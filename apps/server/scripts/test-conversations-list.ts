import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const TEST_PASSWORD = process.env.TEST_PASSWORD!;

const API_URL = "http://127.0.0.1:4000";

const login = async (
  email: string,
  password: string,
) => {
  const response = await fetch(
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

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Login failed for ${email}: ${JSON.stringify(data)}`,
    );
  }

  return data.access_token as string;
};

const main = async () => {
  console.log("🔐 Logging in Alice...");

  const aliceToken = await login(
    "alice@teamspace.dev",
    TEST_PASSWORD,
  );

  console.log("✅ Alice logged in.");

  // ============================================
  // Fetch conversations
  // ============================================

  console.log(
    "\n📥 Fetching Alice's conversations...",
  );

  const response = await fetch(
    `${API_URL}/api/conversations`,
    {
      headers: {
        Authorization: `Bearer ${aliceToken}`,
      },
    },
  );

  const result = await response.json();

  console.log("\n📡 Response");
  console.log("======================");
  console.log(
    "HTTP Status:",
    response.status,
  );
  console.log(
    "Response:",
    JSON.stringify(result, null, 2),
  );

  if (response.status !== 200) {
    console.error(
      "\n❌ Conversation listing failed.",
    );
    process.exit(1);
  }

  if (!Array.isArray(result.data)) {
    console.error(
      "\n❌ Response data is not an array.",
    );
    process.exit(1);
  }

  if (result.data.length === 0) {
    console.error(
      "\n❌ Alice should have at least one conversation.",
    );
    process.exit(1);
  }

  const bobConversation = result.data.find(
    (conversation: {
      other_user_email?: string;
      other_user_display_name?: string;
    }) =>
      conversation.other_user_email ===
        "bob@teamspace.dev" ||
      conversation.other_user_display_name ===
        "Bob",
  );

  if (!bobConversation) {
    console.error(
      "\n❌ Alice's Bob conversation was not found.",
    );
    process.exit(1);
  }

  console.log(
    "\n✅ Alice's Bob conversation was found.",
  );

  console.log(
    "\n🎉 CONVERSATION LIST TEST PASSED!",
  );

  console.log(
    "✅ Alice can retrieve her conversations.",
  );

  console.log(
    "✅ Bob appears as the other participant.",
  );
};

main().catch((error) => {
  console.error(
    "❌ Unexpected error:",
    error,
  );

  process.exit(1);
});